import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { RecipeService } from '../../core/services/recipe.service';
import { RecipeBook, RecipeCategory, RecipeApplicatif, RecipeSection, RecipeTest, RecipeTask, TestSession, TestCampaign, TestEnvironment, evaluateQualityGate, QualityGateEvaluation } from '../../core/models/recipe.model';

// RÈGLE 5 : Interface de typage strict pour éliminer les structures implicites 'any'
export interface AggregatedResponse {
  status: string;
  _testerName?: string;
  _sessionTitle?: string;
  _sessionStatus?: string;
  [key: string]: unknown;
}

export interface QualityTrendPoint {
  id: string;
  date: Date;
  dateStr: string;
  shortDateStr: string;
  title: string;
  testerName: string;
  environment: TestEnvironment;
  isCampaign: boolean;
  status: 'GO' | 'GO-CONDITIONAL' | 'NO-GO';
  successRate: number;
  coverageRate: number;
  bloquantKO: number;
  majeurKO: number;
  mineurKO: number;
  totalKO: number;
  deltaRate: number;
  svgX: number;
  svgY: number;
}

@Component({
  selector: 'app-resultats',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './resultats.component.html',
  styleUrls: ['./resultats.component.scss']
})
export class ResultatsComponent implements OnChanges {
  private recipeService = inject(RecipeService);
  private cdr = inject(ChangeDetectorRef);

  @Input() currentBook!: RecipeBook;
  @Output() launchExecution = new EventEmitter<{ targetKey: string; campaignId?: string }>();

  // VARIABLE LOCALE EXPLICITE : Résout l'erreur de détection et de compilation
  public categoriesTree: RecipeCategory[] = [];

  // Campagnes / Groupes
  public campaigns: TestCampaign[] = [];
  public activeCampaign: TestCampaign | null = null;

  get hasActiveGroup(): boolean {
    return this.campaigns && this.campaigns.length > 0;
  }

  // États de filtrage de la matrice
  selectedEnvironment: 'ALL' | TestEnvironment = 'ALL';
  private allSessionsRaw: TestSession[] = [];
  public allIndividualSessionsRaw: TestSession[] = [];

  // Tableau de sessions effectivement affiché dans le HTML
  sessions: TestSession[] = [];

