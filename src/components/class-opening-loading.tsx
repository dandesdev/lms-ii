"use client";

import { useClassBoot } from "@/components/class-boot/class-boot-provider";
import { RouteLoading } from "@/components/route-loading";

/**
 * Fallback when the boot overlay was not started (refresh / deep link).
 * Hidden while ClassBoot already covers the screen.
 */
export function ClassOpeningLoading() {
  const { isActive } = useClassBoot();
  if (isActive) return null;

  return (
    <RouteLoading
      title="Opening class"
      statuses={[
        "Finding the class",
        "Opening the workspace",
        "Loading the editor",
        "Syncing your notes",
      ]}
    />
  );
}
