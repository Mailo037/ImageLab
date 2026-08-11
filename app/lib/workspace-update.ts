import type { Config, Format, ImageOperation } from "./processor";

export type UpdateWorkspaceFile = {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  width?: number;
  height?: number;
  status: "ready" | "failed";
  error?: string;
  outputSize?: number;
  outputFormat?: Format;
};

export type PersistedEditorSnapshot = {
  operations: ImageOperation[];
  selectedOperationId: string | null;
  config: Config;
  output: Pick<Config, "format" | "quality" | "targetKB">;
};

export type PendingUpdateWorkspace = {
  schema: 1;
  createdAt: number;
  targetUrl: string;
  workspaceId: string;
  files: UpdateWorkspaceFile[];
  active: string | null;
  selected: string[];
  toolId: string;
  config: Config;
  output: Pick<Config, "format" | "quality" | "targetKB">;
  operations: ImageOperation[];
  selectedOperationId: string | null;
  undo: PersistedEditorSnapshot[];
  redo: PersistedEditorSnapshot[];
  zoom: number;
  pan: { x: number; y: number };
  compare: boolean;
  selectedMask: string | null;
};

const databaseName = "imagelab-local-workspaces";
const storeName = "pending-updates";
const recordKey = "latest";
const fallbackKey = "imagelab:pending-update-workspace";
const maxAge = 30 * 60 * 1000;

const openDatabase = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open(databaseName, 1);
  request.onupgradeneeded = () => request.result.createObjectStore(storeName);
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error("Could not open local update storage."));
});

const withoutFiles = (workspace: PendingUpdateWorkspace): PendingUpdateWorkspace => ({ ...workspace, files: [] });

export async function savePendingUpdateWorkspace(workspace: PendingUpdateWorkspace) {
  if (typeof window === "undefined") return "none" as const;
  try {
    const database = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(storeName, "readwrite");
      transaction.objectStore(storeName).put(workspace, recordKey);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Could not save the workspace."));
    });
    database.close();
    sessionStorage.removeItem(fallbackKey);
    return "indexeddb" as const;
  } catch {
    try {
      sessionStorage.setItem(fallbackKey, JSON.stringify(withoutFiles(workspace)));
      return "session" as const;
    } catch {
      return "none" as const;
    }
  }
}

export async function consumePendingUpdateWorkspace(): Promise<PendingUpdateWorkspace | null> {
  if (typeof window === "undefined") return null;
  let workspace: PendingUpdateWorkspace | null = null;
  try {
    const database = await openDatabase();
    workspace = await new Promise<PendingUpdateWorkspace | null>((resolve, reject) => {
      const transaction = database.transaction(storeName, "readwrite");
      const request = transaction.objectStore(storeName).get(recordKey);
      request.onsuccess = () => {
        const result = request.result as PendingUpdateWorkspace | undefined;
        transaction.objectStore(storeName).delete(recordKey);
        resolve(result ?? null);
      };
      request.onerror = () => reject(request.error ?? new Error("Could not restore the workspace."));
    });
    database.close();
  } catch {
    try {
      const raw = sessionStorage.getItem(fallbackKey);
      sessionStorage.removeItem(fallbackKey);
      workspace = raw ? JSON.parse(raw) as PendingUpdateWorkspace : null;
    } catch {
      workspace = null;
    }
  }
  if (!workspace || workspace.schema !== 1 || Date.now() - workspace.createdAt > maxAge) return null;
  return workspace;
}

