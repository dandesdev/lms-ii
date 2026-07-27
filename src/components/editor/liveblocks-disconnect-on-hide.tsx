"use client";

import { useLayoutEffect } from "react";
import { useRoom } from "@liveblocks/react";

/**
 * Cache Components keeps editor routes under Activity (`display: none`) instead
 * of unmounting. Explicitly drop the Liveblocks socket while hidden so we do
 * not leak room connections across preserved navigations.
 */
export function LiveblocksDisconnectOnHide() {
  const room = useRoom();

  useLayoutEffect(() => {
    room.connect();
    return () => {
      room.disconnect();
    };
  }, [room]);

  return null;
}
