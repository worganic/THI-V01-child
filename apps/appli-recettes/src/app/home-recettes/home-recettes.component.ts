import { Component, OnInit, inject, signal, computed, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, ParamMap } from '@angular/router';
import { forkJoin } from 'rxjs';
import { CahierComponent } from './cahier/cahier.component';
import { ExecutionComponent } from './execution/execution.component';
import { ResultatsComponent } from './resultats/resultats.component';
import { RecipeService } from '../services/recipe.service';
import { RecipeBook, BookStats, BookQualityStatus, RecentSessionEntry, TestEnvironment } from '../models/recipe.model';

const EMPTY_STATS: BookStats = { categories: 0, applicatifs: 0, sections: 0, tests: 0, sessions: 0, campaigns: 0 };
const EMPTY_QUALITY: BookQualityStatus = { verdict: 'PENDING', successRate: 0, coverageRate: 0, bloquantFailed: [], majeurFailed: [], enCours: false, lastActivity: null };

/** Seuil de réussite exigé par environnement pour la mise en production (voir evaluateQualityGate) — uniquement pour l'affichage du bandeau d'alerte. */
const SUCCESS_THRESHOLD_LABEL: Record<TestEnvironment, string> = { PROD: '100%', PREPROD: '95%', VAL: '85%', DEV: '60%' };

export interface VigilanceItem {
  label: string;
  criticality: 'Bloquant' | 'Majeur';
  bookId: string;
  bookName: string;
}

export interface ActivityItem {
  bookId: string;
  bookName: string;
  status: 'GO' | 'NO-GO' | 'PENDING';
  testerName: string;
  dateExecuted: string;
}

@Component({
  selector: 'app-home-recettes',
  standalone: true,
  imports: [CommonModule, FormsModule, CahierComponent, ExecutionComponent, ResultatsComponent],
  templateUrl: './home-recettes.component.html',
  styleUrls: ['./home-recettes.component.scss']
})
export class HomeRecettesComponent implements OnInit {
  private recipeService = inject(RecipeService);
  private cdr = inject(ChangeDetectorRef);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  // 🛡️ Bloque l'affichage UI pendant la résolution de l'URL
  isRouteResolving = true;

  // Mode Strict Airbus : Typage fort et utilisation de Signals
  books = signal<RecipeBook[]>([]);
  bookStats = signal<Record<string, BookStats>>({});
  qualityByBook = signal<Record<string, BookQualityStatus>>({});
  recentSessions = signal<RecentSessionEntry[]>([]);
  sessionsThisMonth = signal<number>(0);
  selectedBook: RecipeBook | null = null;
  activeTab: 'cahier' | 'execution' | 'resultats' = 'cahier';

  /** Cahier NO-GO le plus critique (le moins de réussite), pour le bandeau d'alerte. */
  heroNoGoBook = computed(() => {
    const quality = this.qualityByBook();
    const noGoBooks = this.books()
      .map(b => ({ book: b, q: quality[b.id] }))
      .filter(x => x.q && x.q.verdict === 'NO-GO')
      .sort((a, b) => a.q.successRate - b.q.successRate);
    if (noGoBooks.length === 0) return null;
    const worst = noGoBooks[0];
    const env = worst.q.lastActivity?.environment || 'VAL';
    return {
      book: worst.book,
      quality: worst.q,
      thresholdLabel: SUCCESS_THRESHOLD_LABEL[env],
      environment: env,
      failedCount: worst.q.bloquantFailed.length
    };
  });

  globalKpis = computed(() => {
    const books = this.books();
    const quality = this.qualityByBook();
    const stats = this.bookStats();

    const enCoursCount = books.filter(b => quality[b.id]?.enCours).length;
    const noGoCount = books.filter(b => quality[b.id]?.verdict === 'NO-GO').length;
    const totalTests = books.reduce((sum, b) => sum + (stats[b.id]?.tests || 0), 0);

    // Réussite globale pondérée par le nombre de tests exécutés de chaque cahier (les cahiers
    // jamais exécutés — PENDING — ne comptent pas dans la moyenne, ils n'ont rien à peser).
    let weightedSum = 0;
    let weightTotal = 0;
    let executedTotal = 0;
    books.forEach(b => {
      const q = quality[b.id];
      if (!q || q.verdict === 'PENDING') return;
      const executed = Math.round((q.coverageRate / 100) * (stats[b.id]?.tests || 0));
      weightedSum += q.successRate * executed;
      weightTotal += executed;
      executedTotal += executed;
    });
    const globalSuccessRate = weightTotal > 0 ? Math.round(weightedSum / weightTotal) : 0;

    return {
      totalBooks: books.length,
      enCoursCount,
      noGoCount,
      totalTests,
      executedTotal,
      globalSuccessRate,
      sessionsThisMonth: this.sessionsThisMonth()
    };
  });

  /** Répartition des verdicts pour la barre "Vue globale" — cahiers PENDING exclus (rien à trancher encore). */
  verdictDistribution = computed(() => {
    const quality = this.qualityByBook();
    const counts = { go: 0, cond: 0, nogo: 0 };
    this.books().forEach(b => {
      const v = quality[b.id]?.verdict;
      if (v === 'GO') counts.go++;
      else if (v === 'GO-CONDITIONAL') counts.cond++;
      else if (v === 'NO-GO') counts.nogo++;
    });
    return counts;
  });

