// =============================================================================
// Export CSV générique (sans dépendance externe) : construit le contenu texte puis déclenche le
// téléchargement via un Blob + lien temporaire, entièrement côté navigateur.
// =============================================================================

/**
 * Sépare les colonnes par point-virgule (pas virgule) : en local fr-FR, Excel utilise la virgule
 * comme séparateur décimal et interprète mal un CSV séparé par virgules sans configuration manuelle.
 */
export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const escapeCell = (value: string | number): string => {
    const str = String(value ?? '');
    if (/["\n;]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const lines = [headers, ...rows].map(row => row.map(escapeCell).join(';'));
  return lines.join('\r\n');
}

/** Déclenche le téléchargement d'un fichier CSV. Préfixé BOM UTF-8 pour que les accents s'affichent
 *  correctement à l'ouverture dans Excel (sans ça, un CSV UTF-8 sans BOM est parfois lu en latin-1). */
const UTF8_BOM = '﻿';

export function downloadCsv(filename: string, csvContent: string): void {
  const blob = new Blob([UTF8_BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
