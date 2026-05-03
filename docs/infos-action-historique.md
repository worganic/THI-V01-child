# Système d'historisation des actions — wo-action-history

> Introduit en B0.26. Permet de tracer et d'afficher toutes les actions critiques réalisées par les utilisateurs, avec diff before/after et mécanisme d'annulation (undo).

---

## Architecture d'ensemble

```
Angular (frontend)
  └── WoActionHistoryService        ← service injecté dans les composants qui tracent
        ├── track()                 ← enregistre une action
        ├── load()                  ← charge l'historique depuis la BDD
        └── undo()                  ← annule une action réversible

Express (server-data.js)
  ├── GET  /api/wo-action-history   ← liste filtrée des actions
  ├── POST /api/wo-action-history   ← enregistrement d'une action
  ├── POST /api/wo-action-history/:id/undo  ← exécute le undo
  └── DELETE /api/wo-action-history ← purge complète

MySQL
  └── table wo_action_history       ← persistance (créée par init-db.js)
```

---

## Table MySQL

Définie dans `server/init-db.js` — créée automatiquement au démarrage si absente.

```sql
CREATE TABLE IF NOT EXISTS wo_action_history (
    id            VARCHAR(50)   PRIMARY KEY,          -- ex: wah-042
    timestamp     DATETIME      DEFAULT CURRENT_TIMESTAMP,
    section       VARCHAR(100)  NOT NULL,              -- ex: 'admin/users', 'documents'
    subsection    VARCHAR(100)  DEFAULT '',
    action_type   VARCHAR(50)   NOT NULL,              -- create|update|delete|toggle|upload|navigate
    label         VARCHAR(500)  NOT NULL,              -- texte lisible pour l'UI
    entity_type   VARCHAR(100)  DEFAULT '',            -- ex: 'user', 'document', 'category'
    entity_id     VARCHAR(100)  DEFAULT '',
    entity_label  VARCHAR(255)  DEFAULT '',
    before_state  JSON          DEFAULT NULL,          -- état avant l'action
    after_state   JSON          DEFAULT NULL,          -- état après l'action
    user_id       CHAR(36)      NULL,
    username      VARCHAR(255)  DEFAULT '',
    context       JSON          DEFAULT NULL,          -- données contextuelles libres
    undoable      BOOLEAN       DEFAULT FALSE,
    undone        BOOLEAN       DEFAULT FALSE,
    undone_at     DATETIME      NULL,
    undone_by     VARCHAR(255)  DEFAULT '',
    undo_action   JSON          DEFAULT NULL,          -- endpoint + method + payload pour le undo
    meta          JSON          DEFAULT NULL,          -- métadonnées libres
    INDEX idx_wah_section  (section),
    INDEX idx_wah_user     (user_id),
    INDEX idx_wah_entity   (entity_type, entity_id)
)
```

---

## Service Angular — WoActionHistoryService

Fichier : `frankenstein/src/app/core/services/wo-action-history.service.ts`

Injecté via `inject(WoActionHistoryService)` dans n'importe quel composant standalone.

### Types exportés

```typescript
type WoActionType = 'create' | 'update' | 'delete' | 'toggle' | 'upload' | 'navigate';

interface WoUndoAction {
  endpoint: string;            // route Express à appeler pour annuler
  method: 'DELETE' | 'PUT' | 'POST' | 'PATCH';
  payload?: any;               // body à envoyer si PUT/POST/PATCH
}

interface WoActionEntry {
  id: string;
  timestamp: string;
  section: string;             // identifiant de la zone fonctionnelle
  subsection?: string;
  actionType: WoActionType;
  label: string;               // texte affiché dans l'historique
  entityType?: string;
  entityId?: string | number;
  entityLabel?: string;
  beforeState?: any;           // objet snapshot avant modification
  afterState?: any;            // objet snapshot après modification
  userId?: string;
  username?: string;
  context?: Record<string, any>;
  undoable: boolean;
  undone: boolean;
  undoneAt?: string;
  undoneBy?: string;
  undoAction?: WoUndoAction;
  meta?: Record<string, any>;
}
```

