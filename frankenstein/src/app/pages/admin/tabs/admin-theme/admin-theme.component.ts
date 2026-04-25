import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../../environments/environment';

const API = environment.apiDataUrl;

interface ColorVar {
  key: string;
  label: string;
  description: string;
}

const COLOR_VARS: ColorVar[] = [
  { key: '--tw-primary',       label: 'Primaire',          description: 'Texte, bordures, éléments principaux' },
  { key: '--tw-secondary',     label: 'Secondaire',        description: 'Éléments secondaires, sous-titres' },
  { key: '--tw-accent',        label: 'Accent',            description: 'Boutons principaux, focus' },
  { key: '--tw-accent-dark',   label: 'Accent foncé',      description: 'Variante foncée de l\'accent' },
  { key: '--tw-accent-darker', label: 'Accent très foncé', description: 'Arrière-plans accent subtils' },
  { key: '--tw-background',    label: 'Fond',              description: 'Couleur de fond principale' },
  { key: '--tw-surface',       label: 'Surface',           description: 'Cartes, panneaux' },
  { key: '--tw-surface-light', label: 'Surface claire',    description: 'Hover, éléments surélevés' },
];

const PRESETS = [
  {
    name: 'Violet', icon: 'auto_awesome',
    vars: {
      '--tw-primary': '224 170 255', '--tw-secondary': '199 125 255',
      '--tw-accent': '157 78 221', '--tw-accent-dark': '123 44 191',
      '--tw-accent-darker': '90 24 154', '--tw-background': '10 10 15',
      '--tw-surface': '18 18 26', '--tw-surface-light': '26 26 37',
    }
  },
  {
    name: 'Cyan', icon: 'water_drop',
    vars: {
      '--tw-primary': '165 243 252', '--tw-secondary': '103 232 249',
      '--tw-accent': '6 182 212', '--tw-accent-dark': '8 145 178',
      '--tw-accent-darker': '14 116 144', '--tw-background': '2 8 10',
      '--tw-surface': '6 18 22', '--tw-surface-light': '9 28 34',
    }
  },
  {
    name: 'Emerald', icon: 'eco',
    vars: {
      '--tw-primary': '167 243 208', '--tw-secondary': '110 231 183',
      '--tw-accent': '52 211 153', '--tw-accent-dark': '16 185 129',
      '--tw-accent-darker': '5 150 105', '--tw-background': '2 10 6',
      '--tw-surface': '5 20 12', '--tw-surface-light': '8 28 18',
    }
  },
  {
    name: 'Amber', icon: 'local_fire_department',
    vars: {
      '--tw-primary': '253 230 138', '--tw-secondary': '252 211 77',
      '--tw-accent': '245 158 11', '--tw-accent-dark': '217 119 6',
      '--tw-accent-darker': '180 83 9', '--tw-background': '10 8 2',
      '--tw-surface': '20 15 4', '--tw-surface-light': '28 22 6',
    }
  },
];

@Component({
  selector: 'app-admin-theme',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-theme.component.html',
})
export class AdminThemeComponent implements OnInit {
  private http = inject(HttpClient);

  saving      = signal(false);
  saved       = signal(false);
  loading     = signal(true);
  savingCss   = signal(false);
  savedCss    = signal(false);
  activePreset    = signal<string | null>(null);
  baseCss         = signal<string>('');
  baseCssExpanded = signal(false);

  readonly colorVars = COLOR_VARS;
  readonly presets   = PRESETS;

  hexValues: Record<string, string> = {};
  customCss = signal<string>('');

  ngOnInit() {
    this.loadCurrentTheme();
    this.loadCustomCss();
    this.loadBaseCss();
  }

