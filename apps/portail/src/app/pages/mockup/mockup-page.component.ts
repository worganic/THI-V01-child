import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  MegaOutilsService, MegaOutilInstance,
  MockupElement, MockupConnection, MockupDiagramPosition,
  MOCKUP_ELEMENT_LABELS
} from '@portail/core-data-access';
import { MockupBoardComponent, WorgMiniHeaderComponent } from '@portail/shared-ui';

interface MockupItem {
  instance: MegaOutilInstance;
  elements: MockupElement[];
  projectName: string;
  folderName: string | null;
  outilName: string | null;
  expanded: boolean;
}

interface DiagramNode {
  instanceId: string;
  name: string;
  projectName: string;
  elementCount: number;
  x: number;
  y: number;
}

interface DiagramDragState {
  nodeId: string;
  startMX: number; startMY: number;
  startX: number; startY: number;
}

const NODE_W = 180;
const NODE_H = 90;
const DIAG_W = 1600;
const DIAG_H = 1000;

/** Regroupe les mockups par projet pour affichage */
interface ProjectGroup {
  projectId: string;
  projectName: string;
  items: MockupItem[];
}

@Component({
  selector: 'app-mockup-page',
  standalone: true,
  imports: [CommonModule, FormsModule, MockupBoardComponent, WorgMiniHeaderComponent],
  template: `
    <div class="flex flex-col h-full overflow-hidden">
      <worg-mini-header title="Mockup — Vue globale" backUrl="/home" backLabel="Accueil" />

      <div class="flex-1 flex flex-col overflow-hidden">

        <!-- Tabs -->
        <div class="flex items-center gap-0 border-b border-light-border dark:border-white/8 px-6 pt-3 flex-shrink-0 bg-light-background dark:bg-background">
          <button class="text-sm px-4 py-2 border-b-2 transition-colors -mb-px"
                  [class.border-violet-500]="activeTab() === 'list'"
                  [class.text-light-text]="activeTab() === 'list'"
                  [class.dark:text-white]="activeTab() === 'list'"
                  [class.border-transparent]="activeTab() !== 'list'"
                  [class.text-light-text-muted]="activeTab() !== 'list'"
                  [class.dark:text-white]="activeTab() !== 'list'"
                  [class.dark:text-opacity-40]="activeTab() !== 'list'"
                  (click)="activeTab.set('list')">
            <span class="material-symbols-outlined text-base align-text-bottom mr-1">grid_view</span>
            Liste ({{ allItems().length }})
          </button>
          <button class="text-sm px-4 py-2 border-b-2 transition-colors -mb-px"
                  [class.border-violet-500]="activeTab() === 'diagram'"
                  [class.text-light-text]="activeTab() === 'diagram'"
                  [class.dark:text-white]="activeTab() === 'diagram'"
                  [class.border-transparent]="activeTab() !== 'diagram'"
                  [class.text-light-text-muted]="activeTab() !== 'diagram'"
                  [class.dark:text-white]="activeTab() !== 'diagram'"
                  [class.dark:text-opacity-40]="activeTab() !== 'diagram'"
                  (click)="switchToDiagram()">
            <span class="material-symbols-outlined text-base align-text-bottom mr-1">account_tree</span>
            Diagramme
          </button>
        </div>

        <!-- ── Onglet Liste ─────────────────────────────────────────────────── -->
        @if (activeTab() === 'list') {
          <div class="flex-1 overflow-y-auto p-6">
            @if (loading()) {
              <div class="flex items-center gap-2 text-white/40">
                <span class="material-symbols-outlined text-base animate-spin">sync</span>Chargement…
              </div>
            } @else if (!allItems().length) {
              <p class="text-white/40 text-sm">Aucun mockup. Créez-en un depuis un projet.</p>
            } @else {
              <div class="flex flex-col gap-6">
                @for (group of projectGroups(); track group.projectId) {
                  <div>
                    <h2 class="text-sm font-semibold text-white/60 mb-3 flex items-center gap-2">
                      <span class="material-symbols-outlined text-base text-violet-400">folder_special</span>
                      {{ group.projectName }}
                      <span class="text-xs text-white/30">({{ group.items.length }})</span>
                    </h2>
                    <div class="flex flex-col gap-3">
                      @for (item of group.items; track item.instance.id; let i = $index) {
                        <div class="rounded-xl border border-white/10 bg-surface overflow-hidden">
                          <div class="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.03] transition-colors"
                               (click)="toggleItem(item)">
                            <button class="w-4 h-4 flex-shrink-0 text-white/30 transition-transform"
                                    [class.rotate-90]="item.expanded">
                              <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 2l4 4-4 4"/></svg>
                            </button>
                            <span class="material-symbols-outlined text-violet-400 text-base">design_services</span>
                            <div class="flex-1 min-w-0">
                              <span class="text-sm font-semibold text-white/90">{{ item.instance.name }}</span>
                              @if (item.folderName) {
                                <span class="ml-2 text-[11px] px-1.5 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400">{{ item.folderName }}</span>
                              }
                            </div>
                            <!-- Preview miniature -->
                            <div class="flex-shrink-0">
                              <svg width="80" height="50" style="background:rgba(255,255,255,0.03); border-radius:4px; border:1px solid rgba(255,255,255,0.08)">
                                @for (el of item.elements.slice(0, 8); track el.id) {
                                  <rect [attr.x]="el.x * 80 / 1200" [attr.y]="el.y * 50 / 900"
                                        [attr.width]="Math.max(4, el.width * 80 / 1200)"
                                        [attr.height]="Math.max(2, el.height * 50 / 900)"
                                        rx="1" fill="rgba(139,92,246,0.5)" />
                                }
                              </svg>
                            </div>
                            <span class="text-xs text-white/30 bg-background rounded-full px-2 py-0.5">
                              {{ item.elements.length }} élément{{ item.elements.length > 1 ? 's' : '' }}
                            </span>
                          </div>
                          @if (item.expanded) {
                            <div class="border-t border-white/10" style="height: 560px">
                              <app-mockup-board
                                [instanceId]="item.instance.id"
                                [boardName]="item.instance.name"
                                [sectionName]="item.folderName || ''"
                                [deletable]="false" />
                            </div>
                          }
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        }

        <!-- ── Onglet Diagramme ────────────────────────────────────────────── -->
        @if (activeTab() === 'diagram') {
          <div class="flex-1 flex flex-col overflow-hidden">

            <!-- Barre outils diagramme -->
            <div class="flex items-center gap-3 px-4 py-2 border-b border-white/8 bg-surface flex-shrink-0">
              <span class="text-xs text-white/40">
                {{ allItems().length }} mockup{{ allItems().length > 1 ? 's' : '' }}
                • {{ connections().length }} connexion{{ connections().length > 1 ? 's' : '' }}
              </span>
              <span class="flex-1"></span>
              @if (connectMode()) {
                <span class="text-xs text-amber-400 flex items-center gap-1">
                  <span class="material-symbols-outlined text-sm">arrow_right_alt</span>
                  {{ connectSource() ? 'Cliquez sur la destination' : 'Cliquez sur la source' }}
                </span>
                <button class="text-xs px-3 py-1 rounded border border-white/20 text-white/40 hover:text-white/70"
                        (click)="cancelConnect()">Annuler</button>
              } @else {
                <button class="text-xs px-3 py-1.5 rounded-lg border border-violet-500/30 text-violet-400 hover:bg-violet-500/10 transition-colors flex items-center gap-1"
                        (click)="startConnect()">
                  <span class="material-symbols-outlined text-sm">add_link</span> Connexion
                </button>
              }
              <button class="text-xs px-3 py-1.5 rounded-lg border border-white/20 text-white/50 hover:text-white transition-colors flex items-center gap-1"
                      (click)="savePositions()">
                <span class="material-symbols-outlined text-sm">save</span> Sauvegarder
              </button>
            </div>

            <!-- Canvas SVG -->
            <div class="flex-1 overflow-auto">
              <svg [attr.width]="diagW" [attr.height]="diagH"
                   class="block select-none"
                   style="background: repeating-linear-gradient(0deg,transparent,transparent 39px,rgba(255,255,255,.03) 39px,rgba(255,255,255,.03) 40px),repeating-linear-gradient(90deg,transparent,transparent 39px,rgba(255,255,255,.03) 39px,rgba(255,255,255,.03) 40px)"
                   (mousemove)="onDiagMouseMove($event)"
                   (mouseup)="onDiagMouseUp()"
                   (mouseleave)="onDiagMouseUp()">

                <!-- Marqueur flèche -->
                <defs>
                  <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#8b5cf6" />
                  </marker>
                  <marker id="arrowhead-hover" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#a78bfa" />
                  </marker>
                </defs>

                <!-- Connexions -->
                @for (conn of connections(); track conn.id) {
                  @let from = nodeForInstance(conn.fromInstanceId);
                  @let to = nodeForInstance(conn.toInstanceId);
                  @if (from && to) {
                    @let x1 = from.x + nodeW;
                    @let y1 = from.y + nodeH / 2;
                    @let x2 = to.x;
                    @let y2 = to.y + nodeH / 2;
                    @let mx = (x1 + x2) / 2;
                    <path [attr.d]="'M ' + x1 + ' ' + y1 + ' C ' + mx + ' ' + y1 + ' ' + mx + ' ' + y2 + ' ' + x2 + ' ' + y2"
                          fill="none" stroke="#8b5cf6" stroke-width="2" marker-end="url(#arrowhead)"
                          class="cursor-pointer hover:stroke-violet-300"
                          (click)="promptDeleteConnection(conn)" />
                    @if (conn.label) {
                      <text [attr.x]="mx" [attr.y]="(y1 + y2) / 2 - 6"
                            text-anchor="middle" fill="#a78bfa" font-size="11" font-family="sans-serif">{{ conn.label }}</text>
                    }
                  }
                }

                <!-- Nœuds -->
                @for (node of diagramNodes(); track node.instanceId) {
                  <g [attr.transform]="'translate(' + node.x + ',' + node.y + ')'"
                     [class.cursor-move]="!connectMode()"
                     [class.cursor-pointer]="connectMode()"
                     (mousedown)="onNodeMouseDown($event, node)">
                    <!-- Fond nœud -->
                    <rect [attr.width]="nodeW" [attr.height]="nodeH" rx="10"
                          [attr.fill]="connectSource() === node.instanceId ? '#4c1d95' : '#1e1b4b'"
                          [attr.stroke]="connectSource() === node.instanceId ? '#a78bfa' : '#6d28d9'"
                          stroke-width="1.5" />
                    <!-- Icône -->
                    <text x="14" y="24" fill="#a78bfa" font-size="16" font-family="Material Symbols Outlined">design_services</text>
                    <!-- Nom -->
                    <text x="36" y="22" fill="#e9d5ff" font-size="13" font-weight="600" font-family="sans-serif">{{ node.name.slice(0, 18) }}{{ node.name.length > 18 ? '…' : '' }}</text>
                    <!-- Projet -->
                    <text x="14" y="42" fill="#7c3aed" font-size="11" font-family="sans-serif">{{ node.projectName.slice(0, 24) }}</text>
                    <!-- Séparateur -->
                    <line x1="14" [attr.y1]="nodeH - 30" [attr.x2]="nodeW - 14" [attr.y2]="nodeH - 30" stroke="#4c1d95" stroke-width="1" />
                    <!-- Nb éléments -->
                    <text x="14" [attr.y]="nodeH - 14" fill="#8b5cf6" font-size="11" font-family="sans-serif">
                      {{ node.elementCount }} élément{{ node.elementCount > 1 ? 's' : '' }}
                    </text>
                  </g>
                }

              </svg>
            </div>

          </div>
        }

        <!-- Dialog label connexion -->
        @if (connLabelDialog()) {
          <div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"
               (click)="connLabelDialog.set(false)">
            <div class="bg-background border border-white/10 rounded-xl p-6 w-80 shadow-2xl"
                 (click)="$event.stopPropagation()">
              <p class="text-sm text-white/80 mb-3">Label de la connexion (optionnel)</p>
              <input class="w-full text-sm bg-white/[0.05] border border-white/10 rounded px-3 py-2 text-white/80 focus:outline-none focus:border-violet-500/50 mb-3"
                     placeholder="ex: page connectée, flow inscription..."
                     [(ngModel)]="pendingConnLabel"
                     (keydown.enter)="confirmConnLabel()" />
              <div class="flex gap-2">
                <button class="flex-1 text-sm py-2 rounded-lg bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 transition-colors"
                        (click)="confirmConnLabel()">Créer</button>
                <button class="flex-1 text-sm py-2 rounded-lg border border-white/20 text-white/40 hover:text-white/70 transition-colors"
                        (click)="connLabelDialog.set(false)">Annuler</button>
              </div>
            </div>
          </div>
        }

      </div>
    </div>
  `
})
export class MockupPageComponent implements OnInit {
  private svc = inject(MegaOutilsService);

