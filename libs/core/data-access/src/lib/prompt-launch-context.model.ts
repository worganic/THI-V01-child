/** Payload transmis quand un MO Prompt est exécuté : bascule l'onglet Conversation
 *  et y lance la conversation au lieu d'ouvrir un popup. */
export interface PromptLaunchContext {
  instanceId: string;
  instanceName: string;
  folderId: string | null;
  /** SYSTEM: propre à la fence du Prompt (avant composition avec les prompts globaux). */
  systemPrompt: string | null;
  /** Prompt utilisateur brut, {{variables}} non résolues. */
  userPrompt: string;
  variables: string[];
  mode: 'simple' | 'guided' | 'chat' | 'freechat';
  /** État courant du projet (formulaires répondus, tableaux remplis) pour la génération
   *  en mode Guidé — calculé une seule fois au lancement (buildTrainingStateContext). */
  currentState: string;
  /** Niveau de titre auquel le livrable doit démarrer, pour s'imbrider sous le dossier du Prompt. */
  startHeadingLevel: number;
  /** Jeton croissant pour détecter un nouveau lancement même sur la même instance. */
  token: number;
}
