import { angleDelta, clockAngle, dialFractions, dialSteps } from '@/features/add/dial';
import { hitTest, placeMain, placeSubs, radialRadii } from '@/features/nav/radial';

describe('amount dial', () => {
  it('uses ₺100 / ₺1 rings for lira and $10 / $0.10 for dollars', () => {
    expect(dialSteps('TRY')).toEqual({ big: 10000, small: 100 });
    expect(dialSteps('USD')).toEqual({ big: 1000, small: 10 });
    expect(dialSteps('JPY')).toEqual({ big: 1000, small: 10 });
  });

  it('places the knobs like the design (₺1.250 → outer 0.25, inner 0.5)', () => {
    const f = dialFractions(125000, dialSteps('TRY'));
    expect(f.outer).toBeCloseTo(0.25);
    expect(f.inner).toBeCloseTo(0.5);
  });

  it('measures angles clockwise from the top and unwraps across 0°', () => {
    expect(clockAngle(0, 0, 0, -10)).toBeCloseTo(0);
    expect(clockAngle(0, 0, 10, 0)).toBeCloseTo(90);
    expect(angleDelta(350, 10)).toBeCloseTo(20);
    expect(angleDelta(10, 350)).toBeCloseTo(-20);
  });
});

describe('radial category menu', () => {
  const anchor = { x: 195, y: 737 };
  const radii = radialRadii(390);
  const items = [
    { id: 'market', children: [] },
    { id: 'food', children: [] },
    { id: 'bills', children: [{ id: 'power' }, { id: 'water' }, { id: 'gas' }] },
    { id: 'transport', children: [] },
  ];

  it('spreads the main items over the upper arc', () => {
    const placed = placeMain(anchor, items.length, radii.main);
    expect(placed[0].angle).toBe(198);
    expect(placed[placed.length - 1].angle).toBe(342);
    for (const p of placed) expect(p.y).toBeLessThan(anchor.y);
  });

  it('treats the area around the orb as cancel', () => {
    expect(hitTest(anchor, { x: anchor.x + 10, y: anchor.y - 20 }, items, radii, { main: null, sub: null })).toEqual({ main: null, sub: null });
  });

  it('picks the nearest main item, then its sub-items further out', () => {
    const placed = placeMain(anchor, items.length, radii.main);
    const bills = placed[2];
    const onBills = hitTest(anchor, { x: bills.x, y: bills.y }, items, radii, { main: null, sub: null });
    expect(onBills).toEqual({ main: 'bills', sub: null });

    const subs = placeSubs(anchor, bills.angle, 3, radii.sub);
    const onWater = hitTest(anchor, { x: subs[1].x, y: subs[1].y }, items, radii, onBills);
    expect(onWater).toEqual({ main: 'bills', sub: 'water' });
  });
});
