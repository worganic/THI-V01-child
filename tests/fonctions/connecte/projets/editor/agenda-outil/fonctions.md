# Éditeur › Outil Agenda — Fonctions métier

Route : `/projets/:id` (connecté, outil de type `agenda` actif)
Composant : `AgendaOutilComponent`
Accès : utilisateur connecté, projet ouvert

---

## `2-5-2-10-1` — Onglet Semaine

- **Grille horaire** : colonne heures (0h-23h) + 7 colonnes jours (Lun-Dim), hauteur fixe de 56px par heure
- **En-tête jours** : nom court du jour + numéro du jour, date courante surlignée en primary
- **Navigation** : boutons ◀/▶ changent la semaine affichée, bouton "Aujourd'hui" revient à la semaine courante
- **Période** : label dynamique en en-tête (ex: "9 – 15 juin 2026")
- **Événements** : blocs colorés positionnés par heure (top + height calculés depuis startDate/endDate)
- **Clic sur cellule** : ouvre le popup de création avec la date et l'heure pré-remplies
- **Clic sur événement** : ouvre le popup d'édition avec les données de l'événement

## `2-5-2-10-2` — Onglet Mois

- **Grille calendrier** : 7 colonnes (L à D) × 4-6 lignes selon le mois, avec en-tête jours semaine
- **Jours hors mois** : affichés en opacité réduite (40%)
- **Jour courant** : numéro affiché dans un cercle primary
- **Navigation** : boutons ◀/▶ changent le mois, "Aujourd'hui" revient au mois courant
- **Chips événements** : max 3 chips colorées par case, libellé tronqué, mention "+N de plus" si plus de 3
- **Clic sur case** : ouvre le popup de création pré-rempli avec la date du jour (allDay activé)
- **Clic sur chip** : ouvre le popup d'édition de l'événement

## `2-5-2-10-3` — Onglet Année

- **Grille annuelle** : 12 colonnes (mois) × 31 lignes (jours), colonne numéros de jours à gauche
- **Jours invalides** : cellules grisées pour les jours inexistants (ex: 30 fév, 31 nov)
- **Jours avec événements** : fond coloré (couleur du premier événement du jour)
- **Navigation** : boutons ◀/▶ changent l'année, "Aujourd'hui" revient à l'année courante
- **Clic sur cellule valide** : ouvre le popup de création pré-rempli avec la date

## `2-5-2-10-4` — Popup événement

- **Champs** : Titre (requis), Date début, Date fin, Toute la journée (checkbox), Description, Couleur (6 choix)
- **Mode allDay** : bascule les inputs datetime en inputs date simple
- **Palette couleurs** : 6 options (indigo, émeraude, ambre, rose, ciel, violet), sélection visuelle
- **Création** : bouton "Créer" actif uniquement si titre non vide ; crée le fichier JSON dans `data/projets/{id}/agenda/`
- **Édition** : même popup, bouton "Modifier" met à jour le fichier JSON
- **Suppression** : bouton "Supprimer" (rouge) visible en mode édition ; supprime le fichier JSON
- **Fermeture** : clic en dehors du popup ou bouton ✕
- **Feedback chargement** : bouton affiche "Enregistrement..." pendant la requête

---

## `2-5-2-10-5` — [modification] Bouton « Ouvrir la séance »

- **Visibilité** : affiché dans le popup uniquement pour un événement de type séance (`isSeanceEvent`)
- **Action** : émet `navigateToSection(event)` puis ferme le popup → `onAgendaNavigateToSection` (parent)
- **Cible** : bascule sur l'outil propriétaire du dossier, sélectionne et scrolle vers la section correspondant au titre de la séance (`findFolderByTitleLike` : correspondance exacte/préfixe puis par numéro de séance)
- **Mode d'ouverture** : toujours en mode **Edition** (`mode === 'visu'`), jamais en mode Code — via `editorModeRequest` ({ mode: 'visu', token }) propagé jusqu'à la zone qui appelle `setMode('visu')`

---

## `2-5-2-10-6` — [modification] Ouverture d'un événement depuis la sidebar

- **Déclenchement** : clic sur un événement listé dans la sidebar de l'outil agenda (voir sidebar `2-5-2-2-19`)
- **Entrée** : Input `openEventRequest` ({ event, token }) ; le token force le re-déclenchement même pour le même événement
- **Comportement** : passe en vue **Mois**, positionne `currentDate` sur la date de l'événement, puis ouvre le popup de l'événement (`onEventClick`) — utilise la version fraîche en mémoire si déjà chargée, sinon la copie reçue
- **Synchronisation** : tout changement de la liste d'événements (chargement, création, édition, suppression, drag) émet `eventsChanged` → le parent rafraîchit la liste de la sidebar
- **Pas de réouverture parasite** : sélectionner l'outil agenda par son en-tête (`outilSelect`) réinitialise `agendaEventToOpen` à null → le (re)montage de l'agenda n'ouvre PAS un popup d'événement périmé
