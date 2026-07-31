import { Component, Input, Output, EventEmitter, ViewChild } from '@angular/core';
import { FileNode, MegaOutilInstance, MaterializedMoPreview, PromptLaunchContext } from '@portail/core-data-access';
import {
  ProjetEditorZoneComponent,
  FileSaveEvent,
  SectionInfo,
  DragDropEvent
} from '../../components/projet-editor-zone/projet-editor-zone.component';

@Component({
  selector: 'app-edition-outil',
  standalone: true,
  imports: [ProjetEditorZoneComponent],
  template: `
    <app-projet-editor-zone
      [files]="files"
      [restoreToken]="restoreToken"
      [scrollToNodeId]="scrollToNodeId"
      [saveStatus]="saveStatus"
      [projectName]="projectName"
      [activeNodeId]="activeNodeId"
      [highlightNodeId]="highlightNodeId"
      [modeRequest]="modeRequest"
      [commentCounts]="commentCounts"
      [backupType]="backupType"
      [ftpSyncGlobalStatus]="ftpSyncGlobalStatus"
      [ftpSyncProgress]="ftpSyncProgress"
      [nodeSyncStatus]="nodeSyncStatus"
      [hasFtpBackup]="hasFtpBackup"
      [megaOutilInstances]="megaOutilInstances"
      [activeMegaOutilId]="activeMegaOutilId"
      [activeOutilId]="activeOutilId"
      [showTrelloList]="showTrelloList"
      [showMockupList]="showMockupList"
      [showPromptListView]="showPromptListView"
      (megaOutilSelect)="megaOutilSelect.emit($event)"
      (megaOutilCreated)="megaOutilCreated.emit($event)"
      (megaOutilDeleted)="megaOutilDeleted.emit($event)"
      (launchPromptConversation)="launchPromptConversation.emit($event)"
      (closeTrelloList)="closeTrelloList.emit()"
      (openTrelloList)="openTrelloList.emit()"
      (trelloNavigate)="trelloNavigate.emit($event)"
      (closeMockupList)="closeMockupList.emit()"
      (mockupNavigate)="mockupNavigate.emit($event)"
      (openMockupDiagram)="openMockupDiagram.emit()"
      (openPromptList)="openPromptList.emit()"
      (closePromptListView)="closePromptListView.emit()"
      (fileSave)="fileSave.emit($event)"
      (editSource)="editSource.emit($event)"
      (sectionsChange)="sectionsChange.emit($event)"
      (saveConflict)="saveConflict.emit($event)"
      (incomingChangeMerged)="incomingChangeMerged.emit($event)"
      (viewIncomingDiff)="viewIncomingDiff.emit($event)"
      (rejectIncomingChange)="rejectIncomingChange.emit($event)"
      (nodeActive)="nodeActive.emit($event)"
      (dragDrop)="dragDrop.emit($event)"
      (dirtyChange)="dirtyChange.emit($event)"
      (saveStarting)="saveStarting.emit()"
      (commentRequest)="commentRequest.emit($event)"
      (sendSelectionToPrompt)="sendSelectionToPrompt.emit($event)"
      (refresh)="refresh.emit()" />
  `,
  host: { class: 'flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden' }
})
export class EditionOutilComponent {
  @ViewChild(ProjetEditorZoneComponent) private innerZone?: ProjetEditorZoneComponent;

  @Input() files: FileNode[] = [];
  @Input() restoreToken = 0;
  @Input() scrollToNodeId: string | null = null;
  @Input() saveStatus: 'idle' | 'dirty' | 'saving' | 'saved' | 'error' = 'idle';
  @Input() projectName = '';
  @Input() activeNodeId: string | null = null;
  @Input() highlightNodeId: string | null = null;
  @Input() modeRequest: { mode: 'edit' | 'visu' | 'structure'; token: number } | null = null;
  @Input() backupType: string | null = null;
  @Input() ftpSyncGlobalStatus: 'idle' | 'syncing' | 'done' | 'error' = 'idle';
  @Input() ftpSyncProgress: { checked: number; total: number } = { checked: 0, total: 0 };
  @Input() nodeSyncStatus: Map<string, any> = new Map();
  @Input() hasFtpBackup = false;
  @Input() commentCounts: Record<string, number> = {};
  @Input() megaOutilInstances: MegaOutilInstance[] = [];
  @Input() activeMegaOutilId: string | null = null;
  @Input() activeOutilId: string | null = null;
  @Input() showTrelloList = false;
  @Input() showMockupList = false;
  @Input() showPromptListView = false;

