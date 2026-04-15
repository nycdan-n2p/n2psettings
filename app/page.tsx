// Server component — dynamic config is only effective here, not in "use client" modules.
// Without force-dynamic, Next.js statically pre-renders this route at build time.
// app/layout.tsx calls getLocale() → cookies() (via next-intl getRequestConfig),
// but Next.js static analysis doesn't detect that indirect cookies() call, so it
// tries to pre-render the page with no request context → cookies() throws → 404.
export const dynamic = "force-dynamic";

import HomePageClient from "./HomePageClient";

export default function HomePage() {
  return <HomePageClient />;
}
