# Prompt de création : Plateforme de gestion de projets avec Claude Code

## 🎯 Objectif du projet

Créer une plateforme web moderne (Node.js/Express + React) qui communique avec Claude Code CLI pour élaborer et gérer des projets, de l'idée initiale à la réalisation finale. La plateforme permet de créer ou reprendre des projets basés sur des templates structurées, garantissant une cohérence maximale entre les projets du même type.

**Vision** : Une application web professionnelle, responsive et intuitive offrant une expérience utilisateur fluide comparable aux outils SaaS modernes.

---

## 📋 Spécifications techniques

### Stack technique moderne

#### Backend
- **Runtime** : Node.js (v20+)
- **Framework** : Express.js
- **Validation** : Joi ou Zod
- **Logging** : Winston ou Pino
- **Utilitaires** : Lodash, Day.js

#### Frontend
- **Framework** : React 18+ avec Vite
- **Routing** : React Router v6
- **State Management** : Zustand (léger) ou React Context
- **Styling** : TailwindCSS 3.x
- **Composants UI** : shadcn/ui (basé sur Radix UI)
- **Icônes** : Lucide React
- **Animations** : Framer Motion
- **Formulaires** : React Hook Form + Zod
- **HTTP Client** : Axios ou TanStack Query
- **Notifications** : Sonner ou React Hot Toast

#### Intégration IA
- **Claude Code CLI** via `child_process` (spawn pour le streaming)
- Pas de clé API supplémentaire nécessaire

#### Données
- **Stockage** : Fichiers JSON (pas de base de données)
- **Architecture** : Fichiers/dossiers comme source de vérité

### Pourquoi cette stack ?
- **React + Vite** : Performance optimale, HMR rapide, écosystème riche
- **TailwindCSS** : Design system cohérent, développement rapide
- **shadcn/ui** : Composants accessibles, personnalisables, professionnels
- **Zustand** : State management simple sans boilerplate
- **Fichiers JSON** : Simplicité, pas de configuration BDD, portable

---

## 🔧 Intégration Claude Code

### Méthode d'appel CLI

```javascript
// server/services/claudeService.js
const { spawn } = require('child_process');

class ClaudeService {
  /**
   * Appelle Claude Code CLI et retourne la réponse
   * @param {string} prompt - Le prompt à envoyer
   * @param {string} workingDir - Répertoire de travail pour la génération de fichiers
   * @param {function} onData - Callback pour le streaming (optionnel)
   * @returns {Promise<{response: string, files: string[]}>}
   */
  async execute(prompt, workingDir, onData = null) {
    return new Promise((resolve, reject) => {
      const args = ['-p', prompt, '--output-format', 'json'];
      const claude = spawn('claude', args, { 
        cwd: workingDir,
        shell: true 
      });
      
      let stdout = '';
      let stderr = '';

      claude.stdout.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;
        if (onData) onData(chunk); // Pour le streaming vers le client
      });

      claude.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      claude.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Claude exited with code ${code}: ${stderr}`));
          return;
        }
        
        // Parser la réponse et détecter les fichiers créés
        const files = this.detectCreatedFiles(workingDir);
        resolve({ response: stdout, files });
      });
    });
  }

  /**
   * Détecte les fichiers créés/modifiés dans le répertoire
   */
  detectCreatedFiles(dir) {
    // Logique pour scanner les nouveaux fichiers
    // Compare avec un snapshot avant/après exécution
  }
}

module.exports = new ClaudeService();
```

### Streaming vers le frontend (SSE)

```javascript
// server/routes/claude.js
const express = require('express');
const router = express.Router();
const claudeService = require('../services/claudeService');

// Endpoint avec Server-Sent Events pour le streaming
router.post('/projects/:id/generate', async (req, res) => {
  const { id } = req.params;
  const { prompt, phase } = req.body;
  
  // Configuration SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const workingDir = `./projects/${id}/_outputs`;
    
    const result = await claudeService.execute(prompt, workingDir, (chunk) => {
      // Envoie chaque chunk au client en temps réel
      res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
    });

    // Envoie le résultat final
    res.write(`data: ${JSON.stringify({ 
      type: 'complete', 
      response: result.response,
      files: result.files 
    })}\n\n`);
    
  } catch (error) {
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
  } finally {
    res.end();
  }
});

module.exports = router;
```

### Hook React pour le streaming

```jsx
// client/src/hooks/useClaudeStream.js
import { useState, useCallback } from 'react';

