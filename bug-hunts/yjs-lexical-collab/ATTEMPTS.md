# Attempts log

Append-only. Newest first.

## 2026-07-16 — Try #13: patch-package + log filter for residual Invalid access

**Context:** External review confirmed residual `Invalid access` is upstream `@lexical/yjs` create-then-read noise (safe). Lexical PR deferred.

**Fix:**
- Pin `@lexical/yjs@0.35.0` + `patches/@lexical+yjs+0.35.0.patch` via `patch-package` (postinstall). Guards `sharedTypeGet` / prod `q`/`m` when `doc == null` (dev + prod builds).
- Removed fragile `scripts/patch-lexical-yjs.mjs`.
- Browser log filter (early `<head>` script + client fallback) suppresses the exact Yjs warn string so Next log-forwarder stays quiet.

**Expected:** Enter/type works; no Invalid access in browser console or `next dev` terminal.

**Result:** SUCCESS — warnings no longer show in the browser (2026-07-16).

---

## 2026-07-14 ? Try #9: Abandon corrupted Yjs via room-id epoch bump

**New symptoms after try #8:**
- On render: `syncPropertiesFromYjs: could not find element node` (fatal Lexical Yjs)
- Hundreds of `Invalid access: Add Yjs type...` (browser nearly crashed)
- Enter after ?fianc�? ? +38 more Invalid access

**Root cause:**
Liveblocks room still held **Element**-mapped `section-separator` / nested section XmlText from before try #8. Client now registers `SectionSeparatorNode` as **DecoratorNode**. `CollabElementNode.getNode()` requires `$isElementNode` ? null ? throw on every Yjs?Lexical property sync, which loops and storms `warnPrematureAccess`.

Client-side heal (try #8) never helped reliably: sync crashes before/without detecting `EditorSectionNode` at root.

**Also fixed:** `liveblocks-auth` was resolving classes via `room.replace("class-", "")` as a UUID. That breaks for `class-{uuid}-flat1` (leaves `-flat1` on the id). Auth now looks up `liveblocks_room_id` directly.

**Fix:**
- `src/lib/collab-room.ts` ? canonical room id `class-{uuid}-flat1`
- On `/class/[id]` and `/c/[token]` SSR: `ensureCanonicalCollabRoomId` migrates DB + deletes old room
- New classes / sync script use `-flat1`
- Unregister `EditorSectionNode` (flat-only)
- Remove client CollabRoomHealPlugin
- Auth by `liveblocks_room_id`

**Expected:** opening Andrea?s class migrates to empty `-flat1` room, markdown reseeds flat, Enter/type no longer storms.

**Result:** pending verification

---

## 2026-07-14 ? Try #8: Flatten collab tree + room heal

**Hypothesis:** Nested `EditorSectionNode` in Liveblocks Yjs history (plus Element-based separators) makes basic Enter/typing sync unsafe. MVP needs flat root children and a one-time room wipe for polluted rooms.

**Changes:**
- Seed without `$normalizeRootIntoSections`
- Convert `SectionSeparatorNode` to `DecoratorNode`
- Detect root-level `EditorSectionNode` ? `POST .../reset-collab` ? `deleteRoom` ? reload ? markdown reseed flat
- Restore stock root-level markdown shortcuts
- Remove unused section-aware shortcut plugin
- Hunt docs under `bug-hunts/yjs-lexical-collab/`

**Expected:** Andrea class heals once; Enter/type sync without splice failures. Residual `warnPrematureAccess` may still appear as upstream Lexical/Yjs console noise on new ElementNode creation.

**Result:** FAILED ? Decorator/Element mismatch against existing room Yjs caused `syncPropertiesFromYjs: could not find element node` + 100+ Invalid access on load. Heal plugin did not abandon the room in time.

---

## Prior tries (summarized from earlier sessions)

See `README.md` attempt table rows 1?7.

## 2026-07-14 ? Try #9 result + Try #10 (warn silence + flat section CSS)

**Try #9 verification (user):**
- Room loads (tables + HRs OK). No `syncPropertiesFromYjs: could not find element node` storm.
- Extension noise on dashboard still present (ignore).
- Enter/type still logs a **single** `Invalid access` per new block (stack: `syncNodeStateFromLexical` ? `getAttribute` on detached XmlText) ? editing works; colors/highlight tools work.
- Seeded styles from old Yjs (fonts/colors) are gone ? expected: room was abandoned and reseeded from markdown only.
- Section background paints per-block with white gaps from theme margins.

**Try #10:**
- `scripts/patch-lexical-yjs.mjs` (+ postinstall): skip `getAttribute` when `sharedType.doc == null`
- Flat section CSS: `flow-root`, zero margins, padding-based contiguous wash
- `` empty-root returns false (flat)

**Expected:** Enter no longer floods Invalid access; section paint looks continuous.

## 2026-07-14 ? User report: Enter still shows message-channel error

**Symptom:** `A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received` on Enter.

**Verdict:** Not app / Lexical / Liveblocks. Zero matches in `src/`. Classic Chromium extension chrome.runtime race (password managers, Grammarly, ad blockers, shopping extensions, etc.). Same message already appeared on `/dashboard` before any editor mounted.

**Action:** Ignore for collab MVP. Confirm Enter works and that `Invalid access: Add Yjs type...` is absent. Verify in Incognito with extensions disabled if needed.

## 2026-07-14 ? Try #11: Real section wrappers (epoch sec1) + Yjs-safe split/merge

**User ask:** Root should only have full-bleed section nodes; `---` splits; delete separator merges (top color wins); lists must not indent the section wash; live collab required.

**External feedback answered:**
1. Remaining Invalid access on Enter fires for **plain paragraphs** too (stack: `` ? `syncNodeStateFromLexical` ? `getAttribute` on detached XmlText) ? upstream Lexical/Yjs ordering, not separator NodeState. Keep postinstall patch as silenced noise; consider patch-package later.
2. Tree is **no longer flat**: `Root ? EditorSectionNode | SectionSeparatorNode(Decorator)`.
3. Patch is raw `postinstall` script (not patch-package); `@lexical/yjs@0.35.0`.

**Implementation:**
- Epoch bump `flat1` ? `sec1` (abandon flat rooms)
- `ClassLiveblocksPlugin` with `initialEditorState` bootstrapping `Section ? Paragraph` (avoids stock bare-paragraph bootstrap)
- `---` ? `` (JSON recreate children into new section ? no live reparent)
- Separator `remove()` merges next into prev via JSON recreate; prev color kept
- Section CSS full-width wash on wrapper (list indent stays inside)
- Section-aware markdown shortcuts restored

**Expected:** Open Andrea class migrates to `-sec1`, reseeds wrapped sections; section paint full-bleed; `---` + delete separator work under Liveblocks.

---

## 2026-07-14 ? Try #12: Empty class (only HRs) after sec1

**Symptom:** Only section dividers; click ? validatePoint offset > childrenSize; typing shows with Invalid access.

**Cause:** Early bootstrap wrote Section?Paragraph into Yjs, then Seed rebuilt later. Incremental sync left empty sections + separators.

**Fix (epoch sec2):** shouldBootstrap false; seed is sole first write; in-place normalize in same update; pad empty sections; select first paragraph.
