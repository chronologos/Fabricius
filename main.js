/* eslint-disable max-len */
/* eslint-disable no-multi-str */

/* Fabricius v0.3
 * Copyright (c) 2020 Ian Tay
 *

 * This requires Anki and the AnkiConnect extension. Anki must be running.
 * You must configure ankiconnect to allow cross-origin requests from https://roamresearch.com.
 * Go to Anki -> Tools -> Addons -> Anki Connect -> Config and amend `webCorsOriginList`
 *
 * Please close the Anki browse screen when syncing.
 * Leave Anki open in the foreground to speed up the sync significantly.
 *
 */

// Configure sync using these constants
const CLOZE_TAG = 'srs/cloze';
// The Anki deck to be synced to
const ANKI_DECK_FOR_CLOZE_TAG = 'Default';
// The Anki model (note type) that will be synced
const ANKI_MODEL_FOR_CLOZE_TAG = 'ClozeRoam';
// The note field that will contain the clozed text
const ANKI_FIELD_FOR_CLOZE_TEXT = 'Text';
// The note field that will store the UID (used by the code to associate the Anki note with the Roam block)
const ANKI_FIELD_FOR_CLOZE_TAG = 'TextUID';

// --- internals below this ---
const ANKI_CONNECT_VERSION = 6;
const ANKI_CONNECT_FINDNOTES = 'findNotes';
const ANKI_CONNECT_NOTESINFO = 'notesInfo';
const ANKI_CONNECT_ADDNOTES = 'addNotes';
const ANKI_CONNECT_UPDATENOTES = 'updateNoteFields';

const NO_NID = -1;

// Core sync logic
const syncNow = async () => {
  const c = window.roamAlphaAPI.q('[\
                        :find (pull ?referencingBlock [*]) \
                        :in $ ?pagetitle\
                        :where \
                            [?referencingBlock :block/refs ?referencedPage]\
                            [?referencedPage :node/title ?pagetitle]\
                        ]', CLOZE_TAG);

  // STEP 1: Get all blocks that reference srs/cloze
  // Useful attributes in these blocks: uid, string, time (unix epoch)
  const blocks = c.map((b) => b[0]);
  const blockWithNid = await Promise.all(blocks.map((b) => processSingleBlock(b)));
  const blocksWithNids = blockWithNid.filter(([_, nid]) => nid != NO_NID);
  const blocksWithNoNids = blockWithNid.filter(([_, nid]) => nid == NO_NID).map((b) => b[0]);
  const existingNotes = await batchFindNotes(blocksWithNids);

  // STEP 2: For blocks that exist in both Anki and Roam, generate `blockWithNote`.
  // The schema for `blockWithNote` is shown in `NOTES.md`.
  const blockWithNote = blocksWithNids.map(function(block, i) {
    const _existingNote = existingNotes[i];
    const noteMetadata = JSON.parse(_existingNote['fields'][ANKI_FIELD_FOR_CLOZE_TAG]['value']);
    _existingNote.block_time = noteMetadata['block_time'];
    _existingNote.block_uid = noteMetadata['block_uid'];
    return {'nid': block[1], 'block': block[0], 'note': _existingNote};
  });

  // Toggle this on for debugging only
  // console.log("blocks with no nids" + JSON.stringify(blocksWithNoNids));
  // console.log("blockWithNote array: " + JSON.stringify(blockWithNote, null, 2));

  // STEP 3: Compute diffs between Anki and Roam
  const newerInRoam = blockWithNote.filter((x) => x.block.time > x.note.block_time);
  const newerInAnki = blockWithNote.filter((x) => x.block.time <= x.note.block_time && convertToCloze(x.block.string) != x.note['fields'][ANKI_FIELD_FOR_CLOZE_TEXT]['value']);
  console.log('[syncNow] total synced blocks ' + blocks.length);
  console.log('[syncNow] newer in roam ' + newerInRoam.length);
  console.log('[syncNow] newer in anki ' + newerInAnki.length);

  // STEP 4: Update Anki's outdated notes
  const updateExistingInAnki = await Promise.all(newerInRoam.map((x) => updateNote(x)));
  console.log(updateExistingInAnki); // should be an array of nulls if there are no errors

  // STEP 5: Update Roam's outdated blocks
  const updateExistingInRoam = await Promise.all(newerInAnki.map((x) => updateBlock(x)));
  console.log(updateExistingInRoam); // should be an array of nulls if there are no errors

  // STEP 6: Create new cards in Anki
  const results = await batchAddNotes(blocksWithNoNids);
  console.log(results); // should be an array of nulls if there are no errors
};

// UI logic
const renderAnkiButton = () => {
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
  icon.classList.add('bp3-icon-intersection', 'bp3-button', 'bp3-minimal', 'bp3-small');
  outerSpan.appendChild(icon);
  /** workaround needed because roam/js can load before the topbar */
  function renderInTopbar() {
    if (!document.getElementsByClassName('rm-topbar')) {
      window.requestAnimationFrame(renderInTopbar);
    } else {
      document.getElementsByClassName('rm-topbar')[0].appendChild(syncAnkiButton);
    }
  }
  renderInTopbar();
  icon.onclick = syncNow;
};

if (document.getElementById('sync-anki-button-span') != null) {
  document.getElementById('sync-anki-button-span').remove();
}
console.log('adding anki sync');
try {
  renderAnkiButton();
} catch (e) {
  window.requestAnimationFrame(renderAnkiButton);
}

