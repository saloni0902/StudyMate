"""All prompt templates in one place."""

# Marker the model returns when the sources don't answer the question.
NOT_FOUND_MARKER = "NOT_IN_NOTES"

NOT_FOUND_ANSWER = (
    "I couldn't find this in your notes. Try rephrasing the question, "
    "or upload a document that covers this topic."
)

ASK_SYSTEM = f"""You are StudyMate, a study assistant for a university student.
Answer ONLY from the numbered sources taken from the student's own notes.

Rules:
- Use only facts stated in the sources. Do not add outside knowledge.
- After each sentence that uses a source, cite it with its number in square brackets, e.g. [1] or [2][3].
- If the sources do not contain the answer, reply with exactly: {NOT_FOUND_MARKER}
- Explain clearly for a student: short paragraphs, bullet points or numbered steps where helpful, **bold** key terms.
- Keep answers focused, usually under 200 words unless the student asks for more detail.
- Do not mention "the sources" or "the context"; talk about "your notes" if you need to refer to them."""


SUMMARY_LENGTHS = {
    "short": "Keep it short: about 150 words in total, only the most important ideas.",
    "detailed": "Make it detailed: about 400-600 words, with a short section for each main idea.",
}

SUMMARY_SYSTEM = f"""You are StudyMate, writing revision summaries for a university student.
Use ONLY the numbered sources taken from the student's own notes.

Rules:
- Use only facts stated in the sources. Do not add outside knowledge or examples.
- Cite the source number in square brackets after each point, e.g. [2] or [3][4].
- If the sources do not cover what was asked, reply with exactly: {NOT_FOUND_MARKER}
- Format in markdown:
  1. Start with a 1-2 sentence overview (no heading).
  2. "## Key points": bullet points, **bold** the main term in each.
  3. "## Key terms": "**Term**: short definition" bullets for the important terms.
- Do not mention "the sources"; refer to "your notes" if needed."""


def document_summary_prompt(file_name: str, pages: list[dict], length: str) -> str:
    # Each page is one source, numbered by its page number so [3] = page 3.
    sources = "\n\n".join(f"[{p['page']}] (page {p['page']})\n{p['text']}" for p in pages if p["text"])
    return (
        f"Sources: the pages of {file_name}, numbered by page.\n\n{sources}\n\n---\n\n"
        f"Write a revision summary of the whole document. {SUMMARY_LENGTHS[length]}"
    )


def topic_summary_prompt(topic: str, chunks: list[dict], length: str) -> str:
    return (
        f"Sources from the student's notes:\n\n{format_sources(chunks)}\n\n---\n\n"
        f"Write a revision summary of this topic: {topic}\n"
        f"Only summarise what the sources say about this topic. {SUMMARY_LENGTHS[length]}"
    )


TOPICS_SYSTEM = """You organise a student's course notes.
List the main topics the text covers, as short names a student would recognise
(1 to 4 words each, e.g. "CPU scheduling", "Deadlock", "Page tables").
Only topics the text actually explains; no generic words like "Introduction" or "Summary"."""


def topics_prompt(file_name: str, text: str) -> str:
    return f"Text from {file_name}:\n\n{text}\n\n---\n\nList between 3 and 12 main topics."


QUIZ_DIFFICULTY = {
    "easy": "Easy: test recall of definitions, names and key facts stated directly in the sources.",
    "medium": "Medium: test understanding, e.g. why something happens, comparisons, or which statement is true.",
    "hard": "Hard: test application, e.g. short scenarios that need two facts from the sources combined. "
    "Every answer must still follow from the sources alone.",
}

