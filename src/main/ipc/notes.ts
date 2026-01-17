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
import {
  isNoteFavorite,
  toggleNoteFavorite,
  deleteNoteFavorite,
  renameNoteFavorite
} from '../db'

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

function isNoteFile(filename: string): boolean {
  const ext = filename.toLowerCase()
  return ext.endsWith('.md') || ext.endsWith('.txt')
}

function extractTitle(content: string, filename: string): string {
  const lines = content.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('# ')) {
      return trimmed.slice(2).trim()
    }
    if (trimmed.length > 0) {
      return trimmed.slice(0, 60)
    }
  }
  return basename(filename, filename.includes('.') ? filename.slice(filename.lastIndexOf('.')) : '')
}

function extractPreview(content: string): string {
  const lines = content.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('#')) continue
    if (trimmed.length > 0) {
      return trimmed.slice(0, 100)
    }
  }
  return ''
}

function parseHashtags(content: string): string[] {
  const regex = /#[\w/-]+/g
  const matches = content.match(regex) || []
  return [...new Set(matches.map((tag) => tag.slice(1)))]
}

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
        isFavorite: isNoteFavorite(relativePath),
        isDeleted: false,
        folder: folder === '.' ? '' : folder,
        tags: parseHashtags(content)
      })
    }
  }

  return notes
}

