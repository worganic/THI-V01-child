// Contrat de session commun aux deux portails — la seule surface d'authentification
// qu'une sous-application a le droit d'utiliser.
export * from './lib/portal-session';
export * from './lib/auth.routes';

// Gardes de routage, écrites sur le contrat : identiques dans les deux monorepos.
export * from './lib/auth.guard';
export * from './lib/guest.guard';

// Branchement du contrat sur l'implémentation locale (voir portal-session.provider.ts).
export * from './lib/portal-session.provider';

// Implémentation d'authentification propre à CE portail (appels API/BDD) :
// c'est le seul point de ce dossier qui diffère d'un monorepo à l'autre.
export * from './lib/portal-auth';
