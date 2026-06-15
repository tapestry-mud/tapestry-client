---
capability: accessibility-ui
last-updated: 2026-06-13
---

# Capability Spec: Accessibility UI

## Overview

The accessibility subsystem gives screen-reader users a first-class experience of the
Tapestry game client. It has four interlocking parts:

1. A dual-channel ARIA live-region announcement bus (assertive and polite), backed by a
   Zustand store and a single persistent React component.
2. Per-category user preferences (six categories, three states each) stored in localStorage
   and consulted by every caller before a message is queued.
3. A vital-alert state machine that watches HP/mana/movement ratios and fires transition-only
   announcements at LOW and CRITICAL thresholds.
4. Alt+key keyboard shortcuts (Alt+L, Alt+C, Alt+H) that let users pull game-state
   summaries on demand, plus skip links for keyboard navigation.

## Behavior

### ARIA live-region bus

The announcement store maintains two string slots -- `assertiveMessage` and `politeMessage`
-- that drive two always-present, visually hidden `<div>` elements rendered by `Announcer`
(src/accessibility/Announcer.tsx:3-27).

The assertive region uses `role="alert"` and `aria-live="assertive"` with `aria-atomic="true"`
(src/accessibility/Announcer.tsx:9-16). The polite region uses `role="status"` and
`aria-live="polite"` with `aria-atomic="true"` (src/accessibility/Announcer.tsx:17-24).

When `pushMessage` is called, the target slot is first cleared synchronously (set to empty
string), then re-set to the new message inside a `requestAnimationFrame` callback
(src/accessibility/announceStore.ts:21-24; src/accessibility/announceStore.ts:30-33). This
two-step rAF re-trigger forces the browser to treat the new text as a distinct DOM mutation
even when the message content is identical to a previous announcement.

After the rAF write, a 8000 ms `setTimeout` clears the slot back to an empty string
(src/accessibility/announceStore.ts:25-28; src/accessibility/announceStore.ts:34-38).
If a second message arrives before the timer fires, the pending timer is cancelled and
a fresh timer is started (src/accessibility/announceStore.ts:20; src/accessibility/announceStore.ts:30).

The two channels are fully independent: each has its own module-level timer variable
(`assertiveTimer`, `politeTimer`) (src/accessibility/announceStore.ts:12-13).

### Per-category preferences

The public `announce` function (src/accessibility/announceStore.ts:43-48) is the sole
entry point that callers outside the accessibility subsystem use. It accepts a message, an
`AnnounceCategory`, and an optional fallback priority (default `'polite'`).

Before queuing anything, `announce` reads the stored preference for that category
(src/accessibility/announceStore.ts:44). If the preference is `'off'`, the message is
silently dropped (src/accessibility/announceStore.ts:45). If it is `'assertive'` or
`'polite'`, that value is used as the channel. Otherwise the `fallbackPriority` argument
is used (src/accessibility/announceStore.ts:46).

Six categories exist: `vitals`, `chat`, `combat`, `room`, `feedback`, `prompt`
(src/stores/announcePrefsStore.ts:5).

Default preferences are:
- vitals: assertive (src/stores/announcePrefsStore.ts:10)
- chat: polite (src/stores/announcePrefsStore.ts:11)
- combat: assertive (src/stores/announcePrefsStore.ts:12)
- room: polite (src/stores/announcePrefsStore.ts:13)
- feedback: polite (src/stores/announcePrefsStore.ts:14)
- prompt: assertive (src/stores/announcePrefsStore.ts:15)

Preferences are persisted under the localStorage key `tapestry:announce-prefs`
(src/stores/announcePrefsStore.ts:7). On store initialisation the saved JSON is parsed
and merged over the defaults, so unknown future categories fall back gracefully
(src/stores/announcePrefsStore.ts:20-26). On every `setPref` call the full prefs object
is re-serialised and written back to localStorage (src/stores/announcePrefsStore.ts:40-44).

### Vital-alert state machine

