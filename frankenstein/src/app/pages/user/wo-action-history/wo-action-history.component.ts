import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WoActionHistoryService, WoActionEntry } from '../../../core/services/wo-action-history.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-wo-action-history',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './wo-action-history.component.html',
  styleUrl: './wo-action-history.component.scss'
})
export class WoActionHistoryComponent implements OnInit {
  private historyService = inject(WoActionHistoryService);
  private auth = inject(AuthService);

  loading = signal(false);
  undoing = signal<string | null>(null);
  error = signal('');
  showInfo = signal(false);

  readonly trackedTools = [
    {
      label: 'Admin › Utilisateurs',
      section: 'admin/users',
      icon: 'manage_accounts',
      colorText: 'text-red-400',
      colorBg: 'bg-red-500/5 border-red-500/15',
      actions: [
        { type: 'create', label: 'Création',     undoable: true,  note: 'Supprime l\'utilisateur créé' },
        { type: 'update', label: 'Modification', undoable: true,  note: 'Restaure username, email, rôle' },
        { type: 'delete', label: 'Suppression',  undoable: false, note: 'Non réversible — mot de passe non récupérable' }
      ]
    },
    {
      label: 'Documents › Catégories',
      section: 'documents',
      icon: 'folder',
      colorText: 'text-blue-400',
      colorBg: 'bg-blue-500/5 border-blue-500/15',
      actions: [
        { type: 'create', label: 'Création catégorie',     undoable: true,  note: 'Supprime la catégorie créée' },
        { type: 'update', label: 'Modification catégorie', undoable: true,  note: 'Restaure nom et description' },
        { type: 'delete', label: 'Suppression catégorie',  undoable: false, note: 'Non réversible' }
      ]
    },
    {
      label: 'Documents › Documents',
      section: 'documents',
      icon: 'description',
      colorText: 'text-sky-400',
      colorBg: 'bg-sky-500/5 border-sky-500/15',
      actions: [
        { type: 'create', label: 'Création document',     undoable: true,  note: 'Supprime le document créé' },
        { type: 'update', label: 'Modification document', undoable: true,  note: 'Restaure titre, description, catégorie, visibilité — contenu texte non inclus' },
        { type: 'delete', label: 'Suppression document',  undoable: false, note: 'Non réversible — contenu définitivement perdu' }
      ]
    },
    {
      label: 'Admin › Config',
      section: 'admin/config',
      icon: 'settings',
      colorText: 'text-amber-400',
      colorBg: 'bg-amber-500/5 border-amber-500/15',
      actions: [
        { type: 'toggle', label: 'Toggle setting/outil/provider/modèle', undoable: false, note: 'Non réversible via undo — toggle manuel' },
        { type: 'update', label: 'Sauvegarde clés API',                  undoable: false, note: 'Valeurs des clés non enregistrées, seulement le statut actif' }
      ]
    }
  ];

  filterSectionValue = '';
  filterUserIdValue = '';
  filterActionTypeValue = '';
  filterDateMode: 'all' | 'today' | 'week' | 'month' | 'custom' = 'all';
  filterDateCustom = '';

  get isAdmin() { return this.auth.currentUser()?.role === 'admin'; }

  get availableSections(): string[] {
    const sections = new Set(this.historyService.entries().map(e => e.section));
    return Array.from(sections).sort();
  }

  get availableUsers(): { id: string; name: string }[] {
    const users = new Map<string, string>();
    this.historyService.entries().forEach(e => {
      if (e.userId && e.username) users.set(e.userId, e.username);
    });
    return Array.from(users.entries()).map(([id, name]) => ({ id, name }));
  }

