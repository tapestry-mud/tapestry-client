# tapestry-client

Browser-based web client for [Tapestry](https://tapestryengine.com) MUD servers.

Connects to any Tapestry server via WebSocket and GMCP. No plugins or extensions required -- just a browser.

**Live instance:** [lf.tapestryengine.com](https://lf.tapestryengine.com)

---

## Design

The client has two parallel output channels and they serve different audiences:

- **The terminal** renders colored, formatted game text for sighted users. xterm is marked `aria-hidden` -- screen readers never see it.
- **ARIA live regions** receive structured announcements derived from GMCP packets. Screen readers get clean semantic content: room names, vital changes, combat events, chat messages -- not a flood of ANSI escape sequences.

The screen reader workflow is first-class, not adapted from the sighted flow. GMCP is the contract.

---

## Features

**For sighted users:**
- Terminal output with ANSI color themes (four themes, including high-contrast)
- Auto-mapper that builds a visual map of explored rooms in real-time
- Vitals panel -- HP, resource, and movement bars via GMCP
- Character panel -- stats, effects with timers, active combat target
- Hotbar -- configurable command shortcuts
- Drag-and-drop panel layout

**For screen reader users:**
- Every reaction that would print on screen is also sent through the GMCP feedback channel -- so any pack, even one that wasn't built with accessibility in mind, is automatically exposed to screen readers
- Content creators can supply richer structured GMCP channels (room info, combat summaries, shop lists, contextual hints) for a more tailored experience -- the feedback channel is the floor, not the ceiling
- Six announcement categories, each independently configurable: **Interrupt**, **Polite**, or **Off** -- players control how aggressively content is read
  - `vitals` (default: Interrupt), `combat` (Interrupt), `prompt` (Interrupt)
  - `room` (default: Polite), `chat` (Polite), `feedback` (Polite)
- Vitals alert state machine: announces at 40% (low) and 10% (critical), stays quiet until recovery
- Skip navigation links to jump to game output, command input, or settings

**Keyboard shortcuts for screen reader users (Alt+key, rebindable):**

| Shortcut | What it does |
|----------|-------------|
| Alt+L | Full room description -- name, description, exits |
| Alt+C | Context breakdown -- nearby NPCs and entities with available actions (list, buy, practice, etc.) |
| Alt+H | Read current help topic (when help modal is open) |

The context system is two-tier: on room entry you get a brief summary ("Shop and trainer nearby"), and Alt+C gives you the full breakdown with action hints ("Shop: Grimjaw -- list, buy, sell, value. Trainer: Elara -- practice, train.").

---

## Connection Modes

On load the client fetches `GET /config` from the server:
- `{"preAuth":{"enabled":true}}` -- shows a web login form before opening the WebSocket
- Otherwise -- shows a direct connect screen with a server address input
- On localhost -- skips the config fetch and connects directly

---

## Running Locally

```bash
npm ci
npm run dev        # Vite dev server at localhost:5173
npm test           # Vitest + jsdom
npm run build      # production build to dist/
```

The dev server connects to a Tapestry engine at `localhost:4001` (WebSocket). See [tapestry-public](https://github.com/tapestry-mud/tapestry-public) for engine setup, or [tapestry-cli](https://github.com/tapestry-mud/tapestry-cli) to spin up a game project.

The client handles connection failures gracefully -- UI work doesn't require a running engine.

---

## Deployment

Pushing to `master` runs GitHub Actions:
1. Tests pass
2. Vite builds `dist/`
3. `dist/` deploys to the server via SCP

Caddy serves the SPA. WebSocket requests to `/ws` proxy to the engine's WebSocket port (`4001`).

To self-host: copy `dist/` to any static file server and configure your reverse proxy to forward `/ws` to port `4001` on the engine host.

---

## Status

Pre-v1, actively developed. The accessibility layer in particular is an area we want to grow alongside the engine -- GMCP packets are the foundation and there is room to expand what the engine surfaces. Contributions welcome.

---

## Stack

React 19, TypeScript, Vite, Tailwind CSS 4, Zustand, xterm.js, Vitest.

---

## Links

- [tapestryengine.com](https://tapestryengine.com)
- [tapestry-public](https://github.com/tapestry-mud/tapestry-public) -- the engine
- [tapestry-cli](https://github.com/tapestry-mud/tapestry-cli) -- project setup CLI

---

## License

[AGPL-3.0](LICENSE)
