// Socle d'accès aux données du portail, partagé avec les sous-applications :
// tokens d'injection (base d'API, branding), registre des onglets d'admin et
// modèles du catalogue d'applications.
//
// Lib volontairement présente dans les deux monorepos (même chemin, même alias
// @portail/core-data-access) : une sous-application copiée d'un portail à
// l'autre y trouve les mêmes symboles, sans jamais importer le code du portail
// hôte par chemin relatif.

// Tokens
export * from './lib/tokens';

// Services
export * from './lib/admin-tabs-registry.service';

// Modèles
export * from './lib/portal-apps.models';

// Services d'accès aux données propres à CE portail (appels API/BDD) :
// c'est le seul point de ce dossier qui diffère d'un monorepo à l'autre.
export * from './lib/portal-data-access';
