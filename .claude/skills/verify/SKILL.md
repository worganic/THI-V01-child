---
name: verify
description: Build/launch/drive recipe for this Worganic monorepo (portail + projets + API), learned during the corbeille (soft-delete) verification on 2026-07-06.
---

# Verify recipe — Worganic monorepo

## Build (no runtime, just typecheck the two Angular apps)

```bash
npx nx run-many --target=build --projects=portail,projets --no-progress 2>&1 | grep -E "(ERROR|error TS|✘|Failed)"
```
No output → OK.

## Launch

Dev servers are frequently already running locally (check first):
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/version/check   # API
curl -s -o /dev/null -w "%{http_code}" http://localhost:4202                     # portail
curl -s -o /dev/null -w "%{http_code}" http://localhost:4203                     # projets
```
If down: `npm run start:all` (nx run-many serve portail,projets,api --parallel).

The API server (`server/project.json` → `serve` target) runs as `node --watch server-data.js` — **it auto-restarts on save**, no manual restart needed after editing `server/server-data.js` or any `server/modules/*.js` it requires. Confirm a new route is live by curling it unauthenticated: a `401 Non authentifié` means the route exists; a bare 404 means the edit hasn't been picked up (rare — check the watch process didn't crash).

## Drive it (browser, via claude-in-chrome)

1. `tabs_context_mcp` → `navigate` to `http://localhost:4202`. The portail keeps an existing logged-in session (cookie-based) — no login flow needed in practice.
2. Click "Nouveau projet" → gives a fresh disposable project (`TEST-...` naming) to test editor features without touching real user data under `data/projets/<id>/`. **Always delete this test project from the portail projects list at the end of the session** (card → "Supprimer" → confirm) — it's your cleanup, not the user's.
3. The editor lives at `/projets/<uuid>`. Sidebar (left) = file/folder tree, right panel has "Conversation" / "Historique" tabs.
4. To create a folder: right-click empty sidebar area → "Nouvelle section" → type name → Enter.
5. To delete: right-click the node → "Supprimer" → confirm in the modal that appears.
6. History/trash panel: click "Historique" tab. "Corbeille (N)" collapsible section at top lists soft-deleted nodes with a "Restaurer" button (visible on row hover). Below it, the action timeline shows tracked create/update/delete/undo entries grouped by day; hovering an entry reveals ↺ (undo) / clock (undo-cascade) icons.

## Known screenshot flakiness

`mcp__claude-in-chrome__computer` (`action: screenshot`) frequently times out ("Page.captureScreenshot timed out") right after a click/navigation that triggers an Angular re-render or a network round-trip. It is **not** a frozen renderer — `read_console_messages` still responds instantly in that state. Fix: `wait` 2-3s, then retry the screenshot. Don't treat the first timeout as a hang.

## Gotchas discovered

- SSE-driven live refresh (`structure_update` event → `autoPullAndRefresh()`) does not fire uniformly from every code path: restoring a trashed node via the Corbeille panel's own "Restaurer" button refreshes the sidebar immediately (it wires an explicit `structureRestored` output); restoring the *same* node via the history timeline's ↺ (which goes through the generic `wo-action-history` undo dispatcher) does not — a manual page reload is needed to see it in the tree, even though the server-side data is already correct. Worth knowing before assuming "no visible change = it didn't work" — check network response codes, not just pixels.
- The Corbeille list itself doesn't live-refresh via SSE while already expanded and a new deletion happens — collapse/re-expand the section to pull fresh data.
