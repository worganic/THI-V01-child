import { Component, Input, Output, OnChanges, OnInit, SimpleChanges, EventEmitter, inject, signal, ChangeDetectorRef } from '@angular/core'; 
import { CommonModule } from '@angular/common'; 
import { FormsModule } from '@angular/forms'; 
import { RecipeService } from '../../services/recipe.service'; 
import { RecipeBook, RecipeSection, RecipeTest, TestSession, TestCampaign, TestEnvironment, RecipeUser, TestResponse, TestStatus } from '../../models/recipe.model'; 
import { firstValueFrom } from 'rxjs'; 
import { AuthService } from '@worganic/portail-core/data-access'; 
import { CaptureModalComponent } from './capture-modal/capture-modal.component'; 

export interface ExecutableTestContext {   
  categoryName: string;   
  applicatifName: string;   
  sectionName: string;   
  test: RecipeTest; 
}

@Component({   
  selector: 'app-execution',   
  standalone: true,   
  imports: [CommonModule, FormsModule, CaptureModalComponent],   
  templateUrl: './execution.component.html',   
  styleUrls: ['./execution.component.scss'] 
})
export class ExecutionComponent implements OnChanges, OnInit {   
  private recipeService = inject(RecipeService);   
  private cdr = inject(ChangeDetectorRef);   
  private authService = inject(AuthService);   
  
  @Input() currentBook!: RecipeBook;   
  @Output() sessionFinished = new EventEmitter<void>();   
  
  executionPhase: 'idle' | 'setup' | 'running' | 'campaign-list' | 'campaign-create' | 'campaign-detail' = 'idle';   
  @Input() initialTarget: string = 'ALL';   
  @Input() initialCampaignId: string | null = null;
  hasPausedSession = false;   
  pausedInfo: { index: number; total: number; isGroup?: boolean; campaignName?: string | null; sessionTitle?: string | null; testerName?: string | null } = { index: 0, total: 0, isGroup: false, campaignName: null, sessionTitle: null, testerName: null };   
  runSetup = { testerName: '', sessionTitle: '', target: 'ALL' };   
  runTests: ExecutableTestContext[] = [];   
  currentTestIndex: number = 0;   
  showCaptureModal = false;   
  captureTarget: { kind: 'task' | 'test'; id: string } | null = null;   
  currentSession!: TestSession;   
  campaigns: TestCampaign[] = [];   
  activeCampaign: TestCampaign | null = null;   
  campaignSessions: TestSession[] = [];   
  expandedSessions: { [id: string]: boolean } = {};   
  sessionQuestionsMap: { [sessionId: string]: { test: RecipeTest, response: TestResponse, categoryName: string, applicatifName: string, sectionName: string }[] } = {};   
  takenTestIds: Set<string> = new Set();   
  users = signal<RecipeUser[]>([]);   
  execType: 'session' | 'campaign' = 'session';   
  notification: { message: string, type: 'success' | 'info' | 'danger' | 'warning' } | null = null;   
  formError: string | null = null;   
  
  // Cache d'isolation architectural contre le lag de transaction / réplication du pool DB de recette   
  private recentlyRestartedSessions = new Set<string>();   
  
  sessionForm = {     
    title: '',     
    testerName: '',     
    mode: 'Manuel' as 'Manuel' | 'Automatique',     
    environment: 'VAL' as TestEnvironment   
  };   
  
  campaignForm = {     
    name: '',     
    createdBy: 'Johann LOREAU',     
    environment: 'VAL' as TestEnvironment   
  };   

  ngOnInit(): void {     
    this.loadUsers();   
  }

  ngOnChanges(changes: SimpleChanges): void {     
    if ((changes['initialTarget'] || changes['initialCampaignId']) && this.initialTarget) {       
      this.runSetup.target = this.initialTarget;       
      if (this.initialTarget !== 'ALL' && this.executionPhase === 'idle') {         
        const forCampaign = !!this.initialCampaignId;
        if (forCampaign) {
          this.recipeService.getCampaigns().subscribe(camps => {
            const camp = camps.find(c => String(c.id) === String(this.initialCampaignId));
            if (camp) {
              this.activeCampaign = camp;
              this.recipeService.getSessions().subscribe(allSessions => {
                this.campaignSessions = allSessions.filter(s => s.campaignId === camp.id);
                this.calculateTakenTests();
                this.openRunSetup(true, this.initialTarget);
              });
            } else {
              this.openRunSetup(true, this.initialTarget);
            }
          });
        } else {
          this.openRunSetup(false, this.initialTarget);
        }
      }     
    }     
    if (changes['currentBook'] && this.currentBook) {       
      this.ensureBookHydrated().then(() => {         
        this.loadPausedSession();         
        this.loadCampaigns();         
        this.cdr.detectChanges();       
      });     
    }   
  }

  private async ensureBookHydrated(): Promise<void> {     
    if (!this.currentBook) return;     
    try {       
      if (!this.currentBook.categories || this.currentBook.categories.length === 0) {         
        const categories = await firstValueFrom(this.recipeService.getCategories(this.currentBook.id));         
        this.currentBook.categories = categories || [];       
      }              
      const sectionsToHydrate: RecipeSection[] = [];       
      for (const cat of this.currentBook.categories) {         
        if (!cat.applicatifs || cat.applicatifs.length === 0) {           
          const apps = await firstValueFrom(this.recipeService.getApplicatifs(cat.id));           
          cat.applicatifs = apps || [];         
        }         
        for (const app of cat.applicatifs) {           
          if (!app.sections || app.sections.length === 0) {             
            const sections = await firstValueFrom(this.recipeService.getSections(app.id));             
            app.sections = sections || [];           
          }           
          for (const se of app.sections) {             
            if (!se.tests || se.tests.length === 0) {               
              sectionsToHydrate.push(se);             
            }           
          }         
        }       
      }       
      if (sectionsToHydrate.length > 0) {         
        const hydrationPromises = sectionsToHydrate.map(async sec => {           
          try {             
            const tests = await firstValueFrom(this.recipeService.getTests(sec.id));             
            sec.tests = tests || [];           
          } catch (e) {             
            console.error(`[Airbus QA] Erreur d'hydratation de la section ${sec.id}`, e);           
          }         
        });         
        await Promise.all(hydrationPromises);       
      }     
    } catch (e) {       
      console.error("[Airbus QA] Échec de la cascade d'hydratation:", e);     
    }   
  }

  private findTestById(testId: string): RecipeTest | undefined {     
    if (!this.currentBook || !this.currentBook.categories) return undefined;     
    for (const cat of this.currentBook.categories) {       
      if (cat.applicatifs) {         
        for (const app of cat.applicatifs) {           
          if (app.sections) {             
            for (const sec of app.sections) {               
              if (sec.tests) {                 
                const t = sec.tests.find(x => String(x.id) === String(testId));                 
                if (t) return t;               
              }             
            }           
          }         
        }       
      }     
    }     
    return undefined;   
  }

