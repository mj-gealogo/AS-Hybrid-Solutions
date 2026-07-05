// Cloudflare Pages Function — completes the GitHub OAuth login.
//
// GitHub redirects here with ?code=... . We exchange that code for an access
// token using the client SECRET (which never leaves the server), then hand the
// token back to the admin window via postMessage and close the popup.
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  const cookie = request.headers.get('Cookie') || '';
  const savedState = /(?:^|;\s*)oauth_state=([^;]+)/.exec(cookie)?.[1];

  if (!code) return page(null, 'Missing authorization code');
  if (!savedState || savedState !== state) return page(null, 'State mismatch (CSRF check failed)');

  let token = null, error = null;
  try {
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: env.GITHUB_OAUTH_CLIENT_ID,
        client_secret: env.GITHUB_OAUTH_CLIENT_SECRET,
        code,
        redirect_uri: `${url.origin}/api/callback`,
      }),
    });
    const data = await res.json();
    token = data.access_token || null;
    if (!token) error = data.error_description || 'Token exchange failed';
  } catch (e) {
    error = String(e);
  }
  return page(token, error);
}

// Renders a tiny page that posts the result back to the admin window (same origin)
// and closes itself.
function page(token, error) {
  const payload = JSON.stringify({ source: 'as-admin-oauth', token, error });
  const body = `<!doctype html><meta charset="utf-8">
<body style="font:15px/1.5 system-ui;padding:28px;color:#374754">
<script>
  (function () {
    var msg = ${payload};
    if (window.opener) {
      window.opener.postMessage(msg, window.location.origin);
      window.close();
    }
    document.body.textContent = msg.token
      ? 'Signed in. You can close this window.'
      : ('Sign-in failed: ' + (msg.error || 'unknown error'));
  })();
</script></body>`;
  return new Response(body, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // clear the CSRF cookie
      'Set-Cookie': 'oauth_state=; Path=/; Max-Age=0',
    },
  });
}
