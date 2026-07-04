"""Registre déclaratif des tables MySQL surveillables par le Monitor DB.

Colonnes validées contre les CREATE TABLE réels de server/init-db.js et
server/server-data.js (bloc d'init ~lignes 11710-12250). Ne pas deviner
des colonnes qui n'existent pas — toute nouvelle table ajoutée ici doit
être vérifiée contre le DDL correspondant.

id_col peut être soit un nom de colonne simple, soit une expression SQL
(ex: CONCAT(...)) pour les tables à clé primaire composite — le
poll_worker l'utilise tel quel dans `SELECT {id_col} AS __id, ...`.

ts_col = None signifie "pas de colonne temporelle exploitable" : le
poll_worker bascule alors en mode "table entière" (pas de ORDER BY/LIMIT
daté), adapté aux tables à faible volume (réglages, tables singleton).
"""
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class TableSpec:
    name: str
    id_col: str = 'id'
    ts_col: Optional[str] = 'updated_at'
    display_cols: list = field(default_factory=list)
    category: str = 'metier'   # 'metier' | 'collab' | 'mega_outil' | 'admin_test' | 'audit'
    poll_limit: int = 200
    # Colonnes texte volumineuses (LONGTEXT) à tronquer côté SQL (LEFT(col, n))
    # pour afficher un aperçu du contenu sans rapatrier des documents entiers
    # à chaque cycle de poll.
    text_preview_len: dict = field(default_factory=dict)
    # JOIN SQL brut ajouté après FROM <table> (ex. résoudre un titre lisible).
    extra_joins: str = ''
    # alias -> expression SQL brute, ex. {'project_title': 'fp.title'} — l'alias
    # doit aussi figurer dans display_cols pour apparaître dans l'affichage/diff.
    extra_columns: dict = field(default_factory=dict)

    @property
    def full_table_mode(self) -> bool:
        return self.ts_col is None


# Catégorie active par défaut au premier lancement (les autres sont décochées
# pour ne pas noyer l'utilisateur — activables via la barre de filtre).
DEFAULT_ACTIVE_CATEGORIES = {'metier'}

# Tables jugées critiques pour le contenu des projets (texte des sections,
# brouillons, liste des projets) : affichées en gras dans le filtre et cochées
# par défaut même si leur catégorie ne l'est pas (ex. projet_local_draft).
IMPORTANT_TABLES = {'frank_projects', 'projet_content_version', 'projet_local_draft', 'pipeline_projects'}

CATEGORY_LABELS = {
    'metier': 'Métier',
    'collab': 'Collaboration / documents',
    'mega_outil': 'Mega-outils',
    'admin_test': 'Admin Tests',
    'audit': 'Audit',
}

CATEGORY_COLORS = {
    'metier': '#6366f1',
    'collab': '#3b82f6',
    'mega_outil': '#a855f7',
    'admin_test': '#f59e0b',
    'audit': '#71717a',
}

