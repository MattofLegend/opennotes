import initSqlJs, { Database as SqlJsDatabase } from 'sql.js'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { dirname } from 'path'
import { getDbPath } from '../storage'

let db: SqlJsDatabase | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null
let dirty = false

/**
 * Save database to disk (debounced)
 */
function saveToDisk(): void {
  if (!db) return

  dirty = true

  if (saveTimer) {
    clearTimeout(saveTimer)
  }

  saveTimer = setTimeout(() => {
    if (db && dirty) {
      const data = db.export()
      writeFileSync(getDbPath(), Buffer.from(data))
      dirty = false
    }
  }, 100)
}

/**
 * Force immediate save
 */
export async function flush(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  if (db && dirty) {
    const data = db.export()
    writeFileSync(getDbPath(), Buffer.from(data))
    dirty = false
  }
}

export function getDb(): SqlJsDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.')
  }
  return db
}

export async function initializeDatabase(): Promise<SqlJsDatabase> {
  const dbPath = getDbPath()
  console.log('Initializing database at:', dbPath)

  const SQL = await initSqlJs()

  // Load existing database if it exists
  if (existsSync(dbPath)) {
    const buffer = readFileSync(dbPath)
    db = new SQL.Database(buffer)
  } else {
    // Ensure directory exists
    const dir = dirname(dbPath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    db = new SQL.Database()
  }

  // Create tables if they don't exist
  
  // Projects table
  db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      project_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      notes_folder TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS threads (
      thread_id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      metadata TEXT,
      status TEXT DEFAULT 'idle',
      thread_values TEXT,
      title TEXT,
      project_id TEXT REFERENCES projects(project_id) ON DELETE SET NULL
    )
  `)
  
  // Migration: Add project_id column if it doesn't exist
  try {
    db.run(`ALTER TABLE threads ADD COLUMN project_id TEXT REFERENCES projects(project_id) ON DELETE SET NULL`)
  } catch {
    // Column already exists, ignore
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS runs (
      run_id TEXT PRIMARY KEY,
      thread_id TEXT REFERENCES threads(thread_id) ON DELETE CASCADE,
      assistant_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      status TEXT,
      metadata TEXT,
      kwargs TEXT
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS assistants (
      assistant_id TEXT PRIMARY KEY,
      graph_id TEXT NOT NULL,
      name TEXT,
      model TEXT DEFAULT 'claude-sonnet-4-5-20250929',
      config TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)

  db.run(`CREATE INDEX IF NOT EXISTS idx_threads_updated_at ON threads(updated_at)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_runs_thread_id ON runs(thread_id)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status)`)

  db.run(`
    CREATE TABLE IF NOT EXISTS note_favorites (
      note_path TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL
    )
  `)

  saveToDisk()

  console.log('Database initialized successfully')
  return db
}

export function closeDatabase(): void {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  if (db) {
    // Save any pending changes
    if (dirty) {
      const data = db.export()
      writeFileSync(getDbPath(), Buffer.from(data))
    }
    db.close()
    db = null
  }
}

// Helper functions for common operations

export interface Project {
  project_id: string
  name: string
  notes_folder: string
  created_at: number
  updated_at: number
}

export interface Thread {
  thread_id: string
  created_at: number
  updated_at: number
  metadata: string | null
  status: string
  thread_values: string | null
  title: string | null
  project_id: string | null
}

export function getAllThreads(): Thread[] {
  const database = getDb()
  const stmt = database.prepare('SELECT * FROM threads ORDER BY updated_at DESC')
  const threads: Thread[] = []

  while (stmt.step()) {
    threads.push(stmt.getAsObject() as unknown as Thread)
  }
  stmt.free()

  return threads
}

export function getThread(threadId: string): Thread | null {
  const database = getDb()
  const stmt = database.prepare('SELECT * FROM threads WHERE thread_id = ?')
  stmt.bind([threadId])

  if (!stmt.step()) {
    stmt.free()
    return null
  }

  const thread = stmt.getAsObject() as unknown as Thread
  stmt.free()
  return thread
}

export function createThread(
  threadId: string,
  metadata?: Record<string, unknown>,
  projectId?: string | null
): Thread {
  const database = getDb()
  const now = Date.now()

  database.run(
    `INSERT INTO threads (thread_id, created_at, updated_at, metadata, status, project_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [threadId, now, now, metadata ? JSON.stringify(metadata) : null, 'idle', projectId ?? null]
  )

  saveToDisk()

  return {
    thread_id: threadId,
    created_at: now,
    updated_at: now,
    metadata: metadata ? JSON.stringify(metadata) : null,
    status: 'idle',
    thread_values: null,
    title: null,
    project_id: projectId ?? null
  }
}