### Méthodes

| Méthode | Description |
|---|---|
| `track(ctx)` | Enregistre une action. Retourne une `Promise<WoActionEntry>`. Ne jamais `await` dans le flux principal — utiliser `.catch(() => {})`. |
| `load(filters?)` | Charge les entrées depuis l'API. Accepte des filtres optionnels. |
| `undo(actionId)` | Déclenche l'annulation d'une action réversible. |
| `getBySection(section)` | Filtre local par section. |
| `getByContext(key, value)` | Filtre local par champ de contexte. |

---

## Ajouter le tracking dans un composant

### 1. Injecter le service

```typescript
import { WoActionHistoryService } from '../../../../core/services/wo-action-history.service';

private woHistory = inject(WoActionHistoryService);
```

### 2. Tracer une création (avec undo)

```typescript
// Après la création réussie
this.woHistory.track({
  section: 'documents',
  actionType: 'create',
  label: `Création du document «${title}»`,
  entityType: 'document',
  entityId: newDoc.id,
  entityLabel: title,
  afterState: { title, description, categoryId, visible },
  undoable: true,
  undoAction: {
    endpoint: `/api/documents/${newDoc.id}`,
    method: 'DELETE'
  }
}).catch(() => {});
```

### 3. Tracer une modification (avec diff avant/après)

```typescript
// Capturer l'état AVANT, puis appeler l'API, puis tracker
const before = { username: user.username, email: user.email, role: user.role };
await this.authService.updateUser(user.id, newData);

this.woHistory.track({
  section: 'admin/users',
  actionType: 'update',
  label: `Modification de l'utilisateur «${newUsername}»`,
  entityType: 'user',
  entityId: user.id,
  entityLabel: newUsername,
  beforeState: before,
  afterState: { username: newUsername, email: newEmail, role: newRole },
  undoable: true,
  undoAction: {
    endpoint: `/api/auth/users/${user.id}`,
    method: 'PUT',
    payload: before     // payload = état avant, pour restaurer
  }
}).catch(() => {});
```

### 4. Tracer une suppression (sans undo)

```typescript
this.woHistory.track({
  section: 'admin/users',
  actionType: 'delete',
  label: `Suppression de l'utilisateur «${user.username}»`,
  entityType: 'user',
  entityId: user.id,
  entityLabel: user.username,
  beforeState: { username: user.username, email: user.email, role: user.role },
  undoable: false
}).catch(() => {});
```

### 5. Utiliser le contexte pour des données supplémentaires

```typescript
this.woHistory.track({
  section: 'projets',
  actionType: 'update',
  label: `Modification du projet «${project.name}»`,
  entityType: 'project',
  entityId: project.id,
  entityLabel: project.name,
  beforeState: before,
  afterState: after,
  context: { projectName: project.name, framework: project.framework },
  undoable: false
}).catch(() => {});
```

---

## Règles importantes

### Ne jamais await track() dans le flux principal
Le tracking est secondaire. Si l'API échoue, l'action principale (création, modif) ne doit pas échouer.

```typescript
// ✅ Correct
this.woHistory.track({ ... }).catch(() => {});

