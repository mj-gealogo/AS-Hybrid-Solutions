// Configuration for the admin's ONLINE (production) mode.
//
// SAFE TO COMMIT — there are no secrets in this file. The GitHub OAuth
// *Client ID* and *Client Secret* are NOT here; they live only in Cloudflare
// Pages as environment variables (see README → Deploying).
//
// You only need to edit `owner` and `repo` to match your GitHub repository.
export const ADMIN_CONFIG = {
  owner: 'mj-gealogo',           // GitHub username
  repo: 'AS-Hybrid-Solutions',   // the GitHub repository name
  branch: 'main',
};
