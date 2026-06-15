---
capability: session-connection
last-updated: 2026-06-13
---

# session-connection

WebSocket player connection: transport lifecycle, JSON frame protocol, GMCP
capability handshake, and reconnect backoff. The WatchClient (spectator mode)
is a separate capability and is not covered here.

---

## Overview

The Tapestry client connects to the game server over a single WebSocket. All
traffic -- plain text output, GMCP state updates, and player commands -- flows
through that one socket as JSON-framed messages. The connection is managed by
`WebSocketClient`, parsed by `ProtocolParser`, and dispatched by
`GmcpDispatcher`. Reactive state is held in `connectionStore`.

Two entry paths exist:

1. Direct connect (no pre-auth): the player types a host:port address in
   ConnectScreen, or the client auto-detects the server URL from the page
   origin.
2. Token connect (pre-auth flow): the LoginPage completes an HTTP auth
   sequence and passes a bearer token to the WebSocket URL.

---

## Behavior

### 1. URL construction

When the page origin is `localhost` or `127.0.0.1`, `deriveServerUrl` returns
`null` and no auto-connect fires; the player must enter an address manually
(src/connection/WebSocketClient.ts:14-21).

For all other origins, `deriveServerUrl` mirrors the page protocol -- `https:`
maps to `wss:`, `http:` maps to `ws:` -- and appends `/ws` to the host, for
example `wss://example.com/ws` (src/connection/WebSocketClient.ts:19-20).

When the caller supplies a raw address that does not start with `ws`, the
client prepends `ws://` before opening the socket
(src/connection/WebSocketClient.ts:24).

When a session token is provided, it is appended as a `token` query parameter
with `encodeURIComponent` encoding. The separator is `?` if no query string
exists yet, otherwise `&` (src/connection/WebSocketClient.ts:25-27).

### 2. ConnectScreen auto-connect

On mount, `ConnectScreen` calls `deriveServerUrl`. If it returns a non-null
URL, the screen calls `WebSocketClient.connect` immediately with no token and
shows only a "Connecting..." message while the status is `connecting` or
`connected` (src/layout/ConnectScreen.tsx:35-39; src/layout/ConnectScreen.tsx:51-60).

If auto-connect is not triggered, the player types a host:port address (stored
and restored via `localStorage` keys `tapestry-last-server` and
`tapestry-recent-servers`, capped at three entries)
(src/layout/ConnectScreen.tsx:5-6; src/layout/ConnectScreen.tsx:17-21).

### 3. Pre-auth token flow

When pre-auth is enabled, LoginPage drives an HTTP credential sequence before
opening the WebSocket.

- Returning character: `POST /auth/login-by-character` with `{ character,
  password }` returns a `token`. That token is passed to
  `WebSocketClient.connect` (src/preauth/LoginPage.tsx:150-164).
- New character on an existing account: `POST /auth/login` returns
  `session_token`; then `POST /auth/select` with `{ sessionToken,
  newCharacter }` returns a `token` (src/preauth/LoginPage.tsx:356-384).
- Brand new account: `POST /auth/register` with `{ email, password,
  character }` returns a `token` (src/preauth/LoginPage.tsx:481-494).

In all three paths, `WebSocketClient.connect(serverUrl, token)` is called
with the derived server URL and the received token
(src/preauth/LoginPage.tsx:163-164; src/preauth/LoginPage.tsx:382-384;
src/preauth/LoginPage.tsx:493-495).

### 4. Transport lifecycle

`connect(address, token?)` transitions `connectionStore.status` to
`connecting` before creating the `WebSocket` instance
(src/connection/WebSocketClient.ts:29).

On `onopen`, the status advances to `connected`, `connectionStore.error` is
cleared, and `loginPhase` is set to `'name'`
(src/connection/WebSocketClient.ts:34-41).

On `onerror`, `status` becomes `'error'` and `connectionStore.error` is set
to the string `'WebSocket error'` (src/connection/WebSocketClient.ts:48-51).