// ❌ Incorrect — bloque en cas d'erreur de tracking
await this.woHistory.track({ ... });
```

### Capturer beforeState AVANT l'appel API
L'état avant doit être snapshottted avant toute modification.

```typescript
const before = { ...entityCurrentState };   // snapshot
await apiCall(newData);                      // modification
this.woHistory.track({ beforeState: before, afterState: newData, ... }).catch(() => {});
```

### beforeState/afterState : objets plats recommandés
Éviter les objets imbriqués profonds — le diff s'affiche champ par champ dans l'UI. Les champs `password`, `token`, `secret`, `hash` sont automatiquement filtrés à l'affichage.

---

## Affichage dans l'interface — page wo-action-history

Composant : `frankenstein/src/app/pages/user/wo-action-history/wo-action-history.component.ts`

Route : `/wo-action-history`

### Fonctionnalités de la page
- Groupement par jour
- Filtres : section, utilisateur, type d'action
- Affichage du diff before/after par entrée (champs modifiés surlignés)
- Bouton undo pour les actions réversibles

### Ajouter une section dans le panneau info ("outils trackés")
Dans `wo-action-history.component.ts`, tableau `trackedTools` :

```typescript
{
  label: 'Ma Section › Mon outil',
  section: 'ma-section',           // doit correspondre au champ section utilisé dans track()
  icon: 'folder',                  // material icon
  colorText: 'text-blue-400',
  colorBg: 'bg-blue-500/5 border-blue-500/15',
  actions: [
    { type: 'create', label: 'Création',     undoable: true,  note: 'Description de l\'annulation' },
    { type: 'update', label: 'Modification', undoable: true,  note: 'Champs restaurés' },
    { type: 'delete', label: 'Suppression',  undoable: false, note: 'Non réversible' }
  ]
}
```

### Ajouter des labels de champ pour le diff
Dans `wo-action-history.component.ts`, méthode `fieldLabel()` :

```typescript
fieldLabel(field: string): string {
  const labels: Record<string, string> = {
    username: 'Nom', email: 'Email', role: 'Rôle',
    name: 'Nom', description: 'Description',
    // Ajouter ici les champs spécifiques à votre outil
    myField: 'Mon libellé',
  };
  return labels[field] || field;
}
```

### Ajouter un label de section
Dans `wo-action-history.component.ts`, méthode `sectionLabel()` :

```typescript
sectionLabel(section: string): string {
  const labels: Record<string, string> = {
    'admin/users': 'Admin › Utilisateurs',
    'documents': 'Documents',
    'ma-section': 'Mon › Outil',    // ← ajouter ici
  };
  return labels[section] || section;
}
```

---

## Activation de la page (toggle nav)

La page est masquée par défaut. Elle s'active via **Admin → Config → Liens de navigation**.

### Mécanisme
- Signal dans `ConfigService` : `woActionHistoryNavEnabled`
- Persisté dans `conf.json` (clé `navItems.woActionHistory`)
- Nav template : `@if (configService.woActionHistoryNavEnabled()) { ... }`
- Toggle dans `config.component.ts` : `toggleWoActionHistoryNav()`

### Ajouter un nouvel item de nav conditionnel (pattern réutilisable)
Ce pattern peut être réutilisé pour d'autres pages optionnelles :

**`config.service.ts`** — ajouter le signal et la méthode save :
```typescript
monOutil = signal<boolean>(false);

// Dans load() :
if (keys.navItems?.monOutil !== undefined) this.monOutil.set(keys.navItems.monOutil);

// Nouvelle méthode :
saveNavItems(items: { woActionHistory?: boolean; monOutil?: boolean }) {
  if (items.monOutil !== undefined) this.monOutil.set(items.monOutil);
  this.http.post(`${API}/api/config/keys`, {
    navItems: { woActionHistory: this.woActionHistoryNavEnabled(), monOutil: this.monOutil() }
  }).subscribe();
}
```

**`nav.component.html`** — conditionner l'affichage :
```html
@if (configService.monOutil()) {
  <a routerLink="/mon-outil" ...>Mon outil</a>
}
```

---

## Checklist — intégrer le tracking dans un nouvel outil

- [ ] Injecter `WoActionHistoryService` dans le composant
- [ ] Définir les `section` constants (ex: `'projets'`, `'recette/fiches'`)
- [ ] Capturer `beforeState` AVANT l'appel API pour les updates
- [ ] Appeler `track()` après chaque opération CRUD, avec `.catch(() => {})`
- [ ] Définir `undoAction` si la création est réversible (DELETE sur l'entité créée)
- [ ] Définir `undoAction` si la modification est réversible (PUT avec `payload: before`)
- [ ] Ajouter l'entrée dans `trackedTools[]` dans le composant wo-action-history
- [ ] Ajouter les labels de section dans `sectionLabel()`
- [ ] Ajouter les labels de champ dans `fieldLabel()`
