"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Activity preserves list pages when navigating to the editor. After mutations
 * elsewhere (publish, create from a sibling tab), re-fetch RSC props when this
 * route becomes visible again — skip the initial mount (SSR already loaded).
 */
export function useRefreshOnReshow() {
  const router = useRouter();
  const skipFirst = useRef(true);

  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    router.refresh();
  }, [router]);
}
