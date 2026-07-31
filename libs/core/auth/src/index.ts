// Contrat de session commun aux deux portails — la seule surface d'authentification
// qu'une sous-application a le droit d'utiliser.
export * from './lib/portal-session';
export * from './lib/portal-session.provider';

// Implémentation propre à ce portail.
export * from './lib/auth.guard';
export * from './lib/guest.guard';
export * from './lib/auth.interceptor';