  /** Tests bloquants/majeurs en échec, tous cahiers confondus, triés par criticité — plafonné à 5. */
  vigilanceItems = computed<VigilanceItem[]>(() => {
    const quality = this.qualityByBook();
    const items: VigilanceItem[] = [];
    this.books().forEach(b => {
      const q = quality[b.id];
      if (!q) return;
      q.bloquantFailed.forEach(t => items.push({ label: t.name, criticality: 'Bloquant', bookId: b.id, bookName: b.name }));
    });
    this.books().forEach(b => {
      const q = quality[b.id];
      if (!q) return;
      q.majeurFailed.forEach(t => items.push({ label: t.name, criticality: 'Majeur', bookId: b.id, bookName: b.name }));
    });
    return items.slice(0, 5);
  });

  activityFeed = computed<ActivityItem[]>(() => {
    const books = this.books();
    return this.recentSessions().slice(0, 4).map(s => ({
      bookId: s.bookId,
      bookName: books.find(b => b.id === s.bookId)?.name || 'Cahier supprimé',
      status: s.status,
      testerName: s.testerName,
      dateExecuted: s.dateExecuted
    }));
  });

  showModal = false;
  modalMode: 'add' | 'edit' = 'add';
  bookForm = { id: '', name: '', description: '' };
  executionTarget = 'ALL';

