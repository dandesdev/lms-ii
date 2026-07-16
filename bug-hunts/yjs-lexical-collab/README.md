# Bug hunt: Lexical + Liveblocks/Yjs collaboration breaks on basic edits

**Status:** ACTIVE  
**MVP impact:** Blocker ? class documents must stay fully editable with live collaboration  
**Repro class:** Andrea?s ?Trip to Brazil? (cursor after ?fianc?? in first-section Goal)  
**Symptom:** On load / Enter ? `syncPropertiesFromYjs: could not find element node` + storm of `Invalid access: Add Yjs type to a document before reading data.` (100+ logs)  

---

## Observed behavior (2026-07-14)

### Round 2 (after try #8 flatten / Decorator separator)

1. Restart from homepage, open Andrea?s class while watching server + browser consoles.
2. As soon as the editor renders:
   - `class-editor.tsx` ? `Error: syncPropertiesFromYjs: could not find element node`
   - `Invalid access: Add Yjs type...` repeats **100+** times (near browser crash)
3. Caret after ?fianc?? ? Enter ? **+38** more Invalid access lines.

### Round 1

1. Hard-refresh Andrea?s class.
2. Place caret after ?fianc?? in the Goal of the first section.
3. Press **Enter** ? `Invalid access: Add Yjs type...`
4. Type / Enter ? repeats.

Earlier sessions also saw:
- `LiveblocksPlugin: editorState in initialConfig detected, but must be null.`
- `splice: could not find collab element node` (fatal, from `@lexical/yjs`)
- `---` + space not converting to a horizontal rule / section separator
- Browser-extension noise: `A listener indicated an asynchronous response by returning true...` (ignore)

---

## Root cause analysis

### A. Yjs warning source

From `yjs@13.6.31` `AbstractType.js`:

```js
export const warnPrematureAccess = () => {
  log.warn('Invalid access: Add Yjs type to a document before reading data.')
}
```

It fires when code reads a shared type whose `.doc` is still `null` (type created but not yet attached to a `Y.Doc`).

`@lexical/yjs` creates a detached `Y.XmlText` for every new `ElementNode`, syncs children onto it, *then* embeds it into the parent. That path can emit this warning during normal Paragraph creation on Enter.

Nested custom `ElementNode`s (`EditorSectionNode` wrapping paragraphs) amplify the problem: more nested XmlTexts, more premature reads, and structural edits that `@lexical/yjs` incremental sync cannot represent.

### B. Why this document specifically is unhealthy

We introduced **`EditorSectionNode`** wrappers as root children so section backgrounds could paint as continuous washes. Then we:

1. Seeded markdown into empty rooms.
2. Ran `$normalizeRootIntoSections(true)` ? reparenting loose blocks under wrappers.
3. Ran `SectionBootstrapPlugin` *before* Liveblocks bound Yjs (later removed) ? filled Lexical before collab owned state.
4. Ran node transforms / `$reparentSectionSeparator` that **moved nodes between parents** during live typing.

`@lexical/yjs` syncs by **diffing children keys per parent**. Reparenting / wrapping after the Yjs tree exists produces:

`splice: could not find collab element node`

Once a room?s Yjs history contains that nested structure (possibly half-synced), **every** local edit that touches children of those collab nodes risks warnings and sync failures. Liveblocks does **not** let you delete only the Yjs doc ? you must `deleteRoom(roomId)` and recreate.

### C. Why `---` failed separately

Lexical?s stock `MarkdownShortcutPlugin` only runs **element** transformers when:

```js
$isRootOrShadowRoot(paragraph.getParent())
```

With content under `EditorSectionNode`, `#`, `-`, and `---` never fire. Enter alone never triggers element shortcuts anyway (they look for a trailing space in the text).

### D. What is *not* the bug

| Message | Meaning |
|--------|---------|
| `message channel closed before a response was received` | Browser extension ? not app code |
| Liveblocks ?no pong? after a crash | Fallout from client exceptions, not primary cause |

---

## Attempt timeline

