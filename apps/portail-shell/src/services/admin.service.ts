import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { AppUser, Application, UserApplication, Groupe, GroupeApplication, UserGroupe, Metier } from '../models/admin.models';
import { environmentGlobal } from '../../environmentGlobal/environmentGlobal';

@Injectable({
    providedIn: 'root'
})
export class AdminService {
    private readonly http = inject(HttpClient);
    private baseUrl = environmentGlobal.serviceVal;

    private getHeaders(): HttpHeaders {
        return new HttpHeaders({
            'Content-Type': 'application/json',
            'IDUSER': environmentGlobal.IDUSER || 'VALEUR_PAR_DEFAUT',
            'IDAPPEL': environmentGlobal.IDAPPEL || 'VALEUR_PAR_DEFAUT',
            'IDTRANSACTION': environmentGlobal.IDTRANSACTION || 'VALEUR_PAR_DEFAUT'
        });
    }

    // ==========================================
    // UTILISATEURS
    // ==========================================
    getUsers(): Observable<AppUser[]> {
        return this.http.get<any>(this.baseUrl + environmentGlobal.serviceUsers, { headers: this.getHeaders() }).pipe(
            map(response => {
                const data = response?.data ? response.data : (Array.isArray(response) ? response : []);
                if (Array.isArray(data)) {
                    return data.map((userAPI: any) => ({
                        id: String(userAPI.id ?? userAPI.ID), 
                        matricule: userAPI.matricule || userAPI.MATRICULE, 
                        nom: userAPI.nom || userAPI.NOM,
                        prenom: userAPI.prenom || userAPI.PRENOM, 
                        email: userAPI.email || userAPI.EMAIL, 
                        role: userAPI.role || userAPI.ROLE,
                        is_active: userAPI.is_active === 1 || userAPI.is_active === "1" || userAPI.is_active === true || userAPI.IS_ACTIVE === 1 || userAPI.IS_ACTIVE === true,
                        metier_id: (userAPI.metier_id ?? userAPI.METIER_ID) != null ? Number(userAPI.metier_id ?? userAPI.METIER_ID) : null
                    } as AppUser));
                }
                return [];
            }),
            catchError(err => { console.error('Erreur API getUsers', err); return of([]); })
        );
    }

    insertUser(user: Partial<AppUser>): Observable<AppUser> {
        return this.http.post<AppUser>(this.baseUrl + environmentGlobal.serviceUsersInsert, user, { headers: this.getHeaders() });
    }

    updateUser(user: AppUser): Observable<AppUser> {
        return this.http.post<AppUser>(this.baseUrl + environmentGlobal.serviceUsersUpdate, user, { headers: this.getHeaders() });
    }

    deleteUser(user_id: string): Observable<void> {
        return this.http.delete<void>(`${this.baseUrl}${environmentGlobal.serviceUsersDelete}${user_id}`, { headers: this.getHeaders() });
    }

    getUserByMatricule(matricule: string): Observable<AppUser | null> {
        console.log('getUserByMatricule / url ' + `${this.baseUrl}${environmentGlobal.serviceUsersMatricule}${matricule}`);
        return this.http.get<any>(`${this.baseUrl}${environmentGlobal.serviceUsersMatricule}${matricule}`, { headers: this.getHeaders() })
            .pipe(
                map(response => {
                    const data = response?.data ? response.data : response;
                    console.log("data : ", data);
                    const user = Array.isArray(data) ? data[0] : data;
                    
                    if (!user) return null;

                    return {
                        id: String(user.id ?? user.ID),
                        matricule: user.matricule || user.MATRICULE,
                        nom: user.nom || user.NOM,
                        prenom: user.prenom || user.PRENOM,
                        email: user.email || user.EMAIL,
                        role: user.role || user.ROLE,
                        is_active: user.is_active === 1 || user.is_active === "1" || user.is_active === true || user.IS_ACTIVE === 1 || user.IS_ACTIVE === true,
                        metier_id: (user.metier_id ?? user.METIER_ID) != null ? Number(user.metier_id ?? user.METIER_ID) : null
                    } as AppUser;
                }),
                catchError(err => { console.error('Erreur getUserByMatricule', err); return of(null); })
            );
    }

