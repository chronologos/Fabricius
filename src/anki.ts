import {config} from './config';
import {AugmentedBlock, Block, BlockWithNote, NewNote} from './types';
import {convertToCloze, noteMetadata} from './roam';

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
export const batchFindNotes = async (blocksWithNids: [Block, number][]) => {
  const nids = blocksWithNids.map(b => b[1]);
  const ankiNote = await invokeAnkiConnect(
    config.ANKI_CONNECT_NOTESINFO,
    config.ANKI_CONNECT_VERSION,
    {notes: nids}
  );
  return ankiNote;
};

export const batchAddNotes = async (blocks: Block[]): Promise<any> => {
  const newNotes = blocks.map(b => blockToAnkiSyntax(b));
  return invokeAnkiConnect(
    config.ANKI_CONNECT_ADDNOTES,
    config.ANKI_CONNECT_VERSION,
    {notes: newNotes}
  );
};

export const updateNote = async (
  blockWithNote: BlockWithNote
): Promise<any> => {
  const newNote = blockToAnkiSyntax(blockWithNote.block);
  newNote.id = blockWithNote.note.noteId;
  delete newNote.deckName;
  delete newNote.modelName;
  return invokeAnkiConnect(
    config.ANKI_CONNECT_UPDATENOTES,
    config.ANKI_CONNECT_VERSION,
    {note: newNote}
  );
};

export const invokeAnkiConnect = (
  action: string,
  version: number,
  params = {}
): Promise<any> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.addEventListener('error', () =>
      reject(Error('failed to issue request'))
    );
    xhr.addEventListener('load', () => {
      try {
        const response = JSON.parse(xhr.responseText);
        if (Object.getOwnPropertyNames(response).length !== 2) {
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
    // console.log(JSON.stringify({ action, version, params }));
    xhr.send(JSON.stringify({action, version, params}));
  });
};

const blockToAnkiSyntax = (block: AugmentedBlock): NewNote => {
  const fieldsObj: any = {};
  // TODO: extract tags in a certain format. use namespaces.
  fieldsObj[config.ANKI_FIELD_FOR_CLOZE_TEXT] = convertToCloze(block.string);
  fieldsObj[config.ANKI_FIELD_FOR_CLOZE_TAG] = noteMetadata(block);
  // TODO This means parent is only updated if child is updated.
  if ('parentBlock' in block) {
    fieldsObj[config.ANKI_FIELD_FOR_GROUP_HEADER] = block.parentBlock.string
      .replace('#' + config.GROUPED_CLOZE_TAG, '')
      .replace('#' + '[[' + config.GROUPED_CLOZE_TAG + ']]', '')
      .replace('#' + config.TITLE_CLOZE_TAG, '')
      .replace('#' + '[[' + config.TITLE_CLOZE_TAG + ']]', '');
  }
  if ('titleBlock' in block) {
    fieldsObj[config.ANKI_FIELD_FOR_TITLE] = block.titleBlock.string
      .replace('#' + config.GROUPED_CLOZE_TAG, '')
      .replace('#' + '[[' + config.GROUPED_CLOZE_TAG + ']]', '')
      .replace('#' + config.TITLE_CLOZE_TAG, '')
      .replace('#' + '[[' + config.TITLE_CLOZE_TAG + ']]', '');
  }
  // If parent block is equal to the title block, populate just the title block.
  // This enables use-cases where both tags appear on the same block.
  if (
    'parentBlock' in block &&
    'titleBlock' in block &&
    block.parentBlock.string === block.titleBlock.string
  ) {
    console.log('redacting one field');
    fieldsObj[config.ANKI_FIELD_FOR_GROUP_HEADER] = '';
  }
  return {
    deckName: config.ANKI_DECK_FOR_CLOZE_TAG,
    modelName: config.ANKI_MODEL_FOR_CLOZE_TAG,
    fields: fieldsObj,
  };
};
