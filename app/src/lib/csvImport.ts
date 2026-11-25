import type { DayRecord } from '../types';

const REQUIRED_COLUMNS = ['date', 'sleepMinutes', 'steps', 'screenMinutes', 'mood'] as const;
const MAX_STEPS_PER_DAY = 100_000;
const MAX_MINUTES_PER_DAY = 24 * 60;

export interface ParsedCsvRow {
  rowNumber: number;
  cells: string[];
  error?: string;
}

export interface ParsedCsv {
  headers: string[];
  rows: ParsedCsvRow[];
}

export interface CsvImportValues {
  date: string;
  sleepMinutes: number;
  steps: number;
  screenMinutes: number;
  mood: NonNullable<DayRecord['mood']>;
}

export interface CsvValidRow {
  rowNumber: number;
  values: CsvImportValues;
}

export interface CsvRejectedRow {
  rowNumber: number;
  reason: string;
}

export interface CsvImportPreview {
  validRows: CsvValidRow[];
  rejectedRows: CsvRejectedRow[];
  counts: {
    valid: number;
    rejected: number;
    total: number;
  };
}

export type CsvRowValidation =
  | { valid: true; row: CsvValidRow }
  | { valid: false; rejected: CsvRejectedRow };

function parseRecords(text: string): ParsedCsvRow[] {
  const rows: ParsedCsvRow[] = [];
  let cells: string[] = [];
  let cell = '';
  let inQuotes = false;
  let afterQuote = false;
  let rowError: string | undefined;
  let lineNumber = 1;
  let rowNumber = 1;

  const finishCell = () => {
    cells.push(cell);
    cell = '';
    afterQuote = false;
  };

  const finishRow = () => {
    finishCell();
    if (rowError || cells.length > 1 || cells[0]?.trim()) {
      rows.push({ rowNumber, cells, ...(rowError ? { error: rowError } : {}) });
    }
    cells = [];
    rowError = undefined;
  };

  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    const isNewline = character === '\r' || character === '\n';
    const newlineLength = character === '\r' && text[index + 1] === '\n' ? 2 : 1;

    if (inQuotes) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index++;
        } else {
          inQuotes = false;
          afterQuote = true;
        }
      } else if (isNewline) {
        cell += '\n';
        lineNumber++;
        if (newlineLength === 2) index++;
      } else {
        cell += character;
      }
      continue;
    }

    if (afterQuote) {
      if (character === ',') {
        finishCell();
      } else if (isNewline) {
        finishRow();
        lineNumber++;
        rowNumber = lineNumber;
        if (newlineLength === 2) index++;
      } else if (character !== ' ' && character !== '\t') {
        rowError ??= 'unexpected character after closing quote';
        cell += character;
        afterQuote = false;
      }
      continue;
    }

    if (character === ',') {
      finishCell();
    } else if (isNewline) {
      finishRow();
      lineNumber++;
      rowNumber = lineNumber;
      if (newlineLength === 2) index++;
    } else if (character === '"' && cell.length === 0) {
      inQuotes = true;
    } else {
      if (character === '"') rowError ??= 'quote in unquoted field';
      cell += character;
    }
  }

  if (inQuotes) rowError ??= 'unterminated quoted field';
  if (cell.length > 0 || cells.length > 0 || rowError) finishRow();
  return rows;
}

function normalizeHeader(header: string): string {
  return header.replace(/^\uFEFF/, '').trim().toLowerCase();
}

/** Parse CSV text into a header row and data rows without changing or saving data. */
export function parseCsv(csvText: string): ParsedCsv {
  if (typeof csvText !== 'string' || !csvText.trim()) return { headers: [], rows: [] };

  const [headerRow, ...rows] = parseRecords(csvText);
  if (!headerRow) return { headers: [], rows: [] };
  return { headers: headerRow.cells.map(normalizeHeader), rows };
}

function reject(rowNumber: number, message: string): CsvRowValidation {
  return { valid: false, rejected: { rowNumber, reason: `row ${rowNumber}: ${message}` } };
}

function parseNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(trimmed)) return undefined;
  const number = Number(trimmed);
  return Number.isFinite(number) ? number : undefined;
}