    // ==========================================
    // APPLICATIONS
    // ==========================================
    getApplications(): Observable<Application[]> {
        return this.http.get<any>(this.baseUrl + environmentGlobal.serviceApplications, { headers: this.getHeaders() }).pipe(
            map(response => {
                // MAPPAGE ROBUSTE
                const data = response?.data ? response.data : (Array.isArray(response) ? response : []);
                return data.map((item: any) => ({
                    id: Number(item.id || item.ID),
                    nom: item.nom || item.NOM,
                    description: item.description || item.DESCRIPTION,
                    url_path: item.url_path || item.URL_PATH,
                    icone: item.icone || item.ICONE,
                    is_active: item.is_active === 1 || item.is_active === "1" || item.is_active === true || item.IS_ACTIVE === 1 || item.IS_ACTIVE === true
                } as Application));
            }),
            catchError(err => { console.error('Erreur', err); return of([]); })
        );
    }

    /**
     * Dossiers `apps/appli-*` (contribuant seulement un onglet admin, pas de route
     * utilisateur montée) pas encore présents au catalogue — voir
     * docs/architecture-sous-applications.md. Route absente côté API réelle
     * Airbus (seul le mock local `npm run start:mock` l'implémente) : l'erreur
     * est avalée, la section correspondante reste simplement vide.
     */
    getAvailableApps(): Observable<Partial<Application>[]> {
        return this.http.get<any>(this.baseUrl + environmentGlobal.serviceApplicationsAvailable, { headers: this.getHeaders() }).pipe(
            map(response => {
                const data = response?.data ? response.data : (Array.isArray(response) ? response : []);
                return data.map((item: any) => ({
                    nom: item.nom || item.NOM,
                    description: item.description || item.DESCRIPTION || '',
                    url_path: item.url_path || item.URL_PATH || '',
                    icone: item.icone || item.ICONE || 'apps'
                } as Partial<Application>));
            }),
            catchError(err => { console.error('Erreur', err); return of([]); })
        );
    }

    insertApplication(app: Omit<Application, 'id'>): Observable<Application> {
        return this.http.post<Application>(this.baseUrl + environmentGlobal.serviceApplicationsInsert, app, { headers: this.getHeaders() });
    }

    updateApplication(app: Application): Observable<Application> {
        return this.http.post<Application>(this.baseUrl + environmentGlobal.serviceApplicationsUpdate, app, { headers: this.getHeaders() });
    }

    deleteApplication(appId: number): Observable<void> {
        return this.http.delete<void>(`${this.baseUrl}${environmentGlobal.serviceApplicationsDelete}${appId}`, { headers: this.getHeaders() });
    }

    // ==========================================
    // AFFECTATIONS CLASSIQUES (USER_APPLICATIONS)
    // ==========================================
    getAllUserApplications(): Observable<UserApplication[]> {
        return this.http.get<any>(this.baseUrl + environmentGlobal.serviceUserApplications, { headers: this.getHeaders() }).pipe(
            map(response => {
                const data = response?.data ? response.data : (Array.isArray(response) ? response : []);
                return data.map((item: any) => ({
                    id: item.id || item.ID ? Number(item.id || item.ID) : undefined,
                    user_id: String(item.user_id ?? item.USER_ID),
                    application_id: Number(item.application_id || item.APPLICATION_ID),
                    droits: item.droits || item.DROITS
                } as UserApplication));
            }),
            catchError(err => { console.error('Erreur', err); return of([]); })
        );
    }

    getUserApplications(user_id: string): Observable<UserApplication[]> {
        const params = new HttpParams().set('user_id', user_id);
        return this.http.get<any>(this.baseUrl + environmentGlobal.serviceUserApplications, { params, headers: this.getHeaders() })
            .pipe(map(response => response?.data ? response.data : (Array.isArray(response) ? response : [])));
    }

