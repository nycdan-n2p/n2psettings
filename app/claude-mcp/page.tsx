import type { Metadata } from "next";
import { headers } from "next/headers";
import { publicBaseUrlFromHeaders } from "@/lib/mcp/public-base-url";

export const metadata: Metadata = {
  title: "Connect Claude — net2phone MCP",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ClaudeMcpConnectPage() {
  const h = await headers();
  const base = publicBaseUrlFromHeaders(h);
  const mcpUrl = `${base}/api/mcp`;
  const oauthAuthorize = `${base}/api/oauth/authorize`;

  const manualUrlExample = `${mcpUrl}?refreshToken=PASTE_REFRESH_TOKEN&accountId=PASTE_ACCOUNT_ID`;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900">
      <div className="mx-auto max-w-2xl px-5 py-12 sm:py-16">
        <p className="text-xs font-semibold uppercase tracking-widest text-sky-600">
          net2phone settings
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Connect Claude to your account
        </h1>
        <p className="mt-4 text-slate-600 leading-relaxed">
          The MCP endpoint for this deployment is below. Use the method that matches how you use
          Claude—web (easiest) or Desktop.
        </p>

        <section className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Your MCP URL</h2>
          <p className="mt-2 text-sm text-slate-600">
            Copy this base URL when a connector asks for the server address.
          </p>
          <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-950 px-4 py-3 text-sm text-slate-100">
            {mcpUrl}
          </pre>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Option A — Claude on the web (recommended)</h2>
          <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm text-slate-600 leading-relaxed">
            <li>
              Open <strong className="text-slate-800">Settings → Connectors</strong> (or Connections /
              Integrations).
            </li>
            <li>
              Add a <strong className="text-slate-800">custom MCP</strong> connector named{" "}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-800">net2phone</code>.
            </li>
            <li>
              <strong className="text-slate-800">Easiest:</strong> set the connector URL to{" "}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-800">{mcpUrl}</code> only.
              When Claude connects, complete the browser sign-in flow and paste your refresh token
              when prompted (from{" "}
              <code className="rounded bg-slate-100 px-1.5 py-0.5">app.net2phone.com</code> →
              DevTools → Application → Local Storage →{" "}
              <code className="rounded bg-slate-100 px-1.5 py-0.5">n2p_refresh_token</code>).
            </li>
            <li>
              <strong className="text-slate-800">Manual URL (one line, no spaces):</strong> if the UI
              requires a full URL with credentials, use your{" "}
              <strong className="text-slate-800">opaque</strong> refresh token and numeric account ID:{" "}
              <code className="block mt-2 overflow-x-auto rounded-lg bg-slate-950 px-3 py-2 text-xs text-slate-100">
                {manualUrlExample}
              </code>
              <span className="mt-2 block text-xs text-slate-500">
                Use <code className="text-slate-700">?token=eyJ…</code> only for a short-lived{" "}
                <strong>access</strong> JWT—not the hex refresh token.
              </span>
            </li>
          </ol>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Option B — Claude Desktop</h2>
          <p className="mt-3 text-sm text-slate-600 leading-relaxed">
            Many Desktop builds only load MCP via a local command. Point{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">npx mcp-remote</code> at the
            same URL (use <strong className="text-slate-800">Node.js 20+</strong> for{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">npx</code>). See the main{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">README.md</code> MCP section
            for a copy-paste <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
              claude_desktop_config.json
            </code>{" "}
            snippet.
          </p>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-amber-50/80 p-6">
          <h2 className="text-lg font-semibold text-amber-950">OAuth sign-in page</h2>
          <p className="mt-2 text-sm text-amber-950/80 leading-relaxed">
            If your client opens a browser to authorize, it may redirect here:
          </p>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-amber-950/90 px-4 py-3 text-sm text-amber-50">
            {oauthAuthorize}
          </pre>
        </section>
      </div>
    </div>
  );
}
