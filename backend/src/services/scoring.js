// Quiz scoring is plain code, not AI: simple, reliable and easy to explain.

/**
 * @param questions [{ answerIndex, topic }]
 * @param answers   chosen option index per question (-1 or missing = skipped)
 * @returns { answers, score, total, percent, topicBreakdown: [{ topic, correct, total }] }
 */
export function scoreQuiz(questions, answers) {
  const chosen = questions.map((_, i) => (Number.isInteger(answers[i]) ? answers[i] : -1));
  const byTopic = new Map();
  let score = 0;

  questions.forEach((q, i) => {
    const right = chosen[i] === q.answerIndex;
    if (right) score += 1;
    const entry = byTopic.get(q.topic) || { topic: q.topic, correct: 0, total: 0 };
    entry.total += 1;
    if (right) entry.correct += 1;
    byTopic.set(q.topic, entry);
  });

  const total = questions.length;
  return {
    answers: chosen,
    score,
    total,
    percent: total ? Math.round((score / total) * 100) : 0,
    // Weakest topics first.
    topicBreakdown: [...byTopic.values()].sort((a, b) => a.correct / a.total - b.correct / b.total),
  };
}

// Full review after submitting: each question with the student's answer,
// the correct answer, the explanation and where it comes from in the notes.
export function reviewQuestions(questions, answers) {
  return questions.map((q, i) => ({
    question: q.question,
    options: q.options,
    topic: q.topic,
    chosenIndex: answers[i] ?? -1,
    answerIndex: q.answerIndex,
    correct: answers[i] === q.answerIndex,
    explanation: q.explanation,
    source: q.source,
  }));
}
