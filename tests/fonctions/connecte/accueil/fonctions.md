# Page d'accueil — Fonctions métier

Route : `/home`  
Composant : `HomeComponent`  
Accès : utilisateur connecté

La page d'accueil liste les sous-applications du portail (`apps/*`) auxquelles
l'utilisateur a accès, regroupées par groupe. La configuration se fait dans
Admin › Applications.

---

## `2-6-1` — [modification] Chargement du tableau de bord

- **Requête** : GET `/api/portal/home` au chargement de la page (session requise)
- **Filtrage serveur** : tout utilisateur (admin inclus) ne reçoit que les groupes auxquels il est rattaché (`portal_user_groupes`) — le rôle admin donne accès au panneau `/admin` mais n'accorde aucun bypass ici
- **Groupes vides masqués** : un groupe sans application active n'est pas renvoyé
- **Accès directs** : les applications attribuées individuellement (`portal_user_apps`) et absentes des groupes visibles sont regroupées dans une section « Accès directs »
- **État chargement** : squelettes de cartes animés pendant la requête
- **État erreur** : message d'erreur + bouton « Réessayer » qui relance le chargement
- **Priorité:** bloquant
- **Composants:** `apps/portail/src/app/pages/user/home/home.component.ts`, `apps/portail/src/app/pages/user/home/home.component.html`, `libs/portail-core/data-access/src/lib/portal-apps.service.ts`, `server/modules/portal-apps.js`

---

## `2-6-2` — [modification] Affichage des applications

- **Regroupement** : une section par groupe, titre du groupe + compteur d'applications + description facultative
- **Carte application** : icône Material Symbols, nom, description, flèche au survol
- **Ordre** : groupes triés par `ordre` puis nom ; applications triées par `ordre` puis nom
- **Badge de droit** : affiché sur la carte quand le droit n'est pas `lecture` (`ecriture` / `admin`)
- **Applications inactives** : jamais affichées (filtre `is_active` côté serveur)
- **Applications indisponibles** : une entrée `portal_apps` référençant une route interne (ex. `/agenda`) dont le module backend n'a pas été monté à ce démarrage (dossier de la sous-application absent de cette installation) est calculée `isAvailable: false` côté serveur et filtrée côté front — sa carte ne s'affiche pas, et le groupe disparaît si toutes ses applications sont ainsi filtrées ; une application externe (URL absolue) est toujours considérée disponible
- **Priorité:** majeur
- **Composants:** `apps/portail/src/app/pages/user/home/home.component.ts`, `apps/portail/src/app/pages/user/home/home.component.html`, `server/modules/portal-apps.js`, `libs/portail-core/data-access/src/lib/portal-apps.models.ts`

---

## `2-6-3` — [modification] Ouverture d'une application

- **URL absolue** (`http://…`) : navigation vers la sous-application via `navigateToApp`, avec transmission du token, de l'utilisateur, du thème et du décalage de port dans l'URL (localStorage non partagé cross-origin)
- **Route interne** (`/documents`) : navigation Angular dans le portail
- **URL vide** : la carte ne déclenche aucune navigation
- **Priorité:** bloquant
- **Composants:** `apps/portail/src/app/pages/user/home/home.component.ts`, `apps/portail/src/app/shared/utils/navigate-to-projets.ts`

---

## `2-6-4` — [modification] États particuliers et accès admin

- **Aucune application** : message « Aucune application disponible » avec invitation à contacter un administrateur
- **Bouton « Gérer les applications »** : visible uniquement pour un admin, redirige vers `/admin`
- **En-tête** : titre et sous-titre issus de `data/child/home.json` (`welcomeTitle`, `welcomeSubtitle`), icône issue de la config d'app
- **Accès depuis la navigation** : item « Accueil » dans la barre de navigation (portail et sous-applications)
- **Bouton Admin** : déplacé de la barre de navigation vers la première ligne du header (à côté du bascule de thème et du bouton de déconnexion), visible uniquement pour un admin
- **Barre de navigation dérivée des applications réellement autorisées, en direct** : `NavComponent` liste les sous-applications disponibles (`isAvailable !== false`) issues du signal partagé `PortalAppsService.authorizedApps` (`providedIn: 'root'`, alimenté par `/api/portal/home` — mêmes groupes/accès directs que la page d'accueil, un admin voit tout), triées par `ordre` puis nom — **pas** du catalogue brut `PortalAppsService.apps` (toutes les apps actives sans égard aux permissions, réservé à l'admin des applications) : un utilisateur standard ne voit dans son menu que les applications de ses groupes ou attribuées en accès direct. Aucune ligne de code à ajouter par nouvelle sous-appli, elle apparaît automatiquement dès son auto-enregistrement au catalogue (mécanisme 3, `docs/architecture-sous-applications.md`). Une entrée à route interne (`/agenda`, `/recettes`, `/documents`) devient un simple lien Angular ; une entrée à URL absolue (sous-appli « Mode autonome », ex. `projets`) déclenche `onAppClick(url)` → `navigateToApp(url)`, qui transmet la session (token/thème) par les paramètres d'URL. Le signal étant partagé par toute la session, toute bascule Actif/Inactif dans Admin › Portail › Système › Applications se répercute immédiatement dans le menu de l'admin lui-même (rafraîchi après chaque action CRUD/toggle), sans rechargement de page ; pour les autres utilisateurs, le menu se met à jour à la prochaine ouverture de session/page d'accueil. `data/child/nav.json` reste disponible comme mécanisme générique pour d'éventuels items statiques hors catalogue, mais ne contient plus l'entrée Projets (désormais dérivée du catalogue comme les autres)
- **Priorité:** mineur
- **Composants:** `apps/portail/src/app/pages/user/home/home.component.html`, `libs/shared/ui/src/lib/layout/nav/nav.component.ts`, `libs/shared/ui/src/lib/layout/nav/nav.component.html`, `libs/portail-core/data-access/src/lib/portal-apps.service.ts`, `libs/shared/ui/src/lib/layout/header/header.component.ts`, `libs/shared/ui/src/lib/layout/header/header.component.html`, `apps/portail/src/app/app.component.ts`, `apps/portail/src/app/shared/utils/navigate-to-projets.ts`, `data/child/nav.json`
