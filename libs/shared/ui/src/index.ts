// Socle d'interface commun aux deux portails : ce que les deux monorepos
// exposent sous le même alias @portail/shared-ui, avec le même code.
//
// Le thème est ici plutôt que dans core-data-access parce qu'il relève de la
// présentation, et parce qu'une sous-application copiée d'un portail à l'autre
// doit le trouver au même endroit.
export * from './lib/service/theme.service';

// Composants et services d'interface propres à CE portail (chrome du portail,
// outils maison) : c'est le seul point de ce dossier qui diffère d'un monorepo
// à l'autre. Une sous-application destinée à circuler entre les deux portails
// ne doit rien importer d'ici.
export * from './lib/portal-ui';
