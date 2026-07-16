# External review brief: Lexical + Liveblocks/Yjs collaboration warnings

**Purpose:** Self-contained brief for an experienced engineer who cannot see the full LMS repo.  
**Date:** 2026-07-16  
**Product:** Next.js LMS for English teachers — collaborative rich-text class editor.  
**Ask:** Are residual `Invalid access: Add Yjs type to a document before reading data` warnings expected upstream noise, or is our tree/binding still wrong? What would you change?

---

## 1. Stack (exact versions we care about)

| Package | Version |
|---------|---------|
| `next` | 16.2.10 |
| `react` / `react-dom` | 19.2.4 |
| `lexical` + `@lexical/*` | 0.35.0 |
| `@lexical/yjs` | 0.35.0 (transitive via `@lexical/react`) |
| `@liveblocks/react` / `react-lexical` / `client` / `node` | 3.22.0 |
| `yjs` | ^13 (resolved ~13.6.x; emits `warnPrematureAccess`) |

Collab path: **Liveblocks room → `getYjsProviderForRoom` → Lexical `CollaborationPlugin` → `@lexical/yjs` binding**.

We do **not** use TipTap/ProseMirror. Comments/mentions UI unused.

---

## 2. Product requirements (non-negotiable MVP)

1. Real-time collaborative editing of a class document (teacher + possibly student/share link).
2. Document is partitioned into **sections**.
3. Typing `---` (+ space) ends the current section and starts a new one (visual HR between them).
4. Deleting the separator **merges** the two sections; **top section’s background color wins**.
5. Section background is a **full-bleed wash** on the section container (must not follow list indent).
6. Content: paragraphs, headings, lists, tables, images, text colors/highlights.

---

## 3. Current document model (epoch `sec2`)

```
Root
├── EditorSectionNode          // ElementNode, type "editor-section"
│   ├── ParagraphNode / Heading / List / Table / Image...
│   └── ...
├── SectionSeparatorNode       // DecoratorNode, type "section-separator" → <hr>
├── EditorSectionNode
│   └── ...
└── ...
```

### Design rules we settled on

1. **Never reparent live nodes after they already exist in Yjs** if we can avoid it — `@lexical/yjs` diffs children per parent; moves caused `splice: could not find collab element node`.
2. **Never change Element ↔ Decorator for the same `type` string** without abandoning the Liveblocks room (schema mismatch → `syncPropertiesFromYjs: could not find element node` storms).
3. **Corrupt / incompatible rooms:** bump `liveblocks_room_id` epoch (e.g. `class-{uuid}-sec2`), `deleteRoom` old id, reseed from DB `markdown_source`. Liveblocks cannot delete only the Yjs doc.
4. **First write into an empty room must be a single coherent tree** — bootstrap then reseed later races incremental sync and produced empty sections + leftover HRs.

### Room epoch history

| Epoch | Meaning | Outcome |
|-------|---------|---------|
| `class-{id}` | Early nested Element separators / wrappers | Corrupted |
| `…-flat1` | Flat root: blocks + Decorator HR; CSS wash on blocks | Editable; section wash wrong for lists |
| `…-sec1` | Section wrappers + early `initialEditorState` bootstrap | **Empty doc** (only HRs) |
| `…-sec2` (current) | Section wrappers; `shouldBootstrap={false}`; seed = sole first write | Sections + coloring work; residual Yjs warn on edit |

---

## 4. Current status (what works vs residual)

### Working (as of last teacher verification)

- Class loads with markdown content.
- Section backgrounds paint on wrappers (full width, not list-indent).
- `---` splits sections.
- Delete separator merges (top color wins).
- Fatal storms gone:
  - `syncPropertiesFromYjs: could not find element node` (hundreds)
  - `splice: could not find collab element node`

### Residual (still open)

On almost any edit (Enter, type, add/remove section, etc.):

```
Invalid access: Add Yjs type to a document before reading data.
```

Often via Next.js `forward-logs-shared.ts` (browser → server log). Editing still works.

### Ignore (not us)

```
A listener indicated an asynchronous response by returning true,
but the message channel closed before a response was received
```

Chromium extension `chrome.runtime` race. Appears on `/dashboard` before editor mounts. Zero matches in app `src/`.

---

## 5. Our diagnosis of the residual warning

### Yjs rule

From Yjs docs / `AbstractType.js`:

