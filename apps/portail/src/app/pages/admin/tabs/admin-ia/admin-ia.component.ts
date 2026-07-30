import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AuthService } from '@worganic/portail-core/data-access';
import { environment } from '../../../../../environments/environment';

const API = environment.apiDataUrl;
const EXECUTOR_API = environment.apiExecutorUrl;

export type IaProvider = 'claude' | 'antigravity';

export interface IaSkill {
  id: number;
  title: string;
  text: string;
  ia_provider: IaProvider | '';
  ia_model: string;
  created_by_username?: string;
  created_at?: string;
  updated_at?: string;
}

interface IaModelOption { value: string; label: string; }

@Component({
  selector: 'app-admin-ia',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-ia.component.html',
})
export class AdminIaComponent implements OnInit {
  constructor(private authService: AuthService, private sanitizer: DomSanitizer) {}

  // ── Liste ─────────────────────────────────────────────────────────────────
  skills = signal<IaSkill[]>([]);
  loading = signal(false);
  error = signal('');
  deletingId = signal<number | null>(null);

  // ── Modèles disponibles (source : Config › Intelligence Artificielle › Outils CLI) ──
  cliModels: Record<IaProvider, IaModelOption[]> = { claude: [], antigravity: [] };

  providerLabels: Record<IaProvider, string> = {
    claude: 'Claude Code',
    antigravity: 'Antigravity CLI',
  };

  // ── Formulaire (création / édition) ─────────────────────────────────────────
  showForm = signal(false);
  editing = signal<IaSkill | null>(null);
  formTitle = '';
  formText = '';
  formProvider: IaProvider | '' = '';
  formModel = '';
  saving = signal(false);
  previewMode = signal(false);

  async ngOnInit() {
    await this.loadSkills();
    this.loadCliModels();
  }

  private authHeaders(): Record<string, string> {
    const token = this.authService.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  // ── Chargement des modèles CLI (best-effort, l'executor local peut être hors-ligne) ──
  loadCliModels() {
    fetch(`${EXECUTOR_API}/api/cli-status`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!data) return;
        this.cliModels.claude = data.claude?.models || [];
        this.cliModels.antigravity = data.antigravity?.models || [];
      })
      .catch(() => {});
  }

  modelsFor(provider: IaProvider | ''): IaModelOption[] {
    return provider ? this.cliModels[provider] : [];
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────
  async loadSkills() {
    this.loading.set(true);
    this.error.set('');
    try {
      const res = await fetch(`${API}/api/admin/ia-skills`, { headers: this.authHeaders() });
      if (!res.ok) throw new Error((await res.json()).error || 'Erreur chargement');
      this.skills.set(await res.json());
    } catch (e: any) {
      this.error.set(e?.message || 'Erreur chargement des skills');
    } finally {
      this.loading.set(false);
    }
  }

  openNew() {
    this.editing.set(null);
    this.formTitle = '';
    this.formText = '';
    this.formProvider = '';
    this.formModel = '';
    this.previewMode.set(false);
    this.showForm.set(true);
  }

  openEdit(skill: IaSkill) {
    this.editing.set(skill);
    this.formTitle = skill.title;
    this.formText = skill.text;
    this.formProvider = (skill.ia_provider as IaProvider) || '';
    this.formModel = skill.ia_model || '';
    this.previewMode.set(false);
    this.showForm.set(true);
  }

  closeForm() {
    this.showForm.set(false);
  }

  onProviderChange() {
    this.formModel = '';
  }

  async saveSkill() {
    if (!this.formTitle.trim() || !this.formText.trim()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      const body = JSON.stringify({
        title: this.formTitle,
        text: this.formText,
        iaProvider: this.formProvider,
        iaModel: this.formModel,
      });
      const headers = { 'Content-Type': 'application/json', ...this.authHeaders() };
      const current = this.editing();
      const res = await fetch(
        current ? `${API}/api/admin/ia-skills/${current.id}` : `${API}/api/admin/ia-skills`,
        { method: current ? 'PUT' : 'POST', headers, body }
      );
      if (!res.ok) throw new Error((await res.json()).error || 'Erreur sauvegarde');
      this.closeForm();
      await this.loadSkills();
    } catch (e: any) {
      this.error.set(e?.message || 'Erreur sauvegarde');
    } finally {
      this.saving.set(false);
    }
  }

  confirmDelete(id: number) { this.deletingId.set(id); }
  cancelDelete() { this.deletingId.set(null); }

  async deleteSkill(id: number) {
    try {
      const res = await fetch(`${API}/api/admin/ia-skills/${id}`, { method: 'DELETE', headers: this.authHeaders() });
      if (!res.ok) throw new Error((await res.json()).error || 'Erreur suppression');
      this.deletingId.set(null);
      await this.loadSkills();
    } catch (e: any) {
      this.error.set(e?.message || 'Erreur suppression');
      this.deletingId.set(null);
    }
  }

  // ── Markdown (aperçu léger, sans dépendance externe) ─────────────────────────
  renderMarkdown(content: string): SafeHtml {
    if (!content) return this.sanitizer.bypassSecurityTrustHtml('');
    const html = this.escapeHtml(content)
      .replace(/```[\w]*\n?([\s\S]*?)```/g, '<pre class="bg-black/30 rounded-lg p-3 text-xs overflow-x-auto my-2 font-mono"><code>$1</code></pre>')
      .replace(/`([^`\n]+)`/g, '<code class="bg-black/20 px-1.5 py-0.5 rounded text-xs font-mono">$1</code>')
      .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
      .replace(/^### (.+)$/gm, '<h3 class="font-bold text-sm mt-3 mb-1">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="font-bold text-base mt-4 mb-1.5">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 class="font-bold text-lg mt-4 mb-2">$1</h1>')
      .replace(/^---$/gm, '<hr class="border-light-border dark:border-white/10 my-3">')
      .replace(/^[*\-] (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
      .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
      .replace(/\n\n/g, '</p><p class="mb-2">')
      .replace(/\n/g, '<br>');
    return this.sanitizer.bypassSecurityTrustHtml(`<p class="mb-2 leading-relaxed">${html}</p>`);
  }

  private escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  formatDate(iso?: string): string {
    if (!iso) return '';
    return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}