export function useClaudeStream() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [response, setResponse] = useState('');
  const [files, setFiles] = useState([]);
  const [error, setError] = useState(null);

  const generate = useCallback(async (projectId, prompt, phase) => {
    setIsStreaming(true);
    setResponse('');
    setFiles([]);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, phase })
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            
            if (data.type === 'chunk') {
              setResponse(prev => prev + data.content);
            } else if (data.type === 'complete') {
              setFiles(data.files);
            } else if (data.type === 'error') {
              setError(data.message);
            }
          }
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsStreaming(false);
    }
  }, []);

  return { generate, isStreaming, response, files, error };
}
```

---

## 📁 Architecture des dossiers

### Structure racine du projet

```
projet-plateforme/
├── server/                          # Backend Node.js/Express
│   ├── app.js                       # Point d'entrée Express
│   ├── config/
│   │   └── index.js                 # Configuration centralisée
│   ├── routes/
│   │   ├── index.js                 # Router principal
│   │   ├── projects.js              # API gestion projets
│   │   ├── templates.js             # API gestion templates
│   │   └── claude.js                # API intégration Claude
│   ├── services/
│   │   ├── projectService.js        # Logique métier projets
│   │   ├── templateService.js       # Logique métier templates
│   │   ├── historyService.js        # Gestion historique
│   │   └── claudeService.js         # Wrapper Claude CLI
│   ├── middleware/
│   │   ├── errorHandler.js          # Gestion erreurs globale
│   │   └── validation.js            # Validation des requêtes
│   └── utils/
│       ├── fileUtils.js             # Utilitaires fichiers
│       └── logger.js                # Configuration logging
│
├── client/                          # Frontend React
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── src/
│   │   ├── main.jsx                 # Point d'entrée React
│   │   ├── App.jsx                  # Composant racine + Router
│   │   ├── index.css                # Styles globaux + Tailwind
│   │   │
│   │   ├── components/              # Composants réutilisables
│   │   │   ├── ui/                  # Composants shadcn/ui
│   │   │   │   ├── button.jsx
│   │   │   │   ├── card.jsx
│   │   │   │   ├── input.jsx
│   │   │   │   ├── progress.jsx
│   │   │   │   ├── badge.jsx
│   │   │   │   ├── dialog.jsx
│   │   │   │   ├── tabs.jsx
│   │   │   │   └── ...
│   │   │   │
│   │   │   ├── layout/
│   │   │   │   ├── Header.jsx
│   │   │   │   ├── Sidebar.jsx
│   │   │   │   └── Layout.jsx
│   │   │   │
│   │   │   ├── projects/
│   │   │   │   ├── ProjectCard.jsx
│   │   │   │   ├── ProjectList.jsx
│   │   │   │   └── CreateProjectDialog.jsx
│   │   │   │
│   │   │   ├── templates/
│   │   │   │   ├── TemplateCard.jsx
│   │   │   │   └── TemplateGrid.jsx
│   │   │   │
│   │   │   ├── phases/
│   │   │   │   ├── PhaseList.jsx
│   │   │   │   ├── PhaseItem.jsx
│   │   │   │   └── PhaseContent.jsx
│   │   │   │
│   │   │   ├── questionnaire/
│   │   │   │   ├── QuestionnaireForm.jsx
│   │   │   │   ├── QuestionItem.jsx
│   │   │   │   ├── QuestionInput.jsx
│   │   │   │   └── QuestionProgress.jsx
│   │   │   │
│   │   │   └── ai/
│   │   │       ├── AIGenerationPanel.jsx
│   │   │       ├── StreamingResponse.jsx
│   │   │       └── GeneratedFilesList.jsx
│   │   │
│   │   ├── pages/
│   │   │   ├── HomePage.jsx         # Page d'accueil
│   │   │   ├── ProjectPage.jsx      # Page gestion projet
│   │   │   └── NotFoundPage.jsx     # Page 404
│   │   │
│   │   ├── hooks/
│   │   │   ├── useProjects.js       # Hook gestion projets
│   │   │   ├── useTemplates.js      # Hook gestion templates
│   │   │   ├── useQuestionnaire.js  # Hook questionnaires
│   │   │   └── useClaudeStream.js   # Hook streaming IA
│   │   │
│   │   ├── stores/
│   │   │   ├── projectStore.js      # State global projets
│   │   │   └── uiStore.js           # State UI (modals, etc.)
│   │   │
│   │   ├── lib/
│   │   │   ├── api.js               # Client API centralisé
│   │   │   └── utils.js             # Fonctions utilitaires
│   │   │
│   │   └── styles/
│   │       └── globals.css
│   │
│   └── package.json
│
├── structure/                       # Dossier des templates
│   ├── cahier-des-charges-web/
│   └── recette-cuisine/
│
├── projects/                        # Dossier des projets créés
│   └── .gitkeep
│
├── package.json                     # Workspace root
├── .gitignore
└── README.md
```

### Structure obligatoire d'une template

```
structure/[nom-template]/
├── _sujet/
│   └── sujet.md               # Description de la template (OBLIGATOIRE)
├── _config/
│   └── config.json            # Configuration générale
├── _base/
│   └── instructions.md        # Instructions pour l'IA
├── _phases/
│   ├── 01-[nom-phase]/
│   │   ├── phase.json         # Métadonnées de la phase
│   │   └── questions.json     # Questions de cette phase
│   ├── 02-[nom-phase]/
│   │   └── ...
│   └── ...
├── _templates/                # Templates de documents (optionnel)
├── _tools/                    # Scripts utilitaires (optionnel)
└── _tracking/                 # Configuration suivi (optionnel)
```

### Structure d'un projet créé

```
projects/[id-projet]/
├── project.json               # Métadonnées du projet
├── history.json               # Historique complet
├── _phases/
│   ├── 01-[nom-phase]/
│   │   ├── status.json        # État de la phase
│   │   └── questions.json     # Questions avec réponses
│   └── ...
└── _outputs/                  # Fichiers générés par Claude
    └── ...
