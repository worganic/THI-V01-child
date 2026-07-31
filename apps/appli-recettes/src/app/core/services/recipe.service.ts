import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, forkJoin } from 'rxjs';
import { map, catchError, switchMap, finalize, shareReplay } from 'rxjs/operators';
import {
  RecipeBook,
  RecipeCategory,
  RecipeApplicatif,
  RecipeSection,
  RecipeTest,
  RecipeTask,
  TestSession,
  TestCampaign,
  TestResponse,
  TestStatus,
  TestEnvironment,
  RecipeUser,
  BookStats,
  BookQualityStatus,
  BooksQualityOverview,
  RecentSessionEntry,
  evaluateQualityGate
} from '../models/recipe.model';
import { API_DATA_URL } from '@portail/core-data-access';
import { environment } from '../../../environments/environment';

interface BackendResponse<T> {
  data?: T | T[] | Record<string, T>;
}

interface BackendRecipeBook {
  id: string;
  name: string;
  description: string;
  date_created: string;
}

interface BackendRecipeCategory {
  id: string;
  recipe_book_id: string;
  name: string;
  comment: string;
  url?: string;
  created_by?: string;
}

interface BackendRecipeApplicatif {
  id: string;
  category_id: string;
  name: string;
  description: string;
  url?: string;
  created_by?: string;
}

interface BackendRecipeSection {
  id: string;
  applicatif_id: string;
  name: string;
  description: string;
  url?: string;
  created_by?: string;
  order_index?: number;
}

interface BackendRecipeTest {
  id: string;
  section_id: string;
  name: string;
  description: string;
  criticality: 'Bloquant' | 'Majeur' | 'Mineur';
  url: string;
  created_by?: string;
  order_index?: number;
}

interface BackendTestSession {
  id: string;
  recipe_book_id: string;
  campaign_id?: string | null;
  tester_name: string;
  title: string;
  mode: string;
  date_executed: string;
  status: string;
  environment: string;
}

interface BackendTestCampaign {
  id: string;
  recipe_book_id: string;
  name: string;
  created_by: string;
  date_created: string;
  status: string;
  environment: string;
}

interface BackendTestSessionPayload {
  id: string;
  recipe_book_id: string;
  campaign_id?: string | null;
  tester_name: string;
  title: string;
  mode: string;
  date_executed: string | null;
  status: string;
  environment: string;
}

interface BackendTestResponsePayload {
  session_id: string;
  test_id: string;
  status: string;
  notes: string;
  date_responded: string;
  capture_path?: string;
}

interface BackendTaskResponsePayload {
  session_id: string;
  task_id: string;
  status: string;
  notes: string;
  capture_path?: string;
}

@Injectable({
  providedIn: 'root'
})
export class RecipeService {
  private http = inject(HttpClient);
  // Base de l'API portail injectée via API_DATA_URL (token DI, @portail/core-data-access)
  // plutôt que lue depuis le runtime-env du portail : les recettes n'ont plus besoin de
  // connaître l'app qui les héberge, seulement le contrat de token partagé par toutes les
  // sous-applis (voir docs/architecture-sous-applications.md).
  private apiDataUrl = inject(API_DATA_URL);

