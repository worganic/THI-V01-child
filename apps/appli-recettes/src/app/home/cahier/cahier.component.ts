import { Component, Input, OnChanges, SimpleChanges, inject, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { firstValueFrom } from 'rxjs'; // 🪄 Obligatoire pour la linéarisation stricte des flux HTTP Airbus
import { RecipeService } from '../../core/services/recipe.service';
import { RecipeBook, RecipeCategory, RecipeApplicatif, RecipeSection, RecipeTest, RecipeTask, Criticality } from '../../core/models/recipe.model';

@Component({
  selector: 'app-cahier',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule],
  templateUrl: './cahier.component.html',
  styleUrls: ['./cahier.component.scss']
})
export class CahierComponent implements OnChanges {
  private recipeService = inject(RecipeService);
  private cdr = inject(ChangeDetectorRef); // 🪄 Injection du détecteur de changements Airbus

  @Input() currentBook!: RecipeBook;
  @Output() requestExecution = new EventEmitter<string>();

  launchDirectExecution(targetKey: string, event: Event) {
    event.stopPropagation();
    this.requestExecution.emit(targetKey);
  }

  // États d'ouverture de l'arbre
  expandedCategories: { [id: string]: boolean } = {};
  expandedApplicatifs: { [id: string]: boolean } = {};
  expandedSections: { [id: string]: boolean } = {};
  expandedTests: { [id: string]: boolean } = {};

  // Gestion unifiée des modales
  activeModal: 'category' | 'applicatif' | 'section' | 'test' | null = null;
  modalMode: 'add' | 'edit' = 'add';

  // Pointeurs pour l'édition/création ciblée
  targetCategory: RecipeCategory | null = null;
  targetApplicatif: RecipeApplicatif | null = null;
  targetSection: RecipeSection | null = null;
  targetTest: RecipeTest | null = null;

  formData = { name: '', description: '', url: '', criticality: 'Mineur' as Criticality };

  formTasks: RecipeTask[] = [];
  newTaskText = '';

