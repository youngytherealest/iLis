import { ImportStatus } from '../types';

// Events whose `data` is a full ImportStatus snapshot
const SNAPSHOT_EVENTS = ['progress', 'paused', 'resumed', 'stopped', 'completed'];

/**
 * Applies one SSE event from /api/import/stream to the current import status.
 * On every event except `init`, `status` is only the state string ('running', ...).
 */
export function applyImportEvent(prev: ImportStatus | null, event: any): ImportStatus | null {
  if (event.type === 'init') return event.status;
  if (SNAPSHOT_EVENTS.includes(event.type)) return event.data;
  if (!prev) return prev;
  if (event.type === 'log') {
    return { ...prev, status: event.status, logs: [event.data, ...(prev.logs || [])].slice(0, 100) };
  }
  return { ...prev, status: event.status };
}