  // L'API d'origine exigeait des en-têtes IDUSER/IDAPPEL/IDTRANSACTION : ils ont été retirés
  // lors de l'intégration au portail. Ils n'y ont aucun sens (l'authentification passe par le
  // token Bearer ajouté par l'intercepteur) et, surtout, ils ne figurent pas dans les
  // `allowedHeaders` du CORS de server-data.js : le préflight répondait donc sans les
  // autoriser et le navigateur bloquait TOUS les appels des recettes.
  private get headers(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json'
    });
  }

  private extractArray<T>(res: unknown): T[] {
    if (!res) return [];
    if (Array.isArray(res)) return res as T[];
    const responseObj = res as BackendResponse<T>;
    if (responseObj.data) {
      if (Array.isArray(responseObj.data)) {
        return responseObj.data;
      }
      if (typeof responseObj.data === 'object' && responseObj.data !== null) {
        const record = responseObj.data as Record<string, unknown>;
        if (record['id'] !== undefined) {
          return [responseObj.data as T];
        } else {
          return Object.values(record) as T[];
        }
      }
    }
    return [];
  }

  getUsers(): Observable<RecipeUser[]> {
    const url = this.apiDataUrl + environment.serviceRecipeUsers;
    return this.http.get<unknown>(url, { headers: this.headers }).pipe(
      map(res => {
        if (!res) return [];
        if (Array.isArray(res)) return res as RecipeUser[];
        const responseObj = res as Record<string, any>;
        if (responseObj['users'] && Array.isArray(responseObj['users'])) {
          return responseObj['users'].map((u: any) => ({
            id: String(u.id),
            nom: u.nom,
            prenom: u.prenom,
            matricule: u.matricule || `X${u.id}007`
          }));
        }
        return this.extractArray<any>(res).map((u: any) => ({
          id: String(u.id),
          nom: u.nom,
          prenom: u.prenom,
          matricule: u.matricule || `X${u.id}007`
        }));
      }),
      catchError(err => {
        console.error("Erreur API getUsers (Recette) :", err);
        return of([
          { id: '1', nom: 'firstDuncan', prenom: 'lastDuncan', matricule: 'X495776' },
          { id: '2',  nom: 'sahra', prenom: 'Labiboche', matricule: 'X412345' },
          { id: '5', nom: 'Johann', prenom: 'Loreau', matricule: 'X577612' }
        ]);
      })
    );
  }

  getBooks(): Observable<RecipeBook[]> {
    const url = this.apiDataUrl + environment.serviceRecipeBook;
    return this.http.get<unknown>(url, { headers: this.headers }).pipe(
      map(res => {
        const rawArray = this.extractArray<BackendRecipeBook>(res);
        return rawArray.map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          dateCreated: item.date_created,
          categories: []
        }));
      }),
      catchError(err => {
        console.error("Erreur API getBooks :", err);
        return of([]);
      })
    );
  }

  saveBook(book: RecipeBook, isUpdate: boolean = false): Observable<string> {
    const endpoint = isUpdate ? environment.serviceRecipeBookUpdate : environment.serviceRecipeBookInsert;
    const url = this.apiDataUrl + endpoint;
    const formattedDate = book.dateCreated ? book.dateCreated.slice(0, 19).replace('T', ' ') : null;
    const dbPayload = {
      id: book.id,
      name: book.name,
      description: book.description,
      date_created: formattedDate
    };
    return this.http.post(url, dbPayload, { headers: this.headers, responseType: 'text' });
  }

  deleteBook(id: string): Observable<string> {
    const url = this.apiDataUrl + environment.serviceRecipeBookDelete;
    return this.http.post(url, { id }, { headers: this.headers, responseType: 'text' });
  }

  getBooksStats(): Observable<Record<string, BookStats>> {
    const urlCat = this.apiDataUrl + environment.serviceRecipeCategory;
    const urlApp = this.apiDataUrl + environment.serviceRecipeApplicatif;
    const urlSec = this.apiDataUrl + environment.serviceRecipeSection;
    const urlTest = this.apiDataUrl + environment.serviceRecipeTest;
    const urlSess = this.apiDataUrl + environment.serviceTestSession;
    const urlCamp = this.apiDataUrl + environment.serviceTestCampaign;

    return forkJoin({
      cats: this.http.get<unknown>(urlCat, { headers: this.headers }).pipe(catchError(() => of(null))),
      apps: this.http.get<unknown>(urlApp, { headers: this.headers }).pipe(catchError(() => of(null))),
      secs: this.http.get<unknown>(urlSec, { headers: this.headers }).pipe(catchError(() => of(null))),
      tests: this.http.get<unknown>(urlTest, { headers: this.headers }).pipe(catchError(() => of(null))),
      sessions: this.http.get<unknown>(urlSess, { headers: this.headers }).pipe(catchError(() => of(null))),
      campaigns: this.http.get<unknown>(urlCamp, { headers: this.headers }).pipe(catchError(() => of(null)))
    }).pipe(
      map(({ cats, apps, secs, tests, sessions, campaigns }) => {
        const rawCats = this.extractArray<BackendRecipeCategory>(cats);
        const rawApps = this.extractArray<BackendRecipeApplicatif>(apps);
        const rawSecs = this.extractArray<BackendRecipeSection>(secs);
        const rawTests = this.extractArray<BackendRecipeTest>(tests);
        const rawSessions = this.extractArray<BackendTestSession>(sessions);
        const rawCampaigns = this.extractArray<BackendTestCampaign>(campaigns);

        const catToBook = new Map<string, string>(rawCats.map(c => [c.id, c.recipe_book_id]));
        const appToBook = new Map<string, string>();
        rawApps.forEach(a => {
          const bookId = catToBook.get(a.category_id);
          if (bookId) appToBook.set(a.id, bookId);
        });
        const secToBook = new Map<string, string>();
        rawSecs.forEach(s => {
          const bookId = appToBook.get(s.applicatif_id);
          if (bookId) secToBook.set(s.id, bookId);
        });

        const stats: Record<string, BookStats> = {};
        const ensure = (bookId: string): BookStats => {
          if (!stats[bookId]) stats[bookId] = { categories: 0, applicatifs: 0, sections: 0, tests: 0, sessions: 0, campaigns: 0 };
          return stats[bookId];
        };

        rawCats.forEach(c => ensure(c.recipe_book_id).categories++);
        rawApps.forEach(a => {
          const bookId = catToBook.get(a.category_id);
          if (bookId) ensure(bookId).applicatifs++;
        });
        rawSecs.forEach(s => {
          const bookId = appToBook.get(s.applicatif_id);
          if (bookId) ensure(bookId).sections++;
        });
        rawTests.forEach(t => {
          const bookId = secToBook.get(t.section_id);
          if (bookId) ensure(bookId).tests++;
        });
        rawSessions.forEach(s => ensure(s.recipe_book_id).sessions++);
        rawCampaigns.forEach(c => ensure(c.recipe_book_id).campaigns++);

        return stats;
      }),
      catchError(err => {
        console.error("Erreur API getBooksStats :", err);
        return of({});
      })
    );
  }

  /**
   * Statut qualité de tous les cahiers en une seule passe (page d'accueil). Reconstitue, à partir
   * des collections À PLAT (categories/applicatifs/sections/tests/tasks non filtrées, comme
   * getBooksStats ci-dessus), juste assez de `RecipeCategory[]` par cahier — une seule catégorie/
   * applicatif/section fictifs contenant les vrais tests — pour pouvoir réutiliser
   * `evaluateQualityGate()` telle quelle : la logique de seuils GO/GO-CONDITIONAL/NO-GO par
   * environnement ne doit exister qu'à un seul endroit (models/recipe.model.ts), y compris pour
   * ce résumé "coup d'œil" de la page d'accueil.
   *
   * Simplification volontaire par rapport à l'onglet Résultats : le statut d'un cahier est calculé
   * sur sa SEULE dernière session (pas d'agrégation multi-sessions par campagne) — suffisant pour
   * un indicateur de tendance sur la page d'accueil, l'analyse fine restant dans Résultats.
   */
  getBooksQualityOverview(): Observable<BooksQualityOverview> {
    const urlCat = this.apiDataUrl + environment.serviceRecipeCategory;
    const urlApp = this.apiDataUrl + environment.serviceRecipeApplicatif;
    const urlSec = this.apiDataUrl + environment.serviceRecipeSection;
    const urlTest = this.apiDataUrl + environment.serviceRecipeTest;
    const urlTask = this.apiDataUrl + environment.serviceRecipeTask;

    return forkJoin({
      cats: this.http.get<unknown>(urlCat, { headers: this.headers }).pipe(catchError(() => of(null))),
      apps: this.http.get<unknown>(urlApp, { headers: this.headers }).pipe(catchError(() => of(null))),
      secs: this.http.get<unknown>(urlSec, { headers: this.headers }).pipe(catchError(() => of(null))),
      tests: this.http.get<unknown>(urlTest, { headers: this.headers }).pipe(catchError(() => of(null))),
      tasks: this.http.get<unknown>(urlTask, { headers: this.headers }).pipe(catchError(() => of(null))),
      sessions: this.getSessions().pipe(catchError(() => of([] as TestSession[]))),
      campaigns: this.getCampaigns().pipe(catchError(() => of([] as TestCampaign[])))
    }).pipe(
      map(({ cats, apps, secs, tests, tasks, sessions, campaigns }) => {
        const rawCats = this.extractArray<BackendRecipeCategory>(cats);
        const rawApps = this.extractArray<BackendRecipeApplicatif>(apps);
        const rawSecs = this.extractArray<BackendRecipeSection>(secs);
        const rawTests = this.extractArray<BackendRecipeTest>(tests);
        const rawTasks = this.extractArray<any>(tasks);

        const catToBook = new Map<string, string>(rawCats.map(c => [c.id, c.recipe_book_id]));
        const appToBook = new Map<string, string>();
        rawApps.forEach(a => { const b = catToBook.get(a.category_id); if (b) appToBook.set(a.id, b); });
        const secToBook = new Map<string, string>();
        rawSecs.forEach(s => { const b = appToBook.get(s.applicatif_id); if (b) secToBook.set(s.id, b); });

        const testsByBook = new Map<string, RecipeTest[]>();
        const testById = new Map<string, RecipeTest>();
        rawTests.forEach(t => {
          const bookId = secToBook.get(t.section_id);
          if (!bookId) return;
          const test: RecipeTest = { id: t.id, name: t.name, description: t.description, criticality: t.criticality, url: t.url, tasks: [] };
          testById.set(String(t.id), test);
          if (!testsByBook.has(bookId)) testsByBook.set(bookId, []);
          testsByBook.get(bookId)!.push(test);
        });
        rawTasks.forEach(item => {
          const test = testById.get(String(item.test_id ?? item.testId ?? ''));
          if (test) test.tasks.push({ id: String(item.id ?? item.task_id ?? ''), name: item.name || '' });
        });

        const sessionsByBook = new Map<string, TestSession[]>();
        sessions.forEach(s => {
          const key = String(s.recipeBookId);
          if (!sessionsByBook.has(key)) sessionsByBook.set(key, []);
          sessionsByBook.get(key)!.push(s);
        });
        const inProgressBooks = new Set(campaigns.filter(c => c.status === 'IN_PROGRESS').map(c => String(c.recipeBookId)));

        const sortByDateDesc = (list: TestSession[]) => [...list].sort((a, b) => {
          const da = a.dateExecuted ? new Date(a.dateExecuted.replace(' ', 'T')).getTime() : 0;
          const db = b.dateExecuted ? new Date(b.dateExecuted.replace(' ', 'T')).getTime() : 0;
          return db - da;
        });

        const perBook: Record<string, BookQualityStatus> = {};
        const allBookIds = new Set([...testsByBook.keys(), ...sessionsByBook.keys(), ...inProgressBooks]);

        allBookIds.forEach(bookId => {
          const bookSessions = sortByDateDesc(sessionsByBook.get(bookId) || []);
          const latest = bookSessions[0];
          const enCours = inProgressBooks.has(bookId);

          if (!latest) {
            perBook[bookId] = { verdict: 'PENDING', successRate: 0, coverageRate: 0, bloquantFailed: [], majeurFailed: [], enCours, lastActivity: null };
            return;
          }

          const bookTests = testsByBook.get(bookId) || [];
          const fakeTree: RecipeCategory[] = [{
            id: '_flat', name: '', comment: '',
            applicatifs: [{ id: '_flat', name: '', description: '', sections: [{ id: '_flat', name: '', description: '', tests: bookTests }] }]
          }];
          const gate = evaluateQualityGate(latest, fakeTree);

          perBook[bookId] = {
            verdict: gate.status,
            successRate: gate.successRate,
            coverageRate: gate.coverageRate,
            bloquantFailed: gate.bloquantFailedTests.map(t => ({ id: t.id, name: t.name })),
            majeurFailed: gate.majeurFailedTests.map(t => ({ id: t.id, name: t.name })),
            enCours,
            lastActivity: { testerName: latest.testerName, dateExecuted: latest.dateExecuted, environment: latest.environment || 'VAL' }
          };
        });

        const now = new Date();
        const sessionsThisMonth = sessions.filter(s => {
          if (!s.dateExecuted) return false;
          const d = new Date(s.dateExecuted.replace(' ', 'T'));
          return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        }).length;

        const recentSessions: RecentSessionEntry[] = sortByDateDesc(sessions)
          .slice(0, 6)
          .map(s => ({ bookId: String(s.recipeBookId), testerName: s.testerName, dateExecuted: s.dateExecuted, status: s.status === 'GO' || s.status === 'NO-GO' ? s.status : 'PENDING' }));

        return { perBook, recentSessions, sessionsThisMonth };
      }),
      catchError(err => {
        console.error("Erreur API getBooksQualityOverview :", err);
        return of({ perBook: {}, recentSessions: [], sessionsThisMonth: 0 });
      })
    );
  }

  getCategories(bookId?: string): Observable<RecipeCategory[]> {
    const queryParam = bookId ? `?recipe_book_id=${bookId}` : '';
    const url = this.apiDataUrl + environment.serviceRecipeCategory + queryParam;
    return this.http.get<unknown>(url, { headers: this.headers }).pipe(
      map(res => {
        let rawArray = this.extractArray<BackendRecipeCategory>(res);
        if (bookId) {
          rawArray = rawArray.filter(item => item.recipe_book_id === bookId);
        }
        return rawArray.map((item) => ({
          id: item.id,
          name: item.name,
          comment: item.comment,
          url: item.url,
          createdBy: item.created_by,
          applicatifs: []
        }));
      }),
      catchError(err => {
        console.error("Erreur API getCategories :", err);
        return of([]);
      })
    );
  }

  saveCategory(category: RecipeCategory, bookId: string, isUpdate: boolean = false): Observable<unknown> {
    const endpoint = isUpdate ? environment.serviceRecipeCategoryUpdate : environment.serviceRecipeCategoryInsert;
    const url = this.apiDataUrl + endpoint;
    const dbPayload = {
      id: category.id,
      recipe_book_id: bookId,
      name: category.name,
      comment: category.comment || null,
      url: category.url || null,
      created_by: category.createdBy || null
    };
    return this.http.post(url, dbPayload, { headers: this.headers });
  }

  deleteCategory(id: string): Observable<string> {
    const url = this.apiDataUrl + environment.serviceRecipeCategoryDelete;
    return this.http.post(url, { id }, { headers: this.headers, responseType: 'text' });
  }

  getApplicatifs(categoryId?: string): Observable<RecipeApplicatif[]> {
    const queryParam = categoryId ? `?category_id=${categoryId}` : '';
    const url = this.apiDataUrl + environment.serviceRecipeApplicatif + queryParam;
    return this.http.get<unknown>(url, { headers: this.headers }).pipe(
      map(res => {
        let rawArray = this.extractArray<BackendRecipeApplicatif>(res);
        if (categoryId) {
          rawArray = rawArray.filter(item => item.category_id === categoryId);
        }
        return rawArray.map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          url: item.url,
          createdBy: item.created_by,
          sections: []
        }));
      }),
      catchError(err => {
        console.error("Erreur API getApplicatifs :", err);
        return of([]);
      })
    );
  }

  saveApplicatif(applicatif: RecipeApplicatif, categoryId: string, isUpdate: boolean = false): Observable<unknown> {
    const endpoint = isUpdate ? environment.serviceRecipeApplicatifUpdate : environment.serviceRecipeApplicatifInsert;
    const url = this.apiDataUrl + endpoint;
    const dbPayload = {
      id: applicatif.id,
      category_id: categoryId,
      name: applicatif.name,
      description: applicatif.description,
      url: applicatif.url || null,
      created_by: applicatif.createdBy || null
    };
    return this.http.post(url, dbPayload, { headers: this.headers });
  }

  deleteApplicatif(id: string): Observable<string> {
    const url = this.apiDataUrl + environment.serviceRecipeApplicatifDelete;
    return this.http.post(url, { id }, { headers: this.headers, responseType: 'text' });
  }

  getSections(applicatifId?: string): Observable<RecipeSection[]> {
    const queryParam = applicatifId ? `?applicatif_id=${applicatifId}` : '';
    const url = this.apiDataUrl + environment.serviceRecipeSection + queryParam;
    return this.http.get<unknown>(url, { headers: this.headers }).pipe(
      map(res => {
        let rawArray = this.extractArray<BackendRecipeSection>(res);
        if (applicatifId) {
          rawArray = rawArray.filter(item => item.applicatif_id === applicatifId);
        }
        return rawArray
          .map((item) => ({
            id: item.id,
            name: item.name,
            description: item.description,
            url: item.url,
            createdBy: item.created_by,
            tests: [],
            order_index: item.order_index ?? 0
          }))
          .sort((a, b) => a.order_index - b.order_index);
      }),
      catchError(err => {
        console.error("Erreur API getSections :", err);
        return of([]);
      })
    );
  }

  saveSection(section: RecipeSection, applicatifId: string, isUpdate: boolean = false): Observable<unknown> {
    const endpoint = isUpdate ? environment.serviceRecipeSectionUpdate : environment.serviceRecipeSectionInsert;
    const url = this.apiDataUrl + endpoint;
    const dbPayload = {
      id: section.id,
      applicatif_id: applicatifId,
      name: section.name,
      description: section.description,
      url: section.url || null,
      created_by: section.createdBy || null,
      order_index: section.order_index ?? 0
    };
    return this.http.post(url, dbPayload, { headers: this.headers });
  }

  reorderSections(sections: RecipeSection[], applicatifId: string): Observable<unknown[]> {
    const toSave = sections
      .map((section, index) => ({ section, index }))
      .filter(({ section, index }) => section.order_index !== index)
      .map(({ section, index }) => {
        section.order_index = index;
        return this.saveSection(section, applicatifId, true);
      });
    if (toSave.length === 0) return of([]);
    return forkJoin(toSave);
  }

  deleteSection(id: string): Observable<string> {
    const url = this.apiDataUrl + environment.serviceRecipeSectionDelete;
    return this.http.post(url, { id }, { headers: this.headers, responseType: 'text' });
  }

  getTests(sectionId?: string): Observable<RecipeTest[]> {
    const queryParam = sectionId ? `?section_id=${sectionId}` : '';
    const url = this.apiDataUrl + environment.serviceRecipeTest + queryParam;
    return this.http.get<unknown>(url, { headers: this.headers }).pipe(
      map(res => {
        let rawArray = this.extractArray<BackendRecipeTest>(res);
        if (sectionId) {
          rawArray = rawArray.filter(item => String(item.section_id) === String(sectionId));
        }
        return rawArray
          .map((item) => ({
            id: item.id,
            name: item.name,
            description: item.description,
            criticality: item.criticality,
            url: item.url,
            createdBy: item.created_by,
            tasks: [],
            order_index: item.order_index ?? 0
          }))
          .sort((a, b) => a.order_index - b.order_index);
      }),
      catchError(err => {
        console.error("Erreur API getTests :", err);
        return of([]);
      })
    );
  }

  saveTest(test: RecipeTest, sectionId: string, isUpdate: boolean = false): Observable<unknown> {
    const endpoint = isUpdate ? environment.serviceRecipeTestUpdate : environment.serviceRecipeTestInsert;
    const url = this.apiDataUrl + endpoint;
    const dbPayload = {
      id: test.id,
      section_id: sectionId,
      name: test.name,
      description: test.description,
      criticality: test.criticality,
      url: test.url || null,
      created_by: test.createdBy || null,
      order_index: test.order_index ?? 0
    };
    return this.http.post(url, dbPayload, { headers: this.headers });
  }

  reorderTests(tests: RecipeTest[], sectionId: string): Observable<unknown[]> {
    const toSave = tests
      .map((test, index) => ({ test, index }))
      .filter(({ test, index }) => test.order_index !== index)
      .map(({ test, index }) => {
        test.order_index = index;
        return this.saveTest(test, sectionId, true);
      });
    if (toSave.length === 0) return of([]);
    return forkJoin(toSave);
  }

  deleteTest(id: string): Observable<string> {
    const url = this.apiDataUrl + environment.serviceRecipeTestDelete;
    return this.http.post(url, { id }, { headers: this.headers, responseType: 'text' });
  }

  getTasks(testId?: string): Observable<RecipeTask[]> {
    const queryParam = testId ? `?test_id=${testId}` : '';
    const url = this.apiDataUrl + environment.serviceRecipeTask + queryParam;
    return this.http.get<unknown>(url, { headers: this.headers }).pipe(
      map(res => {
        let rawArray = this.extractArray<any>(res);
        if (testId) {
          rawArray = rawArray.filter(item => String(item.test_id || item.testId || '') === String(testId));
        }
        return rawArray.map((item) => ({
          id: String(item.id || item.task_id || item.taskId || ''),
          name: item.name || item.task_name || 'Tâche sans nom'
        }));
      }),
      catchError(err => {
        console.error("Erreur API getTasks :", err);
        return of([]);
      })
    );
  }

  saveTask(task: RecipeTask, testId: string, isUpdate: boolean = false): Observable<unknown> {
    const endpoint = isUpdate ? environment.serviceRecipeTaskUpdate : environment.serviceRecipeTaskInsert;
    const url = this.apiDataUrl + endpoint;
    const dbPayload = {
      id: task.id,
      test_id: testId,
      name: task.name,
      order_index: 0
    };
    return this.http.post(url, dbPayload, { headers: this.headers });
  }

  deleteTask(id: string): Observable<string> {
    const url = this.apiDataUrl + environment.serviceRecipeTaskDelete;
    return this.http.post(url, { id }, { headers: this.headers, responseType: 'text' });
  }

  private treeRequests = new Map<string, Observable<RecipeCategory[]>>();

  getFullTree(bookId: string): Observable<RecipeCategory[]> {
    const inFlight = this.treeRequests.get(bookId);
    if (inFlight) return inFlight;

    const request$ = this.getCategories(bookId).pipe(
      switchMap(categories => {
        if (!categories || categories.length === 0) return of([]);
        const catOps = categories.map(cat =>
          this.getApplicatifs(cat.id).pipe(
            switchMap(apps => {
              cat.applicatifs = apps;
              if (apps.length === 0) return of(cat);
              const appOps = apps.map(app =>
                this.getSections(app.id).pipe(
                  switchMap(sections => {
                    app.sections = sections;
                    if (sections.length === 0) return of(app);
                    const secOps = sections.map(sec =>
                      this.getTests(sec.id).pipe(
                        switchMap(tests => {
                          sec.tests = tests;
                          if (tests.length === 0) return of(sec);
                          const testOps = tests.map(test =>
                            this.getTasks(test.id).pipe(
                              map(tasks => {
                                test.tasks = tasks;
                                return test;
                              })
                            )
                          );
                          return forkJoin(testOps).pipe(map(() => sec));
                        })
                      )
                    );
                    return forkJoin(secOps).pipe(map(() => app));
                  })
                )
              );
              return forkJoin(appOps).pipe(map(() => cat));
            })
          )
        );
        return forkJoin(catOps);
      }),
      finalize(() => this.treeRequests.delete(bookId)),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this.treeRequests.set(bookId, request$);
    return request$;
  }

  getSessions(): Observable<TestSession[]> {
    const urlSess = this.apiDataUrl + environment.serviceTestSession;
    const urlResp = this.apiDataUrl + environment.serviceTestResponse;
    const urlTask = this.apiDataUrl + environment.serviceTestTaskResponse;

    return forkJoin({
      sessionsRes: this.http.get<unknown>(urlSess, { headers: this.headers }).pipe(catchError(() => of([]))),
      responsesRes: this.http.get<unknown>(urlResp, { headers: this.headers }).pipe(catchError(() => of([]))),
      tasksRes: this.http.get<unknown>(urlTask, { headers: this.headers }).pipe(catchError(() => of([])))
    }).pipe(
      map(({ sessionsRes, responsesRes, tasksRes }) => {
        const rawSessions = this.extractArray<BackendTestSession>(sessionsRes);
        const rawResp = this.extractArray<BackendTestResponsePayload>(responsesRes);
        const rawTask = this.extractArray<BackendTaskResponsePayload>(tasksRes);

        return rawSessions.map(item => {
          const sessionResponses: Record<string, TestResponse> = {};
          const sessionTaskResponses: Record<string, TestResponse> = {};

          rawResp.filter(r => String(r.session_id) === String(item.id)).forEach(r => {
            sessionResponses[r.test_id] = {
              status: r.status as TestStatus,
              notes: r.notes,
              dateResponded: r.date_responded,
              capturePath: r.capture_path || undefined
            };
          });

          rawTask.filter(t => String(t.session_id) === String(item.id)).forEach(t => {
            sessionTaskResponses[String(t.task_id)] = {
              status: String(t.status).toUpperCase() as TestStatus,
              notes: t.notes || '',
              capturePath: t.capture_path || undefined
            };
          });

          return {
            id: item.id,
            recipeBookId: item.recipe_book_id,
            campaignId: item.campaign_id || undefined,
            testerName: item.tester_name,
            title: item.title,
            mode: item.mode as 'Manuel' | 'Automatique',
            dateExecuted: item.date_executed,
            status: item.status as 'PENDING' | 'GO' | 'NO-GO',
            environment: (item.environment || 'VAL') as TestEnvironment,
            responses: sessionResponses,
            taskResponses: sessionTaskResponses
          };
        });
      }),
      catchError(err => {
        console.error("Erreur API globale getSessions :", err);
        return of([]);
      })
    );
  }

  saveSession(session: TestSession, isUpdate: boolean = false): Observable<string> {
    const endpoint = isUpdate ? environment.serviceTestSessionUpdate : environment.serviceTestSessionInsert;
    const url = this.apiDataUrl + endpoint;

    const formattedDate = session.dateExecuted ? session.dateExecuted.slice(0, 19).replace('T', ' ') : null;
    const cleanSessionId = session.id ? session.id.replace('sess-', '') : '';
    const cleanCampaignId = session.campaignId ? session.campaignId.replace('camp-', '') : null;

    const dbPayload: BackendTestSessionPayload = {
      id: cleanSessionId,
      recipe_book_id: session.recipeBookId,
      tester_name: session.testerName || '',
      title: session.title || '',
      mode: session.mode || 'Manuel',
      date_executed: formattedDate,
      status: session.status || 'PENDING',
      environment: session.environment || 'VAL'
    };

    if (cleanCampaignId && cleanCampaignId !== 'null' && cleanCampaignId.trim() !== '') {
      dbPayload.campaign_id = cleanCampaignId;
    }

    return this.http.post(url, dbPayload, { headers: this.headers, responseType: 'text' });
  }

  deleteSession(id: string): Observable<string> {
    const url = this.apiDataUrl + environment.serviceTestSessionDelete;
    return this.http.post(url, { id }, { headers: this.headers, responseType: 'text' });
  }

  /**
   * CORRECTIF CRITIQUE AIRBUS : 
   * Pour écraser un enregistrement de réponse en BDD récalcitrant sans créer de doublon,
   * on s'assure d'appeler la suppression des lignes au préalable.
   */
  clearSessionResults(session: TestSession): Observable<unknown> {
    const cleanSessionId = session.id.replace('sess-', '');
    const ops: Observable<unknown>[] = [];

    console.log("[Airbus QA Service Log] Déclenchement de clearSessionResults (Purge BDD des doublons) pour la session :", cleanSessionId);

    // Étape 1 : SUPPRESSION BRUTE DES RÉSULTATS POUR LA SESSION ACTIVE (Pas de doublon possible)
    if (session.responses) {
      Object.keys(session.responses).forEach(testId => {
        const urlDelTest = this.apiDataUrl + environment.serviceTestResponseDelete;
        console.log(`[Airbus QA Service Log] Envoi du DELETE pour la fiche test: ${testId}`);
        ops.push(this.http.post(urlDelTest, { session_id: cleanSessionId, test_id: testId }, { headers: this.headers, responseType: 'text' }).pipe(
          catchError(err => {
            console.warn(`[Airbus QA Service Log] Silence Delete error pour fiche ${testId}`, err);
            return of('');
          })
        ));
      });
    }

    if (session.taskResponses) {
      Object.keys(session.taskResponses).forEach(taskId => {
        const urlDelTask = this.apiDataUrl + environment.serviceTestTaskResponseDelete;
        console.log(`[Airbus QA Service Log] Envoi du DELETE pour la sous-tâche: ${taskId}`);
        ops.push(this.http.post(urlDelTask, { session_id: cleanSessionId, task_id: taskId }, { headers: this.headers, responseType: 'text' }).pipe(
          catchError(err => {
            console.warn(`[Airbus QA Service Log] Silence Delete error pour tâche ${taskId}`, err);
            return of('');
          })
        ));
      });
    }

    // Remise à zéro de l'état d'agrégat parent
    session.status = 'PENDING';
    ops.push(this.saveSession(session, true));

    return ops.length > 0 ? forkJoin(ops) : of(null);
  }

  saveTestResponse(payload: BackendTestResponsePayload): Observable<string> {
    const url = this.apiDataUrl + environment.serviceTestResponseInsert;
    console.log("saveTestResponse > url : ", url);
    console.log("saveTestResponse > payload : ", payload);
    return this.http.post(url, payload, { headers: this.headers, responseType: 'text' });
  }

  updateTestResponse(payload: BackendTestResponsePayload): Observable<string> {
    const url = this.apiDataUrl + environment.serviceTestResponseUpdate2;
    console.log("updateTestResponse > url : ", url);
    console.log("updateTestResponse > payload : ", payload);
    return this.http.post(url, payload, { headers: this.headers, responseType: 'text' }).pipe(
      catchError(() => this.saveTestResponse(payload))
    );
  }

  uploadCapture(dataUrl: string): Observable<{ path: string }> {
    const url = this.apiDataUrl + environment.serviceCaptureUpload;
    return this.http.post<{ path: string }>(url, { dataUrl }, { headers: this.headers });
  }

  saveTaskResponse(payload: BackendTaskResponsePayload): Observable<string> {
    const url = this.apiDataUrl + environment.serviceTestTaskResponseInsert;
    return this.http.post(url, payload, { headers: this.headers, responseType: 'text' });
  }

  updateTaskResponse(payload: BackendTaskResponsePayload): Observable<string> {
    const url = this.apiDataUrl + environment.serviceTestTaskResponseUpdate2;
    console.log("updateTaskResponse > url : ", url);
    console.log("updateTaskResponse > payload : ", payload);
    return this.http.post(url, payload, { headers: this.headers, responseType: 'text' }).pipe(
      catchError(() => this.saveTaskResponse(payload))
    );
  }

  saveCompleteSession(session: TestSession, isUpdate: boolean = false): Observable<unknown> {
    return this.saveSession(session, isUpdate).pipe(
      switchMap(() => {
        const operations: Observable<string>[] = [];
        const cleanSessionId = session.id.replace('sess-', '');
        const fallbackDateSql = new Date().toISOString().slice(0, 19).replace('T', ' ');

        if (session.responses) {
          Object.keys(session.responses).forEach((testId) => {
            const res = session.responses[testId];
            const formattedDate = res.dateResponded ? res.dateResponded.slice(0, 19).replace('T', ' ') : fallbackDateSql;
            operations.push(
              this.saveTestResponse({
                session_id: cleanSessionId,
                test_id: testId,
                status: res.status,
                notes: res.notes || '',
                date_responded: formattedDate,
                capture_path: res.capturePath
              })
            );
          });
        }

        if (session.taskResponses) {
          Object.keys(session.taskResponses).forEach((taskId) => {
            const res = session.taskResponses[taskId];
            operations.push(
              this.saveTaskResponse({
                session_id: cleanSessionId,
                task_id: taskId,
                status: res.status,
                notes: res.notes || '',
                capture_path: res.capturePath
              })
            );
          });
        }

        if (operations.length === 0) {
          return of([]);
        }
        return forkJoin(operations);
      })
    );
  }

  getCampaigns(): Observable<TestCampaign[]> {
    const url = this.apiDataUrl + environment.serviceTestCampaign;
    return this.http.get<unknown>(url, { headers: this.headers }).pipe(
      map(res => {
        const rawArray = this.extractArray<BackendTestCampaign>(res);
        return rawArray.map(item => ({
          id: item.id,
          recipeBookId: item.recipe_book_id,
          name: item.name,
          createdBy: item.created_by,
          dateCreated: item.date_created,
          status: item.status as 'IN_PROGRESS' | 'COMPLETED',
          environment: (item.environment || 'VAL') as TestEnvironment
        })).sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime());
      }),
      catchError(err => {
        console.error("Erreur API getCampaigns :", err);
        return of([]);
      })
    );
  }

  saveCampaign(camp: TestCampaign, isUpdate: boolean = false): Observable<string> {
    const endpoint = isUpdate ? environment.serviceTestCampaignUpdate : environment.serviceTestCampaignInsert;
    const url = this.apiDataUrl + endpoint;

    const formattedDate = camp.dateCreated ? camp.dateCreated.slice(0, 19).replace('T', ' ') : null;

    const dbPayload = {
      id: camp.id.replace('camp-', ''),
      recipe_book_id: camp.recipeBookId,
      name: camp.name,
      created_by: camp.createdBy,
      date_created: formattedDate,
      status: camp.status,
      environment: camp.environment || 'VAL'
    };

    return this.http.post(url, dbPayload, { headers: this.headers, responseType: 'text' }) as Observable<string>;
  }

  deleteCampaign(id: string): Observable<string> {
    const url = this.apiDataUrl + environment.serviceTestCampaignDelete;
    return this.http.post(url, { id }, { headers: this.headers, responseType: 'text' });
  }
}