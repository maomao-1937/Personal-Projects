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
            <div className="w-20 h-20 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-8">
              <AlertTriangle size={36} className="text-red-400" />
            </div>
            <h1 className="text-2xl font-bold mb-3">出错了</h1>
            <p className="text-text-dim text-sm mb-2">页面渲染时发生了意外错误</p>
            {this.state.error && (
              <p className="text-text-muted text-xs mb-8 font-mono bg-bg-secondary/50 rounded-lg p-3 text-left overflow-x-auto">
                {this.state.error.message}
              </p>
            )}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={this.handleRetry}
                className="px-6 py-3 rounded-xl bg-accent hover:bg-accent-dark text-white font-medium transition-colors flex items-center gap-2"
              >
                <RefreshCw size={16} />
                重试
              </button>
              <Link
                href="/"
                className="px-6 py-3 rounded-xl glass hover:bg-bg-tertiary text-text-primary font-medium transition-colors flex items-center gap-2"
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