  readonly nodeW = NODE_W;
  readonly nodeH = NODE_H;
  readonly diagW = DIAG_W;
  readonly diagH = DIAG_H;
  readonly Math = Math;

  activeTab = signal<'list' | 'diagram'>('list');
  loading = signal(true);
  allItems = signal<MockupItem[]>([]);
  connections = signal<MockupConnection[]>([]);
  diagramNodes = signal<DiagramNode[]>([]);

  // État connexion
  connectMode = signal(false);
  connectSource = signal<string | null>(null);
  connLabelDialog = signal(false);
  pendingConnLabel = '';
  private pendingConnTarget: string | null = null;

  // Drag nœud diagramme
  private diagDrag: DiagramDragState | null = null;

  projectGroups = signal<ProjectGroup[]>([]);

  private currentProjectId: string | null = null;

  async ngOnInit() { await this.loadList(); }

  private async loadList() {
    this.loading.set(true);
    try {
      const raw = await this.svc.getAllMockups();
      const items: MockupItem[] = raw.map(r => ({
        instance: r.instance, elements: r.elements,
        projectName: r.projectName, folderName: r.folderName,
        outilName: r.outilName, expanded: false
      }));
      this.allItems.set(items);
      this.buildGroups(items);
    } finally { this.loading.set(false); }
  }