  private currentParams: ParamMap | null = null;

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      this.currentParams = params;
      this.applyRouteState();
    });
    this.loadBooks();
  }

  loadBooks() {
    forkJoin({
      safeBooks: this.recipeService.getBooks(),
      stats: this.recipeService.getBooksStats(),
      quality: this.recipeService.getBooksQualityOverview()
    }).subscribe({
      next: ({ safeBooks, stats, quality }) => {
        if (safeBooks.length > 1) {
          safeBooks.sort((a, b) => {
            const dateA = a.dateCreated ? new Date(a.dateCreated.replace(' ', 'T')).getTime() : 0;
            const dateB = b.dateCreated ? new Date(b.dateCreated.replace(' ', 'T')).getTime() : 0;
            return dateB - dateA;
          });
        }
        this.books.set(safeBooks);
        this.bookStats.set(stats);
        this.qualityByBook.set(quality.perBook);
        this.recentSessions.set(quality.recentSessions);
        this.sessionsThisMonth.set(quality.sessionsThisMonth);
        this.applyRouteState();

        // 🛡️ Les données de base sont là, on débloque l'interface
        this.isRouteResolving = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error("Erreur chargement des cahiers :", err);
        this.isRouteResolving = false;
        this.cdr.detectChanges();
      }
    });
  }

  /** Compteurs agrégés d'un cahier (catégories, tests, sessions, campagnes...) pour l'affichage des cartes. */
  getStats(bookId: string): BookStats {
    return this.bookStats()[bookId] || EMPTY_STATS;
  }

  /** Statut qualité d'un cahier (verdict, taux de réussite, tests en échec...) pour l'affichage des cartes. */
  getQuality(bookId: string): BookQualityStatus {
    return this.qualityByBook()[bookId] || EMPTY_QUALITY;
  }

  /** Classe CSS du verdict (go / go-cond / no-go / pending), pour les pastilles et barres de progression. */
  verdictClass(verdict: BookQualityStatus['verdict']): string {
    switch (verdict) {
      case 'GO': return 'go';
      case 'GO-CONDITIONAL': return 'go-cond';
      case 'NO-GO': return 'no-go';
      default: return 'pending';
    }
  }

  verdictLabel(verdict: BookQualityStatus['verdict']): string {
    switch (verdict) {
      case 'GO': return 'GO';
      case 'GO-CONDITIONAL': return 'GO-COND.';
      case 'NO-GO': return 'NO-GO';
      default: return 'PENDING';
    }
  }

  /** Formatage relatif court ("il y a 5 min", "il y a 2h", "23/07/2026") pour l'activité récente. */
  formatRelativeDate(dateStr: string | undefined): string {
    if (!dateStr) return '—';
    const date = new Date(dateStr.replace(' ', 'T'));
    if (isNaN(date.getTime())) return '—';
    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "à l'instant";
    if (diffMin < 60) return `il y a ${diffMin} min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `il y a ${diffH}h`;
    const diffJ = Math.floor(diffH / 24);
    if (diffJ < 7) return `il y a ${diffJ}j`;
    return this.formatBookDate(dateStr);
  }

  /**
   * Analyse l'URL et synchronise l'UI (Onglets et Détail)
   */
  private applyRouteState() {
    if (!this.currentParams) return;

    const bookId = this.currentParams.get('bookId');
    const tab = this.currentParams.get('tab') as 'cahier' | 'execution' | 'resultats';

    if (bookId) {
      if (this.books().length === 0) return; // On attend que loadBooks() finisse

      const bookToOpen = this.books().find(b => b.id === bookId);
      if (bookToOpen && (!this.selectedBook || this.selectedBook.id !== bookId)) {

        // 🚀 FIX ANTI-FLASH : On bascule l'UI sur la vue détaillée IMMÉDIATEMENT, 
        // sans attendre que loadBookDetails() ait fini de charger les catégories !
        this.selectedBook = bookToOpen;

        this.loadBookDetails(bookToOpen); // Requêtes asynchrones en arrière-plan
      }

      if (tab && ['cahier', 'execution', 'resultats'].includes(tab)) {
        this.activeTab = tab;
      } else {
        this.activeTab = 'cahier';
      }
    } else {
      this.selectedBook = null;
    }
    this.cdr.detectChanges();
  }

  /**
   * Méthode appelée par le HTML : Pousse la nouvelle URL relative
   */
  openBook(book: RecipeBook) {
    // Navigue en fonction du contexte du module encapsulé (relativeTo: parent)
    this.router.navigate(['./', book.id, 'cahier'], { relativeTo: this.route.parent });
  }

  /** Variante par id, pour le bandeau d'alerte et les points de vigilance (pas d'objet RecipeBook sous la main). */
  openBookById(bookId: string) {
    const book = this.books().find(b => b.id === bookId);
    if (book) this.openBook(book);
  }

  /**
   * Chargement de l'arbre du cahier, via RecipeService.getFullTree() — mutualisée avec
   * ResultatsComponent : si l'utilisateur arrive directement sur l'onglet Résultats juste après
   * l'ouverture du cahier, les deux composants partagent la même requête au lieu de charger
   * chacun leur propre copie de l'arborescence en parallèle.
   */
  private loadBookDetails(book: RecipeBook) {
    this.recipeService.getFullTree(book.id).subscribe({
      next: (categories) => {
        book.categories = categories || [];
        this.cdr.detectChanges();
      },
      error: (err) => console.error("Erreur lors de l'hydratation de l'arborescence :", err)
    });
  }

  hasTests(book: RecipeBook | null): boolean {
    if (!book) return false;
    return book.categories.some(cat =>
      cat.applicatifs && cat.applicatifs.some(app =>
        app.sections && app.sections.length > 0
      )
    );
  }

  closeBook() {
    // Retourne à la liste principale
    this.router.navigate(['./'], { relativeTo: this.route.parent });
  }

  switchTab(tab: 'cahier' | 'execution' | 'resultats') {
    if ((tab === 'execution' || tab === 'resultats') && !this.hasTests(this.selectedBook)) {
      return;
    }
    if (tab !== 'execution') {
      this.executionTarget = 'ALL';
    }

    if (this.selectedBook) {
      // Met à jour dynamiquement le paramètre :tab dans l'URL
      this.router.navigate(['./', this.selectedBook.id, tab], { relativeTo: this.route.parent });
    }
  }

  openCreateModal() {
    this.modalMode = 'add';
    this.bookForm = { id: '', name: '', description: '' };
    this.showModal = true;
  }

  openEditModal(book: RecipeBook, event: Event) {
    event.stopPropagation();
    this.modalMode = 'edit';
    this.bookForm = { id: book.id, name: book.name, description: book.description };
    this.showModal = true;
  }

  deleteBook(bookId: string, event: Event) {
    event.stopPropagation();
    if (confirm("Voulez-vous vraiment supprimer ce cahier de recette et tout son historique ?")) {
      this.recipeService.deleteBook(bookId).subscribe(() => this.loadBooks());
    }
  }

  saveBook() {
    if (!this.bookForm.name.trim()) return alert('Le nom est obligatoire');

    if (this.modalMode === 'add') {
      const newBook: RecipeBook = {
        id: 'book-' + Date.now(),
        name: this.bookForm.name,
        description: this.bookForm.description,
        dateCreated: new Date().toISOString(),
        categories: []
      };

      this.recipeService.saveBook(newBook, false).subscribe({
        next: () => {
          this.showModal = false;
          this.loadBooks();
        },
        error: (err) => console.error("Erreur insertion cahier :", err)
      });
    } else {
      const bookList = this.books();
      const existing = bookList.find((b) => b.id === this.bookForm.id);

      if (existing) {
        existing.name = this.bookForm.name;
        existing.description = this.bookForm.description;

        this.recipeService.saveBook(existing, true).subscribe({
          next: () => {
            this.showModal = false;
            this.loadBooks();
          },
          error: (err) => console.error("Erreur modification cahier :", err)
        });
      }
    }
  }

  executionCampaignId: string | null = null;

  handleLaunchExecution(event: { targetKey: string; campaignId?: string } | string) {
    if (typeof event === 'string') {
      this.executionTarget = event;
      this.executionCampaignId = null;
    } else {
      this.executionTarget = event.targetKey;
      this.executionCampaignId = event.campaignId || null;
    }
    this.switchTab('execution');
  }

  formatBookDate(dateStr: string): string {
    if (!dateStr) return '—';
    const onlyDate = dateStr.split(' ')[0] || dateStr.split('T')[0];
    const parts = onlyDate.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  }
}