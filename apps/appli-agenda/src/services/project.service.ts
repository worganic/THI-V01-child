import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, forkJoin, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Project, User, CreateProjectPayload, UpdateProjectPayload, ProjectTask, CreateTaskPayload, UpdateTaskPayload, UnavailabilityPeriod, CreateUnavailabilityPayload, ProjectMetier } from '../models/project.model';
import { calculateProjectsProgress } from '../utils/project-progress';
import { getInitialMockProjects, getInitialMockUsers } from './project-mock-data';
import { loadFromLocalStorage, saveToLocalStorage } from '../utils/local-cache';

/** Nom du groupe portail dont l'appartenance fait d'un utilisateur un "développeur" éligible ici. */
const DEVELOPER_GROUP_NAME = 'Developpeur';

// Clés du repli localStorage (voir utils/local-cache.ts) : sans backend agenda joignable, projets/
// tâches et indisponibilités ne vivaient qu'en mémoire JS de l'onglet, perdus au moindre
// rechargement (build, F5...). Voir CLAUDE.md — "Persistance en mode dégradé".
const PROJECTS_CACHE_KEY = 'agenda:local-cache:projects';
const UNAVAILABILITIES_CACHE_KEY = 'agenda:local-cache:unavailabilities';

@Injectable({
  providedIn: 'root'
})
export class ProjectService {
  private http = inject(HttpClient);

  // En-têtes HTTP obligatoires pour les requêtes API Airbus
  private readonly headers = new HttpHeaders({
    'Content-Type': 'application/json',
    'IDUSER': environment.IDUSER || '515',
    'IDAPPEL': environment.IDAPPEL || 'POST-TEST',
    'IDTRANSACTION': environment.IDTRANSACTION || 'P-20260724'
  });

  // 🔧 CORRECTIF : comme les autres services (admin.service.ts, recipe.service.ts...),
  // les chemins relatifs doivent être préfixés par serviceVal ("/val/v2") pour passer par
  // le proxy Angular. Sans ce préfixe, les requêtes visaient directement le dev-server
  // (404 immédiat, jamais transmis au mock ni à l'API réelle).
  private readonly apiUrl = environment.serviceVal + (environment.serviceAgenda || '/agenda');
  private readonly usersUrl = environment.serviceVal + (environment.serviceUsers || '/POPORTAIL/users/');
  // Appartenance aux groupes portail (table de jointure user_id/groupe_id) : c'est la source
  // réelle de "qui est développeur", déjà utilisée par l'admin (admin.service.ts). Remplace
  // l'ancien filtrage par liste de matricules codés en dur (fragile à chaque changement d'effectif).
  private readonly groupesUrl = environment.serviceVal + (environment.serviceGroupes || '/POPORTAIL/groupes/');
  private readonly userGroupesUrl = environment.serviceVal + (environment.serviceUserGroupes || '/POPORTAIL/user_groupes/');
  // Métiers (Dev/Infra/Media...) : source unique partagée avec Admin > Métiers (portail-shell),
  // l'agenda ne fait plus que les consommer en lecture (voir CLAUDE.md — plus de CRUD catégories
  // ici, la gestion se fait exclusivement côté admin).
  private readonly metiersUrl = environment.serviceVal + (environment.serviceMetiers || '/POPORTAIL/metiers/');

  // Valeur initiale : dernier état connu en localStorage (survit aux rechargements en mode
  // dégradé) si présent, sinon les données de démo figées. Chaque émission de projects$/
  // unavailabilities$ (succès serveur COMME repli local) est re-sauvegardée juste en dessous —
  // le cache suit donc aussi bien un retour en ligne qu'une modification hors-ligne.
  private projectsSubject = new BehaviorSubject<Project[]>(
    loadFromLocalStorage(PROJECTS_CACHE_KEY, getInitialMockProjects())
  );
  public projects$ = this.projectsSubject.asObservable();

  private usersSubject = new BehaviorSubject<User[]>(getInitialMockUsers());
  public users$ = this.usersSubject.asObservable();

