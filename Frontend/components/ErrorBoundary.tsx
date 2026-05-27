'use client';
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in Solospace App:', error, errorInfo);
  }

  private handleReset = () => {
    // Clear IndexedDB state and reload page to start fresh
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('solospace_encryption_key');
        // Clear IndexedDB
        indexedDB.deleteDatabase('keyval-store');
      } catch (e) {
        console.error(e);
      }
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-black text-[#f5f5f5] flex items-center justify-center p-6 select-none font-sans">
          <div className="max-w-md w-full bg-[#0d0d0d] border border-[#1f1f1f] rounded-2xl p-6 shadow-2xl text-center space-y-6">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6 animate-bounce" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Application Crash</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Solospace encountered an unexpected runtime error. Your local state has been preserved, but you may need to reset if the issue persists.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 bg-black rounded-lg border border-[#141414] text-[10px] text-rose-400 font-mono text-left max-h-32 overflow-y-auto leading-normal">
                {this.state.error.stack || this.state.error.message}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => window.location.reload()}
                className="py-2.5 border border-[#1f1f1f] text-xs font-semibold text-neutral-400 hover:text-white rounded-xl transition-colors font-mono cursor-pointer flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Reload Page
              </button>
              <button
                onClick={this.handleReset}
                className="py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition-all font-mono cursor-pointer"
              >
                Reset App State
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.children;
  }
}
