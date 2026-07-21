import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_DATA_URL } from './tokens';
import { AuthService } from './auth.service';

export interface FileNode {
  id: string;
  type: 'file' | 'folder';
  name: string;
  path: string;
  order: number;
  fileType?: 'text' | 'image';
  content?: string;
  /** UUID de la dernière version BDD connue de ce fichier (source de vérité). */
  fileVersion?: string;
  children?: FileNode[];
}

export interface SaveConflict {
  error: 'conflict';
  message: string;
  base: { versionId: string | null } | null;
  server: { versionId: string; content: string; authorName: string; createdAt: string };
  mine: { content: string };
}

export interface ContentVersionMeta {
  version_id: string;
  author_id: string | null;
  author_name: string;
  origin: string;
  content_hash: string;
  base_version_id: string | null;
  merged_from_version_id: string | null;
  created_at: string;
}

export interface ContentVersionFull extends ContentVersionMeta {
  content: string;
}

export interface Outil {
  id: string;
  type: 'edition' | 'tests' | 'agenda';
  name: string;
  rootFolderIds: string[];
  createdAt: string;
}

export interface TrashEntry {
  trashId: string;
  nodeId: string;
  nodeType: 'file' | 'folder';
  name: string;
  originalPath: string;
  originalParentId: string | null;
  deletedById: string | null;
  deletedByName: string;
  deletedAt: string;
  purgeAt: string;
}

export interface ProjectFilesConfig {
  projectName: string;
  createdAt: string;
  updatedAt: string;
  gitRemoteUrl?: string | null;
  structure: FileNode[];
  outils?: Outil[];
}

export type EnsureLocalStatus = 'ready' | 'cloned' | 're-cloned' | 'no-remote' | 'ftp-pulled' | 'ftp-no-config' | 'ftp-error';
export interface EnsureLocalResult {
  status: EnsureLocalStatus;
  message?: string;
  gitRemoteUrl?: string;
  downloaded?: number;
  errors?: any[];
}

export type FtpNodeSyncStatus = 'unknown' | 'syncing' | 'in-sync' | 'updated' | 'error' | 'no-backup';

export interface EnsureFastResult {
  status: 'ready' | 'created-local';
  structure?: FileNode[];
}

@Injectable({ providedIn: 'root' })
export class ProjectFilesService {
  private apiUrl = inject(API_DATA_URL);
  constructor(private http: HttpClient, private auth: AuthService) {}

  private h() { return this.auth.getAuthHeaders(); }

  getProjects(): Promise<Array<{ name: string; projectName: string; gitRemoteUrl: string | null; localExists: boolean }>> {
    return firstValueFrom(this.http.get<any[]>(`${this.apiUrl}/api/file-projects`, { headers: this.h() }));
  }

  getConfig(name: string): Promise<ProjectFilesConfig> {
    return firstValueFrom(this.http.get<ProjectFilesConfig>(`${this.apiUrl}/api/file-projects/${name}`, { headers: this.h() }));
  }

  ensureLocal(name: string): Promise<EnsureLocalResult> {
    return firstValueFrom(this.http.post<EnsureLocalResult>(`${this.apiUrl}/api/file-projects/${name}/ensure-local`, {}, { headers: this.h() }));
  }

  ensureFast(name: string): Promise<EnsureFastResult> {
    return firstValueFrom(this.http.post<EnsureFastResult>(`${this.apiUrl}/api/file-projects/${name}/ensure-fast`, {}, { headers: this.h() }));
  }

  startFtpSyncBackground(name: string): Promise<{ started: boolean; reason?: string; totalFolders?: number }> {
    return firstValueFrom(this.http.post<any>(`${this.apiUrl}/api/file-projects/${name}/ftp-sync-background`, {}, { headers: this.h() }));
  }

  initialBackupPush(name: string): Promise<{ success: boolean; uploaded?: number; pushed?: boolean; errors?: any[]; error?: string }> {
    return firstValueFrom(this.http.post<any>(`${this.apiUrl}/api/file-projects/${name}/initial-backup-push`, {}, { headers: this.h() }));
  }

  getFiles(name: string): Promise<{ success: boolean; project: string; files: FileNode[] }> {
    return firstValueFrom(this.http.get<any>(`${this.apiUrl}/api/file-projects/${name}/files`, { headers: this.h() }));
  }

  createProject(projectName: string, folderName: string): Promise<any> {
    return firstValueFrom(this.http.post(`${this.apiUrl}/api/file-projects`, { projectName, folderName }, { headers: this.h() }));
  }

