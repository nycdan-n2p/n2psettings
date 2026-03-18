"use client";

import { Component, type ReactNode, type ErrorInfo } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Optional custom fallback UI. Receives the error and a reset callback. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  /** If provided, shown as the panel title in the default fallback. */
  context?: string;
}

interface State {
  error: Error | null;
}

/**
 * ErrorBoundary — catches render-time errors in the subtree and shows a
 * graceful fallback instead of crashing the whole page.
 *
 * Usage:
 *   <ErrorBoundary context="Concierge">
 *     <ConciergeOverlay />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.context ? `:${this.props.context}` : ""}]`, error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    const { children, fallback, context } = this.props;

    if (!error) return children;

    if (fallback) return fallback(error, this.reset);

    return (
      <div
        role="alert"
        className="flex flex-col items-center justify-center gap-4 p-8 text-center rounded-2xl border border-red-200 bg-red-50"
      >
        <AlertCircle className="w-8 h-8 text-red-500" aria-hidden="true" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-red-700">
            {context ? `${context} encountered an error` : "Something went wrong"}
          </p>
          <p className="text-xs text-red-500 max-w-xs break-words">{error.message}</p>
        </div>
        <button
          onClick={this.reset}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-red-700 border border-red-300 rounded-lg hover:bg-red-100 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" /> Try again
        </button>
      </div>
    );
  }
}