```

---

## 📄 Formats de fichiers JSON

### config.json (template)

```json
{
  "name": "Nom de la template",
  "description": "Description courte",
  "version": "1.0.0",
  "author": "Auteur",
  "icon": "FileText",
  "color": "blue",
  "phases_count": 6,
  "created_at": "2025-01-11",
  "tags": ["web", "cahier-des-charges"]
}
```

### phase.json

```json
{
  "id": "01-informations-generales",
  "name": "Informations générales",
  "description": "Collecte des informations de base du projet",
  "type": "questionnaire",
  "order": 1,
  "required": true,
  "ai_interaction": false,
  "icon": "Info",
  "estimated_time": "10 min"
}
```

### questions.json (questionnaire)

```json
{
  "phase_id": "01-informations-generales",
  "total_questions": 5,
  "questions": [
    {
      "id": 1,
      "label": "Quel est le nom du projet ?",
      "type": "text",
      "required": true,
      "placeholder": "Ex: Mon super site web",
      "help": "Choisissez un nom court et mémorable",
      "response": null,
      "answered_at": null
    },
    {
      "id": 2,
      "label": "Quelle est la date de livraison souhaitée ?",
      "type": "date",
      "required": true,
      "response": null,
      "answered_at": null
    },
    {
      "id": 3,
      "label": "Quel est le budget estimé ?",
      "type": "select",
      "required": false,
      "options": [
        { "value": "small", "label": "< 5 000€" },
        { "value": "medium", "label": "5 000€ - 15 000€" },
        { "value": "large", "label": "15 000€ - 50 000€" },
        { "value": "enterprise", "label": "> 50 000€" }
      ],
      "response": null,
      "answered_at": null
    },
    {
      "id": 4,
      "label": "Décrivez brièvement votre projet",
      "type": "textarea",
      "required": true,
      "placeholder": "Décrivez le contexte, les objectifs principaux...",
      "rows": 5,
      "response": null,
      "answered_at": null
    },
    {
      "id": 5,
      "label": "Le site doit-il être multilingue ?",
      "type": "boolean",
      "required": true,
      "response": null,
      "answered_at": null
    },
    {
      "id": 6,
      "label": "Quelles fonctionnalités sont prioritaires ?",
      "type": "checkbox",
      "required": false,
      "options": [
        { "value": "blog", "label": "Blog / Actualités" },
        { "value": "ecommerce", "label": "E-commerce" },
        { "value": "members", "label": "Espace membres" },
        { "value": "contact", "label": "Formulaire de contact" },
        { "value": "newsletter", "label": "Newsletter" }
      ],
      "response": [],
      "answered_at": null
    }
  ]
}
```

**Types de questions supportés :**
- `text` : Champ texte simple
- `textarea` : Zone de texte multiligne
- `number` : Champ numérique
- `date` : Sélecteur de date
- `select` : Liste déroulante (choix unique)
- `checkbox` : Cases à cocher (choix multiples)
- `radio` : Boutons radio (choix unique)
- `boolean` : Switch Oui/Non
- `range` : Slider avec valeurs min/max
- `file` : Upload de fichier

### project.json

```json
{
  "id": "proj-2025-001",
  "name": "Mon projet",
  "template": "cahier-des-charges-web",
  "template_name": "Cahier des charges Web",
  "created_at": "2025-01-11T10:30:00Z",
  "updated_at": "2025-01-11T14:45:00Z",
  "current_phase": "02-analyse-besoins",
  "current_question": 3,
  "status": "in_progress",
  "completion": 35,
  "phases_status": {
    "01-informations-generales": "completed",
    "02-analyse-besoins": "in_progress",
    "03-specifications-fonctionnelles": "pending",
    "04-specifications-techniques": "pending",
    "05-validation": "pending",
    "06-export-final": "pending"
  },
  "metadata": {
    "total_questions": 45,
    "answered_questions": 16,
    "generated_files": []
  }
}
```

### history.json

```json
{
  "project_id": "proj-2025-001",
  "entries": [
    {
      "id": "entry-001",
      "timestamp": "2025-01-11T10:30:00Z",
      "action": "project_created",
      "icon": "Plus",
      "details": { 
        "template": "cahier-des-charges-web",
        "name": "Mon projet"
      }
    },
    {
      "id": "entry-002",
      "timestamp": "2025-01-11T10:35:00Z",
      "action": "question_answered",
      "icon": "MessageSquare",
      "details": {
        "phase": "01-informations-generales",
        "phase_name": "Informations générales",
        "question_id": 1,
        "question_label": "Nom du projet",
        "response": "Site e-commerce Bio"
      }
    },
    {
      "id": "entry-003",
      "timestamp": "2025-01-11T11:00:00Z",
      "action": "phase_completed",
      "icon": "CheckCircle",
      "details": { 
        "phase": "01-informations-generales",
        "phase_name": "Informations générales"
      }
    },
    {
      "id": "entry-004",
      "timestamp": "2025-01-11T14:00:00Z",
      "action": "ai_generation",
      "icon": "Sparkles",
      "details": {
        "phase": "06-export-final",
        "prompt_preview": "Génère le cahier des charges...",
        "files_created": ["cahier-des-charges.md", "annexes.md"],
        "ai_response_preview": "J'ai créé le cahier des charges...",
        "duration_ms": 45000
      }
    }
  ]
}
```

### status.json (phase)

```json
{
  "phase_id": "01-informations-generales",
  "status": "completed",
  "started_at": "2025-01-11T10:30:00Z",
  "completed_at": "2025-01-11T11:00:00Z",
  "questions_answered": 8,
  "questions_total": 8,
  "ai_generations": []
}
```

---

## 🎨 Interface utilisateur moderne

### Design System

#### Palette de couleurs (TailwindCSS)

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
        }
      }
    }
  }
}
```

