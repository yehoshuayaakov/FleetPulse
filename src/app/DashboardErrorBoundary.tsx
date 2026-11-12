import { Component, type ReactNode } from 'react';
import { Button } from 'react-aria-components';

export class DashboardErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <main className="grid min-h-screen place-items-center bg-canvas px-5 py-8 font-sans text-ink">
        <section aria-labelledby="dashboard-error-title" className="w-full max-w-md rounded-2xl border border-outline bg-surface p-6 shadow-sm">
          <h1 id="dashboard-error-title" className="text-xl font-semibold">FleetPulse could not load</h1>
          <p className="mt-2 text-sm text-muted">Reload the dashboard to start a new session.</p>
          <Button
            onPress={() => window.location.reload()}
            className="mt-4 cursor-pointer rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            Reload dashboard
          </Button>
        </section>
      </main>
    );
  }
}
