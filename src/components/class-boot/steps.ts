export type ClassBootMode = "create" | "import" | "open";

export type ClassBootStepId = "create" | "open" | "editor" | "sync";

export type ClassBootStep = {
  id: ClassBootStepId;
  label: string;
  /** Copy used when the class comes from a markdown import. */
  importLabel?: string;
  /** Copy used when opening an existing class. */
  openLabel?: string;
  /** Progress the bar eases toward while this step is the active one. */
  target: number;
};

/**
 * Shared step machine for create / import / open. The first step's copy
 * changes by mode; later steps are the same waits (route, editor chunk, Yjs).
 */
export const CLASS_BOOT_STEPS: ClassBootStep[] = [
  {
    id: "create",
    label: "Creating your class",
    importLabel: "Reading your markdown",
    openLabel: "Finding the class",
    target: 26,
  },
  {
    id: "open",
    label: "Preparing the workspace",
    openLabel: "Opening the workspace",
    target: 52,
  },
  { id: "editor", label: "Loading the editor", target: 76 },
  { id: "sync", label: "Syncing your notes", target: 93 },
];

export function stepLabel(step: ClassBootStep, mode: ClassBootMode): string {
  if (mode === "import" && step.importLabel) return step.importLabel;
  if (mode === "open" && step.openLabel) return step.openLabel;
  return step.label;
}

export function bootEyebrow(mode: ClassBootMode): string {
  if (mode === "import") return "Importing class";
  if (mode === "open") return "Opening class";
  return "New class";
}

export function stepIndexOf(id: ClassBootStepId): number {
  return CLASS_BOOT_STEPS.findIndex((step) => step.id === id);
}
