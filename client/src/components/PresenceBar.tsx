import { RemoteCursor, ConnectionState } from '../hooks/useCollabDoc';
import { User } from '../api';

interface Props {
  user: User;
  cursors: Record<string, RemoteCursor>;
  connectionState: ConnectionState;
}

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

export function PresenceBar({ user, cursors, connectionState }: Props) {
  const others = Object.values(cursors);
  return (
    <div className="flex items-center gap-3 font-sans text-sm">
      <span className={`inline-block w-2 h-2 rounded-full ${STATE_DOT[connectionState]}`} />
      <span className="text-ink/60 dark:text-ink-dark/60">{STATE_LABEL[connectionState]}</span>
      <div className="flex -space-x-2 ml-2">
        <div
          title={`${user.displayName} (you)`}
          className="w-7 h-7 rounded-full border-2 border-paper dark:border-paper-dark flex items-center justify-center text-[11px] font-semibold text-white"
          style={{ backgroundColor: user.color }}
        >
          {initials(user.displayName)}
        </div>
        {others.map((c) => (
          <div
            key={c.socketId}
            title={c.displayName}
            className="w-7 h-7 rounded-full border-2 border-paper dark:border-paper-dark flex items-center justify-center text-[11px] font-semibold text-white"
            style={{ backgroundColor: c.color }}
          >
            {initials(c.displayName)}
          </div>
        ))}
      </div>
    </div>
  );
}
