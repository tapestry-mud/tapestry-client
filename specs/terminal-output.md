# terminal-output

Capability spec for the terminal rendering subsystem: the xterm.js viewport, the
AnsiParser SGR tokenizer, the output line buffer (outputStore), and the markup
stripper (text.ts).

---

## Overview

Incoming game text travels through two independent pipelines that currently do not
share data with each other.

The primary pipeline is the xterm.js pipeline. ProtocolParser receives a JSON
envelope from the WebSocket, extracts the raw ANSI string from envelopes of type
`text` or `watch`, and writes it directly to the xterm.js Terminal instance via
`getTerminal()?.write(...)` (src/connection/ProtocolParser.ts:22-28). The Terminal
instance lives in a module-level singleton in terminalStore and is set and cleared
by OutputViewport during mount/unmount (src/terminal/terminalStore.ts:1-12; src/panels/OutputViewport.tsx:51-67). xterm.js interprets all ANSI escape sequences
natively and renders them into the DOM canvas.

The secondary pipeline is the AnsiToken pipeline. parseAnsi() tokenizes ANSI strings
into AnsiToken arrays and outputStore accumulates those arrays. This pipeline is used
by accessibility shortcuts and the debug state inspector. It is NOT connected to
OutputViewport; the xterm.js viewport has no knowledge of outputStore or parseAnsi.

stripMarkup() in text.ts is a third utility used only by the accessibility layer to
produce plain strings from ANSI or MUD markup for screen-reader announcements.

---

## Behavior

### OutputViewport (xterm.js configuration)

OutputViewport is a React component that constructs and owns a single xterm.js
Terminal instance (src/panels/OutputViewport.tsx:7-90).

The Terminal is constructed with the following fixed options
(src/panels/OutputViewport.tsx:15-45):

- `cursorBlink: false`
- `cursorStyle: 'bar'`
- `disableStdin: true` -- the terminal is read-only; user input is not accepted
- `screenReaderMode: false`
- `scrollback: 5000` -- up to 5000 lines are kept in the scrollback buffer
- `fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace"`
- `fontSize: 14`

The color theme uses a dark background palette
(src/panels/OutputViewport.tsx:23-44):

- background `#0d0d1a`, foreground `#e0e0e0`, cursor `#5b8a9a`
- selection background `#5b8a9a44`
- Standard colors: black `#000000`, red `#aa0000`, green `#00aa00`, yellow
  `#aa5500`, blue `#0000aa`, magenta `#aa00aa`, cyan `#00aaaa`, white `#aaaaaa`
- Bright colors: brightBlack `#555555`, brightRed `#ff5555`, brightGreen
  `#55ff55`, brightYellow `#ffff55`, brightBlue `#5555ff`, brightMagenta
  `#ff55ff`, brightCyan `#55ffff`, brightWhite `#ffffff`

The FitAddon is loaded immediately after construction and `fit()` is called once at
mount time (src/panels/OutputViewport.tsx:47-50). A ResizeObserver watches the
container div and calls `fitAddon.fit()` on every resize event, so the terminal
fills its container at all times (src/panels/OutputViewport.tsx:60-61).

The Terminal instance is registered in terminalStore via `setTerminal(terminal)` at
mount and cleared to null on unmount (src/panels/OutputViewport.tsx:51; src/panels/OutputViewport.tsx:65).
terminalStore is a simple module-level variable with no reactivity
(src/terminal/terminalStore.ts:3-11).

The viewport container div has `aria-hidden="true"` and `tabIndex={-1}` on the
inner div, making the canvas surface non-focusable and invisible to screen readers
(src/panels/OutputViewport.tsx:77-78).

#### Scroll tracking

OutputViewport tracks whether the user has scrolled up by listening to
`terminal.onScroll`. After each scroll event the handler checks whether
`buf.viewportY + terminal.rows >= buf.length`; if false, `scrolledUp` state is set
to `true` (src/panels/OutputViewport.tsx:54-58).

