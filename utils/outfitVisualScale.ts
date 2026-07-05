/**
 * Scale large outfit stacks to fill the modal outfit area while keeping the full look visible.
 */
export function computeOutfitVisualScaleForModal(
  pieceCount: number,
  windowHeight = 800,
): number {
  const sheetHeight = windowHeight * 0.88;
  // Room for header, title, description, and "Full outfit" label
  const outfitBudget = Math.max(420, Math.min(560, sheetHeight - 200));

  const naturalHeights: Record<number, number> = {
    1: 190,
    2: 320,
    3: 470,
    4: 620,
    5: 740,
    6: 860,
  };

  const count = Math.min(Math.max(pieceCount, 1), 6);
  const natural = naturalHeights[count] ?? 860;
  const raw = outfitBudget / natural;

  return Math.round(Math.max(0.62, Math.min(0.98, raw)) * 100) / 100;
}
