import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };
  private rejectionHandler = (e: PromiseRejectionEvent) => {
    const reason = e.reason;
    const err = reason instanceof Error ? reason : new Error(String(reason));
    console.error("Unhandled rejection captured by ErrorBoundary:", err);
    this.setState({ error: err });
  };
  private errorHandler = (e: ErrorEvent) => {
    const err = e.error instanceof Error ? e.error : new Error(e.message);
    console.error("Window error captured by ErrorBoundary:", err);
    this.setState({ error: err });
  };

  componentDidMount() {
    window.addEventListener("unhandledrejection", this.rejectionHandler);
    window.addEventListener("error", this.errorHandler);
  }

  componentWillUnmount() {
    window.removeEventListener("unhandledrejection", this.rejectionHandler);
    window.removeEventListener("error", this.errorHandler);
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div className="error-boundary">
          <h2>Something went wrong</h2>
          <pre>{this.state.error.message}</pre>
          {this.state.error.stack && <pre className="error-stack">{this.state.error.stack}</pre>}
          <button onClick={this.handleReset}>Try again</button>
        </div>
      );
    }
    return this.props.children;
  }
}
