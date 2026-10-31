import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import SubjectRoute from './components/SubjectRoute.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import NotFound from './pages/NotFound.jsx';

// Pages inside a subject load on first visit (keeps the first download small).
const Documents = lazy(() => import('./pages/Documents.jsx'));
const DocumentText = lazy(() => import('./pages/DocumentText.jsx'));
const Chat = lazy(() => import('./pages/Chat.jsx'));
const Summary = lazy(() => import('./pages/Summary.jsx'));
const Quiz = lazy(() => import('./pages/Quiz.jsx'));
const TakeQuiz = lazy(() => import('./pages/TakeQuiz.jsx'));
const QuizResult = lazy(() => import('./pages/QuizResult.jsx'));
const Flashcards = lazy(() => import('./pages/Flashcards.jsx'));
const FlashcardReview = lazy(() => import('./pages/FlashcardReview.jsx'));
const Progress = lazy(() => import('./pages/Progress.jsx'));

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/subjects/:subjectId" element={<SubjectRoute />}>
            <Route index element={<Navigate to="documents" replace />} />
            <Route path="documents" element={<Documents />} />
            <Route path="documents/:documentId" element={<DocumentText />} />
            <Route path="chat" element={<Chat />} />
            <Route path="chat/:chatId" element={<Chat />} />
            <Route path="summary" element={<Summary />} />
            <Route path="summary/:summaryId" element={<Summary />} />
            <Route path="quiz" element={<Quiz />} />
            <Route path="quiz/:quizId" element={<TakeQuiz />} />
            <Route path="quiz/:quizId/attempts/:attemptId" element={<QuizResult />} />
            <Route path="flashcards" element={<Flashcards />} />
            <Route path="flashcards/:deckId" element={<FlashcardReview />} />
            <Route path="progress" element={<Progress />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
