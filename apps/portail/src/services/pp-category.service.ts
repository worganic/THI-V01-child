import { Injectable } from '@angular/core';

export interface AppCategory {
  id: string;
  name: string;
}

export interface AppItem {
  id: string;
  name: string;
  iconPath?: string;
  iconEmoji?: string;
  route: string;
  description: string;
  categoryIds: string[]; // Un outil peut être dans plusieurs catégories
}

@Injectable({ providedIn: 'root' })
export class AppCategoryService {
  // Catégories par défaut du portail
  private defaultCategories: AppCategory[] = [
    { id: 'cat-outils', name: '🛠️ Outils & Métier' },
    { id: 'cat-admin', name: '⚙️ Administration' },
    { id: 'cat-infos', name: 'ℹ️ Informations' }
  ];

  // Catalogue par défaut des applications déclarées dans le code (Auto-détection)
  private defaultApps: AppItem[] = [
    { id: 'si', name: 'SI', iconPath: '/assets/img/ico-menu-si.png', route: '/si/dashboard', description: "Outil d'affectation de tablettes et gestion du matériel.", categoryIds: ['cat-outils'] },
    { id: 'solace', name: 'Solace', iconPath: '/assets/img/ico-menu-solace.png', route: '/solace/dashboard', description: "Supervision MQTT en temps réel.", categoryIds: ['cat-outils', 'cat-admin'] },
    { id: 'qrcode', name: 'QR Code', iconPath: '/assets/img/ico-menu-qrcode.png', route: '/qrcode/admin', description: "Générateur et gestionnaire de QR Codes.", categoryIds: ['cat-outils'] },
    { id: 'informations', name: 'Informations', iconEmoji: 'ℹ️', route: '/informations', description: "Documentations et mises à jour du système.", categoryIds: ['cat-infos'] },
    { id: 'welcomeTele', name: 'Welcome TeleFF', iconPath: '/assets/img/ico-menu-welcomeTele.png', route: '/welcomeTele', description: "Accueil Télémesure.", categoryIds: ['cat-outils'] },
    { id: 'design', name: 'Design', iconPath: '/assets/img/ico-menu-design.png', route: '/design', description: "Accueil Design.", categoryIds: ['cat-outils'] },
    { id: 'recettes', name: 'Recettes', iconEmoji: '🧪', route: '/recettes', description: "Accueil Recettes.", categoryIds: ['cat-outils'] },
    { id: 'exemple', name: 'Exemple', iconEmoji: '💡', route: '/exemple', description: "Composants d'exemple.", categoryIds: ['cat-outils'] },
    // AJOUT DE LA NOUVELLE APPLICATION AGENDA POUR AUTO-DÉTECTION DANS L'ADMIN
    { id: 'agenda', name: 'Agenda Formations', iconEmoji: '📅', route: '/agenda', description: "Gestion des plannings et sessions de formation.", categoryIds: ['cat-outils'] }
  ];

  getCategories(): AppCategory[] {
    const stored = localStorage.getItem('portal_categories');
    return stored ? JSON.parse(stored) : this.defaultCategories;
  }

  saveCategories(cats: AppCategory[]) {
    localStorage.setItem('portal_categories', JSON.stringify(cats));
  }

  getApps(): AppItem[] {
    const stored = localStorage.getItem('portal_apps');

    if (stored) {
      let storedApps: AppItem[] = JSON.parse(stored);

      // AUTO-DÉTECTION : On vérifie s'il y a des applications déclarées dans le code (defaultApps)
      // qui ne sont pas encore présentes dans le cache/registre
      const missingApps = this.defaultApps.filter(defaultApp =>
        !storedApps.some(sa => sa.id === defaultApp.id)
      );

      // Si une nouvelle appli est trouvée dans le code, on l'ajoute au registre
      if (missingApps.length > 0) {
        storedApps = [...storedApps, ...missingApps];
        this.saveApps(storedApps);
      }

      return storedApps;
    }

    return this.defaultApps;
  }

  saveApps(apps: AppItem[]) {
    localStorage.setItem('portal_apps', JSON.stringify(apps));
  }
}