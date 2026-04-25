import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

const API_URL = environment.apiDataUrl;

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient) {}

  // --- Config Keys ---
  getConfigKeys(): Observable<any> {
    return this.http.get(`${API_URL}/api/config/keys`);
  }

  saveConfigKeys(data: any): Observable<any> {
    return this.http.post(`${API_URL}/api/config/keys`, data);
  }

  // --- File Operations ---
  readFile(file: string): Observable<{ content: string }> {
    return this.http.get<{ content: string }>(`${API_URL}/read-file`, { params: { file } });
  }

  // --- AI Logs ---
  getAiLogs(): Observable<any[]> {
    return this.http.get<any[]>(`${API_URL}/api/ai-logs`);
  }

  clearAiLogs(): Observable<any> {
    return this.http.delete(`${API_URL}/api/ai-logs`);
  }

  // --- History ---
  getHistory(): Observable<any[]> {
    return this.http.get<any[]>(`${API_URL}/api/history`);
  }

  // --- Tickets ---
  getTickets(): Observable<any[]> {
    return this.http.get<any[]>(`${API_URL}/api/tickets`);
  }

  createTicket(data: any): Observable<any> {
    return this.http.post(`${API_URL}/api/tickets`, data);
  }

  updateTicket(id: string, data: any): Observable<any> {
    return this.http.put(`${API_URL}/api/tickets/${id}`, data);
  }

  deleteTicket(id: string): Observable<any> {
    return this.http.delete(`${API_URL}/api/tickets/${id}`);
  }

  // --- Screenshots ---
  uploadScreenshot(formData: FormData): Observable<{ filename: string }> {
    return this.http.post<{ filename: string }>(`${API_URL}/api/tickets/screenshot`, formData);
  }

  // --- AI Model (executor local) ---
  changeModel(provider: string, model: string): Observable<any> {
    return this.http.post(`${environment.apiExecutorUrl}/change-model`, { provider, model });
  }

  getModel(): Observable<any> {
    return this.http.get(`${environment.apiExecutorUrl}/get-model`);
  }

  syncModel(): Observable<any> {
    return this.http.get(`${environment.apiExecutorUrl}/sync-model`);
  }

  // --- Stop Execution ---
  stopExecution(stepId: string): Observable<any> {
    return this.http.post(`${environment.apiExecutorUrl}/stop-execution`, { stepId });
  }

  // --- Health Check ---
  checkDbHealth(): Observable<{ status: string }> {
    return this.http.get<{ status: string }>(`${API_URL}/api/health/db`);
  }
}
