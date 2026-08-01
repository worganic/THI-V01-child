/**
 * Interface propre à CE portail : chrome (en-tête, pied de page, navigation),
 * éditeur, aide, mega-outils et outils maison.
 *
 * Ce fichier existe dans les deux monorepos sous le même nom et n'y expose pas
 * les mêmes symboles : c'est le point d'extension prévu pour que `index.ts`,
 * lui, reste identique des deux côtés.
 */

// Chrome du portail
export * from './layout/header/header.component';
export * from './layout/footer/footer.component';
export * from './layout/nav/nav.component';
export * from './mini-header/worg-mini-header.component';

// Aide contextuelle
export * from './help/help.service';
export * from './help/worg-help-trigger.component';

// Édition
export * from './editor/title-create-dialog.component';
export * from './markdown-editor/markdown-editor.component';

// Admin — briques communes aux tableaux d'administration
export * from './admin/admin-table.util';
export * from './admin/worg-admin-pagination.component';

// Tools
export * from './tools/action-report-modal/action-report-modal.component';
export * from './tools/ticket-widget/ticket-widget.component';
export * from './tools/cahier-recette/cahier-recette.service';
export * from './tools/cahier-recette/cahier-recette.component';
export * from './tools/cahier-recette/cahier-recette-widget.component';
export * from './tools/tchat-ia/tchat-ia.component';
export * from './tools/wo/wo-actions/wo-actions.component';
export * from './tools/wo/wo-actions/wo-actions-widget.component';
export * from './tools/wo/wo-history/wo-history.component';
export * from './tools/wo/wo-ia-logs/wo-ia-logs.component';
export * from './tools/wo/wo-tchat-ia/wo-tchat-ia-widget.component';
export * from './tools/wo/wo-tools-admin/wo-tools-admin.component';
export * from './tools/wo/wo-tools-panel/wo-tools-panel.component';

// Mega-Outils
export * from './mega-outils/trello/trello-board.component';
export * from './mega-outils/trello/trello-admin.component';
export * from './mega-outils/mockup/mockup-board.component';
export * from './mega-outils/mockup/mockup-admin.component';
export * from './mega-outils/array/array-board.component';
export * from './mega-outils/array/array-admin.component';
export * from './mega-outils/prompt/prompt-board.component';
export * from './mega-outils/prompt/prompt-admin.component';
export * from './mega-outils/form/form-board.component';
export * from './mega-outils/chart/chart-board.component';
