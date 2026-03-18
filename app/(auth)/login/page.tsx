"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { setTokens } from "@/lib/auth";
import { Loader } from "@/components/ui/Loader";

type Mode = "password" | "token";

export default function LoginPage() {
  const t = useTranslations("login");
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
      router.push("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("authFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa]">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-sm border border-[#dadce0]">
        <div className="mb-6">
          <h1 className="text-2xl font-medium text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("subtitle")}</p>
        </div>

        <div className="flex border border-[#dadce0] rounded-lg p-0.5 mb-6 bg-gray-50">
          {(["password", "token"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(""); }}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
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
          {mode === "password" ? (
            <>
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
                  className="w-full px-3 py-2 border border-[#dadce0] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1a73e8] focus:border-transparent"
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
                  className="w-full px-3 py-2 border border-[#dadce0] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1a73e8] focus:border-transparent"
                />
              </div>
            </>
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
                rows={4}
                required
                className="w-full px-3 py-2 border border-[#dadce0] rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#1a73e8] focus:border-transparent"
              />
              <p className="text-xs text-gray-400 mt-1">{t("tokenHint")}</p>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2 transition-colors"
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