#### Composants UI principaux (shadcn/ui)
- **Card** : Conteneurs projets et templates
- **Button** : Actions principales et secondaires
- **Progress** : Barres de progression des phases
- **Badge** : Statuts et tags
- **Dialog** : Modales de création
- **Tabs** : Navigation dans les phases
- **Form** : Formulaires questionnaires
- **Toast** : Notifications
- **Skeleton** : États de chargement

---

### Page d'accueil (HomePage.jsx)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  🚀 ProjectForge              [Rechercher...]        [?] [User] │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                                                                 │   │
│  │   Bienvenue sur ProjectForge                                    │   │
│  │   Créez et gérez vos projets avec l'aide de l'IA               │   │
│  │                                                                 │   │
│  │   [+ Nouveau projet]                                            │   │
│  │                                                                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ══════════════════════════════════════════════════════════════════    │
│  MES PROJETS                                          [Tous ▼] [Grid]   │
│  ══════════════════════════════════════════════════════════════════    │
│                                                                         │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐     │
│  │ 📄 Site Bio      │  │ 🍳 Recette Noël  │  │ 📄 App Mobile    │     │
│  │                  │  │                  │  │                  │     │
│  │ Cahier des       │  │ Recette de       │  │ Cahier des       │     │
│  │ charges Web      │  │ cuisine          │  │ charges Web      │     │
│  │                  │  │                  │  │                  │     │
│  │ ████████░░ 80%   │  │ ██████░░░░ 60%   │  │ ██░░░░░░░░ 20%   │     │
│  │ Phase 5/6        │  │ Phase 3/5        │  │ Phase 1/6        │     │
│  │                  │  │                  │  │                  │     │
│  │ Modifié: 2h      │  │ Modifié: 1j      │  │ Modifié: 3j      │     │
│  │                  │  │                  │  │                  │     │
│  │ [Continuer →]    │  │ [Continuer →]    │  │ [Continuer →]    │     │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘     │
│                                                                         │
│  ══════════════════════════════════════════════════════════════════    │
│  TEMPLATES DISPONIBLES                                                  │
│  ══════════════════════════════════════════════════════════════════    │
│                                                                         │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐     │
│  │      📄          │  │      🍳          │  │      ➕          │     │
│  │                  │  │                  │  │                  │     │
│  │ Cahier des       │  │ Recette de       │  │                  │     │
│  │ charges Web      │  │ cuisine          │  │  Bientôt...      │     │
│  │                  │  │                  │  │                  │     │
│  │ Créez un cahier  │  │ Élaborez une     │  │  D'autres        │     │
│  │ des charges      │  │ recette pas à    │  │  templates       │     │
│  │ complet pour     │  │ pas avec l'aide  │  │  arrivent !      │     │
│  │ votre site web   │  │ de l'IA          │  │                  │     │
│  │                  │  │                  │  │                  │     │
│  │ 6 phases         │  │ 5 phases         │  │                  │     │
│  │ ~45 questions    │  │ ~30 questions    │  │                  │     │
│  │                  │  │                  │  │                  │     │
│  │ [Utiliser →]     │  │ [Utiliser →]     │  │                  │     │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Composant ProjectCard

```jsx
// client/src/components/projects/ProjectCard.jsx
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { FileText, ChefHat, Clock, ArrowRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

const iconMap = {
  'cahier-des-charges-web': FileText,
  'recette-cuisine': ChefHat,
};

export function ProjectCard({ project, onClick }) {
  const Icon = iconMap[project.template] || FileText;
  
  return (
    <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-brand-100 text-brand-600">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">{project.name}</h3>
              <p className="text-sm text-muted-foreground">{project.template_name}</p>
            </div>
          </div>
          <Badge variant={project.status === 'completed' ? 'success' : 'secondary'}>
            {project.status === 'completed' ? 'Terminé' : 'En cours'}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="pb-2">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progression</span>
            <span className="font-medium">{project.completion}%</span>
          </div>
          <Progress value={project.completion} className="h-2" />
          <p className="text-sm text-muted-foreground">
            Phase {Object.values(project.phases_status).filter(s => s === 'completed').length + 1} 
            / {Object.keys(project.phases_status).length}
          </p>
        </div>
      </CardContent>
      
      <CardFooter className="flex justify-between items-center">
        <div className="flex items-center text-sm text-muted-foreground">
          <Clock className="h-4 w-4 mr-1" />
          {formatDistanceToNow(new Date(project.updated_at), { addSuffix: true, locale: fr })}
        </div>
        <Button variant="ghost" size="sm" onClick={() => onClick(project.id)}>
          Continuer
          <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
        </Button>
      </CardFooter>
    </Card>
  );
}
```

