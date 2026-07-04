from PyQt6.QtCore import pyqtSignal
from PyQt6.QtGui import QFont
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QGridLayout, QLabel, QCheckBox,
    QPushButton, QScrollArea, QFrame,
)

from monitor import theme
from monitor.tables_registry import TABLES, CATEGORY_LABELS, CATEGORY_COLORS, DEFAULT_ACTIVE_CATEGORIES, IMPORTANT_TABLES

COLS_PER_ROW = 4


class TableFilterBar(QWidget):
    """Contenu du filtre (checkboxes par catégorie), sans chrome de titre/toggle
    — celui-ci vit dans FeedPanel pour rester visible même quand ce widget est
    replié à 0px dans le splitter."""

    sig_selection_changed = pyqtSignal(set)

    def __init__(self, tables=TABLES):
        super().__init__()
        self.tables = tables
        self._checkboxes: dict = {}
        self.setStyleSheet(f'background:{theme.BG_CARD}')

        outer = QVBoxLayout(self)
        outer.setContentsMargins(0, 0, 0, 0)
        outer.setSpacing(0)

        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setStyleSheet('QScrollArea{background:transparent;border:none}')
        content = QWidget()
        content.setStyleSheet('background:transparent')
        content_lay = QVBoxLayout(content)
        content_lay.setContentsMargins(12, 8, 12, 8)
        content_lay.setSpacing(8)

        by_category: dict = {}
        for t in tables:
            by_category.setdefault(t.category, []).append(t)

        for cat, specs in by_category.items():
            content_lay.addWidget(self._build_category_section(cat, specs))
        content_lay.addStretch()

        scroll.setWidget(content)
        outer.addWidget(scroll)

    def _build_category_section(self, category: str, specs: list) -> QWidget:
        box = QFrame()
        box_lay = QVBoxLayout(box)
        box_lay.setContentsMargins(0, 0, 0, 0)
        box_lay.setSpacing(4)

        hdr = QHBoxLayout()
        color = CATEGORY_COLORS.get(category, theme.COLOR_ACCENT)
        label = QLabel(CATEGORY_LABELS.get(category, category))
        label.setFont(QFont('Segoe UI', 9, QFont.Weight.Bold))
        label.setStyleSheet(f'color:{color};background:transparent')
        hdr.addWidget(label)

        btn_all = QPushButton('Tout')
        btn_none = QPushButton('Rien')
        for btn in (btn_all, btn_none):
            btn.setFixedHeight(20)
            btn.setStyleSheet(
                f'QPushButton{{background:transparent;color:{theme.TEXT_MUTED};border:1px solid {theme.BORDER_CARD};'
                f'border-radius:4px;padding:0 8px;font-size:10px}}'
                f'QPushButton:hover{{color:{theme.TEXT_MAIN};border-color:{color}}}'
            )
        btn_all.clicked.connect(lambda: self._set_category(category, True))
        btn_none.clicked.connect(lambda: self._set_category(category, False))
        hdr.addWidget(btn_all)
        hdr.addWidget(btn_none)
        hdr.addStretch()
        box_lay.addLayout(hdr)

        grid = QGridLayout()
        grid.setSpacing(4)
        category_default = category in DEFAULT_ACTIVE_CATEGORIES
        for i, spec in enumerate(specs):
            important = spec.name in IMPORTANT_TABLES
            cb = QCheckBox(spec.name)
            cb.setChecked(category_default or important)
            weight = 'bold' if important else 'normal'
            color = theme.TEXT_MAIN if important else theme.TEXT_MUTED
            cb.setStyleSheet(f'color:{color};background:transparent;font-size:11px;font-weight:{weight}')
            cb.stateChanged.connect(self._on_any_changed)
            self._checkboxes[spec.name] = cb
            grid.addWidget(cb, i // COLS_PER_ROW, i % COLS_PER_ROW)
        box_lay.addLayout(grid)
        return box

    def _set_category(self, category: str, checked: bool):
        for t in self.tables:
            if t.category == category:
                self._checkboxes[t.name].blockSignals(True)
                self._checkboxes[t.name].setChecked(checked)
                self._checkboxes[t.name].blockSignals(False)
        self._on_any_changed()

    def _on_any_changed(self, *_):
        self.sig_selection_changed.emit(self.active_tables())

    def active_tables(self) -> set:
        return {name for name, cb in self._checkboxes.items() if cb.isChecked()}

    def counts(self):
        return len(self.active_tables()), len(self.tables)
