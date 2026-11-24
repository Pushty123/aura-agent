import Dexie, { type Table } from 'dexie';
import type { Sealed } from './crypto';
import type { DataKind } from '../types';

export interface MetaRow {
  key: string;
  value: string;
}
export interface RecordRow extends Sealed {
  id: string; // e.g. "day:2026-11-24"
  kind: DataKind;
}
export interface AuditRow {
  id?: number;
  ts: number;
  action: string;
  detail: string;
  prev: string;
  hash: string;
}

class AuraDB extends Dexie {
  meta!: Table<MetaRow, string>;
  records!: Table<RecordRow, string>;
  audit!: Table<AuditRow, number>;

  constructor(name = 'aura') {
    super(name);
    this.version(1).stores({
      meta: 'key',
      records: 'id, kind',
      audit: '++id, ts',
    });
  }
}

export const db = new AuraDB();
