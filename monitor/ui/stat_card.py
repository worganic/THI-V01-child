from PyQt6.QtCore import Qt
from PyQt6.QtGui import QFont
from PyQt6.QtWidgets import QFrame, QVBoxLayout, QHBoxLayout, QLabel

from monitor import theme


class StatCard(QFrame):
    """Card de stat en lecture seule — reprend le look de ServiceCard du launcher
    (fond sombre, bordure arrondie, dot de statut) sans bouton d'action."""

    def __init__(self, title: str):
        super().__init__()
        self.setObjectName('card')
        self._status = 'neutral'
        self.setStyleSheet(theme.card_style('neutral'))
        self.setMinimumHeight(78)

        lay = QVBoxLayout(self)
        lay.setContentsMargins(14, 12, 14, 12)
        lay.setSpacing(6)

        hdr = QHBoxLayout()
        hdr.setSpacing(6)
        self.dot = QLabel('●')
        self.dot.setFont(QFont('Segoe UI', 10))
        self.dot.setStyleSheet(f'color:{theme.COLOR_NEUTRAL};background:transparent')
        hdr.addWidget(self.dot)

        title_lbl = QLabel(title)
        title_lbl.setFont(QFont('Segoe UI', 10))
        title_lbl.setStyleSheet(f'color:{theme.TEXT_MUTED};background:transparent')
        hdr.addWidget(title_lbl)
        hdr.addStretch()
        lay.addLayout(hdr)

        self.value_lbl = QLabel('—')
        self.value_lbl.setFont(QFont('Segoe UI', 18, QFont.Weight.Bold))
        self.value_lbl.setStyleSheet(f'color:{theme.TEXT_MAIN};background:transparent')
        lay.addWidget(self.value_lbl)

        self.sub_lbl = QLabel('')
        self.sub_lbl.setFont(QFont('Segoe UI', 9))
        self.sub_lbl.setStyleSheet(f'color:{theme.TEXT_DIM};background:transparent')
        self.sub_lbl.setWordWrap(True)
        lay.addWidget(self.sub_lbl)

    def set_value(self, value, sub: str = '', status: str = 'neutral'):
        self.value_lbl.setText(str(value) if value is not None else '—')
        self.sub_lbl.setText(sub)
        if status != self._status:
            self._status = status
            self.setStyleSheet(theme.card_style(status))
            self.dot.setStyleSheet(f'color:{theme.STATUS_COLORS.get(status, theme.COLOR_NEUTRAL)};background:transparent')