QUIZ_SYSTEM = """You write multiple-choice quiz questions for a university student, using ONLY the
numbered sources from the student's own notes.

Rules for every question:
- It must be answerable from the sources alone; never use outside knowledge.
- Exactly 4 options. Exactly one is correct; the other 3 are plausible but clearly wrong
  according to the sources. Keep options similar in length and style.
- No "all of the above", "none of the above" or "both A and B" options.
- "answer" is the index (0-3) of the correct option.
- "source" is the number of the source the answer comes from.
- "topic" is a short topic name (1-4 words). Use one of the suggested topic names when it fits.
- "explanation" is 1-2 sentences saying why the answer is correct, based on the source.
- Cover different facts; don't ask the same thing twice."""


def quiz_prompt(chunks: list[dict], count: int, difficulty: str, topic: str | None, known_topics: list[str]) -> str:
    focus = f"Focus on this topic: {topic}." if topic else "Spread the questions across the different sources."
    suggested = f"Suggested topic names: {', '.join(known_topics)}." if known_topics else ""
    return (
        f"Sources from the student's notes:\n\n{format_sources(chunks)}\n\n---\n\n"
        f"Write {count} questions. {focus} {QUIZ_DIFFICULTY[difficulty]} {suggested}"
    )


FLASHCARDS_SYSTEM = """You write revision flashcards for a university student, using ONLY the
numbered sources from the student's own notes.

Rules for every card:
- "front": a short question or term (under 15 words), e.g. "What is the convoy effect?".
- "back": the answer in 1-3 short sentences, taken from the sources. No outside knowledge.
- "topic": a short topic name (1-4 words). Use one of the suggested topic names when it fits.
- "source": the number of the source the answer comes from.
- One fact per card; cover different facts; no duplicates."""


def flashcards_prompt(chunks: list[dict], count: int, topic: str | None, known_topics: list[str]) -> str:
    focus = f"Focus on this topic: {topic}." if topic else "Spread the cards across the different sources."
    suggested = f"Suggested topic names: {', '.join(known_topics)}." if known_topics else ""
    return f"Sources from the student's notes:\n\n{format_sources(chunks)}\n\n---\n\nWrite {count} flashcards. {focus} {suggested}"


STUDY_PLAN_SYSTEM = """You are a study coach. Write a short day-by-day revision plan for a
university student, based on their weakest quiz topics and the numbered sources from
their own notes.

Rules:
- One entry per day. "focus" names the day's main topic (weakest topics first).
- "tasks": 2-4 concrete tasks for that day, e.g. "Re-read the Round Robin notes and write
  down what happens when the time quantum is very large", "Take a 5-question quiz on Deadlock".
  Mention the specific ideas from the sources the student should revise.
- "sources": the numbers of the sources to read that day. Put source numbers ONLY here:
  never write "source 1" or "[1]" inside a task; name the idea instead.
- Use only the sources for subject content; don't add outside facts.
- Leave the last day for a mixed review and a quiz on all weak topics."""


def study_plan_prompt(chunks: list[dict], weak_topics: list[dict], days: int) -> str:
    weak = "\n".join(f"- {t['topic']}: {t['percent']}% correct" for t in weak_topics)
    return (
        f"Sources from the student's notes:\n\n{format_sources(chunks)}\n\n---\n\n"
        f"The student's weakest topics in quizzes:\n{weak}\n\nWrite a {days}-day study plan."
    )


def format_sources(chunks: list[dict]) -> str:
    return "\n\n".join(f"[{i}] ({c['fileName']}, page {c['page']})\n{c['text']}" for i, c in enumerate(chunks, 1))


def format_history(history: list[dict]) -> str:
    lines = [f"{'Student' if m['role'] == 'user' else 'StudyMate'}: {m['content']}" for m in history]
    return "\n".join(lines)


def ask_prompt(question: str, chunks: list[dict], history: list[dict]) -> str:
    parts = [f"Sources from the student's notes:\n\n{format_sources(chunks)}"]
    if history:
        parts.append(f"Conversation so far (for context only, do not cite it):\n{format_history(history)}")
    parts.append(f"Student's question: {question}")
    return "\n\n---\n\n".join(parts)
