import { IpcMain, shell } from 'electron'
import { join, relative, basename, dirname } from 'path'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  renameSync,
  unlinkSync,
  rmSync
} from 'fs'
import { getNotesDir, getNotesTrashDir } from '../storage'

// Types
interface NoteInfo {
  path: string
  title: string
  preview: string
  modifiedAt: string
  isFavorite: boolean
  isDeleted: boolean
  folder: string
  tags: string[]
}

interface FolderNode {
  name: string
  path: string
  children: FolderNode[]
}

interface TagNode {
  name: string
  fullPath: string
  count: number
  children: TagNode[]
}

// Helper: Check if file is a note
function isNoteFile(filename: string): boolean {
  const ext = filename.toLowerCase()
  return ext.endsWith('.md') || ext.endsWith('.txt')
}

// Helper: Extract title from note content
function extractTitle(content: string, filename: string): string {
  const lines = content.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    // Skip favorite marker
    if (trimmed.startsWith('<!-- favorite -->')) continue
    // Use first heading
    if (trimmed.startsWith('# ')) {
      return trimmed.slice(2).trim()
    }
    // Use first non-empty line
    if (trimmed.length > 0) {
      return trimmed.slice(0, 60)
    }
  }
  // Fall back to filename without extension
  return basename(filename, filename.includes('.') ? filename.slice(filename.lastIndexOf('.')) : '')
}

// Helper: Extract preview from note content
function extractPreview(content: string): string {
  const lines = content.split('\n')
  let preview = ''
  for (const line of lines) {
    const trimmed = line.trim()
    // Skip favorite marker and headings
    if (trimmed.startsWith('<!-- favorite -->')) continue
    if (trimmed.startsWith('#')) continue
    if (trimmed.length > 0) {
      preview = trimmed.slice(0, 100)
      break
    }
  }
  return preview
}

// Helper: Check if note is favorited
function isFavorite(content: string): boolean {
  return content.trim().startsWith('<!-- favorite -->')
}

// Helper: Parse hashtags from content
function parseHashtags(content: string): string[] {
  const regex = /#[\w/-]+/g
  const matches = content.match(regex) || []
  return [...new Set(matches.map((tag) => tag.slice(1)))] // Remove # prefix and dedupe
}

// Helper: Recursively get all notes from a directory
function getAllNotes(dir: string, notesRoot: string, trashDir: string): NoteInfo[] {
  const notes: NoteInfo[] = []

  if (!existsSync(dir)) return notes

  const entries = readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)

    // Skip hidden files/folders except .trash
    if (entry.name.startsWith('.') && entry.name !== '.trash') continue

    if (entry.isDirectory()) {
      // Skip the trash directory when listing regular notes
      if (fullPath === trashDir) continue
      notes.push(...getAllNotes(fullPath, notesRoot, trashDir))
    } else if (isNoteFile(entry.name)) {
      const content = readFileSync(fullPath, 'utf-8')
      const stats = statSync(fullPath)
      const relativePath = relative(notesRoot, fullPath)
      const folder = dirname(relativePath)

      notes.push({
        path: relativePath,
        title: extractTitle(content, entry.name),
        preview: extractPreview(content),
        modifiedAt: stats.mtime.toISOString(),
        isFavorite: isFavorite(content),
        isDeleted: false,
        folder: folder === '.' ? '' : folder,
        tags: parseHashtags(content)
      })
    }
  }

  return notes
}

// Helper: Get notes from trash
function getTrashNotes(trashDir: string): NoteInfo[] {
  const notes: NoteInfo[] = []

  if (!existsSync(trashDir)) return notes

  const entries = readdirSync(trashDir, { withFileTypes: true })

  for (const entry of entries) {
    if (entry.isFile() && isNoteFile(entry.name)) {
      const fullPath = join(trashDir, entry.name)
      const content = readFileSync(fullPath, 'utf-8')
      const stats = statSync(fullPath)

      notes.push({
        path: join('.trash', entry.name),
        title: extractTitle(content, entry.name),
        preview: extractPreview(content),
        modifiedAt: stats.mtime.toISOString(),
        isFavorite: isFavorite(content),
        isDeleted: true,
        folder: '.trash',
        tags: parseHashtags(content)
      })
    }
  }

  return notes
}

// Helper: Recursively get all folders (no files)
function getAllFolders(dir: string, notesRoot: string): FolderNode[] {
  const folders: FolderNode[] = []

  if (!existsSync(dir)) return folders

  const entries = readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    // Skip hidden folders
    if (entry.name.startsWith('.')) continue

    if (entry.isDirectory()) {
      const fullPath = join(dir, entry.name)
      const relativePath = relative(notesRoot, fullPath)

      folders.push({
        name: entry.name,
        path: relativePath,
        children: getAllFolders(fullPath, notesRoot)
      })
    }
  }

  // Sort alphabetically
  folders.sort((a, b) => a.name.localeCompare(b.name))

  return folders
}