  private unavailabilitiesSubject = new BehaviorSubject<UnavailabilityPeriod[]>(
    loadFromLocalStorage(UNAVAILABILITIES_CACHE_KEY, [])
  );
  public unavailabilities$ = this.unavailabilitiesSubject.asObservable();

  // Pas de repli localStorage : contrairement aux projets/indisponibilités (modifiables hors-ligne),
  // les métiers sont désormais en lecture seule ici — leur source d'autorité (Admin > Métiers)
  // reste, elle, cachée par le mécanisme propre à portail-shell.
  private metiersSubject = new BehaviorSubject<ProjectMetier[]>([]);
  public metiers$ = this.metiersSubject.asObservable();

  // Persiste chaque nouvel état en localStorage, quelle que soit son origine (réponse serveur ou
  // repli optimiste local) : un rechargement retrouve donc toujours le dernier état vu, jamais les
  // données de démo figées, tant qu'au moins un appel a eu lieu depuis le premier chargement.
  private readonly persistProjectsSub = this.projects$.subscribe(projects =>
    saveToLocalStorage(PROJECTS_CACHE_KEY, projects)
  );
  private readonly persistUnavailabilitiesSub = this.unavailabilities$.subscribe(periods =>
    saveToLocalStorage(UNAVAILABILITIES_CACHE_KEY, periods)
  );

  // Signale qu'un appel vient de retomber sur les données locales (mock) faute de réponse
  // serveur exploitable — contrairement au catchError silencieux d'origine, qui masquait aussi
  // bien l'absence de backend (attendu en démo) qu'une vraie panne (réseau, 500, token expiré).
  // null = dernier appel réussi ; une chaîne = message à afficher dans le bandeau d'alerte.
  private apiIssueSubject = new BehaviorSubject<string | null>(null);
  public apiIssue$ = this.apiIssueSubject.asObservable();

  private reportApiIssue(message: string): void {
    this.apiIssueSubject.next(message);
  }

  private clearApiIssue(): void {
    this.apiIssueSubject.next(null);
  }

  private mapRawUser(u: any): User {
    return {
      id: Number(u.id),
      matricule: u.matricule || '',
      firstname: u.prenom || u.firstname || '',
      lastname: (u.nom || u.lastname || '').toUpperCase(),
      email: u.email || '',
      role: u.role || '',
      groupe: u.groupe || u.role || '',
      is_active: u.is_active !== undefined ? (Number(u.is_active) === 1 || u.is_active === true) : true,
      metier_id: (u.metier_id ?? u.METIER_ID) != null ? Number(u.metier_id ?? u.METIER_ID) : null
    };
  }

  /**
   * Récupère la liste des utilisateurs depuis la BDD principale (poportail.users) et ne retient
   * que les membres du groupe "Developpeur" — via la table de jointure user_groupes/groupes déjà
   * utilisée par l'admin, pas via une liste de matricules codés en dur : celle-ci se désynchronise
   * silencieusement à chaque arrivée/départ (l'app affichait "0 développeur" pour tout nouvel
   * arrivant tant que son matricule n'était pas ajouté à la liste en dur dans ce fichier).
   */
  getUsers(): Observable<User[]> {
    return forkJoin({
      users: this.http.get<unknown>(this.usersUrl, { headers: this.headers }),
      groupes: this.http.get<unknown>(this.groupesUrl, { headers: this.headers }),
      userGroupes: this.http.get<unknown>(this.userGroupesUrl, { headers: this.headers })
    }).pipe(
      map(({ users, groupes, userGroupes }) => {
        const rawUsers: any[] = Array.isArray(users) ? users : ((users as any)?.data || []);
        const rawGroupes: any[] = Array.isArray(groupes) ? groupes : ((groupes as any)?.data || []);
        const rawUserGroupes: any[] = Array.isArray(userGroupes) ? userGroupes : ((userGroupes as any)?.data || []);

        const developerGroupIds = new Set(
          rawGroupes
            .filter((g: any) => (g.nom || g.NOM) === DEVELOPER_GROUP_NAME)
            .map((g: any) => Number(g.id ?? g.ID))
        );
        const developerUserIds = new Set(
          rawUserGroupes
            .filter((ug: any) => developerGroupIds.has(Number(ug.groupe_id ?? ug.GROUPE_ID)))
            .map((ug: any) => Number(ug.user_id ?? ug.USER_ID))
        );

        // Portail sans groupe "Developpeur" (cas par défaut : les groupes sont libres, voir
        // Admin › Applications › Groupes) : le filtre n'a alors aucun sens et vider la liste
        // rendrait l'agenda inutilisable — tous les utilisateurs actifs sont proposés. Dès
        // qu'un groupe portant ce nom existe, il redevient la source de vérité.
        const filtrerParGroupe = developerGroupIds.size > 0;

        return rawUsers
          .map((u: any) => this.mapRawUser(u))
          .filter((user: User) => user.is_active === true
            && (!filtrerParGroupe || developerUserIds.has(user.id)));
      }),
      tap(devs => { this.usersSubject.next(devs); this.clearApiIssue(); }),
      catchError(() => {
        this.reportApiIssue('Liste des développeurs indisponible côté serveur — affichage des données précédentes.');
        return this.users$;
      })
    );
  }

