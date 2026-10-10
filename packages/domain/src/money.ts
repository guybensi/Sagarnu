/** Money is always an integer number of agorot (1 ₪ = 100 agorot). */
export type Agorot = number;

/** Parses user input like "12,500" or "1250.5" into agorot. Returns null for invalid input. */
export function shekelsToAgorot(input: string | number): Agorot | null {
  const text = String(input).replace(/[,\s₪]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const [whole = "0", frac = ""] = text.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export function agorotToShekels(value: Agorot): number {
  return value / 100;
}

export function sumAgorot(values: readonly Agorot[]): Agorot {
  return values.reduce((acc, v) => acc + v, 0);
}
