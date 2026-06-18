---
release: b977235
specs: [gmcp-client.md, session-connection.md, command-palette.md]
---

# Command Catalog Display

## Why

The command listing opened in an ad-hoc drawer that reused the keyword-and-
description row format. A centered Command Palette modal - a dense keyword-chip
grid in category sections with a live filter and click-to-fill - is a better
surface, and it can open both from a button and in step with the server's
`commands` verb so the web and telnet listings stay in lockstep.

## What

- A new `CommandsModal` built on the dialog pattern (Esc / backdrop / X close,
  focus capture) renders the player's commands grouped by category in the
  vocabulary order received over `Commands.Categories`, with real section labels,
  per-section and total counts, a live filter over keyword / alias / category id /
  category label / description, click-to-fill into the command bar, and a hover
  brief. Empty sections are omitted.
- A shared open-store drives the modal, so the trigger button and the GMCP
  `Commands.Open` handler open the same surface; an `Open` carrying filter text
  pre-fills the filter box and pre-filters the grid.
- The client advertises the `Commands` package in `Core.Supports.Set` and routes
  two server-to-client messages: `Commands.Categories` (the vocabulary, stored for
  section ordering and labels) and `Commands.Open` (opens the palette, optionally
  pre-filtered).
- The old command drawer body and an unused command panel are removed; the
  trigger button now opens the palette.