```js
export const warnPrematureAccess = () => {
  log.warn('Invalid access: Add Yjs type to a document before reading data.')
}
```

Fires when you **read** a shared type while `sharedType.doc == null` (created but not yet inserted into a `Y.Doc`).

### Lexical create order (`@lexical/yjs` 0.35)

When a new ElementNode is synced (e.g. new paragraph on Enter):

```js
// LexicalYjs.dev.mjs — $createCollabNodeFromLexicalNode
if ($isElementNode(lexicalNode)) {
  const xmlText = new XmlText();              // 1. DETACHED
  collabNode = $createCollabElementNode(xmlText, parent, nodeType);
  collabNode.syncPropertiesFromLexical(...);  // 2. READS attributes (getAttribute)
  collabNode.syncChildrenFromLexical(...);
}
// parent later insertEmbed/append → 3. ATTACH to doc
```

`syncPropertiesFromLexical` → `syncNodeStateFromLexical` → `sharedTypeGet(sharedType, '__state')` → `getAttribute` on detached `XmlText` → **warn**.

So order is: **create → read → attach**. Yjs wants: **create → attach → read**.

We believe this fires for **plain paragraphs too**, not only near `SectionSeparatorNode` / `EditorSectionNode`. Stack traces pointed at `$createCollabNodeFromLexicalNode` / `syncNodeStateFromLexical`, not our section split helpers.

### Why “just read first then add the type” doesn’t apply

There is nothing in Yjs to read yet. Lexical is copying **in-memory Lexical node state into a brand-new Yjs type**, then embedding that type. The fix belongs in **attach-before-property-sync** inside `@lexical/yjs`, not in our section plugins.

---

## 6. Mitigation we applied (and concerns)

`postinstall` script patches `@lexical/yjs` `sharedTypeGet`:

```js
function sharedTypeGet(sharedType, property) {
  if (sharedType instanceof Map /* or Map$1 in ESM */) {
    return sharedType.get(property);
  } else {
    if (sharedType.doc == null) return undefined; // skip getAttribute
    return sharedType.getAttribute(property);
  }
}
```

**Rationale:** On create there is no prior `__state` in Yjs; skipping the premature read is safe and stops console spam.

**Concerns (we want a second opinion):**

- Fragile across `@lexical/yjs` bumps; easy to miss in CI.
- May mask a real ordering bug if something else reads detached types for real data.
- Prefer upstream fix or a version-pinned `patch-package` with a CI check.

Teacher still reports the warning while typing — so either the patch isn’t applied in their install, Turbopack serves an unpatched build, or another code path (`sharedTypeSet` / child sync) still reads detached types.

---

## 7. Relevant application code (sanitized excerpts)

### 7.1 Collab plugin — no early bootstrap

```tsx
// class-liveblocks-plugin.tsx (simplified)
<CollaborationPlugin
  id={room.id}
  providerFactory={providerFactory} // getYjsProviderForRoom(room)
  username={username}
  cursorColor={cursorColor}
  cursorsContainerRef={cursorsContainerRef}
  shouldBootstrap={false}  // seed is sole first write
/>
```

Earlier we tried `initialEditorState` that wrote `EditorSection → Paragraph` before markdown seed. That caused empty rooms (only HRs) after reseed — abandoned.

### 7.2 Seed — first and only write into empty Yjs

```tsx
// seed-markdown-plugin.tsx (simplified)
useEffect(() => {
  if (!isSynchronized || done.current) return;
  const empty = editor.getEditorState().read(() => {
    const root = $getRoot();
    return root.getChildrenSize() === 0 && root.getTextContent().trim() === "";
  });
  if (!empty) { done.current = true; return; }
  done.current = true;

  editor.update(() => {
    if (markdown?.trim()) {
      $convertFromMarkdownString(markdown, SEED_TRANSFORMERS);
      $normalizeRootIntoSections(true); // same update as import
    } else {
      // empty section + paragraph
    }
  }, { discrete: true });
}, [editor, isSynchronized, markdown]);
```

### 7.3 Normalize (first-write only — in-place wrap)

```ts
// After markdown import, root is flat: [block*, separator*, block*...]
// Wrap consecutive non-separator blocks into EditorSectionNode.
// Intentionally NOT run as a live transform on already-synced flat rooms.

loose[0].insertBefore(section);
for (const block of loose) section.append(block);
```

### 7.4 Split on `---` (live)

