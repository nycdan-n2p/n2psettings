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
          // Content Security Policy — allows same-origin + Anthropic + net2phone APIs.
          // 'unsafe-inline' is kept for Next.js inline styles; tighten further once a nonce is wired in.
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.net2phone.com https://api.n2p.io https://api.anthropic.com https://date.nager.at",
              "frame-ancestors 'self'",
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
