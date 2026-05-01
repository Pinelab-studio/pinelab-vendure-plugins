import type { APIRoute, GetStaticPaths } from 'astro';
import { getAllPluginRawDocs } from '../../../utils/plugins';

/**
 * Static endpoint that returns the raw CHANGELOG markdown for a single plugin.
 * Used by `llms.txt` to provide LLMs with clean, source-level changelog data.
 */
export const getStaticPaths: GetStaticPaths = async () => {
  const docs = await getAllPluginRawDocs();
  return Object.entries(docs).map(([slug, { changelog }]) => ({
    params: { pluginName: slug },
    props: { changelog },
  }));
};

export const GET: APIRoute = async ({ props }) => {
  return new Response(props.changelog as string, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
    },
  });
};
