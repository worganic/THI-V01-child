"""Résolution des noms de projet/section à partir des fichiers locaux
data/projets/<id>/config.json — ces infos n'existent pas en MySQL (le nom
de section vit dans l'arborescence JSON locale, pas en base), donc le
Monitor DB lit ce fichier en local (lecture seule) pour l'affichage humain
des lignes de projet_content_version/projet_local_draft.

Lecture disque, pas MySQL — mise en cache par (project_id, mtime du fichier)
pour ne pas re-parser l'arbre à chaque changement affiché.
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJETS_DIR = os.path.join(ROOT, 'data', 'projets')

_cache: dict = {}  # project_id -> (mtime, project_name, {node_id: name})


def _config_path(project_id: str) -> str:
    return os.path.join(PROJETS_DIR, project_id, 'config.json')


def _load(project_id: str):
    path = _config_path(project_id)
    try:
        mtime = os.path.getmtime(path)
    except OSError:
        return None
    cached = _cache.get(project_id)
    if cached and cached[0] == mtime:
        return cached
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError):
        return None

    index: dict = {}   # node_id -> (name, parent_name)

    def walk(nodes, parent_name=None):
        for n in (nodes or []):
            nid = n.get('id')
            if nid:
                index[nid] = (n.get('name', ''), parent_name)
            children = n.get('children')
            if children:
                walk(children, n.get('name'))

    walk(data.get('structure', []))
    entry = (mtime, data.get('projectName') or '', index)
    _cache[project_id] = entry
    return entry


def resolve_project_name(project_id: str):
    entry = _load(project_id)
    return entry[1] if entry and entry[1] else None


def resolve_section_label(project_id: str, node_id: str):
    """Nom lisible de la section : 'dossier parent / fichier' (les fichiers
    s'appellent presque tous 'contenu.md' — le nom utile est celui du dossier
    parent, ex. 'test 2')."""
    entry = _load(project_id)
    if not entry:
        return None
    found = entry[2].get(node_id)
    if not found:
        return None
    name, parent_name = found
    return f'{parent_name} / {name}' if parent_name else name