  // Compteurs dynamiques des campagnes/tests par environnement
  public envCounts = {
    DEV: 0,
    VAL: 0,
    PREPROD: 0,
    PROD: 0,
    ALL: 0
  };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['currentBook'] && this.currentBook) {
      this.loadSessions();
    }
  }

  /**
   * Orchestre le chargement de l'arborescence et des résultats en parallèle. L'arborescence est
   * demandée via RecipeService.getFullTree(), mutualisée avec HomeRecettesComponent : évite de
   * dupliquer en parallèle les mêmes dizaines de requêtes catégories/applicatifs/sections/tests/
   * tâches lors d'une arrivée directe sur cet onglet (juste après l'ouverture du cahier).
   */
  loadSessions() {
    if (!this.currentBook || !this.currentBook.id) return;
    const fullBookId = String(this.currentBook.id);
    const cleanBookId = fullBookId.replace('book-', '');

    // On charge simultanément l'arborescence complète et les données de session
    forkJoin({
      fullTree: this.recipeService.getFullTree(fullBookId),
      allSessionsData: this.recipeService.getSessions(),
      campaignsData: this.recipeService.getCampaigns()
    }).subscribe({
      next: ({ fullTree, allSessionsData, campaignsData }) => {
        try {
          // Hydratation de notre variable locale et de l'input pour la cohérence globale
          this.categoriesTree = fullTree;
          this.currentBook.categories = fullTree;

          const allSessions = allSessionsData.filter(s => s && String(s.recipeBookId).replace('book-', '') === cleanBookId);
          const campaigns = campaignsData.filter(c => c && String(c.recipeBookId).replace('book-', '') === cleanBookId);

          this.allIndividualSessionsRaw = allSessions;
          this.campaigns = campaigns;
          this.activeCampaign = campaigns.length > 0 ? campaigns[0] : null;

          const standaloneSessions = allSessions.filter(s => {
            const cId = s.campaignId;
            return !cId || String(cId).trim() === '' || String(cId).toLowerCase() === 'null' || String(cId) === '0' || String(cId) === 'undefined';
          });

          const aggregatedCampaigns: TestSession[] = [];

          campaigns.forEach(camp => {
            const campSessions = allSessions.filter(s => s.campaignId === camp.id);
            if (campSessions.length === 0) return;

            const mergedTasks: Record<string, AggregatedResponse> = {};
            const mergedTests: Record<string, AggregatedResponse> = {};
            let hasFail = false;

            campSessions.forEach(s => {
              Object.keys(s.taskResponses || {}).forEach(taskId => {
                if (s.taskResponses![taskId].status !== 'PENDING') {
                  mergedTasks[taskId] = { ...s.taskResponses![taskId], _testerName: s.testerName, _sessionTitle: s.title, _sessionStatus: s.status };
                }
              });
              Object.keys(s.responses || {}).forEach(testId => {
                if (s.responses![testId].status !== 'PENDING') {
                  mergedTests[testId] = { ...s.responses![testId], _testerName: s.testerName, _sessionTitle: s.title, _sessionStatus: s.status };
                }
              });
              if (s.status === 'NO-GO') hasFail = true;
            });

            const allTesters = Array.from(new Set(campSessions.map(s => s.testerName))).join(', ');

            aggregatedCampaigns.push({
              id: camp.id,
              recipeBookId: camp.recipeBookId,
              isCampaignAggregated: true,
              testerName: allTesters,
              title: camp.name,
              mode: 'Manuel',
              dateExecuted: camp.dateCreated,
              responses: mergedTests as any,
              taskResponses: mergedTasks as any,
              status: hasFail ? 'NO-GO' : 'GO',
              environment: camp.environment
            });
          });

          // Copie de référence triée par date décroissante
          this.allSessionsRaw = [...standaloneSessions, ...aggregatedCampaigns].sort((a, b) => {
            const dateA = a.dateExecuted ? new Date(a.dateExecuted.replace(' ', 'T')).getTime() : 0;
            const dateB = b.dateExecuted ? new Date(b.dateExecuted.replace(' ', 'T')).getTime() : 0;
            return dateB - dateA;
          });

          // Calcul dynamique des compteurs par environnement (RÈGLE DE SÉCURITÉ CONTRÔLE DE FLUX)
          this.calculateEnvironmentCounts();

          // Application du filtre d'environnement courant
          this.applyEnvironmentFilter();
        } catch (error) {
          console.error("Crash JS lors du traitement des résultats :", error);
        }
      },
      error: (err) => console.error("Erreur API :", err)
    });
  }

  /**
   * Calcule le nombre de sessions / campagnes associées à chaque environnement
   */
  private calculateEnvironmentCounts(): void {
    this.envCounts = {
      DEV: this.allSessionsRaw.filter(s => s.environment === 'DEV').length,
      VAL: this.allSessionsRaw.filter(s => s.environment === 'VAL').length,
      PREPROD: this.allSessionsRaw.filter(s => s.environment === 'PREPROD').length,
      PROD: this.allSessionsRaw.filter(s => s.environment === 'PROD').length,
      ALL: this.allSessionsRaw.length
    };
  }

  // Mécanisme de filtrage synchrone
  changeEnvironment(env: 'ALL' | TestEnvironment) {
    this.selectedEnvironment = env;
    this.applyEnvironmentFilter();
  }

  // Filtres par statut de test (OK, KO, PENDING, BLOQUANT)
  selectedStatusFilter: 'ALL' | 'PASSED' | 'FAILED' | 'PENDING' | 'BLOQUANT' = 'ALL';
  selectedSessionFilter: string | null = null;

  isTestInSelectedSession(test: RecipeTest): boolean {
    if (!this.selectedSessionFilter) return true;

    const sess = this.allIndividualSessionsRaw.find(s => String(s.id) === String(this.selectedSessionFilter));
    if (!sess) return true;

    const resp = sess.responses?.[test.id];
    if (resp && resp.status && String(resp.status).toUpperCase() !== 'PENDING') return true;

    if (test.tasks && test.tasks.length > 0 && sess.taskResponses) {
      return test.tasks.some(tsk => {
        const tr = sess.taskResponses?.[String(tsk.id)] || sess.taskResponses?.[tsk.id];
        return tr && tr.status && String(tr.status).toUpperCase() !== 'PENDING';
      });
    }

    return false;
  }

  public statusCounts = {
    ALL: 0,
    PASSED: 0,
    FAILED: 0,
    PENDING: 0,
    BLOQUANT: 0
  };

  setStatusFilter(filter: 'ALL' | 'PASSED' | 'FAILED' | 'PENDING' | 'BLOQUANT') {
    this.selectedStatusFilter = filter;
    this.cdr.detectChanges();
  }

  private applyEnvironmentFilter() {
    if (this.selectedEnvironment === 'ALL') {
      this.sessions = this.allSessionsRaw;
    } else {
      this.sessions = this.allSessionsRaw.filter(s => s.environment === this.selectedEnvironment);
    }
    this.calculateStatusCounts();
    this.cdr.detectChanges();
  }

  getTaskStatusSummary(task: RecipeTask): 'FAILED' | 'PASSED' | 'PENDING' {
    if (!this.sessions || this.sessions.length === 0) return 'PENDING';
    const targetSession = this.sessions[0];

    const st = targetSession.taskResponses?.[task.id]?.status?.toUpperCase();
    if (st === 'FAILED') return 'FAILED';
    if (st === 'PASSED') return 'PASSED';
    return 'PENDING';
  }

  getTestStatusSummary(test: RecipeTest): 'FAILED' | 'PASSED' | 'PENDING' {
    if (!this.sessions || this.sessions.length === 0) return 'PENDING';
    const targetSession = this.sessions[0];

    if (test.tasks && test.tasks.length > 0) {
      let hasFail = false;
      let hasPass = false;

      for (const tsk of test.tasks) {
        const st = targetSession.taskResponses?.[tsk.id]?.status?.toUpperCase();
        if (st === 'FAILED') hasFail = true;
        else if (st === 'PASSED') hasPass = true;
      }

      const directSt = targetSession.responses?.[test.id]?.status?.toUpperCase();
      if (directSt === 'FAILED') hasFail = true;
      else if (directSt === 'PASSED') hasPass = true;

      if (hasFail) return 'FAILED';
      if (hasPass) return 'PASSED';
      return 'PENDING';
    }

    const st = targetSession.responses?.[test.id]?.status?.toUpperCase();
    if (st === 'FAILED') return 'FAILED';
    if (st === 'PASSED') return 'PASSED';
    return 'PENDING';
  }

  shouldDisplayTask(task: RecipeTask, parentTest: RecipeTest): boolean {
    if (!this.isTestInSelectedSession(parentTest)) {
      return false;
    }

    if (this.selectedSessionFilter) {
      const sess = this.allIndividualSessionsRaw.find(s => String(s.id) === String(this.selectedSessionFilter));
      if (sess) {
        const tr = sess.taskResponses?.[String(task.id)] || sess.taskResponses?.[task.id];
        if (!tr || !tr.status || String(tr.status).toUpperCase() === 'PENDING') {
          return false;
        }
      }
    }

    if (this.selectedStatusFilter === 'ALL') return true;
    if (this.selectedStatusFilter === 'BLOQUANT') return parentTest.criticality === 'Bloquant';

    const st = this.getTaskStatusSummary(task);
    if (this.selectedStatusFilter === 'FAILED') return st === 'FAILED';
    if (this.selectedStatusFilter === 'PASSED') return st === 'PASSED';
    if (this.selectedStatusFilter === 'PENDING') return st === 'PENDING';

    return true;
  }

  shouldDisplayTest(test: RecipeTest): boolean {
    if (!this.isTestInSelectedSession(test)) {
      return false;
    }

    if (this.selectedStatusFilter === 'ALL') return true;
    if (this.selectedStatusFilter === 'BLOQUANT') return test.criticality === 'Bloquant';

    if (test.tasks && test.tasks.length > 0) {
      return test.tasks.some(tsk => this.shouldDisplayTask(tsk, test));
    }

    const st = this.getTestStatusSummary(test);
    if (this.selectedStatusFilter === 'FAILED') return st === 'FAILED';
    if (this.selectedStatusFilter === 'PASSED') return st === 'PASSED';
    if (this.selectedStatusFilter === 'PENDING') return st === 'PENDING';

    return true;
  }

  hasVisibleTestsInCategory(cat: RecipeCategory): boolean {
    return !!cat.applicatifs?.some(a => this.hasVisibleTestsInApplicatif(a));
  }

  hasVisibleTestsInApplicatif(app: RecipeApplicatif): boolean {
    return !!app.sections?.some(s => this.hasVisibleTestsInSection(s));
  }

  hasVisibleTestsInSection(sec: RecipeSection): boolean {
    return !!sec.tests?.some(t => this.shouldDisplayTest(t));
  }

  getTotalSessionColspan(): number {
    if (!this.sessions || this.sessions.length === 0) return 0;
    return this.sessions.reduce((acc, s) => acc + (s.isCampaignAggregated ? 2 : 1), 0);
  }

  public calculateStatusCounts() {
    let all = 0, passed = 0, failed = 0, pending = 0, bloquant = 0;

    if (this.categoriesTree) {
      this.categoriesTree.forEach(c => c.applicatifs?.forEach(a => a.sections?.forEach(s => s.tests?.forEach(t => {
        all++;
        if (t.criticality === 'Bloquant') bloquant++;

        const st = this.getTestStatusSummary(t);
        if (st === 'PASSED') passed++;
        else if (st === 'FAILED') failed++;
        else pending++;
      }))));
    }

    this.statusCounts = { ALL: all, PASSED: passed, FAILED: failed, PENDING: pending, BLOQUANT: bloquant };
  }

  // --- Sécurisation des boucles ---
  getResultStats(session: TestSession) {
    let passed = 0;
    let executed = 0;
    let totalInBook = 0;

    if (!this.categoriesTree || this.categoriesTree.length === 0) return { rate: 0, untestedRate: 100 };

    this.categoriesTree.forEach(c => c.applicatifs?.forEach(a => a.sections?.forEach(s => s.tests?.forEach(t => {
      if (t.tasks && t.tasks.length > 0) {
        t.tasks.forEach(tsk => {
          totalInBook++;
          const st = session.taskResponses?.[tsk.id]?.status;
          if (st && st !== 'PENDING') {
            executed++;
            if (st === 'PASSED') passed++;
          }
        });
      } else {
        totalInBook++;
        const st = session.responses?.[t.id]?.status;
        if (st && st !== 'PENDING') {
          executed++;
          if (st === 'PASSED') passed++;
        }
      }
    }))));

    const rate = executed > 0 ? Math.round((passed / executed) * 100) : 0;
    const untestedRate = totalInBook > 0 ? Math.round(((totalInBook - executed) / totalInBook) * 100) : 100;
    return { rate, untestedRate };
  }

  /** Le pourcentage de la fiche de test ne doit s'afficher QUE si toutes ses sous-tâches ont été terminées. */
  isTestSectionCompleted(test: RecipeTest, session: TestSession): boolean {
    if (!test.tasks || test.tasks.length === 0) {
      const st = session.responses?.[test.id]?.status?.toUpperCase();
      return st === 'PASSED' || st === 'FAILED' || st === 'SKIPPED';
    }
    return test.tasks.every(tsk => {
      const st = session.taskResponses?.[String(tsk.id)]?.status?.toUpperCase();
      return st && st !== 'PENDING';
    });
  }

  getTestSuccessRateInSession(test: RecipeTest, session: TestSession): string {
    if (!this.isTestSectionCompleted(test, session)) {
      return ' ';
    }
    if (!test.tasks || test.tasks.length === 0) {
      const st = session.responses?.[test.id]?.status?.toUpperCase();
      if (st === 'PASSED') return '100%';
      if (st === 'FAILED') return '0%';
      return ' ';
    }
    let passed = 0;
    test.tasks.forEach(tsk => {
      const safeTaskId = String(tsk.id);
      const st = session.taskResponses?.[safeTaskId]?.status?.toUpperCase();
      if (st === 'PASSED') passed++;
    });
    const total = test.tasks.length;
    return total > 0 ? Math.round((passed / total) * 100) + '%' : ' ';
  }

  hasTestAnyResponseInSession(test: RecipeTest, session: TestSession): boolean {
    if (session.responses?.[test.id]?.status && session.responses[test.id].status !== 'PENDING') return true;
    if (test.tasks && test.tasks.length > 0) {
      return test.tasks.some(tsk => session.taskResponses?.[String(tsk.id)]?.status && session.taskResponses[String(tsk.id)].status !== 'PENDING');
    }
    return false;
  }

  isTaskResultPending(task: RecipeTask, test: RecipeTest, session: TestSession): boolean {
    if (session.status === 'GO' || session.status === 'NO-GO') {
      return false;
    }
    if (!this.isTestSectionCompleted(test, session)) {
      return true;
    }
    if (!session.isCampaignAggregated) {
      return session.status === 'PENDING';
    }
    const safeTaskId = String(task.id);
    const tResp = session.taskResponses?.[safeTaskId] as unknown as AggregatedResponse | undefined;
    if (tResp && tResp._sessionStatus) {
      return tResp._sessionStatus === 'PENDING';
    }
    return session.status === 'PENDING';
  }

  isTestResultPending(test: RecipeTest, session: TestSession): boolean {
    if (session.status === 'GO' || session.status === 'NO-GO') {
      return false;
    }
    if (!this.isTestSectionCompleted(test, session)) {
      return true;
    }
    if (!session.isCampaignAggregated) {
      return session.status === 'PENDING';
    }
    const resp = session.responses?.[test.id] as unknown as AggregatedResponse | undefined;
    if (resp && resp._sessionStatus) {
      return resp._sessionStatus === 'PENDING';
    }
    return session.status === 'PENDING';
  }

  getCleanTitle(title: string | undefined): string {
    if (!title) return '';
    return title.includes(' [Périmètre:') ? title.split(' [Périmètre:')[0].trim() : title;
  }

  getTestExecInfo(test: RecipeTest, session: TestSession): { title: string, tester: string } | null {
    if (!session.isCampaignAggregated) return null;
    
    // RÈGLE 5 & Double casting strict exigé par TypeScript pour l'index signature manquante
    const resp = session.responses?.[test.id] as unknown as AggregatedResponse | undefined;
    if (resp && resp._sessionTitle) {
      return { title: this.getCleanTitle(resp._sessionTitle), tester: resp._testerName || 'Inconnu' };
    }
    if (test.tasks && test.tasks.length > 0 && session.taskResponses) {
      for (const tsk of test.tasks) {
        const safeTaskId = String(tsk.id);
        const taskKey = Object.keys(session.taskResponses).find(k => String(k) === safeTaskId);
        const tResp = taskKey ? (session.taskResponses[taskKey] as unknown as AggregatedResponse) : undefined;
        if (tResp && tResp._sessionTitle) {
          return { title: this.getCleanTitle(tResp._sessionTitle), tester: tResp._testerName || 'Inconnu' };
        }
      }
    }
    return null;
  }

  getTaskExecInfo(task: RecipeTask, session: TestSession): { title: string, tester: string } | null {
    if (!session.isCampaignAggregated || !session.taskResponses) return null;
    const safeTaskId = String(task.id);
    const taskKey = Object.keys(session.taskResponses).find(k => String(k) === safeTaskId);
    const tResp = taskKey ? (session.taskResponses[taskKey] as unknown as AggregatedResponse) : undefined;
    if (tResp && tResp._sessionTitle) {
      return { title: this.getCleanTitle(tResp._sessionTitle), tester: tResp._testerName || 'Inconnu' };
    }
    return null;
  }

  getMatrixFlatRows(): { id: string; type: string; cat?: RecipeCategory; app?: RecipeApplicatif; sec?: RecipeSection; test?: RecipeTest; task?: RecipeTask }[] {
    const rows: { id: string; type: string; cat?: RecipeCategory; app?: RecipeApplicatif; sec?: RecipeSection; test?: RecipeTest; task?: RecipeTask }[] = [];
    if (!this.categoriesTree) return rows;

    for (const cat of this.categoriesTree) {
      if (!this.hasVisibleTestsInCategory(cat)) continue;
      rows.push({ id: 'CAT_' + cat.id, type: 'cat', cat });

      for (const app of cat.applicatifs) {
        if (!this.hasVisibleTestsInApplicatif(app)) continue;
        rows.push({ id: 'APP_' + app.id, type: 'app', app });

        for (const sec of app.sections) {
          if (!this.hasVisibleTestsInSection(sec)) continue;
          rows.push({ id: 'SEC_' + sec.id, type: 'sec', sec });

          for (const test of sec.tests) {
            if (!this.shouldDisplayTest(test)) continue;
            rows.push({ id: 'TEST_' + test.id, type: 'test', test });

            if (test.tasks) {
              for (const task of test.tasks) {
                if (!this.shouldDisplayTask(task, test)) continue;
                rows.push({ id: 'TASK_' + test.id + '_' + task.id, type: 'task', test, task });
              }
            }
          }
        }
      }
    }

    rows.push({ id: 'FOOTER', type: 'footer' });
    return rows;
  }

  getSubsessionBlockSpan(rowId: string, session: TestSession): { isStart: boolean; rowspan: number; execInfo: { title: string; tester: string } | null } {
    if (!session || !session.isCampaignAggregated) {
      return { isStart: false, rowspan: 0, execInfo: null };
    }

    const rows = this.getMatrixFlatRows();
    const index = rows.findIndex(r => r.id === rowId);
    if (index === -1) return { isStart: false, rowspan: 0, execInfo: null };

    const getRowDirectExecInfo = (r: { id: string; type: string; test?: RecipeTest; task?: RecipeTask }) => {
      if (r.type === 'test' && r.test) return this.getTestExecInfo(r.test, session);
      if (r.type === 'task' && r.task) return this.getTaskExecInfo(r.task, session);
      return null;
    };

    const getItemExecInfo = (idx: number) => {
      const direct = getRowDirectExecInfo(rows[idx]);
      if (direct) return direct;

      let prevInfo: { title: string; tester: string } | null = null;
      for (let i = idx - 1; i >= 0; i--) {
        const info = getRowDirectExecInfo(rows[i]);
        if (info) { prevInfo = info; break; }
      }

      let nextInfo: { title: string; tester: string } | null = null;
      for (let i = idx + 1; i < rows.length; i++) {
        const info = getRowDirectExecInfo(rows[i]);
        if (info) { nextInfo = info; break; }
      }

      if (prevInfo && nextInfo && prevInfo.title === nextInfo.title && prevInfo.tester === nextInfo.tester) {
        return prevInfo;
      }
      return null;
    };

    const currentInfo = getItemExecInfo(index);
    const currentKey = currentInfo ? `${currentInfo.title}___${currentInfo.tester}` : 'EMPTY';

    if (index > 0) {
      const prevInfo = getItemExecInfo(index - 1);
      const prevKey = prevInfo ? `${prevInfo.title}___${prevInfo.tester}` : 'EMPTY';
      if (prevKey === currentKey) {
        return { isStart: false, rowspan: 0, execInfo: currentInfo };
      }
    }

    let span = 1;
    for (let i = index + 1; i < rows.length; i++) {
      const nextInfo = getItemExecInfo(i);
      const nextKey = nextInfo ? `${nextInfo.title}___${nextInfo.tester}` : 'EMPTY';
      if (nextKey === currentKey) {
        span++;
      } else {
        break;
      }
    }

    return { isStart: true, rowspan: span, execInfo: currentInfo };
  }

  activeTooltip: { title: string; tester: string; x: number; y: number } | null = null;

  showTooltip(event: MouseEvent, info: { title: string; tester: string } | null) {
    if (!info) {
      this.activeTooltip = null;
      return;
    }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.activeTooltip = {
      title: info.title,
      tester: info.tester,
      x: rect.left - 10,
      y: rect.top + (rect.height / 2)
    };
  }

  hideTooltip() {
    this.activeTooltip = null;
  }

  getTaskStatusInSession(taskId: string | number, session: TestSession): 'OK' | 'KO' | 'SKIPPED' | '-' {
    if (!session || !session.taskResponses) return '-';
    const safeTaskId = String(taskId);
    const matchKey = Object.keys(session.taskResponses).find(k => String(k) === safeTaskId);
    const resp = matchKey ? session.taskResponses[matchKey] : undefined;
    const status = resp?.status?.toUpperCase();
    if (status === 'PASSED') return 'OK';
    if (status === 'FAILED') return 'KO';
    if (status === 'SKIPPED') return 'SKIPPED';
    return '-';
  }

  getDirectTestStatusInSession(test: RecipeTest, session: TestSession): 'OK' | 'KO' | 'SKIPPED' | '-' {
    if (!session) return '-';
    const matchKey = session.responses ? Object.keys(session.responses).find(k => String(k) === String(test.id)) : undefined;
    const respStatus = matchKey ? session.responses[matchKey]?.status?.toUpperCase() : undefined;
    if (respStatus === 'PASSED') return 'OK';
    if (respStatus === 'FAILED') return 'KO';
    if (respStatus === 'SKIPPED') return 'SKIPPED';

    if (test.tasks && test.tasks.length > 0 && session.taskResponses) {
      let hasKo = false;
      let hasOk = false;
      test.tasks.forEach(tsk => {
        const safeTaskId = String(tsk.id);
        const taskKey = Object.keys(session.taskResponses).find(k => String(k) === safeTaskId);
        const tSt = taskKey ? session.taskResponses[taskKey]?.status?.toUpperCase() : undefined;
        if (tSt === 'FAILED') hasKo = true;
        if (tSt === 'PASSED') hasOk = true;
      });
      if (hasKo) return 'KO';
      if (hasOk) return 'OK';
    }
    return '-';
  }

  isTestCriticalFailed(test: RecipeTest, session: TestSession): boolean {
    if (!test.tasks || test.tasks.length === 0) {
      return session.responses?.[test.id]?.status === 'FAILED' && test.criticality === 'Bloquant';
    }
    return test.tasks.some(tsk => session.taskResponses?.[tsk.id]?.status === 'FAILED') && test.criticality === 'Bloquant';
  }

  isSessionCriticalFailed(session: TestSession): boolean {
    if (!this.categoriesTree || this.categoriesTree.length === 0) return false;
    return this.categoriesTree.some(c =>
      c.applicatifs?.some(a =>
        a.sections?.some(s =>
          s.tests?.some(t => this.isTestCriticalFailed(t, session))
        )
      )
    );
  }

  getQualityGate(session: TestSession): QualityGateEvaluation {
    return evaluateQualityGate(session, this.categoriesTree);
  }

  getLatestQualityGate(): QualityGateEvaluation | null {
    if (!this.sessions || this.sessions.length === 0) return null;
    return this.getQualityGate(this.sessions[0]);
  }

  getRateBgClass(rate: number): string {
    return rate >= 70 ? 'bg-rate-good' : rate > 20 ? 'bg-rate-medium' : 'bg-rate-bad';
  }

  // --- Détail (notes + capture) d'un résultat de test ---
  viewingDetail: {
    testName: string,
    sessionLabel: string,
    notes: string,
    capturePath?: string,
    taskDetails: { taskName: string, notes: string, capturePath?: string }[]
  } | null = null;

  private getTaskDetails(test: RecipeTest, session: TestSession): { taskName: string, notes: string, capturePath?: string }[] {
    const details: { taskName: string, notes: string, capturePath?: string }[] = [];
    (test.tasks || []).forEach(t => {
      const tr = session.taskResponses?.[t.id];
      if (tr && (tr.notes?.trim() || tr.capturePath)) {
        details.push({ taskName: t.name, notes: tr.notes || '', capturePath: tr.capturePath });
      }
    });
    return details;
  }

  /** Icônes distinctes selon le type de détail disponible (commentaire et/ou capture),
   * agrégées sur la fiche de test elle-même et l'ensemble de ses sous-tâches. */
  hasDetailComment(test: RecipeTest, session: TestSession): boolean {
    const resp = session.responses?.[test.id];
    if (resp?.notes?.trim()) return true;
    return this.getTaskDetails(test, session).some(d => !!d.notes?.trim());
  }

  hasDetailCapture(test: RecipeTest, session: TestSession): boolean {
    const resp = session.responses?.[test.id];
    if (resp?.capturePath) return true;
    return this.getTaskDetails(test, session).some(d => !!d.capturePath);
  }

  openDetail(test: RecipeTest, session: TestSession): void {
    const resp = session.responses?.[test.id];
    this.viewingDetail = {
      testName: test.name,
      sessionLabel: session.title || session.testerName,
      notes: resp?.notes || '',
      capturePath: resp?.capturePath,
      taskDetails: this.getTaskDetails(test, session)
    };
  }

  closeDetail(): void {
    this.viewingDetail = null;
  }

  /** Note/capture d'une sous-tâche précise (ligne "task-row" de la matrice), indépendamment
   * du détail agrégé au niveau de la fiche de test elle-même. */
  hasTaskComment(task: RecipeTask, session: TestSession): boolean {
    return !!session.taskResponses?.[task.id]?.notes?.trim();
  }

  hasTaskCapture(task: RecipeTask, session: TestSession): boolean {
    return !!session.taskResponses?.[task.id]?.capturePath;
  }

  openTaskDetail(task: RecipeTask, session: TestSession): void {
    const tr = session.taskResponses?.[task.id];
    this.viewingDetail = {
      testName: task.name,
      sessionLabel: session.title || session.testerName,
      notes: tr?.notes || '',
      capturePath: tr?.capturePath,
      taskDetails: []
    };
  }

  isCategoryTestedInSpecificCampaign(cat: RecipeCategory, session: TestSession): boolean {
    if (!session || !session.isCampaignAggregated || !cat.applicatifs || cat.applicatifs.length === 0) return false;
    return cat.applicatifs.some(a => this.isApplicatifTestedInSpecificCampaign(a, session));
  }

  isApplicatifTestedInSpecificCampaign(app: RecipeApplicatif, session: TestSession): boolean {
    if (!session || !session.isCampaignAggregated || !app.sections || app.sections.length === 0) return false;
    return app.sections.some(s => this.isSectionTestedInSpecificCampaign(s, session));
  }

  isSectionTestedInSpecificCampaign(sec: RecipeSection, session: TestSession): boolean {
    if (!session || !session.isCampaignAggregated || !sec.tests || sec.tests.length === 0) return false;
    return sec.tests.some(t => {
      const resp = session.responses?.[t.id];
      if (resp && resp.status && resp.status !== 'PENDING') return true;
      if (t.tasks && t.tasks.length > 0) {
        return t.tasks.some(tsk => {
          const tResp = session.taskResponses?.[tsk.id];
          return tResp && tResp.status && tResp.status !== 'PENDING';
        });
      }
      return false;
    });
  }

  onLaunchSession(targetKey: string) {
    this.launchExecution.emit({ targetKey });
  }

  onLaunchGroupSession(targetKey: string, campaignId?: string) {
    const targetCampaignId = campaignId || this.activeCampaign?.id;
    if (targetCampaignId) {
      this.launchExecution.emit({ targetKey, campaignId: targetCampaignId });
    }
  }

  // --- PHASE 3 : CALCULS ET GRAPHES DE TENDANCE DE QUALITÉ ---
  showTrendDashboard = false;
  trendPeriodFilter: 'ALL' | '7D' | '30D' = 'ALL';
  trendTypeFilter: 'ALL' | 'SOLO' | 'GROUP' = 'ALL';
  hoveredTrendPoint: QualityTrendPoint | null = null;

  getTrendPoints(): QualityTrendPoint[] {
    if (!this.allSessionsRaw || this.allSessionsRaw.length === 0) return [];

    const list = this.allSessionsRaw.filter(s => {
      if (this.selectedEnvironment !== 'ALL' && s.environment !== this.selectedEnvironment) return false;
      if (this.trendTypeFilter === 'SOLO' && s.isCampaignAggregated) return false;
      if (this.trendTypeFilter === 'GROUP' && !s.isCampaignAggregated) return false;
      return true;
    });

    const sorted = [...list].sort((a, b) => {
      const dA = a.dateExecuted ? new Date(a.dateExecuted.replace(' ', 'T')).getTime() : 0;
      const dB = b.dateExecuted ? new Date(b.dateExecuted.replace(' ', 'T')).getTime() : 0;
      return dA - dB;
    });

    const now = Date.now();
    const filtered = sorted.filter(s => {
      if (this.trendPeriodFilter === 'ALL') return true;
      const t = s.dateExecuted ? new Date(s.dateExecuted.replace(' ', 'T')).getTime() : 0;
      const daysAgo = (now - t) / (1000 * 60 * 60 * 24);
      if (this.trendPeriodFilter === '7D') return daysAgo <= 7;
      if (this.trendPeriodFilter === '30D') return daysAgo <= 30;
      return true;
    });

    if (filtered.length === 0) return [];

    const points: QualityTrendPoint[] = [];
    const svgWidth = 840;
    const svgHeight = 160;
    const marginTop = 20;
    const marginBottom = 30;
    const availableHeight = svgHeight - marginTop - marginBottom;

    let prevRate = 0;

    filtered.forEach((sess, idx) => {
      const stats = this.getResultStats(sess);
      const gate = evaluateQualityGate(sess, this.categoriesTree);
      
      const rate = stats.rate;
      const deltaRate = idx === 0 ? 0 : Math.round((rate - prevRate) * 10) / 10;
      prevRate = rate;

      const stepX = filtered.length > 1 ? (svgWidth - 80) / (filtered.length - 1) : svgWidth / 2;
      const svgX = 40 + idx * stepX;
      const svgY = marginTop + availableHeight * (1 - rate / 100);

      const dDate = sess.dateExecuted ? new Date(sess.dateExecuted.replace(' ', 'T')) : new Date();
      const dateStr = sess.dateExecuted || 'Date inconnue';
      const shortDateStr = `${dDate.getDate().toString().padStart(2, '0')}/${(dDate.getMonth() + 1).toString().padStart(2, '0')}`;

      points.push({
        id: sess.id,
        date: dDate,
        dateStr,
        shortDateStr,
        title: sess.title || sess.testerName || 'Session de recette',
        testerName: sess.testerName,
        environment: sess.environment || 'VAL',
        isCampaign: !!sess.isCampaignAggregated,
        status: gate.status,
        successRate: rate,
        coverageRate: Math.round(100 - stats.untestedRate),
        bloquantKO: gate.bloquantFailedCount,
        majeurKO: gate.majeurFailedCount,
        mineurKO: gate.mineurFailedCount,
        totalKO: gate.totalFailed,
        deltaRate,
        svgX,
        svgY
      });
    });

    return points;
  }

  getTrendPathD(points: QualityTrendPoint[]): string {
    if (!points || points.length === 0) return '';
    return points.reduce((acc, p, i) => i === 0 ? `M ${p.svgX} ${p.svgY}` : `${acc} L ${p.svgX} ${p.svgY}`, '');
  }

  getTrendAreaD(points: QualityTrendPoint[]): string {
    if (!points || points.length === 0) return '';
    const first = points[0];
    const last = points[points.length - 1];
    const linePath = this.getTrendPathD(points);
    return `${linePath} L ${last.svgX} 130 L ${first.svgX} 130 Z`;
  }

  getAverageTrendRate(points: QualityTrendPoint[]): number {
    if (!points || points.length === 0) return 0;
    const sum = points.reduce((acc, p) => acc + p.successRate, 0);
    return Math.round((sum / points.length) * 10) / 10;
  }

  getGoSuccessRatio(points: QualityTrendPoint[]): number {
    if (!points || points.length === 0) return 0;
    const goCount = points.filter(p => p.status === 'GO' || p.status === 'GO-CONDITIONAL').length;
    return Math.round((goCount / points.length) * 100);
  }

  getLatestDelta(points: QualityTrendPoint[]): number {
    if (!points || points.length < 2) return 0;
    return points[points.length - 1].deltaRate;
  }

  /**
   * Campagne : efface uniquement les résultats de tests (réponses tests/tâches remises à
   * PENDING) — le groupe et ses sessions sont conservés.
   * Session simple (hors campagne) : supprime la session elle-même, ce qui efface avec elle
   * (cascade en base) l'ensemble de ses réponses de tests et de tâches.
   */
  deleteResult(session: TestSession) {
    const isCampaign = session.isCampaignAggregated;
    const msg = isCampaign
      ? 'Voulez-vous vraiment effacer tous les résultats de cette campagne ? Le groupe et ses sessions seront conservés : seules les réponses aux tests seront réinitialisées.'
      : 'Voulez-vous vraiment supprimer cette session et tous ses résultats ? Cette action est irréversible.';
    if (!confirm(msg)) return;

    if (isCampaign) {
      this.recipeService.getSessions().subscribe(allSessions => {
        const campSessions = allSessions.filter(s => s.campaignId === session.id);
        const ops = campSessions.map(s => this.recipeService.clearSessionResults(s));
        forkJoin(ops.length > 0 ? ops : [of(null)]).subscribe(() => this.loadSessions());
      });
    } else {
      this.recipeService.deleteSession(session.id).subscribe(() => this.loadSessions());
    }
  }

  exportSessionToPDF(session: TestSession) {
    alert("Export PDF non configuré pour le moment.");
  }

  isSessionCompleted(sess: TestSession): boolean {
    if (!sess) return false;
    if (sess.isCampaignAggregated) return true;

    // 1. Les réponses de test (responses) doivent exister et être non vides
    if (!sess.responses || Object.keys(sess.responses).length === 0) {
      return false;
    }

    // 2. Toutes les réponses de test doivent être renseignées et différentes de PENDING
    const allTestsDone = Object.values(sess.responses).every(
      r => r && r.status && String(r.status).toUpperCase() !== 'PENDING'
    );
    if (!allTestsDone) return false;

    // 3. Si la session comporte des réponses de tâches (taskResponses), aucune ne doit être PENDING
    if (sess.taskResponses && Object.keys(sess.taskResponses).length > 0) {
      const allTasksDone = Object.values(sess.taskResponses).every(
        tr => tr && tr.status && String(tr.status).toUpperCase() !== 'PENDING'
      );
      if (!allTasksDone) return false;
    }

    return true;
  }

  getIndividualSessionsForCampaign(campaignSession: TestSession): TestSession[] {
    if (!this.allIndividualSessionsRaw || this.allIndividualSessionsRaw.length === 0) return [];
    
    // 1. Sessions appartenant explicitement à cette campagne
    const campId = String(campaignSession.id);
    const matched = this.allIndividualSessionsRaw.filter(s => s && String(s.campaignId) === campId);
    if (matched.length > 0) {
      return matched;
    }

    // 2. Si aucune session spécifique liée : renvoyer les sessions individuelles du cahier
    return this.allIndividualSessionsRaw.filter(s => s && !s.isCampaignAggregated);
  }

  onSelectSessionForCampaign(event: Event, campaignSession: TestSession): void {
    const selectElem = event.target as HTMLSelectElement;
    const selectedSessionId = selectElem.value;

    if (!selectedSessionId || selectedSessionId === '' || selectedSessionId === 'ALL') {
      this.selectedSessionFilter = null;
    } else {
      this.selectedSessionFilter = selectedSessionId;
    }

    this.calculateStatusCounts();
    this.cdr.detectChanges();
  }

  resetSessionFilter(): void {
    this.selectedSessionFilter = null;
    this.calculateStatusCounts();
    this.cdr.detectChanges();
  }
}