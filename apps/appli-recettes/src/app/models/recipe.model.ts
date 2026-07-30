// 🛠️ NOUVEAU : Type strict pour les environnements cibles d'Airbus
export type TestEnvironment = 'DEV' | 'VAL' | 'PREPROD' | 'PROD';

export interface RecipeUser {
  id: string;
  matricule: string;
  nom: string;
  prenom: string;
}

export interface RecipeBook {
  id: string;
  name: string;
  description: string;
  dateCreated: string;
  categories: RecipeCategory[];
}

/** Compteurs agrégés d'un cahier, calculés en une passe globale (voir RecipeService.getBooksStats). */
export interface BookStats {
  categories: number;
  applicatifs: number;
  sections: number;
  tests: number;
  sessions: number;
  campaigns: number;
}

/**
 * Statut qualité d'un cahier calculé à partir de sa DERNIÈRE session (pas d'agrégation
 * multi-sessions comme dans l'onglet Résultats — un simple "état actuel" pour la page
 * d'accueil). `verdict` vaut 'PENDING' quand aucune session n'a encore été exécutée.
 * Voir RecipeService.getBooksQualityOverview.
 */
export interface BookQualityStatus {
  verdict: 'GO' | 'NO-GO' | 'GO-CONDITIONAL' | 'PENDING';
  successRate: number;
  coverageRate: number;
  bloquantFailed: { id: string; name: string }[];
  majeurFailed: { id: string; name: string }[];
  /** Une campagne IN_PROGRESS est rattachée à ce cahier. */
  enCours: boolean;
  lastActivity: { testerName: string; dateExecuted: string; environment: TestEnvironment } | null;
}

export interface RecentSessionEntry {
  bookId: string;
  testerName: string;
  dateExecuted: string;
  status: 'GO' | 'NO-GO' | 'PENDING';
}

/** Vue d'ensemble qualité tous cahiers confondus, pour la page d'accueil. */
export interface BooksQualityOverview {
  perBook: Record<string, BookQualityStatus>;
  recentSessions: RecentSessionEntry[];
  sessionsThisMonth: number;
}

export interface RecipeCategory {
  id: string;
  name: string;
  comment: string;
  url?: string;
  createdBy?: string;
  applicatifs: RecipeApplicatif[];
}

export interface RecipeApplicatif {
  id: string;
  name: string;
  description: string;
  url?: string;
  createdBy?: string;
  sections: RecipeSection[];
}

export interface RecipeSection {
  id: string;
  name: string;
  description: string;
  url?: string;
  createdBy?: string;
  tests: RecipeTest[];
  order_index?: number;
}

export type Criticality = 'Bloquant' | 'Majeur' | 'Mineur';

export interface RecipeTest {
  id: string;
  name: string;
  description: string;
  criticality: Criticality;
  url: string;
  createdBy?: string;
  tasks: RecipeTask[];
  order_index?: number;
}

export interface RecipeTask {
  id: string;
  name: string;
}

export type TestStatus = 'PASSED' | 'FAILED' | 'SKIPPED' | 'PENDING';

export interface TestResponse {
  status: TestStatus;
  notes: string;
  dateResponded?: string;
  /** Chemin relatif (depuis assets/) de la capture d'écran annotée jointe à cette réponse. */
  capturePath?: string;
}

// 🛠️ NOUVEAU : Modèle d'une Campagne Groupée
export interface TestCampaign {
  id: string;
  recipeBookId: string;
  name: string;
  createdBy: string;
  dateCreated: string;
  status: 'IN_PROGRESS' | 'COMPLETED';
  environment: TestEnvironment; // 🛠️ NOUVEAU
}

export interface TestSession {
  id: string;
  recipeBookId: string;
  campaignId?: string;
  isCampaignAggregated?: boolean;
  testerName: string;
  title?: string;
  mode: 'Manuel' | 'Automatique';
  dateExecuted: string;
  responses: { [testId: string]: TestResponse };
  taskResponses: { [taskId: string]: TestResponse };
  status: 'GO' | 'NO-GO' | 'PENDING';

  // 🪄 Rend la propriété optionnelle pour ne pas casser l'existant
  environment?: TestEnvironment;
}

export interface TaskResult {
  id: string;
  description: string;
  statut: 'OK' | 'KO' | 'NON_TESTE';
  commentaire?: string;
}

