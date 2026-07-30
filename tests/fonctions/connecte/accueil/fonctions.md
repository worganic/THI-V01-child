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
- **Filtrage serveur** : un admin reçoit tous les groupes actifs ; un utilisateur standard ne reçoit que les groupes auxquels il est rattaché (`portal_user_groupes`)
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
- **Priorité:** majeur
- **Composants:** `apps/portail/src/app/pages/user/home/home.component.html`, `server/modules/portal-apps.js`

---

## `2-6-3` — [modification] Ouverture d'une application

- **URL absolue** (`http://…`) : navigation vers la sous-application via `navigateToApp`, avec transmission du token, de l'utilisateur, du thème et du décalage de port dans l'URL (localStorage non partagé cross-origin)
- **Route interne** (`/documents`) : navigation Angular dans le portail
- **URL vide** : la carte ne déclenche aucune navigation
- **Priorité:** bloquant
- **Composants:** `apps/portail/src/app/pages/user/home/home.component.ts`, `apps/portail/src/app/shared/utils/navigate-to-projets.ts`

---

## `2-6-4` — États particuliers et accès admin

- **Aucune application** : message « Aucune application disponible » avec invitation à contacter un administrateur
- **Bouton « Gérer les applications »** : visible uniquement pour un admin, redirige vers `/admin`
- **En-tête** : titre et sous-titre issus de `data/child/home.json` (`welcomeTitle`, `welcomeSubtitle`), icône issue de la config d'app
- **Accès depuis la navigation** : item « Accueil » dans la barre de navigation (portail et sous-applications)
- **Priorité:** mineur
- **Composants:** `apps/portail/src/app/pages/user/home/home.component.html`, `libs/shared/ui/src/lib/layout/nav/nav.component.html`