On `onclose`, the reconnect logic fires if `shouldReconnect` is true (see
section 6 below); otherwise `status` becomes `'disconnected'` and
`loginPhase` becomes `'disconnected'`
(src/connection/WebSocketClient.ts:54-65).

`disconnect()` sets `shouldReconnect = false`, cancels any pending reconnect
timer, closes the socket, nulls the socket reference, and sets both `status`
and `loginPhase` to their disconnected values
(src/connection/WebSocketClient.ts:69-79).

### 5. shouldReconnect flag

The `shouldReconnect` module-level flag controls whether the client attempts
to reconnect after a close event (src/connection/WebSocketClient.ts:12).

On a successful open, `shouldReconnect` is set to `!token`: connections opened
without a token will auto-reconnect; connections opened with a pre-auth token
will not (src/connection/WebSocketClient.ts:36).

Calling `disconnect()` explicitly always sets `shouldReconnect = false` before
closing, preventing any reconnect loop
(src/connection/WebSocketClient.ts:70).

### 6. Reconnect backoff

The backoff delay sequence is fixed at `[1000, 2000, 4000, 8000, 16000,
30000]` milliseconds (src/connection/WebSocketClient.ts:7).

After each close that permits reconnection, the delay is selected by
`BACKOFF_DELAYS[Math.min(reconnectAttempt, BACKOFF_DELAYS.length - 1)]`,
then `reconnectAttempt` is incremented
(src/connection/WebSocketClient.ts:57-58). This means:
- Attempt 0 waits 1 s, attempt 1 waits 2 s, ..., attempt 5+ waits 30 s.
- The counter is reset to 0 on every successful `onopen`
  (src/connection/WebSocketClient.ts:35).

During the wait the status is set back to `'connecting'` and `loginPhase` is
reset to `'name'` (src/connection/WebSocketClient.ts:59-60).

### 7. Outgoing frame formats

All frames sent to the server are JSON objects.

Player command frame (src/connection/WebSocketClient.ts:84):

```
{ "type": "command", "data": "<command string>" }
```

GMCP frame (src/connection/WebSocketClient.ts:97):

```
{ "type": "gmcp", "package": "<Package.Name>", "data": <any> }
```

`send` and `sendGmcp` are both guarded: if `ws.readyState !== WebSocket.OPEN`
the call is a no-op (src/connection/WebSocketClient.ts:83;
src/connection/WebSocketClient.ts:96).

When a command is sent outside the `'password'` login phase, the raw command
string is echoed to the local terminal and stored as `lastDirection` in
`roomStore` (src/connection/WebSocketClient.ts:88-91). During the `'password'`
phase, the debug log records `[password]` instead of the actual string
(src/connection/WebSocketClient.ts:92).

### 8. Incoming frame parsing

`ProtocolParser.parseMessage` receives every raw WebSocket message as a string
(src/connection/WebSocketClient.ts:45).

It attempts `JSON.parse`; if the parse throws, the message is silently
discarded (src/connection/ProtocolParser.ts:10-13;
src/connection/ProtocolParser.test.ts:40-42).

The parsed value is validated against `IncomingEnvelopeSchema`, a Zod
discriminated union keyed on `type`. Validation failure silently discards the
message (src/connection/ProtocolParser.ts:16-17).

Valid frame types and their routing (src/connection/ProtocolParser.ts:20-33):

| `type` | Routing |
|--------|---------|
| `text` | Written directly to the terminal; also logged to `debugStore.textLog` |
| `gmcp` | Passed to `GmcpDispatcher.dispatch(package, data)`; logged to `debugStore.gmcpLog` |
| `watch` | Written directly to the terminal (spectator ANSI output; read-only) |
| `roster` | Stored in `watchStore` via `setRoster` |
| `status` | Stored in `watchStore` via `setStatus` |

An unrecognized `type` field causes Zod discriminated-union validation to fail;
the message is discarded without throwing
(src/connection/ProtocolParser.test.ts:44-46).