---

### Page projet (ProjectPage.jsx)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ← Retour    Site e-commerce Bio                    ████████░░ 80%    [⋮]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┬───────────────────────────────────────┬───────────────┐   │
│  │   PHASES    │         CONTENU PRINCIPAL             │   RÉSUMÉ      │   │
│  │             │                                       │               │   │
│  │ ✅ Phase 1  │  ┌─────────────────────────────────┐ │ Questions     │   │
│  │ Infos       │  │                                 │ │ répondues     │   │
│  │ générales   │  │  📋 Analyse des besoins         │ │               │   │
│  │             │  │                                 │ │ 16 / 45       │   │
│  │ ✅ Phase 2  │  │  Identifiez les objectifs et    │ │ ████████░░    │   │
│  │ Analyse     │  │  le public cible de votre       │ │               │   │
│  │ besoins     │  │  projet web.                    │ │ ───────────── │   │
│  │             │  │                                 │ │               │   │
│  │ 🔵 Phase 3  │  │  ⏱️ Temps estimé: 15 min        │ │ Réponses      │   │
│  │ Specs       │  │                                 │ │ récentes:     │   │
│  │ fonction.   │  └─────────────────────────────────┘ │               │   │
│  │             │                                       │ • Nom: Site   │   │
│  │ ⚪ Phase 4  │  ┌─────────────────────────────────┐ │   Bio         │   │
│  │ Specs       │  │  QUESTIONNAIRE                  │ │ • Budget:     │   │
│  │ techniques  │  │                                 │ │   15-50k€     │   │
│  │             │  │  Question 3 / 10                │ │ • Date: Mars  │   │
│  │ ⚪ Phase 5  │  │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ │   2025        │   │
│  │ Validation  │  │  ▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░ │ │               │   │
│  │             │  │                                 │ │ ───────────── │   │
│  │ ⚪ Phase 6  │  │  ┌─────────────────────────┐   │ │               │   │
│  │ Export      │  │  │ Quels sont les          │   │ │ Documents     │   │
│  │ final       │  │  │ objectifs principaux    │   │ │ générés:      │   │
│  │             │  │  │ de votre site ?         │   │ │               │   │
│  │             │  │  │                         │   │ │ Aucun pour    │   │
│  │             │  │  │ ☐ Vendre des produits  │   │ │ l'instant     │   │
│  │             │  │  │ ☐ Générer des leads    │   │ │               │   │
│  │             │  │  │ ☐ Informer             │   │ │               │   │
│  │             │  │  │ ☐ Fidéliser            │   │ │               │   │
│  │             │  │  │ ☐ Recruter             │   │ │               │   │
│  │             │  │  └─────────────────────────┘   │ │               │   │
│  │             │  │                                 │ │               │   │
│  │             │  │  💡 Conseil: Sélectionnez 2-3  │ │               │   │
│  │             │  │     objectifs prioritaires      │ │               │   │
│  │             │  │                                 │ │               │   │
│  │             │  │  ┌─────────┐  ┌─────────────┐  │ │               │   │
│  │             │  │  │← Préc.  │  │  Suivant →  │  │ │               │   │
│  │             │  │  └─────────┘  └─────────────┘  │ │               │   │
│  │             │  │                                 │ │               │   │
│  │             │  │  [Voir toutes les questions]    │ │               │   │
│  │             │  │                                 │ │               │   │
│  │             │  └─────────────────────────────────┘ │               │   │
│  └─────────────┴───────────────────────────────────────┴───────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Vue phase IA (génération)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  │             │                                       │               │   │
│  │ ⚪ Phase 6  │  ┌─────────────────────────────────┐ │ Documents     │   │
│  │ Export      │  │                                 │ │ générés:      │   │
│  │ final 🔵    │  │  ✨ Export final                │ │               │   │
│  │             │  │                                 │ │ 📄 cahier-    │   │
│  │             │  │  Claude va générer votre        │ │    des-       │   │
│  │             │  │  cahier des charges complet     │ │    charges.md │   │
│  │             │  │  basé sur vos réponses.         │ │               │   │
│  │             │  │                                 │ │ 📄 annexes.md │   │
│  │             │  └─────────────────────────────────┘ │               │   │
│  │             │                                       │ 📄 personas.  │   │
│  │             │  ┌─────────────────────────────────┐ │    md         │   │
│  │             │  │  GÉNÉRATION IA                  │ │               │   │
│  │             │  │                                 │ │ [Télécharger  │   │
│  │             │  │  Prompt généré:                 │ │  tout]        │   │
│  │             │  │  ┌─────────────────────────┐   │ │               │   │
│  │             │  │  │ En te basant sur les   │   │ │               │   │
│  │             │  │  │ informations suivantes,│   │ │               │   │
│  │             │  │  │ génère un cahier des   │   │ │               │   │
│  │             │  │  │ charges complet...     │   │ │               │   │
│  │             │  │  └─────────────────────────┘   │ │               │   │
│  │             │  │                                 │ │               │   │
│  │             │  │  ┌───────────────────────────┐ │ │               │   │
│  │             │  │  │ 🚀 Lancer la génération  │ │ │               │   │
│  │             │  │  └───────────────────────────┘ │ │               │   │
│  │             │  │                                 │ │               │   │
│  │             │  │  ═══════════════════════════   │ │               │   │
│  │             │  │                                 │ │               │   │
│  │             │  │  Réponse de Claude:             │ │               │   │
│  │             │  │  ┌─────────────────────────┐   │ │               │   │
│  │             │  │  │ Je vais créer votre    │   │ │               │   │
│  │             │  │  │ cahier des charges...  │   │ │               │   │
│  │             │  │  │                        │   │ │               │   │
│  │             │  │  │ ▋ (curseur clignotant) │   │ │               │   │
│  │             │  │  └─────────────────────────┘   │ │               │   │
│  │             │  │                                 │ │               │   │
│  │             │  └─────────────────────────────────┘ │               │   │
│  └─────────────┴───────────────────────────────────────┴───────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Composant QuestionnaireForm

