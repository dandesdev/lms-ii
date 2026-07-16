"use client";

import { useEffect } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $findMatchingParent } from "@lexical/utils";
import {
  $createListItemNode,
  $createListNode,
  $isListItemNode,
  $isListNode,
  type ListItemNode,
  type ListNode,
} from "@lexical/list";
import {
  $createParagraphNode,
  $getSelection,
  $isParagraphNode,
  $isRangeSelection,
  $isRootOrShadowRoot,
  $isTextNode,
  COMMAND_PRIORITY_HIGH,
  DELETE_CHARACTER_COMMAND,
  INSERT_PARAGRAPH_COMMAND,
} from "lexical";
import { $isEditorSectionNode } from "./editor-section-node";

function $getTopListNode(listItem: ListItemNode): ListNode {
  const listParent = listItem.getParent();
  if (!$isListNode(listParent)) {
    throw new Error("List item parent must be a list");
  }
  let list: ListNode = listParent;
  let parent = list.getParent();
  while (parent !== null) {
    if ($isListNode(parent)) {
      list = parent;
    }
    parent = parent.getParent();
  }
  return list;
}

function $removeHighestEmptyListParent(sublist: ListItemNode | ListNode): void {
  let emptyListPtr: ListItemNode | ListNode = sublist;
  while (
    emptyListPtr.getNextSibling() == null &&
    emptyListPtr.getPreviousSibling() == null
  ) {
    const parent = emptyListPtr.getParent();
    if (parent == null || (!$isListItemNode(parent) && !$isListNode(parent))) {
      break;
    }
    emptyListPtr = parent;
  }
  emptyListPtr.remove();
}

function $isListItemEmpty(listItem: ListItemNode): boolean {
  if (listItem.getChildrenSize() === 0) return true;
  return listItem.getTextContent().trim() === "";
}

function $getListItemAtSelection(): ListItemNode | null {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return null;
  return $findMatchingParent(selection.anchor.getNode(), $isListItemNode);
}

/** Exit the list when Enter is pressed again on an empty item, or Backspace at its start. */
function $exitEmptyListItem(): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
    return false;
  }

  const listItem = $getListItemAtSelection();
  if (!listItem || !$isListItemEmpty(listItem)) {
    return false;
  }

  const listNode = listItem.getParent();
  if (!$isListNode(listNode)) return false;

  const topListNode = $getTopListNode(listItem);
  const grandparent = listNode.getParent();
  let replacementNode;

  if ($isRootOrShadowRoot(grandparent) || $isEditorSectionNode(grandparent)) {
    replacementNode = $createParagraphNode();
    topListNode.insertAfter(replacementNode);
  } else if ($isListItemNode(grandparent)) {
    replacementNode = $createListItemNode();
    grandparent.insertAfter(replacementNode);
  } else {
    return false;
  }

  replacementNode
    .setTextStyle(selection.style)
    .setTextFormat(selection.format)
    .select();

  const nextSiblings = listItem.getNextSiblings();
  if (nextSiblings.length > 0) {
    const newList = $createListNode(listNode.getListType());
    if ($isListItemNode(replacementNode)) {
      const wrapper = $createListItemNode();
      wrapper.append(newList);
      replacementNode.insertAfter(wrapper);
    } else {
      replacementNode.insertAfter(newList);
    }
    newList.append(...nextSiblings);
  }

  $removeHighestEmptyListParent(listItem);
  return true;
}

function $isBackspaceAtStartOfEmptyListItem(): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
    return false;
  }

  const listItem = $getListItemAtSelection();
  if (!listItem || !$isListItemEmpty(listItem)) return false;

  const { anchor } = selection;
  const anchorNode = anchor.getNode();

  if ($isListItemNode(anchorNode)) {
    return anchor.offset === 0;
  }

  if (anchor.offset !== 0) return false;

  const firstChild = listItem.getFirstChild();
  if (firstChild == null) return true;

  if ($isTextNode(anchorNode) || $isParagraphNode(anchorNode)) {
    return anchorNode.getKey() === firstChild.getKey();
  }

  return false;
}

export function ListExitPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      INSERT_PARAGRAPH_COMMAND,
      () => $exitEmptyListItem(),
      COMMAND_PRIORITY_HIGH
    );
  }, [editor]);

  useEffect(() => {
    return editor.registerCommand(
      DELETE_CHARACTER_COMMAND,
      (isBackward) => {
        if (!isBackward) return false;
        if (!$isBackspaceAtStartOfEmptyListItem()) return false;
        return $exitEmptyListItem();
      },
      COMMAND_PRIORITY_HIGH
    );
  }, [editor]);

  return null;
}
