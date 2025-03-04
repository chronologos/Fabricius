import {config} from './config';
import {AugmentedBlock, Block, BlockWithNote, NewNote} from './types';
import {convertToCloze, noteMetadata, parseBasicFlashcard} from './roam';

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

export const batchAddNotes = async (
  blocks: Block[],
  clozeTextField: string,
  clozeTagField: string,
  groupHeaderField: string,
  groupedClozeTag: string,
  titleField: string,
  titleClozeTag: string,
  deck: string,
  model: string,
  basicModel: string = config.ANKI_BASIC_MODEL_NAME,
  frontField: string = config.ANKI_FIELD_FOR_FRONT,
  backField: string = config.ANKI_FIELD_FOR_BACK
): Promise<Number | null | Array<Number>> => {
  const newNotes = blocks.map(b => {
    // Check if this is a basic flashcard
    if (b.string.includes(config.BASIC_TAG)) {
      return blockToBasicAnkiSyntax(
        b,
        clozeTagField,
        deck,
        basicModel,
        frontField,
        backField
      );
    } else {
      return blockToAnkiSyntax(
        b,
        clozeTextField,
        clozeTagField,
        groupHeaderField,
        groupedClozeTag,
        titleField,
        titleClozeTag,
        deck,
        model
      );
    }
  });
  return invokeAnkiConnect(
    config.ANKI_CONNECT_ADDNOTES,
    config.ANKI_CONNECT_VERSION,
    {notes: newNotes}
  );
};

export const updateNote = async (
  blockWithNote: BlockWithNote,
  clozeTextField: string,
  clozeTagField: string,
  groupHeaderField: string,
  groupedClozeTag: string,
  titleField: string,
  titleClozeTag: string,
  deck: string,
  model: string,
  basicModel: string = config.ANKI_BASIC_MODEL_NAME,
  frontField: string = config.ANKI_FIELD_FOR_FRONT,
  backField: string = config.ANKI_FIELD_FOR_BACK
): Promise<Number | null | Array<Number>> => {
  let newNote;
  // Check if this is a basic flashcard
  if (blockWithNote.block.string.includes(config.BASIC_TAG)) {
    newNote = blockToBasicAnkiSyntax(
      blockWithNote.block,
      clozeTagField,
      deck,
      basicModel,
      frontField,
      backField
    );
  } else {
    newNote = blockToAnkiSyntax(
      blockWithNote.block,
      clozeTextField,
      clozeTagField,
      groupHeaderField,
      groupedClozeTag,
      titleField,
      titleClozeTag,
      deck,
      model
    );
  }
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
): Promise<Number | null | Array<Number>> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.addEventListener('error', () =>
      reject(Error('failed to issue request'))
    );
    xhr.addEventListener('load', () => {
      try {
        const response: {
          result: Number | null | Array<Number>;
          error: string | null;
        } = JSON.parse(xhr.responseText);
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

const blockToAnkiSyntax = (
  block: AugmentedBlock,
  clozeTextField: string,
  clozeTagField: string,
  groupHeaderField: string,
  groupedClozeTag: string,
  titleField: string,
  titleClozeTag: string,
  deck: string,
  model: string
): NewNote => {
  const fieldsObj: any = {};
  // TODO: extract tags in a certain format. use namespaces.
  fieldsObj[clozeTextField] = convertToCloze(block.string);
  fieldsObj[clozeTagField] = noteMetadata(block);
  // TODO This means parent is only updated if child is updated.
  if ('parentBlock' in block) {
    fieldsObj[groupHeaderField] = block.parentBlock.string
      .replace('#' + groupedClozeTag, '')
      .replace('#' + '[[' + groupedClozeTag + ']]', '')
      .replace('#' + titleClozeTag, '')
      .replace('#' + '[[' + titleClozeTag + ']]', '');
  }
  if ('titleBlock' in block) {
    fieldsObj[titleField] = block.titleBlock.string
      .replace('#' + groupedClozeTag, '')
      .replace('#' + '[[' + groupedClozeTag + ']]', '')
      .replace('#' + titleClozeTag, '')
      .replace('#' + '[[' + titleClozeTag + ']]', '');
  }
  // If parent block is equal to the title block, populate just the title block.
  // This enables use-cases where both tags appear on the same block.
  if (
    'parentBlock' in block &&
    'titleBlock' in block &&
    block.parentBlock.string === block.titleBlock.string
  ) {
    console.log('redacting one field');
    fieldsObj[groupHeaderField] = '';
  }
  return {
    deckName: deck,
    modelName: model,
    fields: fieldsObj,
  };
};

const blockToBasicAnkiSyntax = (
  block: AugmentedBlock,
  metadataField: string,
  deck: string,
  model: string,
  frontField: string,
  backField: string
): NewNote => {
  const fieldsObj: any = {};
  // Parse the basic flashcard content
  const basicCard = parseBasicFlashcard(block.string);
  if (basicCard) {
    fieldsObj[frontField] = basicCard.front;
    fieldsObj[backField] = basicCard.back;
  } else {
    // Fallback if parsing fails
    fieldsObj[frontField] = 'Error: Could not parse basic flashcard';
    fieldsObj[backField] = 'Please format as (Front) question (Back) answer';
  }
  // Add metadata
  fieldsObj[metadataField] = noteMetadata(block);
  return {
    deckName: deck,
    modelName: model,
    fields: fieldsObj,
  };
};
