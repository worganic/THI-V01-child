#!/usr/bin/env node
/**
 * Vérifie que les fichiers du contrat sont identiques dans les deux monorepos.
 *
 * Ces fichiers doivent rester bit-à-bit identiques : c'est ce qui garantit
 * qu'une sous-application déplacée d'un portail à l'autre y trouve les mêmes
 * symboles. Rien n'empêche mécaniquement d'en modifier un seul côté — d'où ce
 * garde-fou, à lancer avant de committer un changement qui touche le socle.
 *
 * Utilisation (depuis la racine de l'un ou l'autre monorepo) :
 *   node tools/verifier-contrat.mjs [chemin/vers/l-autre/monorepo]
 *
 * Sans argument, l'autre monorepo est cherché à côté de celui-ci.
 * Sortie 0 si tout concorde, 1 sinon.
 */

import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Les deux monorepos, par nom de dossier.
const MONOREPOS = ['portail', 'THI-V01-child-user3'];

/**
 * Fichiers qui doivent être identiques des deux côtés.
 *
 * Ce qui n'est PAS dans cette liste et n'a pas vocation à y entrer : les
 * fichiers `portal-auth.ts`, `portal-data-access.ts`, `portal-ui.ts` et
 * `portal-session.provider.ts`. Ils portent le même nom dans les deux
 * monorepos mais exposent chacun l'implémentation locale (appels API/BDD,
 * chrome du portail) — ce sont précisément les points d'extension qui
 * permettent aux `index.ts` ci-dessous d'être identiques.
 */
const FICHIERS_DU_CONTRAT = [
  // ── Socle d'accès aux données ────────────────────────────────────────────
  'libs/core/data-access/src/index.ts',
  'libs/core/data-access/src/lib/tokens.ts',
  'libs/core/data-access/src/lib/admin-tabs-registry.service.ts',
  'libs/core/data-access/src/lib/portal-apps.models.ts',

  // ── Socle d'authentification ─────────────────────────────────────────────
  'libs/core/auth/src/index.ts',
  'libs/core/auth/src/lib/portal-session.ts',
  'libs/core/auth/src/lib/auth.routes.ts',
  'libs/core/auth/src/lib/auth.guard.ts',
  'libs/core/auth/src/lib/guest.guard.ts',

  // ── Socle d'interface ────────────────────────────────────────────────────
  'libs/shared/ui/src/index.ts',
  'libs/shared/ui/src/lib/service/theme.service.ts',
  'libs/shared/utils/src/index.ts',

  // ── Outillage de test ────────────────────────────────────────────────────
  'libs/core/auth/jest.config.ts',
  'libs/core/data-access/jest.config.ts',
  'libs/shared/ui/jest.config.ts',
  'libs/shared/utils/jest.config.ts',
  'libs/core/auth/src/test-setup.ts',
  'libs/core/data-access/src/test-setup.ts',
  'libs/shared/ui/src/test-setup.ts',
  'libs/shared/utils/src/test-setup.ts',

  // ── Sous-application témoin (preuve de portabilité) ──────────────────────
  'apps/appli-agenda/src/app/admin/admin-agenda.component.ts',
  'apps/appli-agenda/src/app/admin/admin-agenda.component.html',
  'apps/appli-agenda/src/app/admin/admin-agenda.component.scss',
  'apps/appli-agenda/src/app/admin/provide-agenda-admin-tab.ts',

  // ── Documentation et outillage du contrat ────────────────────────────────
  'docs/architecture-sous-applications.md',
  'tools/verifier-contrat.mjs',
];

/**
 * Racine du shell du portail dans chaque monorepo. Le projet NX n'y porte pas
 * le même nom, mais le contenu de `src/` est le même.
 */
const RACINE_SHELL = {
  'portail': 'apps/portail-shell/src',
  'THI-V01-child-user3': 'apps/portail/src',
};

/**
 * Fichiers du shell qui doivent être identiques des deux côtés, relatifs à
 * `RACINE_SHELL`.
 *
 * N'y figurent volontairement pas les quatre fichiers propres à chaque
 * portail : `app/app.config.ts` (valeurs de configuration),
 * `app/connexion/connexion.component.ts` (échange d'identifiants avec la base),
 * `app/portal-routes.ts` et `app/portal-extras.component.ts` (points
 * d'extension). Tout le reste du shell — administration, accueil, gabarits et
 * feuilles de style — est commun.
 */
