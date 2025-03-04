import { Block, BlockWithNote } from './types';
export declare const batchFindNotes: (blocksWithNids: [Block, number][]) => Promise<Number | Number[] | null>;
export declare const batchAddNotes: (blocks: Block[], clozeTextField: string, clozeTagField: string, groupHeaderField: string, groupedClozeTag: string, titleField: string, titleClozeTag: string, deck: string, model: string, basicModel?: string, frontField?: string, backField?: string) => Promise<Number | null | Array<Number>>;
export declare const updateNote: (blockWithNote: BlockWithNote, clozeTextField: string, clozeTagField: string, groupHeaderField: string, groupedClozeTag: string, titleField: string, titleClozeTag: string, deck: string, model: string, basicModel?: string, frontField?: string, backField?: string) => Promise<Number | null | Array<Number>>;
export declare const invokeAnkiConnect: (action: string, version: number, params?: {}) => Promise<Number | null | Array<Number>>;
