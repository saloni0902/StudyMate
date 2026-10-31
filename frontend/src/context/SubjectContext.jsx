import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as subjectsApi from '../api/subjects.js';

const SELECTED_KEY = 'studymate_subject';
const SubjectContext = createContext(null);

// Holds the student's subjects and which one is selected in the sidebar.
export function SubjectProvider({ children }) {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedIdState] = useState(() => localStorage.getItem(SELECTED_KEY));

  const setSelectedId = useCallback((id) => {
    setSelectedIdState(id);
    if (id) localStorage.setItem(SELECTED_KEY, id);
    else localStorage.removeItem(SELECTED_KEY);
  }, []);

  const refresh = useCallback(async () => {
    const list = await subjectsApi.listSubjects();
    setSubjects(list);
    return list;
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  // Keep the selection valid: fall back to the first subject.
  useEffect(() => {
    if (loading) return;
    if (!subjects.some((s) => s.id === selectedId)) setSelectedId(subjects[0]?.id || null);
  }, [loading, subjects, selectedId, setSelectedId]);

  const createSubject = async (data) => {
    const subject = await subjectsApi.createSubject(data);
    setSubjects((list) => [subject, ...list]);
    setSelectedId(subject.id);
    return subject;
  };

  const updateSubject = async (id, data) => {
    const subject = await subjectsApi.updateSubject(id, data);
    setSubjects((list) => list.map((s) => (s.id === id ? subject : s)));
    return subject;
  };

  const deleteSubject = async (id) => {
    await subjectsApi.deleteSubject(id);
    setSubjects((list) => list.filter((s) => s.id !== id));
  };

  const selected = subjects.find((s) => s.id === selectedId) || null;

  return (
    <SubjectContext.Provider
      value={{ subjects, loading, selected, setSelectedId, createSubject, updateSubject, deleteSubject }}
    >
      {children}
    </SubjectContext.Provider>
  );
}

export function useSubjects() {
  return useContext(SubjectContext);
}