  deleteProject(name: string): Promise<any> {
    return firstValueFrom(this.http.delete(`${this.apiUrl}/api/file-projects/${name}`, { headers: this.h() }));
  }

  createFile(projectName: string, data: { name: string; parentId?: string; content?: string; outilSlug?: string }): Promise<FileNode> {
    return firstValueFrom(this.http.post<FileNode>(`${this.apiUrl}/api/file-projects/${projectName}/files`, data, { headers: this.h() }));
  }

  /**
   * @param baseVersionId dernier `fileVersion` connu côté client (UUID de version BDD) — permet
   *   au serveur de détecter un conflit réel si quelqu'un d'autre a checkpointé entre-temps.
   * @param checkpoint force la création d'une version BDD même si le throttle (45s) n'est pas écoulé
   *   (blur de section, changement de section, beforeunload, acceptation d'édition IA, publication).
   * @throws HttpErrorResponse avec status 409 et `error` typé `SaveConflict` en cas de conflit réel.
   */
  updateFile(projectName: string, fileId: string, content: string, folderId?: string, publish = false, source?: string, baseVersionId?: string, checkpoint = false): Promise<{ success: boolean; checkpointed: boolean; versionId?: string; commitHash?: string | null; ftpUploaded?: boolean | null }> {
    const headers: Record<string, string> = { ...this.h() };
    if (source) headers['x-edition-source'] = source;
    if (baseVersionId) headers['x-base-version-id'] = baseVersionId;
    return firstValueFrom(this.http.put<any>(`${this.apiUrl}/api/file-projects/${projectName}/files/${fileId}`, { content, folderId: folderId ?? null, publish, checkpoint }, { headers }));
  }

  /** Liste légère (sans contenu) des brouillons locaux de l'utilisateur courant sur ce projet. */
  listDrafts(projectName: string): Promise<Array<{ nodeId: string; folderId: string | null; updatedAt: string }>> {
    return firstValueFrom(this.http.get<any[]>(`${this.apiUrl}/api/file-projects/${projectName}/drafts`, { headers: this.h() }));
  }

  /** Brouillon local complet (contenu) de l'utilisateur courant pour ce fichier, s'il existe. */
  getDraft(projectName: string, fileId: string): Promise<{ exists: boolean; content?: string; folderId?: string | null; baseVersionId?: string | null; updatedAt?: string }> {
    return firstValueFrom(this.http.get<any>(`${this.apiUrl}/api/file-projects/${projectName}/files/${fileId}/draft`, { headers: this.h() }));
  }

  /** Écrit/écrase le brouillon local de l'utilisateur courant — jamais partagé tant que non validé.
   * Résilient aux coupures réseau brèves : retry avec backoff exponentiel (1s→2s→4s→8s→16s→30s,
   * ~1min de tentatives cumulées) avant d'abandonner et de remonter l'erreur à l'appelant. */
  saveDraft(projectName: string, fileId: string, content: string, folderId?: string | null, baseVersionId?: string | null): Promise<{ success: boolean }> {
    return this.saveDraftWithRetry(projectName, fileId, content, folderId, baseVersionId, 0);
  }

  private async saveDraftWithRetry(projectName: string, fileId: string, content: string, folderId: string | null | undefined, baseVersionId: string | null | undefined, attempt: number): Promise<{ success: boolean }> {
    const MAX_ATTEMPTS = 6;
    try {
      return await firstValueFrom(this.http.put<any>(`${this.apiUrl}/api/file-projects/${projectName}/files/${fileId}/draft`, { content, folderId: folderId ?? null, baseVersionId: baseVersionId ?? null }, { headers: this.h() }));
    } catch (e) {
      if (attempt >= MAX_ATTEMPTS) throw e;
      const delayMs = Math.min(1000 * Math.pow(2, attempt), 30000);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      return this.saveDraftWithRetry(projectName, fileId, content, folderId, baseVersionId, attempt + 1);
    }
  }

  /** Supprime le brouillon local (après validation réussie ou annulation explicite). */
  deleteDraft(projectName: string, fileId: string): Promise<{ success: boolean }> {
    return firstValueFrom(this.http.delete<any>(`${this.apiUrl}/api/file-projects/${projectName}/files/${fileId}/draft`, { headers: this.h() }));
  }

  getVersions(projectName: string, fileId: string, limit = 50, offset = 0): Promise<{ versions: ContentVersionMeta[] }> {
    return firstValueFrom(this.http.get<{ versions: ContentVersionMeta[] }>(`${this.apiUrl}/api/file-projects/${projectName}/files/${fileId}/versions`, { headers: this.h(), params: { limit, offset } }));
  }