// Helpers
const invokeAnkiConnect = (action, version, params = {}) => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.addEventListener('error', () => reject(Error('failed to issue request')));
    xhr.addEventListener('load', () => {
      try {
        const response = JSON.parse(xhr.responseText);
        if (Object.getOwnPropertyNames(response).length != 2) {
          throw Error('response has an unexpected number of fields');
        }
        if (!Object.prototype.hasOwnProperty.call(response, 'error')) {
          throw Error('response is missing required error field');
        }
        if (!Object.prototype.hasOwnProperty.call(response, 'result')) {
          throw Error('response is missing required result field');
        }
        if (response.error) {
          throw response.error;
        }
        resolve(response.result);
      } catch (e) {
        reject(e);
      }
    });

    xhr.open('POST', 'http://localhost:8765');
    // TODO
    // console.log(JSON.stringify({ action, version, params }));
    xhr.send(JSON.stringify({action, version, params}));
  });
};


const processSingleBlock = async (block) => {
  console.log('searching for block ' + block.uid);
  // TODO: should do a more exact structural match on the block uid here, but a collision *seems* unlikely.
  const nid = await invokeAnkiConnect(ANKI_CONNECT_FINDNOTES, ANKI_CONNECT_VERSION, {'query': `${ANKI_FIELD_FOR_CLOZE_TAG}:re:${block.uid} AND note:${ANKI_MODEL_FOR_CLOZE_TAG}`});
  if (nid.length == 0) {
    // create card in Anki
    return [block, NO_NID];
  }
  // TODO(can be improved)
  // assume that only 1 note matches
  return [block, nid[0]];
};

// Returns anki notes with the given note IDs.
/*
 example output:
 [{ "noteId": 1603364308368,
    "tags": [],
    "fields": {
        "Text": { "value": "observations1234: <i>when1</i> a bsslock is {{c1::modified}} in [roam](((-_bUL8eUa))) #srs/cloze", "order": 0 },
        "TextUID": { "value": "f9huaS-67", "order": 1 },
        "Back Extra": { "value": "", "order": 2 } },
    "modelName": "ClozeRoam",
    "cards": [1603364308368] }, ...]
 */
const batchFindNotes = async (blocksWithNids) => {
  const nids = blocksWithNids.map((b) => b[1]);
  const ankiNote = await invokeAnkiConnect(ANKI_CONNECT_NOTESINFO, ANKI_CONNECT_VERSION, {'notes': nids});
  return ankiNote;
};

const batchAddNotes = async (blocks) => {
  const newNotes = blocks.map((b) => blockToAnkiSyntax(b));
  return invokeAnkiConnect(ANKI_CONNECT_ADDNOTES, ANKI_CONNECT_VERSION, {'notes': newNotes});
};

const updateNote = async (blockWithNote) => {
  const newNote = blockToAnkiSyntax(blockWithNote.block);
  newNote.id = blockWithNote.note.noteId;
  delete newNote.deckName;
  delete newNote.modelName;
  return invokeAnkiConnect(ANKI_CONNECT_UPDATENOTES, ANKI_CONNECT_VERSION, {'note': newNote});
};

// updateBlock mutates `blockWithNote`.
const updateBlock = async (blockWithNote) => {
  const noteText = blockWithNote.note.fields[ANKI_FIELD_FOR_CLOZE_TEXT]['value'];
  const blockText = convertToRoamBlock(noteText);
  // success? - boolean
  const updateRes = window.roamAlphaAPI.updateBlock(
      {
        'block':
      {
        'uid': blockWithNote.block.uid,
        'string': blockText,
      },
      });
  if (!updateRes) {
    console.log('[updateBlock] failed to update');
    return;
  }
  // The block will have a newer modified time than the Anki note. But we don't know what value it is. We query for it after waiting, and update the note in Anki.
  await new Promise((r) => setTimeout(r, 200));
  const updateTime = window.roamAlphaAPI.q(`[ :find (pull ?e [ :edit/time ]) :where [?e :block/uid "${blockWithNote.block.uid}"]]`)[0][0].time;
  // console.log(updateTime);
  blockWithNote.block.time = updateTime;
  blockWithNote.block.string = blockText;
  return updateNote(blockWithNote);
};

const blockToAnkiSyntax = (block) => {
  const fieldsObj = {};
  fieldsObj[ANKI_FIELD_FOR_CLOZE_TEXT] = convertToCloze(block.string);
  fieldsObj[ANKI_FIELD_FOR_CLOZE_TAG] = noteMetadata(block);
  return {
    'deckName': ANKI_DECK_FOR_CLOZE_TAG,
    'modelName': ANKI_MODEL_FOR_CLOZE_TAG,
    'fields': fieldsObj,
  };
};

const noteMetadata = (block) => {
  return JSON.stringify({'block_uid': block.uid, 'block_time': block.time, 'schema_version': 1});
};

// String manipulation functions

const convertToCloze = (s) => {
  s = s.replace(/{\s*c(\d*):([^}]*)}/g, '{{c$1::$2}}');
  s = basicMarkdownToHtml(s);
  return s;
};

const convertToRoamBlock = (s) => {
  s = s.replace(/{{c(\d*)::([^}]*)}}/g, '{c$1:$2}');
  s = basicHtmlToMarkdown(s);
  return s;
};

const basicMarkdownToHtml = (s) => {
  s = s.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
  s = s.replace(/"__(.*?)__/g, '<i>$1</i>');
  return s;
};

const basicHtmlToMarkdown = (s) => {
  s = s.replace('<b>', '**');
  s = s.replace('</b>', '**');
  s = s.replace('<i>', '__');
  s = s.replace('</i>', '__');
  s = s.replace('&nbsp;', ' ');
  return s;
};
