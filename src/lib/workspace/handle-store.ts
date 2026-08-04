const DB_NAME = "lms-workspace";
const STORE = "handles";
const KEY = "workspace-root";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
  });
}

export async function saveWorkspaceHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(handle, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function loadWorkspaceHandle(): Promise<FileSystemDirectoryHandle | null> {
  const db = await openDb();
  const handle = await new Promise<FileSystemDirectoryHandle | null>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(KEY);
    req.onsuccess = () => resolve((req.result as FileSystemDirectoryHandle) ?? null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return handle;
}

export async function clearWorkspaceHandle(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

/** Read-only check — safe to call without a user gesture (e.g. on page load). */
export async function hasHandlePermission(
  handle: FileSystemDirectoryHandle,
  mode: FileSystemPermissionMode = "read"
): Promise<boolean> {
  return (await handle.queryPermission({ mode })) === "granted";
}

/**
 * Ensures permission is granted. May call `requestPermission`, which browsers
 * only allow inside a transient user activation (click / tap). Callers that
 * run on mount should use `hasHandlePermission` instead.
 */
export async function verifyHandlePermission(
  handle: FileSystemDirectoryHandle,
  mode: FileSystemPermissionMode = "read"
): Promise<boolean> {
  if (await hasHandlePermission(handle, mode)) return true;
  try {
    const requested = await handle.requestPermission({ mode });
    return requested === "granted";
  } catch {
    // SecurityError: "User activation is required to request permissions."
    return false;
  }
}
