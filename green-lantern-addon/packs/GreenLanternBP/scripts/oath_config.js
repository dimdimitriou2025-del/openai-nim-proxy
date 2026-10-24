// ============================================================================
//  GREEN LANTERN OATH - EDIT ME
// ============================================================================
// This is the only file you need to change to customise the oath players must
// type.  Keep one line per array entry; the lines are joined with spaces when
// the oath is checked, so players can type it on a single line.
//
// Validation rules (see core/oath.js):
//   * case-insensitive ("IN BRIGHTEST DAY" == "in brightest day")
//   * leading/trailing spaces, line breaks and repeated spaces are ignored
//   * punctuation is ignored unless STRICT_PUNCTUATION is true
//     (so "evils might" and "evil's might," both match)
//   * every word must be present, spelled correctly and in the right order
// ============================================================================

export const OATH_TITLE = "The Green Lantern Oath";

export const OATH_LINES = [
  "In brightest day, in blackest night,",
  "No evil shall escape my sight.",
  "Let those who worship evil's might,",
  "Beware my power, Green Lantern's light!",
];

// Set to true to require exact punctuation (commas, apostrophes, full stops).
export const STRICT_PUNCTUATION = false;

// Placeholder text shown inside the empty text box.
export const OATH_PLACEHOLDER = "In brightest day, in blackest night...";