export function updateThread(
  threadId: string,
  updates: Partial<Omit<Thread, 'thread_id' | 'created_at'>> & { project_id?: string | null }
): Thread | null {
  const database = getDb()
  const existing = getThread(threadId)

  if (!existing) return null

  const now = Date.now()
  const setClauses: string[] = ['updated_at = ?']
  const values: (string | number | null)[] = [now]

  if (updates.metadata !== undefined) {
    setClauses.push('metadata = ?')
    values.push(
      typeof updates.metadata === 'string' ? updates.metadata : JSON.stringify(updates.metadata)
    )
  }
  if (updates.status !== undefined) {
    setClauses.push('status = ?')
    values.push(updates.status)
  }
  if (updates.thread_values !== undefined) {
    setClauses.push('thread_values = ?')
    values.push(updates.thread_values)
  }
  if (updates.title !== undefined) {
    setClauses.push('title = ?')
    values.push(updates.title)
  }
  if ('project_id' in updates) {
    setClauses.push('project_id = ?')
    values.push(updates.project_id ?? null)
  }

  values.push(threadId)

  database.run(`UPDATE threads SET ${setClauses.join(', ')} WHERE thread_id = ?`, values)

  saveToDisk()

  return getThread(threadId)
}

export function deleteThread(threadId: string): void {
  const database = getDb()
  database.run('DELETE FROM threads WHERE thread_id = ?', [threadId])
  saveToDisk()
}

// Project operations

export function getAllProjects(): Project[] {
  const database = getDb()
  const stmt = database.prepare('SELECT * FROM projects ORDER BY updated_at DESC')
  const projects: Project[] = []

  while (stmt.step()) {
    projects.push(stmt.getAsObject() as unknown as Project)
  }
  stmt.free()

  return projects
}

export function getProject(projectId: string): Project | null {
  const database = getDb()
  const stmt = database.prepare('SELECT * FROM projects WHERE project_id = ?')
  stmt.bind([projectId])

  if (!stmt.step()) {
    stmt.free()
    return null
  }

  const project = stmt.getAsObject() as unknown as Project
  stmt.free()
  return project
}

export function createProject(projectId: string, name: string, notesFolder: string): Project {
  const database = getDb()
  const now = Date.now()

  database.run(
    `INSERT INTO projects (project_id, name, notes_folder, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [projectId, name, notesFolder, now, now]
  )

  saveToDisk()

  return {
    project_id: projectId,
    name,
    notes_folder: notesFolder,
    created_at: now,
    updated_at: now
  }
}

export function updateProject(
  projectId: string,
  updates: Partial<Omit<Project, 'project_id' | 'created_at'>>
): Project | null {
  const database = getDb()
  const existing = getProject(projectId)

  if (!existing) return null

  const now = Date.now()
  const setClauses: string[] = ['updated_at = ?']
  const values: (string | number | null)[] = [now]

  if (updates.name !== undefined) {
    setClauses.push('name = ?')
    values.push(updates.name)
  }
  if (updates.notes_folder !== undefined) {
    setClauses.push('notes_folder = ?')
    values.push(updates.notes_folder)
  }

  values.push(projectId)

  database.run(`UPDATE projects SET ${setClauses.join(', ')} WHERE project_id = ?`, values)

  saveToDisk()

  return getProject(projectId)
}

export function deleteProject(projectId: string): void {
  const database = getDb()
  database.run('DELETE FROM projects WHERE project_id = ?', [projectId])
  saveToDisk()
}

export function getThreadsByProject(projectId: string | null): Thread[] {
  const database = getDb()
  let stmt
  
  if (projectId === null) {
    stmt = database.prepare('SELECT * FROM threads WHERE project_id IS NULL ORDER BY updated_at DESC')
  } else {
    stmt = database.prepare('SELECT * FROM threads WHERE project_id = ? ORDER BY updated_at DESC')
    stmt.bind([projectId])
  }
  
  const threads: Thread[] = []
  while (stmt.step()) {
    threads.push(stmt.getAsObject() as unknown as Thread)
  }
  stmt.free()

  return threads
}

export function isNoteFavorite(notePath: string): boolean {
  const database = getDb()
  const stmt = database.prepare('SELECT 1 FROM note_favorites WHERE note_path = ?')
  stmt.bind([notePath])
  const exists = stmt.step()
  stmt.free()
  return exists
}

export function setNoteFavorite(notePath: string, isFavorite: boolean): void {
  const database = getDb()
  
  if (isFavorite) {
    database.run(
      'INSERT OR IGNORE INTO note_favorites (note_path, created_at) VALUES (?, ?)',
      [notePath, Date.now()]
    )
  } else {
    database.run('DELETE FROM note_favorites WHERE note_path = ?', [notePath])
  }
  
  saveToDisk()
}

export function toggleNoteFavorite(notePath: string): boolean {
  const currentlyFavorite = isNoteFavorite(notePath)
  setNoteFavorite(notePath, !currentlyFavorite)
  return !currentlyFavorite
}

export function getAllFavoriteNotePaths(): string[] {
  const database = getDb()
  const stmt = database.prepare('SELECT note_path FROM note_favorites ORDER BY created_at DESC')
  const paths: string[] = []
  
  while (stmt.step()) {
    const row = stmt.getAsObject() as { note_path: string }
    paths.push(row.note_path)
  }
  stmt.free()
  
  return paths
}

export function renameNoteFavorite(oldPath: string, newPath: string): void {
  const database = getDb()
  database.run('UPDATE note_favorites SET note_path = ? WHERE note_path = ?', [newPath, oldPath])
  saveToDisk()
}

export function deleteNoteFavorite(notePath: string): void {
  const database = getDb()
  database.run('DELETE FROM note_favorites WHERE note_path = ?', [notePath])
  saveToDisk()
}
