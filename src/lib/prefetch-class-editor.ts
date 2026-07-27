/** Warm the Lexical + Liveblocks editor chunk before navigating to /class. */
export function prefetchClassEditorChunk(): void {
  void import("@/components/editor/class-editor");
}
