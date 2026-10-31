"""Request and response models for the AI service API."""
from pydantic import BaseModel, Field, model_validator


class IngestRequest(BaseModel):
    subjectId: str = Field(pattern=r"^[a-f0-9]{24}$")
    documentId: str = Field(pattern=r"^[a-f0-9]{24}$")
    filePath: str
    fileName: str


class IngestResponse(BaseModel):
    pages: int
    emptyPages: list[int]
    charCount: int
    chunkCount: int
    topics: list[str]


class ChatMessage(BaseModel):
    role: str = Field(pattern=r"^(user|assistant)$")
    content: str


class AskRequest(BaseModel):
    subjectId: str = Field(pattern=r"^[a-f0-9]{24}$")
    question: str = Field(min_length=1, max_length=2000)
    history: list[ChatMessage] = []


class Citation(BaseModel):
    n: int
    documentId: str
    fileName: str
    page: int
    snippet: str


class AskResponse(BaseModel):
    answer: str
    citations: list[Citation]
    grounded: bool


class SummarizeRequest(BaseModel):
    """Summarise one document (documentId) or one topic across the subject (topic)."""

    subjectId: str = Field(pattern=r"^[a-f0-9]{24}$")
    documentId: str | None = Field(default=None, pattern=r"^[a-f0-9]{24}$")
    topic: str | None = Field(default=None, min_length=2, max_length=200)
    length: str = Field(default="short", pattern=r"^(short|detailed)$")

    @model_validator(mode="after")
    def one_target(self):
        if (self.documentId is None) == (self.topic is None):
            raise ValueError("give either documentId or topic")
        return self


class SummarizeResponse(BaseModel):
    summary: str
    citations: list[Citation]
    grounded: bool
    truncated: bool


class Page(BaseModel):
    page: int
    text: str


class PagesResponse(BaseModel):
    documentId: str
    fileName: str
    pages: list[Page]


class TopicsResponse(BaseModel):
    topics: list[str]


class QuizRequest(BaseModel):
    subjectId: str = Field(pattern=r"^[a-f0-9]{24}$")
    topic: str | None = Field(default=None, min_length=2, max_length=200)
    count: int = Field(default=10, ge=3, le=15)
    difficulty: str = Field(default="medium", pattern=r"^(easy|medium|hard)$")
    knownTopics: list[str] = Field(default=[], max_length=50)


class QuizSource(BaseModel):
    documentId: str
    fileName: str
    page: int


class QuizQuestion(BaseModel):
    question: str
    options: list[str]
    answerIndex: int
    topic: str
    explanation: str
    source: QuizSource


class QuizResponse(BaseModel):
    questions: list[QuizQuestion]


class FlashcardsRequest(BaseModel):
    subjectId: str = Field(pattern=r"^[a-f0-9]{24}$")
    topic: str | None = Field(default=None, min_length=2, max_length=200)
    count: int = Field(default=10, ge=3, le=20)
    knownTopics: list[str] = Field(default=[], max_length=50)


class Flashcard(BaseModel):
    front: str
    back: str
    topic: str
    source: QuizSource


class FlashcardsResponse(BaseModel):
    cards: list[Flashcard]


class WeakTopic(BaseModel):
    topic: str = Field(min_length=1, max_length=200)
    percent: int = Field(ge=0, le=100)


class StudyPlanRequest(BaseModel):
    subjectId: str = Field(pattern=r"^[a-f0-9]{24}$")
    weakTopics: list[WeakTopic] = Field(min_length=1, max_length=10)
    days: int = Field(default=5, ge=3, le=7)


class PlanDay(BaseModel):
    day: int
    focus: str
    tasks: list[str]
    sources: list[QuizSource]


class StudyPlanResponse(BaseModel):
    days: list[PlanDay]
