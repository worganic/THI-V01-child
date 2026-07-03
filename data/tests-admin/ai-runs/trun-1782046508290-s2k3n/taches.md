Liste des fonctions à tester (5) :

### 2-3-1 — Chargement (Page: Déploiements — Fonctions métier)
- **Statut version** : Appel GET `/api/version/check` pour récupérer la version locale (`localVersion`), le statut de mise à jour (`upToDate`), le dernier déploiement (`latestDeployment`) et la branche courante (`currentBranch`).
- **Liste des déploiements** : Appel GET `/api/admin/deployments` pour récupérer l'historique des déploiements.
- **Authentification** : Récupération du token `frankenstein_token` depuis le localStorage et envoi dans l'en-tête `Authorization: Bearer <token>` de l'API `/api/admin/deployments`.
- **Autorisation requise** : L'API `/api/admin/deployments` nécessite le rôle `admin` ; renvoie un code 403 si l'utilisateur n'est pas autorisé.
- **Composants:** `apps/portail/src/app/pages/user/deployments/deployments.component.ts`, `server/server-data.js`

### 2-3-2 — Affichage (Page: Déploiements — Fonctions métier)
- **Bannière de statut** : Affiche une bannière jaune "Ce poste est à jour" avec la version locale si à jour, ou une bannière rouge "Mise à jour requise" avec la version locale et la dernière version disponible.
- **Détails du dernier déploiement** : Affiche le titre du commit, la date et l'auteur du dernier déploiement dans la bannière s'il est disponible.
- **Tableau des déploiements** : Affiche la liste des déploiements du plus récent au plus ancien (limité aux 100 derniers).
- **Mise en valeur de la version actuelle** : La ligne correspondant à la version actuelle du poste (`localVersion`) a un fond jaune et affiche un badge jaune "actuel".
- **Badge type commit** : Affiche le type court (`FIX` en rouge, `AME` aux couleurs du thème primaire, `MRG` en violet) extrait du titre du commit par `extractCommitType()` et `shortCommitType()`.
- **Badges de scope et features** : Affiche les scopes concernés avec des couleurs distinctes (frankenstein : primaire, server : vert, electron : violet, data : orange, autres : gris) et liste les features associées (préfixées par ●) obtenues via `getScopedRows()`.
- **Titre du commit** : Affiche le titre nettoyé via `extractCommitTitle()` sans les métadonnées de type de commit.
- **Date et auteur** : Affiche la date de déploiement formatée en locale française (DD/MM/YYYY HH:mm) et le nom de l'auteur du déploiement.
- **Composants:** `apps/portail/src/app/pages/user/deployments/deployments.component.ts`, `apps/portail/src/app/pages/user/deployments/deployments.component.html`

### 2-3-3 — Navigation (Page: Déploiements — Fonctions métier)
- **Retour** : Un clic sur le bouton retour (icône `arrow_back`) redirige vers la page d'administration `/admin` avec le paramètre de requête `tab=deploiement`.
- **Composants:** `apps/portail/src/app/pages/user/deployments/deployments.component.html`, `apps/portail/src/app/base-routes.ts`

### 2-3-4 — États (Page: Déploiements — Fonctions métier)
- **Chargement** : Affiche un spinner (`progress_activity` animé) lorsque les données sont en cours de récupération (`loading() === true`).
- **Version à jour** : Affiche le statut "Ce poste est à jour" avec un fond jaune/orange très clair.
- **Version obsolète** : Affiche le statut "Mise à jour requise" avec un fond rouge très clair.
- **Liste vide** : Affiche le message "Aucun déploiement enregistré" si la liste des déploiements est vide.
- **Erreur** : Affiche un bloc d'erreur rouge contenant le message d'erreur si la requête d'historique échoue (ex: 403 "Admin requis" ou erreur réseau).
- **Composants:** `apps/portail/src/app/pages/user/deployments/deployments.component.ts`, `apps/portail/src/app/pages/user/deployments/deployments.component.html`

### 2-3-5 — Rafraîchissement (Page: Déploiements — Fonctions métier)
- **Bouton de rafraîchissement** : Présence d'un bouton avec l'icône `refresh` à côté du titre du tableau.
- **Rechargement manuel** : Un clic sur le bouton relance la fonction `loadDeployments()` pour récupérer à nouveau l'historique.
- **Réinitialisation des erreurs** : Le clic efface le message d'erreur précédent et repasse l'état en chargement.
- **Composants:** `apps/portail/src/app/pages/user/deployments/deployments.component.ts`, `apps/portail/src/app/pages/user/deployments/deployments.component.html`