```jsx
// client/src/components/questionnaire/QuestionnaireForm.jsx
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { QuestionInput } from './QuestionInput';
import { ChevronLeft, ChevronRight, List } from 'lucide-react';

export function QuestionnaireForm({ 
  questions, 
  currentIndex, 
  onAnswer, 
  onNavigate,
  onShowAll 
}) {
  const question = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;
  const answeredCount = questions.filter(q => q.response !== null).length;

  return (
    <div className="space-y-6">
      {/* Barre de progression */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Question {currentIndex + 1} / {questions.length}</span>
          <span>{answeredCount} répondues</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Question avec animation */}
      <AnimatePresence mode="wait">
        <motion.div
          key={question.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="bg-card rounded-lg border p-6"
        >
          <div className="space-y-4">
            <div>
              <label className="text-lg font-medium">
                {question.label}
                {question.required && <span className="text-destructive ml-1">*</span>}
              </label>
              {question.help && (
                <p className="text-sm text-muted-foreground mt-1">{question.help}</p>
              )}
            </div>

            <QuestionInput
              question={question}
              value={question.response}
              onChange={(value) => onAnswer(question.id, value)}
            />
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <Button
          variant="outline"
          onClick={() => onNavigate(currentIndex - 1)}
          disabled={currentIndex === 0}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Précédent
        </Button>

        <Button variant="ghost" size="sm" onClick={onShowAll}>
          <List className="h-4 w-4 mr-1" />
          Voir tout
        </Button>

        <Button
          onClick={() => onNavigate(currentIndex + 1)}
          disabled={currentIndex === questions.length - 1}
        >
          Suivant
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
```

#### Composant AIGenerationPanel

```jsx
// client/src/components/ai/AIGenerationPanel.jsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, Copy, Download, Loader2 } from 'lucide-react';
import { useClaudeStream } from '@/hooks/useClaudeStream';
import { StreamingResponse } from './StreamingResponse';
import { GeneratedFilesList } from './GeneratedFilesList';

export function AIGenerationPanel({ projectId, phase, prompt }) {
  const { generate, isStreaming, response, files, error } = useClaudeStream();
  const [showPrompt, setShowPrompt] = useState(true);

  const handleGenerate = () => {
    generate(projectId, prompt, phase.id);
  };

  return (
    <div className="space-y-6">
      {/* Aperçu du prompt */}
      <Card className="p-4">
        <div className="flex justify-between items-center mb-2">
          <h4 className="font-medium">Prompt généré</h4>
          <Button variant="ghost" size="sm" onClick={() => setShowPrompt(!showPrompt)}>
            {showPrompt ? 'Masquer' : 'Afficher'}
          </Button>
        </div>
        {showPrompt && (
          <ScrollArea className="h-32 rounded border bg-muted/50 p-3">
            <pre className="text-sm whitespace-pre-wrap">{prompt}</pre>
          </ScrollArea>
        )}
      </Card>

      {/* Bouton de génération */}
      <Button 
        size="lg" 
        className="w-full"
        onClick={handleGenerate}
        disabled={isStreaming}
      >
        {isStreaming ? (
          <>
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            Génération en cours...
          </>
        ) : (
          <>
            <Sparkles className="h-5 w-5 mr-2" />
            Lancer la génération
          </>
        )}
      </Button>

      {/* Réponse en streaming */}
      {(response || isStreaming) && (
        <Card className="p-4">
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-medium">Réponse de Claude</h4>
            <Button variant="ghost" size="sm">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <StreamingResponse content={response} isStreaming={isStreaming} />
        </Card>
      )}

      {/* Fichiers générés */}
      {files.length > 0 && (
        <Card className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-medium">Fichiers générés</h4>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-1" />
              Tout télécharger
            </Button>
          </div>
          <GeneratedFilesList files={files} projectId={projectId} />
        </Card>
      )}

      {/* Erreur */}
      {error && (
        <Card className="p-4 border-destructive bg-destructive/10">
          <p className="text-destructive">{error}</p>
        </Card>
      )}
    </div>
  );
}
```

---

