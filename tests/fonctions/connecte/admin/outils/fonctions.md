# Admin › Portail › Outils — Fonctions métier

Route : `/admin/tools` (onglet "Outils" de la catégorie Portail)
Composant : `AdminToolsComponent` (`apps/portail`), rend `WoToolsAdminComponent` (`libs/shared/ui`)
Accès : admin uniquement

Réglage de config générale (transverse, via `ConfigService`) : active ou
désactive, pour chaque outil (Tchat IA, Recette, Tickets, Actions, IA Logs,
Historique), sa présence dans la navigation et son widget flottant. Ces
widgets s'affichent principalement dans l'éditeur de `apps/appli-projets`, mais le
réglage lui-même n'est pas propre à cette sous-application — c'est pourquoi
l'onglet est catégorisé "Portail" et non "Applications" (voir `2-1-9-7`).

---

## `2-1-10-1` — Configuration des outils

- **Liste des outils** : Tchat IA, Recette, Tickets, Actions, IA Logs, Historique
- **Onglet dans la navigation** : case à cocher par outil, persistée via `ConfigService.saveEnabledTabs()`
- **Widget flottant** : case à cocher par outil (sauf IA Logs / Historique, sans widget), persistée via `ConfigService.saveEnabledTools()`
- **Priorité:** mineur
- **Composants:** `apps/portail/src/app/pages/admin/tabs/admin-tools/admin-tools.component.ts`, `libs/shared/ui/src/lib/tools/wo/wo-tools-admin/wo-tools-admin.component.ts`, `libs/portail-core/data-access/src/lib/config.service.ts`