  async loadCurrentTheme() {
    this.loading.set(true);
    try {
      const theme = await firstValueFrom(this.http.get<any>(`${API}/api/child/config/theme`));
      const cssVars: Record<string, string> = theme?.cssVars ?? {};
      COLOR_VARS.forEach(cv => {
        const rgbStr = cssVars[cv.key] || getComputedStyle(document.documentElement).getPropertyValue(cv.key).trim();
        this.hexValues[cv.key] = this.rgbStrToHex(rgbStr);
      });
    } catch {
      COLOR_VARS.forEach(cv => {
        const rgbStr = getComputedStyle(document.documentElement).getPropertyValue(cv.key).trim();
        this.hexValues[cv.key] = this.rgbStrToHex(rgbStr);
      });
    } finally {
      this.activePreset.set(this.detectActivePreset());
      this.loading.set(false);
    }
  }

  async loadCustomCss() {
    try {
      const res = await firstValueFrom(this.http.get<any>(`${API}/api/child/css`));
      this.customCss.set(res?.customCSS || '');
    } catch { /* ignore */ }
  }

  async loadBaseCss() {
    try {
      const res = await firstValueFrom(this.http.get<any>(`${API}/read-file?file=../frankenstein/src/styles.scss`));
      this.baseCss.set(res?.content || '');
    } catch { /* ignore */ }
  }

  applyPreset(preset: typeof PRESETS[0]) {
    Object.entries(preset.vars).forEach(([k, v]) => {
      this.hexValues[k] = this.rgbStrToHex(v);
      document.documentElement.style.setProperty(k, v);
    });
    this.activePreset.set(preset.name);
  }

  onColorChange(key: string, hex: string) {
    this.hexValues[key] = hex;
    document.documentElement.style.setProperty(key, this.hexToRgbStr(hex));
    this.activePreset.set(this.detectActivePreset());
  }

  async save() {
    this.saving.set(true);
    this.saved.set(false);
    const cssVars: Record<string, string> = {};
    COLOR_VARS.forEach(cv => {
      cssVars[cv.key] = this.hexToRgbStr(this.hexValues[cv.key] || '#000000');
    });
    try {
      await firstValueFrom(this.http.post(`${API}/api/child/config/theme`, { cssVars }));
      this.saved.set(true);
      setTimeout(() => this.saved.set(false), 3000);
    } finally {
      this.saving.set(false);
    }
  }

  async saveCustomCss() {
    this.savingCss.set(true);
    this.savedCss.set(false);
    try {
      await firstValueFrom(this.http.post(`${API}/api/child/css`, { customCSS: this.customCss() }));
      this.injectCustomCss(this.customCss());
      this.savedCss.set(true);
      setTimeout(() => this.savedCss.set(false), 3000);
    } finally {
      this.savingCss.set(false);
    }
  }

  async resetCustomCss() {
    this.customCss.set('');
    await this.saveCustomCss();
  }

  get buttonTextClass(): string {
    return this.isLight(this.hexValues['--tw-primary'] || '#000000') ? 'text-gray-900' : 'text-white';
  }

  private isLight(hex: string): boolean {
    const clean = hex.replace('#', '');
    if (clean.length !== 6) return false;
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5;
  }

  private detectActivePreset(): string | null {
    for (const preset of PRESETS) {
      const matches = Object.entries(preset.vars).every(([k, rgbStr]) => {
        return this.hexValues[k] === this.rgbStrToHex(rgbStr);
      });
      if (matches) return preset.name;
    }
    return null;
  }

  private injectCustomCss(css: string) {
    let el = document.getElementById('frankenstein-custom-css') as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = 'frankenstein-custom-css';
      document.head.appendChild(el);
    }
    el.textContent = css;
  }

  private hexToRgbStr(hex: string): string {
    const clean = hex.replace('#', '');
    if (clean.length !== 6) return '0 0 0';
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return `${r} ${g} ${b}`;
  }

  private rgbStrToHex(rgb: string): string {
    const parts = rgb.trim().split(/[\s,]+/).map(Number);
    if (parts.length < 3 || parts.some(isNaN)) return '#000000';
    return '#' + parts.slice(0, 3).map(n => n.toString(16).padStart(2, '0')).join('');
  }
}