  // Gestion de la modale d'import
  showImportModal = false;
  importText = '';
  isImporting = false; // 🪄 État du loader d'import

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['currentBook'] && this.currentBook) {
      this.currentBook.categories.forEach(c => {
        this.expandedCategories[c.id] = true;
        if (c.applicatifs) {
          c.applicatifs.forEach(a => {
            this.expandedApplicatifs[a.id] = true;
            // 🛑 Optimisation: On ne déploie plus les sections automatiquement
            // pour éviter le chargement synchrone massif de tous les tests.
          });
        }
      });
    }
  }

  save() {
    if (this.currentBook) {
      this.recipeService.saveBook(this.currentBook).subscribe({
        error: (err: unknown) => alert("Erreur lors de la sauvegarde du cahier sur le serveur.")
      });
    }
  }

  // --- GESTION DES TÂCHES (TASKS) ---
  addTaskToTest() {
    if (!this.newTaskText.trim()) return;
    this.formTasks.push({
      id: 'task-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      name: this.newTaskText.trim()
    });
    this.newTaskText = '';
  }

  removeTaskFromTest(index: number) {
    this.formTasks.splice(index, 1);
  }

  // --- OUVERTURES DES MODALES DE GESTION (CRUD) ---
  openAddCategory() { this.formData = { name: '', description: '', url: '', criticality: 'Mineur' }; this.modalMode = 'add'; this.activeModal = 'category'; }
  openEditCategory(cat: RecipeCategory, event: Event) { event.stopPropagation(); this.targetCategory = cat; this.formData = { name: cat.name, description: cat.comment || '', url: cat.url || '', criticality: 'Mineur' }; this.modalMode = 'edit'; this.activeModal = 'category'; }

  deleteCategory(id: string, e: Event) {
    e.stopPropagation();
    if (confirm('Supprimer cette catégorie et toutes ses dépendances ?')) {
      this.currentBook.categories = this.currentBook.categories.filter(c => c.id !== id);
      this.recipeService.deleteCategory(id).subscribe({
        error: (err: unknown) => console.error("Erreur suppression catégorie :", err)
      });
    }
  }

  openAddApplicatif(cat: RecipeCategory, event: Event) { event.stopPropagation(); this.targetCategory = cat; this.formData = { name: '', description: '', url: '', criticality: 'Mineur' }; this.modalMode = 'add'; this.activeModal = 'applicatif'; }
  openEditApplicatif(app: RecipeApplicatif, event: Event) { event.stopPropagation(); this.targetApplicatif = app; this.formData = { name: app.name, description: app.description || '', url: app.url || '', criticality: 'Mineur' }; this.modalMode = 'edit'; this.activeModal = 'applicatif'; }

  deleteApplicatif(cat: RecipeCategory, id: string, e: Event) {
    e.stopPropagation();
    if (confirm('Supprimer cet applicatif et toutes ses dépendances ?')) {
      cat.applicatifs = cat.applicatifs.filter(a => a.id !== id);
      this.recipeService.deleteApplicatif(id).subscribe({
        error: (err: unknown) => console.error("Erreur suppression applicatif :", err)
      });
    }
  }

  openAddSection(app: RecipeApplicatif, event: Event) { event.stopPropagation(); this.targetApplicatif = app; this.formData = { name: '', description: '', url: '', criticality: 'Mineur' }; this.modalMode = 'add'; this.activeModal = 'section'; }
  openEditSection(sec: RecipeSection, event: Event) { event.stopPropagation(); this.targetSection = sec; this.formData = { name: sec.name, description: sec.description || '', url: sec.url || '', criticality: 'Mineur' }; this.modalMode = 'edit'; this.activeModal = 'section'; }

  deleteSection(app: RecipeApplicatif, id: string, e: Event) {
    e.stopPropagation();
    if (confirm('Supprimer cette section et tous ses tests ?')) {
      app.sections = app.sections.filter(s => s.id !== id);
      this.recipeService.deleteSection(id).subscribe({
        error: (err: unknown) => console.error("Erreur suppression section :", err)
      });
    }
  }

  openAddTest(sec: RecipeSection, event: Event) { event.stopPropagation(); this.targetSection = sec; this.formData = { name: '', description: '', url: '', criticality: 'Mineur' }; this.formTasks = []; this.newTaskText = ''; this.modalMode = 'add'; this.activeModal = 'test'; }
  openEditTest(test: RecipeTest, event: Event) { event.stopPropagation(); this.targetTest = test; this.formData = { name: test.name, description: test.description || '', url: test.url || '', criticality: test.criticality }; this.formTasks = [...(test.tasks || [])]; this.newTaskText = ''; this.modalMode = 'edit'; this.activeModal = 'test'; }

  onTestDrop(event: CdkDragDrop<RecipeTest[]>, sec: RecipeSection) {
    if (event.previousIndex === event.currentIndex) return;
    moveItemInArray(sec.tests, event.previousIndex, event.currentIndex);
    this.recipeService.reorderTests(sec.tests, sec.id).subscribe({
      error: (err: unknown) => console.error("Erreur lors de la sauvegarde du nouvel ordre des tests :", err)
    });
  }

  onSectionDrop(event: CdkDragDrop<RecipeSection[]>, app: RecipeApplicatif) {
    if (event.previousIndex === event.currentIndex) return;
    moveItemInArray(app.sections, event.previousIndex, event.currentIndex);
    this.recipeService.reorderSections(app.sections, app.id).subscribe({
      error: (err: unknown) => console.error("Erreur lors de la sauvegarde du nouvel ordre des sections :", err)
    });
  }

  deleteTest(sec: RecipeSection, id: string, e: Event) {
    e.stopPropagation();
    if (confirm('Supprimer ce test et toutes ses sous-tâches ?')) {
      sec.tests = sec.tests.filter(t => t.id !== id);
      this.recipeService.deleteTest(id).subscribe({
        error: (err: unknown) => console.error("Erreur suppression test :", err)
      });
    }
  }

  // --- SAUVEGARDE ET FERMETURE MODALES CRUD ---
  saveModal() {
    if (!this.formData.name.trim()) { alert('Le nom est obligatoire.'); return; }

    // Une task tapée dans le champ "+" mais jamais ajoutée à la liste serait sinon perdue silencieusement.
    if (this.activeModal === 'test' && this.newTaskText.trim()) {
      const pending = this.newTaskText.trim();
      if (confirm(`Vous avez saisi une tâche qui n'a pas été ajoutée à la liste : "${pending}".\n\nVoulez-vous l'ajouter avant d'enregistrer le test ?`)) {
        this.addTaskToTest();
      } else {
        this.newTaskText = '';
      }
    }

    const currentUser = window.localStorage.getItem('currentUser') || 'Johann LOREAU (X495776)';

    if (this.activeModal === 'category') {
      if (this.modalMode === 'add') {
        const newCat: RecipeCategory = { id: 'cat-' + Date.now(), name: this.formData.name, comment: this.formData.description, url: this.formData.url, createdBy: currentUser, applicatifs: [] };
        this.currentBook.categories.push(newCat);

        this.recipeService.saveCategory(newCat, this.currentBook.id, false).subscribe({
          error: (err: unknown) => console.error("Erreur insertion catégorie :", err)
        });
      } else if (this.targetCategory) {
        this.targetCategory.name = this.formData.name;
        this.targetCategory.comment = this.formData.description;
        this.targetCategory.url = this.formData.url;

        this.recipeService.saveCategory(this.targetCategory, this.currentBook.id, true).subscribe({
          error: (err: unknown) => console.error("Erreur modification catégorie :", err)
        });
      }
      this.closeModal();
    }
    else if (this.activeModal === 'applicatif') {
      if (this.modalMode === 'add' && this.targetCategory) {
        if (!this.targetCategory.applicatifs) this.targetCategory.applicatifs = [];

        const newApp: RecipeApplicatif = {
          id: 'app-' + Date.now(),
          name: this.formData.name,
          description: this.formData.description,
          url: this.formData.url,
          createdBy: currentUser,
          sections: []
        };
        this.targetCategory.applicatifs.push(newApp);

        this.recipeService.saveApplicatif(newApp, this.targetCategory.id, false).subscribe({
          error: (err: unknown) => console.error("Erreur insertion applicatif :", err)
        });
      } else if (this.targetApplicatif) {
        this.targetApplicatif.name = this.formData.name;
        this.targetApplicatif.description = this.formData.description;
        this.targetApplicatif.url = this.formData.url;

        const parentCategory = this.currentBook.categories.find(c =>
          c.applicatifs?.some(a => a.id === this.targetApplicatif?.id)
        );
        const categoryId = parentCategory ? parentCategory.id : '';

        this.recipeService.saveApplicatif(this.targetApplicatif, categoryId, true).subscribe({
          error: (err: unknown) => console.error("Erreur modification applicatif :", err)
        });
      }
      this.closeModal();
    }
    else if (this.activeModal === 'section') {
      if (this.modalMode === 'add' && this.targetApplicatif) {
        if (!this.targetApplicatif.sections) this.targetApplicatif.sections = [];

        const newSec: RecipeSection = {
          id: 'sec-' + Date.now(),
          name: this.formData.name,
          description: this.formData.description,
          url: this.formData.url,
          createdBy: currentUser,
          tests: []
        };
        this.targetApplicatif.sections.push(newSec);

        this.recipeService.saveSection(newSec, this.targetApplicatif.id, false).subscribe({
          error: (err: unknown) => console.error("Erreur insertion section :", err)
        });
      } else if (this.targetSection) {
        this.targetSection.name = this.formData.name;
        this.targetSection.description = this.formData.description;
        this.targetSection.url = this.formData.url;

        let applicatifId = '';
        for (const cat of this.currentBook.categories) {
          const parentApp = cat.applicatifs?.find(a => a.sections?.some(s => s.id === this.targetSection?.id));
          if (parentApp) {
            applicatifId = parentApp.id;
            break;
          }
        }

        this.recipeService.saveSection(this.targetSection, applicatifId, true).subscribe({
          error: (err: unknown) => console.error("Erreur modification section :", err)
        });
      }
      this.closeModal();
    }
    else if (this.activeModal === 'test') {
      if (this.modalMode === 'add' && this.targetSection) {
        const newTest: RecipeTest = {
          id: 'test-' + Date.now(),
          name: this.formData.name,
          description: this.formData.description,
          url: this.formData.url,
          criticality: this.formData.criticality,
          createdBy: currentUser,
          tasks: [...this.formTasks]
        };
        this.targetSection.tests.push(newTest);

        this.recipeService.saveTest(newTest, this.targetSection.id, false).subscribe({
          error: (err: unknown) => console.error("Erreur insertion test :", err)
        });

        this.formTasks.forEach(task => {
          this.recipeService.saveTask(task, newTest.id, false).subscribe({
            error: (err: unknown) => console.error("Erreur insertion tâche :", err)
          });
        });

      } else if (this.targetTest) {
        const testId = this.targetTest.id;
        const oldTasks = [...(this.targetTest.tasks || [])];

        this.targetTest.name = this.formData.name;
        this.targetTest.description = this.formData.description;
        this.targetTest.url = this.formData.url;
        this.targetTest.criticality = this.formData.criticality;
        this.targetTest.tasks = [...this.formTasks];

        let sectionId = '';
        for (const cat of this.currentBook.categories) {
          if (cat.applicatifs) {
            for (const app of cat.applicatifs) {
              const parentSec = app.sections?.find(s => s.tests?.some(t => t.id === testId));
              if (parentSec) {
                sectionId = parentSec.id;
                break;
              }
            }
          }
          if (sectionId) break;
        }

        this.recipeService.saveTest(this.targetTest, sectionId, true).subscribe({
          error: (err: unknown) => console.error("Erreur modification test :", err)
        });

        const tasksToDelete = oldTasks.filter(oldT => !this.formTasks.some(newT => newT.id === oldT.id));
        tasksToDelete.forEach(task => {
          this.recipeService.deleteTask(task.id).subscribe({
            error: (err: unknown) => console.error("Erreur suppression tâche rattachée :", err)
          });
        });

        this.formTasks.forEach(task => {
          const isExisting = oldTasks.some(oldT => oldT.id === task.id);
          this.recipeService.saveTask(task, testId, isExisting).subscribe({
            error: (err: unknown) => console.error("Erreur enregistrement tâche rattachée :", err)
          });
        });
      }
      this.closeModal();
    }
  }

  closeModal() { this.activeModal = null; this.targetCategory = null; this.targetApplicatif = null; this.targetSection = null; this.targetTest = null; }

  getHighestCriticality(test: RecipeTest): string {
    return test.criticality ? test.criticality.toLowerCase() : 'mineur';
  }

  getApplicatifTestCount(app: RecipeApplicatif): number {
    return app.sections?.reduce((acc, sec) => acc + (sec.tests?.length || 0), 0) || 0;
  }

  getCategoryTestCount(cat: RecipeCategory): number {
    return cat.applicatifs?.reduce((acc, app) => acc + this.getApplicatifTestCount(app), 0) || 0;
  }

  // 🛠️ DUPLIQUE LE CAHIER AVEC TOUTE SA STRUCTURE
  duplicateBookStructure() {
    if (!this.currentBook) return;

    const newName = prompt("Entrez le nom du nouveau cahier :", this.currentBook.name + " (Copie)");
    if (!newName || !newName.trim()) return;

    const genId = (prefix: string) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    const newCategories: RecipeCategory[] = this.currentBook.categories.map(cat => ({
      ...cat,
      id: genId('cat'),
      applicatifs: cat.applicatifs?.map(app => ({
        ...app,
        id: genId('app'),
        sections: app.sections?.map(sec => ({
          ...sec,
          id: genId('sec'),
          tests: sec.tests?.map(test => ({
            ...test,
            id: genId('test'),
            tasks: test.tasks?.map(task => ({
              ...task,
              id: genId('task')
            })) || []
          })) || []
        })) || []
      })) || []
    }));

    const newBook: RecipeBook = {
      id: genId('book'),
      name: newName.trim(),
      description: this.currentBook.description,
      dateCreated: new Date().toISOString(),
      categories: newCategories
    };

    this.recipeService.saveBook(newBook).subscribe();

    alert(`Le cahier "${newName.trim()}" a été dupliqué avec succès !\n\nIl contient l'intégralité de vos tests et tâches, mais aucun historique de résultats.\nRetournez à l'accueil pour l'ouvrir.`);
  }

  openImportModal() {
    if (!this.currentBook || !this.currentBook.categories || this.currentBook.categories.length === 0) {
      this.importText = '';
      this.showImportModal = true;
      return;
    }

    let serializedText = '';

    this.currentBook.categories.forEach(cat => {
      serializedText += `#CAT: ${cat.name || ''} | ${cat.comment || ''}\n`;

      cat.applicatifs?.forEach(app => {
        serializedText += `#APP: ${app.name || ''} | ${app.description || ''} | ${app.url || ''}\n`;

        app.sections?.forEach(sec => {
          serializedText += `#SEC: ${sec.name || ''} | ${sec.description || ''} | ${sec.url || ''}\n`;

          sec.tests?.forEach(test => {
            serializedText += `#TEST: ${test.name || ''} | ${test.description || ''} | ${test.url || ''} | ${test.criticality || 'Mineur'}\n`;

            test.tasks?.forEach(task => {
              serializedText += `#TASK: ${task.name || ''}\n`;
            });
          });
        });
      });
    });

    this.importText = serializedText;
    this.showImportModal = true;
  }

  // 🪄 Importation Intelligente Synchrone avec Sécurisation des Erreurs (Fermeture Loader + Popup + cdr)
  async processImport() {
    if (!this.importText.trim()) return;

    // 1. On active le loader dès le début
    this.isImporting = true;

    const currentUser = window.localStorage.getItem('currentUser') || 'Johann LOREAU (X495776)';
    const lines = this.importText.split('\n');

    let currentCat: RecipeCategory | null = null;
    let currentApp: RecipeApplicatif | null = null;
    let currentSec: RecipeSection | null = null;
    let currentTest: RecipeTest | null = null;

    const genId = (prefix: string) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    const ensureCat = async () => {
      if (!currentCat) {
        currentCat = this.currentBook.categories.find(c => c.name === 'Catégorie Importée') || null;
        if (!currentCat) {
          currentCat = { id: genId('cat'), name: 'Catégorie Importée', comment: '', createdBy: currentUser, applicatifs: [] };
          this.currentBook.categories.push(currentCat);
          await firstValueFrom(this.recipeService.saveCategory(currentCat, this.currentBook.id, false));
        }
        this.expandedCategories[currentCat.id] = true;
      }
      return currentCat;
    };

    const ensureApp = async () => {
      const cat = await ensureCat();
      if (!currentApp) {
        if (!cat.applicatifs) cat.applicatifs = [];
        currentApp = cat.applicatifs.find(a => a.name === 'Applicatif Importé') || null;
        if (!currentApp) {
          currentApp = { id: genId('app'), name: 'Applicatif Importé', description: '', createdBy: currentUser, sections: [] };
          cat.applicatifs.push(currentApp);
          await firstValueFrom(this.recipeService.saveApplicatif(currentApp, cat.id, false));
        }
        this.expandedApplicatifs[currentApp.id] = true;
      }
      return currentApp;
    };

    const ensureSec = async () => {
      const app = await ensureApp();
      if (!currentSec) {
        if (!app.sections) app.sections = [];
        currentSec = app.sections.find(s => s.name === 'Section Importée') || null;
        if (!currentSec) {
          currentSec = { id: genId('sec'), name: 'Section Importée', description: '', createdBy: currentUser, tests: [] };
          app.sections.push(currentSec);
          await firstValueFrom(this.recipeService.saveSection(currentSec, app.id, false));
        }
        this.expandedSections[currentSec.id] = true;
      }
      return currentSec;
    };

    try {
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (trimmed.startsWith('#CAT:')) {
          const parts = trimmed.substring(5).split('|').map(p => p.trim());
          const catName = parts[0] || 'Catégorie sans nom';

          currentCat = this.currentBook.categories.find(c => c.name.toLowerCase() === catName.toLowerCase()) || null;

          if (!currentCat) {
            currentCat = { id: genId('cat'), name: catName, comment: parts[1] || '', createdBy: currentUser, applicatifs: [] };
            this.currentBook.categories.push(currentCat);
            await firstValueFrom(this.recipeService.saveCategory(currentCat, this.currentBook.id, false));
          } else if (parts[1]) {
            currentCat.comment = parts[1];
            await firstValueFrom(this.recipeService.saveCategory(currentCat, this.currentBook.id, true));
          }

          this.expandedCategories[currentCat.id] = true;
          currentApp = null; currentSec = null; currentTest = null;
        }
        else if (trimmed.startsWith('#APP:')) {
          const cat = await ensureCat();
          const parts = trimmed.substring(5).split('|').map(p => p.trim());
          const appName = parts[0] || 'Applicatif sans nom';

          if (!cat.applicatifs) cat.applicatifs = [];
          currentApp = cat.applicatifs.find(a => a.name.toLowerCase() === appName.toLowerCase()) || null;

          if (!currentApp) {
            currentApp = { id: genId('app'), name: appName, description: parts[1] || '', url: parts[2] || '', createdBy: currentUser, sections: [] };
            cat.applicatifs.push(currentApp);
            await firstValueFrom(this.recipeService.saveApplicatif(currentApp, cat.id, false));
          } else {
            currentApp.description = parts[1] || currentApp.description;
            currentApp.url = parts[2] || currentApp.url;
            await firstValueFrom(this.recipeService.saveApplicatif(currentApp, cat.id, true));
          }

          this.expandedApplicatifs[currentApp.id] = true;
          currentSec = null; currentTest = null;
        }
        else if (trimmed.startsWith('#SEC:')) {
          const app = await ensureApp();
          const parts = trimmed.substring(5).split('|').map(p => p.trim());
          const secName = parts[0] || 'Section sans nom';

          if (!app.sections) app.sections = [];
          currentSec = app.sections.find(s => s.name.toLowerCase() === secName.toLowerCase()) || null;

          if (!currentSec) {
            currentSec = { id: genId('sec'), name: secName, description: parts[1] || '', url: parts[2] || '', createdBy: currentUser, tests: [] };
            app.sections.push(currentSec);
            await firstValueFrom(this.recipeService.saveSection(currentSec, app.id, false));
          } else {
            currentSec.description = parts[1] || currentSec.description;
            currentSec.url = parts[2] || currentSec.url;
            await firstValueFrom(this.recipeService.saveSection(currentSec, app.id, true));
          }

          this.expandedSections[currentSec.id] = true;
          currentTest = null;
        }
        else if (trimmed.startsWith('#TEST:')) {
          const sec = await ensureSec();
          const parts = trimmed.substring(6).split('|').map(p => p.trim());
          const testName = parts[0] || 'Test sans nom';

          let crit = parts[3] || 'Mineur';
          if (crit !== 'Bloquant' && crit !== 'Majeur' && crit !== 'Mineur') crit = 'Mineur';

          if (!sec.tests) sec.tests = [];
          currentTest = sec.tests.find(t => t.name.toLowerCase() === testName.toLowerCase()) || null;

          if (!currentTest) {
            currentTest = {
              id: genId('test'),
              name: testName,
              description: parts[1] || '',
              url: parts[2] || '',
              criticality: crit as Criticality,
              createdBy: currentUser,
              tasks: []
            };
            sec.tests.push(currentTest);
            await firstValueFrom(this.recipeService.saveTest(currentTest, sec.id, false));
          } else {
            currentTest.description = parts[1] || currentTest.description;
            currentTest.url = parts[2] || currentTest.url;
            currentTest.criticality = crit as Criticality;
            await firstValueFrom(this.recipeService.saveTest(currentTest, sec.id, true));
          }

          this.expandedTests[currentTest.id] = true;
        }
        else if (trimmed.startsWith('#TASK:')) {
          if (!currentTest) continue;
          const parts = trimmed.substring(6).split('|').map(p => p.trim());
          const taskName = parts[0] || 'Tâche sans nom';

          if (!currentTest.tasks) currentTest.tasks = [];

          const existingTask = currentTest.tasks.find(t => t.name.toLowerCase() === taskName.toLowerCase());
          if (!existingTask) {
            const newTask = { id: genId('task'), name: taskName };
            currentTest.tasks.push(newTask);
            await firstValueFrom(this.recipeService.saveTask(newTask, currentTest.id, false));
          }
        }
      }

      // 2. Sauvegarde finale réussie
      this.save();

      // 3. Tout fermer proprement dans le code
      this.isImporting = false;
      this.showImportModal = false;

      // 🪄 FIX : On force Angular à nettoyer IMMÉDIATEMENT le DOM (efface le loader + popup)
      this.cdr.detectChanges();

      // 4. Notification Succès
      setTimeout(() => {
        alert("✅ L'arborescence du cahier de recette a été importée avec succès !");
      }, 50);

    } catch (apiError) {
      console.error("Erreur d'écriture BDD lors de l'import :", apiError);

      // En cas d'erreur, on force aussi la fermeture complète
      this.isImporting = false;
      this.showImportModal = false;

      // 🪄 FIX : On force le nettoyage du DOM ici aussi
      this.cdr.detectChanges();

      // Notification Erreur
      setTimeout(() => {
        alert("❌ Une erreur serveur est survenue lors de l'enregistrement de l'import.");
      }, 50);
    }
  }

  exportBookData() {
    if (!this.currentBook || !this.currentBook.categories || this.currentBook.categories.length === 0) {
      alert('Le cahier est vide, rien à exporter.');
      return;
    }

    let serializedText = '';

    this.currentBook.categories.forEach(cat => {
      serializedText += `#CAT: ${cat.name || ''} | ${cat.comment || ''}\n`;

      cat.applicatifs?.forEach(app => {
        serializedText += `#APP: ${app.name || ''} | ${app.description || ''} | ${app.url || ''}\n`;

        app.sections?.forEach(sec => {
          serializedText += `#SEC: ${sec.name || ''} | ${sec.description || ''} | ${sec.url || ''}\n`;

          sec.tests?.forEach(test => {
            serializedText += `#TEST: ${test.name || ''} | ${test.description || ''} | ${test.url || ''} | ${test.criticality || 'Mineur'}\n`;

            test.tasks?.forEach(task => {
              serializedText += `#TASK: ${task.name || ''}\n`;
            });
          });
        });
      });
    });

    const blob = new Blob([serializedText], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    const safeName = this.currentBook.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    link.download = `export_cahier_${safeName}.txt`;

    link.click();
    window.URL.revokeObjectURL(url);
  }

  // 🪄 Nouvelle méthode de chargement des Tests à la demande (Lazy Loading niveau 2)
  toggleSectionExpansion(sec: RecipeSection) {
    this.expandedSections[sec.id] = !this.expandedSections[sec.id];

    if (this.expandedSections[sec.id] && (!sec.tests || sec.tests.length === 0)) {
      this.recipeService.getTests(sec.id).subscribe({
        next: (tests) => {
          sec.tests = tests || [];
          sec.tests.forEach(test => {
            if (!test.tasks) test.tasks = [];
          });
        },
        error: (err) => console.error(`Erreur de chargement des tests (Section ${sec.id}):`, err)
      });
    }
  }

  // 🪄 Chargement des Tâches à la demande (Lazy Loading niveau 3)
  toggleTestExpansion(test: RecipeTest) {
    this.expandedTests[test.id] = !this.expandedTests[test.id];

    if (this.expandedTests[test.id] && (!test.tasks || test.tasks.length === 0)) {
      this.recipeService.getTasks(test.id).subscribe({
        next: (tasks) => {
          test.tasks = tasks || [];
        },
        error: (err) => console.error(`Erreur lors du chargement des tâches pour le test ${test.id} :`, err)
      });
    }
  }
}