When `scrolledUp` is true, a "v bottom" button appears in the bottom-right corner of
the viewport (src/panels/OutputViewport.tsx:79-87). Clicking it calls
`terminal.scrollToBottom()` and resets `scrolledUp` to false
(src/panels/OutputViewport.tsx:71-74).

#### AnsiParser tokens are NOT fed into OutputViewport

xterm.js handles all ANSI escape sequences internally. OutputViewport never reads
from outputStore and never calls parseAnsi(). The AnsiToken data produced by the
secondary pipeline is consumed only by the accessibility and debug layers. This
divergence is intentional in the current architecture but means any future
rendered-output feature (e.g., searchable history, custom color themes applied to
stored tokens) would need to bridge the two pipelines explicitly.

### AnsiParser -- parseAnsi()

parseAnsi() is a single-pass state-machine tokenizer exported from
src/ansi/AnsiParser.ts. It accepts a raw string and returns `AnsiToken[]`. Each
token has a `text: string` field and a `styles: AnsiStyles` field. AnsiStyles
carries at most two properties: `fg?: string` (a Tailwind class name) and
`bold?: boolean` (src/types/game.ts:1-9).

#### States

The parser operates in three states: TEXT, ESCAPE, and CSI
(src/ansi/AnsiParser.ts:3; src/ansi/AnsiParser.ts:52-73).

- In TEXT state: printable characters (code >= 0x20) and tab (0x09) accumulate into
  a text buffer. ESC (0x1b) flushes the current text buffer as a token and
  transitions to ESCAPE state. All other control characters including CR (0x0d), LF
  (0x0a), and NUL (0x00) are silently dropped
  (src/ansi/AnsiParser.ts:55-58; src/ansi/AnsiParser.test.ts:13-19).
- In ESCAPE state: `[` transitions to CSI state; any other character returns to TEXT
  state, discarding the ESC and the triggering character
  (src/ansi/AnsiParser.ts:59-65; src/ansi/AnsiParser.test.ts:85-89).
- In CSI state: characters accumulate. A final byte in the range 0x40-0x7E (`@`
  through `~`) terminates the sequence and calls applyCsi(). An out-of-range
  intermediate character that is not in 0x20-0x3F aborts the sequence and discards
  what was accumulated (src/ansi/AnsiParser.ts:67-71).

#### SGR handling

applyCsi() processes the accumulated CSI string only when the terminating character
is `m` (SGR). Any non-`m` CSI sequence (cursor movement, screen clear, etc.) is
silently discarded (src/ansi/AnsiParser.ts:37-40; src/ansi/AnsiParser.test.ts:95-98).

Within an SGR sequence, parameters are split on `;` and each numeric value is
dispatched through applyAttr() (src/ansi/AnsiParser.ts:46-49).

Recognized SGR parameters (src/ansi/AnsiParser.ts:5-21):

- `0` or empty -- resets all styles to `{}`
- `1` -- sets `bold: true`
- `30`-`37` -- sets `fg` to `text-ansi-{black,red,green,yellow,blue,magenta,cyan,white}`
- `90`-`97` -- sets `fg` to `text-ansi-bright-{black,red,...,white}`

All other numeric SGR parameters (background color codes 40-47 and 100-107, italic
22+, underline 4, blink 5, 256-color/truecolor sequences, etc.) are silently ignored
-- `applyAttr()` returns the styles object unchanged
(src/ansi/AnsiParser.ts:20-21; src/ansi/AnsiParser.test.ts:100-104).

Bare reset `\x1b[m` (empty params string) resets styles to `{}`
(src/ansi/AnsiParser.ts:42-44; src/ansi/AnsiParser.test.ts:51-55).

Compound sequences like `\x1b[1;31m` apply each parameter left to right, allowing
bold and color to be set in a single escape (src/ansi/AnsiParser.ts:46-49; src/ansi/AnsiParser.test.ts:59-62).

#### Style accumulation

