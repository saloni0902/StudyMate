// Progress and weak topics are worked out with plain code from quiz attempts:
// easy to explain, and no AI request needed.

export const WEAK_PERCENT = 60; // a topic below this accuracy is "weak"
export const MIN_QUESTIONS = 2; // need at least this many answers on a topic to judge it

const pct = (correct, total) => (total ? Math.round((correct / total) * 100) : 0);

/**
 * @param attempts [{ id, quizTopic, score, total, percent, topicBreakdown, createdAt }] oldest first
 */
export function computeProgress(attempts) {
  const topics = new Map();
  for (const attempt of attempts) {
    for (const { topic, correct, total } of attempt.topicBreakdown) {
      const t = topics.get(topic) || { topic, correct: 0, total: 0, lastPercent: 0 };
      t.correct += correct;
      t.total += total;
      t.lastPercent = pct(correct, total); // attempts are oldest first, so this ends as the latest
      topics.set(topic, t);
    }
  }

  const topicList = [...topics.values()]
    .map((t) => ({ ...t, percent: pct(t.correct, t.total), weak: t.total >= MIN_QUESTIONS && pct(t.correct, t.total) < WEAK_PERCENT }))
    // Weakest first; topics with more answers come first when tied.
    .sort((a, b) => a.percent - b.percent || b.total - a.total);

  const answered = attempts.reduce((sum, a) => sum + a.total, 0);
  const correct = attempts.reduce((sum, a) => sum + a.score, 0);

  return {
    quizzesTaken: attempts.length,
    questionsAnswered: answered,
    averagePercent: pct(correct, answered),
    attempts: attempts.map((a) => ({
      id: a.id,
      quizTopic: a.quizTopic,
      score: a.score,
      total: a.total,
      percent: a.percent,
      createdAt: a.createdAt,
    })),
    topics: topicList,
    weakTopics: topicList.filter((t) => t.weak).map((t) => ({ topic: t.topic, percent: t.percent })),
  };
}

// Topics for a study plan: the weak ones; if there are none yet, the
// lowest-scoring topics that still have mistakes; if everything is perfect,
// the three lowest anyway so there is something to revise.
export function planTopics(progress) {
  if (progress.weakTopics.length) return progress.weakTopics.slice(0, 5);
  const imperfect = progress.topics.filter((t) => t.percent < 100);
  return (imperfect.length ? imperfect : progress.topics).slice(0, 3).map((t) => ({ topic: t.topic, percent: t.percent }));
}
