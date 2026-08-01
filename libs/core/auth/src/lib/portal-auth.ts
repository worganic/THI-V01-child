/**
 * Surface d'authentification propre à CE portail (appels API/BDD).
 *
 * Ce fichier existe dans les deux monorepos sous le même nom et n'y expose pas
 * les mêmes symboles : c'est le point d'extension prévu pour que `index.ts`,
 * lui, reste identique des deux côtés. Une sous-application ne doit jamais
 * importer ce qui vient d'ici — elle injecte `PORTAL_SESSION`.
 */
export * from './auth.interceptor';
