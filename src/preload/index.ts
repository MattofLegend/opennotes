import { contextBridge, ipcRenderer } from 'electron'
import type { Thread, ModelConfig, Provider, StreamEvent, HITLDecision } from '../main/types'

// Simple electron API - replaces @electron-toolkit/preload
const electronAPI = {
  ipcRenderer: {
    send: (channel: string, ...args: unknown[]) => ipcRenderer.send(channel, ...args),
    on: (channel: string, listener: (...args: unknown[]) => void) => {
      ipcRenderer.on(channel, (_event, ...args) => listener(...args))
      return () => ipcRenderer.removeListener(channel, listener)
    },
    once: (channel: string, listener: (...args: unknown[]) => void) => {
      ipcRenderer.once(channel, (_event, ...args) => listener(...args))
    },
    invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args)
  },
  process: {
    platform: process.platform,
    versions: process.versions
  }
}

// Custom APIs for renderer
const api = {
  agent: {
    // Send message and receive events via callback
    invoke: (
      threadId: string,
      message: string,
      onEvent: (event: StreamEvent) => void
    ): (() => void) => {
      const channel = `agent:stream:${threadId}`

      const handler = (_: unknown, data: StreamEvent): void => {
        onEvent(data)
        if (data.type === 'done' || data.type === 'error') {
          ipcRenderer.removeListener(channel, handler)
        }
      }

      ipcRenderer.on(channel, handler)
      ipcRenderer.send('agent:invoke', { threadId, message })

      // Return cleanup function
      return () => {
        ipcRenderer.removeListener(channel, handler)
      }
    },
    // Stream agent events for useStream transport
    streamAgent: (
      threadId: string,
      message: string,
      command: unknown,
      onEvent: (event: StreamEvent) => void
    ): (() => void) => {
      const channel = `agent:stream:${threadId}`

      const handler = (_: unknown, data: StreamEvent): void => {
        onEvent(data)
        if (data.type === 'done' || data.type === 'error') {
          ipcRenderer.removeListener(channel, handler)
        }
      }

      ipcRenderer.on(channel, handler)

      // If we have a command, it might be a resume/retry
      if (command) {
        ipcRenderer.send('agent:resume', { threadId, command })
      } else {
        ipcRenderer.send('agent:invoke', { threadId, message })
      }

      // Return cleanup function
      return () => {
        ipcRenderer.removeListener(channel, handler)
      }
    },
    interrupt: (
      threadId: string,
      decision: HITLDecision,
      onEvent?: (event: StreamEvent) => void
    ): (() => void) => {
      const channel = `agent:stream:${threadId}`

      const handler = (_: unknown, data: StreamEvent): void => {
        onEvent?.(data)
        if (data.type === 'done' || data.type === 'error') {
          ipcRenderer.removeListener(channel, handler)
        }
      }

      ipcRenderer.on(channel, handler)
      ipcRenderer.send('agent:interrupt', { threadId, decision })

      // Return cleanup function
      return () => {
        ipcRenderer.removeListener(channel, handler)
      }
    },
    cancel: (threadId: string): Promise<void> => {
      return ipcRenderer.invoke('agent:cancel', { threadId })
    }
  },
  threads: {
    list: (): Promise<Thread[]> => {
      return ipcRenderer.invoke('threads:list')
    },
    get: (threadId: string): Promise<Thread | null> => {
      return ipcRenderer.invoke('threads:get', threadId)
    },
    create: (metadata?: Record<string, unknown>): Promise<Thread> => {
      return ipcRenderer.invoke('threads:create', metadata)
    },
    update: (threadId: string, updates: Partial<Thread>): Promise<Thread> => {
      return ipcRenderer.invoke('threads:update', { threadId, updates })
    },
    delete: (threadId: string): Promise<void> => {
      return ipcRenderer.invoke('threads:delete', threadId)
    },
    getHistory: (threadId: string): Promise<unknown[]> => {
      return ipcRenderer.invoke('threads:history', threadId)
    },
    generateTitle: (message: string): Promise<string> => {
      return ipcRenderer.invoke('threads:generateTitle', message)
    }
  },
  models: {
    list: (): Promise<ModelConfig[]> => {
      return ipcRenderer.invoke('models:list')
    },
    listProviders: (): Promise<Provider[]> => {
      return ipcRenderer.invoke('models:listProviders')
    },
    getDefault: (): Promise<string> => {
      return ipcRenderer.invoke('models:getDefault')
    },
    setDefault: (modelId: string): Promise<void> => {
      return ipcRenderer.invoke('models:setDefault', modelId)
    },
    setApiKey: (provider: string, apiKey: string): Promise<void> => {
      return ipcRenderer.invoke('models:setApiKey', { provider, apiKey })
    },
    getApiKey: (provider: string): Promise<string | null> => {
      return ipcRenderer.invoke('models:getApiKey', provider)
    },
    deleteApiKey: (provider: string): Promise<void> => {
      return ipcRenderer.invoke('models:deleteApiKey', provider)
    }
  },
  workspace: {
    get: (threadId?: string): Promise<string | null> => {
      return ipcRenderer.invoke('workspace:get', threadId)
    },
    set: (threadId: string | undefined, path: string | null): Promise<string | null> => {
      return ipcRenderer.invoke('workspace:set', { threadId, path })
    },
    select: (threadId?: string): Promise<string | null> => {
      return ipcRenderer.invoke('workspace:select', threadId)
    },
    loadFromDisk: (threadId: string): Promise<{
      success: boolean
      files: Array<{
        path: string
        is_dir: boolean
        size?: number
        modified_at?: string
      }>
      workspacePath?: string
      error?: string
    }> => {
      return ipcRenderer.invoke('workspace:loadFromDisk', { threadId })
    },
    readFile: (threadId: string, filePath: string): Promise<{
      success: boolean
      content?: string
      size?: number
      modified_at?: string
      error?: string
    }> => {
      return ipcRenderer.invoke('workspace:readFile', { threadId, filePath })
    },
    readBinaryFile: (threadId: string, filePath: string): Promise<{
      success: boolean
      content?: string
      size?: number
      modified_at?: string
      error?: string
    }> => {
      return ipcRenderer.invoke('workspace:readBinaryFile', { threadId, filePath })
    },
    // Listen for file changes in the workspace
    onFilesChanged: (
      callback: (data: { threadId: string; workspacePath: string }) => void
    ): (() => void) => {
      const handler = (_: unknown, data: { threadId: string; workspacePath: string }): void => {
        callback(data)
      }
      ipcRenderer.on('workspace:files-changed', handler)
      // Return cleanup function
      return () => {
        ipcRenderer.removeListener('workspace:files-changed', handler)
      }
    }
  },
  notes: {
    // List all notes with metadata
    list: (): Promise<Array<{
      path: string
      title: string
      preview: string
      modifiedAt: string
      isFavorite: boolean
      isDeleted: boolean
      folder: string
    }>> => {
      return ipcRenderer.invoke('notes:list')
    },
    // List only folders (for sidebar browser)
    listFolders: (): Promise<Array<{
      name: string
      path: string
      children: unknown[]
    }>> => {
      return ipcRenderer.invoke('notes:listFolders')
    },
    // Read a note's content
    read: (path: string): Promise<string> => {
      return ipcRenderer.invoke('notes:read', path)
    },
    // Create a new note
    create: (params: { folder?: string; filename: string; content?: string }): Promise<{
      path: string
      title: string
      preview: string
      modifiedAt: string
      isFavorite: boolean
      isDeleted: boolean
      folder: string
    }> => {
      return ipcRenderer.invoke('notes:create', params)
    },
    // Create a new folder
    createFolder: (params: { parentFolder?: string; name: string }): Promise<{
      name: string
      path: string
      children: unknown[]
    }> => {
      return ipcRenderer.invoke('notes:createFolder', params)
    },
    // Update a note's content
    update: (params: { path: string; content: string }): Promise<{
      path: string
      title: string
      preview: string
      modifiedAt: string
      isFavorite: boolean
      isDeleted: boolean
      folder: string
    }> => {
      return ipcRenderer.invoke('notes:update', params)
    },
    // Delete a note (move to trash)
    delete: (path: string): Promise<boolean> => {
      return ipcRenderer.invoke('notes:delete', path)
    },
    // Restore a note from trash
    restore: (params: { trashPath: string; targetFolder?: string }): Promise<{
      path: string
      title: string
      preview: string
      modifiedAt: string
      isFavorite: boolean
      isDeleted: boolean
      folder: string
    }> => {
      return ipcRenderer.invoke('notes:restore', params)
    },
    // Permanently delete a note from trash
    permanentDelete: (trashPath: string): Promise<boolean> => {
      return ipcRenderer.invoke('notes:permanentDelete', trashPath)
    },
    // Toggle favorite status
    toggleFavorite: (path: string): Promise<{
      path: string
      title: string
      preview: string
      modifiedAt: string
      isFavorite: boolean
      isDeleted: boolean
      folder: string
    }> => {
      return ipcRenderer.invoke('notes:toggleFavorite', path)
    },
    // Get all tags from notes
    getTags: (): Promise<Array<{
      name: string
      fullPath: string
      count: number
      children: unknown[]
    }>> => {
      return ipcRenderer.invoke('notes:getTags')
    },
    // Delete a folder and all its contents
    deleteFolder: (folderPath: string): Promise<boolean> => {
      return ipcRenderer.invoke('notes:deleteFolder', folderPath)
    },
    // Get notes directory path
    getPath: (): Promise<string> => {
      return ipcRenderer.invoke('notes:getPath')
    },
    // Show a note or folder in Finder
    showInFinder: (relativePath: string): Promise<boolean> => {
      return ipcRenderer.invoke('notes:showInFinder', relativePath)
    },
    // Open the notes directory in Finder
    openNotesFolder: (): Promise<boolean> => {
      return ipcRenderer.invoke('notes:openNotesFolder')
    }
  }
}

// Use `contextBridge` APIs to expose Electron APIs to renderer
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
