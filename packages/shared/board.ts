import type { Tile } from "./model";

/** Uses the whole viewport: column width and row height adapt independently. */
export function fitBoard(
  tiles: Pick<Tile, "y" | "h">[],
  availableWidth: number,
  availableHeight: number,
  requestedGap: number,
  grid?: { columns: number; rows: number },
) {
  const width = Math.max(1, availableWidth);
  const height = Math.max(1, availableHeight);
  const columns = grid?.columns ?? 6;
  const rows =
    grid?.rows ?? Math.max(1, ...tiles.map((tile) => tile.y + tile.h));
  const density = Math.min(1, height / (rows * 160), width / (columns * 120));
  const gap = Math.min(
    requestedGap * density,
    height / (rows * 2),
    width / (columns * 2),
  );
  const cellWidth = (width - gap * (columns - 1)) / columns;
  const cellHeight = (height - (rows - 1) * gap) / rows;
  return { width, height, cellWidth, cellHeight, columns, rows, gap, density };
}
