"""Chargement des credentials MySQL du Monitor DB.

Les credentials vivent dans monitor/db_config.json (gitignoré), jamais commité.
Un template monitor/db_config.json.example est fourni pour copie manuelle.
"""
import json
import os

CONFIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'db_config.json')
EXAMPLE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'db_config.json.example')

REQUIRED_KEYS = ('host', 'user', 'password', 'database')


class DbConfigError(RuntimeError):
    pass


def load_db_config() -> dict:
    if not os.path.exists(CONFIG_PATH):
        raise DbConfigError(
            f"Fichier de configuration introuvable :\n{CONFIG_PATH}\n\n"
            f"Copiez {os.path.basename(EXAMPLE_PATH)} vers db_config.json "
            f"et renseignez le mot de passe MySQL."
        )
    with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
        cfg = json.load(f)
    for key in REQUIRED_KEYS:
        if not cfg.get(key):
            raise DbConfigError(f"Clé manquante ou vide dans db_config.json : {key}")
    return cfg
