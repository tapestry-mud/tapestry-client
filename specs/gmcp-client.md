---
capability: gmcp-client
last-updated: 2026-06-13
---

# GMCP Client

## Overview

The GMCP subsystem receives typed server packets over a WebSocket connection, routes each
packet to a registered handler by package name, validates the payload against a Zod schema,
and writes parsed data into Zustand stores. All core handlers are registered in a single
`initCoreHandlers` call. Third-party packs extend the system through `PackRegistry`, which
delegates GMCP handler registration to `GmcpDispatcher` and also registers UI panels and
hotbar defaults from a `PackManifest`.

## Behavior

### Dispatcher

`GmcpDispatcher` is a singleton object with three methods
(src/connection/GmcpDispatcher.ts:46-80).

- `register(pkg, handler)` stores the handler in a `Map<string, GmcpHandler>` keyed on the
  package name string. Re-registering the same key replaces the previous handler silently
  (src/connection/GmcpDispatcher.ts:47-49;
  src/connection/GmcpDispatcher.test.ts:25-33).

- `dispatch(pkg, data)` looks up the package key and invokes the handler if present
  (src/connection/GmcpDispatcher.ts:51-56). If no handler is found and the package name
  begins with `Response.`, the dispatcher falls through to the `Response.Feedback` handler,
  provided that handler is registered and the payload contains a string `message` field; it
  synthesises a feedback envelope with `status: 'ok'`, `type: 'info'`, and
  `category: 'general'` (src/connection/GmcpDispatcher.ts:58-70). Any remaining unhandled
  package logs a debug message in development builds and is otherwise silently discarded
  (src/connection/GmcpDispatcher.ts:72-74).

- `clear()` empties the handler map, used between test cases and on reconnection
  (src/connection/GmcpDispatcher.ts:77-79).

### Zod validation pattern

Every handler that accepts a structured payload calls `Schema.safeParse(data)`. On success it
writes to the relevant store. On failure it calls
`useDebugStore.getState().logConnection('gmcp-parse-error', '<PackageName>')` and does nothing
further -- no exception is thrown, no announce is emitted
(src/connection/GmcpDispatcher.ts:87-95; see pattern repeated at lines 98-106, 108-115, and
throughout the file).

### Core handlers

All handlers below are registered by `initCoreHandlers`
(src/connection/GmcpDispatcher.ts:84).

**Char.Vitals** (src/connection/GmcpDispatcher.ts:86-95)
Validates against `CharVitalsSchema` (src/types/gmcp.ts:3-10). On success calls
`useCharStore.updateVitals`, then calls `checkVitalAlerts` with the updated hp/mana/mv
values.

**Char.Status** (src/connection/GmcpDispatcher.ts:97-106)
Validates against `CharStatusSchema` (src/types/gmcp.ts:13-31). On success calls
`useCharStore.updateStatus`, then triggers `useRoomStore.loadMapForCharacter` and
`useLayoutStore.loadLayoutForCharacter` using the character name from the payload.

**Char.Commands** (src/connection/GmcpDispatcher.ts:108-115)
Validates against `CharCommandsSchema` (src/types/gmcp.ts:44-52). On success calls
`useCommandsStore.setCommands`.

**Char.StatusVars** (src/connection/GmcpDispatcher.ts:117-119)
Receives the payload but performs no store update; it only logs the packet to the debug
store via `logGmcp`. No Zod validation is applied.

**Char.Experience** (src/connection/GmcpDispatcher.ts:121-128)
Validates against `CharExperienceSchema` (src/types/gmcp.ts:33-42). On success calls
`useXpStore.setTracks`.

**Char.Effects** (src/connection/GmcpDispatcher.ts:130-145)
Validates against `CharEffectsSchema` (src/types/gmcp.ts:54-63). On success maps each
effect to `{ id, name, duration: remainingPulses, type, flags }` and calls
`useAffectsStore.setAffects`.

**Char.Combat.Target** (src/connection/GmcpDispatcher.ts:147-158)
Validates against `CharCombatTargetSchema` (src/types/gmcp.ts:65-71). On success calls
`useCombatTargetStore.update`. If the target is active and `healthTier` has changed since
the last packet, calls `announce` with the target name and health description at `'polite'`
urgency.

**Char.Combat.Targets** (src/connection/GmcpDispatcher.ts:160-173)
Validates against `CharCombatTargetsSchema` (src/types/gmcp.ts:73-82). On success calls
`useCombatTargetsStore.update`. Announces combat start (`'assertive'`) when the previous
target list was empty and the new list is non-empty, and announces combat end when the new
list is empty and the previous list was non-empty.

