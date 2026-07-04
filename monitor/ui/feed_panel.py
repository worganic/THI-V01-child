from datetime import datetime

from PyQt6.QtCore import Qt
from PyQt6.QtGui import QColor, QFont
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton, QSplitter,
    QTableWidget, QTableWidgetItem, QHeaderView,
)

from monitor import theme
from monitor.ui.table_filter_bar import TableFilterBar
from monitor.tables_registry import TABLES, CATEGORY_COLORS
from monitor.project_structure import resolve_section_label

MAX_ROWS = 2000

COLUMNS = ['Heure', 'Table', 'Op', 'ID', 'Projet', 'Section', 'Auteur', 'Résumé']


def _fmt_value(v) -> str:
    if v is None:
        return '∅'
    s = str(v)
    return (s[:40] + '…') if len(s) > 40 else s


def _clean_text(s, limit: int) -> str:
    s = (s or '').strip().replace('\n', ' ⏎ ')
    return (s[:limit] + '…') if len(s) > limit else s


def _project_section(row: dict):
    """Résout (projet, section) pour les tables qui portent project_id/node_id."""
    project = row.get('project_title') or row.get('project_id') or ''
    pid, nid = row.get('project_id'), row.get('node_id')
    section = (pid and nid and resolve_section_label(pid, nid)) or nid or ''
    return project, section


def _extract_content_version(change) -> dict:
    row = change.row_snapshot or {}
    project, section = _project_section(row)
    origin = row.get('origin') or ''
    detail = _clean_text(row.get('content'), 200)
    if origin:
        detail = f'({origin}) {detail}'
    tooltip = (
        f"Projet : {project or '?'}\nSection : {section or '?'}\n"
        f"Auteur : {row.get('author_name') or '?'}\nOrigine : {origin}\n\n"
        f"{(row.get('content') or '').strip()}"
    )
    return {'project': project, 'section': section, 'author': row.get('author_name') or '', 'detail': detail,
            'tooltip': tooltip}


def _extract_local_draft(change) -> dict:
    row = change.row_snapshot or {}
    project, section = _project_section(row)
    detail = _clean_text(row.get('content'), 200)
    tooltip = (
        f"Projet : {project or '?'}\nSection : {section or '?'}\n"
        f"Auteur : {row.get('username') or '?'}\n\n{(row.get('content') or '').strip()}"
    )
    return {'project': project, 'section': section, 'author': row.get('username') or '', 'detail': detail,
            'tooltip': tooltip}


def _extract_generic(change) -> dict:
    if change.op == 'UPDATE' and change.changed_fields:
        parts = [f'{col}: {_fmt_value(old)} → {_fmt_value(new)}' for col, (old, new) in change.changed_fields.items()]
        detail = ', '.join(parts)
        tooltip = '\n'.join(f'{col} : {old} → {new}' for col, (old, new) in change.changed_fields.items())
    elif change.row_snapshot:
        parts = [f'{k}={_fmt_value(v)}' for k, v in change.row_snapshot.items() if k != '__id']
        detail = ', '.join(parts)
        tooltip = '\n'.join(f'{k} : {v}' for k, v in change.row_snapshot.items() if k != '__id')
    else:
        detail, tooltip = '', ''
    detail = (detail[:150] + '…') if len(detail) > 150 else detail
    return {'project': '', 'section': '', 'author': '', 'detail': detail, 'tooltip': tooltip}


_EXTRACTORS = {
    'projet_content_version': _extract_content_version,
    'projet_local_draft': _extract_local_draft,
}


def _extract(change) -> dict:
    return _EXTRACTORS.get(change.table, _extract_generic)(change)


