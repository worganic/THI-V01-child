import { ChartPoint, FormQuestion, MaterializedMoPreview } from './mega-outils.models';

/**
 * Fonctions pures de parsing des MegaOutils détectés dans les réponses IA d'une
 * conversation MO Prompt (tous modes : Normal/Guidé/Tchat/Tchat libre), utilisées
 * par ProjetConversationComponent.
 */

/** Instruction système pour le chat IA "classique" (hors conversation MO Prompt) : enseigne le
 *  format de fence ARRAY/TRELLO détecté par detectMoFences(), pour que "Ajouter au projet" puisse
 *  matérialiser un vrai MegaOutil au lieu de laisser un tableau markdown statique dans le document.
 *  Volontairement limité à ARRAY/TRELLO : ce sont les 2 seuls types réellement matérialisés en
 *  instance BDD aujourd'hui (FORM/CHART/AGENDA ne créent aucune instance, même côté MO Prompt). */
export const MO_FENCE_CHAT_INSTRUCTION = `Si la demande implique de créer ou mettre à jour un tableau de données ou un tableau Kanban, utilise EXACTEMENT une de ces syntaxes (fences \`\`\`) pour que l'élément puisse être ajouté au projet comme un vrai outil interactif :

\`\`\`ARRAY: Nom du tableau
| Colonne 1 | Colonne 2 |
|-----------|-----------|
| valeur    | valeur    |
\`\`\`

\`\`\`TRELLO: Nom du tableau
### À faire
- [ ] Titre de la carte \`[medium]\`
### En cours
### Terminé
\`\`\`

N'utilise cette syntaxe que si la demande porte réellement sur ce type de contenu structuré ; pour toute autre demande, réponds normalement en texte/markdown libre.`;

/** Corps d'un fence (entre la 1re et la dernière ligne ```). */
export function fenceBody(fence: string): string {
  const lines = fence.split('\n');
  return lines.slice(1, lines.length - 1).join('\n');
}

/** Détecte les fences TRELLO/ARRAY/FORM/CHART/AGENDA d'un contenu pour l'aperçu de matérialisation. */
export function detectMoFences(content: string): MaterializedMoPreview[] {
  const out: MaterializedMoPreview[] = [];
  const re = /```(TRELLO|ARRAY|FORM|CHART|AGENDA):[ \t]*([^\n]+)\n([\s\S]*?)\n```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const type = m[1].toLowerCase() as 'trello' | 'array' | 'form' | 'chart' | 'agenda';
    const name = m[2].trim();
    const body = m[3];
    out.push({ type, name, summary: summarizeMoFence(type, body), fence: m[0], selected: true });
  }
  return out;
}

export function summarizeMoFence(type: 'trello' | 'array' | 'form' | 'chart' | 'agenda', body: string): string {
  if (type === 'trello') {
    const n = (body.match(/^\s*-\s*\[[ x~!]?\]/gm) || []).length;
    return `${n} carte${n > 1 ? 's' : ''}`;
  }
  if (type === 'array') {
    const rows = (body.match(/^\s*\|.*\|\s*$/gm) || []).filter(l => !/^\s*\|[\s|:-]+\|\s*$/.test(l));
    const cols = rows[0] ? rows[0].split('|').filter(c => c.trim() !== '').length : 0;
    return `${Math.max(0, rows.length - 1)}×${cols}`;
  }
  if (type === 'chart') {
    const pts = body.split('\n').filter(l => /^source:/i.test(l.trim()) ? false : /\S/.test(l)).length;
    return pts > 0 ? `${pts} point${pts > 1 ? 's' : ''}` : 'live';
  }
  if (type === 'agenda') {
    const n = body.split('\n').filter(l => /\d{4}-\d{2}-\d{2}/.test(l)).length;
    return `${n} événement${n > 1 ? 's' : ''}`;
  }
  const q = (body.match(/^\s*[\*\-]\s+\*\*(.+?)\*\*\s*:?\s*$/gm) || []).length;
  return `${q} question${q > 1 ? 's' : ''}`;
}

/**
 * Parse une sortie IA (cadrage ou réponse de tchat) en questions de formulaire.
 * Grammaire : `**Label**` puis des lignes `- [ ] Option` (checkbox), `- ( ) Option`
 * (radio), ou une ligne de 5+ underscores seule (`_____`) pour une question ouverte
 * en texte libre (aucune option).
 */
