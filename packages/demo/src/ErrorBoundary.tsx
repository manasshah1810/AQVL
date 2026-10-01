import React, { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  errorMsg: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMsg: ''
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMsg: error.message };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div role="alert" className="page flex min-h-dvh flex-col justify-center gap-6 py-16">
          <h1 className="headline">Something broke while drawing this page.</h1>
          <p className="prose muted">
            The error below came from the site itself, not from your program. Reloading usually clears it; if it
            keeps happening, the message is what to report.
          </p>
          <pre className="panel max-w-[72ch] overflow-auto p-5 text-[0.875rem] whitespace-pre-wrap text-cream">{this.state.errorMsg}</pre>
          <div>
            <button type="button" className="btn" onClick={() => window.location.reload()}>
              Reload the page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