  private buildGroups(items: MockupItem[]) {
    const map = new Map<string, ProjectGroup>();
    for (const item of items) {
      const pid = item.instance.projectId;
      if (!map.has(pid)) map.set(pid, { projectId: pid, projectName: item.projectName, items: [] });
      map.get(pid)!.items.push(item);
    }
    this.projectGroups.set([...map.values()]);
  }

  toggleItem(item: MockupItem) { item.expanded = !item.expanded; }

  async switchToDiagram() {
    this.activeTab.set('diagram');
    await this.loadDiagram();
  }

  private async loadDiagram() {
    const items = this.allItems();
    if (!items.length) return;
    // Utilise le premier projet trouvé (ou charge par projet si l'UI permet de filtrer)
    const projectIds = [...new Set(items.map(i => i.instance.projectId))];
    this.currentProjectId = projectIds[0];

    const { connections, positions } = await this.svc.getMockupDiagram(this.currentProjectId);
    this.connections.set(connections);

    // Construire les nœuds avec positions sauvegardées ou auto-layout
    const nodes: DiagramNode[] = items.map((item, idx) => {
      const saved = positions.find(p => p.instanceId === item.instance.id);
      return {
        instanceId: item.instance.id,
        name: item.instance.name,
        projectName: item.projectName,
        elementCount: item.elements.length,
        x: saved ? saved.x : 40 + (idx % 4) * (NODE_W + 60),
        y: saved ? saved.y : 40 + Math.floor(idx / 4) * (NODE_H + 60)
      };
    });
    this.diagramNodes.set(nodes);
  }

