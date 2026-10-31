import { useEffect } from 'react';

// Sets the browser tab title, e.g. "Quiz · Operating Systems · StudyMate".
export default function usePageTitle(...parts) {
  const title = [...parts.filter(Boolean), 'StudyMate'].join(' · ');
  useEffect(() => {
    document.title = title;
  }, [title]);
}