  clearFormError(): void {     
    this.formError = null;     
    this.cdr.detectChanges();   
  }

  showNotification(message: string, type: 'success' | 'info' | 'danger' | 'warning') {     
    this.notification = { message, type };     
    this.cdr.detectChanges();     
    setTimeout(() => {       
      this.notification = null;       
      this.cdr.detectChanges();     
    }, 4000);   
  }

  loadUsers() {     
    this.recipeService.getUsers().subscribe({       
      next: (registeredUsers: RecipeUser[]) => {         
        this.users.set(registeredUsers);         
        if (registeredUsers.length > 0 && !this.sessionForm.testerName) {           
          const firstUser = registeredUsers[0];           
          this.sessionForm.testerName = `${firstUser.nom} ${firstUser.prenom} (${firstUser.matricule})`;         
        }         
        this.cdr.detectChanges();       
      },       
      error: (err) => console.error("Erreur de récupération des utilisateurs enregistrés :", err)     
    });   
  }

  loadPausedSession() {     
    if (!this.currentBook) return;     
    const stored = window.localStorage.getItem('v3_paused_run_' + this.currentBook.id);     
    if (stored) {       
      const state = JSON.parse(stored);       
      this.hasPausedSession = true;       
      const sess = state.currentSession;
      this.pausedInfo = {
        index: state.currentTestIndex || 0,
        total: state.runTests?.length || 0,
        isGroup: !!state.activeCampaign,
        campaignName: state.activeCampaign?.name || null,
        sessionTitle: sess ? this.getCleanTitle(sess.title) : null,
        testerName: sess ? sess.testerName : null
      };     
    } else {       
      this.hasPausedSession = false;     
    }   
  }

