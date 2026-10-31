import { Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import ErrorBoundary from './ErrorBoundary.jsx';
import Loader from './Loader.jsx';
import Sidebar from './Sidebar.jsx';
import { useSubjects } from '../context/SubjectContext.jsx';

// Sidebar + page. On phones a top bar with a menu button replaces the
// always-visible sidebar.
export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { selected } = useSubjects();
  const { pathname } = useLocation();

  // Close the menu after moving to another page.
  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <div className="min-h-screen md:flex">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 bg-brand px-4 md:hidden">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          aria-expanded={menuOpen}
          aria-controls="app-sidebar"
          className="flex h-9 w-9 flex-col items-center justify-center gap-1 rounded-md hover:bg-brand-dark"
        >
          <span className="h-0.5 w-5 rounded bg-white" />
          <span className="h-0.5 w-5 rounded bg-white" />
          <span className="h-0.5 w-5 rounded bg-white" />
        </button>
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-cta text-xs font-bold text-ink">S</span>
        <span className="font-bold text-white">StudyMate</span>
        {selected && <span className="ml-auto truncate text-xs text-brand-soft">{selected.name}</span>}
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-30 bg-ink/50 md:hidden" onClick={() => setMenuOpen(false)} aria-hidden="true" />
      )}
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />

      <main className="min-w-0 flex-1 p-4 md:p-8">
        <ErrorBoundary key={pathname}>
          <Suspense fallback={<Loader />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  );
}
