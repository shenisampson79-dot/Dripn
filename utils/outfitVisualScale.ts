/** Scale large outfit stacks to fit modal/detail cards while keeping pieces readable. */
export function computeOutfitVisualScaleForModal(pieceCount: number): number {
  const TARGET_HEIGHT = 400;
  const naturalHeights: Record<number, number> = {
    1: 200,
    2: 340,
    3: 500,
    4: 660,
    5: 780,
    6: 900,
  };
  const count = Math.min(Math.max(pieceCount, 1), 6);
  const natural = naturalHeights[count] ?? 900;
  const raw = TARGET_HEIGHT / natural;
  return Math.round(Math.max(0.54, Math.min(0.88, raw)) * 100) / 100;
}
