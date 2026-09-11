import { Component, type ErrorInfo, type ReactNode } from "react";

type State = { error: Error | null };

export class AppErrorBoundary extends Component<
  { children: ReactNode },
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, information: ErrorInfo) {
    console.error(
      "Application render failed",
      error,
      information.componentStack,
    );
  }

  render() {
    if (this.state.error) {
      return (
        <main className="fatal-error" role="alert">
          <p className="eyebrow">Application error</p>
          <h1>The site could not finish loading.</h1>
          <p>
            {import.meta.env.DEV
              ? this.state.error.message
              : "Please reload the page and try again."}
          </p>
          <button type="button" onClick={() => window.location.reload()}>
            Reload the page
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}
