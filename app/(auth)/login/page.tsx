"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { setTokens } from "@/lib/auth";
import { Loader } from "@/components/ui/Loader";

type Mode = "password" | "token";

function LoginPageInner() {
  const t = useTranslations("login");
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("returnUrl");
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      let res: Response;

      if (mode === "password") {
        res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: email, password }),
        });
      } else {
        res = await fetch("/api/auth/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
      }

      const data = await res.json();

      if (!res.ok) {
        if (
          mode === "password" &&
          typeof data.error === "string" &&
          data.error.includes("not supported")
        ) {
          setMode("token");
          setError(t("invalidGrant"));
        } else {
          setError(data.error ?? t("authFailed"));
        }
        return;
      }

      setTokens(data);
      const safeReturn =
        returnUrl && returnUrl.startsWith("/") && !returnUrl.startsWith("//")
          ? returnUrl
          : "/";
      router.push(safeReturn);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("authFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa]">
      <div
        className="login-popup-card w-full max-w-md p-8 shadow-sm"
        style={{ backgroundColor: "#ffffff", borderRadius: "24px" }}
      >
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <img
              src="/net2phone-icon.png"
              alt="net2phone logo"
              className="h-8 w-8 rounded-[8px]"
            />
            <h1 className="text-2xl font-medium text-gray-900">{t("title")}</h1>
          </div>
        </div>

        <div className="flex rounded-[16px] p-1 mb-6 bg-gray-100">
          {(["password", "token"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(""); }}
              className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                mode === m
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {m === "password" ? t("modePassword") : t("modeToken")}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="min-h-[220px]">
            {mode === "password" ? (
              <div className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    {t("emailLabel")}
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("emailPlaceholder")}
                    autoComplete="email"
                    required
                    className="w-full px-4 py-3 bg-[#f3f4f6] rounded-[16px] text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                    {t("passwordLabel")}
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                    className="w-full px-4 py-3 bg-[#f3f4f6] rounded-[16px] text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label htmlFor="token" className="block text-sm font-medium text-gray-700 mb-1">
                  {t("tokenLabel")}
                </label>
                <textarea
                  id="token"
                  value={refreshToken}
                  onChange={(e) => setRefreshToken(e.target.value)}
                  placeholder={t("tokenPlaceholder")}
                  rows={5}
                  required
                  className="w-full px-4 py-3 bg-[#f3f4f6] rounded-[16px] text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-black"
                />
                <p className="text-xs text-gray-400 mt-1">{t("tokenHint")}</p>
              </div>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-[16px] px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-black text-white rounded-[16px] hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? (
              <>
                <Loader variant="button" />
                <span>{t("signingIn")}</span>
              </>
            ) : (
              t("signInButton")
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa]">
        <Loader variant="full" label="Loading…" />
      </div>
    }>
      <LoginPageInner />
    </Suspense>
  );
}
