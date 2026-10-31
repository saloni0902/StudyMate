import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import * as quizzesApi from '../api/quizzes.js';
import { listDocuments } from '../api/documents.js';
import { errorMessage } from '../api/client.js';
import ErrorBanner from '../components/ErrorBanner.jsx';
import Loader from '../components/Loader.jsx';
import QuizSetup from '../components/quiz/QuizSetup.jsx';
import usePageTitle from '../hooks/usePageTitle.js';

function scoreClass(percent) {
  if (percent === null || percent === undefined) return 'bg-brand-tint text-muted';
  if (percent >= 80) return 'bg-brand text-white';
  if (percent >= 60) return 'bg-brand-soft text-ink';
  return 'bg-danger/15 text-[#9b2c2c]';
}

// Quiz home: create a quiz, and see past quizzes with their scores.
export default function Quiz() {
  const { subject } = useOutletContext();
  usePageTitle('Quiz', subject.name);
  const navigate = useNavigate();
  const location = useLocation();

  const [topics, setTopics] = useState(null);
  const [quizzes, setQuizzes] = useState([]);
  const [hasDocs, setHasDocs] = useState(true);
  const [busy, setBusy] = useState(false);
  const [findingTopics, setFindingTopics] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    const [topicList, quizList, docs] = await Promise.all([
      quizzesApi.listTopics(subject.id),
      quizzesApi.listQuizzes(subject.id),
      listDocuments(subject.id),
    ]);
    setTopics(topicList);
    setQuizzes(quizList);
    setHasDocs(docs.some((d) => d.status === 'ready'));
    return docs;
  }, [subject.id]);

  useEffect(() => {
    refresh().catch((err) => setError(errorMessage(err)));
  }, [refresh]);

  const generate = async (settings) => {
    setBusy(true);
    setError('');
    try {
      const quiz = await quizzesApi.createQuiz(subject.id, settings);
      navigate(`/subjects/${subject.id}/quiz/${quiz.id}`, { state: { quiz } });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  // For documents uploaded before topic detection existed.
  const findTopics = async () => {
    setFindingTopics(true);
    setError('');
    try {
      const docs = await listDocuments(subject.id);
      for (const doc of docs.filter((d) => d.status === 'ready' && d.topics.length === 0)) {
        await quizzesApi.refreshTopics(doc.id);
      }
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setFindingTopics(false);
    }
  };

  const remove = async (quiz) => {
    if (!window.confirm('Delete this quiz and its scores?')) return;
    try {
      await quizzesApi.deleteQuiz(quiz.id);
      setQuizzes((list) => list.filter((q) => q.id !== quiz.id));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="max-w-5xl">
      <p className="text-sm font-medium text-brand">{subject.name}</p>
      <h1 className="text-2xl font-semibold">Quiz</h1>
      <p className="mt-1 text-body">Multiple-choice questions written from your notes, with answers explained.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-3">
          {topics === null ? (
            <Loader />
          ) : !hasDocs ? (
            <p className="rounded-lg border border-dashed border-line-strong p-4 text-sm text-muted">
              No ready documents yet.{' '}
              <Link to={`/subjects/${subject.id}/documents`} className="text-brand underline">
                Upload a PDF
              </Link>{' '}
              to make quizzes.
            </p>
          ) : (
            <QuizSetup
              topics={topics}
              initialTopic={location.state?.topic || ''}
              busy={busy}
              onSubmit={generate}
              onFindTopics={findTopics}
              findingTopics={findingTopics}
            />
          )}
          <ErrorBanner message={error} />
        </div>

        <section>
          <h2 className="mb-3 font-medium">Your quizzes</h2>
          {busy && (
            <div className="mb-3 rounded-lg border border-line bg-surface">
              <Loader label="Reading your notes and writing questions…" />
            </div>
          )}
          {quizzes.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line-strong p-6 text-center text-sm text-muted">
              No quizzes yet. Generate one to test yourself.
            </p>
          ) : (
            <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
              {quizzes.map((q) => (
                <li key={q.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">{q.topic || 'All topics'}</p>
                    <p className="text-xs text-muted">
                      <span className="capitalize">{q.difficulty}</span> · {q.questionCount} questions · {new Date(q.createdAt).toLocaleDateString()}
                      {q.attempts > 0 && ` · taken ${q.attempts}×`}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${scoreClass(q.best)}`}>
                    {q.best === null ? 'Not taken' : `Best ${q.best}%`}
                  </span>
                  <div className="flex gap-3 text-sm">
                    {q.latest && (
                      <Link to={`/subjects/${subject.id}/quiz/${q.id}/attempts/${q.latest.id}`} className="text-brand hover:underline">
                        Review
                      </Link>
                    )}
                    <Link to={`/subjects/${subject.id}/quiz/${q.id}`} className="text-brand hover:underline">
                      {q.attempts ? 'Retake' : 'Start'}
                    </Link>
                    <button onClick={() => remove(q)} className="text-muted hover:text-danger">
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
