import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { getAttempt } from '../api/quizzes.js';
import { errorMessage } from '../api/client.js';
import ErrorBanner from '../components/ErrorBanner.jsx';
import Loader from '../components/Loader.jsx';
import usePageTitle from '../hooks/usePageTitle.js';

const LETTERS = ['A', 'B', 'C', 'D'];
const WEAK = 60; // below this percentage a topic counts as weak

function verdict(percent) {
  if (percent >= 80) return 'Great work. You know this material well.';
  if (percent >= 60) return 'Good effort. Review the questions you missed below.';
  return 'Keep going. Revisit the weak topics below, then try again.';
}

function TopicBar({ topic, correct, total }) {
  const percent = Math.round((correct / total) * 100);
  const weak = percent < WEAK;
  return (
    <li>
      <div className="mb-1 flex justify-between text-sm">
        <span className="font-medium text-ink">{topic}</span>
        <span className={weak ? 'font-semibold text-[#9b2c2c]' : 'text-muted'}>
          {correct}/{total} · {percent}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-brand-tint">
        <div className={`h-2 rounded-full ${weak ? 'bg-danger' : 'bg-brand'}`} style={{ width: `${Math.max(percent, 3)}%` }} />
      </div>
    </li>
  );
}

function QuestionReview({ q, number }) {
  return (
    <li className={`rounded-lg border bg-surface p-4 ${q.correct ? 'border-line' : 'border-danger/50'}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium text-ink">
          {number}. {q.question}
        </p>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
            q.correct ? 'bg-brand-tint text-brand-dark' : 'bg-danger/15 text-[#9b2c2c]'
          }`}
        >
          {q.correct ? 'Correct' : q.chosenIndex === -1 ? 'Skipped' : 'Wrong'}
        </span>
      </div>
      <ul className="mt-3 space-y-1 text-sm">
        {q.options.map((option, i) => {
          const isAnswer = i === q.answerIndex;
          const isWrongChoice = i === q.chosenIndex && !isAnswer;
          return (
            <li
              key={i}
              className={`flex gap-2 rounded-md px-2 py-1 ${
                isAnswer ? 'bg-brand-tint font-medium text-ink' : isWrongChoice ? 'bg-danger/10 text-[#9b2c2c] line-through' : 'text-body'
              }`}
            >
              <span className="w-4 shrink-0 font-semibold">{LETTERS[i]}</span>
              <span>
                {option}
                {isAnswer && ' ✓'}
                {i === q.chosenIndex && ' (your answer)'}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-sm text-body">
        <span className="font-semibold text-ink">Why: </span>
        {q.explanation}
      </p>
      {q.source && (
        <p className="mt-2 inline-block rounded-full border border-line-strong px-2.5 py-0.5 text-xs text-muted">
          {q.source.fileName} · p. {q.source.page}
        </p>
      )}
    </li>
  );
}

// Score, topic breakdown and a review of every question after submitting.
export default function QuizResult() {
  const { subject } = useOutletContext();
  usePageTitle('Quiz results', subject.name);
  const { quizId, attemptId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [result, setResult] = useState(
    location.state?.result?.attempt?.id === attemptId ? location.state.result : null
  );
  const [error, setError] = useState('');

  useEffect(() => {
    if (result) return;
    getAttempt(attemptId)
      .then(setResult)
      .catch((err) => setError(errorMessage(err)));
  }, [result, attemptId]);

  if (!result) return error ? <ErrorBanner message={error} /> : <Loader />;

  const { attempt, quiz, questions } = result;
  const weakest = attempt.topicBreakdown.find((t) => (t.correct / t.total) * 100 < WEAK);

  return (
    <div className="mx-auto max-w-3xl">
      <Link to={`/subjects/${subject.id}/quiz`} className="text-sm text-brand hover:underline">
        ← All quizzes
      </Link>

      <section className="mt-3 flex flex-wrap items-center gap-6 rounded-xl bg-brand p-6 text-white">
        <div className="flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-full bg-cta text-ink">
          <span className="text-3xl font-bold">{attempt.percent}%</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-brand-soft">
            {quiz.topic || 'All topics'} · <span className="capitalize">{quiz.difficulty}</span>
          </p>
          <h1 className="text-2xl font-semibold text-white">
            {attempt.score} out of {attempt.total} correct
          </h1>
          <p className="mt-1 text-brand-soft">{verdict(attempt.percent)}</p>
        </div>
        <div className="flex flex-col gap-2">
          <Link
            to={`/subjects/${subject.id}/quiz/${quizId}`}
            className="rounded-md bg-cta px-4 py-2 text-center text-sm font-semibold text-ink hover:bg-cta-hover"
          >
            Retake quiz
          </Link>
          {weakest && (
            <button
              onClick={() => navigate(`/subjects/${subject.id}/quiz`, { state: { topic: weakest.topic } })}
              className="rounded-md border border-brand-soft/60 px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
            >
              Practise {weakest.topic}
            </button>
          )}
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-line bg-surface p-5">
        <h2 className="mb-3 font-semibold">By topic</h2>
        <ul className="space-y-3">
          {attempt.topicBreakdown.map((t) => (
            <TopicBar key={t.topic} {...t} />
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">Topics under {WEAK}% are marked as weak.</p>
      </section>

      <h2 className="mt-8 mb-3 font-semibold">Review your answers</h2>
      <ol className="space-y-3">
        {questions.map((q, i) => (
          <QuestionReview key={i} q={q} number={i + 1} />
        ))}
      </ol>
    </div>
  );
}
