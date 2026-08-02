# Admin — Projets

Route : `/admin/app/projets` (hébergée par la route générique `admin/app/:id`, voir `AdminAppHostComponent`)  
Composant : `AdminProjetsComponent`

## `2-1-6-1` — Liste et gestion des projets

- Affichage de tous les projets en tableau (titre, auteur, statut, date)
- Bouton rafraîchir la liste
- Ouverture d'un projet dans l'app Projets
- Modification du titre et du statut d'un projet
- Suppression d'un projet (confirmation inline)

## `2-1-6-2` — Instructions IA par projet (édition libre)

- Ouverture du panneau IA depuis le bouton `psychology` dans le tableau
- Saisie libre d'instructions système dans la textarea
- Indicateur de longueur et état actif/inactif
- Sauvegarde des instructions dans le champ `iaInstructions` du projet
- Effacement des instructions (champ vide = pas d'override)

## `2-1-6-3` — Bibliothèque d'instructions IA (depuis Documents)

- Accès via l'onglet "Instructions IA" dans Admin Projets
- Création automatique de la catégorie "Instructions IA" dans Documents si absente
- Affichage de tous les documents de la catégorie "Instructions IA"
- Prévisualisation tronquée du contenu (120 premiers caractères)
- Bouton "Gérer dans Documents" : navigation vers la page Documents
- Rafraîchissement de la liste
- État vide avec call-to-action vers la page Documents

## `2-1-6-4` — Application d'une instruction à un projet

- Bouton "Appliquer à un projet" par instruction dans la liste
- Modal de sélection du projet cible (dropdown)
- Confirmation → copie du `text` du document dans `iaInstructions` du projet
- Remplacement des instructions existantes du projet
- Fermeture automatique de la modal après succès

## `2-1-6-5` — Chargement d'une instruction dans la modale IA

- Bouton "Charger depuis la bibliothèque" dans la modale IA du projet
- Picker inline collapsible affichant les docs "Instructions IA"
- Chargement lazy (uniquement si aucun doc en cache)
- Sélection d'un doc → son contenu est chargé dans la textarea
- L'utilisateur peut modifier le contenu avant de sauvegarder
- Fermeture du picker après sélection

## `2-1-6-6` — [modification] Panneau de sauvegarde projet (backup)

- Ouverture depuis le bouton sauvegarde (icône cloud) sur la ligne du projet
- Sélection du type : Aucun / GitHub / GitLab / FTP / Google Drive
- Champs communs (serveur/owner, mot de passe/token) + champs FTP spécifiques (utilisateur, port, répertoire) et bouton "Tester la connexion FTP"
- **Option FTP conditionnée au réglage global** (`connecte/config` › `2-2-10`) : l'option "FTP" du select est désactivée (libellé "FTP (désactivé — Config)") tant que la synchronisation FTP n'est pas réactivée dans Admin › Config. Un projet déjà configuré en FTP affiche un avertissement ambre indiquant qu'il est traité comme sans sauvegarde tant que le réglage global reste éteint (aucune donnée du projet n'est modifiée, juste ignorée côté synchro).
- **Composants:** `admin-projets.component.ts`, `admin-projets.component.html`, `libs/portail-core/data-access/src/lib/config.service.ts`, `server/server-data.js`, `server/modules/ftp-service.js`

## `2-1-6-7` — [modification] Navigation entre les deux sous-onglets (Projets / Instructions IA)

- **Sous-onglets en état local** : `activeSubTab` est un signal local, non reflété dans l'URL (pas de deep-link par sous-onglet) — un rafraîchissement de page revient sur "Projets".
- Auparavant le composant attendait un segment de route `/admin/projets/:subtab` dédié ; devenu inexistant après le passage à la route générique `admin/app/:id`, il retentait de naviguer vers ce chemin à chaque montage, chemin qui ne correspondait plus à aucune route et tombait sur le wildcard de secours (`redirectTo: 'home'`) — l'onglet "Applications" de l'admin renvoyait donc systématiquement à l'accueil connecté. Corrigé en retirant la dépendance à un paramètre de route.
- **Composants:** `admin-projets.component.ts`
