import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { useCollabDoc } from '../hooks/useCollabDoc';
import { Editor } from './Editor';
import { Toolbar } from './Toolbar';
import { PresenceBar } from './PresenceBar';
import { User, renameDocument, fetchDocument } from '../api';

export function DocumentPage({ user }: { user: User }) {
  const { docId } = useParams();
  const location = useLocation();
  const { text, applyLocalChange, connected, connectionState, cursors, sendCursor } = useCollabDoc(docId!, user);
  const [dark, setDark] = useState(false);

  const [title, setTitle] = useState<string>((location.state as any)?.title || 'Untitled document');
  const [editingTitle, setEditingTitle] = useState(false);
  const [savingTitle, setSavingTitle] = useState(false);
  const [copied, setCopied] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  // Fetch the real title from server when navigating directly to a doc URL
  // (location.state.title is only set when coming from the document list)
  useEffect(() => {
    if (!(location.state as any)?.title) {
      fetchDocument(docId!).then((doc) => setTitle(doc.title)).catch(() => {});
    }
  }, [docId]);

  useEffect(() => {
    if (editingTitle) titleInputRef.current?.focus();
  }, [editingTitle]);

  const commitTitle = useCallback(async () => {
    setEditingTitle(false);
    const trimmed = title.trim() || 'Untitled document';
    setTitle(trimmed);
    setSavingTitle(true);
    try {
      await renameDocument(docId!, trimmed);
    } catch {
      // rename failed silently; title still reflects locally-typed value
    } finally {
      setSavingTitle(false);
    }
  }, [docId, title]);

  const wrapSelection = useCallback(
    (before: string, after: string) => {
      const ta = editorRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newText = text.slice(0, start) + before + text.slice(start, end) + after + text.slice(end);
      applyLocalChange(newText);
      // Restore selection around the wrapped content
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(start + before.length, end + before.length);
      });
    },
    [text, applyLocalChange]
  );

  const insertHeading = useCallback(() => {
    const ta = editorRef.current;
    const pos = ta ? ta.selectionStart : text.length;
    // Find start of current line
    const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
    // Only prefix if the line doesn't already start with ##
    if (text.slice(lineStart, lineStart + 3) === '## ') return;
    const newText = text.slice(0, lineStart) + '## ' + text.slice(lineStart);
    applyLocalChange(newText);
    requestAnimationFrame(() => {
      if (ta) { ta.focus(); ta.setSelectionRange(pos + 3, pos + 3); }
    });
  }, [text, applyLocalChange]);

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  return (
    <div className={dark ? 'dark min-h-screen bg-paper-dark' : 'min-h-screen bg-paper'}>
      <div className="max-w-3xl mx-auto px-8 py-6">
        <div className="flex items-center justify-between mb-1">
          <Link to="/" className="text-xs font-sans text-ink/50 dark:text-ink-dark/50 hover:underline">
            ← All documents
          </Link>
          <div className="flex items-center gap-3">
            <button
              onClick={copyLink}
              className="text-xs font-sans text-ink/50 dark:text-ink-dark/50 hover:underline"
              title="Copy shareable link"
            >
              {copied ? 'Copied!' : 'Copy link'}
            </button>
            <PresenceBar user={user} cursors={cursors} connectionState={connectionState} />
          </div>
        </div>

        <div className="mb-4">
          {editingTitle ? (
            <input
              ref={titleInputRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); commitTitle(); }
                if (e.key === 'Escape') { e.preventDefault(); setEditingTitle(false); }
              }}
              className="font-serif text-2xl bg-transparent outline-none border-b border-ink/20 dark:border-ink-dark/20 w-full"
            />
          ) : (
            <button
              onClick={() => setEditingTitle(true)}
              className="font-serif text-2xl text-left hover:opacity-70"
              title="Click to rename"
            >
              {title}
              {savingTitle && <span className="ml-2 text-xs font-sans text-ink/40">saving…</span>}
            </button>
          )}
        </div>
        <Toolbar onWrap={wrapSelection} onHeading={insertHeading} dark={dark} onToggleDark={() => setDark((d) => !d)} />
        <div className="mt-4">
          <Editor
            text={text}
            onChange={applyLocalChange}
            onCursorMove={sendCursor}
            cursors={cursors}
            textareaRef={editorRef}
          />
        </div>
      </div>
    </div>
  );
}
