// Hunger/sustenance tier math, mirrored client-side.
//
// SOURCE OF TRUTH: @tapestry/survival pack -> scripts/sustenance.js (getTier).
//   TIER_FULL_MIN   = 67  (>= 67        -> 'full')
//   TIER_HUNGRY_MIN = 34  (>= 34        -> 'hungry')
//                         (otherwise    -> 'famished')
// The survival extraction dropped hungerTier from the GMCP Char.Status payload,
// so the client derives the tier from the raw `hungerValue` (sustenance 0-100).
// Keep these thresholds in sync with the pack if they ever change there.
const TIER_FULL_MIN = 67
const TIER_HUNGRY_MIN = 34

/**
 * Derive the hunger tier from a raw sustenance value (0-100).
 * Returns '' when the value is absent (older servers that don't send hungerValue),
 * so callers render no hunger label rather than a misleading default.
 */
export function hungerTierFromValue(value: number | null | undefined): string {
  if (value === null || value === undefined) { return '' }
  if (value >= TIER_FULL_MIN) { return 'full' }
  if (value >= TIER_HUNGRY_MIN) { return 'hungry' }
  return 'famished'
}
