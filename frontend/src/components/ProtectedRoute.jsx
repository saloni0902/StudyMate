import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { SubjectProvider } from '../context/SubjectContext.jsx';
import Loader from './Loader.jsx';

// Only logged-in students get past here; others go to /login and come
// back to the page they asked for afterwards.
export default function ProtectedRoute() {
  const { user, loading, connectionError, checkSession } = useAuth();
  const location = useLocation();

  if (loading) return <Loader fullScreen />;
  // Logged in, but the server can't be reached right now: offer a retry
  // instead of sending the student back to the login page.
  if (!user && connectionError) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div role="alert" className="max-w-sm rounded-xl border border-line bg-surface p-6 text-center">
          <h1 className="text-lg font-semibold">Can't reach StudyMate</h1>
          <p className="mt-2 text-sm text-body">{connectionError}</p>
          <button
            onClick={checkSession}
            className="mt-5 rounded-md bg-cta px-4 py-2 text-sm font-semibold text-ink hover:bg-cta-hover"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  return (
    <SubjectProvider>
      <Outlet />
    </SubjectProvider>
  );
}