**Room.Nearby** (src/connection/GmcpDispatcher.ts:192-200)
Validates against `RoomNearbySchema` (src/types/gmcp.ts:103-115). On success calls
`useNearbyStore.setEntities` and stores the result of `buildContextHint` in the
module-level `pendingContextHint` variable to be consumed by the next `Room.Info` dispatch.

**Room.Info** (src/connection/GmcpDispatcher.ts:175-190)
Validates against `RoomInfoSchema` (src/types/gmcp.ts:87-101). On success calls
`useRoomStore.updateRoom`, then announces the room name and exits string. If
`pendingContextHint` is non-empty it is appended to the announcement; the hint is always
cleared after the announce regardless of content
(src/connection/GmcpDispatcher.ts:181-186;
src/connection/GmcpDispatcher.test.ts:162-173).

**Room.WrongDir** (src/connection/GmcpDispatcher.ts:202-205)
Accepts any payload (no Zod validation). Calls `useRoomStore.removeExit` with
`lastDirection` from the store if `lastDirection` is set, correcting stale exit data when
the server rejects a move.

**World.Time** (src/connection/GmcpDispatcher.ts:207-214)
Validates against `WorldTimeSchema` (src/types/gmcp.ts:117-122). On success calls
`useWorldStore.setTime`.

**World.Weather** (src/connection/GmcpDispatcher.ts:216-223)
Validates against `WorldWeatherSchema` (src/types/gmcp.ts:124-125). On success calls
`useWorldStore.setWeather` with the `state` string.

**World.Display.Colors** (src/connection/GmcpDispatcher.ts:225-232)
Validates against `WorldDisplayColorsSchema` (src/types/gmcp.ts:127-130). On success calls
`useDisplayStore.setColorMap` with the colors record.

**Char.Items** (src/connection/GmcpDispatcher.ts:234-241)
Validates against `CharItemsSchema` (src/types/gmcp.ts:132-144). On success calls
`useInventoryStore.setItems`.

**Char.Equipment** (src/connection/GmcpDispatcher.ts:243-250)
Validates against `CharEquipmentSchema` (src/types/gmcp.ts:155-158). On success calls
`useEquipmentStore.setEquipment` with the slots record.

**Comm.Channel** (src/connection/GmcpDispatcher.ts:252-260)
Validates against `CommChannelSchema` (src/types/gmcp.ts:160-165). On success calls
`useChatStore.addMessage` and announces `"<sender> on <channel>: <text>"` to the `'chat'`
channel.

**Char.Login.Phase** (src/connection/GmcpDispatcher.ts:262-269)
Validates against `LoginPhaseSchema` (src/types/gmcp.ts:214-217). On success calls
`useConnectionStore.setLoginPhase`. Valid phases are `'name'`, `'password'`,
`'creating'`, and `'playing'`.

**Login.Prompt** (src/connection/GmcpDispatcher.ts:271-278)
Validates against `LoginPromptSchema` (src/types/gmcp.ts:220-223). On success announces
the prompt string to the `'prompt'` channel.

**Flow.Step** (src/connection/GmcpDispatcher.ts:280-295)
Validates against `FlowStepSchema` (src/types/gmcp.ts:225-233). On success, if the type
is `'choice'` and options are present, constructs a numbered option list (appending
`tagLine` when available) and announces the combined prompt and list with a screen-reader
affordance for detail queries. For other step types, announces the prompt directly.

**Flow.Help** (src/connection/GmcpDispatcher.ts:297-304)
Validates against `FlowHelpSchema` (src/types/gmcp.ts:235-238). On success announces the
text to the `'prompt'` channel.

**Response.Feedback** (src/connection/GmcpDispatcher.ts:308-315)
Validates against `ResponseFeedbackSchema` (src/types/responseGmcp.ts:6-11). On success
announces the message to the `'feedback'` channel. Also serves as the fall-through target
for unregistered `Response.*` packages that carry a `message` field
(src/connection/GmcpDispatcher.ts:58-70).

**Response.Shop.List** (src/connection/GmcpDispatcher.ts:318-329)
Validates against `ResponseShopListSchema` (src/types/responseGmcp.ts:25-31). Announces a
summary: either `"<shopkeeper> has nothing for sale."` or `"<shopkeeper> sells N item(s)."`.

**Response.Shop.Buy** (src/connection/GmcpDispatcher.ts:332-339)
Validates against `ResponseShopBuySchema` (src/types/responseGmcp.ts:36-43). Announces the
`message` field.