const FICHIERS_DU_SHELL = [
  'app/app.ts',
  'app/app.html',
  'app/app.scss',
  'app/app.routes.ts',
  'app/app/app.component.ts',
  'app/app/app.component.html',
  'app/app/app.component.scss',
  'app/admin/admin.component.ts',
  'app/admin/admin.component.html',
  'app/admin/admin.component.scss',
  'app/admin/admin-affectations/admin-affectations.component.ts',
  'app/admin/admin-affectations/admin-affectations.component.html',
  'app/admin/admin-apps/admin-apps.component.ts',
  'app/admin/admin-apps/admin-apps.component.html',
  'app/admin/admin-config/admin-config.component.ts',
  'app/admin/admin-config/admin-config.component.html',
  'app/admin/admin-export/admin-export.component.ts',
  'app/admin/admin-export/admin-export.component.html',
  'app/admin/admin-groupes/admin-groupes.component.ts',
  'app/admin/admin-groupes/admin-groupes.component.html',
  'app/admin/admin-groupes/admin-groupes.component.scss',
  'app/admin/admin-matrice-apps/admin-matrice-apps.component.ts',
  'app/admin/admin-matrice-apps/admin-matrice-apps.component.html',
  'app/admin/admin-matrice-users/admin-matrice-users.component.ts',
  'app/admin/admin-matrice-users/admin-matrice-users.component.html',
  'app/admin/admin-metiers/admin-metiers.component.ts',
  'app/admin/admin-metiers/admin-metiers.component.html',
  'app/admin/admin-metiers/admin-metiers.component.scss',
  'app/admin/admin-users/admin-users.component.ts',
  'app/admin/admin-users/admin-users.component.html',
  'app/admin/admin-users/admin-users.component.scss',
  'app/connexion/connexion.component.html',
  'app/connexion/connexion.component.scss',
  'app/home/home.component.ts',
  'app/home/home.component.html',
  'app/home/home.component.scss',
  'models/admin.models.ts',
  'services/admin.service.ts',
  'services/connexion.service.ts',
  'services/pp-category.service.ts',
  'utils/metier-colors.ts',
];

function autreMonorepo() {
  const fourni = process.argv[2];
  if (fourni) return resolve(fourni);
  const nomIci = basename(ICI);
  const autre = MONOREPOS.find(m => m !== nomIci);
  return join(dirname(ICI), autre ?? '');
}

const LA_BAS = autreMonorepo();

if (!existsSync(LA_BAS)) {
  console.error(`✘ Autre monorepo introuvable : ${LA_BAS}`);
  console.error('  Passez son chemin en argument.');
  process.exit(1);
}

const empreinte = (p) => (existsSync(p) ? createHash('sha256').update(readFileSync(p)).digest('hex') : null);

let divergences = 0;
let absents = 0;

/** Compare un fichier de part et d'autre, `etiquette` servant à l'affichage. */
function comparer(cheminIci, cheminLaBas, etiquette) {
  const a = empreinte(cheminIci);
  const b = empreinte(cheminLaBas);

  if (a === null || b === null) {
    absents++;
    const manquant = a === null ? basename(ICI) : basename(LA_BAS);
    console.error(`✘ ABSENT   ${etiquette}  (côté ${manquant})`);
  } else if (a !== b) {
    divergences++;
    console.error(`✘ DIFFÈRE  ${etiquette}`);
  } else {
    console.log(`✔ identique ${etiquette}`);
  }
}

for (const rel of FICHIERS_DU_CONTRAT) {
  comparer(join(ICI, rel), join(LA_BAS, rel), rel);
}

// Le shell : même contenu, mais sous un projet NX au nom différent de chaque côté.
const shellIci = RACINE_SHELL[basename(ICI)];
const shellLaBas = RACINE_SHELL[basename(LA_BAS)];

if (!shellIci || !shellLaBas) {
  console.error(`✘ Racine du shell inconnue pour « ${basename(ICI)} » ou « ${basename(LA_BAS)} ».`);
  console.error('  Complétez RACINE_SHELL dans ce script.');
  process.exit(1);
}

for (const rel of FICHIERS_DU_SHELL) {
  comparer(join(ICI, shellIci, rel), join(LA_BAS, shellLaBas, rel), `<shell>/${rel}`);
}

const attendus = FICHIERS_DU_CONTRAT.length + FICHIERS_DU_SHELL.length;
const total = divergences + absents;
console.log('');
if (total === 0) {
  console.log(`✔ Les ${attendus} fichiers du contrat sont identiques dans les deux monorepos.`);
  process.exit(0);
}
console.error(`✘ ${total} écart(s) : ${divergences} divergence(s), ${absents} absence(s).`);
console.error('  Reportez la modification dans l\'autre monorepo avant de committer.');
process.exit(1);
