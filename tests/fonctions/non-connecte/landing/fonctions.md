# Landing — Fonctions métier

<!-- worganic:meta updatedAt="2026-06-21T14:50:17.848Z" updatedBy="Antigravity CLI (agy) / Gemini 3 Pro" -->

---

## `1-1-1` — [modification] Accès et navigation

- **Affichage page publique** : la landing est accessible sans authentification, servie sur la route racine (`''`) via le slot `landing` (voir `docs/architecture-sous-applications.md` § 10) ; surcharge propre à ce portail dans `apps/portail-shell-special/src/app/landing/`, absente côté portail Airbus (racine → `/home` → `/connexion`)
- **Redirection automatique** : la route applique `guestGuard` (`@portail/core-auth`) — un utilisateur déjà connecté est renvoyé vers `/home` avant même que le composant ne se monte
- **Lien vers connexion** : accès au formulaire de login (ouvre le modal de connexion avec des identifiants de test pré-remplis)
- **Lien vers inscription** : accès au formulaire d'inscription (ouvre le modal de création de compte)
- **Priorité:** bloquant
- **Composants:** `apps/portail-shell-special/src/app/landing/landing.component.ts`, `apps/portail-shell-special/src/app/landing/landing.component.html`, `apps/portail-shell/src/app/landing/landing.component.ts` (défaut), `libs/core/auth/src/lib/guest.guard.ts`, `libs/core/data-access/src/lib/auth.service.ts`

---

## `1-1-2` — [modification] Formulaire de connexion

