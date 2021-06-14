/* Fabricius v1.1
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
(() => {
  var __defProp = Object.defineProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __async = (__this, __arguments, generator) => {
    return new Promise((resolve, reject) => {
      var fulfilled = (value) => {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      };
      var rejected = (value) => {
        try {
          step(generator.throw(value));
        } catch (e) {
          reject(e);
        }
      };
      var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
      step((generator = generator.apply(__this, __arguments)).next());
    });
  };

  // src/config.ts
  var config_exports = {};
  __export(config_exports, {
    ANKI_CONNECT_ADDNOTES: () => ANKI_CONNECT_ADDNOTES,
    ANKI_CONNECT_FINDNOTES: () => ANKI_CONNECT_FINDNOTES,
    ANKI_CONNECT_NOTESINFO: () => ANKI_CONNECT_NOTESINFO,
    ANKI_CONNECT_UPDATENOTES: () => ANKI_CONNECT_UPDATENOTES,
    ANKI_CONNECT_VERSION: () => ANKI_CONNECT_VERSION,
    ANKI_DECK_FOR_CLOZE_TAG: () => ANKI_DECK_FOR_CLOZE_TAG,
    ANKI_FIELD_FOR_CLOZE_TAG: () => ANKI_FIELD_FOR_CLOZE_TAG,
    ANKI_FIELD_FOR_CLOZE_TEXT: () => ANKI_FIELD_FOR_CLOZE_TEXT,
    ANKI_FIELD_FOR_GROUP_HEADER: () => ANKI_FIELD_FOR_GROUP_HEADER,
    ANKI_FIELD_FOR_TITLE: () => ANKI_FIELD_FOR_TITLE,
    ANKI_MODEL_FOR_CLOZE_TAG: () => ANKI_MODEL_FOR_CLOZE_TAG,
    CLOZE_TAG: () => CLOZE_TAG,
    GROUPED_CLOZE_TAG: () => GROUPED_CLOZE_TAG,
    METADATA_SCHEMA_VERSION: () => METADATA_SCHEMA_VERSION,
    NO_NID: () => NO_NID,
    TITLE_CLOZE_TAG: () => TITLE_CLOZE_TAG,
    config: () => config_exports
  });
  var CLOZE_TAG = "srs/cloze";
  var ANKI_DECK_FOR_CLOZE_TAG = "Max Infinity";
  var ANKI_MODEL_FOR_CLOZE_TAG = "ClozeRoam";
  var ANKI_FIELD_FOR_CLOZE_TEXT = "Text";
  var ANKI_FIELD_FOR_CLOZE_TAG = "Metadata";
  var GROUPED_CLOZE_TAG = "srs/cloze-g";
  var ANKI_FIELD_FOR_GROUP_HEADER = "Extra";
  var TITLE_CLOZE_TAG = "srs/cloze-t";
  var ANKI_FIELD_FOR_TITLE = "Title";
  var METADATA_SCHEMA_VERSION = 2;
  var ANKI_CONNECT_VERSION = 6;
  var ANKI_CONNECT_FINDNOTES = "findNotes";
  var ANKI_CONNECT_NOTESINFO = "notesInfo";
  var ANKI_CONNECT_ADDNOTES = "addNotes";
  var ANKI_CONNECT_UPDATENOTES = "updateNoteFields";
  var NO_NID = -1;

  // src/roam.ts
  var pullBlocksWithTag = (tag) => __async(void 0, null, function* () {
    const c = window.roamAlphaAPI.q("[                        :find (pull ?referencingBlock [*])                         :in $ ?pagetitle                        :where                             [?referencingBlock :block/refs ?referencedPage]                            [?referencedPage :node/title ?pagetitle]                        ]", tag);
    return c.map((b) => b[0]);
  });
  var pullBlocksUnderTag = (groupTag, titleTag) => __async(void 0, null, function* () {
    const c = yield window.roamAlphaAPI.q("[                        :find (pull ?childBlock [*]) (pull ?parentBlock [*])                         :in $ ?pagetitle                        :where                             [?parentBlock :block/refs ?referencedPage]                            [?childBlock :block/parents ?parentBlock]                            [?referencedPage :node/title ?pagetitle]                        ]", groupTag);
    const c2 = yield window.roamAlphaAPI.q("[                        :find (pull ?childBlock [*]) (pull ?parentBlock [*]) (pull ?parentBlock2 [*])                         :in $ ?pagetitle ?pagetitle2                        :where                             [?parentBlock :block/refs ?referencedPage]                            [?parentBlock2 :block/refs ?referencedPage2]                            [?childBlock :block/parents ?parentBlock]                             [?childBlock :block/parents ?parentBlock2]                            [?referencedPage :node/title ?pagetitle]                            [?referencedPage2 :node/title ?pagetitle2]                        ]", groupTag, titleTag);
    const childBlocks = new Map();
    for (const index in c) {
      const block = c[index][0];
      const parent = c[index][1];
      block["parentBlock"] = parent;
      if (childBlocks.has(block.uid)) {
        const existingParents = childBlocks.get(block.uid).parentBlock.parents.map((x) => x.id);
        if (existingParents.includes(parent.id)) {
          continue;
        }
      }
      childBlocks.set(block.uid, block);
    }
    for (const index in c2) {
      const block = c2[index][0];
      const parent = c2[index][1];
      const parent2 = c2[index][2];
      block["parentBlock"] = parent;
      block["titleBlock"] = parent2;
      if (childBlocks.has(block.uid)) {
        const existingParents = childBlocks.get(block.uid).parentBlock.parents.map((x) => x.id);
        if (existingParents.includes(parent.id)) {
          continue;
        }
      }
      childBlocks.set(block.uid, block);
    }
    return Array.from(childBlocks.values());
  });
  var convertToCloze = (s) => {
    s = s.replace(/{\s*c(\d*):([^}]*)}/g, "{{c$1::$2}}");
    s = basicMarkdownToHtml(s);
    return s;
  };
  var noteMetadata = (block) => {
    return JSON.stringify({
      block_uid: block.uid,
      block_time: block.time,
      schema_version: config_exports.METADATA_SCHEMA_VERSION,
      roam_page: block.page.id
    });
  };
  var basicMarkdownToHtml = (s) => {
    s = s.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
    s = s.replace(/"__(.*?)__/g, "<i>$1</i>");
    return s;
  };

  // src/anki.ts
  var batchFindNotes = (blocksWithNids) => __async(void 0, null, function* () {
    const nids = blocksWithNids.map((b) => b[1]);
    const ankiNote = yield invokeAnkiConnect(config_exports.ANKI_CONNECT_NOTESINFO, config_exports.ANKI_CONNECT_VERSION, { notes: nids });
    return ankiNote;
  });
  var batchAddNotes = (blocks) => __async(void 0, null, function* () {
    const newNotes = blocks.map((b) => blockToAnkiSyntax(b));
    return invokeAnkiConnect(config_exports.ANKI_CONNECT_ADDNOTES, config_exports.ANKI_CONNECT_VERSION, { notes: newNotes });
  });
  var updateNote = (blockWithNote) => __async(void 0, null, function* () {
    const newNote = blockToAnkiSyntax(blockWithNote.block);
    newNote.id = blockWithNote.note.noteId;
    delete newNote.deckName;
    delete newNote.modelName;
    return invokeAnkiConnect(config_exports.ANKI_CONNECT_UPDATENOTES, config_exports.ANKI_CONNECT_VERSION, { note: newNote });
  });
  var invokeAnkiConnect = (action, version, params = {}) => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.addEventListener("error", () => reject(Error("failed to issue request")));
      xhr.addEventListener("load", () => {
        try {
          const response = JSON.parse(xhr.responseText);
          if (Object.getOwnPropertyNames(response).length !== 2) {
            throw Error("response has an unexpected number of fields");
          }
          if (!Object.prototype.hasOwnProperty.call(response, "error")) {
            throw Error("response is missing required error field");
          }
          if (!Object.prototype.hasOwnProperty.call(response, "result")) {
            throw Error("response is missing required result field");
          }
          if (response.error) {
            throw response.error;
          }
          resolve(response.result);
        } catch (e) {
          reject(e);
        }
      });
      xhr.open("POST", "http://localhost:8765");
      xhr.send(JSON.stringify({ action, version, params }));
    });
  };
  var blockToAnkiSyntax = (block) => {
    const fieldsObj = {};
    fieldsObj[config_exports.ANKI_FIELD_FOR_CLOZE_TEXT] = convertToCloze(block.string);
    fieldsObj[config_exports.ANKI_FIELD_FOR_CLOZE_TAG] = noteMetadata(block);
    if ("parentBlock" in block) {
      fieldsObj[config_exports.ANKI_FIELD_FOR_GROUP_HEADER] = block.parentBlock.string.replace("#" + config_exports.GROUPED_CLOZE_TAG, "");
    }
    if ("titleBlock" in block) {
      fieldsObj[config_exports.ANKI_FIELD_FOR_TITLE] = block.titleBlock.string.replace("#" + config_exports.TITLE_CLOZE_TAG, "");
    }
    return {
      deckName: config_exports.ANKI_DECK_FOR_CLOZE_TAG,
      modelName: config_exports.ANKI_MODEL_FOR_CLOZE_TAG,
      fields: fieldsObj
    };
  };

  // src/main.ts
  var syncNow = () => __async(void 0, null, function* () {
    const singleBlocks = yield pullBlocksWithTag(config_exports.CLOZE_TAG);
    const groupBlocks = yield pullBlocksUnderTag(config_exports.GROUPED_CLOZE_TAG, config_exports.TITLE_CLOZE_TAG);
    const groupClozeBlocks = groupBlocks.filter(blockContainsCloze);
    const blocks = singleBlocks.concat(groupClozeBlocks);
    const blockWithNid = yield Promise.all(blocks.map((b) => processSingleBlock(b)));
    const blocksWithNids = blockWithNid.filter(([_, nid]) => nid !== config_exports.NO_NID);
    const blocksWithNoNids = blockWithNid.filter(([_, nid]) => nid === config_exports.NO_NID).map((b) => b[0]);
    const existingNotes = yield batchFindNotes(blocksWithNids);
    const blockWithNote = blocksWithNids.map((block, i) => {
      const _existingNote = existingNotes[i];
      const noteMetadata2 = JSON.parse(_existingNote["fields"][config_exports.ANKI_FIELD_FOR_CLOZE_TAG]["value"]);
      _existingNote.block_time = noteMetadata2["block_time"];
      _existingNote.block_uid = noteMetadata2["block_uid"];
      return { nid: block[1], block: block[0], note: _existingNote };
    });
    const newerInRoam = blockWithNote.filter((x) => x.block.time > x.note.block_time);
    const newerInAnki = blockWithNote.filter((x) => x.block.time <= x.note.block_time && convertToCloze(x.block.string) !== x.note["fields"][config_exports.ANKI_FIELD_FOR_CLOZE_TEXT]["value"]);
    console.log("[syncNow] total synced blocks " + blocks.length);
    console.log("[syncNow] newer in roam " + newerInRoam.length);
    console.log("[syncNow] newer in anki " + newerInAnki.length);
    const updateExistingInAnki = yield Promise.all(newerInRoam.map((x) => updateNote(x)));
    console.log(updateExistingInAnki);
    const updateExistingInRoam = yield Promise.all(newerInAnki.map((x) => updateBlock(x)));
    console.log(updateExistingInRoam);
    const results = yield batchAddNotes(blocksWithNoNids);
    console.log(results);
  });
  var renderFabriciusButton = () => {
    const syncAnkiButton = document.createElement("span");
    syncAnkiButton.id = "sync-anki-button-span";
    syncAnkiButton.classList.add("bp3-popover-wrapper");
    syncAnkiButton.setAttribute("style", "margin-left: 4px;");
    const outerSpan = document.createElement("span");
    outerSpan.classList.add("bp3-popover-target");
    syncAnkiButton.appendChild(outerSpan);
    const icon = document.createElement("span");
    icon.id = "sync-anki-icon";
    icon.setAttribute("status", "off");
    icon.classList.add("bp3-icon-intersection", "bp3-button", "bp3-minimal", "bp3-small");
    outerSpan.appendChild(icon);
    function renderInTopbar() {
      if (!document.getElementsByClassName("rm-topbar")) {
        window.requestAnimationFrame(renderInTopbar);
      } else {
        document.getElementsByClassName("rm-topbar")[0].appendChild(syncAnkiButton);
      }
    }
    renderInTopbar();
    icon.onclick = syncNow;
  };
  if (document.getElementById("sync-anki-button-span") !== null) {
    document.getElementById("sync-anki-button-span").remove();
  }
  console.log("adding anki sync!");
  try {
    renderFabriciusButton();
  } catch (e) {
    window.requestAnimationFrame(renderFabriciusButton);
  }
  var updateBlock = (blockWithNote) => __async(void 0, null, function* () {
    const noteText = blockWithNote.note.fields[config_exports.ANKI_FIELD_FOR_CLOZE_TEXT]["value"];
    const blockText = convertToRoamBlock(noteText);
    const updateRes = window.roamAlphaAPI.updateBlock({
      block: {
        uid: blockWithNote.block.uid,
        string: blockText
      }
    });
    if (!updateRes) {
      console.log("[updateBlock] failed to update");
      return;
    }
    yield new Promise((r) => setTimeout(r, 200));
    const updateTime = window.roamAlphaAPI.q(`[ :find (pull ?e [ :edit/time ]) :where [?e :block/uid "${blockWithNote.block.uid}"]]`)[0][0].time;
    blockWithNote.block.time = updateTime;
    blockWithNote.block.string = blockText;
    return updateNote(blockWithNote);
  });
  var processSingleBlock = (block) => __async(void 0, null, function* () {
    console.log("searching for block " + block.uid);
    const nid = yield invokeAnkiConnect(config_exports.ANKI_CONNECT_FINDNOTES, config_exports.ANKI_CONNECT_VERSION, {
      query: `${config_exports.ANKI_FIELD_FOR_CLOZE_TAG}:re:${block.uid} AND note:${config_exports.ANKI_MODEL_FOR_CLOZE_TAG}`
    });
    if (nid.length === 0) {
      return [block, config_exports.NO_NID];
    }
    return [block, nid[0]];
  });
  var blockContainsCloze = (block) => {
    const found = block.string.match(/c(\d*):([^}]*)}/g);
    return found !== null && found.length !== 0;
  };
  var convertToRoamBlock = (s) => {
    s = s.replace(/{{c(\d*)::([^}]*)}}/g, "{c$1:$2}");
    s = basicHtmlToMarkdown(s);
    return s;
  };
  var basicHtmlToMarkdown = (s) => {
    s = s.replace("<b>", "**");
    s = s.replace("</b>", "**");
    s = s.replace("<i>", "__");
    s = s.replace("</i>", "__");
    s = s.replace("&nbsp;", " ");
    return s;
  };
})();
//# sourceMappingURL=browser.js.map