  getVersionContent(projectName: string, fileId: string, versionId: string): Promise<ContentVersionFull> {
    return firstValueFrom(this.http.get<ContentVersionFull>(`${this.apiUrl}/api/file-projects/${projectName}/files/${fileId}/versions/${versionId}`, { headers: this.h() }));
  }

  restoreVersion(projectName: string, fileId: string, versionId: string, folderId?: string): Promise<{ success: boolean; versionId: string; content: string }> {
    return firstValueFrom(this.http.post<any>(`${this.apiUrl}/api/file-projects/${projectName}/files/${fileId}/restore`, { versionId, folderId: folderId ?? null }, { headers: this.h() }));
  }

  resolveConflict(projectName: string, fileId: string, data: { baseVersionId: string | null; folderId?: string; mineContent: string; mergedContent: string }): Promise<{ success: boolean; versionId: string; conflictMineVersionId: string }> {
    return firstValueFrom(this.http.post<any>(`${this.apiUrl}/api/file-projects/${projectName}/files/${fileId}/resolve-conflict`, { ...data, folderId: data.folderId ?? null }, { headers: this.h() }));
  }

  /** Enregistre un événement d'édition explicite côté client (sync reçu, undo, etc.). */
  logEditionEvent(event: { event: string; project: string; source: string; file?: string; fileId?: string; note?: string; size?: number; newSize?: number; oldLines?: number; newLines?: number }): void {
    this.http.post(`${this.apiUrl}/api/logs/edition`, event, { headers: this.h() }).subscribe({ error: () => {} });
  }

  renameFile(projectName: string, fileId: string, name: string): Promise<FileNode> {
    return firstValueFrom(this.http.patch<FileNode>(`${this.apiUrl}/api/file-projects/${projectName}/files/${fileId}`, { name }, { headers: this.h() }));
  }

  /** Déplace le fichier vers la corbeille (voir getTrash/restoreFromTrash) — jamais supprimé définitivement à ce stade. */
  deleteFile(projectName: string, fileId: string): Promise<{ success: boolean; trashId: string }> {
    return firstValueFrom(this.http.delete<{ success: boolean; trashId: string }>(`${this.apiUrl}/api/file-projects/${projectName}/files/${fileId}`, { headers: this.h() }));
  }

  createFolder(projectName: string, data: { name: string; parentId?: string; outilSlug?: string }): Promise<FileNode> {
    return firstValueFrom(this.http.post<FileNode>(`${this.apiUrl}/api/file-projects/${projectName}/folders`, data, { headers: this.h() }));
  }

  renameFolder(projectName: string, folderId: string, name: string): Promise<FileNode> {
    return firstValueFrom(this.http.patch<FileNode>(`${this.apiUrl}/api/file-projects/${projectName}/folders/${folderId}`, { name }, { headers: this.h() }));
  }

  /** Déplace le dossier (et son contenu) vers la corbeille — jamais supprimé définitivement à ce stade. */
  deleteFolder(projectName: string, folderId: string): Promise<{ success: boolean; trashId: string }> {
    return firstValueFrom(this.http.delete<{ success: boolean; trashId: string }>(`${this.apiUrl}/api/file-projects/${projectName}/folders/${folderId}`, { headers: this.h() }));
  }

  /** Liste des entrées de corbeille encore actives (ni restaurées, ni purgées) pour ce projet. */
  getTrash(projectName: string): Promise<TrashEntry[]> {
    return firstValueFrom(this.http.get<TrashEntry[]>(`${this.apiUrl}/api/file-projects/${projectName}/trash`, { headers: this.h() }));
  }

  /** Restaure un fichier/dossier depuis la corbeille à son emplacement d'origine. */
  restoreFromTrash(projectName: string, trashId: string): Promise<{ success: boolean; node: FileNode; warning?: string | null }> {
    return firstValueFrom(this.http.post<any>(`${this.apiUrl}/api/file-projects/${projectName}/trash/${trashId}/restore`, {}, { headers: this.h() }));
  }

  /** Purge définitive volontaire d'une entrée de corbeille (avant l'échéance de rétention). */
  purgeTrashEntry(projectName: string, trashId: string): Promise<{ success: boolean }> {
    return firstValueFrom(this.http.delete<any>(`${this.apiUrl}/api/file-projects/${projectName}/trash/${trashId}`, { headers: this.h() }));
  }

  updateStructure(projectName: string, structure: FileNode[]): Promise<any> {
    return firstValueFrom(this.http.put(`${this.apiUrl}/api/file-projects/${projectName}/structure`, { structure }, { headers: this.h() }));
  }

