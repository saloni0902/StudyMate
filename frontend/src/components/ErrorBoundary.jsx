import { Component } from 'react';

// If a page crashes while rendering, show a friendly message instead of a
// blank screen. Layout gives it a key per page, so moving to another page
// resets it.
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Page crashed:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    // A page's code failed to download (e.g. the dev server restarted).
    const loadFailed = /dynamically imported module|Loading chunk|Failed to fetch/i.test(this.state.error.message);
    return (
      <div role="alert" className="mx-auto mt-10 max-w-md rounded-xl border border-line bg-surface p-6 text-center">
        <h1 className="text-lg font-semibold">{loadFailed ? "This page couldn't load" : 'Something went wrong on this page'}</h1>
        <p className="mt-2 text-sm text-body">
          {loadFailed
            ? 'Check your connection and reload.'
            : 'Reloading usually fixes it. Your notes and results are safe.'}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-5 rounded-md bg-cta px-4 py-2 text-sm font-semibold text-ink hover:bg-cta-hover"
        >
          Reload page
        </button>
      </div>
    );
  }
}
