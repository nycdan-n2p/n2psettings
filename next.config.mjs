/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // Apply to all routes
        source: "/(.*)",
        headers: [
          // Prevent the app from being embedded in iframes on other origins (clickjacking)
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // Block MIME-type sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Enable HTTPS for 1 year; include subdomains
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          // Control referrer information sent to third parties
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Restrict browser features not needed by this app
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          // Content Security Policy
          // 'unsafe-inline' is required by Next.js for its inline <script> bootstrap and CSS-in-JS.
          // 'unsafe-eval' is NOT needed for Next.js 14 builds and has been removed.
          // Future hardening: wire a per-request nonce so 'unsafe-inline' can be dropped too.
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://*.net2phone.com",
              "font-src 'self' data: https://fonts.gstatic.com",
              "connect-src 'self' https://*.net2phone.com https://api.n2p.io https://api.anthropic.com https://date.nager.at",
              "frame-src 'none'",
              "frame-ancestors 'self'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },

  async redirects() {
    return [
      { source: "/ucass/analytics/agent-activity-report", destination: "/ucass/call-queues", permanent: true },
      { source: "/ucass/analytics/queue-activity-report", destination: "/ucass/call-queues", permanent: true },
      { source: "/ucass/settings/10dlc", destination: "/ucass/settings/trust-center", permanent: true },
      { source: "/ucass/settings/sso", destination: "/ucass/settings/trust-center", permanent: true },
      { source: "/ucass/settings/2fa", destination: "/ucass/settings/trust-center", permanent: true },
      { source: "/ucass/settings/security", destination: "/ucass/settings/trust-center", permanent: true },
    ];
  },
};

export default nextConfig;
