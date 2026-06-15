# Validation ledger

Adjudication record for `specs/` capability drafts. One line per finding: date, file,
finding, verdict (fixed / below-bar / not-real), and why. Read before judging; never
re-report an adjudicated finding as new unless new evidence names why the verdict was wrong.

Severity floor: BLOCKER = an anchor that does not support its claim, a wrong behavior
statement, a visibility leak, or a contract/lint failure. Everything else is BELOW-BAR and is
logged here, never looped.

## 2026-06-13 -- Validate pass (tapestry-client, repo-only)

Step 0 mechanical pre-check: pinned lint regex
`\([\w./\\-]+\.(ts|tsx|js|jsx)(:\d+(-\d+)?)?\)` run across all 5 drafts. Anchor counts:
accessibility-ui 56, gmcp-client 75, session-connection 51, terminal-output 36, watch-client 42.
No file with zero matches; none flagged for anchor deficit. Two consecutive judgment passes,
zero blockers. Corpus validated.

| Date | File | Finding | Verdict | Why |
|------|------|---------|---------|-----|
| 2026-06-13 | accessibility-ui.md | UNVERIFIED: `buildContextHint` call site not found in capability files | below-bar | Honest marker; the function's own behavior is anchored and verifiable, only the upstream caller is unknown (it is `Room.Nearby` in gmcp-client). |
| 2026-06-13 | accessibility-ui.md | UNVERIFIED: Alt+H routes via `helpStore.pushAnnouncement` rather than `announce`/`pushMessage` directly | below-bar | Handler behavior is anchored to helpTopic.ts; only the downstream bus routing is unconfirmed. Not a wrong statement. |
| 2026-06-13 | terminal-output.md | UNVERIFIED: AnsiParser 500ms/10k-line perf ceiling not enforced by CI | below-bar | Accurate hedge; the vitest assertion itself is anchored. |
| 2026-06-13 | terminal-output.md | UNVERIFIED: `outputStore.scrollLocked` stored but appears unread in production | below-bar | Flag exists and is anchored (outputStore.ts:34); honest coverage note, not a false claim. |
| 2026-06-13 | terminal-output.md | UNVERIFIED: no test covers truecolor sequences through `stripMarkup` | below-bar | Honest test-coverage gap; the documented passthrough behavior is correct. |
| 2026-06-13 | watch-client.md | UNVERIFIED: engine ack of `unwatch`; whether `text`/`gmcp` frames arrive on a watch socket | below-bar | Out-of-repo server behavior, correctly left marked under closed-book sourcing. |
| 2026-06-13 | session-connection.md | 351 lines, exceeds the ~150-line advisory soft cap | below-bar | Advisory only. Boundary is coherent: one socket's transport + JSON protocol + handshake + reconnect + dispatcher overview. No wrong split. |
| 2026-06-13 | gmcp-client.md | 244 lines, exceeds the ~150-line advisory soft cap | below-bar | Advisory only. Enumerates ~35 GMCP handlers; inherently large, boundary is correct. |
| 2026-06-13 | session-connection.md | Section 11 re-enumerates the GMCP handler list owned authoritatively by gmcp-client.md | below-bar | Intentional overview/cross-reference framed as a dispatcher summary; mild duplication, not a contradiction. |
| 2026-06-13 | all 5 files | Change Log shows `_No change records yet._` placeholder rather than a record list | not-real | No records exist in specs/changes/ yet; the contract does not require a record to exist, only the heading and (when present) the one-line format. |
