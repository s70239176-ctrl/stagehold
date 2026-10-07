/** GEN has 18 decimals. All contract amounts are in the smallest unit (wei); the interface speaks in GEN. */
const UNIT = 10n ** 18n;

/** "0.25" -> 250000000000000000n. Returns null for anything that is not a plain decimal with at most 18 places. */
export function parseGen(text: string): bigint | null {
  const t = text.trim().replace(/,/g, "");
  if (!/^\d+(\.\d{1,18})?$/.test(t)) return null;
  const [whole = "0", frac = ""] = t.split(".");
  return BigInt(whole) * UNIT + BigInt(frac.padEnd(18, "0"));
}

/** 1250250000000000000000n -> "1,250.25". Tiny non-zero amounts show as "<0.0001". */
export function formatGen(value: bigint | string | number, maxDecimals = 4): string {
  const wei = typeof value === "bigint" ? value : BigInt(value);
  const whole = wei / UNIT;
  const frac = (wei % UNIT).toString().padStart(18, "0").slice(0, maxDecimals).replace(/0+$/, "");
  if (wei > 0n && whole === 0n && frac === "") return `<0.${"0".repeat(maxDecimals - 1)}1`;
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return frac ? `${grouped}.${frac}` : grouped;
}

export const withUnit = (value: bigint | string | number): string => `${formatGen(value)} GEN`;

export const sumWei = (values: Array<bigint | string>): bigint => values.reduce<bigint>((a, v) => a + BigInt(v), 0n);
