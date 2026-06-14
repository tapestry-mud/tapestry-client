# Tapestry Client -- specs

Capability specs for the Tapestry web client. Each file describes one system's current
behavior, known constraints, and change history. This directory is the canonical, public
source of truth for how each system behaves now -- a fresh agent or contributor answers
"how does X behave?" from the relevant file alone.

## Index

| Capability | File | Last Updated |
|------------|------|--------------|
| accessibility-ui | [accessibility-ui.md](accessibility-ui.md) | 2026-06-13 |
| gmcp-client | [gmcp-client.md](gmcp-client.md) | 2026-06-13 |
| session-connection | [session-connection.md](session-connection.md) | 2026-06-13 |
| terminal-output | [terminal-output.md](terminal-output.md) | 2026-06-13 |
| watch-client | [watch-client.md](watch-client.md) | 2026-06-13 |
<!-- rows added as capability specs land -->

## Contract summary

Each capability spec has four required sections: Overview, Behavior, Rejected and Reverted,
Change Log. Change records live in `specs/changes/` and use the frontmatter fields `release:`
(the version that shipped it) and `specs:` (capability files touched).

Hotfixes, regressions, and dependency bumps owe no change record. Tombstones on any reversal
of shipped behavior are mandatory.

A capability spec is current if its Change Log references the latest shipped change record
that names it in `specs:`.

## Format rules (mechanically linted)

- Behavior claims carry inline anchors in exactly one form: `(repo-relative/path/File.ext:123)`,
  where the line part may be a single line `:123` or a range `:123-145`, and may be omitted only
  for whole-file claims. Several anchors may share one set of parentheses, joined by `; `. A test
  name in the same parentheses also counts. Lint pattern (the gate IS this regex, keep them in
  sync): `\([\w./\\-]+\.(ts|tsx|js|jsx)(:\d+(-\d+)?)?\)`. A file with no matches in its Behavior
  section fails validation outright.
- An empty Rejected and Reverted section contains the single line `- None on record.` under the
  heading (the heading itself is always present).
- Change Log is a one-line-per-record list, newest first: `- YYYY-MM-DD [slug](changes/...)`.
  Not a table.
