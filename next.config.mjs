/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      { source: "/ucass/analytics/agent-activity-report", destination: "/ucass/call-queues", permanent: true },
      { source: "/ucass/analytics/queue-activity-report", destination: "/ucass/call-queues", permanent: true },
    ];
  },
};

export default nextConfig;
