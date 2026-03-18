import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

/**
 * next-intl middleware — handles locale detection and prefix routing.
 *
 * Locale resolution order:
 * 1. URL prefix  (e.g. /es/ucass/... → Spanish)
 * 2. Cookie      (NEXT_LOCALE — set by the language picker)
 * 3. Accept-Language header (browser preference)
 * 4. Default locale ("en")
 *
 * API routes, static files, and Next.js internals are excluded
 * via the matcher below.
 */
export default createMiddleware(routing);

export const config = {
  matcher: [
    // Match all pathnames except:
    // - /api/* (API routes)
    // - /_next/* (Next.js internals)
    // - /favicon.ico, /fonts/*, /images/* (static assets)
    "/((?!api|_next|favicon\\.ico|fonts|images).*)",
  ],
};