If the terminal is not yet mounted, `getTerminal()` returns `null` and the
`?.write()` call is a no-op; no exception is thrown
(src/connection/ProtocolParser.test.ts:35-38).

### 9. Envelope schemas

Schemas are defined in `src/types/gmcp.ts`.

- `IncomingTextEnvelopeSchema`: `{ type: 'text', data: string }`
  (src/types/gmcp.ts:167-170)
- `IncomingGmcpEnvelopeSchema`: `{ type: 'gmcp', package: string, data:
  unknown }` (src/types/gmcp.ts:172-176)
- `IncomingWatchEnvelopeSchema`: `{ type: 'watch', data: string }`
  (src/types/gmcp.ts:190-193)
- `IncomingRosterEnvelopeSchema`: `{ type: 'roster', data:
  WatchRosterEntry[] }` (src/types/gmcp.ts:195-198)
- `IncomingStatusEnvelopeSchema`: `{ type: 'status', data: string }`
  (src/types/gmcp.ts:200-203)

All five are composed into `IncomingEnvelopeSchema` as a Zod
`discriminatedUnion` (src/types/gmcp.ts:205-211).

### 10. GMCP capability handshake

Immediately on `onopen`, before any game traffic is possible, the client
sends a single `Core.Supports.Set` GMCP frame advertising the capabilities
it understands (src/connection/WebSocketClient.ts:41):

```
{ "type": "gmcp", "package": "Core.Supports.Set",
  "data": ["Char 1", "Room 1", "Comm 1", "Login 1", "Response 1"] }
```

This is the only GMCP frame the client sends on its own initiative; all
subsequent GMCP frames are outgoing responses to player commands or server
prompts.

### 11. GMCP dispatcher

`GmcpDispatcher` is a singleton map of package names to handler functions
(src/connection/GmcpDispatcher.ts:44).

`register(pkg, handler)` sets the entry; a re-registration silently overwrites
the previous handler (src/connection/GmcpDispatcher.test.ts:25-33).

`dispatch(pkg, data)` looks up the handler and calls it. For unrecognized
packages whose name starts with `Response.`, the dispatcher falls through to
the registered `Response.Feedback` handler if the payload carries a `message`
string field, enabling forward compatibility with new server response types
(src/connection/GmcpDispatcher.ts:61-68).

In development mode, truly unhandled packages emit a `console.debug` line
(src/connection/GmcpDispatcher.ts:72-74).

`initCoreHandlers()` is called once at module load in `App.tsx`
(src/App.tsx:17) and registers handlers for the following packages
(src/connection/GmcpDispatcher.ts:86-438):

- `Char.Vitals` -- updates `charStore` vitals; triggers vital alerts
- `Char.Status` -- updates `charStore` status; triggers map and layout load
  for the character
- `Char.Commands` -- populates `commandsStore`
- `Char.StatusVars` -- logged to debug only (no store update)
- `Char.Experience` -- updates `xpStore` tracks
- `Char.Effects` -- updates `affectsStore` affects list
- `Char.Combat.Target` -- updates `combatTargetStore`; announces health
  changes via ARIA if target is active and tier changed
- `Char.Combat.Targets` -- updates `combatTargetsStore`; announces combat
  start and end via ARIA
- `Room.Info` -- updates `roomStore`; announces room name, exits, and any
  pending context hint
- `Room.Nearby` -- updates `nearbyStore`; sets a pending context hint for
  the next `Room.Info` announcement
- `Room.WrongDir` -- removes the `lastDirection` exit from `roomStore` current
  room exits
- `World.Time` -- updates `worldStore` time
- `World.Weather` -- updates `worldStore` weather state
- `World.Display.Colors` -- updates `displayStore` color map
- `Char.Items` -- updates `inventoryStore`
- `Char.Equipment` -- updates `equipmentStore`
- `Comm.Channel` -- appends message to `chatStore`; announces via ARIA
- `Char.Login.Phase` -- updates `connectionStore.loginPhase`; valid values
  are `'name'`, `'password'`, `'creating'`, `'playing'`
  (src/types/gmcp.ts:214-216)