export function parseChoiceForm(body: string): FormQuestion[] {
  const questions: FormQuestion[] = [];
  let current: FormQuestion | null = null;
  const finalize = () => {
    if (!current) return;
    if (current.options.length === 0 && current.type !== 'text') return; // pas de question exploitable
    questions.push(current);
  };
  for (const line of body.split('\n')) {
    const q = line.match(/^\s*(?:[\*\-]\s+)?\*\*(.+?)\*\*\s*:?\s*$/);
    if (q) { finalize(); current = { label: q[1].trim(), type: 'checkbox', options: [] }; continue; }
    const c = line.match(/^\s*(?:[\*\-]\s+)?\[\s*\]\s+(.+)$/);
    if (c && current) { current.type = 'checkbox'; current.options.push({ text: c[1].trim(), hasDetail: /_{5,}/.test(c[1]) }); continue; }
    const r = line.match(/^\s*(?:[\*\-]\s+)?\(\s*\)\s+(.+)$/);
    if (r && current) { current.type = 'radio'; current.options.push({ text: r[1].trim(), hasDetail: /_{5,}/.test(r[1]) }); continue; }
    const blank = line.match(/^\s*_{5,}\s*$/);
    if (blank && current && current.options.length === 0) { current.type = 'text'; continue; }
  }
  finalize();
  return questions;
}

/**
 * Parse un fence CHART inline (format `Label: valeur` par ligne) en points pour
 * un aperçu SVG immédiat (ChartBoardComponent). Le format `source: Tableau | col:
 * Colonne` référence un ARRAY et ne peut pas être prévisualisé sans instance BDD
 * (retourne un tableau vide dans ce cas — le résumé textuel reste "live").
 */
export function parseChartPoints(body: string): ChartPoint[] {
  const points: ChartPoint[] = [];
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || /^source:/i.test(trimmed)) continue;
    const m = trimmed.match(/^(.+?):\s*(-?\d+(?:[.,]\d+)?)\s*$/);
    if (m) points.push({ label: m[1].trim(), value: parseFloat(m[2].replace(',', '.')) });
  }
  return points;
}

/** Aperçu en lecture seule d'un tableau Markdown ARRAY (avant matérialisation réelle). */
export function parseArrayTable(body: string): { headers: string[]; rows: string[][] } {
  const lines = body.split('\n').map(l => l.trim()).filter(l => l.startsWith('|') && l.endsWith('|'));
  const cells = (line: string) => line.slice(1, -1).split('|').map(c => c.trim());
  const dataLines = lines.filter(l => !/^\|[\s|:-]+\|$/.test(l));
  if (!dataLines.length) return { headers: [], rows: [] };
  return { headers: cells(dataLines[0]), rows: dataLines.slice(1).map(cells) };
}

export interface TrelloPreviewColumn {
  name: string;
  cards: { title: string; priority: string | null }[];
}

/** Aperçu en lecture seule d'un board TRELLO (colonnes `### Nom`, cartes `- [ ] Titre \`[priorité]\``). */
export function parseTrelloPreview(body: string): TrelloPreviewColumn[] {
  const columns: TrelloPreviewColumn[] = [];
  let current: TrelloPreviewColumn | null = null;
  for (const line of body.split('\n')) {
    const h = line.match(/^\s*###\s+(.+?)\s*$/);
    if (h) { current = { name: h[1].trim(), cards: [] }; columns.push(current); continue; }
    const c = line.match(/^\s*-\s*\[[ x~!]?\]\s*(.+?)\s*$/);
    if (c && current) {
      const raw = c[1];
      const pm = raw.match(/^(.*?)\s*`\[(.+?)\]`\s*$/);
      current.cards.push(pm ? { title: pm[1].trim(), priority: pm[2].trim() } : { title: raw.trim(), priority: null });
    }
  }
  return columns;
}

export interface AgendaPreviewEvent {
  date: string;
  time: string;
  title: string;
  description: string;
}

/** Aperçu en lecture seule d'un AGENDA (lignes `YYYY-MM-DD | HH:MM-HH:MM | Titre | Description`). */
export function parseAgendaPreview(body: string): AgendaPreviewEvent[] {
  const events: AgendaPreviewEvent[] = [];
  for (const line of body.split('\n')) {
    const parts = line.split('|').map(p => p.trim());
    if (parts.length >= 3 && /^\d{4}-\d{2}-\d{2}$/.test(parts[0])) {
      events.push({ date: parts[0], time: parts[1] || '', title: parts[2] || '', description: parts[3] || '' });
    }
  }
  return events;
}
