interface FileSystemObserverRecord {
  changedHandle: FileSystemHandle;
  type: string;
}

interface FileSystemObserver {
  new (callback: (records: FileSystemObserverRecord[]) => void): FileSystemObserver;
  observe(
    handle: FileSystemDirectoryHandle,
    options?: { recursive?: boolean }
  ): Promise<void>;
  disconnect(): void;
}

type FileSystemPermissionMode = "read" | "readwrite";

interface FileSystemHandlePermissionDescriptor {
  mode?: FileSystemPermissionMode;
}

interface FileSystemDirectoryHandle {
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
  queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
}

interface Window {
  showDirectoryPicker?: (options?: { mode?: FileSystemPermissionMode }) => Promise<FileSystemDirectoryHandle>;
}

declare const FileSystemObserver: FileSystemObserver | undefined;
