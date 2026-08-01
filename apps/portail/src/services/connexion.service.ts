import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { environmentGlobal } from '../../environmentGlobal/environmentGlobal';

const cacheBuster$ = new Subject<void>();

@Injectable({
  providedIn: 'root'
})
export class ConnexionService {

  private headers: HttpHeaders;
  url: string = environmentGlobal.serviceDomaine + environmentGlobal.serviceConnexion;

  constructor(private _http: HttpClient) {
    this.headers = new HttpHeaders()
      .set('IDUSER', environmentGlobal.IDUSER || 'VALEUR_PAR_DEFAUT')
      .set('IDAPPEL', environmentGlobal.IDAPPEL || 'VALEUR_PAR_DEFAUT')
      .set('IDTRANSACTION', environmentGlobal.IDTRANSACTION || 'VALEUR_PAR_DEFAUT');
  }

  /**
   * Retourne la bonne URL de base selon si l'application est en local (mock) ou en ligne (VAL)
   */
  private get baseUrl(): string {
    // Si isLocal est vrai (mode mock), on utilise serviceDomaine, sinon serviceVal pour le réseau en ligne
    const serviceBase = environmentGlobal.isLocal 
      ? environmentGlobal.serviceDomaine 
      : environmentGlobal.serviceVal;
      
    return serviceBase + environmentGlobal.serviceConnexion;
  }

  /**
   * Se connecte à l'API Airbus pour vérifier l'identifiant et le mot de passe.
   * L'auto-enregistrement dans la base du portail (poportail.users) est géré 
   * par le composant ConnexionComponent après la réussite de cette requête.
   */
  getConnexion(data: any): Observable<any> {
    const targetUrl = this.baseUrl;
    if (environmentGlobal.debug) console.log("ConnexionService | getConnexion / data : ", data);
    if (environmentGlobal.debug) console.log("ConnexionService | getConnexion / this.url : ", this.url);

    const response = this._http.post<any>(targetUrl, data, { headers: this.headers });

    if (environmentGlobal.debug) console.log("ConnexionService | getConnexion / response : ", response);
    return response;
  }
}