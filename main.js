/* Fabricius v0.2
 * Copyright (c) 2020 Ian Tay
 * This requires Anki and the AnkiConnect extension. Anki must be running.
 * You must configure ankiconnect to allow cross-origin requests from https://roamresearch.com.
 * Go to Anki -> Tools -> Addons -> Anki Connect -> Config and amend `webCorsOriginList` 
 * 
 * eslint-disable max-len
 * eslint-disable no-unused-vars
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

const NO_NID = -1;

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
    console.log(JSON.stringify({ action, version, params }));
    xhr.send(JSON.stringify({ action, version, params }));
  });
};

// String manipulation functions

const convertToCloze = (s) => {
  s = s.replace(/{\s*c(\d*):([^}]*)}/g, "{{c$1::$2}}");
  s = basicMarkdownToHtml(s);
  return s;
}

const convertToRoamBlock = (s) => {
  s = s.replace(/{{c(\d*)::([^}]*)}}/g, "{c$1:$2}");
  s = basicHtmlToMarkdown(s);
  return s;
}

const basicMarkdownToHtml = (s) => {
  s = s.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
  s = s.replace(/"__(.*?)__/g, "<i>$1</i>");
  return s;
}

const basicHtmlToMarkdown = (s) => {
  s = s.replace("<b>", "**");
  s = s.replace("</b>", "**");
  s = s.replace("<i>", "__");
  s = s.replace("</i>", "__");
  s = s.replace("&nbsp;", " ");
  return s;
}

const processSingleBlock = async (block) => {
  console.log('searching for block ' + block.uid);
  // TODO: should do a more exact structural match on the block uid here, but a collision *seems* unlikely.
  const nid = await invokeAnkiConnect(ANKI_CONNECT_FINDNOTES, ANKI_CONNECT_VERSION, { 'query': `${ANKI_FIELD_FOR_CLOZE_TAG}:re:${block.uid} AND note:${ANKI_MODEL_FOR_CLOZE_TAG}` });
  if (nid.length == 0) {
    // create card in Anki
    return [block, NO_NID]
  }
  // TODO(can be improved)
  // assume that only 1 note matches
  return [block, nid[0]];
}

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
  // update older using newer (but no timestamp in anki connect?)
  const nids = blocksWithNids.map(b => b[1]);
  console.log('query for nids ' + nids)
  const ankiNote = await invokeAnkiConnect(ANKI_CONNECT_NOTESINFO, ANKI_CONNECT_VERSION, { 'notes': nids });
  return ankiNote;
};

const batchAddNotes = async (blocksWithNoNids) => {
  const newNotes = blocksWithNoNids.map(b => blockToAnkiSyntax(b));
  return invokeAnkiConnect(ANKI_CONNECT_ADDNOTES, ANKI_CONNECT_VERSION, { 'notes': newNotes });
}

const blockToAnkiSyntax = (block) => {
  const fieldsObj = {};
  fieldsObj[ANKI_FIELD_FOR_CLOZE_TEXT] = convertToCloze(block.string);
  fieldsObj[ANKI_FIELD_FOR_CLOZE_TAG] = JSON.stringify({ "block_uid": block.uid, "block_time": block.time });
  return {
    "deckName": ANKI_DECK_FOR_CLOZE_TAG,
    "modelName": ANKI_MODEL_FOR_CLOZE_TAG,
    "fields": fieldsObj
  };
}

const syncNow = async () => {
  const c = window.roamAlphaAPI.q('[\
                        :find (pull ?referencingBlock [*]) \
                        :in $ ?pagetitle\
                        :where \
                            [?referencingBlock :block/refs ?referencedPage]\
                            [?referencedPage :node/title ?pagetitle]\
                        ]', CLOZE_TAG)

  // Get all blocks that reference srs/cloze
  // useful attributes in these blocks: uid, string, time (unix epoch)
  const blocks = c.map(b => b[0]);
  const blockNid = await Promise.all(blocks.map(b => processSingleBlock(b)));
  const blocksWithNids = blockNid.filter(([_, nid]) => nid != NO_NID);
  const blocksWithNoNids = blockNid.filter(([_, nid]) => nid == NO_NID).map(b => b[0]);
  console.log("blocks with no nids" + JSON.stringify(blocksWithNoNids));
  const existingNotes = await batchFindNotes(blocksWithNids);

  // for blocks that exist in both Anki and Roam, do a comparison.
  const blockWithNote = blocksWithNids.map(function (block, i) {
    const _existingNote = existingNotes[i];
    const noteMetadata = JSON.parse(_existingNote["fields"][ANKI_FIELD_FOR_CLOZE_TAG]["value"]);
    _existingNote.block_time = noteMetadata["block_time"];
    _existingNote.block_uid = noteMetadata["block_uid"];
    return { "nid": block[1], "block": block[0], "note": _existingNote };
  });

  // Toggle this on for debugging only
  console.log("blockWithNote array: " + JSON.stringify(blockWithNote, null, 2));

  const newerInRoam = blockWithNote.filter(x => x.block.time > x.note.block_time);
  const newerInAnki = blockWithNote.filter(x => x.block.time <= x.note.block_time && convertToCloze(x.block.string) != x.note["fields"][ANKI_FIELD_FOR_CLOZE_TEXT]["value"]);
  console.log(blockToAnkiSyntax(newerInAnki[0].block));
  console.log(newerInAnki[0].note["fields"][ANKI_FIELD_FOR_CLOZE_TEXT]["value"]);
  console.log("total synced blocks " + blocks.length)
  console.log("newer in roam " + newerInRoam.length)
  console.log("newer in anki " + newerInAnki.length)
  const results = await batchAddNotes(blocksWithNoNids);
  console.log(results); // should be an array of nulls if there are no errors
}

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
console.log("adding anki sync");
try {
  renderAnkiButton();
} catch (e) {
  window.requestAnimationFrame(renderAnkiButton);
}