  /**
   * Tous les utilisateurs actifs du portail, SANS filtrage par groupe "Developpeur" — contrairement
   * à getUsers(). N'alimente que le filtre par métier du formulaire projet : dès qu'un métier est
   * coché, il remplace le filtre groupe (un utilisateur qui n'est pas du groupe Developpeur mais
   * porte le métier coché doit quand même pouvoir être affecté) — voir
   * NouveauProjetComponent.visibleUsers. Sans métier coché, la liste par défaut (getUsers(), groupe
   * Developpeur) reste inchangée.
   */
  getAllActiveUsers(): Observable<User[]> {
    return this.http.get<unknown>(this.usersUrl, { headers: this.headers }).pipe(
      map((response: any) => {
        const raw: any[] = Array.isArray(response) ? response : (response?.data || []);
        return raw
          .map((u: any) => this.mapRawUser(u))
          .filter((user: User) => user.is_active === true);
      }),
      catchError(() => of([]))
    );
  }

  getProjects(): Observable<Project[]> {
    return this.http.get<Project[]>(`${this.apiUrl}/projects?options=hydrat`, { headers: this.headers }).pipe(
      map(projects => calculateProjectsProgress(projects)),
      tap(projects => { this.projectsSubject.next(projects); this.clearApiIssue(); }),
      catchError(() => {
        this.reportApiIssue('Connexion au serveur agenda indisponible — les projets affichés sont locaux et non synchronisés.');
        const current = this.projectsSubject.value;
        return of(calculateProjectsProgress(current));
      })
    );
  }

  /** Résout une liste d'ids de métier en objets ProjectMetier complets (repli hors-ligne). */
  private hydrateMetiers(ids: number[] | undefined): ProjectMetier[] {
    if (!ids || ids.length === 0) return [];
    return ids
      .map(id => this.metiersSubject.value.find(m => m.id === id))
      .filter((m): m is ProjectMetier => !!m);
  }

