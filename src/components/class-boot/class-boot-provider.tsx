"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ClassBootOverlay } from "./class-boot-overlay";
import {
  CLASS_BOOT_STEPS,
  stepIndexOf,
  type ClassBootMode,
  type ClassBootStepId,
} from "./steps";

type BootPhase = "idle" | "running" | "leaving";

export type ClassBootActions = {
  /** Show the overlay and start at the first step. */
  start: (options: { title: string; mode: ClassBootMode }) => void;
  /** Move forward to a step (never backwards). No-op when idle. */
  advance: (stepId: ClassBootStepId) => void;
  /** Fade the overlay away as soon as work is done — no artificial hold. */
  finish: () => void;
  /** Hide immediately, e.g. after a failed request. */
  cancel: () => void;
  /** True while the overlay is visible (including the fade-out). */
  isActive: boolean;
};

const ClassBootContext = createContext<ClassBootActions | null>(null);

/** Never trap the teacher behind the overlay if a step never reports back. */
const MAX_BOOT_MS = 25_000;
/** Short fade only — do not wait for the bar to crawl to 100%. */
const FADE_MS = 280;

export function ClassBootProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<BootPhase>("idle");
  const [mode, setMode] = useState<ClassBootMode>("create");
  const [title, setTitle] = useState("");
  const [stepIndex, setStepIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  const phaseRef = useRef<BootPhase>("idle");
  const stepRef = useRef(0);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const reset = useCallback(() => {
    phaseRef.current = "idle";
    stepRef.current = 0;
    setPhase("idle");
    setStepIndex(0);
    setProgress(0);
    setTitle("");
  }, []);

  const actions = useMemo<ClassBootActions>(
    () => ({
      start: ({ title: nextTitle, mode: nextMode }) => {
        phaseRef.current = "running";
        stepRef.current = 0;
        setMode(nextMode);
        setTitle(nextTitle);
        setStepIndex(0);
        setProgress(CLASS_BOOT_STEPS[0].target);
        setPhase("running");
      },
      advance: (stepId) => {
        if (phaseRef.current !== "running") return;
        const next = stepIndexOf(stepId);
        if (next < 0) return;
        const idx = Math.max(stepRef.current, next);
        stepRef.current = idx;
        setStepIndex(idx);
        setProgress(CLASS_BOOT_STEPS[idx].target);
      },
      finish: () => {
        if (phaseRef.current !== "running") return;
        phaseRef.current = "leaving";
        stepRef.current = CLASS_BOOT_STEPS.length;
        setStepIndex(CLASS_BOOT_STEPS.length);
        setProgress(100);
        setPhase("leaving");
      },
      cancel: () => {
        if (phaseRef.current === "idle") return;
        reset();
      },
      isActive: phase !== "idle",
    }),
    [reset, phase]
  );

  useEffect(() => {
    if (phase !== "leaving") return;
    const toIdle = setTimeout(reset, FADE_MS);
    return () => clearTimeout(toIdle);
  }, [phase, reset]);

  useEffect(() => {
    if (phase !== "running") return;
    const bail = setTimeout(actions.finish, MAX_BOOT_MS);
    return () => clearTimeout(bail);
  }, [phase, actions]);

  return (
    <ClassBootContext.Provider value={actions}>
      {children}
      {phase !== "idle" && (
        <ClassBootOverlay
          mode={mode}
          title={title}
          stepIndex={stepIndex}
          progress={progress}
          leaving={phase === "leaving"}
        />
      )}
    </ClassBootContext.Provider>
  );
}

const NO_OP: ClassBootActions = {
  start: () => {},
  advance: () => {},
  finish: () => {},
  cancel: () => {},
  isActive: false,
};

/**
 * Boot actions. Safe to call from anywhere under the root layout — the
 * provider outlives route changes, so the overlay survives the navigation
 * from the student page into the new class. Falls back to no-ops so a
 * missing provider can never break the editor.
 */
export function useClassBoot(): ClassBootActions {
  return useContext(ClassBootContext) ?? NO_OP;
}
