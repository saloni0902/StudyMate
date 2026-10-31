import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import * as progressApi from '../api/progress.js';
import { listTopics } from '../api/quizzes.js';
import { errorMessage } from '../api/client.js';
import ErrorBanner from '../components/ErrorBanner.jsx';
import Loader from '../components/Loader.jsx';
import ScoreChart from '../components/progress/ScoreChart.jsx';
import StudyPlanView from '../components/progress/StudyPlanView.jsx';
import { segment } from '../components/quiz/QuizSetup.jsx';
import usePageTitle from '../hooks/usePageTitle.js';

const WEAK_PERCENT = 60; // same rule as the backend

function Stat({ label, value, hint }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-ink">{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

function TopicRow({ t, subjectId }) {
  return (
    <li>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-2 font-medium text-ink">
          {t.topic}
          {t.weak && <span className="rounded-full bg-danger/15 px-2 py-0.5 text-xs font-semibold text-[#9b2c2c]">Weak</span>}
        </span>
        <span className="text-xs text-muted">
          {t.correct}/{t.total} correct · {t.percent}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-brand-tint">
        <div
          className={`h-2 rounded-full ${t.weak ? 'bg-danger' : 'bg-brand'}`}
          style={{ width: `${Math.max(t.percent, 2)}%` }}
        />
      </div>
      {t.weak && (
        <div className="mt-1.5 flex gap-3 text-xs">
          <Link to={`/subjects/${subjectId}/quiz`} state={{ topic: t.topic }} className="font-medium text-brand hover:underline">
            Practise with a quiz
          </Link>
          <Link to={`/subjects/${subjectId}/flashcards`} state={{ topic: t.topic }} className="font-medium text-brand hover:underline">
            Make flashcards
          </Link>
        </div>
      )}
    </li>
  );
}

// Scores over time, accuracy per topic, weak topics and the AI study plan.
export default function Progress() {
  const { subject } = useOutletContext();
  usePageTitle('Progress', subject.name);
  const [progress, setProgress] = useState(null);
  const [topicNames, setTopicNames] = useState([]);
  const [days, setDays] = useState(5);
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setProgress(null);
    Promise.all([progressApi.getProgress(subject.id), listTopics(subject.id)])
      .then(([p, names]) => {
        setProgress(p);
        setTopicNames(names);
      })
      .catch((err) => setError(errorMessage(err)));
  }, [subject.id]);

  const makePlan = async () => {
    setPlanning(true);
    setError('');
    try {
      const plan = await progressApi.createStudyPlan(subject.id, days);
      setProgress((p) => ({ ...p, studyPlan: plan }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPlanning(false);
    }
  };

  if (!progress) return error ? <ErrorBanner message={error} /> : <Loader />;

  const { flashcards } = progress;
  const noQuizzes = progress.quizzesTaken === 0;

  return (
    <div className="max-w-5xl">
      <p className="text-sm font-medium text-brand">{subject.name}</p>
      <h1 className="text-2xl font-semibold">Progress</h1>
      <p className="mt-1 text-body">How your quizzes are going, which topics need work, and a plan to fix them.</p>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Quizzes taken" value={progress.quizzesTaken} hint={`${progress.questionsAnswered} questions`} />
        <Stat label="Average score" value={noQuizzes ? '–' : `${progress.averagePercent}%`} />
        <Stat label="Weak topics" value={progress.weakTopics.length} hint={`under ${WEAK_PERCENT}%`} />
        <Stat
          label="Flashcards known"
          value={flashcards.total ? `${flashcards.known}/${flashcards.total}` : '–'}
          hint={`${flashcards.decks} deck${flashcards.decks === 1 ? '' : 's'}`}
        />
      </div>

      {noQuizzes ? (
        <div className="mt-6 rounded-lg border border-dashed border-line-strong p-8 text-center">
          <p className="font-medium text-ink">No quiz results yet</p>
          <p className="mt-1 text-sm text-muted">Take a quiz and your scores, weak topics and study plan will appear here.</p>
          <Link
            to={`/subjects/${subject.id}/quiz`}
            className="mt-4 inline-block rounded-md bg-cta px-4 py-2 text-sm font-semibold text-ink hover:bg-cta-hover"
          >
            Take a quiz
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <section className="rounded-xl border border-line bg-surface p-5">
              <h2 className="font-semibold">Quiz scores</h2>
              <p className="mb-3 text-xs text-muted">Each point is one quiz attempt, oldest first.</p>
              <ScoreChart attempts={progress.attempts} weakPercent={WEAK_PERCENT} />
            </section>

            <section className="rounded-xl border border-line bg-surface p-5">
              <h2 className="font-semibold">Accuracy by topic</h2>
              <p className="mb-3 text-xs text-muted">
                All your quiz answers, weakest first. A topic needs at least 2 answers before it can be marked weak.
              </p>
              <ul className="space-y-3">
                {progress.topics.map((t) => (
                  <TopicRow key={t.topic} t={t} subjectId={subject.id} />
                ))}
              </ul>
            </section>
          </div>

          <section className="mt-6 rounded-xl border border-line bg-surface p-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="font-semibold">Study plan</h2>
                <p className="text-xs text-muted">
                  {progress.weakTopics.length
                    ? 'A day-by-day plan for your weak topics, from your own notes.'
                    : 'No weak topics yet, so the plan covers your lowest-scoring topics.'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex gap-1 rounded-lg bg-brand-tint p-1" aria-label="Plan length">
                  {[3, 5, 7].map((n) => (
                    <button key={n} type="button" className={segment(days === n, { capitalize: false })} onClick={() => setDays(n)}>
                      {n} days
                    </button>
                  ))}
                </div>
                <button
                  onClick={makePlan}
                  disabled={planning}
                  className="rounded-md bg-cta px-4 py-2 text-sm font-semibold text-ink hover:bg-cta-hover disabled:opacity-60"
                >
                  {planning ? 'Planning…' : progress.studyPlan ? 'Make a new plan' : 'Make my plan'}
                </button>
              </div>
            </div>
            <div className="mt-4">
              {planning ? (
                <Loader label="Looking at your weak topics and your notes…" />
              ) : progress.studyPlan ? (
                <StudyPlanView plan={progress.studyPlan} subjectId={subject.id} topicNames={[...topicNames, ...progress.topics.map((t) => t.topic)]} />
              ) : (
                <p className="rounded-lg border border-dashed border-line-strong p-6 text-center text-sm text-muted">
                  No plan yet. Choose a length and make your plan.
                </p>
              )}
            </div>
          </section>
        </>
      )}

      <div className="mt-4">
        <ErrorBanner message={error} />
      </div>
    </div>
  );
}