  get filteredEntries(): WoActionEntry[] {
    let list = this.historyService.entries();
    if (this.filterSectionValue)    list = list.filter(e => e.section === this.filterSectionValue);
    if (this.filterUserIdValue)     list = list.filter(e => e.userId === this.filterUserIdValue);
    if (this.filterActionTypeValue) list = list.filter(e => e.actionType === this.filterActionTypeValue);
    if (this.filterDateMode !== 'all') {
      const now = new Date();
      const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
      if (this.filterDateMode === 'today') {
        const start = startOf(now);
        list = list.filter(e => new Date(e.timestamp) >= start);
      } else if (this.filterDateMode === 'week') {
        const start = startOf(now);
        start.setDate(start.getDate() - ((now.getDay() + 6) % 7)); // lundi
        list = list.filter(e => new Date(e.timestamp) >= start);
      } else if (this.filterDateMode === 'month') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        list = list.filter(e => new Date(e.timestamp) >= start);
      } else if (this.filterDateMode === 'custom' && this.filterDateCustom) {
        const start = new Date(this.filterDateCustom);
        const end   = new Date(this.filterDateCustom);
        end.setDate(end.getDate() + 1);
        list = list.filter(e => { const t = new Date(e.timestamp); return t >= start && t < end; });
      }
    }
    return list;
  }

  get activeDateLabel(): string {
    const labels: Record<string, string> = {
      all: '', today: "Aujourd'hui", week: 'Cette semaine', month: 'Ce mois'
    };
    if (this.filterDateMode === 'custom' && this.filterDateCustom) {
      return new Date(this.filterDateCustom).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    }
    return labels[this.filterDateMode] || '';
  }

  setDateMode(mode: string) {
    this.filterDateMode = mode as 'all' | 'today' | 'week' | 'month' | 'custom';
    this.filterDateCustom = '';
  }

  resetDateFilter() {
    this.filterDateMode = 'all';
    this.filterDateCustom = '';
  }

  get groupedEntries(): { day: string; entries: WoActionEntry[] }[] {
    const groups = new Map<string, WoActionEntry[]>();
    for (const entry of this.filteredEntries) {
      const day = new Date(entry.timestamp).toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      });
      if (!groups.has(day)) groups.set(day, []);
      groups.get(day)!.push(entry);
    }
    return Array.from(groups.entries()).map(([day, entries]) => ({ day, entries }));
  }

  get undoableCount(): number {
    return this.filteredEntries.filter(e => e.undoable && !e.undone).length;
  }

  async ngOnInit() {
    await this.loadHistory();
  }

  async loadHistory() {
    this.loading.set(true);
    this.error.set('');
    try {
      await this.historyService.load({ limit: 300 });
    } catch {
      this.error.set("Erreur lors du chargement de l'historique");
    } finally {
      this.loading.set(false);
    }
  }

  async undoAction(entry: WoActionEntry) {
    if (!entry.undoable || entry.undone || this.undoing()) return;
    this.undoing.set(entry.id);
    this.error.set('');
    try {
      await this.historyService.undo(entry.id);
    } catch (e: any) {
      this.error.set(e?.error?.error || "Erreur lors de l'annulation");
    } finally {
      this.undoing.set(null);
    }
  }

  private readonly sensitiveFields = new Set(['password', 'token', 'secret', 'hash']);

  private parseState(state: any): Record<string, any> | null {
    if (!state) return null;
    if (typeof state === 'string') {
      try { return JSON.parse(state); } catch { return null; }
    }
    if (typeof state === 'object' && !Array.isArray(state)) return state;
    return null;
  }

  getDiffFields(entry: WoActionEntry): { field: string; before: any; after: any }[] {
    const before = this.parseState(entry.beforeState);
    const after = this.parseState(entry.afterState);

    if (entry.actionType === 'update' && before && after) {
      const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
      return Array.from(allKeys)
        .filter(k => !this.sensitiveFields.has(k))
        .filter(k => JSON.stringify(before[k]) !== JSON.stringify(after[k]))
        .map(k => ({ field: k, before: before[k], after: after[k] }));
    }
    if (entry.actionType === 'create' && after) {
      return Object.entries(after)
        .filter(([k]) => !this.sensitiveFields.has(k))
        .map(([k, v]) => ({ field: k, before: null, after: v }));
    }
    if (entry.actionType === 'delete' && before) {
      return Object.entries(before)
        .filter(([k]) => !this.sensitiveFields.has(k))
        .map(([k, v]) => ({ field: k, before: v, after: null }));
    }
    return [];
  }

  fieldLabel(field: string): string {
    const labels: Record<string, string> = {
      username: 'Nom', email: 'Email', role: 'Rôle',
      name: 'Nom', description: 'Description', category: 'Catégorie',
      visible: 'Visibilité', visibility: 'Visibilité', title: 'Titre',
      active: 'Actif', enabled: 'Activé', categoryId: 'Catégorie',
      headerIaVisible: 'Header IA', appVersion: 'Version app',
      geminiActive: 'Gemini actif', claudeActive: 'Claude actif'
    };
    return labels[field] || field;
  }

  formatFieldValue(val: any): string {
    if (val === null || val === undefined) return '—';
    if (typeof val === 'boolean') return val ? 'Activé' : 'Désactivé';
    return String(val);
  }

  actionTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      create: 'Création', update: 'Modification', delete: 'Suppression',
      toggle: 'Activation', upload: 'Import', navigate: 'Navigation'
    };
    return labels[type] || type;
  }

  actionTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      create: 'add_circle', update: 'edit', delete: 'delete',
      toggle: 'toggle_on', upload: 'upload_file', navigate: 'navigation'
    };
    return icons[type] || 'history';
  }

  actionTypeColor(type: string): string {
    const colors: Record<string, string> = {
      create: 'text-emerald-400',
      update: 'text-blue-400',
      delete: 'text-red-400',
      toggle: 'text-violet-400',
      upload: 'text-amber-400',
      navigate: 'text-gray-400'
    };
    return colors[type] || 'text-gray-400';
  }

  actionTypeBgBorder(type: string): string {
    const colors: Record<string, string> = {
      create: 'bg-emerald-500/10 border-emerald-500/20',
      update: 'bg-blue-500/10 border-blue-500/20',
      delete: 'bg-red-500/10 border-red-500/20',
      toggle: 'bg-violet-500/10 border-violet-500/20',
      upload: 'bg-amber-500/10 border-amber-500/20',
      navigate: 'bg-gray-500/10 border-gray-500/20'
    };
    return colors[type] || 'bg-gray-500/10 border-gray-500/20';
  }

  formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  formatContextLabel(context: Record<string, any> | undefined): string {
    if (!context) return '';
    if (context['projectName']) return `Projet : ${context['projectName']}`;
    if (context['categoryName']) return `Catégorie : ${context['categoryName']}`;
    return '';
  }

  sectionLabel(section: string): string {
    const labels: Record<string, string> = {
      'admin/users':  'Admin › Utilisateurs',
      'admin/config': 'Admin › Config',
      'documents':    'Documents',
      'projets':      'Projets'
    };
    return labels[section] || section;
  }
}