  createProject(payload: CreateProjectPayload): Observable<Project> {
    return this.http.post<Project>(`${this.apiUrl}/projects`, payload, { headers: this.headers }).pipe(
      tap(newProj => {
        const current = this.projectsSubject.value;
        this.projectsSubject.next([newProj, ...current]);
        this.clearApiIssue();
      }),
      catchError(() => {
        this.reportApiIssue('Le nouveau projet n\'a pas pu être enregistré côté serveur — il n\'existe que localement pour l\'instant.');
        const devs = this.usersSubject.value.filter(u => payload.developerIds.includes(u.id));
        const mockNewProj: Project = {
          id: Date.now(),
          code: payload.code,
          name: payload.name,
          description: payload.description,
          status: 'EN_COURS',
          riskLevel: payload.riskLevel,
          dateStart: payload.dateStart,
          dateEndEstimated: payload.dateEndEstimated,
          estimatedTimeDays: payload.estimatedTimeDays,
          createdByMatricule: 'X495776',
          developers: devs,
          excludeWeekends: payload.excludeWeekends ?? false,
          excludeHolidays: payload.excludeHolidays ?? false,
          metierIds: payload.metierIds ?? [],
          metiers: this.hydrateMetiers(payload.metierIds),
          tasks: payload.tasks.map((t, idx) => ({
            id: Date.now() + idx,
            projectId: Date.now(),
            name: t.name,
            status: 'NON_COMMENCE',
            assignedUserId: t.assignedUserId,
            assignedUser: this.usersSubject.value.find(u => u.id === t.assignedUserId),
            dateStart: t.dateStart,
            dateEnd: t.dateEnd,
            halfDaysDuration: t.halfDaysDuration,
            comments: t.comments,
            isRisky: t.isRisky ?? false
          })),
          progressPercent: 0
        };
        const current = this.projectsSubject.value;
        this.projectsSubject.next([mockNewProj, ...current]);
        return of(mockNewProj);
      })
    );
  }

  updateProject(payload: UpdateProjectPayload): Observable<Project> {
    return this.http.put<Project>(`${this.apiUrl}/projects/${payload.id}`, payload, { headers: this.headers }).pipe(
      tap(updated => {
        const current = this.projectsSubject.value;
        this.projectsSubject.next(current.map(p => p.id === updated.id ? updated : p));
        this.clearApiIssue();
      }),
      catchError(() => {
        this.reportApiIssue('Les modifications du projet n\'ont pas pu être enregistrées côté serveur — visibles seulement localement.');
        const devs = this.usersSubject.value.filter(u => payload.developerIds.includes(u.id));
        const current = this.projectsSubject.value;
        const updated = current.map(p => p.id === payload.id ? {
          ...p,
          code: payload.code,
          name: payload.name,
          description: payload.description,
          riskLevel: payload.riskLevel,
          dateStart: payload.dateStart,
          dateEndEstimated: payload.dateEndEstimated,
          estimatedTimeDays: payload.estimatedTimeDays,
          developers: devs,
          excludeWeekends: payload.excludeWeekends ?? false,
          excludeHolidays: payload.excludeHolidays ?? false,
          weekendsRuleFrom: payload.weekendsRuleFrom ?? null,
          holidaysRuleFrom: payload.holidaysRuleFrom ?? null,
          metierIds: payload.metierIds ?? [],
          metiers: this.hydrateMetiers(payload.metierIds)
        } : p);
        this.projectsSubject.next(updated);
        return of(updated.find(p => p.id === payload.id) as Project);
      })
    );
  }

