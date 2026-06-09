import type { WatchRosterEntry } from '../types/gmcp'

/// Client-driven "next": cycle the roster by entity id and return the id to watch next. Wraps
/// around, and starts at the head if the current target is not in the roster (or is null). Returns
/// null for an empty roster. The server stays dumb — the client just sends `watch <nextId>`.
export function nextEntityId(roster: WatchRosterEntry[], currentId: string | null): string | null {
  if (roster.length === 0) { return null }
  const idx = roster.findIndex((r) => r.entityId === currentId)
  return roster[(idx + 1) % roster.length].entityId
}
