import type {
  FolderChild,
  Snapshot,
  Tile,
} from "../../../packages/shared/model";

function collect(
  snapshot: Snapshot,
): Map<string, { path: string; version: string }> {
  const refs = new Map<string, { path: string; version: string }>();
  const add = (tile: Tile | FolderChild) =>
    refs.set(tile.id, {
      path: tile.config.vaultPath,
      version: tile.config.vaultVersion,
    });
  for (const tile of snapshot.tiles) {
    add(tile);
    if (tile.type === "folder")
      for (const child of tile.config.children ?? []) add(child);
  }
  for (const tile of snapshot.archive) add(tile);
  return refs;
}

/**
 * Keep local edits that happened while a save was in flight, but adopt the
 * server-assigned vault metadata. Without this, the next save sends an empty
 * vaultPath and the server creates a duplicate Markdown file.
 */
export function mergeSavedSnapshot(
  local: Snapshot,
  sent: Snapshot,
  saved: Snapshot,
): Snapshot {
  const sentRefs = collect(sent);
  const savedRefs = collect(saved);

  const mergeRef = <T extends Tile | FolderChild>(tile: T): T => {
    const sentRef = sentRefs.get(tile.id);
    const savedRef = savedRefs.get(tile.id);
    if (!sentRef || !savedRef) return tile;
    // A local path/version different from the sent value is a newer user action.
    if (
      tile.config.vaultPath !== sentRef.path ||
      tile.config.vaultVersion !== sentRef.version
    )
      return tile;
    if (
      tile.config.vaultPath === savedRef.path &&
      tile.config.vaultVersion === savedRef.version
    )
      return tile;
    return {
      ...tile,
      config: {
        ...tile.config,
        vaultPath: savedRef.path,
        vaultVersion: savedRef.version,
      } as T["config"],
    };
  };

  return {
    ...local,
    revision: saved.revision,
    tiles: local.tiles.map((tile) => {
      const merged = mergeRef(tile);
      if (merged.type !== "folder") return merged;
      return {
        ...merged,
        config: {
          ...merged.config,
          children: (merged.config.children ?? []).map(mergeRef),
        },
      };
    }),
    archive: local.archive.map(mergeRef),
  };
}
