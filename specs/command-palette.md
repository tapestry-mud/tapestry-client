---
capability: command-palette
last-updated: 2026-06-18
---

# command-palette

Modal command browser: triggered by a toolbar button or a server GMCP push,
renders the full command catalog filtered live, and fills the command bar on
click.

---

## Overview

The Command Palette is a `<dialog>`-based modal that presents the engine command
catalog grouped by category. It is opened either by a persistent trigger button
in `GameLayout` or by a `Commands.Open` GMCP frame pushed from the server. Both
paths write to the same `useCommandPaletteStore`. The modal reads command data
from `useCommandsStore` and category order from `useCommandCategoriesStore`.
Category vocabulary arrives at post-login via the `Commands.Categories` GMCP
burst. Commands are browsable with a live filter, and clicking any command
token fills the command bar input via `commandBarStore.setPending`.

---

## Behavior

### Trigger: toolbar button

`GameLayout` renders a fixed-position "Commands" button that calls
`useCommandPaletteStore.getState().open()` with no filter argument, opening the
modal with an empty filter
(src/layout/GameLayout.tsx:174-180).

### Trigger: Commands.Open GMCP

The `Commands.Open` GMCP handler in `initCoreHandlers` validates the payload
against `CommandsOpenSchema` (src/types/gmcp.ts:54-56), which requires only an
optional `filter` string. On success it calls
`useCommandPaletteStore.getState().open(result.data.filter)`, forwarding the
server-supplied filter string or `undefined`
(src/connection/GmcpDispatcher.ts:129-136). Both the button path and the GMCP
path converge on the same `open` action in the store
(src/stores/commandPaletteStore.ts:14).

### commandPaletteStore state

`useCommandPaletteStore` holds three fields: `isOpen: boolean`, `filter:
string`, and three actions -- `open(filter?)`, `close()`, and `setFilter()`
(src/stores/commandPaletteStore.ts:3-17).

`open(filter?)` sets `isOpen: true` and writes the provided filter string, or
`''` if none was given (src/stores/commandPaletteStore.ts:14).

`close()` sets `isOpen: false` without clearing the filter
(src/stores/commandPaletteStore.ts:15).

### Modal open/close lifecycle

`CommandsModal` drives the native `<dialog>` element via a `useEffect` on
`isOpen`. When `isOpen` becomes true the effect saves the currently focused
element, calls `dialog.showModal()`, and focuses the filter input. When `isOpen`
becomes false the effect calls `dialog.close()` and restores the previously
saved focus (src/panels/CommandsModal.tsx:17-29).

A second `useEffect` intercepts the browser-native `cancel` event (fired by
the Escape key on a `<dialog>`) and routes it through `close()` so React state
stays in sync with the dialog visibility
(src/panels/CommandsModal.tsx:32-38).

### Grouped rendering and category order

The modal groups commands by the `useCommandCategoriesStore` category list.
Categories are iterated in the order returned by the store; each category
produces a section header followed by its commands. The category list is
populated by the `Commands.Categories` GMCP burst at post-login
(src/panels/CommandsModal.tsx:41-62; src/stores/commandCategoriesStore.ts:9-12).

Each section renders the category label and per-section count as a header
(src/panels/CommandsModal.tsx:98-100). The header bar also shows a total count
of all visible commands across all sections
(src/panels/CommandsModal.tsx:64-67; src/panels/CommandsModal.tsx:84).

### Live filter

The filter input value is stored in `commandPaletteStore.filter` and updated on
every keystroke via `setFilter` (src/panels/CommandsModal.tsx:89-90).

The `grouped` memo recomputes whenever `categories`, `commands`, or the
lower-cased query `q` changes. For each command, the filter matches against
`keyword`, `description`, `category` id, the category label (looked up from a
`Map` built once per memo), and any entry in `aliases`. A command is included
when any of these fields contains the query as a substring
(src/panels/CommandsModal.tsx:40-62). The web palette is the only surface that
filters on `description`; the telnet command grid filters keyword, alias,
category id, and category label only, because telnet renders no description
column.

### Empty section omission

Sections with no matching commands are excluded by a `.filter((section) =>
section.items.length > 0)` call at the end of the `grouped` memo
(src/panels/CommandsModal.tsx:61). A section with matching commands but not the
active category also never appears because commands are pre-filtered against
`cmd.category === cat.id` before the text filter is applied
(src/panels/CommandsModal.tsx:48).

### Click-to-fill

Each command token is a `<button>`. Clicking it calls the local `fill` function,
which calls `commandBarStore.setPending(keyword + ' ')` -- appending a trailing
space so the command bar is ready for arguments -- and then calls `close()`
(src/panels/CommandsModal.tsx:69-72; src/panels/CommandsModal.tsx:106).

`commandBarStore.setPending` writes the string to `pending`; the `CommandBar`
component picks it up on the next render, copies it into its local `value`
state, clears the pending value, and focuses the input
(src/stores/commandBarStore.ts:16; src/controls/CommandBar.tsx:30-35).

### Hover brief via title attribute

Each command button carries a `title` attribute set to `cmd.description` (or
`undefined` when the description is an empty string), which the browser renders
as a tooltip on hover (src/panels/CommandsModal.tsx:105).

### Dismiss paths

Three paths close the modal:

- Esc key: intercepted via the native `cancel` event and routed to `close()`
  (src/panels/CommandsModal.tsx:35).
- Backdrop click: the `<dialog>` `onClick` handler checks whether the click
  target is the dialog element itself (i.e. the backdrop area) and calls
  `close()` (src/panels/CommandsModal.tsx:79).
- X button: a dedicated close button in the top-right corner calls `close()`
  on click (src/panels/CommandsModal.tsx:123-128).

### Commands.Categories GMCP burst

The `Commands.Categories` handler in `initCoreHandlers` validates the payload
against `CommandCategoriesSchema` (src/types/gmcp.ts:65-67), which expects
`{ categories: Array<{ id: string, label: string }> }`. On success it calls
`useCommandCategoriesStore.getState().setCategories(result.data.categories)`,
replacing the full category list
(src/connection/GmcpDispatcher.ts:120-127; src/stores/commandCategoriesStore.ts:11).

This burst is sent by the server at post-login alongside `Char.Commands`, giving
the client both the command entries and the category vocabulary before any
game interaction occurs.

### Core.Supports.Set advertisement

The client advertises `Commands 1` in the `Core.Supports.Set` handshake sent
immediately on WebSocket open. This opts the session into `Commands.Categories`
and `Commands.Open` pushes from the server
(src/connection/WebSocketClient.ts:41).

---

## Rejected and Reverted

- None on record.

---

## Change Log

- 2026-06-18 [command-catalog-display](changes/2026-06-18-command-catalog-display.md)
