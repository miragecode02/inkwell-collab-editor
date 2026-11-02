import { Eye, ListBullets, ListNumbers, Moon, PencilSimple, Sun, TextB, TextHOne, TextItalic, TextStrikethrough, TextUnderline } from '@phosphor-icons/react';

interface Props {
  onWrap: (before: string, after: string) => void;
  onHeading: () => void;
  onLinePrefix: (prefix: string) => void;
  dark: boolean;
  onToggleDark: () => void;
  preview: boolean;
  onTogglePreview: () => void;
}

export function Toolbar({ onWrap, onHeading, onLinePrefix, dark, onToggleDark, preview, onTogglePreview }: Props) {
  const btn =
    'w-8 h-8 flex items-center justify-center rounded-md text-ink/70 dark:text-ink-dark/70 ' +
    'hover:bg-ink/5 dark:hover:bg-ink-dark/10 hover:text-ink dark:hover:text-ink-dark transition-colors ' +
    'disabled:opacity-30 disabled:pointer-events-none';
  return (
    <div className="flex items-center gap-0.5 py-2 border-b border-ink/10 dark:border-ink-dark/10 font-sans">
      <button className={btn} title="Bold" disabled={preview} onClick={() => onWrap('**', '**')}>
        <TextB size={16} weight="bold" />
      </button>
      <button className={btn} title="Italic" disabled={preview} onClick={() => onWrap('_', '_')}>
        <TextItalic size={16} />
      </button>
      <button className={btn} title="Underline" disabled={preview} onClick={() => onWrap('<u>', '</u>')}>
        <TextUnderline size={16} />
      </button>
      <button className={btn} title="Strikethrough" disabled={preview} onClick={() => onWrap('~~', '~~')}>
        <TextStrikethrough size={16} />
      </button>
      <div className="w-px h-5 bg-ink/10 dark:bg-ink-dark/10 mx-1" />
      <button className={btn} title="Heading" disabled={preview} onClick={onHeading}>
        <TextHOne size={16} />
      </button>
      <button className={btn} title="Bullet list" disabled={preview} onClick={() => onLinePrefix('- ')}>
        <ListBullets size={16} />
      </button>
      <button className={btn} title="Numbered list" disabled={preview} onClick={() => onLinePrefix('1. ')}>
        <ListNumbers size={16} />
      </button>
      <div className="flex-1" />
      <button
        className={
          'flex items-center gap-1.5 px-2.5 h-8 rounded-md text-xs font-medium transition-colors ' +
          (preview
            ? 'bg-accent/10 text-accent dark:bg-accent-dark/10 dark:text-accent-dark'
            : 'text-ink/70 dark:text-ink-dark/70 hover:bg-ink/5 dark:hover:bg-ink-dark/10')
        }
        title={preview ? 'Back to editing' : 'Preview formatting'}
        onClick={onTogglePreview}
      >
        {preview ? <PencilSimple size={15} /> : <Eye size={15} />}
        {preview ? 'Edit' : 'Preview'}
      </button>
      <div className="w-px h-5 bg-ink/10 dark:bg-ink-dark/10 mx-1" />
      <button className={btn} title="Toggle dark mode" onClick={onToggleDark}>
        {dark ? <Sun size={16} /> : <Moon size={16} />}
      </button>
    </div>
  );
}