    insertUserApplication(userApp: UserApplication): Observable<any> {
        return this.http.post(this.baseUrl + environmentGlobal.serviceUserApplicationsInsert, userApp, { 
            headers: this.getHeaders(),
            responseType: 'text' 
        });
    }

    updateUserApplication(userApp: UserApplication): Observable<any> {
        const payload = {
            user_id: userApp.user_id,
            application_id: userApp.application_id,
            droits: userApp.droits
        };
        return this.http.post(this.baseUrl + environmentGlobal.serviceUserApplicationsUpdate, payload, { 
            headers: this.getHeaders(),
            responseType: 'text' 
        });
    }

    deleteUserApplication(user_id: string, appId: number): Observable<void> {
        const params = new HttpParams().set('user_id', user_id).set('appId', appId.toString());
        return this.http.delete<void>(this.baseUrl + environmentGlobal.serviceUserApplicationsDelete, { params, headers: this.getHeaders() });
    }

    // ==========================================
    // GESTION DES GROUPES ET MATRICES SNAKE_CASE
    // ==========================================
    getGroupes(): Observable<Groupe[]> {
        return this.http.get<any>(this.baseUrl + environmentGlobal.serviceGroupes, { headers: this.getHeaders() })
            .pipe(map(res => {
                // MAPPAGE ROBUSTE
                const data = res?.data ? res.data : (Array.isArray(res) ? res : []);
                return data.map((item: any) => ({
                    id: Number(item.id || item.ID),
                    nom: item.nom || item.NOM,
                    description: item.description || item.DESCRIPTION,
                    ordre: Number(item.ordre || item.ORDRE || 0),
                    is_active: item.is_active === 1 || item.is_active === "1" || item.is_active === true || item.IS_ACTIVE === 1 || item.IS_ACTIVE === true
                } as Groupe));
            }));
    }

    insertGroupe(groupe: Partial<Groupe>): Observable<Groupe> {
        return this.http.post<Groupe>(this.baseUrl + environmentGlobal.serviceGroupesInsert, groupe, { headers: this.getHeaders() });
    }

    updateGroupe(groupe: Groupe): Observable<Groupe> {
        return this.http.post<Groupe>(this.baseUrl + (environmentGlobal.serviceGroupesUpdate || '/poportail/groupes/update/'), groupe, { headers: this.getHeaders() });
    }

    deleteGroupe(id: number): Observable<void> {
        return this.http.delete<void>(`${this.baseUrl}${environmentGlobal.serviceGroupesDelete}${id}`, { headers: this.getHeaders() });
    }

    // ==========================================
    // MÉTIERS (Admin > Métiers) — attribut de fiche utilisateur (users.metier_id)
    // ==========================================
    getMetiers(): Observable<Metier[]> {
        return this.http.get<any>(this.baseUrl + environmentGlobal.serviceMetiers, { headers: this.getHeaders() }).pipe(
            map(response => {
                const data = response?.data ? response.data : (Array.isArray(response) ? response : []);
                return data.map((item: any) => ({
                    id: Number(item.id || item.ID),
                    nom: item.nom || item.NOM,
                    is_active: item.is_active === 1 || item.is_active === "1" || item.is_active === true || item.IS_ACTIVE === 1 || item.IS_ACTIVE === true,
                    color: item.color || item.COLOR || 'slate'
                } as Metier));
            }),
            catchError(err => { console.error('Erreur', err); return of([]); })
        );
    }

    insertMetier(metier: Partial<Metier>): Observable<Metier> {
        return this.http.post<Metier>(this.baseUrl + environmentGlobal.serviceMetiersInsert, metier, { headers: this.getHeaders() });
    }

    updateMetier(metier: Metier): Observable<Metier> {
        return this.http.post<Metier>(this.baseUrl + environmentGlobal.serviceMetiersUpdate, metier, { headers: this.getHeaders() });
    }

    deleteMetier(id: number): Observable<void> {
        return this.http.delete<void>(`${this.baseUrl}${environmentGlobal.serviceMetiersDelete}${id}`, { headers: this.getHeaders() });
    }

