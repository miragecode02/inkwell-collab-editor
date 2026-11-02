import { ListBullets, ListNumbers, Moon, Sun, TextB, TextHOne, TextItalic, TextStrikethrough, TextUnderline } from '@phosphor-icons/react';

interface Props {
  onWrap: (before: string, after: string) => void;
  onHeading: () => void;
  onLinePrefix: (prefix: string) => void;
  dark: boolean;
  onToggleDark: () => void;
}

export function Toolbar({ onWrap, onHeading, onLinePrefix, dark, onToggleDark }: Props) {
  const btn =
    'w-8 h-8 flex items-center justify-center rounded-md text-ink/70 dark:text-ink-dark/70 ' +
    'hover:bg-ink/5 dark:hover:bg-ink-dark/10 hover:text-ink dark:hover:text-ink-dark transition-colors';
  return (
    <div className="flex items-center gap-0.5 py-2 border-b border-ink/10 dark:border-ink-dark/10 font-sans">
      <button className={btn} title="Bold" onClick={() => onWrap('**', '**')}>
        <TextB size={16} weight="bold" />
      </button>
      <button className={btn} title="Italic" onClick={() => onWrap('_', '_')}>
        <TextItalic size={16} />
      </button>
      <button className={btn} title="Underline" onClick={() => onWrap('<u>', '</u>')}>
        <TextUnderline size={16} />
      </button>
      <button className={btn} title="Strikethrough" onClick={() => onWrap('~~', '~~')}>
        <TextStrikethrough size={16} />
      </button>
      <div className="w-px h-5 bg-ink/10 dark:bg-ink-dark/10 mx-1" />
      <button className={btn} title="Heading" onClick={onHeading}>
        <TextHOne size={16} />
      </button>
      <button className={btn} title="Bullet list" onClick={() => onLinePrefix('- ')}>
        <ListBullets size={16} />
      </button>
      <button className={btn} title="Numbered list" onClick={() => onLinePrefix('1. ')}>
        <ListNumbers size={16} />
      </button>
      <div className="flex-1" />
      <button className={btn} title="Toggle dark mode" onClick={onToggleDark}>
        {dark ? <Sun size={16} /> : <Moon size={16} />}
      </button>
    </div>
  );
}
