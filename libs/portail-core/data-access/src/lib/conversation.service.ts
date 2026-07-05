import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_DATA_URL } from './tokens';
import { MaterializedMoPreview } from './mega-outils.models';

export interface PromptContext {
  sectionName: string;
  sectionContent: string;
  subSectionsContent: string | null;
  fullDocumentContent: string | null;
  globalInstruction: string | null;
  projectInstruction: string | null;
  userPrompt: string;
  model: string;
}

export interface Message {
  user: string;
  userId: string;
  text: string;
  timestamp: string;
  role?: 'user' | 'ai';
  tokenInfo?: { used: number; total: number; remaining: number };
  promptContext?: PromptContext;

  // ── Conversation lancée depuis un MO Prompt (mode Normal/Guidé/Tchat/Tchat libre) ──
  /** Instance de Prompt à l'origine de ce message (absent pour le chat général "Mode IA"). */
  promptInstanceId?: string;
  /** Snapshot du nom de l'instance au moment de l'envoi (survit à un renommage/suppression). */
  promptInstanceName?: string;
  /** Mode actif pour ce tour. */
  mode?: 'simple' | 'guided' | 'chat' | 'freechat';
  /** MegaOutils détectés dans ce message IA (fences TRELLO/ARRAY/FORM/CHART/AGENDA). */
  mos?: MaterializedMoPreview[];
  /** Mode Guidé uniquement : numéro de la vague de cadrage (1-based). */
  cadrageWave?: number;
  /** Mode Guidé uniquement : ce message IA doit être rendu comme un formulaire de cadrage, pas comme du texte. */
  isCadrageForm?: boolean;
}

export interface Conversation {
  sectionId: string;
  messages: Message[];
}

@Injectable({
  providedIn: 'root'
})
export class ConversationService {
  private http = inject(HttpClient);
  private baseUrl = inject(API_DATA_URL);
  private apiUrl = `${this.baseUrl}/api/conversations`;

  getHistory(sectionId: string): Observable<Conversation> {
    return this.http.get<Conversation>(`${this.apiUrl}/${sectionId}`);
  }

  getConversationsList(): Observable<string[]> {
    return this.http.get<string[]>(`${this.baseUrl}/api/conversations-list`);
  }

  sendMessage(sectionId: string, text: string): Observable<Message> {
    return this.http.post<Message>(`${this.apiUrl}/${sectionId}`, { text });
  }

  saveAiMessage(sectionId: string, text: string): Observable<Message> {
    return this.http.post<Message>(`${this.apiUrl}/${sectionId}`, { text, role: 'ai' });
  }

  /** Ajoute un message avec des champs additionnels (conversation lancée depuis un MO Prompt). */
  appendMessage(sectionId: string, partial: Partial<Message> & { text: string; role: 'user' | 'ai' }): Observable<Message> {
    return this.http.post<Message>(`${this.apiUrl}/${sectionId}`, partial);
  }
}