**Response.Shop.Sell** (src/connection/GmcpDispatcher.ts:342-349)
Validates against `ResponseShopSellSchema` (src/types/responseGmcp.ts:48-55). Announces the
`message` field.

**Response.Shop.Value** (src/connection/GmcpDispatcher.ts:352-359)
Validates against `ResponseShopValueSchema` (src/types/responseGmcp.ts:60-67). Announces
the `message` field.

**Response.Training.Practice** (src/connection/GmcpDispatcher.ts:362-377)
Validates against `ResponseTrainingPracticeSchema` (src/types/responseGmcp.ts:80-87).
Announces "No abilities to practice." when the list is empty, or a summary of the first
three ability names (plus a count of remaining) and an optional trainer note.

**Response.Training.Train** (src/connection/GmcpDispatcher.ts:380-391)
Validates against `ResponseTrainingTrainSchema` (src/types/responseGmcp.ts:92-99).
Announces `message` when present, otherwise announces `"Trains available: N."` when
`trainsRemaining` is non-null.

**Response.Char.Score** (src/connection/GmcpDispatcher.ts:394-403)
Validates against `ResponseCharScoreSchema` (src/types/responseGmcp.ts:103-126).
Announces a single-line summary: name, level, race, class, HP, Mana, and gold.

**Response.Look** (src/connection/GmcpDispatcher.ts:406-424)
Validates against `ResponseLookSchema` (src/types/responseGmcp.ts:142-155). For type
`'room'`: announces name, exits string, and entity names if any. For other types announces
`"<name>: <description>"`.

**Response.Help** (src/connection/GmcpDispatcher.ts:427-437)
Validates against `ResponseHelpSchema` (src/types/responseGmcp.ts:170-178), a
discriminated union on `status`. On `'ok'` or `'multiple'` calls
`useHelpStore.openHelp` with the parsed data. On `'no_match'` does nothing (the server
has already sent a plain-text message via the telnet stream).

### Pack registry extension point

`PackRegistry.register(manifest)` accepts a `PackManifest`
(src/types/pack.ts:15-20). It iterates `manifest.gmcpHandlers` and calls
`GmcpDispatcher.register` for each entry, forwarding the handler directly
(src/pack/registry.ts:8-11). This means pack handlers follow the same overwrite-on-re-register
semantics as core handlers, and can replace any existing registration including core ones.

The registry also merges `manifest.panels` into an ordered panel list (deduplicating by
`panel.id`, then sorting by `panel.order`) and populates empty hotbar slots from
`manifest.hotbarDefaults` without overwriting already-occupied slots
(src/pack/registry.ts:13-27; src/pack/registry.test.ts:36-47).

`PackRegistry.getPanels(zone)` returns all registered panels for a given zone string
(`'sidebar-top'` or `'sidebar-bottom'`) (src/pack/registry.ts:30-32; src/types/pack.ts:3-6).

`PackRegistry.clear()` truncates the panels array in place (src/pack/registry.ts:34-36). It
does not call `GmcpDispatcher.clear()`; callers that need a full reset must call both.

### Hunger-tier client-side derivation

The `Char.Status` payload schema accepts both `hungerTier` (string, nullish) and
`hungerValue` (number, nullish) (src/types/gmcp.ts:27-28). The `charStore.updateStatus`
method derives `hungerTier` by calling `hungerTierFromValue(data.hungerValue)` and falls
back to `data.hungerTier` only when that call returns an empty string -- which happens when
`hungerValue` is absent (src/stores/charStore.ts:49-52).

`hungerTierFromValue` implements a three-tier step function over a sustenance range of 0-100
(src/utils/hungerTier.ts:18-23):

- value >= 67: `'full'` (src/utils/hungerTier.ts:10; src/utils/hungerTier.test.ts:6)
- value >= 34: `'hungry'` (src/utils/hungerTier.ts:11; src/utils/hungerTier.test.ts:14)
- otherwise: `'famished'` (src/utils/hungerTier.test.ts:22)
- null or undefined: `''` -- renders no hunger label rather than a misleading default
  (src/utils/hungerTier.ts:19; src/utils/hungerTier.test.ts:30-31)

The thresholds mirror a server-side survival pack (`TIER_FULL_MIN = 67`,
`TIER_HUNGRY_MIN = 34`) and must be kept in sync manually if the server-side values change
(src/utils/hungerTier.ts:1-9).

## Rejected and Reverted

- None on record.

## Change Log

_No change records yet._
