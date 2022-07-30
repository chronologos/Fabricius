/* eslint-disable max-len */
/* eslint-disable no-multi-str */

import {AugmentedBlock, Block, BlockWithNote} from './types';
import {
  batchFindNotes,
  updateNote,
  batchAddNotes,
  invokeAnkiConnect,
} from './anki';
import {config} from './config';
import {
  convertToCloze,
  pullBlocksUnderTag,
  pullBlocksWithTag,
  getAttrUnderBlock,
} from './roam';

async function retry(fn: () => Promise<any>, n: number) {
  for (let i = 0; i < n; i++) {
    try {
      return await fn();
    } catch {}
  }

  throw new Error(`Failed retrying ${n} times`);
}

// Core sync logic
const syncNow = async () => {
  // STEP 1: Get all blocks that reference srs/cloze
  // Useful attributes in these blocks: uid, string, time (unix epoch)
  const singleBlocks: AugmentedBlock[] = await retry(
    () => pullBlocksWithTag(config.CLOZE_TAG),
    3
  );
  // groupBlocks are augmented with information from their parent.
  const groupBlocks = await retry(
    () => pullBlocksUnderTag(config.GROUPED_CLOZE_TAG, config.TITLE_CLOZE_TAG),
    3
  );
  const groupClozeBlocks: AugmentedBlock[] =
    groupBlocks.filter(blockContainsCloze);
  const blocks: AugmentedBlock[] = singleBlocks.concat(groupClozeBlocks);
  // console.log(JSON.stringify(singleBlocks, null, 2));
  // console.log(JSON.stringify(groupClozeBlocks, null, 2));
  const blockWithNid: [Block, number][] = await retry(
    () => Promise.all(blocks.map(b => processSingleBlock(b))),
    3
  );
  const blocksWithNids = blockWithNid.filter(
    ([_, nid]) => nid !== config.NO_NID
  );
  const blocksWithNoNids = blockWithNid
    .filter(([_, nid]) => nid === config.NO_NID)
    .map(b => b[0]);
  const existingNotes = await retry(() => batchFindNotes(blocksWithNids), 3);

  // STEP 2: For blocks that exist in both Anki and Roam, generate `blockWithNote`.
  // The schema for `blockWithNote` is shown in `NOTES.md`.
  const blockWithNote: BlockWithNote[] = blocksWithNids.map((block, i) => {
    const _existingNote = existingNotes[i];
    const noteMetadata = JSON.parse(
      _existingNote['fields'][config.ANKI_FIELD_FOR_CLOZE_TAG]['value']
    );
    _existingNote.block_time = noteMetadata['block_time'];
    _existingNote.block_uid = noteMetadata['block_uid'];
    return {nid: block[1], block: block[0], note: _existingNote};
  });

  // Toggle this on for debugging only
  // console.log("blocks with no nids" + JSON.stringify(blocksWithNoNids));
  // console.log("blockWithNote array: " + JSON.stringify(blockWithNote, null, 2));

  // STEP 3: Compute diffs between Anki and Roam
  const newerInRoam = blockWithNote.filter(
    x => x.block.time > x.note.block_time
  );
  const newerInAnki = blockWithNote.filter(
    x =>
      x.block.time <= x.note.block_time &&
      // TODO(better diff algorithm here)
      convertToCloze(x.block.string) !==
        x.note['fields'][config.ANKI_FIELD_FOR_CLOZE_TEXT]['value']
  );
  console.log('[syncNow] total synced blocks ' + blocks.length);
  console.log('[syncNow] newer in roam ' + newerInRoam.length);
  console.log('[syncNow] newer in anki ' + newerInAnki.length);

  // STEP 4: Update Anki's outdated notes
  const updateExistingInAnki = await retry(
    () => Promise.all(newerInRoam.map(x => updateNote(x))),
    3
  );
  console.log(updateExistingInAnki); // should be an array of nulls if there are no errors

  // STEP 5: Update Roam's outdated blocks
  const updateExistingInRoam = await retry(
    () => Promise.all(newerInAnki.map(x => updateBlock(x))),
    3
  );
  console.log(updateExistingInRoam); // should be an array of nulls if there are no errors

  // STEP 6: Create new cards in Anki
  const results = await retry(() => batchAddNotes(blocksWithNoNids), 3);
  console.log(results); // should be an array of nulls if there are no errors
  console.log(
    '[syncNow]' + JSON.stringify(getAttrUnderBlock('fabricius/config'))
  );
};

