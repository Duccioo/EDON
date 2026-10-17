import { test } from "node:test";
import assert from "node:assert/strict";
import { fitBoard } from "../packages/shared/board";
import {
  createTile,
  desktopSchema,
  resizeGrid,
  arrangeTile,
} from "../packages/shared/model";
import { seedDesktop } from "../packages/shared/seed";

test("the whole board fits above the dock at common desktop sizes without changing saved positions", () => {
  const { tiles } = seedDesktop();
  const positions = tiles.map(({ x, y, w, h }) => ({ x, y, w, h }));
  for (const [width, height] of [
    [1360, 728],
    [1200, 548],
    [940, 428],
    [600, 548],
  ]) {
    for (const gap of [0, 8, 16, 40]) {
      for (const rows of [4, 6]) {
        const board = fitBoard(tiles, width, height, gap, { columns: 6, rows });
        assert.equal(board.width, width);
        assert.equal(board.height, height);
        assert.ok(
          Math.abs(board.cellWidth * 6 + board.gap * 5 - width) < 0.001,
        );
        assert.ok(
          Math.abs(
            board.cellHeight * board.rows +
              board.gap * (board.rows - 1) -
              height,
          ) < 0.001,
        );
        assert.ok(board.height <= height + 0.001);
        for (const tile of tiles)
          assert.ok(
            (tile.y + tile.h) * (board.cellHeight + board.gap) - board.gap <=
              height + 0.001,
          );
      }
    }
  }
  assert.deepEqual(
    tiles.map(({ x, y, w, h }) => ({ x, y, w, h })),
    positions,
  );
});

test("tile limits reject excess tiles, preserve old desktops and never silently remove contents", () => {
  const desktop = seedDesktop();
  const maxTiles = desktop.tiles.length;
  assert.throws(
    () => createTile("text", desktop.tiles, undefined, maxTiles),
    /limite/,
  );
  assert.equal(
    desktopSchema.safeParse({
      ...desktop,
      settings: { ...desktop.settings, maxTiles: maxTiles - 1 },
    }).success,
    false,
  );
  const next = createTile("text", desktop.tiles, undefined, maxTiles + 1);
  assert.equal(
    desktopSchema.safeParse({
      ...desktop,
      settings: { ...desktop.settings, maxTiles },
      tiles: [...desktop.tiles, next],
    }).success,
    false,
  );
  const { maxTiles: omitted, ...legacySettings } = desktop.settings;
  const legacy = desktopSchema.parse({ ...desktop, settings: legacySettings });
  assert.equal(legacy.settings.maxTiles, 24);
  assert.deepEqual(legacy.tiles, desktop.tiles);
  const manyTiles = Array.from({ length: 30 }, (_, i) => ({
    ...createTile("text", []),
    x: i % 6,
    y: Math.floor(i / 6),
  }));
  const largeLegacy = desktopSchema.parse({
    ...desktop,
    settings: legacySettings,
    tiles: manyTiles,
  });
  assert.equal(largeLegacy.settings.maxTiles, 30);
  assert.equal(largeLegacy.tiles.length, 30);
});

test("fixed columns and rows define the board including empty cells", () => {
  for (const columns of [2, 4, 8, 12]) {
    for (const rows of [2, 4, 6, 12]) {
      const board = fitBoard([], 1200, 600, 16, { columns, rows });
      assert.equal(board.columns, columns);
      assert.equal(board.rows, rows);
      assert.ok(
        Math.abs(board.cellWidth * columns + board.gap * (columns - 1) - 1200) <
          0.001,
      );
      assert.ok(
        Math.abs(board.cellHeight * rows + board.gap * (rows - 1) - 600) <
          0.001,
      );
    }
  }
});

test("grid changes reflow tiles without changing content, reject a grid that is too small and enforce movement bounds", () => {
  const desktop = seedDesktop();
  const grid = { columns: 4, rows: 6 };
  const tiles = resizeGrid(desktop.tiles, grid);
  assert.ok(tiles);
  assert.ok(
    desktopSchema.safeParse({
      ...desktop,
      settings: { ...desktop.settings, ...grid },
      tiles,
    }).success,
  );
  assert.deepEqual(
    tiles.map(({ x, y, ...t }) => t),
    desktop.tiles.map(({ x, y, ...t }) => t),
  );
  assert.equal(resizeGrid(desktop.tiles, { columns: 2, rows: 2 }), null);
  assert.equal(
    resizeGrid(desktop.tiles, { columns: 8, rows: 8 }),
    desktop.tiles,
  );
  assert.equal(arrangeTile(tiles, { ...tiles[0], x: 4 }, grid), null);
  assert.equal(arrangeTile(tiles, { ...tiles[0], y: 6 }, grid), null);
  assert.throws(
    () => createTile("link", tiles, undefined, 100, grid),
    /griglia/,
  );
  const { columns, rows, ...legacy } = desktop.settings;
  const migrated = desktopSchema.parse({ ...desktop, settings: legacy });
  assert.equal(migrated.settings.columns, 6);
  assert.equal(migrated.settings.rows, 4);
  assert.deepEqual(migrated.tiles, desktop.tiles);
});