  nodeForInstance(instanceId: string): DiagramNode | undefined {
    return this.diagramNodes().find(n => n.instanceId === instanceId);
  }

  // ── Drag nœuds ───────────────────────────────────────────────────────────────

  onNodeMouseDown(event: MouseEvent, node: DiagramNode) {
    if (this.connectMode()) {
      this.onNodeConnectClick(node.instanceId);
      return;
    }
    event.stopPropagation();
    this.diagDrag = {
      nodeId: node.instanceId,
      startMX: event.clientX, startMY: event.clientY,
      startX: node.x, startY: node.y
    };
  }

  onDiagMouseMove(event: MouseEvent) {
    if (!this.diagDrag) return;
    const dx = event.clientX - this.diagDrag.startMX;
    const dy = event.clientY - this.diagDrag.startMY;
    this.diagramNodes.update(nodes => nodes.map(n => {
      if (n.instanceId !== this.diagDrag!.nodeId) return n;
      return { ...n, x: Math.max(0, this.diagDrag!.startX + dx), y: Math.max(0, this.diagDrag!.startY + dy) };
    }));
  }

  onDiagMouseUp() { this.diagDrag = null; }

  async savePositions() {
    if (!this.currentProjectId) return;
    const positions = this.diagramNodes().map(n => ({ instanceId: n.instanceId, x: n.x, y: n.y }));
    await this.svc.updateMockupDiagramPositions(this.currentProjectId, positions);
  }

  // ── Connexions ────────────────────────────────────────────────────────────────

  startConnect() { this.connectMode.set(true); this.connectSource.set(null); }
  cancelConnect() { this.connectMode.set(false); this.connectSource.set(null); }

  onNodeConnectClick(instanceId: string) {
    if (!this.connectSource()) {
      this.connectSource.set(instanceId);
    } else {
      this.pendingConnTarget = instanceId;
      this.pendingConnLabel = '';
      this.connLabelDialog.set(true);
    }
  }

  async confirmConnLabel() {
    const from = this.connectSource();
    const to = this.pendingConnTarget;
    if (!from || !to || !this.currentProjectId) { this.connLabelDialog.set(false); return; }
    const conn = await this.svc.createMockupConnection(this.currentProjectId, {
      fromInstanceId: from, toInstanceId: to, label: this.pendingConnLabel
    });
    this.connections.update(list => [...list, conn]);
    this.connectMode.set(false);
    this.connectSource.set(null);
    this.connLabelDialog.set(false);
  }

  async promptDeleteConnection(conn: MockupConnection) {
    if (!this.currentProjectId) return;
    if (!confirm(`Supprimer la connexion${conn.label ? ' "' + conn.label + '"' : ''} ?`)) return;
    await this.svc.deleteMockupConnection(this.currentProjectId, conn.id);
    this.connections.update(list => list.filter(c => c.id !== conn.id));
  }
}
