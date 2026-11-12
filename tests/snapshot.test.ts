import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createTile,
  type FolderChild,
  type Snapshot,
} from "../packages/shared/model";
import { seedDesktop } from "../packages/shared/seed";
import { mergeSavedSnapshot } from "../apps/web/src/snapshot";

const base = seedDesktop();
const sent = {
  ...base,
  revision: 1,
  tiles: [],
  archive: [],
} satisfies Snapshot;

test("seed titles stay on one Markdown heading line", () => {
  for (const tile of base.tiles.filter(
    (item) => item.type === "text" || item.type === "data",
  ))
    assert.equal(tile.title.includes("\n"), false, tile.title);
});

test("a save in flight adopts the vault path and version assigned by the server", () => {
  const note = createTile("text", [], undefined, base.settings.maxTiles);
  note.title = "Idea";
  const sentNote = structuredClone(note);
  const saved = {
    ...sent,
    revision: 2,
    tiles: [
      {
        ...note,
        config: {
          ...note.config,
          vaultPath: "Idea.md",
          vaultVersion: "a".repeat(64),
        },
      },
    ],
  };
  const local = {
    ...sent,
    tiles: [
      { ...sentNote, subtitle: "Modifica locale durante il salvataggio" },
    ],
  };
  const merged = mergeSavedSnapshot(
    local,
    { ...sent, tiles: [sentNote] },
    saved,
  );
  assert.equal(merged.revision, 2);
  assert.equal(
    merged.tiles[0].subtitle,
    "Modifica locale durante il salvataggio",
  );
  assert.equal(merged.tiles[0].config.vaultPath, "Idea.md");
  assert.equal(merged.tiles[0].config.vaultVersion, "a".repeat(64));
});

test("a newer local unlink is not overwritten by the in-flight save", () => {
  const note = createTile("text", [], undefined, base.settings.maxTiles);
  const sentNote = {
    ...note,
    config: {
      ...note.config,
      vaultPath: "Old.md",
      vaultVersion: "b".repeat(64),
    },
  };
  const localNote = {
    ...sentNote,
    config: { ...sentNote.config, vaultPath: "", vaultVersion: "" },
  };
  const saved = {
    ...sent,
    revision: 2,
    tiles: [sentNote],
  };
  const merged = mergeSavedSnapshot(
    { ...sent, tiles: [localNote] },
    { ...sent, tiles: [sentNote] },
    saved,
  );
  assert.equal(merged.tiles[0].config.vaultPath, "");
  assert.equal(merged.tiles[0].config.vaultVersion, "");
});

test("folder children receive the same server vault metadata", () => {
  const folder = createTile("folder", [], undefined, base.settings.maxTiles);
  const child = {
    ...createTile("text", [], undefined, base.settings.maxTiles),
    id: "child-note",
  } as FolderChild;
  const sentFolder = {
    ...folder,
    config: { ...folder.config, children: [child] },
  };
  const saved = {
    ...sent,
    revision: 2,
    tiles: [
      {
        ...sentFolder,
        config: {
          ...sentFolder.config,
          children: [
            {
              ...child,
              config: {
                ...child.config,
                vaultPath: "Cartella/Child.md",
                vaultVersion: "c".repeat(64),
              },
            },
          ],
        },
      },
    ],
  };
  const merged = mergeSavedSnapshot(
    { ...sent, tiles: [sentFolder] },
    { ...sent, tiles: [sentFolder] },
    saved,
  );
  const mergedChild = merged.tiles[0].config.children?.[0];
  assert.equal(mergedChild?.config.vaultPath, "Cartella/Child.md");
  assert.equal(mergedChild?.config.vaultVersion, "c".repeat(64));
});
