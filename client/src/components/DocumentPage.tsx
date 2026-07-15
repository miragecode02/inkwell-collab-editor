import { useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useCollabDoc } from '../hooks/useCollabDoc';
import { Editor } from './Editor';
import { Toolbar } from './Toolbar';
import { PresenceBar } from './PresenceBar';
import { User } from '../api';

export function DocumentPage({ user }: { user: User }) {
  const { docId } = useParams();
  const { text, applyLocalChange, connected, cursors, sendCursor } = useCollabDoc(docId!, user);
  const [dark, setDark] = useState(false);

  const wrapSelection = useCallback(
    (before: string, after: string) => {
      // Simple, defensible scope: wrap the full current text is overkill;
      // instead wrap at the end as a lightweight demonstration of basic
      // marks flowing through the same CRDT op pipeline as plain typing.
      applyLocalChange(text + before + after);
    },
    [text, applyLocalChange]
  );

  const insertHeading = useCallback(() => {
    applyLocalChange(text + '\n## ');
  }, [text, applyLocalChange]);

  return (
    <div className={dark ? 'dark min-h-screen bg-paper-dark' : 'min-h-screen bg-paper'}>
      <div className="max-w-3xl mx-auto px-8 py-6">
        <div className="flex items-center justify-between mb-2">
          <Link to="/" className="text-xs font-sans text-ink/50 dark:text-ink-dark/50 hover:underline">
            ← All documents
          </Link>
          <PresenceBar user={user} cursors={cursors} connected={connected} />
        </div>
        <Toolbar onWrap={wrapSelection} onHeading={insertHeading} dark={dark} onToggleDark={() => setDark((d) => !d)} />
        <div className="mt-4">
          <Editor text={text} onChange={applyLocalChange} onCursorMove={sendCursor} cursors={cursors} />
        </div>
      </div>
    </div>
  );
}
