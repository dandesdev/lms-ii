"use client";

import { useRefreshOnReshow } from "@/hooks/use-refresh-on-reshow";

/** Keeps the student portal list fresh when Activity re-shows this route. */
export function StudentPortalListRefresh() {
  useRefreshOnReshow();
  return null;
}
