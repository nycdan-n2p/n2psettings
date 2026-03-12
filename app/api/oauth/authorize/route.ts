import { NextRequest, NextResponse } from "next/server";

/**
 * OAuth 2.0 Authorization Endpoint
 *
 * Claude (or any MCP client) redirects the user here to begin auth.
 * We show a simple page where the user pastes their net2phone refresh token.
 * On submit, we redirect back to the client's redirect_uri with an auth code
 * (which IS the refresh token — we don't need a separate code store).
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const redirectUri = url.searchParams.get("redirect_uri") ?? "";
  const state = url.searchParams.get("state") ?? "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Connect net2phone to Claude</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f5f5f5;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: white;
      border-radius: 12px;
      padding: 40px;
      max-width: 480px;
      width: 100%;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
    }
    .logo { font-size: 28px; font-weight: 700; color: #0066cc; margin-bottom: 8px; }
    .subtitle { color: #666; font-size: 14px; margin-bottom: 32px; }
    label { display: block; font-size: 13px; font-weight: 600; color: #333; margin-bottom: 8px; }
    .hint { font-size: 12px; color: #888; margin-bottom: 12px; line-height: 1.5; }
    textarea {
      width: 100%;
      padding: 12px;
      border: 1.5px solid #ddd;
      border-radius: 8px;
      font-size: 12px;
      font-family: monospace;
      resize: vertical;
      min-height: 80px;
      outline: none;
      transition: border-color 0.2s;
    }
    textarea:focus { border-color: #0066cc; }
    .error { color: #d32f2f; font-size: 13px; margin-top: 8px; display: none; }
    button {
      margin-top: 20px;
      width: 100%;
      padding: 14px;
      background: #0066cc;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    button:hover { background: #0052a3; }
    .steps {
      margin-top: 28px;
      padding-top: 24px;
      border-top: 1px solid #eee;
    }
    .steps p { font-size: 12px; color: #666; margin-bottom: 6px; line-height: 1.6; }
    .steps code {
      background: #f0f4f8;
      padding: 1px 5px;
      border-radius: 3px;
      font-size: 11px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">net2phone</div>
    <div class="subtitle">Connect your net2phone account to Claude</div>

    <label for="token">Refresh Token</label>
    <div class="hint">
      Open <strong>app.net2phone.com</strong> in your browser, then:<br>
      DevTools → Application → Local Storage → <code>n2p_refresh_token</code>
    </div>
    <textarea id="token" placeholder="Paste your refresh token here..." autocomplete="off" spellcheck="false"></textarea>
    <div class="error" id="error">Please paste your refresh token.</div>

    <button onclick="connect()">Connect to Claude</button>

    <div class="steps">
      <p><strong>Why do I need this?</strong></p>
      <p>Claude needs your net2phone refresh token to access your account on your behalf. The token is stored securely and used to fetch a fresh access token for each request.</p>
    </div>
  </div>

  <script>
    function connect() {
      const token = document.getElementById('token').value.trim();
      const errorEl = document.getElementById('error');
      if (!token) {
        errorEl.style.display = 'block';
        return;
      }
      errorEl.style.display = 'none';

      // The "code" is the refresh token itself — the token endpoint will return it as-is
      const code = btoa(token).replace(/=/g, '').replace(/\\+/g, '-').replace(/\\//g, '_');
      const redirectUri = ${JSON.stringify(redirectUri)};
      const state = ${JSON.stringify(state)};

      if (!redirectUri) {
        alert('Missing redirect_uri — cannot complete authorization.');
        return;
      }

      const callbackUrl = new URL(redirectUri);
      callbackUrl.searchParams.set('code', code);
      if (state) callbackUrl.searchParams.set('state', state);
      window.location.href = callbackUrl.toString();
    }
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