```ts
// $splitSectionAtBlock(block) — block is the paragraph that matched ---
const after = [...siblings after block];
block.remove();
const sep = $createSectionSeparatorNode();
const nextSection = $createEditorSectionNode();
for (const n of after) nextSection.append(n); // move into NEW parent
section.insertAfter(sep);
sep.insertAfter(nextSection);
```

### 7.5 Merge on separator delete

```ts
// SectionSeparatorNode.remove()
const prev = this.getPreviousSibling(); // EditorSectionNode
const next = this.getNextSibling();     // EditorSectionNode
const movable = [...next.getChildren()];
for (const child of movable) prev.append(child);
next.remove();
super.remove();
// prev style (section background) kept — top wins
```

### 7.6 Custom nodes

**EditorSectionNode** — `ElementNode`, `type: "editor-section"`, `canBeEmpty(): false`, style string holds `--section-bg` for wash.

**SectionSeparatorNode** — `DecoratorNode<null>`, `type: "section-separator"`, renders `<hr>`, no React decorate UI. Maps to Yjs `XmlElement` (leaf-like), not nested `XmlText` container.

### 7.7 Config sketch

```ts
liveblocksConfig({
  namespace: "ClassEditor",
  editable: !readOnly,
  nodes: [
    HeadingNode, QuoteNode, ListNode, ListItemNode,
    TableNode, TableCellNode, TableRowNode,
    LinkNode, AutoLinkNode, ImageNode,
    EditorSectionNode, SectionSeparatorNode,
  ],
  // editorState forced null by liveblocksConfig
  onError: (e) => console.error("[ClassEditor]", e.message ?? e),
});
```

Markdown: custom `SECTION_SEPARATOR` element transformer + section-aware shortcut plugin (stock Lexical only runs element shortcuts when grandparent is Root/ShadowRoot — ours also allow `EditorSectionNode`).

---

## 8. Attempt timeline (condensed)

| # | Attempt | Result |
|---|---------|--------|
| 1–3 | Defer section transforms until “ready/synchronized” | Incomplete; existing rooms still broken |
| 4 | Bootstrap Lexical before Livebinds | `editorState must be null` + races — reverted |
| 5–7 | Reparent / transform separators live | `splice: could not find collab element node` |
| 8 | Flat tree + Decorator HR + client heal | Schema mismatch storm with old Element Yjs |
| 9 | Room-id epoch `flat1` | Editable again; residual warn; wash wrong for lists |
| 10 | Patch `sharedTypeGet` if `doc==null` | Intended to silence warn |
| 11 | `sec1` wrappers + bootstrap `initialEditorState` | Empty doc (HRs only) |
| 12 | `sec2`: no bootstrap; seed = first write | **Current:** features work; warn remains |

---

## 9. Questions for the reviewer

1. **Do you agree** the residual `Invalid access` on Enter/type is upstream `@lexical/yjs` create-then-read ordering (fires for plain paragraphs), and safe to treat as noise if editing/sync are correct?

2. If yes: prefer **patch-package** pinned to 0.35.0, **fork**, **PR to Lexical**, or **live with the warn** in production?

3. If no: what should we instrument to find our own premature reads (e.g. separator merge/split, seed `discrete: true`, custom ElementNode style sync)?

4. Is our **section tree** (`Element` wrappers + `Decorator` HR at root) a sound pattern with `@lexical/yjs` 0.35 + Liveblocks 3.x, or would you keep a **flat** Lexical tree and fake sections with CSS/metadata?

5. For live split/merge we **append/move** children into a newly created sibling section in the same update. Is that acceptable for incremental sync, or should we always **exportJSON → remove → parse into new parent** to force delete+insert?

6. Any known Liveblocks Lexical guidance for custom nested ElementNodes or for `shouldBootstrap={false}` + delayed first write?

---

## 10. What we are *not* asking

- Full app architecture / auth / Supabase schema review.
- Whether to leave Lexical for TipTap (unless you think Lexical+Yjs cannot meet section MVP).
- Browser extension message-channel errors.

---

## 11. One-sentence summary

**Fatal collab corruption from schema mismatch and reparenting is fixed via room epochs + a single first-write seed into `EditorSectionNode` trees; remaining console spam appears to be Yjs complaining that Lexical reads attributes on newly created XmlText before embedding it in the Doc — we want confirmation and a maintainable fix strategy.**