  @Output() megaOutilSelect = new EventEmitter<MegaOutilInstance>();
  @Output() megaOutilCreated = new EventEmitter<MegaOutilInstance>();
  @Output() megaOutilDeleted = new EventEmitter<string>();
  @Output() launchPromptConversation = new EventEmitter<PromptLaunchContext>();
  @Output() closeTrelloList = new EventEmitter<void>();
  @Output() openTrelloList = new EventEmitter<void>();
  @Output() trelloNavigate = new EventEmitter<string>();
  @Output() closeMockupList = new EventEmitter<void>();
  @Output() mockupNavigate = new EventEmitter<string>();
  @Output() openMockupDiagram = new EventEmitter<void>();
  @Output() openPromptList = new EventEmitter<void>();
  @Output() closePromptListView = new EventEmitter<void>();
  @Output() fileSave = new EventEmitter<FileSaveEvent>();
  @Output() editSource = new EventEmitter<string>();
  @Output() sectionsChange = new EventEmitter<SectionInfo[]>();
  @Output() saveConflict = new EventEmitter<{
    fileId: string; folderId?: string; baseVersionId: string | null;
    mineContent: string; serverContent: string; serverAuthorName: string; serverCreatedAt: string;
  }>();
  @Output() incomingChangeMerged = new EventEmitter<{ fileId: string; content: string; versionId: string }>();
  @Output() viewIncomingDiff = new EventEmitter<string>();
  @Output() rejectIncomingChange = new EventEmitter<string>();
  @Output() nodeActive = new EventEmitter<string>();
  @Output() refresh = new EventEmitter<void>();
  @Output() dragDrop = new EventEmitter<DragDropEvent>();
  @Output() dirtyChange = new EventEmitter<boolean>();
  @Output() saveStarting = new EventEmitter<void>();
  @Output() commentRequest = new EventEmitter<{ folderId: string; folderName: string }>();
  @Output() sendSelectionToPrompt = new EventEmitter<{ text: string; sectionId: string | null; sourceInstanceId?: string }>();

  appendSection(folderName: string, level = 1): void {
    this.innerZone?.appendSection(folderName, level);
  }

  insertSectionInParent(parentName: string, parentDepth: number, sectionName: string): void {
    this.innerZone?.insertSectionInParent(parentName, parentDepth, sectionName);
  }

  flushContentModifications(filterSectionId?: string): void {
    this.innerZone?.flushContentModifications(filterSectionId);
  }

  changeHeadingLevel(folderId: string, delta: number): void {
    this.innerZone?.changeHeadingLevel(folderId, delta);
  }

  mergeTitleIntoPrevious(folderId: string): void {
    this.innerZone?.mergeTitleIntoPrevious(folderId);
  }

  applyExternalContent(entityId: string, newText: string): boolean {
    return this.innerZone?.applyExternalContent(entityId, newText) ?? false;
  }

  getEntityText(entityId: string): string | null {
    return this.innerZone?.getEntityText(entityId) ?? null;
  }

  /** Relayé depuis ProjetConversationComponent (conversation lancée par un MO Prompt) :
   *  matérialise les MegaOutils cochés et insère le livrable dans la section du Prompt.
   *  Retourne le folderId de la section résultat (ou null), pour la navigation "Déjà ajouté". */
  async materializeFromConversation(promptInstanceId: string, deliverable: string, selectedMos: MaterializedMoPreview[], transcript?: string): Promise<string | null> {
    return (await this.innerZone?.materializeFromConversation(promptInstanceId, deliverable, selectedMos, transcript)) ?? null;
  }

  /** Relayé depuis ProjetConversationComponent (message du chat IA "classique", hors conversation
   *  MO Prompt) : matérialise les MegaOutils cochés directement dans la section donnée. */
  async materializeMoIntoSection(sectionId: string, selectedMos: MaterializedMoPreview[]): Promise<void> {
    await this.innerZone?.materializeMoIntoSection(sectionId, selectedMos);
  }

  /** Relayé depuis ProjetConversationComponent : ouvre le popup d'import (pastePreview) pour
   *  coller le texte d'un message IA dans le document, ciblé sur la section donnée. */
  insertTextIntoEdition(text: string, sectionId: string): void {
    this.innerZone?.insertTextIntoEdition(text, sectionId);
  }

  /** Relayé depuis ProjetConversationComponent : "Copier ici" — insertion directe dans la
   *  section active, sans popup de prévisualisation (contrairement à insertTextIntoEdition). */
  insertTextDirectlyIntoSection(text: string, sectionId: string): void {
    this.innerZone?.insertTextDirectlyIntoSection(text, sectionId);
  }

  /** Relayé depuis ProjetConversationComponent : "Copier" — mémorise le texte pour un collage
   *  ultérieur (clic droit → Coller) n'importe où dans le document, Code ou Édition. */
  setClipboardText(text: string): void {
    this.innerZone?.setClipboardText(text);
  }

  /** Relayé depuis ProjetConversationComponent : "Remplacer" — remplace le texte original
   *  (envoyé via "Envoyer au prompt") par le résultat de l'IA, dans la section d'origine. */
  replaceTextInSection(sectionId: string, originalText: string, newText: string): boolean {
    return this.innerZone?.replaceTextInSection(sectionId, originalText, newText) ?? false;
  }

  /** Relayé depuis ProjetConversationComponent : "Copier" (par-MegaOutil) — mémorise le MO pour
   *  un collage au format designé (clic droit → Coller), pas en code brut. */
  setClipboardMo(mo: MaterializedMoPreview): void {
    this.innerZone?.setClipboardMo(mo);
  }

  /** Relayé depuis ProjetConversationComponent : "Remplacer" (par-MegaOutil) — met à jour
   *  l'instance d'origine si connue, sinon matérialise ce MO dans la section d'origine. */
  async replaceMoInSection(sourceInstanceId: string | undefined, sectionId: string, mo: MaterializedMoPreview): Promise<void> {
    await this.innerZone?.replaceMoInSection(sourceInstanceId, sectionId, mo);
  }
}
