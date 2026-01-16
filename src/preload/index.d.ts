import type { Thread, ModelConfig, StreamEvent, HITLDecision, Project } from '../main/types'

interface ElectronAPI {
  ipcRenderer: {
    send: (channel: string, ...args: unknown[]) => void
    on: (channel: string, listener: (...args: unknown[]) => void) => () => void
    once: (channel: string, listener: (...args: unknown[]) => void) => void
    invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
  }
  process: {
    platform: NodeJS.Platform
    versions: NodeJS.ProcessVersions
  }
}

interface CustomAPI {
  agent: {
    invoke: (threadId: string, message: string, onEvent: (event: StreamEvent) => void) => () => void
    streamAgent: (
      threadId: string,
      message: string,
      command: unknown,
      onEvent: (event: StreamEvent) => void
    ) => () => void
    interrupt: (
      threadId: string,
      decision: HITLDecision,
      onEvent?: (event: StreamEvent) => void
    ) => () => void
    cancel: (threadId: string) => Promise<void>
  }
  threads: {
    list: (projectId?: string | null) => Promise<Thread[]>
    get: (threadId: string) => Promise<Thread | null>
    create: (options?: { metadata?: Record<string, unknown>; projectId?: string | null }) => Promise<Thread>
    update: (threadId: string, updates: Partial<Thread> & { project_id?: string | null }) => Promise<Thread>
    delete: (threadId: string) => Promise<void>
    getHistory: (threadId: string) => Promise<unknown[]>
    generateTitle: (message: string) => Promise<string>
  }
  projects: {
    list: () => Promise<Project[]>
    get: (projectId: string) => Promise<Project | null>
    create: (params: { name: string }) => Promise<Project>
    update: (projectId: string, updates: { name?: string; notesFolder?: string }) => Promise<Project>
    delete: (projectId: string) => Promise<void>
  }
  models: {
    list: () => Promise<ModelConfig[]>
    listProviders: () => Promise<Provider[]>
    getDefault: () => Promise<string>
    deleteApiKey: (provider: string) => Promise<void>
    setDefault: (modelId: string) => Promise<void>
    setApiKey: (provider: string, apiKey: string) => Promise<void>
    getApiKey: (provider: string) => Promise<string | null>
  }
  workspace: {
    get: (threadId?: string) => Promise<string | null>
    set: (threadId: string | undefined, path: string | null) => Promise<string | null>
    select: (threadId?: string) => Promise<string | null>
    loadFromDisk: (threadId: string) => Promise<{
      success: boolean
      files: Array<{
        path: string
        is_dir: boolean
        size?: number
        modified_at?: string
      }>
      workspacePath?: string
      error?: string
    }>
    readFile: (threadId: string, filePath: string) => Promise<{
      success: boolean
      content?: string
      size?: number
      modified_at?: string
      error?: string
    }>
    readBinaryFile: (threadId: string, filePath: string) => Promise<{
      success: boolean
      content?: string
      size?: number
      modified_at?: string
      error?: string
    }>
    onFilesChanged: (
      callback: (data: { threadId: string; workspacePath: string }) => void
    ) => () => void
  }
  notes: {
    list: () => Promise<Array<{
      path: string
      title: string
      preview: string
      modifiedAt: string
      isFavorite: boolean
      isDeleted: boolean
      folder: string
      tags: string[]
    }>>
    listFolders: () => Promise<Array<{
      name: string
      path: string
      children: unknown[]
    }>>
    read: (path: string) => Promise<string>
    create: (params: { folder?: string; filename: string; content?: string }) => Promise<{
      path: string
      title: string
      preview: string
      modifiedAt: string
      isFavorite: boolean
      isDeleted: boolean
      folder: string
      tags: string[]
    }>
    createFolder: (params: { parentFolder?: string; name: string }) => Promise<{
      name: string
      path: string
      children: unknown[]
    }>
    update: (params: { path: string; content: string }) => Promise<{
      path: string
      title: string
      preview: string
      modifiedAt: string
      isFavorite: boolean
      isDeleted: boolean
      folder: string
      tags: string[]
    }>
    delete: (path: string) => Promise<boolean>
    restore: (params: { trashPath: string; targetFolder?: string }) => Promise<{
      path: string
      title: string
      preview: string
      modifiedAt: string
      isFavorite: boolean
      isDeleted: boolean
      folder: string
      tags: string[]
    }>
    permanentDelete: (trashPath: string) => Promise<boolean>
    toggleFavorite: (path: string) => Promise<{
      path: string
      title: string
      preview: string
      modifiedAt: string
      isFavorite: boolean
      isDeleted: boolean
      folder: string
      tags: string[]
    }>
    getTags: () => Promise<Array<{
      name: string
      fullPath: string
      count: number
      children: unknown[]
    }>>
    deleteFolder: (folderPath: string) => Promise<boolean>
    getPath: () => Promise<string>
    showInFinder: (relativePath: string) => Promise<boolean>
    openNotesFolder: () => Promise<boolean>
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: CustomAPI
  }
}
