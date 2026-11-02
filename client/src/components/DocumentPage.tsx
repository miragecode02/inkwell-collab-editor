import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Check, Copy } from '@phosphor-icons/react';
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

  const insertLinePrefix = useCallback(
    (prefix: string) => {
      const ta = editorRef.current;
      const pos = ta ? ta.selectionStart : text.length;
      // Find start of current line
      const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
      // Only prefix if the line doesn't already start with it
      if (text.slice(lineStart, lineStart + prefix.length) === prefix) return;
      const newText = text.slice(0, lineStart) + prefix + text.slice(lineStart);
      applyLocalChange(newText);
      requestAnimationFrame(() => {
        if (ta) { ta.focus(); ta.setSelectionRange(pos + prefix.length, pos + prefix.length); }
      });
    },
    [text, applyLocalChange]
  );

  const insertHeading = useCallback(() => insertLinePrefix('## '), [insertLinePrefix]);

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  return (
    <div className={dark ? 'dark min-h-[100dvh] bg-canvas-dark' : 'min-h-[100dvh] bg-canvas'}>
      <header className="sticky top-0 z-10 border-b border-ink/10 dark:border-ink-dark/10 bg-paper/90 dark:bg-paper-dark/90 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center gap-4">
          <Link
            to="/"
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-md text-ink/60 dark:text-ink-dark/60
                       hover:bg-ink/5 dark:hover:bg-ink-dark/10 hover:text-ink dark:hover:text-ink-dark transition-colors"
            title="All documents"
          >
            <ArrowLeft size={18} />
          </Link>

          <div className="flex-1 min-w-0">
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
                className="font-serif text-lg bg-transparent outline-none border-b border-ink/20 dark:border-ink-dark/20 w-full text-ink dark:text-ink-dark"
              />
            ) : (
              <button
                onClick={() => setEditingTitle(true)}
                className="font-serif text-lg text-left truncate hover:opacity-70 max-w-full text-ink dark:text-ink-dark"
                title="Click to rename"
              >
                {title}
                {savingTitle && <span className="ml-2 text-xs font-sans font-normal text-ink/40 dark:text-ink-dark/40">saving…</span>}
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={copyLink}
              className="flex items-center gap-1.5 text-xs font-sans text-ink/50 dark:text-ink-dark/50 hover:text-ink dark:hover:text-ink-dark transition-colors"
              title="Copy shareable link"
            >
              {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy link'}</span>
            </button>
            <PresenceBar user={user} cursors={cursors} connectionState={connectionState} />
          </div>
        </div>
        <div className="max-w-3xl mx-auto px-6">
          <Toolbar onWrap={wrapSelection} onHeading={insertHeading} onLinePrefix={insertLinePrefix} dark={dark} onToggleDark={() => setDark((d) => !d)} />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="bg-surface dark:bg-surface-dark border border-ink/10 dark:border-ink-dark/10 rounded-xl shadow-paper dark:shadow-paper-dark px-10 py-10 sm:px-14">
          <Editor
            text={text}
            onChange={applyLocalChange}
            onCursorMove={sendCursor}
            cursors={cursors}
            textareaRef={editorRef}
          />
        </div>
      </main>
    </div>
  );
}
