"""Constantes de style — dupliquées volontairement depuis launcher_app.py
(pas d'import croisé) pour que le Monitor DB reste 100% autonome et ne
risque jamais de casser le launcher en cas de modification future.
"""

BG_WINDOW = '#0f0f0f'
BG_PANEL = '#0a0a0a'
BG_CARD = '#111'
BORDER_CARD = '#222'
TEXT_MAIN = '#e2e2e2'
TEXT_MUTED = '#71717a'
TEXT_DIM = '#52525b'

COLOR_OK = '#10b981'
COLOR_WARN = '#f59e0b'
COLOR_ERROR = '#ef4444'
COLOR_NEUTRAL = '#52525b'
COLOR_ACCENT = '#6366f1'

STATUS_COLORS = {
    'ok': COLOR_OK,
    'warn': COLOR_WARN,
    'error': COLOR_ERROR,
    'neutral': COLOR_NEUTRAL,
}

OP_COLORS = {
    'INSERT': COLOR_OK,
    'UPDATE': COLOR_WARN,
    'DELETE': COLOR_ERROR,
}

CARD_QSS = (
    '#card{{background:{bg};border:1px solid {border};border-radius:10px}}'
)


def card_style(status: str = 'neutral') -> str:
    bg = {'ok': '#0d160f', 'warn': '#1a1306', 'error': '#1f0d0d', 'neutral': BG_CARD}.get(status, BG_CARD)
    border = {'ok': '#1a3020', 'warn': '#4a3306', 'error': '#4a0a0a', 'neutral': BORDER_CARD}.get(status, BORDER_CARD)
    return CARD_QSS.format(bg=bg, border=border)


def apply_dark_palette(app):
    from PyQt6.QtGui import QPalette, QColor
    pal = QPalette()
    pal.setColor(QPalette.ColorRole.Window, QColor(BG_WINDOW))
    pal.setColor(QPalette.ColorRole.WindowText, QColor(TEXT_MAIN))
    pal.setColor(QPalette.ColorRole.Base, QColor(BG_CARD))
    pal.setColor(QPalette.ColorRole.AlternateBase, QColor('#1a1a1a'))
    pal.setColor(QPalette.ColorRole.Text, QColor(TEXT_MAIN))
    pal.setColor(QPalette.ColorRole.Button, QColor('#1c1c1e'))
    pal.setColor(QPalette.ColorRole.ButtonText, QColor(TEXT_MAIN))
    pal.setColor(QPalette.ColorRole.Highlight, QColor(COLOR_ACCENT))
    pal.setColor(QPalette.ColorRole.HighlightedText, QColor('#ffffff'))
    pal.setColor(QPalette.ColorRole.ToolTipBase, QColor('#1c1c1e'))
    pal.setColor(QPalette.ColorRole.ToolTipText, QColor(TEXT_MAIN))
    app.setPalette(pal)
