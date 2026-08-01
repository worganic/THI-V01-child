// AUCUN IMPORT VERS LUI-MÊME EN HAUT DE CE FICHIER !

export interface AppUser {
    id: number;
    matricule: string;
    nom: string;
    prenom: string;
    email: string;
    role: 'SU' | 'ADMIN' | 'USER' | 'INVITE';
    is_active: boolean;
    // Métier (voir Metier ci-dessous, onglet Admin > Métiers) : au plus un par utilisateur,
    // contrairement aux groupes (multiples, via user_groupes) — null/absent = non renseigné.
    metier_id?: number | null;
}

// ✨ MÉTIERS (Dev/Infra/Media/Instructeurs/Commerce/Welcome/Autres...), gérés depuis l'onglet
// Admin > Métiers. Modèle minimal (nom + statut actif), sur le même principe que Groupe/
// Application ci-dessous — mais sans grille de droits associée : un métier n'accorde rien,
// il ne fait que qualifier la fiche utilisateur.
export interface Metier {
    id: number;
    nom: string;
    is_active: boolean;
    // Teinte du tag affiché partout où le métier est montré (voir utils/metier-colors.ts) : une
    // des 6 couleurs fixes du design system, pas une couleur libre — cohérent avec le reste du
    // portail et adapté au thème sombre sans configuration supplémentaire.
    color: string;
}

export interface User {
  id: number;
  nom: string;
  prenom: string;
  matricule: string;
  profil: string;
}

export interface Menu {
  id: number;
  titre: string;
  url: string;
}

export interface Application {
    id: number;
    nom: string;
    description: string;
    url_path: string;
    icone: string;
    is_active: boolean;
}

// ✨ NOUVEAUX MODÈLES
export interface Groupe {
    id: number;
    nom: string;
    description: string;
    ordre: number;
    is_active: boolean;
    applications?: Application[]; 
}

export interface UserApplication {
    id?: number; // INDISPENSABLE POUR QUE L'UPDATE (PUT) FONCTIONNE
    user_id: number;
    application_id: number;
    droits: string;
    application?: Application;
}

export interface GroupeApplication {
    id?: number; // INDISPENSABLE POUR QUE L'UPDATE (PUT) FONCTIONNE
    groupe_id: number;
    application_id: number;
}

export interface UserGroupe {
    id?: number; // INDISPENSABLE POUR QUE L'UPDATE (PUT) FONCTIONNE
    user_id: number;
    groupe_id: number;
}

export interface ShortcutGroup {
    id: string; // Propriété primitive unique indispensable pour le tracking Angular
    name: string;
    description: string;
    isActive: boolean;
}