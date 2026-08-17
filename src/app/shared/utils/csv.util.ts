/**
 * CSV serialisation for the report exports. Kept out of the report base class so the
 * security portal can export a list without pulling in the admin charting helpers.
 */

/** Serialise a grid of cells, quoting only the ones that need it. */
export function toCsv(rows: (string | number)[][]): string {
  return rows
    .map((cells) =>
      cells
        .map((cell) => {
          const text = String(cell);
          return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
        })
        .join(','),
    )
    .join('\n');
}

/**
 * Byte-order mark. Excel ignores the blob's charset when opening a local .csv and falls back
 * to the system ANSI codepage, which turns any non-ASCII cell into mojibake (a dean's note
 * reading "Señor Peña" arrives as "SeÃ±or PeÃ±a"). The BOM is what makes it detect UTF-8; it
 * is consumed as an encoding marker, so it never shows up in the first header cell.
 */
const UTF8_BOM = '\uFEFF';

/** Serialise a grid of cells and hand it to the browser as a download. */
export function downloadCsv(filename: string, rows: (string | number)[][]): void {
  const url = URL.createObjectURL(
    new Blob([UTF8_BOM + toCsv(rows)], { type: 'text/csv;charset=utf-8' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
