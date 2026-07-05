import { PromptGlobalConfig } from './mega-outils.models';

/**
 * Fonctions pures de composition du system prompt d'un MO Prompt selon son mode
 * (Normal/Guidé/Tchat/Tchat libre), utilisées par ProjetConversationComponent.
 */

export interface PromptSystemComposerInput {
  mode: 'simple' | 'guided' | 'chat' | 'freechat';
  /** SYSTEM: propre à la fence du Prompt. */
  fenceSystemPrompt: string | null;
  globalConfig: PromptGlobalConfig;
  /** false = ignore le prompt de base global + les méta-prompts (tous modes sauf freechat, qui n'en a jamais). */
  useConfigPrompts: boolean;
  /** Mode Guidé uniquement : quelle phase du cadrage/génération. */
  phase?: 'clarify' | 'generate';
}

function joinPrompts(...parts: (string | null | undefined)[]): string | null {
  const filtered = parts.filter((p): p is string => !!p && p.trim() !== '');
  return filtered.length ? filtered.join('\n\n---\n\n') : null;
}

export function composeSystemPrompt(input: PromptSystemComposerInput): string | null {
  const { mode, fenceSystemPrompt, globalConfig, useConfigPrompts, phase } = input;
  if (mode === 'freechat') return fenceSystemPrompt || null;
  if (!useConfigPrompts) return fenceSystemPrompt || null;
  if (mode === 'simple') return joinPrompts(globalConfig.baseSystemPrompt, fenceSystemPrompt);
  if (mode === 'chat') return joinPrompts(globalConfig.baseSystemPrompt, fenceSystemPrompt, globalConfig.chatStructuredPrompt);
  if (mode === 'guided') {
    const meta = phase === 'generate' ? globalConfig.workflowGeneratePrompt : globalConfig.workflowClarifyPrompt;
    return joinPrompts(globalConfig.baseSystemPrompt, fenceSystemPrompt, meta);
  }
  return fenceSystemPrompt || null;
}

/** Directive forçant l'IA à démarrer ses titres markdown au niveau donné, pour que le
 *  livrable s'imbrique correctement sous le dossier du Prompt (sous-section "PR-Res"). */
export function promptDeliverableHeadingInstruction(startHeadingLevel: number): string | null {
  if (!startHeadingLevel || startHeadingLevel < 1) return null;
  const hashes = '#'.repeat(startHeadingLevel);
  return `FORMAT DES TITRES (impératif) : le document généré sera inséré comme sous-section d'une section existante. Démarre TOUS tes titres Markdown au niveau ${startHeadingLevel} (« ${hashes} ») et utilise des niveaux plus profonds (jusqu'à 6 « ###### » maximum) pour les sous-titres. N'emploie JAMAIS un titre avec moins de ${startHeadingLevel} dièses. Le tout premier titre du document doit commencer par « ${hashes} ».`;
}