`checkVitalAlerts` (src/accessibility/vitalAlerts.ts:55-59) accepts a snapshot of
`{ hp, maxHp, mana, maxMana, mv, maxMv }` and evaluates each vital independently via
`checkVital` (src/accessibility/vitalAlerts.ts:31-53).

Two module-level thresholds are defined:
- `LOW_THRESHOLD = 0.4` -- ratio at or below which a vital is considered low
  (src/accessibility/vitalAlerts.ts:12)
- `CRITICAL_THRESHOLD = 0.1` -- ratio at or below which a vital is considered critical
  (src/accessibility/vitalAlerts.ts:13)

Per-vital state (`{ low: boolean, critical: boolean }`) is tracked in a module-level
`state` record initialised to `false` for all three vitals (src/accessibility/vitalAlerts.ts:20-24).

Transition logic for each update:
- If ratio > LOW_THRESHOLD and either flag is set, both flags are cleared and the function
  returns without announcing (src/accessibility/vitalAlerts.ts:34-39). No announcement is
  made on recovery.
- If ratio <= CRITICAL_THRESHOLD and `critical` is not yet set, an assertive announcement
  is fired with the text `Warning: <name> critical at <pct> percent`, both `critical` and
  `low` flags are set to `true`, and the function returns
  (src/accessibility/vitalAlerts.ts:42-47).
- If ratio <= LOW_THRESHOLD and `low` is not yet set (but `critical` is not triggered),
  an assertive announcement fires with `<name> low at <pct> percent` and `low` is set to
  `true` (src/accessibility/vitalAlerts.ts:49-52).

Announcements are transition-only: once a flag is set, subsequent calls at the same or
worse ratio produce no further announcement until the vital recovers above
`LOW_THRESHOLD` and then drops again (src/accessibility/vitalAlerts.ts:34-52).

The `announce` call for vitals uses the `'vitals'` category and `'assertive'` as the
fallback priority (src/accessibility/vitalAlerts.ts:43; src/accessibility/vitalAlerts.ts:50).
When `maxHp` (or equivalent) is zero or negative, the ratio is treated as 1 (fully healthy)
to avoid division-by-zero (src/accessibility/vitalAlerts.ts:27-29).

### Keyboard shortcuts

Shortcuts are registered with `registerAllShortcuts` (src/accessibility/shortcuts/registerAll.ts:6-11)
which calls `useShortcutStore.getState().register` for each binding.

Three shortcuts are registered:
- `Alt+L` -- id `room-description`, label "Room description", handler `handleRoomDescription`
  (src/accessibility/shortcuts/registerAll.ts:8)
- `Alt+C` -- id `context-commands`, label "Context commands", handler `handleContextCommands`
  (src/accessibility/shortcuts/registerAll.ts:9)
- `Alt+H` -- id `help-topic`, label "Read help topic", handler `handleHelpTopic`
  (src/accessibility/shortcuts/registerAll.ts:10)

The shortcut store (src/stores/shortcutStore.ts:42-86) keeps a `Map<string, ShortcutEntry>`
at runtime. On `register`, if the id already exists the handler is updated but the key
binding and enabled state are preserved (src/stores/shortcutStore.ts:48-51). If the id is
new, any previously saved key for that id is read from localStorage key `tapestry:shortcuts`
and used in preference to the default key (src/stores/shortcutStore.ts:53-55). `rebind`
overwrites the key in the Map and persists the new binding to localStorage
(src/stores/shortcutStore.ts:68-77). `getByKey` returns the first enabled entry whose
stored key matches (src/stores/shortcutStore.ts:79-84).

#### Alt+L -- room description

`handleRoomDescription` (src/accessibility/shortcuts/roomDescription.ts:7-15) reads
`useRoomStore.getState().current`, strips markup from both the room name and description
via `stripMarkup`, removes a trailing period from the description, enumerates exit direction
keys, then queues an assertive announcement in the form
`<name>. <description>. Exits: <directions>.` or `<name>. <description>. No exits.`
(src/accessibility/shortcuts/roomDescription.ts:9-14).