    getGroupeApplications(): Observable<GroupeApplication[]> {
        return this.http.get<any>(this.baseUrl + environmentGlobal.serviceGroupeApplications, { headers: this.getHeaders() })
             .pipe(map(res => {
                 // MAPPAGE ROBUSTE
                 const data = res?.data ? res.data : (Array.isArray(res) ? res : []);
                 return data.map((item: any) => ({
                     id: item.id || item.ID ? Number(item.id || item.ID) : undefined,
                     groupe_id: Number(item.groupe_id || item.GROUPE_ID),
                     application_id: Number(item.application_id || item.APPLICATION_ID)
                 } as GroupeApplication));
             }));
    }

    toggleGroupeApplication(groupe_id: number, application_id: number, link: boolean): Observable<any> {
        if (link) {
            return this.http.post(this.baseUrl + environmentGlobal.serviceGroupeApplicationsInsert, { groupe_id, application_id }, { headers: this.getHeaders() });
        }
        return this.http.delete(`${this.baseUrl}${environmentGlobal.serviceGroupeApplicationsDelete}${groupe_id}/${application_id}`, { headers: this.getHeaders() });
    }

    getUserGroupes(): Observable<UserGroupe[]> {
        return this.http.get<any>(this.baseUrl + environmentGlobal.serviceUserGroupes, { headers: this.getHeaders() })
             .pipe(map(res => {
                 // MAPPAGE ROBUSTE
                 const data = res?.data ? res.data : (Array.isArray(res) ? res : []);
                 return data.map((item: any) => ({
                     id: item.id || item.ID ? Number(item.id || item.ID) : undefined,
                     user_id: String(item.user_id ?? item.USER_ID),
                     groupe_id: Number(item.groupe_id || item.GROUPE_ID)
                 } as UserGroupe));
             }));
    }

    toggleUserGroupe(user_id: string, groupe_id: number, link: boolean): Observable<any> {
        if (link) {
            return this.http.post(this.baseUrl + environmentGlobal.serviceUserGroupesInsert, { user_id, groupe_id }, { headers: this.getHeaders() });
        }
        return this.http.delete(`${this.baseUrl}${environmentGlobal.serviceUserGroupesDelete}${user_id}/${groupe_id}`, { headers: this.getHeaders() });
    }

    // --- SPÉCIFIQUE HOME PAGE ---
    getHomeDashboard(user_id: string, role: string = 'USER'): Observable<Groupe[]> {
        return forkJoin({
            groupes: this.getGroupes(),
            apps: this.getApplications(),
            grpApps: this.getGroupeApplications(),
            userGrps: this.getUserGroupes()
        }).pipe(
            map(data => {
              
                let allowedGroupes: Groupe[] = [];

                if (role === 'SU') {
                    allowedGroupes = data.groupes.filter((g: Groupe) => g.is_active);
                } else {
                    const allowedGrpIds = data.userGrps
                      .filter((ug: UserGroupe) => ug.user_id === user_id)
                      .map((ug: UserGroupe) => ug.groupe_id);
                      
                    allowedGroupes = data.groupes.filter((g: Groupe) => allowedGrpIds.includes(g.id));
                    
                    // On filtre ceux qui sont inactifs
                    allowedGroupes = allowedGroupes.filter(g => g.is_active);
                }

                // Pour chaque groupe autorisé, on attache ses applications
                allowedGroupes.forEach((groupe: Groupe) => {
                    const appIdsInGroupe = data.grpApps
                      .filter((ga: GroupeApplication) => ga.groupe_id === groupe.id)
                      .map((ga: GroupeApplication) => ga.application_id);

                    groupe.applications = data.apps.filter((app: Application) => appIdsInGroupe.includes(app.id) && app.is_active);
                });

                // On ne renvoie que les groupes contenant au moins une application
                const finalResult = allowedGroupes
                    .filter((g: Groupe) => g.applications && g.applications.length > 0)
                    .sort((a: Groupe, b: Groupe) => (a.ordre || 0) - (b.ordre || 0));
                
                return finalResult;
            })
        );
    }
}