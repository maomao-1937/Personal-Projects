'use client';

import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center px-6">
          <div className="max-w-md w-full text-center">
            <div className="mx-auto mb-7 flex h-14 w-14 items-center justify-center rounded-full border border-signal text-signal">
              <AlertTriangle size={28} />
            </div>
            <h1 className="text-2xl font-bold mb-3">出错了</h1>
            <p className="text-text-dim text-sm mb-2">页面渲染时发生了意外错误</p>
            {this.state.error && (
              <p className="mb-8 overflow-x-auto border-y border-line bg-paper p-3 text-left font-mono text-xs text-muted">
                {this.state.error.message}
              </p>
            )}
            <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row">
              <button
                onClick={this.handleRetry}
                className="flex min-h-11 items-center justify-center gap-2 rounded-md bg-ink px-6 py-3 text-sm font-medium text-paper transition-colors hover:bg-accent-light"
              >
                <RefreshCw size={16} />
                重试
              </button>
              <Link
                href="/"
                className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-ink px-6 py-3 text-sm font-medium text-ink transition-colors hover:bg-paper"
              >
                <Home size={16} />
                返回首页
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
