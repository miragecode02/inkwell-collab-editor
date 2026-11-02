import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, MagnifyingGlass, PenNib, Plus, SignOut } from '@phosphor-icons/react';
import { listDocuments, createDocument, User } from '../api';

interface Doc {
  id: string;
  title: string;
  updated_at: string;
}

function initials(name: string) {
  return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}

function relativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-ink/10 dark:border-ink-dark/10 p-4 animate-pulse">
      <div className="w-8 h-8 rounded-lg bg-ink/10 dark:bg-ink-dark/10 mb-4" />
      <div className="h-4 w-3/4 rounded bg-ink/10 dark:bg-ink-dark/10 mb-2" />
      <div className="h-3 w-1/3 rounded bg-ink/10 dark:bg-ink-dark/10" />
    </div>
  );
}

export function DocumentList({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    listDocuments().then((d) => {
      setDocs(d);
      setLoading(false);
    });
  }, []);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const doc = await createDocument('Untitled document');
      window.location.href = `/doc/${doc.id}`;
    } finally {
      setCreating(false);
    }
  };

  const filtered = useMemo(
    () => docs.filter((d) => d.title.toLowerCase().includes(query.trim().toLowerCase())),
    [docs, query]
  );

  return (
    <div className="min-h-[100dvh] bg-paper dark:bg-paper-dark font-sans">
      <header className="sticky top-0 z-10 border-b border-ink/10 dark:border-ink-dark/10 bg-paper/90 dark:bg-paper-dark/90 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between gap-6">
          <div className="flex items-center gap-2 shrink-0">
            <PenNib size={20} weight="fill" className="text-accent dark:text-accent-dark" />
            <h1 className="font-serif text-xl text-ink dark:text-ink-dark">Inkwell</h1>
          </div>

          <div className="relative flex-1 max-w-sm">
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/35 dark:text-ink-dark/35" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search documents"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-ink/15 dark:border-ink-dark/15 bg-transparent
                         placeholder:text-ink/35 dark:placeholder:text-ink-dark/35 outline-none transition-colors
                         focus:border-accent dark:focus:border-accent-dark focus:ring-1 focus:ring-accent dark:focus:ring-accent-dark"
            />
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div
              title={user.displayName}
              className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold text-white"
              style={{ backgroundColor: user.color }}
            >
              {initials(user.displayName)}
            </div>
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 text-sm text-ink/60 dark:text-ink-dark/60 hover:text-ink dark:hover:text-ink-dark transition-colors"
            >
              <SignOut size={16} />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-serif text-xl text-ink dark:text-ink-dark">Your documents</h2>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-ink dark:bg-ink-dark text-paper dark:text-paper-dark
                       text-sm font-medium hover:opacity-90 active:scale-[0.98] transition disabled:opacity-60"
          >
            <Plus size={16} weight="bold" />
            New document
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : docs.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-24 border border-dashed border-ink/15 dark:border-ink-dark/15 rounded-xl">
            <div className="w-12 h-12 rounded-full bg-accent/10 dark:bg-accent-dark/10 flex items-center justify-center mb-4">
              <FileText size={22} className="text-accent dark:text-accent-dark" />
            </div>
            <p className="font-serif text-lg text-ink dark:text-ink-dark mb-1">No documents yet</p>
            <p className="text-sm text-ink/50 dark:text-ink-dark/50 mb-5">Create your first document to start writing together.</p>
            <button
              onClick={handleCreate}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-ink dark:bg-ink-dark text-paper dark:text-paper-dark text-sm font-medium hover:opacity-90 transition"
            >
              <Plus size={16} weight="bold" />
              New document
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-ink/50 dark:text-ink-dark/50 py-12 text-center">No documents match &ldquo;{query}&rdquo;.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((d) => (
              <Link
                key={d.id}
                to={`/doc/${d.id}`}
                state={{ title: d.title }}
                className="group rounded-xl border border-ink/10 dark:border-ink-dark/10 p-4 bg-surface dark:bg-surface-dark
                           hover:border-accent/40 dark:hover:border-accent-dark/40 hover:shadow-paper dark:hover:shadow-paper-dark
                           transition-all"
              >
                <div className="w-8 h-8 rounded-lg bg-accent/10 dark:bg-accent-dark/10 flex items-center justify-center mb-4">
                  <FileText size={16} className="text-accent dark:text-accent-dark" />
                </div>
                <p className="font-serif text-base text-ink dark:text-ink-dark truncate mb-1 group-hover:text-accent dark:group-hover:text-accent-dark transition-colors">
                  {d.title}
                </p>
                <p className="text-xs text-ink/40 dark:text-ink-dark/40">{relativeTime(d.updated_at)}</p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
