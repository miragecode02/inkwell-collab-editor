import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { RgaDocument, RgaNode, RgaOp } from '@collab/crdt';
import { API_BASE, User } from '../api';

export interface RemoteCursor {
  socketId: string;
  userId: string;
  displayName: string;
  color: string;
  cursorIndex: number | null;
}

export type ConnectionState = 'connecting' | 'live' | 'reconnecting' | 'error';

/**
 * Diff two strings to a single insert or delete op. Real keystrokes are
 * single-character in the vast majority of cases (typing, backspace);
 * paste / cut of multi-char ranges is handled by diffing the common
 * prefix/suffix so we don't have to reinvent a full text-diff library
 * for the editor. Each detected change becomes one or more localInsert
 * /localDelete calls against the CRDT, which is what actually produces
 * the network-safe ops.
 */
function diffToOps(prev: string, next: string, doc: RgaDocument): RgaOp[] {
  if (prev === next) return [];
  let start = 0;
  while (start < prev.length && start < next.length && prev[start] === next[start]) start++;
  let endPrev = prev.length;
  let endNext = next.length;
  while (endPrev > start && endNext > start && prev[endPrev - 1] === next[endNext - 1]) {
    endPrev--;
    endNext--;
  }
  const ops: RgaOp[] = [];
  // Deletions first (from the tail end backward so indices stay valid).
  for (let i = endPrev - 1; i >= start; i--) {
    const op = doc.localDelete(start);
    if (op) ops.push(op);
  }
  const inserted = next.slice(start, endNext);
  if (inserted.length > 0) {
    ops.push(...doc.localInsert(start, inserted));
  }
  return ops;
}

export function useCollabDoc(documentId: string, user: User) {
  const docRef = useRef<RgaDocument>(new RgaDocument(`client-${user.id}-${Math.random().toString(36).slice(2, 8)}`));
  const socketRef = useRef<Socket | null>(null);
  const [text, setText] = useState('');
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [cursors, setCursors] = useState<Record<string, RemoteCursor>>({});
  const lastKnownText = useRef('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    const socket = io(API_BASE, { auth: { token } });
    socketRef.current = socket;

    function joinDocument() {
      socket.emit(
        'join-document',
        { documentId, displayName: user.displayName, color: user.color },
        (ack: { snapshot: RgaNode[]; presence: any[] } | { error: string }) => {
          if ('error' in ack) {
            console.error('join-document error:', ack.error);
            setConnectionState('error');
            return;
          }
          // Load the real CRDT node graph from the server (not a synthesized string).
          // This preserves tombstone/id history so concurrent ops from late joiners
          // resolve correctly — the actual fix for the fake-seed-node bootstrap.
          docRef.current.loadSnapshot(ack.snapshot);
          lastKnownText.current = docRef.current.getText();
          setText(lastKnownText.current);
          setConnectionState('live');

          const roster: Record<string, RemoteCursor> = {};
          for (const p of ack.presence) {
            if (p.socketId === socket.id) continue;
            roster[p.socketId] = {
              socketId: p.socketId,
              userId: p.userId,
              displayName: p.displayName,
              color: p.color,
              cursorIndex: p.cursorIndex,
            };
          }
          setCursors(roster);
        }
      );
    }

    socket.on('connect', () => {
      // Fires on both initial connect and every reconnect.
      // Re-joining resets CRDT state from the server's authoritative snapshot,
      // which also discards any locally-applied ops that were never confirmed.
      joinDocument();
    });

    socket.on('op', (op: RgaOp) => {
      docRef.current.apply(op);
      const newText = docRef.current.getText();
      lastKnownText.current = newText;
      setText(newText);
    });

    socket.on('presence-joined', (info: any) => {
      setCursors((prev) => ({
        ...prev,
        [info.socketId]: {
          socketId: info.socketId,
          userId: info.userId,
          displayName: info.displayName,
          color: info.color,
          cursorIndex: info.cursorIndex,
        },
      }));
    });

    socket.on('presence-left', ({ socketId }: { socketId: string }) => {
      setCursors((prev) => {
        const next = { ...prev };
        delete next[socketId];
        return next;
      });
    });

    socket.on('cursor', ({ socketId, cursorIndex }: { socketId: string; cursorIndex: number }) => {
      setCursors((prev) =>
        prev[socketId] ? { ...prev, [socketId]: { ...prev[socketId], cursorIndex } } : prev
      );
    });

    socket.on('disconnect', () => {
      setConnectionState('reconnecting');
      // Clear remote cursors — they'll repopulate from the presence roster on reconnect
      setCursors({});
    });

    socket.on('connect_error', () => {
      // Only show 'error' if we've never successfully connected; otherwise keep 'reconnecting'
      setConnectionState((s) => (s === 'connecting' ? 'error' : 'reconnecting'));
    });

    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  /** Called by the editor whenever the visible text changes locally. */
  const applyLocalChange = useCallback((newText: string) => {
    const ops = diffToOps(lastKnownText.current, newText, docRef.current);
    lastKnownText.current = docRef.current.getText();
    setText(lastKnownText.current);
    if (ops.length > 0 && socketRef.current) {
      for (const op of ops) socketRef.current.emit('op', { documentId, op });
    }
  }, [documentId]);

  const sendCursor = useCallback((index: number) => {
    socketRef.current?.emit('cursor', { documentId, cursorIndex: index });
  }, [documentId]);

  // Keep the old `connected` boolean for PresenceBar compatibility
  const connected = connectionState === 'live';

  return { text, applyLocalChange, connected, connectionState, cursors, sendCursor };
}
