import { AugmentedBlock, Block, BlockWithParent } from './types';
export declare const pullBlocksWithTag: (tag: string) => Promise<Block[]>;
export declare const pullBlocksUnderTag: (groupTag: string, titleTag: string) => Promise<BlockWithParent[]>;
export declare const convertToCloze: (s: string) => string;
export declare const parseBasicFlashcard: (s: string) => {
    front: string;
    back: string;
} | null;
export declare const noteMetadata: (block: AugmentedBlock) => string;
