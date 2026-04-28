'use client';

import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { logClientEvent } from '@/lib/logging/client-logger';

interface Props {
  readonly children: ReactNode;
  readonly fallback?: ReactNode;
}

interface State {
  readonly hasError: boolean;
}

const DEFAULT_FALLBACK = (
  <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
    <p className="text-base font-medium">Something went wrong rendering this page.</p>
    <p className="text-sm text-zinc-500 dark:text-zinc-400">
      The error has been logged. Try reloading the page.
    </p>
  </div>
);

export default class RootErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    logClientEvent({
      level: 'error',
      message: error.message,
      stack: error.stack,
      context: { componentStack: info.componentStack ?? undefined },
    });
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback ?? DEFAULT_FALLBACK;
    }
    return this.props.children;
  }
}
