"use client";

export default function AnalyticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Agent/Queue Activity Reports moved to Call Queues > [queue] > Reports tab
  return <>{children}</>;
}