// Helper: Build tag tree from flat tag list
function buildTagTree(tags: string[]): TagNode[] {
  const tagCounts: Record<string, number> = {}

  // Count occurrences of each tag path
  for (const tag of tags) {
    const parts = tag.split('/')
    let currentPath = ''
    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part
      tagCounts[currentPath] = (tagCounts[currentPath] || 0) + 1
    }
  }

  // Build tree structure
  const root: TagNode[] = []
  const nodeMap: Map<string, TagNode> = new Map()

  // Sort tags to ensure parents are processed before children
  const sortedPaths = Object.keys(tagCounts).sort()

  for (const fullPath of sortedPaths) {
    const parts = fullPath.split('/')
    const name = parts[parts.length - 1]
    const parentPath = parts.slice(0, -1).join('/')

    const node: TagNode = {
      name,
      fullPath,
      count: tagCounts[fullPath],
      children: []
    }

    nodeMap.set(fullPath, node)

    if (parentPath && nodeMap.has(parentPath)) {
      nodeMap.get(parentPath)!.children.push(node)
    } else if (!parentPath) {
      root.push(node)
    }
  }

  return root
}

export function registerNotesHandlers(ipcMain: IpcMain): void {
  const notesDir = getNotesDir()
  const trashDir = getNotesTrashDir()

  // List all notes with metadata
  ipcMain.handle('notes:list', async () => {
    const notes = getAllNotes(notesDir, notesDir, trashDir)
    const trashNotes = getTrashNotes(trashDir)
    return [...notes, ...trashNotes]
  })

  // List only folders (for sidebar browser)
  ipcMain.handle('notes:listFolders', async () => {
    return getAllFolders(notesDir, notesDir)
  })

  // Read a note's content
  ipcMain.handle('notes:read', async (_event, relativePath: string) => {
    const fullPath = join(notesDir, relativePath)
    if (!existsSync(fullPath)) {
      throw new Error('Note not found')
    }
    return readFileSync(fullPath, 'utf-8')
  })

  // Create a new note
  ipcMain.handle(
    'notes:create',
    async (_event, { folder, filename, content }: { folder?: string; filename: string; content?: string }) => {
      const targetDir = folder ? join(notesDir, folder) : notesDir
      if (!existsSync(targetDir)) {
        mkdirSync(targetDir, { recursive: true })
      }

      // Auto-increment filename if it already exists
      let finalFilename = filename
      let fullPath = join(targetDir, finalFilename)
      let counter = 2

      while (existsSync(fullPath)) {
        const ext = filename.includes('.') ? filename.slice(filename.lastIndexOf('.')) : ''
        const base = filename.includes('.') ? filename.slice(0, filename.lastIndexOf('.')) : filename
        finalFilename = `${base} (${counter})${ext}`
        fullPath = join(targetDir, finalFilename)
        counter++
      }

      writeFileSync(fullPath, content || `# ${basename(finalFilename, '.md')}\n\n`)

      const stats = statSync(fullPath)
      const noteContent = readFileSync(fullPath, 'utf-8')
      const relativePath = relative(notesDir, fullPath)

      return {
        path: relativePath,
        title: extractTitle(noteContent, finalFilename),
        preview: extractPreview(noteContent),
        modifiedAt: stats.mtime.toISOString(),
        isFavorite: false,
        isDeleted: false,
        folder: folder || '',
        tags: parseHashtags(noteContent)
      } as NoteInfo
    }
  )

  // Create a new folder
  ipcMain.handle('notes:createFolder', async (_event, { parentFolder, name }: { parentFolder?: string; name: string }) => {
    const targetDir = parentFolder ? join(notesDir, parentFolder, name) : join(notesDir, name)

    if (existsSync(targetDir)) {
      throw new Error('Folder already exists')
    }

    mkdirSync(targetDir, { recursive: true })

    return {
      name,
      path: relative(notesDir, targetDir),
      children: []
    } as FolderNode
  })

  // Update a note's content
  ipcMain.handle('notes:update', async (_event, { path: relativePath, content }: { path: string; content: string }) => {
    const fullPath = join(notesDir, relativePath)
    if (!existsSync(fullPath)) {
      throw new Error('Note not found')
    }

    writeFileSync(fullPath, content)

    const stats = statSync(fullPath)
    const folder = dirname(relativePath)

    return {
      path: relativePath,
      title: extractTitle(content, basename(relativePath)),
      preview: extractPreview(content),
      modifiedAt: stats.mtime.toISOString(),
      isFavorite: isFavorite(content),
      isDeleted: false,
      folder: folder === '.' ? '' : folder,
      tags: parseHashtags(content)
    } as NoteInfo
  })

  // Delete a note (move to trash)
  ipcMain.handle('notes:delete', async (_event, relativePath: string) => {
    const fullPath = join(notesDir, relativePath)
    if (!existsSync(fullPath)) {
      throw new Error('Note not found')
    }

    const filename = basename(relativePath)
    const trashPath = join(trashDir, filename)

    // If file with same name exists in trash, add timestamp
    let finalTrashPath = trashPath
    if (existsSync(trashPath)) {
      const ext = filename.includes('.') ? filename.slice(filename.lastIndexOf('.')) : ''
      const base = filename.includes('.') ? filename.slice(0, filename.lastIndexOf('.')) : filename
      finalTrashPath = join(trashDir, `${base}-${Date.now()}${ext}`)
    }

    renameSync(fullPath, finalTrashPath)
    return true
  })

  // Restore a note from trash
  ipcMain.handle('notes:restore', async (_event, { trashPath, targetFolder }: { trashPath: string; targetFolder?: string }) => {
    const fullTrashPath = join(notesDir, trashPath)
    if (!existsSync(fullTrashPath)) {
      throw new Error('Note not found in trash')
    }

    const filename = basename(trashPath)
    const targetDir = targetFolder ? join(notesDir, targetFolder) : notesDir
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true })
    }

    const targetPath = join(targetDir, filename)
    renameSync(fullTrashPath, targetPath)

    const content = readFileSync(targetPath, 'utf-8')
    const stats = statSync(targetPath)
    const relativePath = relative(notesDir, targetPath)
    const folder = dirname(relativePath)

    return {
      path: relativePath,
      title: extractTitle(content, filename),
      preview: extractPreview(content),
      modifiedAt: stats.mtime.toISOString(),
      isFavorite: isFavorite(content),
      isDeleted: false,
      folder: folder === '.' ? '' : folder,
      tags: parseHashtags(content)
    } as NoteInfo
  })

  // Permanently delete a note from trash
  ipcMain.handle('notes:permanentDelete', async (_event, trashPath: string) => {
    const fullPath = join(notesDir, trashPath)
    if (!existsSync(fullPath)) {
      throw new Error('Note not found in trash')
    }

    unlinkSync(fullPath)
    return true
  })

  // Toggle favorite status
  ipcMain.handle('notes:toggleFavorite', async (_event, relativePath: string) => {
    const fullPath = join(notesDir, relativePath)
    if (!existsSync(fullPath)) {
      throw new Error('Note not found')
    }

    let content = readFileSync(fullPath, 'utf-8')
    const favoriteMarker = '<!-- favorite -->\n'

    if (isFavorite(content)) {
      // Remove favorite marker
      content = content.replace(favoriteMarker, '')
    } else {
      // Add favorite marker at the beginning
      content = favoriteMarker + content
    }

    writeFileSync(fullPath, content)

    const stats = statSync(fullPath)
    const folder = dirname(relativePath)

    return {
      path: relativePath,
      title: extractTitle(content, basename(relativePath)),
      preview: extractPreview(content),
      modifiedAt: stats.mtime.toISOString(),
      isFavorite: isFavorite(content),
      isDeleted: false,
      folder: folder === '.' ? '' : folder,
      tags: parseHashtags(content)
    } as NoteInfo
  })

  // Get all tags from notes
  ipcMain.handle('notes:getTags', async () => {
    const notes = getAllNotes(notesDir, notesDir, trashDir)
    const allTags: string[] = []

    for (const note of notes) {
      const fullPath = join(notesDir, note.path)
      const content = readFileSync(fullPath, 'utf-8')
      allTags.push(...parseHashtags(content))
    }

    return buildTagTree(allTags)
  })

  // Delete a folder and all its contents
  ipcMain.handle('notes:deleteFolder', async (_event, folderPath: string) => {
    const fullPath = join(notesDir, folderPath)
    if (!existsSync(fullPath)) {
      throw new Error('Folder not found')
    }

    // Move all notes to trash first
    const moveToTrash = (dir: string): void => {
      const entries = readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const entryPath = join(dir, entry.name)
        if (entry.isDirectory()) {
          moveToTrash(entryPath)
        } else if (isNoteFile(entry.name)) {
          const trashPath = join(trashDir, entry.name)
          let finalTrashPath = trashPath
          if (existsSync(trashPath)) {
            const ext = entry.name.includes('.') ? entry.name.slice(entry.name.lastIndexOf('.')) : ''
            const base = entry.name.includes('.') ? entry.name.slice(0, entry.name.lastIndexOf('.')) : entry.name
            finalTrashPath = join(trashDir, `${base}-${Date.now()}${ext}`)
          }
          renameSync(entryPath, finalTrashPath)
        }
      }
    }

    moveToTrash(fullPath)
    rmSync(fullPath, { recursive: true })
    return true
  })

  // Get notes directory path (for agent access)
  ipcMain.handle('notes:getPath', async () => {
    return notesDir
  })

  // Show a note or folder in Finder
  ipcMain.handle('notes:showInFinder', async (_event, relativePath: string) => {
    const fullPath = join(notesDir, relativePath)
    if (!existsSync(fullPath)) {
      throw new Error('Path not found')
    }
    shell.showItemInFolder(fullPath)
    return true
  })

  // Open the notes directory in Finder
  ipcMain.handle('notes:openNotesFolder', async () => {
    shell.showItemInFolder(notesDir)
    return true
  })
}