/** Validate and convert one parsed CSV row. Only the required columns are used. */
export function validateCsvRow(row: ParsedCsvRow, headers: string[]): CsvRowValidation {
  if (row.error) return reject(row.rowNumber, row.error);

  const normalizedHeaders = headers.map(normalizeHeader);
  const indexes = new Map<string, number>();
  for (const column of REQUIRED_COLUMNS) {
    const normalizedColumn = normalizeHeader(column);
    const matches = normalizedHeaders
      .map((header, index) => (header === normalizedColumn ? index : -1))
      .filter((index) => index >= 0);
    if (matches.length > 1) return reject(row.rowNumber, `duplicate column ${column}`);
    if (matches.length === 0) return reject(row.rowNumber, `missing required column ${column}`);
    indexes.set(column, matches[0]);
  }

  const values = new Map<string, string>();
  for (const column of REQUIRED_COLUMNS) {
    const index = indexes.get(column);
    values.set(column, index === undefined ? '' : row.cells[index] ?? '');
  }

  const date = values.get('date')?.trim() ?? '';
  if (!date) return reject(row.rowNumber, 'date is required');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return reject(row.rowNumber, 'date must be a valid YYYY-MM-DD date');
  const parsedDate = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
    return reject(row.rowNumber, 'date must be a valid YYYY-MM-DD date');
  }

  const sleepRaw = values.get('sleepMinutes') ?? '';
  if (!sleepRaw.trim()) return reject(row.rowNumber, 'sleepMinutes is required');
  const sleepMinutes = parseNumber(sleepRaw);
  if (sleepMinutes === undefined) return reject(row.rowNumber, 'sleepMinutes must be a number');
  if (sleepMinutes < 0 || sleepMinutes > MAX_MINUTES_PER_DAY) {
    return reject(row.rowNumber, `sleepMinutes must be between 0 and ${MAX_MINUTES_PER_DAY}`);
  }

  const stepsRaw = values.get('steps') ?? '';
  if (!stepsRaw.trim()) return reject(row.rowNumber, 'steps is required');
  const steps = parseNumber(stepsRaw);
  if (steps === undefined) return reject(row.rowNumber, 'steps must be a number');
  if (!Number.isInteger(steps) || steps < 0 || steps > MAX_STEPS_PER_DAY) {
    return reject(row.rowNumber, `steps must be a whole number between 0 and ${MAX_STEPS_PER_DAY}`);
  }

  const screenRaw = values.get('screenMinutes') ?? '';
  if (!screenRaw.trim()) return reject(row.rowNumber, 'screenMinutes is required');
  const screenMinutes = parseNumber(screenRaw);
  if (screenMinutes === undefined) return reject(row.rowNumber, 'screenMinutes must be a number');
  if (screenMinutes < 0 || screenMinutes > MAX_MINUTES_PER_DAY) {
    return reject(row.rowNumber, `screenMinutes must be between 0 and ${MAX_MINUTES_PER_DAY}`);
  }

  const moodRaw = values.get('mood') ?? '';
  if (!moodRaw.trim()) return reject(row.rowNumber, 'mood is required');
  const mood = parseNumber(moodRaw);
  if (mood === undefined) return reject(row.rowNumber, 'mood must be a number');
  if (!Number.isInteger(mood) || mood < 1 || mood > 5) {
    return reject(row.rowNumber, 'mood must be a whole number between 1 and 5');
  }

  return {
    valid: true,
    row: {
      rowNumber: row.rowNumber,
      values: {
        date,
        sleepMinutes,
        steps,
        screenMinutes,
        mood: mood as CsvImportValues['mood'],
      },
    },
  };
}

/** Build an import preview. This function does not write to storage. */
export function previewCsvImport(csvText: string): CsvImportPreview {
  const parsed = parseCsv(csvText);
  const validRows: CsvValidRow[] = [];
  const rejectedRows: CsvRejectedRow[] = [];

  for (const row of parsed.rows) {
    const result = validateCsvRow(row, parsed.headers);
    if (result.valid) validRows.push(result.row);
    else rejectedRows.push(result.rejected);
  }

  return {
    validRows,
    rejectedRows,
    counts: {
      valid: validRows.length,
      rejected: rejectedRows.length,
      total: validRows.length + rejectedRows.length,
    },
  };
}

/** Convert only preview-approved rows to daily records; persistence is a separate step. */
export function confirmCsvImport(preview: CsvImportPreview): DayRecord[] {
  return preview.validRows.map(({ values }) => ({
    date: values.date,
    sleepHours: Math.round((values.sleepMinutes / 60) * 100) / 100,
    steps: values.steps,
    screenMinutes: values.screenMinutes,
    mood: values.mood,
    source: 'csv',
  }));
}
