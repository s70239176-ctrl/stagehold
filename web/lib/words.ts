/**
 * Fallback codes are two common words, because models read words far more reliably than random
 * strings. This list MUST equal CODE_WORDS in contracts/src/body.py (lib/words.test.ts checks it).
 */
export const CODE_WORDS: readonly string[] = [
  "TREE", "BLUE", "FISH", "MOON", "STAR", "RAIN", "SAND", "WIND", "FIRE", "LEAF", "ROCK", "BIRD",
  "CORN", "GOAT", "DUCK", "BOAT", "DOOR", "ROAD", "SALT", "MILK", "BEAN", "LAMP", "KITE", "DRUM",
  "RING", "BELL", "CLAY", "WOOD", "IRON", "GOLD", "PINK", "GREY", "TEAK", "PALM", "RICE", "COW",
  "HEN", "SUN", "SKY", "HILL", "LAKE", "BEAR", "LION", "FROG", "SEED", "MAP", "KEY", "CUP",
  "PEN", "HAT", "EGG", "NET", "BOX", "BAG", "FAN", "JAR", "COIN", "BONE", "CAKE", "TENT",
  "FARM", "SHIP", "CART", "MANGO",
];

/** A payer-chosen code: two different words. (The contract also accepts any 4-16 character A-Z/0-9 code.) */
export function suggestCode(random: () => number = Math.random): string {
  const a = Math.floor(random() * CODE_WORDS.length);
  let b = Math.floor(random() * CODE_WORDS.length);
  if (b === a) b = (b + 1) % CODE_WORDS.length;
  return `${CODE_WORDS[a]} ${CODE_WORDS[b]}`;
}

/** Same rule as the contract's _valid_code. */
export function validCode(code: string): boolean {
  return (
    code.length >= 4 &&
    code.length <= 16 &&
    /^[A-Z0-9 ]+$/.test(code) &&
    code === code.trim() &&
    !code.includes("  ")
  );
}
