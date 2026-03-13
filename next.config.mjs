/** @type {import('next').NextConfig} */
const nextConfig = {
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