class FeedPanel(QWidget):
    """Flux chronologique unique des modifications BDD, plus récent en haut.

    Les colonnes Projet/Section/Auteur sont résolues pour les tables qui
    portent du contenu de projet (texte des sections, brouillons) ; les
    autres tables laissent ces colonnes vides et n'utilisent que "Résumé".

    La liste des tables surveillées est repliable : une barre de bascule
    toujours visible permet de l'afficher (prend alors 50% de la hauteur du
    panneau) ou de la masquer entièrement pour ne garder que le flux en direct.
    """

    def __init__(self, tables=TABLES):
        super().__init__()
        self.setStyleSheet(f'background:{theme.BG_PANEL}')
        root = QVBoxLayout(self)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(0)

        # ── Barre de bascule (toujours visible, même filtre replié) ──
        toggle_bar = QWidget()
        toggle_bar.setFixedHeight(34)
        toggle_bar.setStyleSheet(f'background:{theme.BG_CARD};border-bottom:1px solid {theme.BORDER_CARD}')
        tb_lay = QHBoxLayout(toggle_bar)
        tb_lay.setContentsMargins(12, 0, 12, 0)

        self.toggle_btn = QPushButton()
        self.toggle_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.toggle_btn.setFont(QFont('Segoe UI', 10, QFont.Weight.Bold))
        self.toggle_btn.setStyleSheet(
            f'QPushButton{{background:transparent;color:{theme.TEXT_MAIN};border:none;text-align:left}}'
            f'QPushButton:hover{{color:{theme.COLOR_ACCENT}}}'
        )
        self.toggle_btn.clicked.connect(self._toggle_filter)
        tb_lay.addWidget(self.toggle_btn)
        tb_lay.addStretch()

        self.counter_lbl = QLabel('')
        self.counter_lbl.setFont(QFont('Segoe UI', 9))
        self.counter_lbl.setStyleSheet(f'color:{theme.TEXT_MUTED};background:transparent')
        tb_lay.addWidget(self.counter_lbl)
        root.addWidget(toggle_bar)

        # ── Splitter : filtre (repliable) + flux ──
        self.splitter = QSplitter(Qt.Orientation.Vertical)
        self.splitter.setStyleSheet(f'QSplitter::handle{{background:{theme.BORDER_CARD};height:3px}}')
        self.splitter.setChildrenCollapsible(True)

        self.filter_bar = TableFilterBar(tables)
        self.splitter.addWidget(self.filter_bar)

        self.table = QTableWidget(0, len(COLUMNS))
        self.table.setHorizontalHeaderLabels(COLUMNS)
        self.table.setStyleSheet(
            f'QTableWidget{{background:{theme.BG_PANEL};color:{theme.TEXT_MAIN};gridline-color:{theme.BORDER_CARD};'
            f'border:none}}'
            f'QHeaderView::section{{background:{theme.BG_CARD};color:{theme.TEXT_MUTED};border:none;'
            f'border-bottom:1px solid {theme.BORDER_CARD};padding:4px}}'
        )
        self.table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        self.table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self.table.verticalHeader().setVisible(False)
        self.table.setFont(QFont('Cascadia Code', 9))
        header = self.table.horizontalHeader()
        # Heure, Table, Op, ID : contenu court, largeur auto.
        # Toutes les colonnes redimensionnables à la souris (glisser le bord de
        # l'en-tête), avec une largeur initiale raisonnable — sauf Résumé qui
        # occupe l'espace restant.
        for col in (0, 1, 2, 3, 4, 5, 6):
            header.setSectionResizeMode(col, QHeaderView.ResizeMode.Interactive)
        header.setSectionResizeMode(7, QHeaderView.ResizeMode.Stretch)
        for col, width in enumerate([70, 170, 70, 90, 130, 200, 90]):
            self.table.setColumnWidth(col, width)
        self.splitter.addWidget(self.table)

        root.addWidget(self.splitter)

        self._active_tables = self.filter_bar.active_tables()
        self.filter_bar.sig_selection_changed.connect(self._on_filter_changed)

        # Replié par défaut : le flux en direct prend toute la hauteur.
        self._filter_expanded = False
        self.splitter.setSizes([0, 1])
        self._update_toggle_label()
        self._update_counter()

    def _toggle_filter(self):
        self._filter_expanded = not self._filter_expanded
        if self._filter_expanded:
            total = sum(self.splitter.sizes()) or self.height() or 600
            half = total // 2
            self.splitter.setSizes([half, total - half])
        else:
            total = sum(self.splitter.sizes()) or self.height() or 600
            self.splitter.setSizes([0, total])
        self._update_toggle_label()

    def _update_toggle_label(self):
        arrow = '▴' if self._filter_expanded else '▾'
        action = 'Masquer' if self._filter_expanded else 'Afficher'
        self.toggle_btn.setText(f'{arrow} {action} les tables surveillées')

    def _on_filter_changed(self, names: set):
        self._active_tables = names
        self._update_counter()

    def _update_counter(self):
        active, total = self.filter_bar.counts()
        self.counter_lbl.setText(f'{active}/{total} tables actives')

    def on_changes(self, changes: list):
        visible = [c for c in changes if c.table in self._active_tables]
        if not visible:
            return
        for change in visible:
            self._prepend_row(change)
        while self.table.rowCount() > MAX_ROWS:
            self.table.removeRow(self.table.rowCount() - 1)

    def _prepend_row(self, change):
        self.table.insertRow(0)
        ts = datetime.now().strftime('%H:%M:%S')
        info = _extract(change)

        full_id = str(change.row_id)
        items = [
            QTableWidgetItem(ts),
            QTableWidgetItem(change.table),
            QTableWidgetItem(change.op),
            QTableWidgetItem(_fmt_value(full_id) if len(full_id) > 40 else full_id),
            QTableWidgetItem(info['project']),
            QTableWidgetItem(info['section']),
            QTableWidgetItem(info['author']),
            QTableWidgetItem(info['detail']),
        ]
        items[1].setForeground(QColor(CATEGORY_COLORS.get(self._category_of(change.table), theme.TEXT_MAIN)))
        items[2].setForeground(QColor(theme.OP_COLORS.get(change.op, theme.TEXT_MAIN)))
        items[3].setToolTip(full_id)
        tooltip = info.get('tooltip')
        for i, item in enumerate(items):
            if tooltip and i != 3:
                item.setToolTip(tooltip)
            self.table.setItem(0, i, item)

    def _category_of(self, table_name: str) -> str:
        for t in TABLES:
            if t.name == table_name:
                return t.category
        return 'metier'
