"use client";

import { useEffect } from "react";
import { useClassBoot } from "@/components/class-boot/class-boot-provider";

/**
 * Marks the "workspace" step once the class RSC has rendered. No-op when no
 * boot is in flight (e.g. a cold refresh that only used loading.tsx).
 */
export function ClassOpenBootBridge() {
  const boot = useClassBoot();

  useEffect(() => {
    boot.advance("open");
  }, [boot]);

  return null;
}
