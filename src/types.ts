export interface Block {
  string: string;
  time: any;
  id: string;
  uid: string;
  parents: {id: string}[];
  page: {id: string};
}

export interface BlockWithParent extends Block {
  parentBlock: Block;
}

export type AugmentedBlock = Block | BlockWithParent;

export interface BlockWithNote {
  nid: number;
  block: AugmentedBlock;
  note: Note;
}

export interface Note {
  noteId: string;
  fields: any;
  block_time: string;
  block_uid: string;
}

export interface NewNote {
  id?: string;
  deckName?: string;
  modelName?: string;
  fields?: any;
}

declare global {
  interface Window {
    roamAlphaAPI: any;
  }
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface getAttrConfigFromQuery {}
}
