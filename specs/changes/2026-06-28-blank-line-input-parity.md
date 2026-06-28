---
release: 073651f
specs: [command-palette.md]
---

# Blank Line Input Parity

## Why

`CommandBar.send()` returned early when the trimmed input was empty, so a bare
Enter never reached the server. Telnet sends the blank line; the web client
swallowed it. Any server flow that reads a blank line as "take the default"
broke on web - a player had to type a placeholder character to trigger a
default that telnet players got for free.

## What

- `send()` now transmits the trimmed value even when it is empty, so a blank
  Enter reaches the server and blank-default flows behave the same on web and
  telnet (src/controls/CommandBar.tsx:42-43).
- Empty input is still kept out of command history; the history push stays
  guarded on a non-empty, non-password value
  (src/controls/CommandBar.tsx:44-46).
- Covered by tests for the empty send and the no-empty-history rule
  (src/controls/CommandBar.test.tsx:31-43).