export interface TestRecette {
  id: string;
  nom: string;
  tasks: TaskResult[];
}

export interface Applicatif {
  id: string;
  nom: string;
  tests: TestRecette[];
}

export interface Categorie {
  id: string;
  nom: string;
  applicatifs: Applicatif[];
}

export interface QualityGateEvaluation {
  status: 'GO' | 'NO-GO' | 'GO-CONDITIONAL';
  environment: TestEnvironment;
  successRate: number;
  coverageRate: number;
  bloquantFailedCount: number;
  majeurFailedCount: number;
  mineurFailedCount: number;
  totalPassed: number;
  totalFailed: number;
  totalSkipped: number;
  totalPending: number;
  totalInBook: number;
  totalExecuted: number;
  bloquantFailedTests: { id: string; name: string; criticality: Criticality }[];
  majeurFailedTests: { id: string; name: string; criticality: Criticality }[];
  mineurFailedTests: { id: string; name: string; criticality: Criticality }[];
  reasons: string[];
  recommendations: string[];
}

export function evaluateQualityGate(
  session: TestSession,
  categoriesTree: RecipeCategory[]
): QualityGateEvaluation {
  const env: TestEnvironment = session.environment || 'VAL';
  let bloquantFailedCount = 0;
  let majeurFailedCount = 0;
  let mineurFailedCount = 0;
  let totalPassed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;
  let totalPending = 0;
  let totalInBook = 0;
  let totalExecuted = 0;

  const bloquantFailedTests: { id: string; name: string; criticality: Criticality }[] = [];
  const majeurFailedTests: { id: string; name: string; criticality: Criticality }[] = [];
  const mineurFailedTests: { id: string; name: string; criticality: Criticality }[] = [];

  const processedTestIds = new Set<string>();

  if (categoriesTree && categoriesTree.length > 0) {
    categoriesTree.forEach(c => c.applicatifs?.forEach(a => a.sections?.forEach(s => s.tests?.forEach(t => {
      const testId = String(t.id);
      if (processedTestIds.has(testId)) return;
      processedTestIds.add(testId);

      totalInBook++;
      const criticality: Criticality = t.criticality || 'Mineur';

      let testStatus: 'PASSED' | 'FAILED' | 'SKIPPED' | 'PENDING' = 'PENDING';

      if (t.tasks && t.tasks.length > 0) {
        let hasFail = false;
        let hasPass = false;
        let hasSkip = false;
        let hasPend = false;

        t.tasks.forEach(tsk => {
          const resp = session.taskResponses?.[tsk.id];
          const st = resp?.status?.toUpperCase();
          if (st === 'FAILED') hasFail = true;
          else if (st === 'PASSED') hasPass = true;
          else if (st === 'SKIPPED') hasSkip = true;
          else hasPend = true;
        });

        const directSt = session.responses?.[t.id]?.status?.toUpperCase();
        if (directSt === 'FAILED') hasFail = true;
        else if (directSt === 'PASSED') hasPass = true;

        if (hasFail) testStatus = 'FAILED';
        else if (hasPass && !hasPend) testStatus = 'PASSED';
        else if (hasPass) testStatus = 'PASSED';
        else if (hasSkip) testStatus = 'SKIPPED';
        else testStatus = 'PENDING';
      } else {
        const resp = session.responses?.[t.id];
        const st = resp?.status?.toUpperCase();
        if (st === 'FAILED') testStatus = 'FAILED';
        else if (st === 'PASSED') testStatus = 'PASSED';
        else if (st === 'SKIPPED') testStatus = 'SKIPPED';
        else testStatus = 'PENDING';
      }

      if (testStatus === 'PASSED') {
        totalPassed++;
        totalExecuted++;
      } else if (testStatus === 'FAILED') {
        totalFailed++;
        totalExecuted++;
        if (criticality === 'Bloquant') {
          bloquantFailedCount++;
          bloquantFailedTests.push({ id: t.id, name: t.name, criticality });
        } else if (criticality === 'Majeur') {
          majeurFailedCount++;
          majeurFailedTests.push({ id: t.id, name: t.name, criticality });
        } else {
          mineurFailedCount++;
          mineurFailedTests.push({ id: t.id, name: t.name, criticality });
        }
      } else if (testStatus === 'SKIPPED') {
        totalSkipped++;
        totalExecuted++;
      } else {
        totalPending++;
      }
    }))));
  }

  const successRate = totalExecuted > 0 ? Math.round((totalPassed / totalExecuted) * 100) : 0;
  const coverageRate = totalInBook > 0 ? Math.round((totalExecuted / totalInBook) * 100) : 0;

  const reasons: string[] = [];
  const recommendations: string[] = [];

  let decision: 'GO' | 'NO-GO' | 'GO-CONDITIONAL' = 'GO';

  if (bloquantFailedCount > 0) {
    decision = 'NO-GO';
    reasons.push(`🚨 ${bloquantFailedCount} test(s) BLOQUANT(S) en échec : Bloque impérativement toute mise en production.`);
    bloquantFailedTests.forEach(bt => {
      recommendations.push(`Corriger d'urgence le test Bloquant : "${bt.name}" (${bt.id})`);
    });
  }

  switch (env) {
    case 'PROD':
      if (bloquantFailedCount > 0 || majeurFailedCount > 0 || mineurFailedCount > 0) {
        decision = 'NO-GO';
        if (majeurFailedCount > 0) reasons.push(`🚨 ${majeurFailedCount} test(s) Majeur(s) en échec (Seuil PROD : 0 échec).`);
        if (mineurFailedCount > 0) reasons.push(`🚨 ${mineurFailedCount} test(s) Mineur(s) en échec (Seuil PROD : 0 échec).`);
      }
      if (coverageRate < 100) {
        decision = 'NO-GO';
        reasons.push(`🚨 Couverture de test incomplète (${coverageRate}%). Seuil requis en PROD : 100%.`);
      }
      break;

    case 'PREPROD':
      if (bloquantFailedCount === 0) {
        if (majeurFailedCount > 0) {
          decision = 'NO-GO';
          reasons.push(`🚨 ${majeurFailedCount} test(s) Majeur(s) en échec (Seuil PREPROD : 0 Majeur KO).`);
        } else if (successRate < 95) {
          decision = 'NO-GO';
          reasons.push(`🚨 Taux de réussite global (${successRate}%) inférieur au seuil requis en PREPROD (95%).`);
        } else if (mineurFailedCount > 0 && mineurFailedCount <= 2) {
          decision = 'GO-CONDITIONAL';
          reasons.push(`⚠️ ${mineurFailedCount} test(s) Mineur(s) en échec. Validation sous réserve de livraison du correctif.`);
        }
      }
      break;

    case 'VAL':
      if (bloquantFailedCount === 0) {
        if (majeurFailedCount > 1) {
          decision = 'NO-GO';
          reasons.push(`🚨 ${majeurFailedCount} tests Majeurs en échec (Seuil toléré en VAL : max 1).`);
        } else if (majeurFailedCount === 1 || successRate < 85) {
          decision = 'GO-CONDITIONAL';
          if (majeurFailedCount === 1) reasons.push(`⚠️ 1 test Majeur en échec ("${majeurFailedTests[0]?.name}"). Validation sous réserve pour la PREPROD.`);
          if (successRate < 85) reasons.push(`⚠️ Taux de réussite (${successRate}%) sous le seuil optimal (85%).`);
        }
      }
      break;

    case 'DEV':
      if (bloquantFailedCount === 0) {
        if (successRate < 60) {
          decision = 'NO-GO';
          reasons.push(`🚨 Taux de réussite insuffisant en DEV (${successRate}% < 60%).`);
        } else if (majeurFailedCount > 0 || successRate < 80) {
          decision = 'GO-CONDITIONAL';
          reasons.push(`⚠️ Environnement DEV : ${majeurFailedCount} test(s) Majeur(s) en échec.`);
        }
      }
      break;
  }

  if (decision === 'GO' && reasons.length === 0) {
    reasons.push(`🟢 Exigences de qualité pleinement satisfaites pour l'environnement ${env}. Taux de succès : ${successRate}%.`);
    recommendations.push(`Autorisation de déploiement accordée pour l'environnement supérieur.`);
  }

  return {
    status: decision,
    environment: env,
    successRate,
    coverageRate,
    bloquantFailedCount,
    majeurFailedCount,
    mineurFailedCount,
    totalPassed,
    totalFailed,
    totalSkipped,
    totalPending,
    totalInBook,
    totalExecuted,
    bloquantFailedTests,
    majeurFailedTests,
    mineurFailedTests,
    reasons,
    recommendations
  };
}