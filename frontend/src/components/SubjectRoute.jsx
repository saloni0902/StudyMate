import { useEffect } from 'react';
import { Link, Outlet, useParams } from 'react-router-dom';
import { useSubjects } from '../context/SubjectContext.jsx';
import Loader from './Loader.jsx';

// Wraps every /subjects/:subjectId/* page: checks the subject belongs to
// the student and makes it the selected subject in the sidebar.
export default function SubjectRoute() {
  const { subjectId } = useParams();
  const { subjects, loading, selected, setSelectedId } = useSubjects();
  const subject = subjects.find((s) => s.id === subjectId);

  useEffect(() => {
    if (subject && selected?.id !== subject.id) setSelectedId(subject.id);
  }, [subject, selected, setSelectedId]);

  if (loading) return <Loader />;
  if (!subject) {
    return (
      <div>
        <h1 className="text-2xl font-semibold">Subject not found</h1>
        <p className="mt-2 text-body">It may have been deleted.</p>
        <Link to="/dashboard" className="mt-4 inline-block text-brand">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return <Outlet context={{ subject }} />;
}
