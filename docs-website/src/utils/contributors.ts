export interface Contributor {
  login: string;
  id: number;
  node_id: string;
  avatar_url: string;
  gravatar_id: string;
  url: string;
  html_url: string;
  followers_url: string;
  following_url: string;
  gists_url: string;
  starred_url: string;
  subscriptions_url: string;
  organizations_url: string;
  repos_url: string;
  events_url: string;
  received_events_url: string;
  type: string;
  site_admin: boolean;
  contributions: number;
}

export async function getPluginsContributors(): Promise<Contributor[]> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/Pinelab-studio/pinelab-vendure-plugins/contributors`
    );

    if (!response.ok) {
      throw new Error(`Error fetching contributors: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to fetch contributors:', error);
    return [];
  }
}
