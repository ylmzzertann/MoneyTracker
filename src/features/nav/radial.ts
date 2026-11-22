import { create } from 'zustand';

/**
 * Geometry and state for the "hold the orb, slide up" category menu.
 * Angles are in degrees with 270° pointing straight up (screen coordinates).
 */

export type RadialItem = { id: string; children: { id: string }[] };
export type Point = { x: number; y: number };
export type PlacedItem = { id: string; x: number; y: number; angle: number };

export const CANCEL_RADIUS = 56;

export function radialRadii(screenWidth: number) {
  const main = Math.min(165, screenWidth / 2 - 40);
  return { main, sub: main + 80 };
}

const toRad = (deg: number) => (deg * Math.PI) / 180;

export function placeMain(anchor: Point, count: number, radius: number): PlacedItem[] {
  if (count === 0) return [];
  const start = 198;
  const end = 342;
  const step = count > 1 ? (end - start) / (count - 1) : 0;
  return Array.from({ length: count }, (_, i) => {
    const angle = count > 1 ? start + step * i : 270;
    return { id: '', angle, x: anchor.x + radius * Math.cos(toRad(angle)), y: anchor.y + radius * Math.sin(toRad(angle)) };
  });
}

/** Sub-categories fan out on the outer ring around their parent's angle. */
export function placeSubs(anchor: Point, parentAngle: number, count: number, radius: number): PlacedItem[] {
  const spacing = 15;
  const span = spacing * (count - 1);
  const first = Math.min(Math.max(parentAngle - span / 2, 192), 348 - span);
  return Array.from({ length: count }, (_, i) => {
    const angle = first + spacing * i;
    return { id: '', angle, x: anchor.x + radius * Math.cos(toRad(angle)), y: anchor.y + radius * Math.sin(toRad(angle)) };
  });
}

const angularDistance = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

export type Hover = { main: string | null; sub: string | null };

/** Which item the finger is over. Close to the orb means "cancel". */
export function hitTest(
  anchor: Point,
  finger: Point,
  items: RadialItem[],
  radii: { main: number; sub: number },
  current: Hover,
): Hover {
  const dx = finger.x - anchor.x;
  const dy = finger.y - anchor.y;
  const dist = Math.hypot(dx, dy);
  if (dist < CANCEL_RADIUS || items.length === 0) return { main: null, sub: null };
  const angle = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;

  const mains = placeMain(anchor, items.length, radii.main);
  const parent = items.find((i) => i.id === current.main);
  if (parent && parent.children.length > 0 && dist > (radii.main + radii.sub) / 2) {
    const parentAngle = mains[items.indexOf(parent)].angle;
    const subs = placeSubs(anchor, parentAngle, parent.children.length, radii.sub);
    let best = 0;
    subs.forEach((s, i) => {
      if (angularDistance(s.angle, angle) < angularDistance(subs[best].angle, angle)) best = i;
    });
    return { main: parent.id, sub: parent.children[best].id };
  }

  let best = 0;
  mains.forEach((m, i) => {
    if (angularDistance(m.angle, angle) < angularDistance(mains[best].angle, angle)) best = i;
  });
  return { main: items[best].id, sub: null };
}

type RadialState = {
  open: boolean;
  anchor: Point;
  hover: Hover;
  show: (anchor: Point) => void;
  setHover: (hover: Hover) => void;
  close: () => void;
};

export const useRadial = create<RadialState>((set) => ({
  open: false,
  anchor: { x: 0, y: 0 },
  hover: { main: null, sub: null },
  show: (anchor) => set({ open: true, anchor, hover: { main: null, sub: null } }),
  setHover: (hover) => set({ hover }),
  close: () => set({ open: false, hover: { main: null, sub: null } }),
}));
