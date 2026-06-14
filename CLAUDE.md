# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm ci               # install exact lockfile deps -- always use ci, not install
npm run dev          # Vite dev server at localhost:5173
npm test             # Vitest with jsdom, run once
npm run test:watch   # Vitest in watch mode
npm run build        # tsc -b && vite build (outputs dist/)
npm run lint         # ESLint across all .ts/.tsx
npx vitest run src/path/to/file.test.ts  # single test file
```

Node is managed with fnm. The project targets Node 24. All deps are pinned to exact versions in package.json -- no caret or tilde.

## Stack

React 19, TypeScript 6, Vite 8, Tailwind CSS 4, Zustand 5, xterm.js, Vitest 4. Path alias `@` resolves to `src/`.

## Architecture

The client has two independent output channels:

1. **Terminal** (`src/terminal/`) -- xterm.js instance that receives raw ANSI text from the server. Marked `aria-hidden`; screen readers never see it.
2. **ARIA live regions** (`src/accessibility/Announcer.tsx`, `src/accessibility/announceStore.ts`) -- receives structured announcements derived from GMCP packets. This is the screen reader path.

These channels are fed by the network layer:

- **`WebSocketClient`** (`src/connection/WebSocketClient.ts`) -- owns the WebSocket. Sends raw text to xterm. Sends binary data through `ProtocolParser`.
- **`ProtocolParser`** (`src/connection/ProtocolParser.ts`) -- decodes incoming JSON envelopes (`text`, `gmcp`, `watch`, `roster`, `status`) and routes them. Text goes to xterm; GMCP goes to `GmcpDispatcher`.
- **`GmcpDispatcher`** (`src/connection/GmcpDispatcher.ts`) -- registry of handlers keyed by GMCP package name. `initCoreHandlers()` registers all built-in handlers at module load. Unknown `Response.*` packages fall through to `Response.Feedback` if they carry a `message` field.

All game state lives in Zustand stores under `src/stores/`. Stores are flat modules exporting a single `use*Store` hook. GMCP handlers call store methods directly -- there is no action bus or middleware layer.

**`PackRegistry`** (`src/pack/registry.ts`) lets external packs register additional GMCP handlers and panels without modifying core code. Packs slot into `GmcpDispatcher` at runtime via `PackRegistry.register(manifest)`.

## Connection and Auth Modes

On load `getClientConfig()` fetches `GET /config`. Response drives whether the app shows a web login form (pre-auth mode, `src/preauth/`) or a direct connect screen (`src/layout/ConnectScreen.tsx`). On localhost the config fetch is skipped and the client connects directly to `ws://localhost:4001`. See `specs/session-connection.md` for the full state machine.

## Key Conventions

- `dangerouslySetInnerHTML` is banned by ESLint. Use text nodes or `AnsiLine` (`src/ansi/AnsiLine.tsx`) for any server-supplied content.
- All GMCP payloads are parsed through Zod schemas before touching any store. Parse failures log to `debugStore` and are otherwise dropped.
- Screen reader announcements call `announce(text, category)` from `src/accessibility/announceStore.ts`. Category controls aria-live priority and per-category user preferences.
- Test files live alongside the source file they test (`*.test.ts` / `*.test.tsx`). `src/test-setup.ts` stubs `ResizeObserver`.

## Specs

`specs/` is the canonical source of truth for system behavior. Read the relevant spec before changing behavior in any of these areas:

| Area | Spec |
|------|------|
| GMCP client (packages, dispatch, pack system) | `specs/gmcp-client.md` |
| Terminal output (ANSI, xterm) | `specs/terminal-output.md` |
| Session / connection state machine | `specs/session-connection.md` |
| Accessibility UI (announcements, shortcuts) | `specs/accessibility-ui.md` |
| Watch client (spectator mode) | `specs/watch-client.md` |

Spec format rules and the change-record contract are in `specs/README.md`. Behavior claims in specs carry inline source anchors; lint enforces this.
