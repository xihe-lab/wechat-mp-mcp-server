import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getDb, getConfig, setConfig, deleteConfig, closeDb } from '../../src/storage/db'
import fs from 'fs'
import path from 'path'

const TEST_DATA_DIR = path.join(process.cwd(), 'data')

describe('Storage DB', () => {
  beforeEach(() => {
    closeDb()
    process.env.DATA_DIR = TEST_DATA_DIR
  })

  afterEach(() => {
    closeDb()
    const dbPath = path.join(TEST_DATA_DIR, 'config.db')
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath)
  })

  it('should initialize database with config table', () => {
    const db = getDb()
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='config'").get()
    expect(tables).toBeDefined()
  })

  it('should set and get config', () => {
    setConfig('app_id', 'wx123456')
    expect(getConfig('app_id')).toBe('wx123456')
  })

  it('should return undefined for non-existent key', () => {
    expect(getConfig('nonexistent')).toBeUndefined()
  })

  it('should update existing config', () => {
    setConfig('token', 'abc')
    setConfig('token', 'def')
    expect(getConfig('token')).toBe('def')
  })

  it('should delete config', () => {
    setConfig('to_delete', 'value')
    deleteConfig('to_delete')
    expect(getConfig('to_delete')).toBeUndefined()
  })

  it('should use DATA_DIR env variable', () => {
    process.env.DATA_DIR = path.join(process.cwd(), 'test-data-tmp')
    closeDb()
    getDb()
    expect(fs.existsSync(path.join(process.cwd(), 'test-data-tmp', 'config.db'))).toBe(true)
    fs.rmSync(path.join(process.cwd(), 'test-data-tmp'), { recursive: true })
    delete process.env.DATA_DIR
  })
})
