import { useRef, useEffect, useCallback, useState } from 'react';
import { RemoteCursor } from '../hooks/useCollabDoc';

interface Props {
  text: string;
  onChange: (newText: string) => void;
  onCursorMove: (index: number) => void;
  cursors: Record<string, RemoteCursor>;
  textareaRef?: React.RefObject<HTMLTextAreaElement>;
}

const MIRROR_STYLE_PROPS: (keyof CSSStyleDeclaration)[] = [
  'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing',
  'padding', 'border', 'boxSizing', 'whiteSpace', 'wordWrap', 'width',
];

/**
 * Textareas don't expose per-character caret pixel coordinates natively.
 * The standard trick (same one used by libraries like textarea-caret-position)
 * is to render an invisible "mirror" div with identical typography/box
 * model, inject a marker <span> at the target character index, and read
 * its bounding box. That gives us real Google-Docs-style colored cursor
 * pins without needing a full contenteditable rich-text engine.
 */
function getCaretCoordinates(textarea: HTMLTextAreaElement, index: number): { top: number; left: number } {
  const mirror = document.createElement('div');
  const style = window.getComputedStyle(textarea);
  MIRROR_STYLE_PROPS.forEach((prop) => {
    (mirror.style as any)[prop] = style[prop];
  });
  mirror.style.position = 'absolute';
  mirror.style.visibility = 'hidden';
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.wordWrap = 'break-word';
  mirror.style.top = '0';
  mirror.style.left = '-9999px';
  mirror.style.width = textarea.clientWidth + 'px';

  const before = document.createTextNode(textarea.value.substring(0, index));
  const marker = document.createElement('span');
  marker.textContent = '\u200b';
  const after = document.createTextNode(textarea.value.substring(index) || '.');

  mirror.appendChild(before);
  mirror.appendChild(marker);
  mirror.appendChild(after);
  document.body.appendChild(mirror);

  const top = marker.offsetTop - textarea.scrollTop;
  const left = marker.offsetLeft - textarea.scrollLeft;
  document.body.removeChild(mirror);
  return { top, left };
}

export function Editor({ text, onChange, onCursorMove, cursors, textareaRef }: Props) {
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const ref = textareaRef ?? internalRef;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [positions, setPositions] = useState<Record<string, { top: number; left: number }>>({});

  const handleInput = useCallback(() => {
    if (!ref.current) return;
    onChange(ref.current.value);
  }, [onChange]);

  const handleSelect = useCallback(() => {
    if (!ref.current) return;
    onCursorMove(ref.current.selectionStart);
  }, [onCursorMove]);

  useEffect(() => {
    if (ref.current && ref.current.value !== text) {
      const pos = ref.current.selectionStart;
      ref.current.value = text;
      try {
        ref.current.setSelectionRange(pos, pos);
      } catch {
        /* no-op */
      }
    }
  }, [text]);

  useEffect(() => {
    if (!ref.current) return;
    const next: Record<string, { top: number; left: number }> = {};
    for (const c of Object.values(cursors)) {
      if (c.cursorIndex === null) continue;
      const clamped = Math.max(0, Math.min(c.cursorIndex, text.length));
      next[c.socketId] = getCaretCoordinates(ref.current, clamped);
    }
    setPositions(next);
  }, [cursors, text]);

  return (
    <div ref={wrapRef} className="relative">
      <textarea
        ref={ref}
        defaultValue={text}
        onInput={handleInput}
        onSelect={handleSelect}
        onKeyUp={handleSelect}
        onClick={handleSelect}
        onScroll={() => setPositions((p) => ({ ...p }))}
        spellCheck={false}
        className="editor-surface w-full min-h-[70vh] resize-none bg-transparent font-serif text-lg leading-relaxed
                   outline-none border-none p-0 relative z-10 text-ink dark:text-ink-dark
                   placeholder:text-ink/30 dark:placeholder:text-ink-dark/30"
        placeholder="Start writing..."
      />
      <div className="pointer-events-none absolute inset-0 z-20 font-serif text-lg leading-relaxed">
        {Object.values(cursors).map((c) => {
          const pos = positions[c.socketId];
          if (!pos) return null;
          return (
            <div
              key={c.socketId}
              className="remote-cursor"
              style={{ top: pos.top, left: pos.left, height: '1.4em', backgroundColor: c.color }}
            >
              <span className="remote-cursor-flag" style={{ backgroundColor: c.color }}>
                {c.displayName}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
