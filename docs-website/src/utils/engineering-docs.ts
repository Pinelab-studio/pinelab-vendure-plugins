export const repository =
  'https://github.com/Pinelab-studio/pinelab-engineering';
export const rawRepository =
  'https://raw.githubusercontent.com/Pinelab-studio/pinelab-engineering';

/** Fetch public documentation with bounded waits and explicit build failures. */
async function fetchDocs(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) {
    throw new Error(
      `Unable to fetch engineering documentation: ${url} (${response.status})`
    );
  }
  return response;
}

/** Resolve main once, then fetch every document from that immutable snapshot. */
export async function getEngineeringDocs() {
  const tree = (await (
    await fetchDocs(
      'https://api.github.com/repos/Pinelab-studio/pinelab-engineering/git/trees/main?recursive=1'
    )
  ).json()) as {
    sha: string;
    truncated: boolean;
    tree: Array<{ path: string; type: string }>;
  };
  if (tree.truncated)
    throw new Error('Engineering documentation tree is truncated.');
  const files = tree.tree
    .filter(
      ({ path, type }) =>
        type === 'blob' && /^docs\/(best-practices|recipes)\/.+\.md$/.test(path)
    )
    .sort((a, b) => a.path.localeCompare(b.path));
  for (const directory of ['best-practices', 'recipes']) {
    if (!files.some(({ path }) => path.startsWith(`docs/${directory}/`))) {
      throw new Error(`No engineering documents found in docs/${directory}/.`);
    }
  }
  const sources = await Promise.all(
    files.map(async ({ path }) => ({
      path,
      markdown: await (
        await fetchDocs(`${rawRepository}/${tree.sha}/${path}`)
      ).text(),
    }))
  );
  return { sha: tree.sha, sources };
}

/** Strip document metadata, retaining the original Markdown instructions. */
export function stripFrontmatter(markdown: string) {
  return markdown
    .replace(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '')
    .trim();
}

/** Escape source titles for use as Markdown link labels. */
export function markdownLabel(title: string) {
  return title.replace(/[\\\[\]]/g, '\\$&').replace(/\s+/g, ' ');
}
