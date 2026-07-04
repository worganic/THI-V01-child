from datetime import datetime, timezone

from PyQt6.QtGui import QFont
from PyQt6.QtWidgets import QWidget, QVBoxLayout, QGridLayout, QLabel

from monitor import theme
from monitor.ui.stat_card import StatCard


def _relative_time(dt) -> str:
    if dt is None:
        return '—'
    if isinstance(dt, str):
        try:
            dt = datetime.fromisoformat(dt)
        except ValueError:
            return dt
    now = datetime.now(dt.tzinfo) if dt.tzinfo else datetime.now()
    delta = now - dt
    secs = delta.total_seconds()
    if secs < 60:
        return 'à l\'instant'
    if secs < 3600:
        return f'il y a {int(secs // 60)} min'
    if secs < 86400:
        return f'il y a {int(secs // 3600)} h'
    return f'il y a {int(secs // 86400)} j'


class StatsPanel(QWidget):
    """Grille de StatCard — santé technique + stats métier."""

    def __init__(self):
        super().__init__()
        self.setStyleSheet(f'background:{theme.BG_PANEL}')
        root = QVBoxLayout(self)
        root.setContentsMargins(16, 12, 16, 12)
        root.setSpacing(10)

        root.addWidget(self._section_label('Santé technique'))
        health_grid = QGridLayout()
        health_grid.setSpacing(10)
        self.cards = {}
        health_ids = ['api', 'agent', 'portail', 'projets', 'mysql_latency', 'mysql_conn', 'sessions']
        health_titles = {
            'api': 'API :3001', 'agent': 'Agent :3003', 'portail': 'Portail :4202', 'projets': 'Projets :4203',
            'mysql_latency': 'Latence MySQL', 'mysql_conn': 'Connexions MySQL', 'sessions': 'Sessions actives',
        }
        for i, cid in enumerate(health_ids):
            card = StatCard(health_titles[cid])
            self.cards[cid] = card
            health_grid.addWidget(card, i // 4, i % 4)
        for c in range(4):
            health_grid.setColumnStretch(c, 1)
        root.addLayout(health_grid)

        root.addWidget(self._section_label('Stats métier'))
        biz_grid = QGridLayout()
        biz_grid.setSpacing(10)
        biz_ids = ['users', 'projects', 'tickets', 'ai_calls', 'last_deploy', 'deploys_7d']
        biz_titles = {
            'users': 'Utilisateurs', 'projects': 'Projets', 'tickets': 'Tickets',
            'ai_calls': 'Appels IA', 'last_deploy': 'Dernier déploiement', 'deploys_7d': 'Déploiements (7j)',
        }
        for i, cid in enumerate(biz_ids):
            card = StatCard(biz_titles[cid])
            self.cards[cid] = card
            biz_grid.addWidget(card, i // 4, i % 4)
        for c in range(4):
            biz_grid.setColumnStretch(c, 1)
        root.addLayout(biz_grid)
        root.addStretch()

    def _section_label(self, text: str) -> QLabel:
        lbl = QLabel(text)
        lbl.setFont(QFont('Segoe UI', 10, QFont.Weight.Bold))
        lbl.setStyleSheet(f'color:{theme.TEXT_MUTED};background:transparent')
        return lbl

    def on_stats(self, stats: dict):
        services = stats.get('services', {})
        for cid, name in [('api', 'API'), ('agent', 'Agent'), ('portail', 'Portail'), ('projets', 'Projets')]:
            up = services.get(name)
            self.cards[cid].set_value('Actif' if up else 'Inactif', status='ok' if up else 'error')

        latency = stats.get('mysql_latency_ms')
        if latency is None:
            self.cards['mysql_latency'].set_value('—', 'injoignable', status='error')
        else:
            status = 'ok' if latency < 50 else ('warn' if latency < 200 else 'error')
            self.cards['mysql_latency'].set_value(f'{latency} ms', status=status)

        threads = stats.get('mysql_threads_connected')
        self.cards['mysql_conn'].set_value(threads if threads is not None else '—',
                                            'Threads_connected (global)', status='neutral')

        sessions = stats.get('sessions_active')
        self.cards['sessions'].set_value(sessions, status='neutral')

        self.cards['users'].set_value(stats.get('users_total'),
                                       f"+{stats.get('users_today', 0)} aujourd'hui", status='neutral')
        self.cards['projects'].set_value(stats.get('projects_total'), status='neutral')
        self.cards['tickets'].set_value(stats.get('tickets_total'), status='neutral')

        total = stats.get('ai_calls_total')
        errors = stats.get('ai_calls_error')
        err_status = 'neutral'
        if total and errors:
            err_status = 'warn' if errors / max(total, 1) < 0.1 else 'error'
        self.cards['ai_calls'].set_value(total, f'{errors or 0} erreur(s)', status=err_status)

        last_dep = stats.get('last_deployment')
        if last_dep:
            self.cards['last_deploy'].set_value(
                last_dep.get('version', '—'),
                f"{last_dep.get('deployed_by', '')} · {_relative_time(last_dep.get('deployed_at'))}",
                status='neutral',
            )
        else:
            self.cards['last_deploy'].set_value('—', status='neutral')

        self.cards['deploys_7d'].set_value(stats.get('deployments_7d'), status='neutral')