- `Login.Prompt` -- announces the prompt string via ARIA
- `Flow.Step` -- announces chargen flow step prompt via ARIA; choice steps
  include numbered option labels
- `Flow.Help` -- announces help text via ARIA
- `Response.Feedback` -- announces the feedback message via ARIA
- `Response.Shop.List` -- announces shop summary via ARIA
- `Response.Shop.Buy` -- announces purchase result via ARIA
- `Response.Shop.Sell` -- announces sale result via ARIA
- `Response.Shop.Value` -- announces value result via ARIA
- `Response.Training.Practice` -- announces practice list summary via ARIA
- `Response.Training.Train` -- announces training result or trains-remaining
  count via ARIA
- `Response.Char.Score` -- announces character score summary via ARIA
- `Response.Look` -- announces room or object description via ARIA
- `Response.Help` -- opens the help modal (skipped for `status: 'no_match'`)

Every handler validates its payload with the matching Zod schema. A parse
failure logs a `gmcp-parse-error` entry to `debugStore` and takes no further
action (src/connection/GmcpDispatcher.ts:86-438 passim).

### 12. Login phase state machine

`connectionStore.loginPhase` is typed as `LoginPhase | 'disconnected'`
(src/stores/connectionStore.ts:3-4; src/types/gmcp.ts:218).

Valid values: `'disconnected'`, `'name'`, `'password'`, `'creating'`,
`'playing'`.

Transitions driven by the client:

- `connect()` called -> set to `'name'` on `onopen`
  (src/connection/WebSocketClient.ts:40)
- Reconnect loop fires -> reset to `'name'`
  (src/connection/WebSocketClient.ts:60)
- `disconnect()` called or non-reconnect close -> set to `'disconnected'`
  (src/connection/WebSocketClient.ts:64; src/connection/WebSocketClient.ts:78)

Transitions driven by the server via `Char.Login.Phase` GMCP:
`'name'` -> `'password'` -> `'creating'` -> `'playing'` (or any valid value
the server sends) (src/connection/GmcpDispatcher.ts:262-268).

`App.tsx` uses `loginPhase === 'playing'` to switch from `LoginLayout` to
`GameLayout` (src/App.tsx:83).

### 13. Connection store

`connectionStore` (Zustand) holds four pieces of state
(src/stores/connectionStore.ts:6-15):

- `status`: `'disconnected' | 'connecting' | 'connected' | 'error'`
- `serverAddress`: the address string passed to the last `connect()` call
- `error`: `string | null`, set to `'WebSocket error'` on `onerror`, cleared
  to `null` on successful `onopen`
- `loginPhase`: `LoginPhaseState` (see section 12)

Initial values: `status: 'disconnected'`, `serverAddress: ''`, `error: null`,
`loginPhase: 'disconnected'` (src/stores/connectionStore.ts:17-22).

### 14. Debug logging

Every state transition is logged to `debugStore.connectionLog` via
`useDebugStore.getState().logConnection(event, detail)`
(src/connection/WebSocketClient.ts:30; src/connection/WebSocketClient.ts:39;
src/connection/WebSocketClient.ts:51; src/connection/WebSocketClient.ts:55;
src/connection/WebSocketClient.ts:79).

When a token is present, the debug log redacts it to `token=***` before
storing the URL (src/connection/WebSocketClient.ts:30).

Outgoing GMCP frames are logged to `debugStore.gmcpLog` as direction `'out'`
(src/connection/WebSocketClient.ts:99). Incoming GMCP frames are logged as
direction `'in'` (src/connection/ProtocolParser.ts:24).

---

## Rejected and Reverted

- None on record.

---

## Change Log

- 2026-06-13 [preauth-session-token](changes/2026-06-13-preauth-session-token.md)
