import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useSubjects } from '../context/SubjectContext.jsx';

const subjectPages = [
  { page: 'documents', label: 'Documents' },
  { page: 'chat', label: 'Chat' },
  { page: 'summary', label: 'Summaries' },
  { page: 'quiz', label: 'Quiz' },
  { page: 'flashcards', label: 'Flashcards' },
  { page: 'progress', label: 'Progress' },
];

// Dark teal sidebar: soft-teal links, the current page in amber.
const linkClass = ({ isActive }) =>
  `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-cta text-ink' : 'text-brand-soft hover:bg-brand-dark hover:text-white'
  }`;

// On phones the sidebar slides in from the left (open/onClose come from Layout);
// from md upwards it is always visible.
export default function Sidebar({ open = false, onClose = () => {} }) {
  const { user, logout } = useAuth();
  const { subjects, selected, setSelectedId } = useSubjects();
  const navigate = useNavigate();
  const location = useLocation();

  // Switching subject keeps you on the same page (e.g. Chat) for the new subject.
  const changeSubject = (id) => {
    setSelectedId(id);
    const match = location.pathname.match(/^\/subjects\/[^/]+\/([^/]+)/);
    if (match) navigate(`/subjects/${id}/${match[1]}`);
  };

  return (
    <aside
      id="app-sidebar"
      className={`fixed inset-y-0 left-0 z-40 flex h-dvh w-64 shrink-0 flex-col overflow-y-auto bg-brand p-4 transition-transform duration-200 md:sticky md:top-0 md:h-screen md:w-60 md:translate-x-0 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="mb-6 flex items-center gap-2 px-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cta text-sm font-bold text-ink">S</span>
        <span className="text-xl font-bold text-white">StudyMate</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          className="ml-auto rounded-md px-2 py-1 text-2xl leading-none text-brand-soft hover:text-white md:hidden"
        >
          ×
        </button>
      </div>

      <nav className="flex flex-col gap-1">
        <NavLink to="/dashboard" className={linkClass}>
          Dashboard
        </NavLink>
      </nav>

      <div className="mt-6 px-2">
        <label htmlFor="subject-select" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-brand-soft">
          Subject
        </label>
        {subjects.length > 0 ? (
          <select
            id="subject-select"
            className="w-full rounded-md border border-brand-soft/40 bg-brand-dark px-2 py-1.5 text-sm text-white focus:border-cta focus:outline-none"
            value={selected?.id || ''}
            onChange={(e) => changeSubject(e.target.value)}
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-sm text-brand-soft">Create a subject on the dashboard to get started.</p>
        )}
      </div>

      {selected && (
        <nav className="mt-3 flex flex-col gap-1">
          {subjectPages.map(({ page, label }) => (
            <NavLink key={page} to={`/subjects/${selected.id}/${page}`} className={linkClass}>
              {label}
            </NavLink>
          ))}
        </nav>
      )}

      <div className="mt-auto border-t border-brand-soft/25 px-2 pt-4">
        <p className="truncate text-sm font-medium text-white">{user.name}</p>
        <p className="truncate text-xs text-brand-soft">{user.email}</p>
        <button onClick={logout} className="mt-3 text-sm text-brand-soft hover:text-cta">
          Log out
        </button>
      </div>
    </aside>
  );
}
