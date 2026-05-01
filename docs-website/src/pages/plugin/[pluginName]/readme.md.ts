import type { APIRoute, GetStaticPaths } from 'astro';
import { getAllPluginRawDocs } from '../../../utils/plugins';

/**
 * Static endpoint that returns the raw README markdown for a single plugin.
 * Used by `llms.txt` to provide LLMs with clean, source-level documentation.
 */
export const getStaticPaths: GetStaticPaths = async () => {
  const docs = await getAllPluginRawDocs();
  return Object.entries(docs).map(([slug, { readme }]) => ({
    params: { pluginName: slug },
    props: { readme },
  }));
};

export const GET: APIRoute = async ({ props }) => {
  return new Response(props.readme as string, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
    },
  });
};
