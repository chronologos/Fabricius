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
import {convertToCloze, pullBlocksUnderTag, pullBlocksWithTag} from './roam';
import {render} from './toast';
import {Intent} from '@blueprintjs/core';

// Core sync logic
const syncNow = async (extensionAPI: any) => {
  console.log('[syncNow] starting sync');

  // STEP 0: Load all config
  const allSettings = await extensionAPI.settings.getAll();
  console.log(allSettings);
  const groupTag = await getOrDefault(
    extensionAPI.settings.get(config.GROUPED_CLOZE_TAG_KEY),
    config.GROUPED_CLOZE_TAG
  );
  const titleTag = await getOrDefault(
    extensionAPI.settings.get(config.TITLE_CLOZE_TAG_KEY),
    config.TITLE_CLOZE_TAG
  );
  const deck = await getOrDefault(
    extensionAPI.settings.get(config.ANKI_DECK_NAME_KEY),
    config.ANKI_DECK_NAME
  );
  const model = await getOrDefault(
    extensionAPI.settings.get(config.ANKI_MODEL_NAME_KEY),
    config.ANKI_MODEL_NAME
  );
  const clozeField = await getOrDefault(
    extensionAPI.settings.get(config.ANKI_FIELD_FOR_CLOZE_TEXT_KEY),
    config.ANKI_FIELD_FOR_CLOZE_TEXT
  );
  const titleField = await getOrDefault(
    extensionAPI.settings.get(config.ANKI_FIELD_FOR_TITLE_KEY),
    config.ANKI_FIELD_FOR_TITLE
  );
  const groupHeaderField = await getOrDefault(
    extensionAPI.settings.get(config.ANKI_FIELD_FOR_GROUP_HEADER_KEY),
    config.ANKI_FIELD_FOR_GROUP_HEADER
  );
  const metadataField = await getOrDefault(
    extensionAPI.settings.get(config.ANKI_FIELD_FOR_METADATA_KEY),
    config.ANKI_FIELD_FOR_METADATA
  );

  // STEP 1: Get all blocks that reference CLOZE_TAG
  // Useful attributes in these blocks: uid, string, time (unix epoch)
  render({
    id: 'syncer',
    content: 'Fabricius: starting sync',
    intent: Intent.SUCCESS,
  });
  const singleBlocks: AugmentedBlock[] = await retry(
    () => pullBlocksWithTag(config.CLOZE_TAG), // TODO: not using settings panel
    3
  );
  // groupBlocks are augmented with information from their parent.
  const groupBlocks = await retry(
    () => pullBlocksUnderTag(groupTag, titleTag),
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
      _existingNote['fields'][metadataField]['value']
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
      convertToCloze(x.block.string) !== x.note['fields'][clozeField]['value']
  );
  console.log('[syncNow] total synced blocks ' + blocks.length);
  console.log('[syncNow] newer in roam ' + newerInRoam.length);
  console.log('[syncNow] newer in anki ' + newerInAnki.length);

  // STEP 4: Update Anki's outdated notes
  const updateExistingInAnki = await retry(
    () =>
      Promise.all(
        newerInRoam.map(x =>
          updateNote(
            x,
            clozeField,
            metadataField,
            groupHeaderField,
            groupTag,
            titleField,
            titleTag,
            deck,
            model
          )
        )
      ),
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
  const results = await retry(
    () =>
      batchAddNotes(
        blocksWithNoNids,
        clozeField,
        metadataField,
        groupHeaderField,
        groupTag,
        titleField,
        titleTag,
        deck,
        model
      ),
    3
  );
  console.log(results); // should be an array of nulls if there are no errors
  render({
    id: 'syncer',
    content: 'Fabricius: sync complete!',
    intent: Intent.SUCCESS,
  });
};

// --- UI logic ---
const renderFabriciusButton = (extensionAPI: any) => {
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
  icon.onclick = () => {
    try {
      syncNow(extensionAPI);
    } catch (error) {
      render({
        id: 'syncer-error',
        content: 'Fabricius: sync failed!',
        intent: Intent.WARNING,
      });
    }
  };
};

const removeFabriciusButton = () => {
  const syncAnkiButton = document.getElementById('sync-anki-button-span');
  syncAnkiButton?.remove();
};

// --- settings panel ---
// https://github.com/panterarocks49/settings-panel-example/blob/main/extension.js
const panelConfig = {
  tabTitle: 'Fabricius',
  settings: [
    {
      id: config.GROUPED_CLOZE_TAG_KEY,
      name: 'Roam tag',
      description:
        '[Required] Children of the Roam block tagged with this is are synced as cloze text to Anki.',
      action: {
        type: 'input',
        placeholder: config.GROUPED_CLOZE_TAG,
      },
    },
    {
      id: config.TITLE_CLOZE_TAG_KEY,
      name: 'Roam tag for title',
      description:
        '[Advanced] Creates a title for any flashcards created from descendant blocks.',
      action: {
        type: 'input',
        placeholder: config.TITLE_CLOZE_TAG,
      },
    },
    {
      id: config.ANKI_DECK_NAME_KEY,
      name: 'Anki deck',
      description: '[Required] The Anki deck to be synced to.',
      action: {
        type: 'input',
        placeholder: config.ANKI_DECK_NAME,
      },
    },
    {
      id: config.ANKI_MODEL_NAME_KEY,
      name: 'Anki model',
      description:
        '[Required] The Anki model (note type) that will be created in syncs. This must contain all required fields (prefixed by [Anki note field]).',
      action: {
        type: 'input',
        placeholder: config.ANKI_MODEL_NAME,
      },
    },
    {
      id: config.ANKI_FIELD_FOR_CLOZE_TEXT_KEY,
      name: '[Anki note field] cloze text',
      description: '[Required]',
      action: {
        type: 'input',
        placeholder: config.ANKI_FIELD_FOR_CLOZE_TEXT,
      },
    },
    {
      id: config.ANKI_FIELD_FOR_TITLE_KEY,
      name: '[Anki note field] title',
      description: '[Required]',
      action: {
        type: 'input',
        placeholder: config.ANKI_FIELD_FOR_TITLE,
      },
    },
    {
      id: config.ANKI_FIELD_FOR_GROUP_HEADER_KEY,
      name: '[Anki note field] group header',
      description: '[Required]',
      action: {
        type: 'input',
        placeholder: config.ANKI_FIELD_FOR_GROUP_HEADER,
      },
    },
    {
      id: config.ANKI_FIELD_FOR_METADATA_KEY,
      name: '[Anki note field] metadata',
      description:
        '[Required] Used by the extension to store sync metadata for the Anki note, in the note itself.',
      action: {
        type: 'input',
        placeholder: config.ANKI_FIELD_FOR_METADATA,
      },
    },
  ],
};

// --- for Roam Depot loading ---

const onload = ({extensionAPI}: {extensionAPI: any}) => {
  extensionAPI.settings.panel.create(panelConfig);
  console.log('[Fabricius] loading');
  renderFabriciusButton(extensionAPI);
  console.log('[Fabricius] loaded');
};

export default {
  onload: onload,
  onunload: () => {
    removeFabriciusButton();
  },
};

// --- Helpers ---

// Retries an async call
const retry = async (fn: () => Promise<any>, n: number) => {
  for (let i = 0; i < n; i++) {
    try {
      return await fn();
    } catch {}
  }
  render({
    id: 'syncer',
    content:
      'Fabricius: failed to sync. Is Anki open? Are you on Mac? https://foosoft.net/projects/anki-connect/#:~:text=Notes%20for%20MacOS%20Users',
    intent: Intent.DANGER,
  });
  throw new Error(`Failed retrying ${n} times`);
};

const getOrDefault = async (r: Promise<string>, d: string): Promise<string> => {
  const res = await r;
  if (res === null) {
    return d;
  }
  return res;
};

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

const processSingleBlock = async (block: Block): Promise<[Block, number]> => {
  // console.log('searching for block ' + block.uid);
  // TODO: should do a more exact structural match on the block uid here, but a collision *seems* unlikely.
  const nid: number[] = await invokeAnkiConnect(
    config.ANKI_CONNECT_FINDNOTES,
    config.ANKI_CONNECT_VERSION,
    {
      query: `${config.ANKI_FIELD_FOR_METADATA}:re:${block.uid} AND note:${config.ANKI_MODEL_NAME}`,
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