  loadCampaigns() {     
    if (!this.currentBook) return;     
    this.recipeService.getCampaigns().subscribe(camps => {       
      this.campaigns = camps.filter(c => c.recipeBookId === this.currentBook.id)         
        .sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime());       
      this.cdr.detectChanges();     
    });   
  }

  openCampaignList() {     
    this.loadCampaigns();     
    this.executionPhase = 'campaign-list';     
    this.cdr.detectChanges();   
  }

  openCampaignCreate() {     
    this.campaignForm = {       
      name: '',       
      createdBy: this.authService.currentUser()?.username || 'Utilisateur',       
      environment: 'VAL' as TestEnvironment     
    };     
    this.executionPhase = 'campaign-create';     
    this.cdr.detectChanges();   
  }

  cancelExecution() {     
    if (this.activeCampaign) {       
      this.executionPhase = 'campaign-detail';     
    } else {       
      this.executionPhase = 'idle';     
    }     
    this.formError = null;     
    this.cdr.detectChanges();   
  }

  async launchSession() {     
    this.formError = null;     
    this.runSetup.testerName = this.sessionForm.testerName;     
    this.runSetup.sessionTitle = this.sessionForm.title;     
    await this.startRun();   
  }

  saveCampaign() {     
    if (!this.campaignForm.name || !this.campaignForm.name.trim()) return;     
    if (!this.currentBook || !this.currentBook.id) return;          
    const newCamp: TestCampaign = {       
      id: Date.now().toString(),       
      recipeBookId: this.currentBook.id,       
      name: this.campaignForm.name.trim(),       
      createdBy: this.campaignForm.createdBy || 'Johann LOREAU',       
      dateCreated: new Date().toISOString(),       
      status: 'IN_PROGRESS',       
      environment: this.campaignForm.environment     
    };          
    this.recipeService.saveCampaign(newCamp).subscribe({       
      next: () => {         
        this.showNotification(`La campagne "${newCamp.name}" a été créée avec succès.`, 'success');         
        this.openCampaignDetail(newCamp);       
      },       
      error: (err) => {         
        console.error('Erreur lors de la sauvegarde de la campagne :', err);         
        this.formError = "Le serveur n'a pas pu enregistrer la nouvelle campagne.";         
        this.cdr.detectChanges();       
      }     
    });   
  }

  deleteCampaign(id: string, event: Event) {     
    event.stopPropagation();     
    if (confirm('Voulez-vous supprimer cette campagne et TOUS les résultats de tests qui y sont rattachés ?')) {       
      this.recipeService.deleteCampaign(id).subscribe(() => {         
        this.showNotification("Campagne supprimée définitivement.", 'danger');         
        this.loadCampaigns();       
      });     
    }   
  }

  deleteCampaignSession(id: string) {     
    if (confirm('Retirer cette session de la campagne et effacer ses résultats ?')) {       
      this.recipeService.deleteSession(id).subscribe(() => {         
        this.showNotification("Session retirée du collectif.", 'danger');         
        if (this.activeCampaign) this.openCampaignDetail(this.activeCampaign);       
      });     
    }   
  }

  isPausedSession(sess: TestSession): boolean {
    if (!this.currentBook || !sess) return false;
    const stored = window.localStorage.getItem('v3_paused_run_' + this.currentBook.id);
    if (stored) {
      try {
        const state = JSON.parse(stored);
        if (state.currentSession && (state.currentSession.id === sess.id || state.currentSession.title === sess.title)) {
          return true;
        }
      } catch (e) {}
    }
    return false;
  }

  canRestartSession(sess: TestSession): boolean {     
    if (!sess || sess.status === 'PENDING') return false;     
    if (this.isPausedSession(sess)) return false;
    return sess.status === 'GO' || sess.status === 'NO-GO';
  }

  // FIX ARCHITECTURAL : Utilisation des méthodes standards `updateTestResponse` et `updateTaskResponse` existantes dans le service
  async restartSession(sess: TestSession) {     
    if (!confirm(`Relancer "${this.getCleanTitle(sess.title)}" ? Toutes les réponses de cette session seront effacées.`)) return;     
    try {       
      console.log("[Airbus QA UI Log] Déclenchement de restartSession pour l'ID :", sess.id);       
      this.recentlyRestartedSessions.add(sess.id);              
      sess.status = 'PENDING';       
      const cleanSessionId = sess.id.replace('sess-', '');
      const updatePromises: Promise<any>[] = [];

      if (sess.responses) {         
        Object.keys(sess.responses).forEach(testId => {           
          sess.responses[testId].status = 'PENDING';           
          sess.responses[testId].notes = '';  
          console.log("[Airbus QA UI Log] cleanSessionId :", cleanSessionId);           
          console.log("[Airbus QA UI Log] testId :", testId);   
          updatePromises.push(
            firstValueFrom(this.recipeService.updateTestResponse({
              session_id: cleanSessionId,
              test_id: testId,
              status: 'PENDING',
              notes: '',
              date_responded: new Date().toISOString().slice(0, 19).replace('T', ' '),
              capture_path: ''
            }))
          );
        });       
      }       
      
      if (sess.taskResponses) {         
        Object.keys(sess.taskResponses).forEach(taskId => {           
          sess.taskResponses[taskId].status = 'PENDING';           
          sess.taskResponses[taskId].notes = '';           
          
          updatePromises.push(
            firstValueFrom(this.recipeService.updateTaskResponse({
              session_id: cleanSessionId,
              task_id: taskId,
              status: 'PENDING',
              notes: '',
              capture_path: ''
            }))
          );
        });       
      }       
      
      // CONSERVATION STRUCTURELLE DU CACHE VISUEL : Réinitialisation à PENDING pour garder les lignes actives à l'écran       
      if (this.sessionQuestionsMap[sess.id]) {         
        console.log("[Airbus QA UI Log] Remise à zéro locale du tableau expansé de la session :", sess.id);         
        this.sessionQuestionsMap[sess.id].forEach(q => {           
          q.response.status = 'PENDING';           
          q.response.notes = '';         
        });       
      }       
      this.cdr.detectChanges();       
      console.log("[Airbus QA UI Log] Envoi de l'ordre d'effacement vers RecipeService...");       
      
      // Exécution de toutes les requêtes unifiées
      await Promise.all(updatePromises);
              
      console.log("[Airbus QA UI Log] Temporisation de commit pour la réplication de base de données...");       
      await new Promise(resolve => setTimeout(resolve, 1500));              
      this.showNotification(`Session "${this.getCleanTitle(sess.title)}" relancée.`, 'warning');     
    } catch (e) {       
      console.error('[Airbus QA UI Log] Échec de la fonction restartSession :', e);       
      this.recentlyRestartedSessions.delete(sess.id);     
    }     
    if (this.activeCampaign) {       
      console.log("[Airbus QA UI Log] Rafraîchissement automatique de la campagne courante.");       
      this.openCampaignDetail(this.activeCampaign);     
    }   
  }

  async openCampaignDetail(camp: TestCampaign) {     
    console.log("[Airbus QA UI Log] Chargement du détail de campagne :", camp.id);     
    this.activeCampaign = camp;     
    this.formError = null;     
    this.recipeService.getSessions().subscribe(async sessions => {       
      const filteredSessions = sessions.filter(s => s.campaignId === camp.id);       
      console.log(`[Airbus QA UI Log] ${filteredSessions.length} sessions lues depuis le serveur.`);              
      await this.ensureBookHydrated();       
      filteredSessions.forEach(sess => {         
        // BLOCAGE ANTI-LAG : Écrase les payloads périmés si la transaction d'effacement asynchrone est en cours         
        if (this.recentlyRestartedSessions.has(sess.id)) {           
          const isServerSynced = Object.keys(sess.responses || {}).every(k => sess.responses[k]?.status === 'PENDING');           
          console.log(`[Airbus QA UI Log] Vérification synchro serveur pour ${sess.id} :`, isServerSynced);           
          if (isServerSynced) {             
            console.log("[Airbus QA UI Log] Le serveur est aligné. Libération du verrou pour :", sess.id);             
            this.recentlyRestartedSessions.delete(sess.id);           
          } else {             
            console.log("[Airbus QA UI Log] Force le maintien visuel PENDING pour surmonter le lag réseau.");             
            sess.status = 'PENDING';             
            if (sess.responses) {               
              Object.keys(sess.responses).forEach(k => {                 
                sess.responses[k].status = 'PENDING';                 
                sess.responses[k].notes = '';               
              });             
            }             
            if (sess.taskResponses) {               
              Object.keys(sess.taskResponses).forEach(k => {                 
                sess.taskResponses[k].status = 'PENDING';                 
                sess.taskResponses[k].notes = '';               
              });             
            }           
          }         
        }         
        // MOTEUR DE CONSOLIDATION TEMPS RÉEL         
        if (!this.recentlyRestartedSessions.has(sess.id) && sess.responses) {           
          Object.keys(sess.responses).forEach(testId => {             
            const test = this.findTestById(testId);             
            if (test && test.tasks && test.tasks.length > 0) {               
              let totalTasks = test.tasks.length;               
              let answeredTasks = 0;               
              let hasTaskKo = false;               
              let hasTaskOk = false;               
              test.tasks.forEach(tsk => {                 
                const tResp = sess.taskResponses ? sess.taskResponses[String(tsk.id)] : undefined;                 
                if (tResp && tResp.status && tResp.status !== 'PENDING') {                   
                  answeredTasks++;                   
                  if (tResp.status === 'FAILED') hasTaskKo = true;                   
                  if (tResp.status === 'PASSED') hasTaskOk = true;                 
                }               
              });               
              if (hasTaskKo) {                 
                sess.responses[testId].status = 'FAILED';               
              } else if (answeredTasks === totalTasks && totalTasks > 0) {                 
                sess.responses[testId].status = hasTaskOk ? 'PASSED' : 'SKIPPED';               
              } else {                 
                sess.responses[testId].status = 'PENDING';               
              }             
            }           
          });           
          // Recalcul strict et dynamique à la volée de la décision de session collective (GO / NO-GO)           
          const keys = Object.keys(sess.responses);           
          if (keys.length > 0) {             
            const allAnswered = keys.every(k => sess.responses[k]?.status !== 'PENDING');             
            let hasBloquantFailed = false;             
            keys.forEach(k => {               
              if (sess.responses[k]?.status === 'FAILED') {                 
                const test = this.findTestById(k);                 
                if (test && test.criticality === 'Bloquant') {                   
                  hasBloquantFailed = true;                 
                }               
              }             
            });             
            if (hasBloquantFailed) {               
              sess.status = 'NO-GO';             
            } else if (allAnswered) {               
              sess.status = 'GO';             
            } else {               
              sess.status = 'PENDING';             
            }           
          }         
        }         
        // CORRECTIF DE PERSISTENCE DES LIGNES : Ré-hydratation du cacheQuestions si la ligne était dépliée         
        if (this.expandedSessions[sess.id] && (!this.sessionQuestionsMap[sess.id] || this.sessionQuestionsMap[sess.id].length === 0)) {           
          console.log("[Airbus QA UI Log] Ré-alimentation dynamique de sessionQuestionsMap pour la session ouverte :", sess.id);           
          this.sessionQuestionsMap[sess.id] = this.getSessionQuestions(sess);         
        }       
      });       
      this.campaignSessions = filteredSessions;       
      this.calculateTakenTests();       
      this.executionPhase = 'campaign-detail';       
      this.cdr.detectChanges();     
    });   
  }

  calculateTakenTests() {     
    this.takenTestIds = new Set();     
    this.campaignSessions.forEach(s => {       
      if (s.responses) {         
        Object.keys(s.responses).forEach(testId => this.takenTestIds.add(testId));       
      }     
    });   
  }

  getCampaignProgress() {     
    let total = 0;     
    let answered = 0;     
    this.campaignSessions.forEach(s => {       
      if (!s.responses) return;       
      const keys = Object.keys(s.responses);       
      total += keys.length;       
      answered += keys.filter(k => s.responses[k]?.status !== 'PENDING').length;     
    });     
    return { total, answered, percentage: total > 0 ? (answered / total) * 100 : 0 };   
  }

  getTestCount(type: string, id: string): number {     
    if (!this.currentBook) return 0;     
    if (type === 'ALL') {       
      return this.currentBook.categories?.reduce((acc, cat) =>           
        acc + (cat.applicatifs?.reduce((accApp, app) =>             
          accApp + (app.sections?.reduce((accSec, sec) => accSec + (sec.tests?.length || 0), 0) || 0), 0) || 0), 0) || 0;     
    }     
    if (type === 'CAT' && id) {       
      const cat = this.currentBook.categories?.find(c => c.id === id);       
      return cat?.applicatifs?.reduce((accApp, app) =>           
        accApp + (app.sections?.reduce((accSec, sec) => accSec + (sec.tests?.length || 0), 0) || 0), 0) || 0;     
    }     
    if (type === 'APP' && id) {       
      const app = this.currentBook.categories?.flatMap(c => c.applicatifs || []).find(a => a.id === id);       
      return app?.sections?.reduce((accSec, sec) => accSec + (sec.tests?.length || 0), 0) || 0;     
    }     
    if (type === 'SEC' && id) {       
      const sec = this.currentBook.categories?.flatMap(c => c.applicatifs?.flatMap(a => a.sections || []) || []).find(s => s.id === id);       
      return sec?.tests?.length || 0;     
    }     
    return 0;   
  }

  getOptionColor(type: 'ALL' | 'CAT' | 'APP' | 'SEC', id: string): string {     
    if (this.isScopeDisabled(type, id)) return '#555555';     
    if (this.hasTakenTests(type, id)) return '#ff4d4d';      
    if (this.getTestCount(type, id) === 0) return '#e1e000';      
    return '#ffffff';   
  }

  hasTakenTests(type: string, id: string): boolean {     
    if (!this.activeCampaign) return false;     
    let testIds: string[] = [];     
    if (type === 'ALL') {       
      testIds = this.currentBook.categories.flatMap(c => c.applicatifs?.flatMap(a => a.sections?.flatMap(s => s.tests?.map(t => t.id) || []) || []) || []);     
    } else if (type === 'CAT') {       
      const cat = this.currentBook.categories.find(c => c.id === id);       
      testIds = cat?.applicatifs?.flatMap(a => a.sections?.flatMap(s => s.tests?.map(t => t.id) || []) || []) || [];     
    } else if (type === 'APP') {       
      const app = this.currentBook.categories.flatMap(c => c.applicatifs || []).find(a => a.id === id);       
      testIds = app?.sections?.flatMap(s => s.tests?.map(t => t.id) || []) || [];     
    } else if (type === 'SEC') {       
      const sec = this.currentBook.categories.flatMap(c => c.applicatifs?.flatMap(a => a.sections || []) || []).find(s => s.id === id);       
      testIds = sec?.tests?.map(t => t.id) || [];     
    }     
    return testIds.length > 0 && testIds.some(tId => this.takenTestIds.has(tId));   
  }

  getCollisionInfo(type: string, id: string): string {     
    if (!this.activeCampaign) return '(Désaffecté)';     
    let testIds: string[] = [];     
    if (type === 'ALL') {       
      testIds = this.currentBook.categories.flatMap(c => c.applicatifs?.flatMap(a => a.sections?.flatMap(s => s.tests?.map(t => t.id) || []) || []) || []);     
    } else if (type === 'CAT') {       
      const cat = this.currentBook.categories.find(c => c.id === id);       
      testIds = cat?.applicatifs?.flatMap(a => a.sections?.flatMap(s => s.tests?.map(t => t.id) || []) || []) || [];     
    } else if (type === 'APP') {       
      const app = this.currentBook.categories.flatMap(c => c.applicatifs || []).find(a => a.id === id);       
      testIds = app?.sections?.flatMap(s => s.tests?.map(t => t.id) || []) || [];     
    } else if (type === 'SEC') {       
      const sec = this.currentBook.categories.flatMap(c => c.applicatifs?.flatMap(a => a.sections || []) || []).find(s => s.id === id);       
      testIds = sec?.tests?.map(t => t.id) || [];     
    }          
    const linkedSessions = new Set<string>();     
    testIds.forEach(tId => {       
      if (this.takenTestIds.has(tId)) {         
        const found = this.campaignSessions.find(s => s.responses && s.responses[tId]);         
        if (found) linkedSessions.add(this.getCleanTitle(found.title || found.testerName));       
      }     
    });     
    if (linkedSessions.size > 0) {       
      return "(Affectée dans : " + Array.from(linkedSessions).join(', ') + ")";     
    }     
    return '(Contient des fiches occupées)';   
  }

  isScopeDisabled(type: string, id: string): boolean {     
    if (this.getTestCount(type, id) === 0) return true;     
    if (!this.activeCampaign) return false;     
    let testIds: string[] = [];     
    if (type === 'ALL') {       
      testIds = this.currentBook.categories.flatMap(c => c.applicatifs?.flatMap(a => a.sections?.flatMap(s => s.tests?.map(t => t.id) || []) || []) || []);     
    } else if (type === 'CAT') {       
      const cat = this.currentBook.categories.find(c => c.id === id);       
      testIds = cat?.applicatifs?.flatMap(a => a.sections?.flatMap(s => s.tests?.map(t => t.id) || []) || []) || [];     
    } else if (type === 'APP') {       
      const app = this.currentBook.categories.flatMap(c => c.applicatifs || []).find(a => a.id === id);       
      testIds = app?.sections?.flatMap(s => s.tests?.map(t => t.id) || []) || [];     
    } else if (type === 'SEC') {       
      const sec = this.currentBook.categories.flatMap(c => c.applicatifs?.flatMap(a => a.sections || []) || []).find(s => s.id === id);       
      testIds = sec?.tests?.map(t => t.id) || [];     
    }     
    return testIds.length > 0 && testIds.some(tId => this.takenTestIds.has(tId));   
  }

  async openRunSetup(forCampaign = false, target?: string) {     
    if (this.hasPausedSession && !forCampaign && !confirm("Lancer un nouveau test écrasera la session en pause. Continuer ?")) return;     
    this.formError = null;          
    await this.ensureBookHydrated();     

    const activeTarget = target || (this.initialTarget && this.initialTarget !== 'ALL' ? this.initialTarget : 'ALL');

    if (forCampaign && this.activeCampaign) {       
      this.sessionForm.title = "Session - " + this.activeCampaign.name + " " + (this.campaignSessions.length + 1);       
      this.sessionForm.environment = this.activeCampaign.environment;       
      this.runSetup.target = activeTarget;     
    } else {       
      this.activeCampaign = null;       
      this.sessionForm.title = '';     
      this.runSetup.target = activeTarget;
    }     
    this.executionPhase = 'setup';     
    this.cdr.detectChanges();   
  }

  async startRun() {     
    if (!this.sessionForm.title.trim()) {       
      this.formError = "Le titre de la session de test est obligatoire.";       
      this.cdr.detectChanges();       
      return;     
    }          
    this.runTests = [];     
    const sel = this.runSetup.target;          
    await this.ensureBookHydrated();     
    this.currentBook.categories.forEach(cat => {       
      if (sel === 'ALL' || sel === 'CAT:' + cat.id) {         
        cat.applicatifs?.forEach(ap => ap.sections?.forEach(se => se.tests?.forEach(t => this.runTests.push({ categoryName: cat.name, applicatifName: ap.name, sectionName: se.name, test: t }))));       
      } else {         
        cat.applicatifs?.forEach(ap => {           
          if (sel === 'APP:' + ap.id) {             
            ap.sections?.forEach(se => se.tests?.forEach(t => this.runTests.push({ categoryName: cat.name, applicatifName: ap.name, sectionName: se.name, test: t })));           
          } else {             
            ap.sections?.forEach(se => {               
              if (sel === 'SEC:' + se.id) {                 
                se.tests?.forEach(t => this.runTests.push({ categoryName: cat.name, applicatifName: ap.name, sectionName: se.name, test: t }));               
              } else {                 
                const foundTest = se.tests?.find(t => 'TEST:' + t.id === sel);                 
                if (foundTest) this.runTests.push({ categoryName: cat.name, applicatifName: ap.name, sectionName: se.name, test: foundTest });               
              }             
            });           
          }         
        });       
      }     
    });          
    
    if (this.activeCampaign) {       
      const takenOverlap = this.runTests.filter(rt => this.takenTestIds.has(rt.test.id));       
      if (takenOverlap.length > 0) {         
        this.formError = "Impossible de créer la session : le périmètre sélectionné contient " + takenOverlap.length + " fiche(s) de test déjà affectée(s) à une autre session de cette campagne.";         
        this.cdr.detectChanges();         
        return;       
      }     
    }     
    if (this.runTests.length === 0) {       
      this.formError = "Aucun test disponible ou trouvé pour ce périmètre applicatif.";       
      this.cdr.detectChanges();       
      return;     
    }          
    const taskPromises = this.runTests       
      .filter(rt => !rt.test.tasks || rt.test.tasks.length === 0)       
      .map(async rt => {         
        try {           
          const tasks = await firstValueFrom(this.recipeService.getTasks(rt.test.id));           
          rt.test.tasks = tasks || [];         
        } catch (e) {           
          console.error("Impossible de charger les tâches du test " + rt.test.id, e);         
        }       
      });     
    if (taskPromises.length > 0) {       
      await Promise.all(taskPromises);     
    }          
    
    let targetLabel = this.runSetup.target;     
    if (this.runSetup.target === 'ALL') {       
      targetLabel = 'Tout le cahier';     
    } else if (this.runSetup.target.startsWith('CAT:')) {       
      const catId = this.runSetup.target.replace('CAT:', '');       
      const cat = this.currentBook.categories.find(c => c.id === catId);       
      targetLabel = cat ? "Catégorie: " + cat.name : this.runSetup.target;     
    } else if (this.runSetup.target.startsWith('APP:')) {       
      const appId = this.runSetup.target.replace('APP:', '');       
      const app = this.currentBook.categories.flatMap(c => c.applicatifs || []).find(a => a.id === appId);       
      targetLabel = app ? "Application: " + app.name : this.runSetup.target;     
    } else if (this.runSetup.target.startsWith('SEC:')) {       
      const secId = this.runSetup.target.replace('SEC:', '');       
      const sec = this.currentBook.categories.flatMap(c => c.applicatifs?.flatMap(a => a.sections || []) || []).find(s => s.id === secId);       
      targetLabel = sec ? "Section: " + sec.name : this.runSetup.target;     
    }          
    
    this.currentSession = {       
      id: 'sess-' + Date.now(),       
      recipeBookId: this.currentBook.id,       
      campaignId: this.activeCampaign?.id || undefined,       
      testerName: this.runSetup.testerName,       
      title: this.runSetup.sessionTitle.trim() + " [Périmètre: " + targetLabel + "]",       
      mode: this.sessionForm.mode,       
      dateExecuted: new Date().toISOString(),       
      responses: {},       
      taskResponses: {},       
      status: 'PENDING',       
      environment: this.sessionForm.environment     
    };          
    
    this.runTests.forEach(rt => {       
      this.currentSession.responses[rt.test.id] = { status: 'PENDING', notes: '' };       
      if (rt.test.tasks) rt.test.tasks.forEach(tsk => this.currentSession.taskResponses[tsk.id] = { status: 'PENDING', notes: '' });     
    });     
    this.currentTestIndex = 0;          
    
    if (this.activeCampaign) {       
      this.recipeService.saveCompleteSession(this.currentSession).subscribe({         
        next: () => {           
          this.showNotification("La sous-session pour " + this.runSetup.testerName + " a été créée et enregistrée.", 'success');           
          if (this.activeCampaign) this.openCampaignDetail(this.activeCampaign);         
        },         
        error: (err) => {           
          console.error("Échec d'enregistrement de la sous-session:", err);           
          this.formError = "Erreur réseau lors de la création de la session de campagne.";           
          this.cdr.detectChanges();         
        }       
      });       
      return;     
    }     
    this.executionPhase = 'running';     
    this.showNotification("Session démarrée avec succès.", 'success');     
    this.cdr.detectChanges();   
  }

  async playPreparedSession(sess: TestSession) {     
    if (this.isPausedSession(sess)) {
      this.resumeSession();
      return;
    }
    this.currentSession = sess;     
    this.runTests = [];     
    if (!this.currentSession.taskResponses) this.currentSession.taskResponses = {};          
    await this.ensureBookHydrated();     
    const responseKeys = Object.keys(sess.responses || {});          
    this.currentBook.categories.forEach(cat => {       
      cat.applicatifs?.forEach(ap => {         
        ap.sections?.forEach(se => {           
          se.tests?.forEach(t => {             
            const isMatch = responseKeys.some(k => String(k) === String(t.id));             
            if (isMatch) {               
              this.runTests.push({ categoryName: cat.name, applicatifName: ap.name, sectionName: se.name, test: t });             
            }           
          });         
        });       
      });     
    });          
    
    const taskPromises = this.runTests       
      .filter(rt => !rt.test.tasks || rt.test.tasks.length === 0)       
      .map(async rt => {         
        try {           
          const tasks = await firstValueFrom(this.recipeService.getTasks(rt.test.id));           
          rt.test.tasks = tasks || [];         
        } catch (e) {           
          console.error("Impossible de charger les tâches du test " + rt.test.id, e);         
        }       
      });     
    if (taskPromises.length > 0) await Promise.all(taskPromises);          
    
    let firstPendingIndex = this.runTests.findIndex(rt => {
      if (rt.test.tasks && rt.test.tasks.length > 0) {
        return rt.test.tasks.some(tsk => {
          const safeTaskId = String(tsk.id);
          const tSt = sess.taskResponses?.[safeTaskId]?.status?.toUpperCase() || sess.taskResponses?.[tsk.id]?.status?.toUpperCase();
          return !tSt || tSt === 'PENDING';
        });
      }
      const matchKey = responseKeys.find(k => String(k) === String(rt.test.id));
      const st = matchKey ? sess.responses[matchKey]?.status?.toUpperCase() : undefined;
      return !st || st === 'PENDING';
    });
    this.currentTestIndex = firstPendingIndex !== -1 ? firstPendingIndex : 0;
    this.executionPhase = 'running';
    this.showNotification("Reprise de la session au premier test non terminé : " + this.getCleanTitle(sess.title), 'success');
    this.cdr.detectChanges();   
  }

  getCleanTitle(title: string | undefined): string {     
    if (!title) return '';     
    return title.includes(' [Périmètre:') ? title.split(' [Périmètre:')[0].trim() : title;   
  }

  getPerimeterLabel(sess: TestSession): string {     
    if (!sess.responses) return 'Non défini';     
    const count = Object.keys(sess.responses).length;     
    if (sess.title && sess.title.includes(' [Périmètre:')) {       
      const parts = sess.title.split(' [Périmètre:');       
      return parts[1] ? parts[1].replace(']', '').trim() : count + " fiches";     
    }     
    return count + " fiches";   
  }

  getSessionProgress(sess: TestSession): string {     
    if (!sess.responses) return '0 / 0';     
    const keys = Object.keys(sess.responses);     
    const total = keys.length;     
    const completed = keys.filter(k => sess.responses[k]?.status !== 'PENDING').length;     
    return completed + " / " + total;   
  }

  async toggleSessionExpansion(sess: TestSession) {     
    const isExpanding = !this.expandedSessions[sess.id];     
    this.expandedSessions[sess.id] = isExpanding;     
    if (!isExpanding) return;          
    await this.ensureBookHydrated();     
    const questions = this.getSessionQuestions(sess);     
    this.sessionQuestionsMap[sess.id] = questions;          
    const toHydrate = questions.filter(q => !q.test.tasks || q.test.tasks.length === 0);     
    if (toHydrate.length === 0) {       
      this.cdr.detectChanges();       
      return;     
    }          
    await Promise.all(toHydrate.map(async q => {       
      try {         
        q.test.tasks = await firstValueFrom(this.recipeService.getTasks(q.test.id)) || [];       
      } catch (e) {         
        console.error("Impossible de charger les tâches du test " + q.test.id, e);       
      }     
    }));     
    this.cdr.detectChanges();   
  }

  getSessionQuestions(sess: TestSession): { test: RecipeTest, response: TestResponse, categoryName: string, applicatifName: string, sectionName: string }[] {     
    if (!sess.responses || !this.currentBook?.categories) return [];     
    const responseKeys = Object.keys(sess.responses);     
    const results: { test: RecipeTest, response: TestResponse, categoryName: string, applicatifName: string, sectionName: string }[] = [];     
    this.currentBook.categories.forEach(cat => {       
      cat.applicatifs?.forEach(app => {         
        app.sections?.forEach(sec => {           
          sec.tests?.forEach(test => {             
            const matchKey = responseKeys.find(k => String(k) === String(test.id));             
            if (matchKey) {               
              results.push({ test, response: sess.responses[matchKey], categoryName: cat.name, applicatifName: app.name, sectionName: sec.name });             
            }           
          });         
        });       
      });     
    });     
    return results;   
  }

  pauseSession() {     
    const state = { runSetup: this.runSetup, currentTestIndex: this.currentTestIndex, currentSession: this.currentSession, runTests: this.runTests, activeCampaign: this.activeCampaign };     
    window.localStorage.setItem('v3_paused_run_' + this.currentBook.id, JSON.stringify(state));     
    this.showNotification("Session suspendue et enregistrée localement.", 'warning');     
    if (this.activeCampaign) {       
      this.openCampaignDetail(this.activeCampaign);     
    } else {       
      this.executionPhase = 'idle';       
      this.loadPausedSession();     
    }     
    this.cdr.detectChanges();   
  }

  resumeSession() {     
    const stored = window.localStorage.getItem('v3_paused_run_' + this.currentBook.id);     
    if (stored) {       
      const state = JSON.parse(stored);       
      this.runSetup = state.runSetup;       
      this.currentTestIndex = state.currentTestIndex;       
      this.currentSession = state.currentSession;       
      this.runTests = state.runTests;       
      this.activeCampaign = state.activeCampaign || null;       
      if (!this.currentSession.taskResponses) this.currentSession.taskResponses = {};       
      this.executionPhase = 'running';       
      this.cdr.detectChanges();     
    }   
  }

  saveCurrentTestNotes(): void {     
    const currentRt = this.runTests[this.currentTestIndex];     
    if (!currentRt) return;     
    const responseKeys = Object.keys(this.currentSession.responses);     
    const matchKey = responseKeys.find(k => String(k) === String(currentRt.test.id));     
    if (!matchKey) return;     
    const response = this.currentSession.responses[matchKey];     
    if (response.status === 'PENDING') return;     
    this.persistTestResponse(matchKey, response.status, response.notes, response.capturePath);   
  }

  private persistTestResponse(testId: string, status: TestStatus, notes: string, capturePath?: string): void {     
    const cleanSessionId = this.currentSession.id.replace('sess-', '');     
    this.recipeService.updateTestResponse({       
      session_id: cleanSessionId,       
      test_id: testId,       
      status,       
      notes: notes || '',       
      date_responded: new Date().toISOString().slice(0, 19).replace('T', ' '),       
      capture_path: capturePath     
    }).subscribe({ error: (err) => console.error('Erreur de sauvegarde de la fiche de test :', err) });   
  }

  private persistTaskResponse(taskId: string, status: 'PASSED' | 'FAILED' | 'SKIPPED', notes: string, capturePath?: string): void {     
    const cleanSessionId = this.currentSession.id.replace('sess-', '');     
    this.recipeService.updateTaskResponse({       
      session_id: cleanSessionId,       
      task_id: taskId,       
      status,       
      notes: notes || '',       
      capture_path: capturePath     
    }).subscribe({ error: (err) => console.error('Erreur de sauvegarde de la tâche :', err) });   
  }

  openCaptureModal(kind: 'task' | 'test', id: string): void {     
    this.captureTarget = { kind, id };     
    this.showCaptureModal = true;   
  }

  onCaptureSaved(path: string): void {     
    this.showCaptureModal = false;     
    if (!this.captureTarget) return;     
    const { kind, id } = this.captureTarget;     
    this.captureTarget = null;          
    if (kind === 'task') {       
      const taskResponse = this.ensureTaskResponse(id);       
      taskResponse.capturePath = path;       
      this.persistTaskResponse(id, taskResponse.status as 'PASSED' | 'FAILED' | 'SKIPPED', taskResponse.notes, path);     
    } else {       
      const responseKeys = Object.keys(this.currentSession.responses);       
      const matchKey = responseKeys.find(k => String(k) === String(id));       
      if (!matchKey) return;       
      const response = this.currentSession.responses[matchKey];       
      response.capturePath = path;       
      this.persistTestResponse(matchKey, response.status, response.notes, path);     
    }     
    this.showNotification('Capture enregistrée.', 'success');     
    this.cdr.detectChanges();   
  }

  onCaptureClosed(): void {     
    this.showCaptureModal = false;     
    this.captureTarget = null;   
  }

  getTaskResponse(taskId: string | number): TestResponse | undefined {     
    if (!this.currentSession || !this.currentSession.taskResponses) return undefined;     
    const matchKey = Object.keys(this.currentSession.taskResponses).find(k => String(k) === String(taskId));     
    return matchKey ? this.currentSession.taskResponses[matchKey] : undefined;   
  }

  getTaskCapture(taskId: string | number): string | undefined {     
    return this.getTaskResponse(taskId)?.capturePath;   
  }

  getTestCapture(testId: string): string | undefined {     
    const responseKeys = Object.keys(this.currentSession.responses);     
    const matchKey = responseKeys.find(k => String(k) === String(testId));     
    return matchKey ? this.currentSession.responses[matchKey].capturePath : undefined;   
  }

  private ensureTaskResponse(taskId: string | number): TestResponse {     
    if (!this.currentSession.taskResponses) this.currentSession.taskResponses = {};     
    const matchKey = Object.keys(this.currentSession.taskResponses).find(k => String(k) === String(taskId));     
    if (matchKey) return this.currentSession.taskResponses[matchKey];          
    const newKey = String(taskId);     
    this.currentSession.taskResponses[newKey] = { status: 'PENDING', notes: '' };     
    return this.currentSession.taskResponses[newKey];   
  }

  answerTask(testId: string, taskId: string | number, status: 'PASSED' | 'FAILED' | 'SKIPPED') {     
    const taskResponse = this.ensureTaskResponse(taskId);     
    const wasPending = taskResponse.status === 'PENDING';     
    taskResponse.status = status;     
    this.persistTaskResponse(String(taskId), status, taskResponse.notes, taskResponse.capturePath);          
    const currentRt = this.runTests[this.currentTestIndex];     
    if (!currentRt || String(currentRt.test.id) !== String(testId)) return;          
    let allDone = true;     
    let hasKo = false;     
    let hasOk = false;     
    currentRt.test.tasks.forEach(t => {       
      const st = this.ensureTaskResponse(t.id).status;       
      if (st === 'PENDING') allDone = false;       
      if (st === 'FAILED') hasKo = true;       
      if (st === 'PASSED') hasOk = true;     
    });          
    if (allDone) {       
      const responseKeys = Object.keys(this.currentSession.responses);       
      const matchKey = responseKeys.find(k => String(k) === String(testId));       
      if (matchKey) {         
        const newStatus = hasKo ? 'FAILED' : hasOk ? 'PASSED' : 'SKIPPED';         
        this.currentSession.responses[matchKey].status = newStatus;         
        this.currentSession.responses[matchKey].dateResponded = new Date().toISOString();         
        this.persistTestResponse(matchKey, newStatus, this.currentSession.responses[matchKey].notes, this.currentSession.responses[matchKey].capturePath);       
      }       
      if (wasPending && !hasKo) setTimeout(() => { this.currentTestIndex++; this.cdr.detectChanges(); }, 600);     
    }     
    this.cdr.detectChanges();   
  }

  answerCurrentTest(status: 'PASSED' | 'FAILED' | 'SKIPPED') {     
    const currentRt = this.runTests[this.currentTestIndex];     
    if (!currentRt) return;     
    const responseKeys = Object.keys(this.currentSession.responses);     
    const matchKey = responseKeys.find(k => String(k) === String(currentRt.test.id));     
    if (matchKey) {       
      const wasPending = this.currentSession.responses[matchKey].status === 'PENDING';       
      this.currentSession.responses[matchKey].status = status;       
      this.currentSession.responses[matchKey].dateResponded = new Date().toISOString();       
      this.persistTestResponse(matchKey, status, this.currentSession.responses[matchKey].notes, this.currentSession.responses[matchKey].capturePath);       
      if (wasPending && status !== 'FAILED') setTimeout(() => { this.currentTestIndex++; this.cdr.detectChanges(); }, 500);     
    }     
    this.cdr.detectChanges();   
  }

  finishSession() {     
    let hasBloquantFailed = false;     
    const responseKeys = Object.keys(this.currentSession.responses || {});          
    this.runTests.forEach(rt => {       
      const matchKey = responseKeys.find(k => String(k) === String(rt.test.id));       
      const status = matchKey ? this.currentSession.responses[matchKey]?.status : undefined;       
      if (status === 'FAILED' && rt.test.criticality === 'Bloquant') {         
        hasBloquantFailed = true;       
      }     
    });          
    const finalStatus = hasBloquantFailed ? 'NO-GO' : 'GO';     
    this.currentSession.status = finalStatus;          
    this.recipeService.saveCompleteSession(this.currentSession, !!this.activeCampaign).subscribe({       
      next: () => {         
        window.localStorage.removeItem('v3_paused_run_' + this.currentBook.id);         
        this.loadPausedSession();         
        this.showNotification("Session validée et transmise (" + finalStatus + ").", 'success');                  
        if (this.activeCampaign) {           
          const localSess = this.campaignSessions.find(s => s.id === this.currentSession.id);           
          if (localSess) localSess.status = finalStatus;           
          this.openCampaignDetail(this.activeCampaign);         
        } else {           
          this.sessionFinished.emit();         
        }       
      },       
      error: (err: unknown) => {         
        console.error("Échec persistance session :", err);         
        this.formError = "Erreur réseau lors de la transmission des résultats au serveur.";         
        this.cdr.detectChanges();       
      }     
    });   
  }

  getRunProgress() {     
    let answered = 0, total = 0, passed = 0, failed = 0;     
    const responseKeys = Object.keys(this.currentSession.responses || {});     
    this.runTests.forEach(rt => {       
      if (rt.test.tasks && rt.test.tasks.length > 0) {         
        rt.test.tasks.forEach(tsk => {           
          total++;            
          const st = this.getTaskResponse(tsk.id)?.status;           
          if (st && st !== 'PENDING') answered++;           
          if (st === 'PASSED') passed++;           
          if (st === 'FAILED') failed++;         
        });       
      } else {         
        total++;          
        const matchKey = responseKeys.find(k => String(k) === String(rt.test.id));         
        if (matchKey) {           
          const st = this.currentSession.responses[matchKey]?.status;           
          if (st && st !== 'PENDING') answered++;           
          if (st === 'PASSED') passed++;           
          if (st === 'FAILED') failed++;         
        }       
      }     
    });     
    return { answered, total, passed, failed, percentage: total > 0 ? (answered / total) * 100 : 0 };   
  }

  isSessionStarted(sess: TestSession): boolean {
    if (!sess) return false;
    // 1. Vérification par le nombre de réponses calculé par getSessionProgress
    const progress = this.getSessionProgress(sess);
    if (progress && progress.includes('/')) {
      const completedCount = parseInt(progress.split('/')[0].trim(), 10);
      if (!isNaN(completedCount) && completedCount > 0) return true;
    }
    // 2. Vérification dans sessionQuestionsMap
    const questions = this.sessionQuestionsMap[sess.id];
    if (questions && questions.length > 0) {
      if (questions.some(q => q.response && q.response.status && q.response.status !== 'PENDING')) return true;
    }
    // 3. Vérification dans responses
    if (sess.responses) {
      if (Object.values(sess.responses).some(r => r && r.status && r.status !== 'PENDING')) return true;
    }
    // 4. Vérification dans taskResponses
    if (sess.taskResponses) {
      if (Object.values(sess.taskResponses).some(r => r && r.status && r.status !== 'PENDING')) return true;
    }
    return false;
  }

  isSessionCompleted(sess: TestSession): boolean {
    if (!sess || !sess.responses) return false;
    const responseKeys = Object.keys(sess.responses);
    if (responseKeys.length === 0) return false;

    const allTestsAnswered = responseKeys.every(k => sess.responses[k]?.status && sess.responses[k].status !== 'PENDING');
    if (!allTestsAnswered) return false;

    const questions = this.sessionQuestionsMap[sess.id] || this.getSessionQuestions(sess);
    if (questions && questions.length > 0) {
      for (const q of questions) {
        if (q.test.tasks && q.test.tasks.length > 0) {
          const allTasksAnswered = q.test.tasks.every(tsk => {
            const safeTaskId = String(tsk.id);
            const tSt = sess.taskResponses?.[safeTaskId]?.status || sess.taskResponses?.[tsk.id]?.status;
            return tSt && tSt !== 'PENDING';
          });
          if (!allTasksAnswered) return false;
        }
      }
    }
    return true;
  }

  getSessionDecision(sess: TestSession): 'GO' | 'NO-GO' | 'PENDING' {
    if (!this.isSessionCompleted(sess)) {
      return 'PENDING';
    }
    return sess.status === 'NO-GO' ? 'NO-GO' : (sess.status === 'GO' ? 'GO' : 'PENDING');
  }

  getQuestionStatus(q: { test: RecipeTest; response: TestResponse }, sess: TestSession): 'PASSED' | 'FAILED' | 'SKIPPED' | 'PENDING' {
    if (!q || !q.test || !sess) return 'PENDING';

    if (q.test.tasks && q.test.tasks.length > 0) {
      let allDone = true;
      let hasKo = false;
      let hasOk = false;

      q.test.tasks.forEach(tsk => {
        const safeTaskId = String(tsk.id);
        const tResp = sess.taskResponses?.[safeTaskId] || sess.taskResponses?.[tsk.id];
        const st = tResp?.status?.toUpperCase();
        if (!st || st === 'PENDING') {
          allDone = false;
        } else if (st === 'FAILED') {
          hasKo = true;
        } else if (st === 'PASSED') {
          hasOk = true;
        }
      });

      if (!allDone) {
        return 'PENDING';
      }
      return hasKo ? 'FAILED' : hasOk ? 'PASSED' : 'SKIPPED';
    }

    const st = (q.response?.status || sess.responses?.[q.test.id]?.status)?.toUpperCase();
    if (st === 'PASSED' || st === 'FAILED' || st === 'SKIPPED') {
      return st as 'PASSED' | 'FAILED' | 'SKIPPED';
    }
    return 'PENDING';
  }

  getTestSuccessPercentage(q: { test: RecipeTest; response: TestResponse }, sess: TestSession): string {
    if (!q || !q.test || !sess) return '0%';

    if (q.test.tasks && q.test.tasks.length > 0) {
      let passed = 0;
      q.test.tasks.forEach(tsk => {
        const safeTaskId = String(tsk.id);
        const st = sess.taskResponses?.[safeTaskId]?.status?.toUpperCase() || sess.taskResponses?.[tsk.id]?.status?.toUpperCase();
        if (st === 'PASSED') {
          passed++;
        }
      });
      return Math.round((passed / q.test.tasks.length) * 100) + '%';
    }

    const st = (q.response?.status || sess.responses?.[q.test.id]?.status)?.toUpperCase();
    if (st === 'PASSED') return '100%';
    return '0%';
  }

  getSessionSuccessPercentage(sess: TestSession): string {
    if (!sess) return '0%';

    const questions = this.sessionQuestionsMap[sess.id] || this.getSessionQuestions(sess);
    if (!questions || questions.length === 0) {
      if (!sess.responses) return '0%';
      const keys = Object.keys(sess.responses);
      if (keys.length === 0) return '0%';
      let passed = 0;
      keys.forEach(k => {
        if (sess.responses[k]?.status?.toUpperCase() === 'PASSED') passed++;
      });
      return Math.round((passed / keys.length) * 100) + '%';
    }

    let total = 0;
    let passed = 0;

    questions.forEach(q => {
      if (q.test.tasks && q.test.tasks.length > 0) {
        q.test.tasks.forEach(tsk => {
          total++;
          const safeTaskId = String(tsk.id);
          const st = sess.taskResponses?.[safeTaskId]?.status?.toUpperCase() || sess.taskResponses?.[tsk.id]?.status?.toUpperCase();
          if (st === 'PASSED') passed++;
        });
      } else {
        total++;
        const st = (q.response?.status || sess.responses?.[q.test.id]?.status)?.toUpperCase();
        if (st === 'PASSED') passed++;
      }
    });

    return total > 0 ? Math.round((passed / total) * 100) + '%' : '0%';
  }
}