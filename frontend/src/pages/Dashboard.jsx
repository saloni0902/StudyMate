import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getDashboard } from '../api/dashboard.js';
import { errorMessage } from '../api/client.js';
import ErrorBanner from '../components/ErrorBanner.jsx';
import Loader from '../components/Loader.jsx';
import SubjectCard from '../components/SubjectCard.jsx';
import SystemStatus from '../components/SystemStatus.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useSubjects } from '../context/SubjectContext.jsx';
import usePageTitle from '../hooks/usePageTitle.js';

function scoreClass(percent) {
  if (percent >= 80) return 'bg-brand text-white';
  if (percent >= 60) return 'bg-brand-soft text-ink';
  return 'bg-danger/15 text-[#9b2c2c]';
}

function NewSubjectForm() {
  const { createSubject } = useSubjects();
  const [form, setForm] = useState({ name: '', description: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await createSubject(form);
      setForm({ name: '', description: '' });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-lg border border-line bg-surface p-4">
      <h2 className="mb-3 font-medium">New subject</h2>
      <ErrorBanner message={error} />
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          required
          maxLength={80}
          placeholder="Name, e.g. Operating Systems"
          aria-label="Subject name"
          className="flex-1 rounded-md border border-line-strong px-3 py-2 text-sm"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          maxLength={300}
          placeholder="Description (optional)"
          aria-label="Description"
          className="flex-1 rounded-md border border-line-strong px-3 py-2 text-sm"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <button disabled={saving} className="rounded-md bg-cta px-4 py-2 text-sm font-medium text-ink hover:bg-cta-hover disabled:opacity-60">
          {saving ? 'Adding…' : 'Add subject'}
        </button>
      </div>
    </form>
  );
}

// First visit: what to do, in three steps.
function GettingStarted() {
  const steps = [
    ['Create a subject', 'e.g. "Operating Systems", using the form above.'],
    ['Upload your notes', 'PDFs with selectable text. StudyMate reads them page by page.'],
    ['Study with them', 'Ask questions, make summaries, quizzes and flashcards, all with page references.'],
  ];
  return (
    <ol className="grid gap-3 sm:grid-cols-3">
      {steps.map(([title, text], i) => (
        <li key={title} className="rounded-lg border border-line bg-surface p-4">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-cta text-sm font-bold text-ink">{i + 1}</span>
          <p className="mt-2 font-semibold text-ink">{title}</p>
          <p className="mt-1 text-sm text-muted">{text}</p>
        </li>
      ))}
    </ol>
  );
}

function RecentResults({ attempts }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <h2 className="font-semibold">Recent quiz results</h2>
      {attempts.length === 0 ? (
        <p className="mt-2 text-sm text-muted">No quizzes yet. Your latest scores will show here.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {attempts.map((a) => (
            <li key={a.id}>
              <Link
                to={`/subjects/${a.subjectId}/quiz/${a.quizId}/attempts/${a.id}`}
                className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 hover:bg-canvas"
              >
                <span className={`w-12 shrink-0 rounded-full py-0.5 text-center text-xs font-semibold ${scoreClass(a.percent)}`}>
                  {a.percent}%
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{a.quizTopic || 'All topics'}</span>
                  <span className="block text-xs text-muted">
                    {a.subjectName} · {a.score}/{a.total} · {new Date(a.createdAt).toLocaleDateString()}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PlanPreview({ plan }) {
  return (
    <section className="rounded-xl bg-brand p-5 text-white">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-semibold text-white">Your study plan</h2>
        <span className="text-xs text-brand-soft">{plan.subjectName}</span>
      </div>
      <ol className="mt-3 space-y-2">
        {plan.days.map((d) => (
          <li key={d.day} className="flex gap-3 text-sm">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cta text-xs font-bold text-ink">{d.day}</span>
            <span className="pt-0.5">{d.focus}</span>
          </li>
        ))}
      </ol>
      <Link
        to={`/subjects/${plan.subjectId}/progress`}
        className="mt-4 inline-block rounded-md bg-cta px-3 py-1.5 text-sm font-semibold text-ink hover:bg-cta-hover"
      >
        See the full plan
      </Link>
    </section>
  );
}

// Overview of every subject, recent quiz scores and the newest study plan.
export default function Dashboard() {
  const { user } = useAuth();
  const { subjects, loading } = useSubjects();
  usePageTitle('Dashboard');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  // Reload when subjects are added or removed.
  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch((err) => setError(errorMessage(err)));
  }, [subjects.length]);

  const statsFor = (id) => data?.subjects.find((s) => s.id === id);
  const firstVisit = !loading && subjects.length === 0;

  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-semibold">Hi {user.name.split(' ')[0]}</h1>
      <p className="mt-1 text-body">
        {firstVisit ? 'Welcome to StudyMate. Here is how to get started.' : 'Pick up where you left off.'}
      </p>
      <ErrorBanner message={error} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          <NewSubjectForm />
          {firstVisit && <GettingStarted />}

          {!firstVisit && (
            <section>
              <h2 className="mb-3 font-medium">Your subjects</h2>
              {loading ? (
                <Loader />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {subjects.map((subject) => (
                    <SubjectCard key={subject.id} subject={subject} stats={statsFor(subject.id)} />
                  ))}
                </div>
              )}
            </section>
          )}
        </div>

        {!firstVisit && (
          <aside className="min-w-0 space-y-6">
            {data?.studyPlan && <PlanPreview plan={data.studyPlan} />}
            {data ? <RecentResults attempts={data.recentAttempts} /> : <Loader />}
          </aside>
        )}
      </div>

      <div className="mt-10">
        <SystemStatus />
      </div>
    </div>
  );
}
