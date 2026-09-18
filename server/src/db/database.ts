import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, '../../../toro_negro.sqlite');

export const db = new DatabaseSync(dbPath);

// Initialize schema
const schemaPath = path.resolve(__dirname, 'schema.sql');
if (fs.existsSync(schemaPath)) {
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schema);
}

// Helper query wrappers for clean types and ergonomic usage
export const query = {
  all<T = any>(sql: string, ...params: any[]): T[] {
    const stmt = db.prepare(sql);
    return stmt.all(...params) as T[];
  },
  get<T = any>(sql: string, ...params: any[]): T | undefined {
    const stmt = db.prepare(sql);
    return stmt.get(...params) as T | undefined;
  },
  run(sql: string, ...params: any[]) {
    const stmt = db.prepare(sql);
    return stmt.run(...params);
  },
  exec(sql: string) {
    return db.exec(sql);
  }
};
