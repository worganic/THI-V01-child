#!/usr/bin/env node
/**
 * Génère les fichiers d'aiguillage (*.slot.ts) des pages surchargeables.
 *
 * Un "slot" = une page dont le contrat de forme (sélecteur, classe exportée,
 * standalone) est figé mais dont le contenu est libre — même principe que
 * portal-extras.component.ts, appliqué page par page (voir
 * docs/architecture-sous-applications.md, section "Surcharge de page par
 * présence de fichier").
 *
 * Avant chaque build/serve (câblé en dependsOn dans project.json), ce script
 * régénère un petit fichier `<slot>.slot.ts` à côté du composant par défaut,
 * qui réexporte :
 *  - le composant par défaut, si aucune surcharge n'existe ;
 *  - la surcharge, si `apps/<app>-special/src/app/<slot>.ts` existe.
 *
 * Fichier IDENTIQUE dans les deux monorepos (cf. tools/verifier-contrat.mjs) :
 * seule la table APPS ci-dessous distingue les deux côtés — et depuis le
 * renommage de l'app THI (2026-08-01), même valeurs des deux côtés.
 *
 * Usage : node tools/generate-page-overrides.mjs
 */
import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const APPS = {
  'portail':             { defaut: 'portail-shell', special: 'portail-shell-special' },
  'THI-V01-child-user3': { defaut: 'portail-shell', special: 'portail-shell-special' },
};

const config = APPS[basename(ICI)];
if (!config) {
  console.error(`✘ Repo « ${basename(ICI)} » inconnu de APPS. Complétez la table dans ce script.`);
  process.exit(1);
}
const { defaut: APP_DEFAUT, special: APP_SPECIAL } = config;

/**
 * Registre des slots. Défini une fois ici — pas par qui dépose une
 * surcharge. Pour ajouter un slot : une entrée ici + le point d'indirection
 * dans le fichier contrat concerné (voir docs).
 */
const SLOTS = [
  { id: 'home', chemin: 'home/home.component', export: 'HomeComponent' },
  { id: 'landing', chemin: 'landing/landing.component', export: 'LandingComponent' },
];

function versImport(depuisFichier, versFichierSansExt) {
  let rel = relative(dirname(depuisFichier), versFichierSansExt).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel;
}

let genere = 0;
for (const slot of SLOTS) {
  const defautTs    = join(ICI, 'apps', APP_DEFAUT,  'src/app', `${slot.chemin}.ts`);
  const specialTs   = join(ICI, 'apps', APP_SPECIAL, 'src/app', `${slot.chemin}.ts`);
  const slotFichier = join(ICI, 'apps', APP_DEFAUT, 'src/app',
    `${slot.chemin.replace(/\.component$/, '')}.slot.ts`);

  const surcharge = existsSync(specialTs);
  const cible = surcharge ? specialTs : defautTs;
  const importPath = versImport(slotFichier, cible.replace(/\.ts$/, ''));

  if (surcharge) {
    const source = readFileSync(specialTs, 'utf8');
    if (!/selector:\s*['"]/.test(source)) {
      console.warn(`⚠ ${specialTs} : aucun sélecteur trouvé, vérifiez le contrat de forme.`);
    }
  }

  const contenu = `// Fichier généré automatiquement par tools/generate-page-overrides.mjs.
// NE PAS ÉDITER À LA MAIN — régénéré avant chaque build/serve.
// Source actuelle : ${surcharge ? `apps/${APP_SPECIAL}/src/app/${slot.chemin}.ts (surcharge)` : `${slot.chemin}.ts (défaut)`}
export { ${slot.export} } from '${importPath}';
`;
  writeFileSync(slotFichier, contenu, 'utf8');
  console.log(`${surcharge ? '⚙ surcharge' : '· défaut   '} [${slot.id}] → ${importPath}`);
  genere++;
}

console.log(`\n✔ ${genere} slot(s) régénéré(s).`);
