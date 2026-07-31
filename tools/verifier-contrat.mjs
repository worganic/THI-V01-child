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

/** Fichiers qui doivent être identiques des deux côtés. */
const FICHIERS_DU_CONTRAT = [
  'libs/core/data-access/src/lib/tokens.ts',
  'libs/core/data-access/src/lib/admin-tabs-registry.service.ts',
  'libs/core/data-access/src/lib/portal-apps.models.ts',
  'libs/core/auth/src/lib/portal-session.ts',
  'apps/appli-agenda/src/app/admin/admin-agenda.component.ts',
  'apps/appli-agenda/src/app/admin/admin-agenda.component.html',
  'apps/appli-agenda/src/app/admin/admin-agenda.component.scss',
  'apps/appli-agenda/src/app/admin/provide-agenda-admin-tab.ts',
  'docs/architecture-sous-applications.md',
  'tools/verifier-contrat.mjs',
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

for (const rel of FICHIERS_DU_CONTRAT) {
  const a = empreinte(join(ICI, rel));
  const b = empreinte(join(LA_BAS, rel));

  if (a === null || b === null) {
    absents++;
    const manquant = a === null ? basename(ICI) : basename(LA_BAS);
    console.error(`✘ ABSENT   ${rel}  (côté ${manquant})`);
  } else if (a !== b) {
    divergences++;
    console.error(`✘ DIFFÈRE  ${rel}`);
  } else {
    console.log(`✔ identique ${rel}`);
  }
}

const total = divergences + absents;
console.log('');
if (total === 0) {
  console.log(`✔ Les ${FICHIERS_DU_CONTRAT.length} fichiers du contrat sont identiques dans les deux monorepos.`);
  process.exit(0);
}
console.error(`✘ ${total} écart(s) : ${divergences} divergence(s), ${absents} absence(s).`);
console.error('  Reportez la modification dans l\'autre monorepo avant de committer.');
process.exit(1);
