import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listDocuments, createDocument, User } from '../api';

interface Doc {
  id: string;
  title: string;
  updated_at: string;
}

export function DocumentList({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listDocuments().then((d) => {
      setDocs(d);
      setLoading(false);
    });
  }, []);

  const handleCreate = async () => {
    const doc = await createDocument('Untitled document');
    setDocs((d) => [doc, ...d]);
    window.location.href = `/doc/${doc.id}`;
  };

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-3xl mx-auto px-8 py-10 font-sans">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-serif text-2xl">Inkwell</h1>
          <div className="flex items-center gap-4 text-sm text-ink/60">
            <span>{user.displayName}</span>
            <button onClick={onLogout} className="hover:underline">
              Sign out
            </button>
          </div>
        </div>

        <button
          onClick={handleCreate}
          className="mb-8 px-4 py-2 rounded bg-ink text-paper text-sm font-medium hover:opacity-90"
        >
          + New document
        </button>

        {loading ? (
          <p className="text-ink/50 text-sm">Loading…</p>
        ) : docs.length === 0 ? (
          <p className="text-ink/50 text-sm">No documents yet — create one to get started.</p>
        ) : (
          <ul className="divide-y divide-ink/10">
            {docs.map((d) => (
              <li key={d.id}>
                <Link to={`/doc/${d.id}`} className="flex items-center justify-between py-3 hover:opacity-70">
                  <span className="font-serif text-lg">{d.title}</span>
                  <span className="text-xs text-ink/40">{new Date(d.updated_at).toLocaleString()}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