  moveFile(projectName: string, fileId: string, targetFolderId: string | null): Promise<any> {
    return firstValueFrom(this.http.post(`${this.apiUrl}/api/file-projects/${projectName}/move-file`, { fileId, targetFolderId }, { headers: this.h() }));
  }

  moveFolder(projectName: string, folderId: string, targetParentId: string | null): Promise<any> {
    return firstValueFrom(this.http.post(`${this.apiUrl}/api/file-projects/${projectName}/move-folder`, { folderId, targetParentId }, { headers: this.h() }));
  }

  uploadImage(projectName: string, file: File, parentId: string | null): Promise<FileNode> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        try {
          const node = await firstValueFrom(this.http.post<FileNode>(
            `${this.apiUrl}/api/file-projects/${projectName}/upload-image`,
            { name: file.name, parentId, data: base64, mimeType: file.type },
            { headers: this.h() }
          ));
          resolve(node);
        } catch (e) { reject(e); }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  getImageUrl(projectName: string, imagePath: string): string {
    return `${this.apiUrl}/data/projets/${projectName}/${imagePath}`;
  }

  isImageFile(name: string): boolean {
    return /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(name);
  }

  flattenFiles(nodes: FileNode[], depth = 0): FileNode[] {
    const result: FileNode[] = [];
    for (const node of nodes) {
      if (node.type === 'file') {
        result.push({ ...node, order: depth });
      } else if (node.children) {
        result.push(...this.flattenFiles(node.children, depth + 1));
      }
    }
    return result;
  }

  autoSync(name: string): Promise<{ success: boolean; status: string; ahead?: number; behind?: number; newCommits?: number; changedFiles?: string[] }> {
    return firstValueFrom(this.http.post<any>(`${this.apiUrl}/api/file-projects/${name}/auto-sync`, {}, { headers: this.h() }));
  }

  ftpSync(name: string): Promise<{ success: boolean; status: string; uploaded: number; errors: any[] }> {
    return firstValueFrom(this.http.post<any>(`${this.apiUrl}/api/file-projects/${name}/ftp-sync`, {}, { headers: this.h() }));
  }

  getGithubReachable(): Promise<{ reachable: boolean; reason?: string }> {
    return firstValueFrom(this.http.get<any>(`${this.apiUrl}/api/github/reachable`, { headers: this.h() }));
  }

  /** Ouvre le dossier local d'une section (ou la racine si folderId absent) dans l'explorateur OS. */
  openFolder(name: string, folderId: string | null = null): Promise<{ success: boolean; path?: string; error?: string }> {
    return firstValueFrom(this.http.post<any>(`${this.apiUrl}/api/file-projects/${name}/open-folder`, { folderId }, { headers: this.h() }));
  }

  getOutils(name: string): Promise<{ outils: Outil[] }> {
    return firstValueFrom(this.http.get<any>(`${this.apiUrl}/api/file-projects/${name}/outils`, { headers: this.h() }));
  }

  createOutil(name: string, data: { type: string; name: string; rootFolderIds: string[] }): Promise<Outil> {
    return firstValueFrom(this.http.post<Outil>(`${this.apiUrl}/api/file-projects/${name}/outils`, data, { headers: this.h() }));
  }

  updateOutil(projectName: string, outilId: string, data: Partial<Pick<Outil, 'name' | 'rootFolderIds'>>): Promise<Outil> {
    return firstValueFrom(this.http.patch<Outil>(`${this.apiUrl}/api/file-projects/${projectName}/outils/${outilId}`, data, { headers: this.h() }));
  }

  deleteOutil(projectName: string, outilId: string): Promise<any> {
    return firstValueFrom(this.http.delete(`${this.apiUrl}/api/file-projects/${projectName}/outils/${outilId}`, { headers: this.h() }));
  }
}

/** Aplatit l'arborescence de sections (dossiers uniquement) en liste plate {id, name, depth} —
 *  calculée côté client à partir d'un `files` déjà chargé (pas de nouvel appel serveur). Utilisée
 *  par le sélecteur "Copier vers..." de la conversation IA. */
export function flattenFolders(nodes: FileNode[], depth = 0): { id: string; name: string; depth: number }[] {
  const result: { id: string; name: string; depth: number }[] = [];
  for (const node of nodes) {
    if (node.type !== 'folder') continue;
    result.push({ id: node.id, name: node.name, depth });
    if (node.children?.length) result.push(...flattenFolders(node.children, depth + 1));
  }
  return result;
}
