/**
 * Services d'accès aux données propres à CE portail (appels API/BDD).
 *
 * Ce fichier existe dans les deux monorepos sous le même nom et n'y expose pas
 * les mêmes symboles : c'est le point d'extension prévu pour que `index.ts`,
 * lui, reste identique des deux côtés.
 *
 * Une sous-application destinée à circuler entre les deux portails ne doit
 * importer aucun de ces symboles — ils n'existent pas en face.
 */

// Session et configuration
export * from './auth.service';
export * from './app-config.service';
export * from './config.service';
export * from './db-status.service';
export * from './layout.service';

// API génériques
export * from './api.service';
export * from './portal-apps.service';

// Projets et documents
export * from './document.service';
export * from './project-files.service';
export * from './project.service';
export * from './projet-collab.service';

// IA, agents et conversations
export * from './agent.service';
export * from './ai-execute.service';
export * from './conversation.service';
export * from './prompt-launch-context.model';
export * from './prompt-system-composer.util';
export * from './wo-action-history.service';

// Mega-outils
export * from './mega-outils.models';
export * from './mega-outils.service';
export * from './mo-fence-parser.util';

// Outils métier
export * from './agenda-outil.models';
export * from './agenda-outil.service';
export * from './tests-outil.models';
export * from './tests-outil.service';
