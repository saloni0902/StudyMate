import { Link } from 'react-router-dom';

// The generated plan as one card per day, with the pages to read and
// quick links to practise that day's topic.
export default function StudyPlanView({ plan, subjectId, topicNames }) {
  // Link to quiz/flashcards when the day's focus names a real topic
  // ("Round Robin Scheduling" -> "Round Robin"); the longest match wins.
  const practiceTopic = (focus) =>
    topicNames
      .filter((t) => focus.toLowerCase().includes(t.toLowerCase()))
      .sort((a, b) => b.length - a.length)[0];

  return (
    <div>
      <p className="mb-3 text-xs text-muted">
        Made {new Date(plan.createdAt).toLocaleDateString()} for:{' '}
        {plan.weakTopics.map((t) => `${t.topic} (${t.percent}%)`).join(', ')}
      </p>
      <ol className="grid gap-3 md:grid-cols-2">
        {plan.days.map((day) => {
          const topic = practiceTopic(day.focus);
          return (
            <li key={day.day} className="flex flex-col rounded-lg border border-line bg-surface p-4">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
                  {day.day}
                </span>
                <h3 className="font-semibold">{day.focus}</h3>
              </div>
              <ul className="mt-3 flex-1 list-disc space-y-1.5 pl-5 text-sm text-body">
                {day.tasks.map((task) => (
                  <li key={task}>{task}</li>
                ))}
              </ul>
              {day.sources.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {day.sources.map((s) => (
                    <span key={`${s.documentId}-${s.page}`} className="rounded-full border border-line-strong px-2 py-0.5 text-xs text-muted">
                      {s.fileName} · p. {s.page}
                    </span>
                  ))}
                </div>
              )}
              {topic && (
                <div className="mt-3 flex gap-3 border-t border-line pt-3 text-xs">
                  <Link to={`/subjects/${subjectId}/quiz`} state={{ topic }} className="font-medium text-brand hover:underline">
                    Quiz on {topic}
                  </Link>
                  <Link to={`/subjects/${subjectId}/flashcards`} state={{ topic }} className="font-medium text-brand hover:underline">
                    Flashcards
                  </Link>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
