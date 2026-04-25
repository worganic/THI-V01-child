import { Component, OnInit, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../../core/services/auth.service';
import { environment } from '../../../../../environments/environment';

const API = environment.apiDataUrl;

@Component({
  selector: 'app-admin-deployments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-deployments.component.html',
})
export class AdminDeploymentsComponent implements OnInit {
  @Output() versionStatusChange = new EventEmitter<{ upToDate: boolean; localVersion: string; latestDeployment: any } | null>();

  deployments = signal<any[]>([]);
  deployFilterType = signal<string>('');
  deployFilterAi = signal<string>('');
  loadingDeploy = signal(false);
  deployError = signal('');
  deploySuccess = signal(false);
  showDeployForm = signal(false);
  deployVersion = '';
  deployCommitName = '';
  deployDescription = '';
  deployFiles = '';
  deployAi = '';
  deployModel = '';
  deployModIds = '';
  expandedDeploy = signal<number | null>(null);
  versionStatus = signal<{ upToDate: boolean; localVersion: string; latestDeployment: any } | null>(null);

  readonly deployCommitTypes: readonly string[] = ['FIX', 'AMELIORATION', 'MERGE'];

  constructor(private authService: AuthService) {}

  ngOnInit() {
    this.loadVersionStatus();
    this.loadDeployments();
  }

  async loadDeployments() {
    this.loadingDeploy.set(true);
    this.deployError.set('');
    try {
      const token = this.authService.getToken();
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${API}/api/admin/deployments`, { headers });
      if (!res.ok) throw new Error((await res.json()).error || 'Erreur chargement');
      this.deployments.set(await res.json());
    } catch (e: any) {
      this.deployError.set(e?.message || 'Erreur chargement déploiements');
    } finally {
      this.loadingDeploy.set(false);
    }
  }

  async loadVersionStatus() {
    try {
      const res = await fetch(`${API}/api/version/check`);
      const data = await res.json();
      this.versionStatus.set(data);
      this.versionStatusChange.emit(data);
    } catch (e) { console.error('[VERSION]', e); }
  }

  openDeployForm() {
    this.deployVersion = this.versionStatus()?.localVersion || '';
    this.deployCommitName = '';
    this.deployDescription = '';
    this.deployFiles = '';
    this.deployAi = '';
    this.deployModel = '';
    this.deployModIds = '';
    this.deployError.set('');
    this.deploySuccess.set(false);
    this.showDeployForm.set(true);
  }

  closeDeployForm() {
    this.showDeployForm.set(false);
    this.deployError.set('');
    this.deploySuccess.set(false);
  }

  async saveDeployment() {
    if (!this.deployVersion.trim()) return;
    this.loadingDeploy.set(true);
    this.deployError.set('');
    this.deploySuccess.set(false);
    try {
      const token = this.authService.getToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
      const filesArray = this.deployFiles.split('\n').map(f => f.trim()).filter(f => f.length > 0);
      const res = await fetch(`${API}/api/admin/deployments`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          version: this.deployVersion,
          commitName: this.deployCommitName,
          description: this.deployDescription,
          filesModified: filesArray,
          ai: this.deployAi,
          model: this.deployModel,
          modIds: this.deployModIds
        })
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Erreur');
      await this.loadVersionStatus();
      await this.loadDeployments();
      this.showDeployForm.set(false);
    } catch (e: any) {
      this.deployError.set(e?.message || 'Erreur sauvegarde déploiement');
    } finally {
      this.loadingDeploy.set(false);
    }
  }

  toggleDeployDetail(id: number): void {
    this.expandedDeploy.set(this.expandedDeploy() === id ? null : id);
  }

  parseDeployFiles(raw: string | null): string[] {
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return []; }
  }

  formatDeployDate(d: string): string {
    if (!d) return '';
    try {
      return new Date(d).toLocaleString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch { return d; }
  }

  extractCommitType(commitName: string): string | null {
    const match = commitName?.match(/\[(FIX|AMELIORATION|MERGE)\]/);
    return match ? match[1] : null;
  }

  shortCommitType(type: string | null): string {
    switch (type) {
      case 'FIX':          return 'FIX';
      case 'AMELIORATION': return 'AME';
      case 'MERGE':        return 'MRG';
      default:             return type || '';
    }
  }

  extractCommitTitle(commitName: string): string {
    if (!commitName) return '—';
    return commitName.replace(/\s*-\s*\[(FIX|AMELIORATION|MERGE)\]\s*-\s*/, ' - ').trim();
  }

  commitTypeClass(type: string | null): string {
    switch (type) {
      case 'FIX':          return 'bg-red-500/10 text-red-400 border border-red-500/20';
      case 'AMELIORATION': return 'bg-light-primary/10 dark:bg-primary/10 text-light-primary dark:text-primary border border-light-primary/20 dark:border-primary/20';
      case 'MERGE':        return 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
      default:             return '';
    }
  }

  get filteredDeployments(): any[] {
    return this.deployments().filter(dep => {
      const typeMatch = !this.deployFilterType() || this.extractCommitType(dep.commit_name) === this.deployFilterType();
      const aiMatch   = !this.deployFilterAi() || dep.ai === this.deployFilterAi();
      return typeMatch && aiMatch;
    });
  }

  get uniqueDeployAis(): string[] {
    return [...new Set(this.deployments().map(d => d.ai).filter(Boolean))];
  }

  getScopedRows(scope: string, features: string): Array<{scope: string, features: string[]}> {
    const scopes = scope ? scope.split(',').map(s => s.trim()).filter(Boolean) : [];
    if (!scopes.length) return [];
    if (!features) return scopes.map(s => ({ scope: s, features: [] }));
    if (features.includes(':')) {
      return scopes.map(s => {
        for (const entry of features.split(',')) {
          const [sc, f] = entry.split(':');
          if (sc?.trim() === s && f) return { scope: s, features: f.split('|').map(x => x.trim()).filter(Boolean) };
        }
        return { scope: s, features: [] };
      });
    }
    const featList = features.split(',').map(s => s.trim()).filter(Boolean);
    return scopes.map((s, i) => ({ scope: s, features: featList[i] ? [featList[i]] : [] }));
  }

  scopeClass(s: string): string {
    switch (s) {
      case 'frankenstein': return 'bg-light-primary/10 dark:bg-primary/10 text-light-primary dark:text-primary border border-light-primary/20 dark:border-primary/20';
      case 'server':       return 'bg-green-500/10 text-green-400 border border-green-500/20';
      case 'electron':     return 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
      case 'data':         return 'bg-orange-500/10 text-orange-400 border border-orange-500/20';
      default:             return 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
    }
  }
}
