from PyQt6.QtCore import Qt
from PyQt6.QtWidgets import QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, QSplitter, QLabel, QPushButton
from PyQt6.QtGui import QFont

from monitor import theme
from monitor.tables_registry import TABLES
from monitor.poll_worker import FeedPollWorker, StatsPollWorker
from monitor.ui.feed_panel import FeedPanel
from monitor.ui.stats_panel import StatsPanel


class MonitorWindow(QMainWindow):
    def __init__(self, db_client, service_ports: dict, offset: int = 0):
        super().__init__()
        title = 'Worganic — Monitor DB' if offset == 0 else f'Worganic — Monitor DB (Instance 2 +{offset})'
        self.setWindowTitle(title)
        self.resize(1150, 800)
        self.setMinimumSize(800, 560)
        self.setStyleSheet(f'background:{theme.BG_WINDOW}')

        center = QWidget()
        self.setCentralWidget(center)
        root = QVBoxLayout(center)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(0)

        hdr = QWidget()
        hdr.setFixedHeight(44)
        hdr.setStyleSheet(f'background:{theme.BG_CARD};border-bottom:1px solid {theme.BORDER_CARD}')
        hdr_lay = QVBoxLayout(hdr)
        hdr_lay.setContentsMargins(20, 0, 20, 0)
        brand = QLabel('◈  Monitor <b>DB</b> — surveillance temps réel Worganic')
        brand.setFont(QFont('Segoe UI', 12))
        brand.setStyleSheet(f'color:{theme.TEXT_MUTED};background:transparent')
        hdr_lay.addWidget(brand, alignment=Qt.AlignmentFlag.AlignVCenter)
        root.addWidget(hdr)

        # ── Barre de bascule du panneau stats (même pattern que FeedPanel) ──
        stats_toggle_bar = QWidget()
        stats_toggle_bar.setFixedHeight(34)
        stats_toggle_bar.setStyleSheet(f'background:{theme.BG_CARD};border-bottom:1px solid {theme.BORDER_CARD}')
        st_lay = QHBoxLayout(stats_toggle_bar)
        st_lay.setContentsMargins(12, 0, 12, 0)
        self.stats_toggle_btn = QPushButton()
        self.stats_toggle_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.stats_toggle_btn.setFont(QFont('Segoe UI', 10, QFont.Weight.Bold))
        self.stats_toggle_btn.setStyleSheet(
            f'QPushButton{{background:transparent;color:{theme.TEXT_MAIN};border:none;text-align:left}}'
            f'QPushButton:hover{{color:{theme.COLOR_ACCENT}}}'
        )
        self.stats_toggle_btn.clicked.connect(self._toggle_stats)
        st_lay.addWidget(self.stats_toggle_btn)
        st_lay.addStretch()
        root.addWidget(stats_toggle_bar)

        splitter = QSplitter(Qt.Orientation.Vertical)
        splitter.setStyleSheet(f'QSplitter::handle{{background:{theme.BORDER_CARD};height:3px}}')
        root.addWidget(splitter)
        self.splitter = splitter

        self.stats_panel = StatsPanel()
        splitter.addWidget(self.stats_panel)

        self.feed_panel = FeedPanel(TABLES)
        splitter.addWidget(self.feed_panel)

        # Le panneau stats garde sa taille au redimensionnement de la fenêtre ;
        # le flux absorbe tout l'espace supplémentaire.
        splitter.setStretchFactor(0, 0)
        splitter.setStretchFactor(1, 1)
        splitter.setSizes([420, 380])

        self._stats_expanded = True
        self._update_stats_toggle_label()

        # Le worker doit démarrer avec le même set de tables que ce que la
        # checkbox affiche déjà coché (catégories par défaut + tables importantes
        # forcées), pas juste les catégories, sinon les deux divergent tant que
        # l'utilisateur n'a pas touché une checkbox.
        self.feed_worker = FeedPollWorker(db_client, TABLES, interval_s=1.5,
                                           initial_active=self.feed_panel.filter_bar.active_tables())
        self.stats_worker = StatsPollWorker(db_client, service_ports, interval_s=3.0)

        self.feed_worker.sig_changes.connect(self.feed_panel.on_changes)
        self.feed_panel.filter_bar.sig_selection_changed.connect(self.feed_worker.set_active_tables)
        self.stats_worker.sig_stats.connect(self.stats_panel.on_stats)

        self.feed_worker.start()
        self.stats_worker.start()

    def _toggle_stats(self):
        self._stats_expanded = not self._stats_expanded
        total = sum(self.splitter.sizes()) or self.height() or 800
        if self._stats_expanded:
            self.splitter.setSizes([420, total - 420])
        else:
            self.splitter.setSizes([0, total])
        self._update_stats_toggle_label()

    def _update_stats_toggle_label(self):
        arrow = '▾' if self._stats_expanded else '▸'
        action = 'Masquer' if self._stats_expanded else 'Afficher'
        self.stats_toggle_btn.setText(f'{arrow} {action} la santé technique & les stats')

    def closeEvent(self, event):
        self.feed_worker.stop()
        self.stats_worker.stop()
        event.accept()