Styles are accumulated across tokens within a single parseAnsi() call. A new SGR
does not clear previous styles unless an explicit reset (param 0) or an explicit
overwrite of the same field occurs. This means bold can persist across a color
change (src/ansi/AnsiParser.ts:16-21).

#### Adversarial input

HTML and script tags are passed through as plain text with no special handling
(src/ansi/AnsiParser.test.ts:74-78). HTML entities are also passed through as-is
(src/ansi/AnsiParser.test.ts:81-83). The parser provides no HTML sanitization;
callers that render tokens into the DOM via innerHTML are responsible for escaping.

Unterminated CSI sequences at end of input produce no token (the accumulated text
buffer is empty and the csi buffer is discarded) (src/ansi/AnsiParser.test.ts:91-93).

#### Performance

A benchmark in the test suite asserts that 10,000 styled lines parse in under 500ms
(src/ansi/AnsiParser.test.ts:108-115). UNVERIFIED: no CI step enforces this ceiling
automatically outside vitest runs.

### outputStore

outputStore is a Zustand store that maintains a bounded in-memory buffer of parsed
output lines (src/stores/outputStore.ts).

The buffer is typed as `AnsiToken[][]` -- an array of lines, each line being an
array of styled tokens (src/stores/outputStore.ts:7).

The maximum buffer length is 5000 lines, defined by the constant `MAX_LINES`
(src/stores/outputStore.ts:4). When a new line would exceed this limit, the oldest
line is dropped: the stored array is sliced to `lines.slice(lines.length -
MAX_LINES + 1)` before appending (src/stores/outputStore.ts:19-23).

The store exposes four mutating actions:

- `appendLine(tokens: AnsiToken[])` -- appends a pre-parsed token array as one line,
  enforcing the MAX_LINES cap (src/stores/outputStore.ts:18-23).
- `appendSystemMessage(text: string)` -- wraps plain text in a single token with
  `fg: 'text-ansi-bright-black'` (dim gray) and appends it, also enforcing the cap
  (src/stores/outputStore.ts:24-32).
- `clear()` -- resets `lines` to an empty array (src/stores/outputStore.ts:33).
- `setScrollLocked(locked: boolean)` -- sets a `scrollLocked` boolean flag
  (src/stores/outputStore.ts:34). UNVERIFIED: scrollLocked is stored but no
  production code path currently reads it to suppress auto-scroll in the xterm
  viewport; the flag appears unused outside tests.

The store does not call parseAnsi() internally. Callers must tokenize before calling
appendLine() (src/stores/outputStore.ts:18).

### stripMarkup() in text.ts

stripMarkup() is a utility function that removes all recognized markup from a string
and returns plain text (src/utils/text.ts:1-11). It is used only by accessibility
shortcuts, not by the xterm pipeline.

It applies four removal passes in order (src/utils/text.ts:2-9):

1. True ANSI CSI SGR sequences: regex `/\x1b\[[0-9;]*m/g` removes properly-formed
   `ESC[...m` escape codes (src/utils/text.ts:2).
2. Bare bracket SGR sequences: regex `/\[[0-9;]+m/g` removes non-escaped bracket
   codes of the form `[32m` that some MUD servers emit without the leading ESC byte
   (src/utils/text.ts:3).
3. Brace tokens: regex `/\{[a-zA-Z0-9_]+\}/g` removes MUD-specific color tokens
   such as `{cyan}` or `{reset}` (src/utils/text.ts:4).
4. Angle-bracket tags: regex `/<[^>]+>/g` is applied in a loop until no further
   matches remain, handling nested or back-to-back tags
   (src/utils/text.ts:5-9).

stripMarkup() does not handle 256-color or truecolor ANSI sequences (those have
parameters outside `[0-9;]*m`), though in practice those sequences are passed
through stripMarkup() unchanged. UNVERIFIED: no test covers truecolor sequences
through stripMarkup().

---

## Rejected and Reverted

- None on record.

---

## Change Log

_No change records yet._
