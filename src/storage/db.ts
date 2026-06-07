import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { logInfo } from '../logger'

let db: Database.Database | null = null

function getDataDir(): string {
  const dir = process.env.DATA_DIR ?? path.resolve(process.cwd(), 'data')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

export function getDb(): Database.Database {
  if (db) return db

  const dbPath = path.join(getDataDir(), 'config.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS config (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)
  logInfo('SQLite initialized', { path: dbPath })
  return db
}

export function getConfig(key: string): string | undefined {
  const row = getDb().prepare('SELECT value FROM config WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return row?.value
}

export function setConfig(key: string, value: string): void {
  const now = Math.floor(Date.now() / 1000)
  getDb()
    .prepare('INSERT INTO config (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?')
    .run(key, value, now, value, now)
}

export function deleteConfig(key: string): void {
  getDb().prepare('DELETE FROM config WHERE key = ?').run(key)
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}