## 📦 Templates à créer

### Template 1 : Cahier des charges de site web

```
structure/cahier-des-charges-web/
├── _sujet/
│   └── sujet.md
├── _config/
│   └── config.json
├── _base/
│   └── instructions.md          # Comment rédiger un bon cahier des charges
├── _phases/
│   ├── 01-informations-generales/
│   │   ├── phase.json
│   │   └── questions.json       # Nom, client, dates, budget, contexte
│   ├── 02-analyse-besoins/
│   │   ├── phase.json
│   │   └── questions.json       # Objectifs, cibles, fonctionnalités attendues
│   ├── 03-specifications-fonctionnelles/
│   │   ├── phase.json
│   │   └── questions.json       # Pages, navigation, contenus, interactions
│   ├── 04-specifications-techniques/
│   │   ├── phase.json
│   │   └── questions.json       # Hébergement, technologies, performances, SEO
│   ├── 05-validation/
│   │   ├── phase.json
│   │   └── questions.json       # Relecture, validation des choix
│   └── 06-export-final/
│       ├── phase.json           # type: "ai_generation"
│       └── prompt-template.md   # Template du prompt pour Claude
├── _templates/
│   └── cahier-des-charges-template.md
└── _tracking/
    └── tracking-config.json
```

**Questions suggérées par phase :**

**Phase 1 - Informations générales (8-10 questions)**
- Nom du projet
- Nom du client/entreprise
- Secteur d'activité
- Date de livraison souhaitée
- Budget estimé
- Contacts principaux
- Contexte du projet
- Existe-t-il un site actuel ?

**Phase 2 - Analyse des besoins (10-12 questions)**
- Objectifs principaux du site
- Public cible (personas)
- Problèmes à résoudre
- Concurrents identifiés
- Fonctionnalités indispensables
- Fonctionnalités souhaitées
- Contenus existants à intégrer
- Ton et style de communication

**Phase 3 - Spécifications fonctionnelles (12-15 questions)**
- Liste des pages principales
- Structure de navigation
- Types de contenus par page
- Formulaires nécessaires
- Espace membre/connexion
- E-commerce (si applicable)
- Blog/actualités
- Multilingue
- Intégrations tierces (CRM, analytics, etc.)

**Phase 4 - Spécifications techniques (8-10 questions)**
- Préférences technologiques (CMS, framework)
- Hébergement existant ou à prévoir
- Nom de domaine
- Contraintes performances
- Responsive/mobile-first
- Accessibilité (RGAA/WCAG)
- SEO prioritaire
- Sécurité (HTTPS, RGPD)

**Phase 5 - Validation (5 questions)**
- Validation des objectifs
- Validation du périmètre
- Validation du planning
- Points d'attention
- Remarques finales

**Phase 6 - Export final (interaction IA)**
- Génération automatique du cahier des charges complet
- Documents annexes (personas, arborescence, etc.)

---

### Template 2 : Recette de cuisine

```
structure/recette-cuisine/
├── _sujet/
│   └── sujet.md
├── _config/
│   └── config.json
├── _base/
│   └── instructions.md          # Comment structurer une recette
├── _phases/
│   ├── 01-informations-generales/
│   │   ├── phase.json
│   │   └── questions.json       # Nom recette, occasion, nombre personnes
│   ├── 02-analyse-envie/
│   │   ├── phase.json
│   │   └── questions.json       # Type cuisine, saveurs, contraintes
│   ├── 03-specifications-recette/
│   │   ├── phase.json
│   │   └── questions.json       # Difficulté, temps, technique
│   ├── 04-specifications-ingredients/
│   │   ├── phase.json
│   │   └── questions.json       # Ingrédients dispo, allergies, budget
│   └── 05-export-final/
│       ├── phase.json           # type: "ai_generation"
│       └── prompt-template.md   # Template du prompt pour Claude
└── _templates/
    └── recette-template.md
```

**Questions suggérées par phase :**

**Phase 1 - Informations générales (5-6 questions)**
- Nom de la recette (si idée précise)
- Pour quelle occasion ?
- Nombre de personnes
- Type de plat (entrée, plat, dessert)
- Temps disponible pour cuisiner

**Phase 2 - Analyse envie (6-8 questions)**
- Type de cuisine (française, italienne, asiatique...)
- Saveurs recherchées (sucré, salé, épicé...)
- Texture souhaitée
- Chaud ou froid
- Léger ou consistant
- Inspiration (plat vu quelque part ?)

**Phase 3 - Spécifications recette (5-6 questions)**
- Niveau de difficulté acceptable
- Techniques maîtrisées
- Équipements disponibles
- Présentation importante ?
- Recette à préparer à l'avance ?

**Phase 4 - Spécifications ingrédients (6-8 questions)**
- Ingrédients déjà disponibles
- Ingrédients à éviter (allergies, goûts)
- Régime alimentaire particulier
- Budget courses
- Produits de saison préférés
- Marques ou qualités préférées

**Phase 5 - Export final (interaction IA)**
- Génération de la recette complète
- Liste de courses
- Conseils et variantes

---

## 🔌 API Backend

### Routes principales