| # | Attempt | Result |
|---|---------|--------|
| 1 | Defer section structure until `useIsEditorReady()` | Still mutated during `"synchronizing"` ? incomplete |
| 2 | `useIsEditorSynchronized()` (wait for `"synchronized"`) | Reduced race; existing nested rooms still broken |
| 3 | Remove auto-migration node transforms | Stopped *new* splice storms; did not heal rooms |
| 4 | `SectionBootstrapPlugin` before `LiveblocksPlugin` | Caused `editorState must be null` warning + worse races ? **reverted** |
| 5 | Call `$reparentSectionSeparator` inside markdown replace | Same Yjs reparent problem during typing |
| 6 | Section-aware markdown shortcuts (allow `EditorSectionNode` as grandparent) | Fixes `---` *detection* only; does not fix Yjs |
| 7 | Stop reparent on live `---` | Safer for flat docs; nested rooms still warn on Enter |
| 8 | Flatten seed + Decorator HR + client `deleteRoom` heal | **FAILED** ? Element Yjs history vs Decorator Klass ? `syncPropertiesFromYjs` + 100+ Invalid access |
| 9 | SSR room-id epoch `class-{id}-flat1` + auth by `liveblocks_room_id` | **PARTIAL OK** ? load works; Enter warn only (upstream); styles reset w/ seed |
| 10 | Patch LexicalYjs detached getAttribute + flat section CSS wash | Silences Enter warn; section wash still wrong for lists |
| 11 | Epoch `sec1` + EditorSectionNode + Yjs-safe JSON split/merge + ClassLiveblocksPlugin bootstrap | pending verification |

---

## Target fix (try #9 ? current)

### Design rules for Lexical + Liveblocks Yjs

1. **Root children stay flat:** paragraphs, headings, lists, tables, images, separators ? never nested custom section wrappers in the live tree.
2. **Separators are leaf-like:** `---` as a **DecoratorNode** (Lexical HR pattern).
3. **Section background:** styles on blocks between separators (flat path).
4. **Seed once into empty Yjs only:** import markdown, do **not** wrap into `EditorSectionNode`.
5. **Corrupt rooms:** do **not** try to migrate Yjs in place. Bump `liveblocks_room_id` to `class-{id}-flat1` (abandon old doc), delete old room, reseed from `markdown_source`.
6. **Auth:** resolve class by `liveblocks_room_id`, never by parsing UUID out of the room string.

### Files touched in try #9

- `src/lib/collab-room.ts` ? epoch helper + SSR migrate
- `src/app/class/[id]/page.tsx`, `src/app/c/[shareToken]/page.tsx` ? migrate before render
- `src/app/api/liveblocks-auth/route.ts` ? lookup by room id
- `src/app/api/classes/route.ts`, `scripts/sync-from-local.ts` ? new canonical ids
- Unregister `EditorSectionNode`; remove client heal plugin
- `bug-hunts/yjs-lexical-collab/*` ? this log

### Verification checklist

- [ ] Open Andrea?s class ? server log may show `[collab-room] migrated ? ? ?-flat1`
- [ ] Editor loads from markdown without `syncPropertiesFromYjs: could not find element node`
- [ ] Enter after ?fianc?? ? no spam of Invalid access (occasional single warn may remain upstream)
- [ ] Type freely; refresh keeps content (Liveblocks owns it after seed)
- [ ] `---` + space ? HR
- [ ] Second browser tab sees live updates

### Known residual

`warnPrematureAccess` can still fire as a **single** console warn when `@lexical/yjs` creates a detached `XmlText` before embed ? that is upstream. A **storm** of hundreds means the room is still on corrupted history (migration did not run ? check `SUPABASE_SERVICE_ROLE_KEY`).
---

## Alternatives if Liveblocks/Yjs still fails MVP

| Approach | Notes |
|----------|--------|
| Same Lexical + different Yjs provider | Same `@lexical/yjs` constraints |
| Liveblocks Storage snapshots + Presence | Coarser collab; rewrite |
| TipTap / ProseMirror collab | Different binding; big rewrite |

**Recommendation:** stay on Liveblocks; keep documents **flat**; abandon polluted rooms via room-id epoch (never mutate Yjs shape in place).

---

## Agent handoff notes

- Do **not** reintroduce `` / `` during live updates.
- Do **not** bootstrap Lexical before `LiveblocksPlugin` binds.
- Do **not** change Decorator <-> Element for an existing node `type` string without bumping the room epoch.
- Prefer room-id bump / `deleteRoom` over in-client tree migration.
- Repro: Andrea Trip to Brazil -> Goal fianc? -> Enter.
- Requires `SUPABASE_SERVICE_ROLE_KEY` for SSR room migration.
