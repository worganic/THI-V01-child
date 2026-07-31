import { Injectable, Type, signal, computed } from '@angular/core';

export interface AdminTabDef {
  id: string;
  label: string;
  icon: string;
  component: Type<any>;
  order?: number;
}

@Injectable({ providedIn: 'root' })
export class AdminTabsRegistryService {
  private _baseTabs  = signal<AdminTabDef[]>([]);
  private _childTabs = signal<AdminTabDef[]>([]);
  private _baseRegistered = false;

  allTabs   = computed(() =>
    [...this._baseTabs(), ...this._childTabs()].sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
  );
  childTabs = this._childTabs.asReadonly();

  registerBase(tabs: AdminTabDef[]): void {
    if (this._baseRegistered) return;
    this._baseRegistered = true;
    this._baseTabs.set(tabs);
  }

  /**
   * Ajoute des onglets enfants au registre. Chaque sous-application appelle
   * ceci indépendamment depuis son propre provider (voir
   * docs/architecture-sous-applications.md) : on ajoute donc aux onglets déjà
   * enregistrés (par id, idempotent) plutôt que de remplacer le tableau,
   * sinon le dernier appelant écraserait les précédents.
   */
  registerChild(tabs: AdminTabDef[]): void {
    this._childTabs.update(existing => {
      const byId = new Map(existing.map(t => [t.id, t]));
      for (const tab of tabs) byId.set(tab.id, tab);
      return [...byId.values()];
    });
  }
}
