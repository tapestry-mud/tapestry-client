# watch-client

Spectator transport for the anonymous `/watch` surface (WatchClient + WatchPage + watchLogic).

---

## Overview

WatchClient is a lightweight, tokenless WebSocket transport that lets an anonymous browser session
observe a live player's terminal output without going through the player login or preauth flow. It
is distinct from the main player WebSocketClient (the `session-connection` capability): it opens a
separate WebSocket with `?mode=watch`, skips all GMCP handshake setup, and communicates only via
the tiny watch control protocol (`watch <id>` / `unwatch`). Incoming frames are demultiplexed by
the shared ProtocolParser, which routes watch-specific envelope types to either the terminal
singleton or the watchStore. The surface is mounted by the entry point at the `/watch` pathname,
ensuring the player App never mounts for spectator sessions.

---

## Behavior

### Entry point and route isolation

The `/watch` pathname is detected at application bootstrap in `src/main.tsx` by comparing
`window.location.pathname` (trailing slashes stripped) against the string `'/watch'`
(src/main.tsx:9). When the path matches, `WatchPage` is rendered instead of `App`
(src/main.tsx:13), so the player login flow, connectionStore, and GMCP handshake are never
initialized for a spectator session (src/main.tsx:7-8).

### Connection lifecycle

`WatchClient.connect()` is a no-op if a WebSocket instance already exists (`ws` is non-null)
(src/connection/WatchClient.ts:23). When called without an existing socket, it derives the
WebSocket URL via `deriveWatchUrl()` and sets `connectionStatus` to `'connecting'` in watchStore
before constructing the socket (src/connection/WatchClient.ts:25-27).

URL derivation follows two rules (src/connection/WatchClient.ts:11-20):

- On `localhost` or `127.0.0.1`, the engine WebSocket is reached directly at
  `ws://localhost:4001/?mode=watch` (src/connection/WatchClient.ts:14-16).
- On any other host (behind a reverse proxy such as Caddy), the URL is built from
  `window.location.host` with the `/ws` path prefix and `?mode=watch`, using `wss:` when the page
  protocol is `https:` (src/connection/WatchClient.ts:18-19).

On socket open, `connectionStatus` is set to `'connected'`; no GMCP handshake and no login
message are sent -- the spectator is a pure stream consumer (src/connection/WatchClient.ts:29-32).

On socket error, `connectionStatus` is set to `'error'` (src/connection/WatchClient.ts:38-40).

On socket close, `connectionStatus` is set to `'disconnected'` and the module-level `ws` reference
is cleared to `null` (src/connection/WatchClient.ts:42-45).

`WatchClient.disconnect()` clears `ws` to `null` before calling `close()` on the prior socket,
preventing the `onclose` handler from racing with a reconnect attempt (src/connection/WatchClient.ts:66-70).

`WatchPage` calls `WatchClient.connect()` on mount and `WatchClient.disconnect()` on unmount via a
single `useEffect` with an empty dependency array (src/watch/WatchPage.tsx:18-21).

### Outgoing command serialization

All outgoing messages are sent through `WatchClient.send(command)`, which silently drops the
message if the socket is not in the `OPEN` ready state (src/connection/WatchClient.ts:48-50).
Messages are serialized as JSON objects with shape `{ type: 'command', data: <command string> }`
(src/connection/WatchClient.ts:50).

### Watch and unwatch commands

`WatchClient.watch(entityId)` performs three actions in order
(src/connection/WatchClient.ts:53-58):

1. Resets the terminal singleton by calling `getTerminal()?.reset()`, clearing any previously
   rendered output so the new stream starts clean (src/connection/WatchClient.ts:56).
2. Sets `currentTargetId` in watchStore to the given entity id (src/connection/WatchClient.ts:57).
3. Sends the string `'watch ' + entityId` through `WatchClient.send()` (src/connection/WatchClient.ts:58).

The code comment on step 1 notes that the engine also sends an SGR reset as the first watch frame;
the client-side reset is a complementary guard (src/connection/WatchClient.ts:54-55).

`WatchClient.unwatch()` sets `currentTargetId` to `null` in watchStore and sends the string
`'unwatch'` (src/connection/WatchClient.ts:61-63). UNVERIFIED: whether the engine acknowledges
the unwatch command or simply stops streaming.

### Incoming frame routing (ProtocolParser)

All incoming WebSocket messages are passed directly to `ProtocolParser.parseMessage()` as raw
strings (src/connection/WatchClient.ts:35). ProtocolParser validates each message against
`IncomingEnvelopeSchema`, a Zod discriminated union of five envelope types; invalid JSON and
schema mismatches are silently discarded (src/connection/ProtocolParser.ts:9-17).

