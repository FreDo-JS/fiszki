const UNITS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

// Parses simple duration strings like "15m", "30d", "500ms" into milliseconds.
export default function ms(input: string): number {
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(input.trim());
  if (!match) throw new Error(`Invalid duration string: ${input}`);
  const [, value, unit] = match;
  return parseInt(value, 10) * UNITS[unit];
}
