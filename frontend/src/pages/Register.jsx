import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import AuthCard from '../components/AuthCard.jsx';
import ErrorBanner from '../components/ErrorBanner.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { errorMessage } from '../api/client.js';
import usePageTitle from '../hooks/usePageTitle.js';

const inputClass = 'w-full rounded-md border border-line-strong px-3 py-2 focus:border-brand focus:outline-none';

export default function Register() {
  const { user, register } = useAuth();
  usePageTitle('Sign up');
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await register(form.name, form.email, form.password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  };

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <AuthCard title="Create your account">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <ErrorBanner message={error} />
        <input type="text" required placeholder="Name" autoComplete="name" className={inputClass} value={form.name} onChange={update('name')} />
        <input type="email" required placeholder="Email" autoComplete="email" className={inputClass} value={form.email} onChange={update('email')} />
        <input type="password" required minLength={6} placeholder="Password (min 6 characters)" autoComplete="new-password" className={inputClass} value={form.password} onChange={update('password')} />
        <button disabled={submitting} className="w-full rounded-md bg-cta py-2 font-medium text-ink hover:bg-cta-hover disabled:opacity-60">
          {submitting ? 'Creating account…' : 'Sign up'}
        </button>
      </form>
      <p className="mt-4 text-sm text-body">
        Already have an account? <Link to="/login" className="text-brand">Log in</Link>
      </p>
    </AuthCard>
  );
}