// UI logic
const renderFabriciusButton = () => {
  const syncAnkiButton = document.createElement('span');
  syncAnkiButton.id = 'sync-anki-button-span';
  syncAnkiButton.classList.add('bp3-popover-wrapper');
  syncAnkiButton.setAttribute('style', 'margin-left: 4px;');
  const outerSpan = document.createElement('span');
  outerSpan.classList.add('bp3-popover-target');
  syncAnkiButton.appendChild(outerSpan);
  const icon = document.createElement('span');
  icon.id = 'sync-anki-icon';
  icon.setAttribute('status', 'off');
  icon.classList.add(
    'bp3-icon-intersection',
    'bp3-button',
    'bp3-minimal',
    'bp3-small'
  );
  outerSpan.appendChild(icon);
  /** workaround needed because roam/js can load before the topbar */
  function renderInTopbar() {
    if (!document.getElementsByClassName('rm-topbar')) {
      window.requestAnimationFrame(renderInTopbar);
    } else {
      document
        .getElementsByClassName('rm-topbar')[0]
        .appendChild(syncAnkiButton);
    }
  }
  renderInTopbar();
  icon.onclick = syncNow;
};

const removeFabriciusButton = () => {
  const syncAnkiButton = document.getElementById('sync-anki-button-span');
  syncAnkiButton?.remove();
};

if (document.getElementById('sync-anki-button-span') !== null) {
  document.getElementById('sync-anki-button-span')!.remove();
}
console.log('adding anki sync!');
try {
  renderFabriciusButton();
} catch (e) {
  window.requestAnimationFrame(renderFabriciusButton);
}

// For Roam Depot
export default {
  onload: () => {
    try {
      renderFabriciusButton();
    } catch (e) {
      window.requestAnimationFrame(renderFabriciusButton);
    }
  },
  onunload: () => {
    removeFabriciusButton();
  },
};

// Helpers

// updateBlock mutates `blockWithNote`.
const updateBlock = async (blockWithNote: BlockWithNote): Promise<any> => {
  const noteText =
    blockWithNote.note.fields[config.ANKI_FIELD_FOR_CLOZE_TEXT]['value'];
  const blockText = convertToRoamBlock(noteText);
  // success? - boolean
  const updateRes = window.roamAlphaAPI.updateBlock({
    block: {
      uid: blockWithNote.block.uid,
      string: blockText,
    },
  });
  if (!updateRes) {
    console.log('[updateBlock] failed to update');
    return;
  }
  // The block will have a newer modified time than the Anki note. But we don't know what value it is. We query for it after waiting, and update the note in Anki.
  await new Promise(r => setTimeout(r, 200));
  const updateTime = window.roamAlphaAPI.q(
    `[ :find (pull ?e [ :edit/time ]) :where [?e :block/uid "${blockWithNote.block.uid}"]]`
  )[0][0].time;
  // console.log(updateTime);
  blockWithNote.block.time = updateTime;
  blockWithNote.block.string = blockText;
  return updateNote(blockWithNote);
};

export const processSingleBlock = async (
  block: Block
): Promise<[Block, number]> => {
  // console.log('searching for block ' + block.uid);
  // TODO: should do a more exact structural match on the block uid here, but a collision *seems* unlikely.
  const nid: number[] = await invokeAnkiConnect(
    config.ANKI_CONNECT_FINDNOTES,
    config.ANKI_CONNECT_VERSION,
    {
      query: `${config.ANKI_FIELD_FOR_CLOZE_TAG}:re:${block.uid} AND note:${config.ANKI_MODEL_FOR_CLOZE_TAG}`,
    }
  );
  if (nid.length === 0) {
    // create card in Anki
    return [block, config.NO_NID];
  }
  // TODO(can be improved)
  // assume that only 1 note matches
  return [block, nid[0]];
};

const blockContainsCloze = (block: AugmentedBlock) => {
  const found = block.string.match(/{c(\d+):([^}]*)}/g);
  return found !== null && found.length !== 0;
};

const ANKI_CLOZE_PATTERN = /{{c(\d+)::([^}:]*)}}/g;
const ANKI_CLOZE_WITH_HINT_PATTERN = /{{c(\d+)::([^}:]*)::([^}]*)}}/g;

// String manipulation functions
const convertToRoamBlock = (s: string) => {
  if (s.match(ANKI_CLOZE_PATTERN)) {
    s = s.replace(ANKI_CLOZE_PATTERN, '{c$1:$2}');
  } else if (s.match(ANKI_CLOZE_WITH_HINT_PATTERN)) {
    s = s.replace(ANKI_CLOZE_WITH_HINT_PATTERN, '{c$1:$2:hint:$3}');
  }
  s = basicHtmlToMarkdown(s);
  return s;
};

const basicHtmlToMarkdown = (s: string) => {
  s = s.replace('<b>', '**');
  s = s.replace('</b>', '**');
  s = s.replace('<i>', '__');
  s = s.replace('</i>', '__');
  s = s.replace('&nbsp;', ' ');
  s = s.replace('<br>', '\n');
  return s;
};
