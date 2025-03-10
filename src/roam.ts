import {config} from './config';
import {AugmentedBlock, Block, BlockWithParent} from './types';

export const pullBlocksWithTag = async (tag: string): Promise<Block[]> => {
  const c = window.roamAlphaAPI.q(
    '[\
                        :find (pull ?referencingBlock [*]) \
                        :in $ ?pagetitle\
                        :where \
                            [?referencingBlock :block/refs ?referencedPage]\
                            [?referencedPage :node/title ?pagetitle]\
                        ]',
    tag
  );

  return c.map((b: [Block, any]) => b[0]);
};

// TODO: Very similar to above code.
export const pullBlocksUnderTag = async (
  groupTag: string,
  titleTag: string
): Promise<BlockWithParent[]> => {
  // Returns array of [childBlock, parentBlockWithTag]
  // Looks for both direct and indirect children.
  const c: [Block, BlockWithParent][] = await window.roamAlphaAPI.q(
    '[\
                        :find (pull ?childBlock [*]) (pull ?parentBlock [*]) \
                        :in $ ?pagetitle\
                        :where \
                            [?parentBlock :block/refs ?referencedPage]\
                            [?childBlock :block/parents ?parentBlock]\
                            [?referencedPage :node/title ?pagetitle]\
                        ]',
    groupTag
  );
  const c2: [Block, BlockWithParent, BlockWithParent][] =
    await window.roamAlphaAPI.q(
      '[\
                        :find (pull ?childBlock [*]) (pull ?parentBlock [*]) (pull ?parentBlock2 [*]) \
                        :in $ ?pagetitle ?pagetitle2\
                        :where \
                            [?parentBlock :block/refs ?referencedPage]\
                            [?parentBlock2 :block/refs ?referencedPage2]\
                            [?childBlock :block/parents ?parentBlock]\
                             [?childBlock :block/parents ?parentBlock2]\
                            [?referencedPage :node/title ?pagetitle]\
                            [?referencedPage2 :node/title ?pagetitle2]\
                        ]',
      groupTag,
      titleTag
    );
  // Augment child with info from its *closest* parent.
  const childBlocks: Map<string, BlockWithParent> = new Map();
  for (const index in c) {
    const block = <BlockWithParent>c[index][0];
    const parent = c[index][1];
    block['parentBlock'] = parent;
    if (childBlocks.has(block.uid)) {
      //console.log(`${block.uid} already has parent`);
      const existingParents = childBlocks
        .get(block.uid)!
        .parentBlock.parents.map(x => x.id);
      if (existingParents.includes(parent.id)) {
        /*
        console.log(
          `new parent ${parent.id} is higher up than the current parent ${existingParents} in map, discard it.`
        );
        */
        continue;
      }
      /*
      console.log(
        `new parent ${parent.id} is lower up than the current parent ${existingParents} in map, keep it.`
      );
      */
    }
    childBlocks.set(block.uid, block);
  }
  // Now populate for blocks which have a title.
  for (const index in c2) {
    const block = <BlockWithParent>c2[index][0];
    const parent = c2[index][1];
    const parent2 = c2[index][2];
    block['parentBlock'] = parent;
    block['titleBlock'] = parent2;
    if (childBlocks.has(block.uid)) {
      //console.log(`${block.uid} already has parent`);
      const existingParents = childBlocks
        .get(block.uid)!
        .parentBlock.parents.map(x => x.id);
      // For group tag, pick nearest parent
      if (existingParents.includes(parent.id)) {
        continue;
      }
    }
    childBlocks.set(block.uid, block);
  }
  return Array.from(childBlocks.values());
};

const ROAM_CLOZE_PATTERN = /{c(\d+):([^}:]*)}/g;
const ROAM_CLOZE_WITH_HINT_PATTERN = /{c(\d*):([^}:]*):hint:([^}]*)}/g;
const ROAM_BASIC_PATTERN = /\(Front\)([\s\S]*?)\(Back\)([\s\S]*)/;

export const convertToCloze = (s: string) => {
  if (s.match(ROAM_CLOZE_PATTERN)) {
    s = s.replace(ROAM_CLOZE_PATTERN, '{{c$1::$2}}');
  } else if (s.match(ROAM_CLOZE_WITH_HINT_PATTERN)) {
    s = s.replace(ROAM_CLOZE_WITH_HINT_PATTERN, '{{c$1::$2::$3}}');
  }
  s = basicMarkdownToHtml(s);
  return s;
};

export const parseBasicFlashcard = (s: string) => {
  // Remove the #srs/basic tag and its variations before parsing
  s = s.replace(/#srs\/basic/g, '');
  s = s.replace(/#\[\[srs\/basic\]\]/g, '');
  
  const match = s.match(ROAM_BASIC_PATTERN);
  if (match) {
    const front = match[1].trim();
    const back = match[2].trim();
    return {
      front: basicMarkdownToHtml(front),
      back: basicMarkdownToHtml(back),
    };
  }
  return null;
};

export const noteMetadata = (block: AugmentedBlock) => {
  return JSON.stringify({
    block_uid: block.uid,
    block_time: block.time,
    schema_version: config.METADATA_SCHEMA_VERSION,
    roam_page: block.page.id,
  });
};

const basicMarkdownToHtml = (s: string) => {
  // Convert image markdown to HTML img tags
  s = s.replace(/!\[\]\((https?:\/\/[^\s)]+)\)/g, '<img src="$1">');
  
  // Convert other markdown elements
  s = s.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
  s = s.replace(/__(.*?)__/g, '<i>$1</i>');
  s = s.replace(/\n/g, '<br>');

  return s;
};
