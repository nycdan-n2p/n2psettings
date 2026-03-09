"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setTokens } from "@/lib/auth";
import { Loader } from "@/components/ui/Loader";

export default function LoginPage() {
  const [refreshToken, setRefreshToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Authentication failed");
        return;
      }
      setTokens(data);
      router.push("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa]">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-sm border border-[#dadce0]">
        <h1 className="text-2xl font-medium text-gray-900 mb-2">
          net2phone Settings
        </h1>
        <p className="text-sm text-gray-600 mb-6">
          Sign in with your refresh token to continue.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="token"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Refresh Token
            </label>
            <textarea
              id="token"
              value={refreshToken}
              onChange={(e) => setRefreshToken(e.target.value)}
              placeholder="Paste your OAuth2 refresh token"
              rows={4}
              className="w-full px-3 py-2 border border-[#dadce0] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1a73e8] focus:border-transparent"
              required
            />
          </div>
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader variant="button" />
                <span>Signing in...</span>
              </>
            ) : (
              "Sign in"
            )}
          </button>
        </form>
        <p className="mt-4 text-xs text-gray-500">
          Obtain a refresh token via the net2phone OAuth2 flow. This app uses it
          to fetch access tokens for API calls.
        </p>
      </div>
    </div>
  );
}
