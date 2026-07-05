// Cloudflare Pages Function — starts the GitHub OAuth login.
//
// The admin page opens this URL in a popup. It redirects to GitHub's consent
// screen, which (after the owner approves) sends them to /api/callback.
//
// Requires these environment variables in Cloudflare Pages (Settings → Env vars):
//   GITHUB_OAUTH_CLIENT_ID     — from your GitHub OAuth App
//   GITHUB_OAUTH_CLIENT_SECRET — used in /api/callback, kept server-side only
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const redirectUri = `${url.origin}/api/callback`;
  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    client_id: env.GITHUB_OAUTH_CLIENT_ID,
    redirect_uri: redirectUri,
    // "public_repo" is enough to commit to a PUBLIC repo and is the safer scope.
    // If your repository is PRIVATE, change this to "repo".
    scope: 'public_repo',
    state,
    allow_signup: 'false',
  });

  const headers = new Headers({
    Location: `https://github.com/login/oauth/authorize?${params.toString()}`,
    // CSRF protection: remember the state in a short-lived cookie, verified in the callback.
    'Set-Cookie': `oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
  });
  return new Response(null, { status: 302, headers });
}
