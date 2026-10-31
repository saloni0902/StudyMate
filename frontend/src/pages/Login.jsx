import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import AuthCard from '../components/AuthCard.jsx';
import ErrorBanner from '../components/ErrorBanner.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { errorMessage } from '../api/client.js';
import usePageTitle from '../hooks/usePageTitle.js';

const inputClass = 'w-full rounded-md border border-line-strong px-3 py-2 focus:border-brand focus:outline-none';

export default function Login() {
  const { user, login, notice } = useAuth();
  usePageTitle('Log in');
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(form.email, form.password);
      navigate(location.state?.from || '/dashboard', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  };

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <AuthCard title="Log in">
      <form className="space-y-4" onSubmit={handleSubmit}>
        {notice && !error && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{notice}</p>
        )}
        <ErrorBanner message={error} />
        <input type="email" required placeholder="Email" autoComplete="email" className={inputClass} value={form.email} onChange={update('email')} />
        <input type="password" required placeholder="Password" autoComplete="current-password" className={inputClass} value={form.password} onChange={update('password')} />
        <button disabled={submitting} className="w-full rounded-md bg-cta py-2 font-medium text-ink hover:bg-cta-hover disabled:opacity-60">
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <p className="mt-4 text-sm text-body">
        No account? <Link to="/register" className="text-brand">Sign up</Link>
      </p>
    </AuthCard>
  );
}
