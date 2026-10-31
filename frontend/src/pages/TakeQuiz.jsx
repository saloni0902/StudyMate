import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import * as quizzesApi from '../api/quizzes.js';
import { errorMessage } from '../api/client.js';
import ErrorBanner from '../components/ErrorBanner.jsx';
import Loader from '../components/Loader.jsx';
import usePageTitle from '../hooks/usePageTitle.js';

const LETTERS = ['A', 'B', 'C', 'D'];

// Take a quiz one question at a time; answers are scored by the backend.
export default function TakeQuiz() {
  const { subject } = useOutletContext();
  usePageTitle('Taking a quiz', subject.name);
  const { quizId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Use the quiz passed from the setup page when we have it, else load it.
  const [quiz, setQuiz] = useState(location.state?.quiz?.id === quizId ? location.state.quiz : null);
  // -1 = not answered yet
  const [answers, setAnswers] = useState(() => (quiz ? Array(quiz.questions.length).fill(-1) : []));
  const [current, setCurrent] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (quiz) return;
    quizzesApi
      .getQuiz(quizId)
      .then((data) => setQuiz(data.quiz))
      .catch((err) => setError(errorMessage(err)));
  }, [quiz, quizId]);

  useEffect(() => {
    if (quiz && answers.length !== quiz.questions.length) setAnswers(Array(quiz.questions.length).fill(-1));
  }, [quiz, answers.length]);

  if (!quiz || answers.length !== quiz.questions.length) return error ? <ErrorBanner message={error} /> : <Loader />;

  const total = quiz.questions.length;
  const q = quiz.questions[current];
  const answered = answers.filter((a) => a !== -1).length;
  const last = current === total - 1;

  const choose = (index) => setAnswers((list) => list.map((a, i) => (i === current ? index : a)));

  const submit = async () => {
    const skipped = total - answered;
    if (skipped && !window.confirm(`You haven't answered ${skipped} question${skipped > 1 ? 's' : ''}. Submit anyway?`)) {
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const result = await quizzesApi.submitQuiz(quiz.id, answers);
      navigate(`/subjects/${subject.id}/quiz/${quiz.id}/attempts/${result.attempt.id}`, { state: { result } });
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Link to={`/subjects/${subject.id}/quiz`} className="text-sm text-brand hover:underline">
        ← All quizzes
      </Link>
      <div className="mt-2 flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold">{quiz.topic || 'All topics'}</h1>
        <p className="text-sm text-muted capitalize">{quiz.difficulty}</p>
      </div>

      <div className="mt-4">
        <div className="mb-1 flex justify-between text-xs text-muted">
          <span>
            Question {current + 1} of {total}
          </span>
          <span>{answered} answered</span>
        </div>
        <div className="h-2 rounded-full bg-surface">
          <div className="h-2 rounded-full bg-brand transition-all" style={{ width: `${((current + 1) / total) * 100}%` }} />
        </div>
      </div>

      <section className="mt-6 rounded-xl border border-line bg-surface p-6">
        <span className="rounded-full bg-brand-tint px-2.5 py-0.5 text-xs font-medium text-brand-dark">{q.topic}</span>
        <h2 className="mt-3 text-lg leading-snug font-semibold">{q.question}</h2>

        <div className="mt-5 space-y-2" role="radiogroup" aria-label="Answer options">
          {q.options.map((option, i) => {
            const selected = answers[current] === i;
            return (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={`${LETTERS[i]}. ${option}`}
                onClick={() => choose(i)}
                className={`flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                  selected ? 'border-brand bg-brand-tint text-ink' : 'border-line bg-surface hover:border-brand-soft hover:bg-canvas'
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    selected ? 'bg-brand text-white' : 'bg-brand-tint text-brand-dark'
                  }`}
                >
                  {LETTERS[i]}
                </span>
                <span className="pt-0.5">{option}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Jump to any question; answered ones are filled in */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {quiz.questions.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setCurrent(i)}
            aria-label={`Go to question ${i + 1}`}
            className={`h-8 w-8 rounded-md text-xs font-medium ${
              i === current
                ? 'bg-ink text-white'
                : answers[i] !== -1
                  ? 'bg-brand-soft text-ink'
                  : 'border border-line-strong bg-surface text-muted'
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCurrent((c) => c - 1)}
          disabled={current === 0}
          className="rounded-md border border-line-strong bg-surface px-4 py-2 text-sm font-medium disabled:opacity-40"
        >
          Previous
        </button>
        {last ? (
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="rounded-md bg-cta px-5 py-2 text-sm font-semibold text-ink hover:bg-cta-hover disabled:opacity-60"
          >
            {submitting ? 'Marking…' : 'Submit quiz'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setCurrent((c) => c + 1)}
            className="rounded-md bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-dark"
          >
            Next
          </button>
        )}
      </div>
      <div className="mt-3">
        <ErrorBanner message={error} />
      </div>
    </div>
  );
}
