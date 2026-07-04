"""Logique pure de diff entre deux snapshots d'une table.

Aucune dépendance Qt ni DB ici : reçoit une liste de lignes fraîches,
compare au dernier état connu, retourne les changements (INSERT/UPDATE/DELETE).
"""
from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class RowChange:
    table: str
    op: str  # 'INSERT' | 'UPDATE' | 'DELETE'
    row_id: str
    changed_fields: Optional[dict] = None   # {col: (old, new)} pour UPDATE
    row_snapshot: Optional[dict] = None     # ligne complète pour INSERT/DELETE


class TableSnapshot:
    """Garde le dernier état connu (id -> row dict) pour une table."""

    def __init__(self):
        self.rows: dict = {}
        self.initialized = False

    def diff(self, fresh_rows: list, id_col: str, display_cols: list) -> list:
        fresh_by_id = {str(r[id_col]): r for r in fresh_rows}

        if not self.initialized:
            # premier cycle : établit juste la baseline, pas de faux INSERT massif au démarrage
            self.rows = fresh_by_id
            self.initialized = True
            return []

        changes = []

        for rid, row in fresh_by_id.items():
            old = self.rows.get(rid)
            if old is None:
                changes.append(RowChange(table='', op='INSERT', row_id=rid, row_snapshot=row))
            else:
                diffs = {}
                for c in display_cols:
                    old_val, new_val = old.get(c), row.get(c)
                    if old_val != new_val:
                        diffs[c] = (old_val, new_val)
                if diffs:
                    changes.append(RowChange(table='', op='UPDATE', row_id=rid, changed_fields=diffs))

        for rid, old in self.rows.items():
            if rid not in fresh_by_id:
                changes.append(RowChange(table='', op='DELETE', row_id=rid, row_snapshot=old))

        self.rows = fresh_by_id
        return changes
