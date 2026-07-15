import { useState } from 'react';
import { login, signup, User } from '../api';

export function AuthPage({ onAuthed }: { onAuthed: (u: User) => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = mode === 'login' ? await login(email, password) : await signup(email, password, displayName);
      localStorage.setItem('token', res.token);
      onAuthed(res.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center font-sans">
      <form onSubmit={submit} className="w-full max-w-sm px-8">
        <h1 className="font-serif text-3xl mb-1">Inkwell</h1>
        <p className="text-ink/50 text-sm mb-8">Write together, in real time.</p>

        {mode === 'signup' && (
          <input
            className="w-full mb-3 px-3 py-2 border border-ink/15 rounded bg-transparent text-sm"
            placeholder="Your name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
        )}
        <input
          className="w-full mb-3 px-3 py-2 border border-ink/15 rounded bg-transparent text-sm"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="w-full mb-4 px-3 py-2 border border-ink/15 rounded bg-transparent text-sm"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <p className="text-red-600 text-xs mb-3">{error}</p>}

        <button
          disabled={busy}
          className="w-full py-2 rounded bg-ink text-paper text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {mode === 'login' ? 'Sign in' : 'Create account'}
        </button>

        <button
          type="button"
          onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
          className="w-full mt-3 text-xs text-ink/50 hover:underline"
        >
          {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>
      </form>
    </div>
  );
}