```javascript
// Templates
GET    /api/templates                              // Liste des templates
GET    /api/templates/:name                        // Détails d'une template
GET    /api/templates/:name/phases                 // Phases d'une template
GET    /api/templates/:name/phases/:phaseId        // Questions d'une phase

// Projets
GET    /api/projects                               // Liste des projets
POST   /api/projects                               // Créer un projet
GET    /api/projects/:id                           // Détails d'un projet
PATCH  /api/projects/:id                           // Mettre à jour un projet
DELETE /api/projects/:id                           // Supprimer un projet

// Phases et questionnaires
GET    /api/projects/:id/phases                    // Phases du projet
GET    /api/projects/:id/phases/:phaseId           // Détails d'une phase
PATCH  /api/projects/:id/phases/:phaseId/status    // Changer statut phase

// Questions
GET    /api/projects/:id/phases/:phaseId/questions         // Questions d'une phase
PUT    /api/projects/:id/phases/:phaseId/questions/:qId    // Répondre/modifier

// Intégration Claude (SSE)
POST   /api/projects/:id/generate                  // Lancer génération IA
GET    /api/projects/:id/outputs                   // Liste fichiers générés
GET    /api/projects/:id/outputs/:filename         // Télécharger un fichier

// Historique
GET    /api/projects/:id/history                   // Historique du projet
```

### Schémas de validation (Zod)

```javascript
// server/validation/schemas.js
const { z } = require('zod');

const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  template: z.string().min(1)
});

const answerQuestionSchema = z.object({
  response: z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.string())
  ])
});

const generateSchema = z.object({
  phase: z.string(),
  customPrompt: z.string().optional()
});

module.exports = {
  createProjectSchema,
  answerQuestionSchema,
  generateSchema
};
```

---

## ✅ Ordre de développement suggéré

### Sprint 1 : Fondations (2-3 jours)
1. Initialisation projet : Vite + React + TailwindCSS + shadcn/ui
2. Configuration serveur Express avec structure de dossiers
3. Mise en place des routes API de base
4. Service de gestion des templates (lecture fichiers)
5. Service de gestion des projets (CRUD)

### Sprint 2 : Templates (1-2 jours)
6. Création template "cahier-des-charges-web" complète avec tous les JSON
7. Création template "recette-cuisine" complète
8. Validation et tests de la structure des templates

### Sprint 3 : Interface - Page d'accueil (2-3 jours)
9. Layout principal avec Header
10. Composant TemplateCard et TemplateGrid
11. Composant ProjectCard et ProjectList
12. Dialog de création de projet
13. Hook useProjects et useTemplates

### Sprint 4 : Interface - Page projet (3-4 jours)
14. Layout 3 colonnes avec Sidebar phases
15. Composant PhaseList avec statuts visuels
16. Composant QuestionnaireForm avec navigation
17. Composants QuestionInput pour chaque type
18. Panel de résumé avec réponses
19. Sauvegarde automatique des réponses

### Sprint 5 : Intégration Claude (2-3 jours)
20. Service claudeService.js avec spawn et streaming
21. Route SSE pour génération
22. Hook useClaudeStream
23. Composant AIGenerationPanel
24. Affichage streaming et fichiers générés

### Sprint 6 : Finalisation (2-3 jours)
25. Système d'historique complet avec timeline
26. Reprise de projet (navigation vers dernière position)
27. Notifications toast pour feedback utilisateur
28. Responsive design (mobile/tablet)
29. Tests end-to-end
30. Documentation README

---

## 🚀 Commande de démarrage pour Claude Code

```
Crée la plateforme ProjectForge selon les spécifications du document.

STACK:
- Backend: Node.js + Express
- Frontend: React 18 + Vite + TailwindCSS + shadcn/ui
- Pas de base de données, fichiers JSON uniquement

ORDRE:
1. Initialise le projet avec la structure de dossiers complète
2. Configure Vite, TailwindCSS, shadcn/ui
3. Crée les composants UI de base (Button, Card, Progress, etc.)
4. Implémente les services backend (templates, projects, claude)
5. Crée les deux templates complètes avec questionnaires JSON
6. Développe la page d'accueil avec liste projets et templates
7. Développe la page projet avec navigation phases et questionnaire
8. Intègre le streaming Claude Code avec SSE
9. Ajoute le système d'historique

IMPORTANT:
- Design moderne et professionnel
- Animations fluides avec Framer Motion
- Toutes les réponses sauvegardées en temps réel
- Streaming de la réponse Claude vers l'interface
- Code TypeScript-ready (JSDoc pour typage)

Commence par créer la structure complète puis implémente chaque partie.
```

---

## 📝 Notes importantes

- **Persistance** : Tout est stocké dans des fichiers JSON, pas de base de données
- **Cohérence** : Les templates garantissent des projets uniformes
- **Traçabilité** : L'historique permet de reprendre à tout moment
- **Évolutivité** : Nouvelles templates ajoutables facilement
- **UX moderne** : Interface fluide comparable aux SaaS actuels
- **Performance** : React + Vite pour un dev et runtime optimaux
- **Accessibilité** : Composants shadcn/ui basés sur Radix UI (ARIA compliant)
- **Streaming** : Réponse Claude affichée en temps réel via SSE
2222