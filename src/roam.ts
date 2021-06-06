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

export const pullBlocksUnderTag = async (
  tag: string
): Promise<BlockWithParent[]> => {
  // Returns array of [childBlock, parentBlockWithTag]
  // Looks for both direct and indirect children.
  const c = window.roamAlphaAPI.q(
    '[\
                        :find (pull ?childBlock [*]) (pull ?parentBlock [*]) \
                        :in $ ?pagetitle\
                        :where \
                            [?parentBlock :block/refs ?referencedPage]\
                            [?childBlock :block/parents ?parentBlock]\
                            [?referencedPage :node/title ?pagetitle]\
                        ]',
    tag
  );
  // augment child with info from parent
  return c.map((b: [Block, Block]): BlockWithParent => {
    const bb = <BlockWithParent>b[0];
    bb['parentBlock'] = b[1];
    return bb;
  });
};

export const convertToCloze = (s: string) => {
  s = s.replace(/{\s*c(\d*):([^}]*)}/g, '{{c$1::$2}}');
  s = basicMarkdownToHtml(s);
  return s;
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
  s = s.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
  s = s.replace(/"__(.*?)__/g, '<i>$1</i>');
  return s;
};

// Given an input or the current page, returns map of attributes.
const getAttrUnderBlock = (blockUid: string) => {
  return getAttrConfigFromQuery(
    `[:find (pull ?e [*]) :where [?e :block/uid "${blockUid}"] ]`
  );
};

// This function is handpicked from David Vargas' roam-client https://github.com/dvargas92495/roam-client
// It is used to grab configuration from a Roam page.
const getAttrFromQuery = (query: string) => {
  const pageResults = window.roamAlphaAPI.q(query);
  if (pageResults.length === 0 || !pageResults[0][0].attrs) {
    return {};
  }

  const configurationAttrRefs = pageResults[0][0].attrs.map(
    a => a[2].source[1]
  );
  const entries = configurationAttrRefs.map(
    r =>
      window.roamAlphaAPI
        .q(
          `[:find (pull ?e [:block/string]) :where [?e :block/uid "${r}"] ]`
        )[0][0]
        .string?.split('::')
        .map(toAttributeValue) || [r, 'undefined']
  );
  // eslint-disable-next-line node/no-unsupported-features/es-builtins
  return Object.fromEntries(entries);
};
