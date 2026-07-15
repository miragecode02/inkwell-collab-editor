interface Props {
  onWrap: (before: string, after: string) => void;
  onHeading: () => void;
  dark: boolean;
  onToggleDark: () => void;
}

export function Toolbar({ onWrap, onHeading, dark, onToggleDark }: Props) {
  const btn = 'w-8 h-8 flex items-center justify-center rounded hover:bg-ink/5 dark:hover:bg-ink-dark/10 text-sm';
  return (
    <div className="flex items-center gap-1 py-2 border-b border-ink/10 dark:border-ink-dark/10 font-sans">
      <button className={`${btn} font-bold`} title="Bold" onClick={() => onWrap('**', '**')}>B</button>
      <button className={`${btn} italic`} title="Italic" onClick={() => onWrap('_', '_')}>I</button>
      <button className={`${btn} underline`} title="Underline" onClick={() => onWrap('<u>', '</u>')}>U</button>
      <div className="w-px h-5 bg-ink/10 dark:bg-ink-dark/10 mx-1" />
      <button className={`${btn} font-semibold`} title="Heading" onClick={onHeading}>H</button>
      <div className="flex-1" />
      <button className={btn} title="Toggle dark mode" onClick={onToggleDark}>
        {dark ? '☀' : '☾'}
      </button>
    </div>
  );
}
