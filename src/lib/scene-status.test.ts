import { describe, expect, it } from "vitest";
import type { DocumentData, SceneStatus } from "$lib/publish/types";
import { countByStatus, nextSceneStatus, normalizeSceneStatus, statusLabel } from "./scene-status";
import { createStoredProject, projectsHaveSameContent } from "./storage/schema";
import { MemoryFileSystem } from "./storage/sync/memory-fs";
import { normalizeDocument, readOpenProject, writeOpenProject } from "./storage/sync/open-layout";
import type { ProjectData } from "./storage/types";

const scene = (id: string, extra: Partial<DocumentData> = {}): DocumentData => ({
  id,
  title: id,
  content: "<p>Text</p>",
  ...extra
});

describe("scene status", () => {
  it("cycles none, draft, revised, final and back to none", () => {
    expect(nextSceneStatus()).toBe("draft");
    expect(nextSceneStatus("draft")).toBe("revised");
    expect(nextSceneStatus("revised")).toBe("final");
    expect(nextSceneStatus("final")).toBeUndefined();
  });

  it("keeps known statuses and drops everything else", () => {
    expect(normalizeSceneStatus("draft")).toBe("draft");
    expect(normalizeSceneStatus("revised")).toBe("revised");
    expect(normalizeSceneStatus("final")).toBe("final");
    expect(normalizeSceneStatus("later")).toBeUndefined();
    expect(normalizeSceneStatus("")).toBeUndefined();
    expect(normalizeSceneStatus(null)).toBeUndefined();
    expect(normalizeSceneStatus(3)).toBeUndefined();
  });

  it("labels statuses, including scenes without one", () => {
    expect(statusLabel("draft")).toBe("Draft");
    expect(statusLabel("revised")).toBe("Revised");
    expect(statusLabel("final")).toBe("Final");
    expect(statusLabel()).toBe("No status");
  });

  it("counts live chapter scenes only", () => {
    const documents = [
      scene("draft", { chapterId: "c1", status: "draft" }),
      scene("revised", { chapterId: "c1", status: "revised" }),
      scene("final", { chapterId: "c1", status: "final" }),
      scene("unmarked", { chapterId: "c1" }),
      scene("trashed", { chapterId: "c1", status: "final", trashed: true }),
      scene("wiki", { status: "draft" })
    ];
    expect(countByStatus(documents)).toEqual({ draft: 1, revised: 1, final: 1 });
  });
});

describe("scene status in storage", () => {
  const project = (documents: DocumentData[]): ProjectData => ({
    id: "p1",
    name: "Novel",
    author: "A",
    activeDocumentId: "doc-1",
    projectGoal: 1000,
    chapterGoals: {},
    activity: {},
    chapters: [{ id: "c1", title: "One", expanded: true }],
    documents
  });

  it("counts as a change so backups and sync pick it up", () => {
    const before = project([scene("doc-1", { chapterId: "c1" })]);
    const after = project([scene("doc-1", { chapterId: "c1", status: "draft" })]);
    expect(projectsHaveSameContent(before, after)).toBe(false);
    expect(projectsHaveSameContent(after, project([scene("doc-1", { chapterId: "c1", status: "draft" })])))
      .toBe(true);
  });

  it("keeps a valid status on normalized documents and drops an invalid one", () => {
    expect(normalizeDocument(scene("doc-1", { status: "revised" })).status).toBe("revised");
    expect(normalizeDocument(scene("doc-2", { status: "later" as SceneStatus })))
      .not.toHaveProperty("status");
  });

  it("survives a round trip through the open folder layout", async () => {
    const fs = new MemoryFileSystem();
    const stored = createStoredProject(
      project([
        scene("doc-1", { chapterId: "c1", status: "revised" }),
        scene("doc-2", { chapterId: "c1" })
      ]),
      "device",
      10
    );
    await writeOpenProject(fs, stored);
    const entries = await fs.listDir("projects");
    const back = await readOpenProject(fs, entries[0].name, 20);
    const [first, second] = back.project.documents;
    expect(first.status).toBe("revised");
    expect(second).not.toHaveProperty("status");
  });
});
