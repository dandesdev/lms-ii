"use client";

/**
 * Section structure exports for the sec1 collab model:
 * Root → EditorSectionNode | SectionSeparatorNode
 * Split/merge use JSON recreate (never live reparent) for @lexical/yjs safety.
 */

export {
  $collapseAdjacentSectionSeparators,
  $ensureSectionStructure,
  $getSectionAtCursor,
  $getSectionBlocksAtCursor,
  $getTopLevelSectionNode,
  $isLegacyFlatDocument,
  $mergeAdjacentEditorSections,
  $mergeSectionsAroundSeparator,
  $normalizeRootIntoSections,
  $reparentSectionSeparator,
  $splitSectionAtBlock,
  $usesSectionWrappers,
} from "./section-utils";