  updateTaskStatus(taskId: number, newStatus: ProjectTask['status']): Observable<boolean> {
    const applyLocally = () => {
      const projects = this.projectsSubject.value.map(p => {
        const updatedTasks = p.tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t);
        return { ...p, tasks: updatedTasks };
      });
      this.projectsSubject.next(calculateProjectsProgress(projects));
    };
    return this.http.patch<boolean>(`${this.apiUrl}/tasks/${taskId}`, { status: newStatus }, { headers: this.headers }).pipe(
      tap(() => { this.clearApiIssue(); applyLocally(); }),
      catchError(() => {
        this.reportApiIssue('Le changement de statut n\'a pas pu être enregistré côté serveur.');
        applyLocally();
        return of(true);
      })
    );
  }

  createTask(projectId: number, payload: CreateTaskPayload): Observable<ProjectTask> {
    return this.http.post<ProjectTask>(`${this.apiUrl}/projects/${projectId}/tasks`, payload, { headers: this.headers }).pipe(
      tap(task => { this.upsertTaskInSubject(projectId, task); this.clearApiIssue(); }),
      catchError(() => {
        this.reportApiIssue('La nouvelle tâche n\'a pas pu être enregistrée côté serveur — visible seulement localement.');
        const task: ProjectTask = {
          id: Date.now(),
          projectId,
          name: payload.name,
          description: payload.description,
          status: payload.status || 'NON_COMMENCE',
          assignedUserId: payload.assignedUserId ?? null,
          assignedUser: this.usersSubject.value.find(u => u.id === payload.assignedUserId),
          dateStart: payload.dateStart,
          dateEnd: payload.dateEnd,
          halfDaysDuration: payload.halfDaysDuration,
          comments: payload.comments,
          isRisky: payload.isRisky ?? false,
          gitBranch: payload.gitBranch,
          baseDateEnd: payload.dateEnd,
          workedHalfDays: payload.workedHalfDays || [],
          extensions: payload.extensions || [],
          history: payload.history || [],
          subTasks: payload.subTasks || []
        };
        this.upsertTaskInSubject(projectId, task);
        return of(task);
      })
    );
  }

  updateTask(payload: UpdateTaskPayload): Observable<ProjectTask> {
    return this.http.put<ProjectTask>(`${this.apiUrl}/tasks/${payload.id}`, payload, { headers: this.headers }).pipe(
      tap(task => { this.upsertTaskInSubject(task.projectId, task); this.clearApiIssue(); }),
      catchError(() => {
        this.reportApiIssue('Les modifications de la tâche n\'ont pas pu être enregistrées côté serveur.');
        // Retrouve la tâche existante AVANT de reconstruire l'objet local : certains appelants
        // (recalcul auto de retard, déplacement dev-only...) omettent volontairement baseDateEnd
        // pour NE PAS redéfinir le plan initial. Un simple `payload.baseDateEnd` ici l'écraserait
        // à `undefined` à chaque appel — recomputeTaskSchedule perdrait alors son ancrage fixe et
        // "chasserait" la date de fin qu'il vient lui-même de calculer, provoquant une extension de
        // la tâche qui s'aggrave à chaque rechargement (voir utils/task-progress.ts). Repli
        // identique à celui déjà appliqué côté mock-api (server.js) pour ce même champ.
        const oldTask = this.projectsSubject.value.flatMap(p => p.tasks).find(t => t.id === payload.id);
        const projectId = oldTask?.projectId ?? this.projectsSubject.value.find(p => p.tasks.some(t => t.id === payload.id))?.id ?? 0;
        const task: ProjectTask = {
          id: payload.id,
          projectId,
          name: payload.name,
          description: payload.description,
          status: payload.status,
          assignedUserId: payload.assignedUserId ?? null,
          assignedUser: this.usersSubject.value.find(u => u.id === payload.assignedUserId),
          dateStart: payload.dateStart,
          dateEnd: payload.dateEnd,
          halfDaysDuration: payload.halfDaysDuration,
          comments: payload.comments,
          isRisky: payload.isRisky ?? false,
          gitBranch: payload.gitBranch,
          baseDateEnd: payload.baseDateEnd !== undefined ? payload.baseDateEnd : oldTask?.baseDateEnd,
          workedHalfDays: payload.workedHalfDays || [],
          extensions: payload.extensions || [],
          history: payload.history || [],
          subTasks: payload.subTasks || []
        };
        this.upsertTaskInSubject(projectId, task);
        return of(task);
      })
    );
  }

  deleteTask(taskId: number): Observable<boolean> {
    return this.http.delete<{ success: boolean }>(`${this.apiUrl}/tasks/${taskId}`, { headers: this.headers }).pipe(
      map(() => true),
      tap(() => { this.removeTaskFromSubject(taskId); this.clearApiIssue(); }),
      catchError(() => {
        this.reportApiIssue('La suppression de la tâche n\'a pas pu être confirmée côté serveur.');
        this.removeTaskFromSubject(taskId);
        return of(true);
      })
    );
  }

  // ==========================================================================
  // INDISPONIBILITÉS DÉVELOPPEUR (congés/absences) — indépendantes de tout projet.
  // ==========================================================================

  getUnavailabilities(): Observable<UnavailabilityPeriod[]> {
    return this.http.get<unknown>(`${this.apiUrl}/unavailabilities`, { headers: this.headers }).pipe(
      map((response: any) => {
        const raw: any[] = Array.isArray(response) ? response : (response?.data || []);
        return raw.map((u: any) => ({
          id: Number(u.id),
          userId: Number(u.userId ?? u.user_id),
          dateStart: u.dateStart ?? u.date_debut,
          dateEnd: u.dateEnd ?? u.date_fin,
          reason: u.reason ?? u.raison ?? undefined
        }));
      }),
      tap(list => { this.unavailabilitiesSubject.next(list); this.clearApiIssue(); }),
      catchError(() => {
        this.reportApiIssue('Indisponibilités développeur indisponibles côté serveur — affichage des données précédentes.');
        return this.unavailabilities$;
      })
    );
  }

  createUnavailability(payload: CreateUnavailabilityPayload): Observable<UnavailabilityPeriod> {
    return this.http.post<UnavailabilityPeriod>(`${this.apiUrl}/unavailabilities`, payload, { headers: this.headers }).pipe(
      tap(created => {
        this.unavailabilitiesSubject.next([...this.unavailabilitiesSubject.value, created]);
        this.clearApiIssue();
      }),
      catchError(() => {
        this.reportApiIssue('La période d\'indisponibilité n\'a pas pu être enregistrée côté serveur — visible seulement localement.');
        const mock: UnavailabilityPeriod = { id: Date.now(), ...payload };
        this.unavailabilitiesSubject.next([...this.unavailabilitiesSubject.value, mock]);
        return of(mock);
      })
    );
  }

  deleteUnavailability(id: number): Observable<boolean> {
    const removeLocally = () => {
      this.unavailabilitiesSubject.next(this.unavailabilitiesSubject.value.filter(u => u.id !== id));
    };
    return this.http.delete<{ success: boolean }>(`${this.apiUrl}/unavailabilities/${id}`, { headers: this.headers }).pipe(
      map(() => true),
      tap(() => { removeLocally(); this.clearApiIssue(); }),
      catchError(() => {
        this.reportApiIssue('La suppression de la période d\'indisponibilité n\'a pas pu être confirmée côté serveur.');
        removeLocally();
        return of(true);
      })
    );
  }

  // ==========================================================================
  // MÉTIERS (Dev/Infra/Media...) — gérés depuis Admin > Métiers (portail-shell), consommés ici en
  // lecture seule pour le rattachement multi-métiers d'un projet (checkboxes, badges, filtre).
  // ==========================================================================

  getMetiers(): Observable<ProjectMetier[]> {
    return this.http.get<unknown>(this.metiersUrl, { headers: this.headers }).pipe(
      map((response: any) => {
        const raw: any[] = Array.isArray(response) ? response : (response?.data || []);
        return raw.map((m: any) => ({ id: Number(m.id ?? m.ID), nom: m.nom ?? m.NOM, color: m.color ?? m.COLOR ?? 'slate' }));
      }),
      tap(list => { this.metiersSubject.next(list); this.clearApiIssue(); }),
      catchError(() => {
        this.reportApiIssue('Métiers indisponibles côté serveur — affichage des données précédentes.');
        return this.metiers$;
      })
    );
  }

  /** Insère ou remplace une tâche dans le projet ciblé du cache local, et recalcule l'avancement. */
  private upsertTaskInSubject(projectId: number, task: ProjectTask): void {
    const current = this.projectsSubject.value;
    const updated = current.map(p => {
      if (p.id !== projectId) return p;
      const idx = p.tasks.findIndex(t => t.id === task.id);
      const tasks = idx === -1 ? [...p.tasks, task] : p.tasks.map(t => t.id === task.id ? task : t);
      return { ...p, tasks };
    });
    this.projectsSubject.next(calculateProjectsProgress(updated));
  }

  private removeTaskFromSubject(taskId: number): void {
    const current = this.projectsSubject.value;
    const updated = current.map(p => ({ ...p, tasks: p.tasks.filter(t => t.id !== taskId) }));
    this.projectsSubject.next(calculateProjectsProgress(updated));
  }

}