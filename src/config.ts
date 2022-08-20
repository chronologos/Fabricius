export * as config from './config';

// A block tagged with CLOZE_TAG is synced.
export const CLOZE_TAG_KEY = 'CLOZE_TAG_KEY';
export const CLOZE_TAG = 'srs/cloze';

// The Anki deck to be synced to
export const ANKI_DECK_NAME_KEY = 'ANKI_DECK_NAME_KEY';
export const ANKI_DECK_NAME = 'Max Infinity';
// The Anki model (note type) that will be synced
export const ANKI_MODEL_NAME_KEY = 'ANKI_MODEL_NAME_KEY';
export const ANKI_MODEL_NAME = 'ClozeRoam';
// The note field that will contain the clozed text
export const ANKI_FIELD_FOR_CLOZE_TEXT_KEY = 'ANKI_FIELD_FOR_CLOZE_TEXT_KEY';
export const ANKI_FIELD_FOR_CLOZE_TEXT = 'Text';
// The note field that will store the UID (used by the code to associate the Anki note with the Roam block)
export const ANKI_FIELD_FOR_METADATA_KEY = 'ANKI_FIELD_FOR_METADATA_KEY';
export const ANKI_FIELD_FOR_METADATA = 'Metadata';

// Advanced
// A block tagged with GROUPED_CLOZE_TAG is not synced, but its children, if they have clozes, are.
export const GROUPED_CLOZE_TAG_KEY = 'GROUPED_CLOZE_TAG';
export const GROUPED_CLOZE_TAG = 'srs/cloze-g';

// The block tagged with GROUPED_CLOZE_TAG will be synced to this field.
export const ANKI_FIELD_FOR_GROUP_HEADER_KEY =
  'ANKI_FIELD_FOR_GROUP_HEADER_KEY';
export const ANKI_FIELD_FOR_GROUP_HEADER = 'Extra';

export const TITLE_CLOZE_TAG_KEY = 'TITLE_CLOZE_TAG_KEY';
export const TITLE_CLOZE_TAG = 'srs/cloze-t';
export const ANKI_FIELD_FOR_TITLE_KEY = 'ANKI_FIELD_FOR_TITLE_KEY';
export const ANKI_FIELD_FOR_TITLE = 'Title';

// --- internals below this ---
export const METADATA_SCHEMA_VERSION = 2;
export const ANKI_CONNECT_VERSION = 6;
export const ANKI_CONNECT_FINDNOTES = 'findNotes';
export const ANKI_CONNECT_NOTESINFO = 'notesInfo';
export const ANKI_CONNECT_ADDNOTES = 'addNotes';
export const ANKI_CONNECT_UPDATENOTES = 'updateNoteFields';

export const NO_NID = -1;
