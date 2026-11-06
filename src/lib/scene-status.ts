import { SCENE_STATUSES, type DocumentData, type SceneStatus } from "$lib/publish/types";

const STATUS_LABELS: Record<SceneStatus, string> = {
  draft: "Draft",
  revised: "Revised",
  final: "Final"
};

/** Cycles a scene through the status values; the status after `final` is none. */
export function nextSceneStatus(current?: SceneStatus): SceneStatus | undefined {
  return SCENE_STATUSES[SCENE_STATUSES.indexOf(current as SceneStatus) + 1];
}

/** Accepts stored data of unknown shape and keeps only known statuses. */
export function normalizeSceneStatus(value: unknown): SceneStatus | undefined {
  return SCENE_STATUSES.includes(value as SceneStatus) ? value as SceneStatus : undefined;
}

/** Counts statuses of live chapter scenes; scenes without a status are not counted. */
export function countByStatus(
  documents: readonly Pick<DocumentData, "chapterId" | "trashed" | "status">[]
): Record<SceneStatus, number> {
  const counts: Record<SceneStatus, number> = { draft: 0, revised: 0, final: 0 };
  for (const document of documents) {
    if (!document.chapterId || document.trashed) continue;
    const status = normalizeSceneStatus(document.status);
    if (status) counts[status] += 1;
  }
  return counts;
}

export function statusLabel(status?: SceneStatus): string {
  return status ? STATUS_LABELS[status] ?? "No status" : "No status";
}
