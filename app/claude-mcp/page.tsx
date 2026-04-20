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
  const connectorUrl = `${mcpUrl}?refreshToken=PASTE_YOUR_REFRESH_TOKEN&accountId=YOUR_ACCOUNT_ID`;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900">
      <div className="mx-auto max-w-xl px-5 py-12 sm:py-16">
        <p className="text-xs font-semibold uppercase tracking-widest text-sky-600">
          net2phone settings
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Claude + MCP</h1>
        <p className="mt-4 text-slate-600 leading-relaxed">
          The MCP server on this site uses the <strong>same refresh token</strong> as the web app.
          You already have it after you sign in at{" "}
          <span className="whitespace-nowrap">app.net2phone.com</span>.
        </p>

        <section className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold">1. Copy your refresh token</h2>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">
            In the browser where you use net2phone:{" "}
            <strong className="text-slate-800">DevTools → Application → Local Storage</strong> → key{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">n2p_refresh_token</code>.
            Same value you use to sign in here on the settings site.
          </p>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold">2. Add the connector in Claude</h2>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">
            In Claude: <strong className="text-slate-800">Settings → Connectors</strong> → add a
            custom MCP. Paste <strong className="text-slate-800">one line</strong> (no space after{" "}
            <code className="text-xs">=</code>), with your real token and account ID:
          </p>
          <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-950 px-4 py-3 text-xs text-slate-100 leading-relaxed">
            {connectorUrl}
          </pre>
          <p className="mt-3 text-xs text-slate-500">
            Replace <code className="text-slate-700">YOUR_ACCOUNT_ID</code> with your UCaaS account
            number (same as in the app URL or admin).
          </p>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-sm text-slate-600 leading-relaxed">
            <strong className="text-slate-800">MCP endpoint only:</strong>{" "}
            <code className="rounded bg-white px-1.5 py-0.5 text-xs text-slate-800">{mcpUrl}</code>
            <span className="block mt-2">
              Some clients open a browser to sign in—use the same refresh token on that page if
              asked.
            </span>
          </p>
        </section>
      </div>
    </div>
  );
}
