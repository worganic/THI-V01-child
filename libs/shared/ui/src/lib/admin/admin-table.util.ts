import { signal } from '@angular/core';

/**
 * Tri d'un tableau d'administration — colonne active + sens, avec l'icône
 * associée. Mutualisé parce que les quatre tableaux d'Admin › Portail ont
 * exactement le même comportement (clic sur l'en-tête : tri croissant, puis
 * décroissant, l'icône suit).
 *
 * Les états sont des signaux : lus depuis un template, ils déclenchent seuls
 * le rafraîchissement, sans dépendre de la stratégie de détection du composant.
 */
export class TableSort<C extends string> {
  readonly column = signal<C | null>(null);
  readonly direction = signal<'asc' | 'desc'>('asc');

  constructor(initialColumn: C | null = null) {
    this.column.set(initialColumn);
  }

  /** Clic sur un en-tête : inverse le sens si la colonne est déjà active. */
  set(column: C): void {
    if (this.column() === column) {
      this.direction.set(this.direction() === 'asc' ? 'desc' : 'asc');
    } else {
      this.column.set(column);
      this.direction.set('asc');
    }
  }

  icon(column: C): string {
    if (this.column() !== column) return '↕';
    return this.direction() === 'asc' ? '↑' : '↓';
  }

  /**
   * Trie une copie de `list`. `value` renvoie, pour une ligne et une colonne,
   * la valeur comparable (chaîne déjà normalisée en minuscules, ou nombre).
   */
  apply<T>(list: T[], value: (item: T, column: C) => string | number): T[] {
    const column = this.column();
    const sorted = [...list];
    if (!column) return sorted;
    const dir = this.direction() === 'asc' ? 1 : -1;
    sorted.sort((a, b) => {
      const va = value(a, column);
      const vb = value(b, column);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
    return sorted;
  }
}

/** Découpe une liste déjà triée. `pageSize` à 0 signifie « Tous ». */
export function paginate<T>(list: T[], pageSize: number, page: number): T[] {
  if (pageSize <= 0) return list;
  const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);
  const start = (current - 1) * pageSize;
  return list.slice(start, start + pageSize);
}
