import { describe, expect, it } from 'vitest';
import {
  confirmCsvImport,
  parseCsv,
  previewCsvImport,
  validateCsvRow,
} from '../src/lib/csvImport';

describe('CSV import', () => {
  it('parses quoted values, escaped quotes, extra columns, and Windows line endings', () => {
    const parsed = parseCsv(
      'date,sleepMinutes,steps,screenMinutes,mood,notes\r\n' +
        '2026-11-24,"450",6200,180,4,"felt, ""good"""\r\n',
    );

    expect(parsed.headers).toEqual(['date', 'sleepminutes', 'steps', 'screenminutes', 'mood', 'notes']);
    expect(parsed.rows).toEqual([
      {
        rowNumber: 2,
        cells: ['2026-11-24', '450', '6200', '180', '4', 'felt, "good"'],
      },
    ]);
  });

  it('previews valid and rejected rows with counts and confirms only valid rows as CSV data', () => {
    const preview = previewCsvImport(
      'date,sleepMinutes,steps,screenMinutes,mood,notes\r\n' +
        '2026-11-24,450,6200,180,4,extra\r\n' +
        '2026-02-29,480,4000,120,3,invalid date\r\n' +
        '2026-11-26,nope,5000,100,5,bad number\r\n',
    );

    expect(preview.counts).toEqual({ valid: 1, rejected: 2, total: 3 });
    expect(preview.rejectedRows.map(({ reason }) => reason)).toEqual([
      'row 3: date must be a valid YYYY-MM-DD date',
      'row 4: sleepMinutes must be a number',
    ]);
    expect(confirmCsvImport(preview)).toEqual([
      {
        date: '2026-11-24',
        sleepHours: 7.5,
        steps: 6200,
        screenMinutes: 180,
        mood: 4,
        source: 'csv',
      },
    ]);
    expect(confirmCsvImport(preview).every(({ source }) => source !== 'demo')).toBe(true);
  });

  it('rejects missing required fields, invalid ranges, and non-integer counts', () => {
    const parsed = parseCsv(
      'date,sleepMinutes,steps,screenMinutes,mood\r\n' +
        '2026-11-24,480,,120,4\r\n' +
        '2026-11-25,1500,100,120,4\r\n' +
        '2026-11-26,480,100,120,5.5\r\n',
    );

    expect(parsed.rows.map((row) => validateCsvRow(row, parsed.headers))).toMatchObject([
      { valid: false, rejected: { reason: 'row 2: steps is required' } },
      { valid: false, rejected: { reason: 'row 3: sleepMinutes must be between 0 and 1440' } },
      { valid: false, rejected: { reason: 'row 4: mood must be a whole number between 1 and 5' } },
    ]);

    expect(previewCsvImport('date,sleepMinutes,steps,screenMinutes\n2026-11-24,480,100,120').rejectedRows)
      .toEqual([{ rowNumber: 2, reason: 'row 2: missing required column mood' }]);
  });

  it('handles empty files, blank lines, and malformed quoting without throwing', () => {
    expect(previewCsvImport('')).toEqual({
      validRows: [],
      rejectedRows: [],
      counts: { valid: 0, rejected: 0, total: 0 },
    });
    expect(previewCsvImport(' \r\n')).toEqual({
      validRows: [],
      rejectedRows: [],
      counts: { valid: 0, rejected: 0, total: 0 },
    });

    const preview = previewCsvImport(
      'date,sleepMinutes,steps,screenMinutes,mood\n2026-11-24,"480,100,120,4',
    );
    expect(preview.rejectedRows).toEqual([
      { rowNumber: 2, reason: 'row 2: unterminated quoted field' },
    ]);
  });

  it('supports quoted fields containing line breaks', () => {
    const preview = previewCsvImport(
      'date,sleepMinutes,steps,screenMinutes,mood,note\r\n' +
        '2026-11-24,480,100,120,4,"first line\r\nsecond line"\r\n',
    );

    expect(preview.counts).toEqual({ valid: 1, rejected: 0, total: 1 });
    expect(preview.validRows[0].rowNumber).toBe(2);
  });
});
