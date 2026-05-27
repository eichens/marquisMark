import { Component, ReactNode, useEffect } from "react";
import { useErrorLog } from "../contexts/ErrorContext";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

interface FallbackProps {
  error: Error;
  onReset: () => void;
}

function BoundaryFallback({ error, onReset }: FallbackProps) {
  const { pushError } = useErrorLog();
  useEffect(() => {
    pushError({
      message: error.message,
      stack: error.stack,
      source: "ErrorBoundary",
    });
  }, [error, pushError]);
  return (
    <div className="error-boundary-fallback">
      <h3>This view crashed.</h3>
      <p>The error has been logged. You can try to recover, or open the error log for details.</p>
      <button onClick={onReset}>Try again</button>
    </div>
  );
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

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
      return <BoundaryFallback error={this.state.error} onReset={this.handleReset} />;
    }
    return this.props.children;
  }
}
