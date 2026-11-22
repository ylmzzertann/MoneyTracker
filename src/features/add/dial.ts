import { currencyDecimals } from '@/lib/money';

/**
 * Step sizes of the two dial rings in minor units. The outer ring moves in
 * large steps (₺100, $10…), the inner ring in 1/100 of that (₺1, $0.10…).
 */
export function dialSteps(currency: string): { big: number; small: number } {
  const bigMajor: Record<string, number> = { TRY: 100, JPY: 1000, KRW: 10000, HUF: 1000, ISK: 1000, IDR: 10000, INR: 100 };
  const major = bigMajor[currency] ?? 10;
  const big = major * 10 ** currencyDecimals(currency);
  return { big, small: Math.max(1, Math.round(big / 100)) };
}

/** Where each ring's knob sits (0–1 of a turn) for an amount. */
export function dialFractions(minor: number, steps: { big: number; small: number }) {
  return {
    outer: ((minor / steps.big) % 10) / 10,
    inner: (minor % steps.big) / steps.big,
  };
}

/** Degrees of rotation for one step: 10 big steps or 100 small steps per full turn. */
export const STEP_DEGREES = { outer: 36, inner: 3.6 } as const;

/** Signed smallest difference between two angles in degrees, in (-180, 180]. */
export function angleDelta(from: number, to: number): number {
  let d = (to - from) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

/** Angle of a point around a centre, 0° at the top, clockwise. */
export function clockAngle(cx: number, cy: number, x: number, y: number): number {
  return ((Math.atan2(y - cy, x - cx) * 180) / Math.PI + 450) % 360;
}
