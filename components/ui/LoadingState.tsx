"use client";

import { Loader } from "./Loader";

interface LoadingStateProps {
  isLoading: boolean;
  children: React.ReactNode;
  label?: string;
  className?: string;
}

export function LoadingState({
  isLoading,
  children,
  label = "Loading...",
  className = "",
}: LoadingStateProps) {
  if (isLoading) {
    return (
      <div className={`py-12 flex justify-center ${className}`}>
        <Loader variant="inline" label={label} />
      </div>
    );
  }
  return <>{children}</>;
}