function getTrashNotes(trashDir: string): NoteInfo[] {
  const notes: NoteInfo[] = []

  if (!existsSync(trashDir)) return notes

  const entries = readdirSync(trashDir, { withFileTypes: true })

  for (const entry of entries) {
    if (entry.isFile() && isNoteFile(entry.name)) {
      const fullPath = join(trashDir, entry.name)
      const content = readFileSync(fullPath, 'utf-8')
      const stats = statSync(fullPath)
      const relativePath = join('.trash', entry.name)

      notes.push({
        path: relativePath,
        title: extractTitle(content, entry.name),
        preview: extractPreview(content),
        modifiedAt: stats.mtime.toISOString(),
        isFavorite: isNoteFavorite(relativePath),
        isDeleted: true,
        folder: '.trash',
        tags: parseHashtags(content)
      })
    }
  }

  return notes
}

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
    let fullPath = join(notesDir, relativePath)
    if (!existsSync(fullPath)) {
      throw new Error('Note not found')
    }

    // Write the content first
    writeFileSync(fullPath, content)

    // Extract new title and check if filename should change
    const newTitle = extractTitle(content, basename(relativePath))
    const currentFilename = basename(relativePath, '.md')
    const folder = dirname(relativePath)
    
    // Sanitize title for filename (remove invalid characters)
    const sanitizedTitle = newTitle
      .replace(/[<>:"/\\|?*]/g, '') // Remove invalid filename chars
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim()
      .slice(0, 100) // Limit length
    
    let finalRelativePath = relativePath
    
    // Only rename if title is different and sanitized title is valid
    if (sanitizedTitle && sanitizedTitle !== currentFilename) {
      const newFilename = `${sanitizedTitle}.md`
      const newRelativePath = folder === '.' ? newFilename : join(folder, newFilename)
      const newFullPath = join(notesDir, newRelativePath)
      
      // Only rename if target doesn't exist (avoid overwriting)
      if (!existsSync(newFullPath)) {
        // Update favorite reference if needed
        if (isNoteFavorite(relativePath)) {
          renameNoteFavorite(relativePath, newRelativePath)
        }
        
        // Rename the file
        renameSync(fullPath, newFullPath)
        fullPath = newFullPath
        finalRelativePath = newRelativePath
      }
    }

    const stats = statSync(fullPath)
    const finalFolder = dirname(finalRelativePath)

    return {
      path: finalRelativePath,
      title: newTitle,
      preview: extractPreview(content),
      modifiedAt: stats.mtime.toISOString(),
      isFavorite: isNoteFavorite(finalRelativePath),
      isDeleted: false,
      folder: finalFolder === '.' ? '' : finalFolder,
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
    let finalTrashRelativePath = join('.trash', filename)
    if (existsSync(trashPath)) {
      const ext = filename.includes('.') ? filename.slice(filename.lastIndexOf('.')) : ''
      const base = filename.includes('.') ? filename.slice(0, filename.lastIndexOf('.')) : filename
      const newFilename = `${base}-${Date.now()}${ext}`
      finalTrashPath = join(trashDir, newFilename)
      finalTrashRelativePath = join('.trash', newFilename)
    }

    if (isNoteFavorite(relativePath)) {
      renameNoteFavorite(relativePath, finalTrashRelativePath)
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

    if (isNoteFavorite(trashPath)) {
      renameNoteFavorite(trashPath, relativePath)
    }

    return {
      path: relativePath,
      title: extractTitle(content, filename),
      preview: extractPreview(content),
      modifiedAt: stats.mtime.toISOString(),
      isFavorite: isNoteFavorite(relativePath),
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

    deleteNoteFavorite(trashPath)
    unlinkSync(fullPath)
    return true
  })

  // Toggle favorite status
  ipcMain.handle('notes:toggleFavorite', async (_event, relativePath: string) => {
    const fullPath = join(notesDir, relativePath)
    if (!existsSync(fullPath)) {
      throw new Error('Note not found')
    }

    const newFavoriteStatus = toggleNoteFavorite(relativePath)

    const content = readFileSync(fullPath, 'utf-8')
    const stats = statSync(fullPath)
    const folder = dirname(relativePath)

    return {
      path: relativePath,
      title: extractTitle(content, basename(relativePath)),
      preview: extractPreview(content),
      modifiedAt: stats.mtime.toISOString(),
      isFavorite: newFavoriteStatus,
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
          const noteRelativePath = relative(notesDir, entryPath)
          const trashPath = join(trashDir, entry.name)
          let finalTrashPath = trashPath
          let finalTrashRelativePath = join('.trash', entry.name)
          if (existsSync(trashPath)) {
            const ext = entry.name.includes('.') ? entry.name.slice(entry.name.lastIndexOf('.')) : ''
            const base = entry.name.includes('.') ? entry.name.slice(0, entry.name.lastIndexOf('.')) : entry.name
            const newFilename = `${base}-${Date.now()}${ext}`
            finalTrashPath = join(trashDir, newFilename)
            finalTrashRelativePath = join('.trash', newFilename)
          }
          if (isNoteFavorite(noteRelativePath)) {
            renameNoteFavorite(noteRelativePath, finalTrashRelativePath)
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

  // Move a note to a new folder
  ipcMain.handle(
    'notes:move',
    async (_event, { sourcePath, targetFolder }: { sourcePath: string; targetFolder: string }) => {
      const sourceFullPath = join(notesDir, sourcePath)
      if (!existsSync(sourceFullPath)) {
        throw new Error('Note not found')
      }

      const filename = basename(sourcePath)
      const targetDir = targetFolder ? join(notesDir, targetFolder) : notesDir

      // Ensure target directory exists
      if (!existsSync(targetDir)) {
        mkdirSync(targetDir, { recursive: true })
      }

      // Handle filename conflicts
      let finalFilename = filename
      let targetPath = join(targetDir, finalFilename)
      let counter = 2

      while (existsSync(targetPath)) {
        const ext = filename.includes('.') ? filename.slice(filename.lastIndexOf('.')) : ''
        const base = filename.includes('.') ? filename.slice(0, filename.lastIndexOf('.')) : filename
        finalFilename = `${base} (${counter})${ext}`
        targetPath = join(targetDir, finalFilename)
        counter++
      }

      // Get old relative path for favorite handling
      const oldRelativePath = sourcePath
      const newRelativePath = relative(notesDir, targetPath)

      // Update favorite if needed
      if (isNoteFavorite(oldRelativePath)) {
        renameNoteFavorite(oldRelativePath, newRelativePath)
      }

      // Move the file
      renameSync(sourceFullPath, targetPath)

      // Return updated note info
      const content = readFileSync(targetPath, 'utf-8')
      const stats = statSync(targetPath)
      const folder = dirname(newRelativePath)

      return {
        path: newRelativePath,
        title: extractTitle(content, finalFilename),
        preview: extractPreview(content),
        modifiedAt: stats.mtime.toISOString(),
        isFavorite: isNoteFavorite(newRelativePath),
        isDeleted: false,
        folder: folder === '.' ? '' : folder,
        tags: parseHashtags(content)
      } as NoteInfo
    }
  )

  // Move a folder to a new parent folder
  ipcMain.handle(
    'notes:moveFolder',
    async (_event, { sourcePath, targetFolder }: { sourcePath: string; targetFolder: string }) => {
      const sourceFullPath = join(notesDir, sourcePath)
      if (!existsSync(sourceFullPath)) {
        throw new Error('Folder not found')
      }

      const folderName = basename(sourcePath)
      const targetDir = targetFolder ? join(notesDir, targetFolder) : notesDir

      // Ensure target directory exists
      if (!existsSync(targetDir)) {
        mkdirSync(targetDir, { recursive: true })
      }

      // Handle name conflicts
      let finalFolderName = folderName
      let targetPath = join(targetDir, finalFolderName)
      let counter = 2

      while (existsSync(targetPath)) {
        finalFolderName = `${folderName} (${counter})`
        targetPath = join(targetDir, finalFolderName)
        counter++
      }

      // Get all notes in the folder to update their favorites
      const updateFavorites = (dir: string, oldBase: string, newBase: string): void => {
        const entries = readdirSync(dir, { withFileTypes: true })
        for (const entry of entries) {
          const entryPath = join(dir, entry.name)
          if (entry.isDirectory()) {
            updateFavorites(entryPath, oldBase, newBase)
          } else if (isNoteFile(entry.name)) {
            const oldRelativePath = relative(notesDir, entryPath)
            const newRelativePath = oldRelativePath.replace(oldBase, newBase)
            if (isNoteFavorite(oldRelativePath)) {
              renameNoteFavorite(oldRelativePath, newRelativePath)
            }
          }
        }
      }

      const oldRelativePath = sourcePath
      const newRelativePath = relative(notesDir, targetPath)
      updateFavorites(sourceFullPath, oldRelativePath, newRelativePath)

      // Move the folder
      renameSync(sourceFullPath, targetPath)

      return {
        name: finalFolderName,
        path: newRelativePath,
        children: getAllFolders(targetPath, notesDir)
      } as FolderNode
    }
  )
}
