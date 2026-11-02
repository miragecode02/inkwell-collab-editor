import { RemoteCursor, ConnectionState } from '../hooks/useCollabDoc';
import { User } from '../api';

interface Props {
  user: User;
  cursors: Record<string, RemoteCursor>;
  connectionState: ConnectionState;
}

const MAX_VISIBLE = 4;

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

const STATE_LABEL: Record<ConnectionState, string> = {
  connecting: 'Connecting…',
  live: 'Live',
  reconnecting: 'Reconnecting…',
  error: 'Connection failed',
};

const STATE_DOT: Record<ConnectionState, string> = {
  connecting: 'bg-amber-500',
  live: 'bg-emerald-500',
  reconnecting: 'bg-amber-500 animate-pulse',
  error: 'bg-red-500',
};

const avatarClass =
  'w-7 h-7 rounded-full ring-2 ring-paper dark:ring-paper-dark flex items-center justify-center ' +
  'text-[11px] font-semibold text-white shrink-0';

export function PresenceBar({ user, cursors, connectionState }: Props) {
  const others = Object.values(cursors);
  const visible = others.slice(0, MAX_VISIBLE);
  const overflow = others.length - visible.length;

  return (
    <div className="flex items-center gap-3 font-sans text-sm">
      <span className="hidden sm:flex items-center gap-1.5 text-ink/60 dark:text-ink-dark/60">
        <span className={`inline-block w-2 h-2 rounded-full ${STATE_DOT[connectionState]}`} />
        {STATE_LABEL[connectionState]}
      </span>
      <div className="flex -space-x-2">
        <div title={`${user.displayName} (you)`} className={avatarClass} style={{ backgroundColor: user.color }}>
          {initials(user.displayName)}
        </div>
        {visible.map((c) => (
          <div key={c.socketId} title={c.displayName} className={avatarClass} style={{ backgroundColor: c.color }}>
            {initials(c.displayName)}
          </div>
        ))}
        {overflow > 0 && (
          <div
            title={`${overflow} more`}
            className={avatarClass + ' bg-ink/70 dark:bg-ink-dark/40'}
          >
            +{overflow}
          </div>
        )}
      </div>
    </div>
  );
}