The watch-relevant envelope types and their routing are:

- `watch` -- the `data` field (a rendered ANSI string) is written directly to the terminal
  singleton via `getTerminal()?.write(envelope.data)` (src/connection/ProtocolParser.ts:26-28).
- `roster` -- the `data` field (an array of `WatchRosterEntry` objects) is passed to
  `useWatchStore.getState().setRoster()` (src/connection/ProtocolParser.ts:29-30).
- `status` -- the `data` field (a string) is passed to `useWatchStore.getState().setStatus()`
  (src/connection/ProtocolParser.ts:31-32).

The `text` and `gmcp` envelope types are also handled by ProtocolParser and are not excluded from
watch sessions; however, the engine is not expected to send them over a `?mode=watch` connection
(src/connection/ProtocolParser.ts:20-25). UNVERIFIED: whether the engine can in practice emit
`text` or `gmcp` frames on a watch socket.

### Envelope schemas for watch frame types

`WatchRosterEntry` has three required string fields: `entityId`, `name`, and `roomId`
(src/types/gmcp.ts:183-188). The `IncomingWatchEnvelopeSchema` expects `type: 'watch'` and a
string `data` field (src/types/gmcp.ts:190-193). The `IncomingRosterEnvelopeSchema` expects
`type: 'roster'` and `data` as an array of `WatchRosterEntry` objects (src/types/gmcp.ts:195-198).
The `IncomingStatusEnvelopeSchema` expects `type: 'status'` and a string `data` field
(src/types/gmcp.ts:200-203). All three are included in `IncomingEnvelopeSchema`
(src/types/gmcp.ts:205-211).

### watchStore state shape

watchStore is a Zustand store separate from connectionStore, holding four fields
(src/stores/watchStore.ts:6-14):

- `roster: WatchRosterEntry[]` -- the current list of watchable players, initially empty.
- `status: string` -- a server-supplied status line (e.g. "Now watching X"), initially `''`.
- `currentTargetId: string | null` -- the entity id of the currently watched player, initially
  `null`.
- `connectionStatus: WatchConnectionStatus` -- one of `'disconnected' | 'connecting' | 'connected'
  | 'error'`, initially `'disconnected'` (src/stores/watchStore.ts:4; src/stores/watchStore.ts:24).

### WatchPage UI and user controls

`WatchPage` renders a header showing the current `connectionStatus`, a 64-unit-wide sidebar with a
roster list and a "Next" button, and a main panel that mounts `OutputViewport` (the shared xterm
terminal) in read-only use (src/watch/WatchPage.tsx:29-78).

Each roster entry is a button; clicking it calls `WatchClient.watch(p.entityId)`
(src/watch/WatchPage.tsx:55). The button for the current target receives `bg-white/10 font-semibold`
styling (src/watch/WatchPage.tsx:56-58). The "Next" button is disabled when the roster is empty
(src/watch/WatchPage.tsx:40-44).

When the "Next" button is clicked, `handleNext` calls `nextEntityId(roster, currentTargetId)` and,
if a non-null id is returned, calls `WatchClient.watch(next)` (src/watch/WatchPage.tsx:23-26).

### nextEntityId cycling logic

`nextEntityId` is a pure function in `src/watch/watchLogic.ts` that cycles the roster by entity id
(src/watch/watchLogic.ts:6-10):

- Returns `null` for an empty roster (src/watch/watchLogic.ts:7).
- When `currentId` is `null` or not present in the roster, `findIndex` returns `-1`, so
  `(-1 + 1) % roster.length` evaluates to `0`, returning the first entry's id
  (src/watch/watchLogic.ts:8-9; src/watch/watchLogic.test.ts:15-18; src/watch/watchLogic.test.ts:27-29).
- Advances to the next entry by index and wraps around when the current entry is last
  (src/watch/watchLogic.ts:9; src/watch/watchLogic.test.ts:19-22; src/watch/watchLogic.test.ts:23-26).

### Terminal reset on target change

Every call to `WatchClient.watch()` -- including switching from one target to another -- resets the
terminal before sending the command. This means changing a watched player clears the terminal of the
previous player's output before any new frames arrive (src/connection/WatchClient.ts:56-58). The
`currentTargetId` in watchStore is updated to the new id at the same time as the reset, before the
network command is sent (src/connection/WatchClient.ts:57).

---

## Rejected and Reverted

- None on record.

---

## Change Log

_No change records yet._
