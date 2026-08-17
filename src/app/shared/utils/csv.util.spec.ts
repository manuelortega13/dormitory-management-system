import { toCsv, downloadCsv } from './csv.util';

describe('csv util', () => {
  describe('toCsv', () => {
    it('leaves plain cells unquoted', () => {
      expect(
        toCsv([
          ['Reference', 'Outcome'],
          ['LR-1001', 'Approved'],
        ]),
      ).toBe('Reference,Outcome\nLR-1001,Approved');
    });

    it('quotes cells holding a comma, quote or newline', () => {
      expect(toCsv([['owes 1,500']])).toBe('"owes 1,500"');
      expect(toCsv([['said "yes"']])).toBe('"said ""yes"""');
      expect(toCsv([['line one\nline two']])).toBe('"line one\nline two"');
    });

    it('passes non-ASCII notes through untouched', () => {
      expect(toCsv([['Cleared by Señor Peña – ₱1500 paid']])).toBe(
        'Cleared by Señor Peña – ₱1500 paid',
      );
    });
  });

  describe('downloadCsv', () => {
    /** Runs the download and hands back the blob it gave the browser. */
    function exportedBlob(rows: (string | number)[][]): Blob {
      const created: Blob[] = [];
      const originalCreate = URL.createObjectURL;
      const originalRevoke = URL.revokeObjectURL;
      URL.createObjectURL = (blob: Blob) => {
        created.push(blob);
        return 'blob:stub';
      };
      URL.revokeObjectURL = () => {};
      try {
        downloadCsv('report.csv', rows);
      } finally {
        URL.createObjectURL = originalCreate;
        URL.revokeObjectURL = originalRevoke;
      }
      return created[0];
    }

    // jsdom's Blob has no text()/arrayBuffer(), so the contents come back via FileReader.
    function readBytes(blob: Blob): Promise<Uint8Array> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(blob);
      });
    }

    function readUtf8(blob: Blob): Promise<string> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(blob, 'utf-8');
      });
    }

    it('writes the UTF-8 BOM bytes so Excel does not fall back to its ANSI codepage', async () => {
      // Without these three bytes Excel decodes the file as Windows-1252 and a note
      // reading "Señor Peña" renders as "SeÃ±or PeÃ±a".
      const bytes = await readBytes(exportedBlob([['Note'], ['Cleared by Señor Peña']]));

      expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    });

    it('keeps the BOM out of the first header cell once decoded as UTF-8', async () => {
      // A UTF-8 reader consumes the BOM as an encoding marker, so the first column is
      // still 'Reference' and the non-ASCII note survives the round trip intact.
      const text = await readUtf8(
        exportedBlob([
          ['Reference', 'Note'],
          ['LR-1001', 'Señor Peña – ₱1,500'],
        ]),
      );

      expect(text).toBe('Reference,Note\nLR-1001,"Señor Peña – ₱1,500"');
      expect(text.split(',')[0]).toBe('Reference');
    });
  });
});