- **Pré-remplissage automatique** : l'ouverture du modal de connexion pré-remplit les champs email et mot de passe avec des identifiants de test (`admin@admin.com` / `admin`)
- **Saisie email** : champ texte avec validation native du format de l'adresse email
- **Saisie mot de passe** : champ masqué
- **Validation locale** : vérification que les champs email et mot de passe ne sont pas vides avec message d'erreur si manquant
- **Soumission** : appel de l'API POST `/api/auth/login` avec `{ email, password }` lors du clic ou de l'appui sur Entrée
- **Succès** : stockage du token JWT (clé `frankenstein_token`) et de l'utilisateur (clé `frankenstein_user`) dans le `localStorage` puis redirection vers `/home` (même shell)
- **Erreur identifiants** : affichage du message d'erreur renvoyé par l'API (ou message par défaut) dans le modal sous forme de bannière d'erreur au-dessus du formulaire
- **État chargement** : bouton de soumission désactivé et affichage d'un spinner pendant la requête
- **Fermeture** : uniquement via la croix ✕ (le clic sur l'overlay et la touche Échap ne ferment plus le modal, fermeture explicite obligatoire)
- **Bascule** : bouton pour rediriger l'utilisateur vers le formulaire d'inscription
- **Priorité:** bloquant
- **Composants:** `apps/portail-shell-special/src/app/landing/landing.component.ts`, `apps/portail-shell-special/src/app/landing/landing.component.html`, `libs/core/data-access/src/lib/auth.service.ts`, `server/server-data.js`

---

## `1-1-3` — [modification] États de la page

- **Non connecté** : affichage normal de la landing page avec un arrière-plan animé de 30 particules
- **Déjà connecté** : la route applique `guestGuard` — redirection immédiate vers `/home` avant même le montage du composant, sans passer par la landing
- **Erreur connexion** : message d'erreur visible dans le modal concerné au-dessus du formulaire
- **Chargement** : spinner et boutons de soumission désactivés pendant le traitement des requêtes
- **Priorité:** critique
- **Composants:** `apps/portail-shell-special/src/app/landing/landing.component.ts`, `apps/portail-shell-special/src/app/landing/landing.component.html`, `libs/core/auth/src/lib/guest.guard.ts`, `libs/core/data-access/src/lib/auth.service.ts`

---

## `1-1-4` — [modification] Formulaire de création de compte

- **Saisie nom d'utilisateur** : champ texte, unique (trim et comparaison insensible à la casse effectués côté serveur)
- **Saisie email** : champ texte, validation du format email, unique (converti en minuscules et trimé côté serveur)
- **Saisie mot de passe** : champ masqué, longueur minimale de 6 caractères requise
- **Saisie confirmation** : champ masqué, doit correspondre au mot de passe
- **Validation locale** : vérification côté client que tous les champs sont saisis, que les mots de passe correspondent et font au moins 6 caractères avant envoi
- **Règles d'attribution du rôle** : affichage d'une information indiquant que le premier utilisateur inscrit devient automatiquement administrateur (`admin`) et les suivants de simples utilisateurs (`user`)
- **Soumission** : appel de l'API POST `/api/auth/register` avec `{ username, email, password }` lors du clic ou de l'appui sur Entrée
- **Succès** : stockage du token JWT (clé `frankenstein_token`) et de l'utilisateur (clé `frankenstein_user`) dans le `localStorage` puis redirection vers `/home` (même shell)
- **Erreur doublon ou validation** : affichage du message d'erreur (email déjà utilisé, nom d'utilisateur déjà pris, ou erreur serveur) dans le modal au-dessus du formulaire
- **État chargement** : bouton de soumission désactivé et affichage d'un spinner pendant la requête
- **Fermeture** : uniquement via la croix ✕ (le clic sur l'overlay et la touche Échap ne ferment plus le modal, fermeture explicite obligatoire)
- **Bascule** : lien de redirection vers le modal de connexion
- **Priorité:** bloquant
- **Composants:** `apps/portail-shell-special/src/app/landing/landing.component.ts`, `apps/portail-shell-special/src/app/landing/landing.component.html`, `libs/core/data-access/src/lib/auth.service.ts`, `server/server-data.js`

---

## `1-1-5` — [modification] Gestion d'erreur de la base de données

- **Affichage de la bannière** : affichage d'une bannière rouge d'erreur "Service indisponible" si l'état de la base de données est en erreur (`dbError`)
- **Affichage IP du client** : affichage de l'IP du client obtenue via la route de health check `/api/health/db` ou via l'API publique de secours `ipify` si le serveur est inaccessible
- **Désactivation des actions** : désactivation des boutons de connexion et d'inscription (Connexion, Créer un compte, Se connecter, Commencer gratuitement, Déjà un compte ? Se connecter) pour empêcher toute action utilisateur tant que la base est indisponible
- **Bouton de reconnexion** : possibilité de relancer la vérification de la connexion à la base via le bouton "Retester la connexion", avec transition de l'icône et affichage d'un texte d'attente "Vérification..."
- **Priorité:** bloquant
- **Composants:** `apps/portail-shell-special/src/app/landing/landing.component.ts`, `apps/portail-shell-special/src/app/landing/landing.component.html`, `libs/core/data-access/src/lib/db-status.service.ts`, `server/server-data.js`

---

## `1-1-6` — [modification] Personnalisation et branding dynamiques

- **Chargement initial** : appel automatique des configurations d'application et de thème à l'initialisation
- **Nom de l'application** : affichage dynamique du nom de l'application (`appName`) dans l'en-tête et le pied de page
- **Mentions de copyright** : affichage dynamique de l'année et du détenteur du copyright dans le pied de page
- **Application du thème et variables CSS** : injection dynamique des variables CSS de thème et des règles CSS personnalisées retournées par le serveur
- **Thème sombre par défaut** : application systématique du thème sombre (`dark`) à l'initialisation de la landing page
- **Priorité:** mineur
- **Composants:** `apps/portail-shell-special/src/app/landing/landing.component.ts`, `apps/portail-shell-special/src/app/landing/landing.component.html`, `libs/core/data-access/src/lib/app-config.service.ts`, `libs/shared/ui/src/lib/service/theme.service.ts`, `server/server-data.js`

---

## `1-1-7` — [modification] Page de connexion du shell commun (`/connexion`)

- **Écran dédié** : page de connexion pleine page servie sur `/connexion`, commune aux deux monorepos (gabarit et feuille de style identiques bit-à-bit, seul l'échange d'identifiants diffère)
- **Champs** : `Identifiant` (porte ici l'adresse e-mail du compte) et `Mot de passe`, tous deux obligatoires — le bouton reste désactivé tant que le formulaire est invalide
- **Soumission** : appel de `AuthService.login()` puis redirection vers `/home`
- **Erreur identifiants** : bannière rouge « Identifiants invalides. » au-dessus du formulaire, avec animation de vibration
- **Lisibilité indépendante du thème hôte** : la carte de connexion est claire quel que soit le thème du portail (sombre, clair, pink). Elle impose sa propre couleur de texte et `color-scheme: light` au lieu d'hériter de celle du `<body>` — titre, texte saisi et placeholders doivent rester lisibles en thème sombre
- **Priorité:** bloquant
- **Composants:** `apps/portail/src/app/connexion/connexion.component.ts`, `apps/portail/src/app/connexion/connexion.component.html`, `apps/portail/src/app/connexion/connexion.component.scss`, `libs/portail-core/data-access/src/lib/auth.service.ts`
