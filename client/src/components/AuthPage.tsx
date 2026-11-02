import { useState } from 'react';
import { EnvelopeSimple, Eye, EyeSlash, LockSimple, PenNib, Spinner, UserCircle, WarningCircle } from '@phosphor-icons/react';
import { login, signup, User } from '../api';

export function AuthPage({ onAuthed }: { onAuthed: (u: User) => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

  const field = 'w-full pl-10 pr-3 py-2.5 border border-ink/15 dark:border-ink-dark/15 rounded-lg bg-transparent text-sm ' +
    'placeholder:text-ink/35 dark:placeholder:text-ink-dark/35 outline-none transition-colors ' +
    'focus:border-accent dark:focus:border-accent-dark focus:ring-1 focus:ring-accent dark:focus:ring-accent-dark';

  return (
    <div className="min-h-[100dvh] bg-paper dark:bg-paper-dark flex items-center justify-center font-sans px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-1">
          <PenNib size={22} weight="fill" className="text-accent dark:text-accent-dark" />
          <h1 className="font-serif text-3xl text-ink dark:text-ink-dark">Inkwell</h1>
        </div>
        <p className="text-ink/50 dark:text-ink-dark/50 text-sm mb-8">Write together, in real time.</p>

        <form onSubmit={submit} className="bg-surface dark:bg-surface-dark border border-ink/10 dark:border-ink-dark/10 rounded-xl shadow-paper dark:shadow-paper-dark p-6">
          <div className="flex gap-1 mb-6 p-1 bg-ink/5 dark:bg-ink-dark/5 rounded-lg text-sm font-medium">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`flex-1 py-1.5 rounded-md transition-colors ${mode === 'login' ? 'bg-surface dark:bg-surface-dark shadow-sm text-ink dark:text-ink-dark' : 'text-ink/50 dark:text-ink-dark/50'}`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode('signup')}
              className={`flex-1 py-1.5 rounded-md transition-colors ${mode === 'signup' ? 'bg-surface dark:bg-surface-dark shadow-sm text-ink dark:text-ink-dark' : 'text-ink/50 dark:text-ink-dark/50'}`}
            >
              Sign up
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {mode === 'signup' && (
              <div className="relative">
                <UserCircle size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/35 dark:text-ink-dark/35" />
                <input
                  className={field}
                  placeholder="Your name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                />
              </div>
            )}
            <div className="relative">
              <EnvelopeSimple size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/35 dark:text-ink-dark/35" />
              <input
                className={field}
                placeholder="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="relative">
              <LockSimple size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/35 dark:text-ink-dark/35" />
              <input
                className={field + ' pr-10'}
                placeholder="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/35 dark:text-ink-dark/35 hover:text-ink/60 dark:hover:text-ink-dark/60"
                tabIndex={-1}
              >
                {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <p className="flex items-center gap-1.5 text-red-600 dark:text-red-400 text-xs mt-3">
              <WarningCircle size={14} weight="fill" />
              {error}
            </p>
          )}

          <button
            disabled={busy}
            className="w-full mt-5 py-2.5 rounded-lg bg-ink dark:bg-ink-dark text-paper dark:text-paper-dark text-sm font-medium
                       hover:opacity-90 active:scale-[0.98] transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {busy && <Spinner size={16} className="animate-spin" />}
            {mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  );
}