`stripMarkup` removes ANSI escape sequences (both ESC-prefixed and bare bracket-form),
Tapestry `{tag}` color/style tags, and HTML-like `<tag>` tags
(src/accessibility/shortcuts/roomDescription.test.ts:101-120).

#### Alt+C -- context commands

`handleContextCommands` (src/accessibility/shortcuts/contextCommands.ts:68-72) reads
`useNearbyStore.getState().entities` and calls `buildContextAnnouncement`, then queues
the result assertively.

`buildContextAnnouncement` (src/accessibility/shortcuts/contextCommands.ts:17-66) classifies
each entity and groups them. Output order is: shops, trainers, quests, hostiles, players,
creatures (src/accessibility/shortcuts/contextCommands.ts:39-65).

- If no entities are present, the announcement is `No one nearby.`
  (src/accessibility/shortcuts/contextCommands.ts:18).
- Shop names are joined with `, ` and appended with ` -- list, buy, sell, value.`
  (src/accessibility/shortcuts/contextCommands.ts:40).
- Trainer names are appended with ` -- practice, train.`
  (src/accessibility/shortcuts/contextCommands.ts:43).
- Hostile entities with the same name are deduplicated and expressed as
  `<name> times <count>` when count > 1
  (src/accessibility/shortcuts/contextCommands.ts:49-55).

`buildContextHint` (src/accessibility/shortcuts/contextHint.ts:10-38) is a related utility
that produces a shorter summary string (e.g. "Shop and hostiles nearby.") suitable for
inline display. Players and untagged NPCs produce no output from this function
(src/accessibility/shortcuts/contextHint.ts:13-14; src/accessibility/shortcuts/contextHint.ts:24-25).
UNVERIFIED: where `buildContextHint` is called from; no call site was found in the files
listed for this capability.

#### Alt+H -- help topic

`handleHelpTopic` (src/accessibility/shortcuts/helpTopic.ts:4-22) is a no-op if the help
panel is not open or has no response loaded (src/accessibility/shortcuts/helpTopic.ts:5-6).

When the response status is `'ok'`, the announcement is assembled from the topic's syntax
list (prefixed `Syntax: `), body, and see-also list (prefixed `See also: `), joined with
`. `, then passed through `stripMarkup` before being pushed via `helpStore.pushAnnouncement`
(src/accessibility/shortcuts/helpTopic.ts:8-14).

When the response status is `'multiple'`, the announcement lists matching topic titles and
instructs the user to type `help [topic]` for details, or `help [category]` to browse if
no search term was present (src/accessibility/shortcuts/helpTopic.ts:15-20).

UNVERIFIED: Alt+H uses `helpStore.pushAnnouncement` rather than calling `announce` or
`pushMessage` directly. The routing of that call through the announce bus was not visible
in the files provided.

### Skip links and page load announcement

`SkipLinks` (src/accessibility/SkipLinks.tsx:5-48) renders a `<nav aria-label="Skip links">`
that is visually hidden but becomes visible when it receives keyboard focus via the
`focus-within` Tailwind utilities (src/accessibility/SkipLinks.tsx:29).

Two links are provided:
- "Skip to command input" -- a standard `href="#command-input"` anchor
  (src/accessibility/SkipLinks.tsx:30-35).
- "Announcement settings" -- intercepts click and Enter keydown to call
  `useSettingsStore.openSettings()` and then focus the element with id `announce-settings`
  via a `requestAnimationFrame` callback (src/accessibility/SkipLinks.tsx:20-25;
  src/accessibility/SkipLinks.tsx:36-45).

On first mount (guarded by a `useRef` flag so the effect runs exactly once),
`SkipLinks` waits 1000 ms then queues a polite announcement:
"Tapestry game loaded. Press F6 to cycle between command input and game panels."
(src/accessibility/SkipLinks.tsx:9-18). This bypasses `announce` and calls `pushMessage`
directly, so user category preferences do not suppress the load message.

## Rejected and Reverted

- None on record.

## Change Log

_No change records yet._