TABLES: list = [
    # ── Métier ──────────────────────────────────────────────────────────────
    # users n'a pas de updated_at -> mode table entière (volume faible).
    TableSpec('users', ts_col=None, display_cols=['username', 'email', 'role', 'last_login'],
              category='metier', poll_limit=2000),
    TableSpec('app_config', id_col='`key`', ts_col='updated_at', display_cols=['value'],
              category='metier', poll_limit=100),
    TableSpec('frank_projects', ts_col='updated_at', display_cols=['title', 'status', 'user_id'],
              category='metier', poll_limit=300),
    TableSpec('tickets', ts_col='updated_at', display_cols=['title', 'status', 'priority', 'username'],
              category='metier', poll_limit=300),
    TableSpec('ticket_comments', ts_col='created_at', display_cols=['ticket_id', 'username'],
              category='metier', poll_limit=200),
    TableSpec('ai_logs', ts_col='timestamp', display_cols=['provider', 'model', 'status', 'duration_ms'],
              category='metier', poll_limit=300),
    TableSpec('history', ts_col='date', display_cols=['type', 'title', 'ai', 'model'],
              category='metier', poll_limit=200),
    TableSpec('pipeline_projects', ts_col='updated_at', display_cols=['user_id'],
              category='metier', poll_limit=200),
    TableSpec('app_deployments', ts_col='deployed_at', display_cols=['version', 'deployed_by', 'branch'],
              category='metier', poll_limit=100),
    # Historique immuable du texte des sections de projet (source de vérité de
    # l'éditeur, une ligne = un "Enregistrer et partager"). Aperçu du contenu
    # tronqué côté SQL pour rester léger malgré le LONGTEXT.
    # project_id/created_at/content qualifiés (id_col/ts_col + extra_columns) car
    # frank_projects a aussi des colonnes id/created_at/content -> ambiguïté SQL
    # une fois jointe.
    TableSpec('projet_content_version', id_col='projet_content_version.id',
              ts_col='projet_content_version.created_at',
              display_cols=['project_id', 'project_title', 'node_id', 'author_name', 'origin', 'content'],
              category='metier', poll_limit=300,
              extra_joins='LEFT JOIN frank_projects fp ON fp.id = projet_content_version.project_id',
              extra_columns={'project_title': 'fp.title',
                              'content': 'LEFT(projet_content_version.content, 300)'}),

    # ── Collaboration / documents ───────────────────────────────────────────
    TableSpec('help_pages', ts_col='updated_at', display_cols=['title', 'page'], category='collab'),
    TableSpec('doc_categories', ts_col='created_at', display_cols=['name'], category='collab'),
    TableSpec('documents', ts_col='updated_at', display_cols=['title', 'category_id', 'is_public'], category='collab'),
    TableSpec('frank_project_steps', ts_col='created_at',
              display_cols=['project_id', 'step_number', 'result_status'], category='collab'),
    TableSpec('projet_section_lock', id_col="CONCAT(node_id,'::',locked_by_id)", ts_col='locked_at',
              display_cols=['projet_id', 'locked_by_name'], category='collab', poll_limit=300),
    # project_title/username résolus par JOIN, content qualifié (frank_projects a
    # aussi une colonne content, updated_at ambigu une fois joint à frank_projects).
    TableSpec('projet_local_draft',
              id_col="CONCAT(project_id,'::',node_id,'::',projet_local_draft.user_id)",
              ts_col='projet_local_draft.updated_at',
              display_cols=['project_id', 'project_title', 'node_id', 'username', 'content'],
              category='collab', poll_limit=300,
              extra_joins=('LEFT JOIN frank_projects fp ON fp.id = projet_local_draft.project_id '
                           'LEFT JOIN users u ON u.id = projet_local_draft.user_id'),
              extra_columns={'project_title': 'fp.title', 'username': 'u.username',
                              'content': 'LEFT(projet_local_draft.content, 300)'}),
    TableSpec('platform_settings', id_col='key_name', ts_col='updated_at', display_cols=['value'], category='collab'),
    TableSpec('project_comments', ts_col='updated_at', display_cols=['project_id', 'username'], category='collab'),
    TableSpec('frank_project_shares', id_col="CONCAT(project_id,'::',user_id)", ts_col='created_at',
              display_cols=['project_id', 'user_id'], category='collab'),
    TableSpec('file_project_meta', ts_col='updated_at', display_cols=['display_name', 'owner_user_id'],
              category='collab'),

    # ── Mega-outils ──────────────────────────────────────────────────────────
    TableSpec('mega_outil_instances', ts_col='updated_at', display_cols=['type', 'name', 'project_id'],
              category='mega_outil'),
    TableSpec('mega_outil_trello_cards', ts_col='updated_at', display_cols=['title', 'status', 'priority'],
              category='mega_outil'),
    TableSpec('mega_outil_mockup_elements', ts_col='updated_at', display_cols=['type', 'label'],
              category='mega_outil'),
    TableSpec('mega_outil_mockup_comments', ts_col='created_at', display_cols=['element_id', 'author_name'],
              category='mega_outil'),
    TableSpec('mega_outil_mockup_connections', ts_col='created_at', display_cols=['project_id', 'label'],
              category='mega_outil'),
    TableSpec('mega_outil_mockup_diagram_positions', id_col="CONCAT(instance_id,'::',project_name)", ts_col=None,
              display_cols=['x', 'y'], category='mega_outil', poll_limit=2000),
    TableSpec('mega_outil_array_grids', id_col='instance_id', ts_col='updated_at',
              display_cols=['col_count', 'row_count'], category='mega_outil'),
    TableSpec('mega_outil_prompt_history', ts_col='executed_at', display_cols=['instance_id', 'provider', 'model'],
              category='mega_outil', poll_limit=200),
    TableSpec('mega_outil_prompt_config', id_col='key_name', ts_col='updated_at', display_cols=['value'],
              category='mega_outil'),

    # ── Admin Tests ──────────────────────────────────────────────────────────
    # Pas de updated_at fiable (le statut change après started_at) -> table entière.
    TableSpec('admin_test_runs', ts_col=None, display_cols=['name', 'status', 'mode'],
              category='admin_test', poll_limit=2000),
    TableSpec('admin_test_results', ts_col='tested_at', display_cols=['run_id', 'item_id', 'status'],
              category='admin_test', poll_limit=300),
    TableSpec('admin_test_fn_history', ts_col='date', display_cols=['folder_id', 'path', 'updated_by'],
              category='admin_test', poll_limit=200),
    TableSpec('admin_test_favorites', ts_col=None, display_cols=['folder_ids'], category='admin_test', poll_limit=50),
    TableSpec('admin_test_settings', ts_col=None, display_cols=['critique_threshold', 'mineur_threshold'],
              category='admin_test', poll_limit=50),
    TableSpec('admin_test_sitemap', ts_col=None, display_cols=['updated_by'], category='admin_test', poll_limit=50),
    TableSpec('admin_test_sitemap_versions', ts_col='created_at', display_cols=['name', 'created_by'],
              category='admin_test', poll_limit=100),

    # ── Audit ────────────────────────────────────────────────────────────────
    TableSpec('wo_action_history', ts_col='timestamp',
              display_cols=['section', 'action_type', 'label', 'username'], category='audit', poll_limit=300),
]

TABLES_BY_NAME = {t.name: t for t in TABLES}
