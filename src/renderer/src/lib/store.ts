import { create } from 'zustand'
import type {
  Thread,
  Message,
  Todo,
  ModelConfig,
  Provider,
  HITLRequest,
  FileInfo,
  Subagent,
  NoteInfo,
  FolderNode,
  TagNode,
  NotesFilter,
  Project
} from '@/types'

// Open file tab type
export interface OpenFile {
  path: string
  name: string
}

// Tab state per thread
export interface TabState {
  openFiles: OpenFile[]
  activeTab: 'agent' | string
  fileContents: Record<string, string>
}

interface AppState {
  // Projects
  projects: Project[]
  currentProjectId: string | null // null = "All Projects" view

  // Threads
  threads: Thread[]
  currentThreadId: string | null
  isNewChat: boolean // True when in ephemeral "new chat" mode (not yet persisted)

  // Messages for current thread
  messages: Message[]

  // HITL state
  pendingApproval: HITLRequest | null

  // Todos (from agent)
  todos: Todo[]

  // Workspace files (from agent)
  workspaceFiles: FileInfo[]
  workspacePath: string | null

  // Subagents (from agent)
  subagents: Subagent[]

  // Loading state - which thread is currently streaming
  loadingThreadId: string | null

  // Error state - errors by thread ID
  errorByThread: Record<string, string>

  // Models and Providers
  models: ModelConfig[]
  providers: Provider[]
  currentModel: string

  // Right panel state
  rightPanelTab: 'todos' | 'files' | 'subagents'
  rightPanelMode: 'chat' | 'inspector'

  // Settings dialog state
  settingsOpen: boolean

  // Sidebar state
  sidebarCollapsed: boolean

  // File viewer tabs state
  openFiles: OpenFile[]
  activeTab: 'agent' | string // 'agent' or file path
  fileContents: Record<string, string> // path -> content cache

  // Per-thread tab state persistence (legacy, may be removed)
  tabStateByThread: Record<string, TabState>

  // Per-project tab state persistence
  tabStateByProject: Record<string, TabState>

  // Notes system state
  notes: NoteInfo[]
  folders: FolderNode[]
  tags: TagNode[]
  notesFilter: NotesFilter
  notesPath: string | null

  // Project actions
  loadProjects: () => Promise<void>
  createProject: (name: string) => Promise<Project>
  selectProject: (projectId: string | null) => void
  deleteProject: (projectId: string) => Promise<void>
  updateProject: (projectId: string, updates: Partial<Project>) => Promise<void>

  // Thread actions
  loadThreads: () => Promise<void>
  createThread: (metadata?: Record<string, unknown>) => Promise<Thread>
  selectThread: (threadId: string) => Promise<void>
  deleteThread: (threadId: string) => Promise<void>
  updateThread: (threadId: string, updates: Partial<Thread>) => Promise<void>
  startNewChat: () => void // Enter ephemeral "new chat" mode
  ensureThread: () => Promise<string> // Create thread if in new chat mode, return thread ID

  // Message actions
  appendMessage: (message: Message) => void
  setMessages: (messages: Message[]) => void
  generateTitleForFirstMessage: (threadId: string, content: string) => Promise<void>

  // HITL actions
  setPendingApproval: (request: HITLRequest | null) => void
  respondToApproval: (
    decision: 'approve' | 'reject' | 'edit',
    editedArgs?: Record<string, unknown>
  ) => Promise<void>

  // Todo actions
  setTodos: (todos: Todo[]) => void

  // Workspace actions
  setWorkspaceFiles: (files: FileInfo[] | ((prev: FileInfo[]) => FileInfo[])) => void
  setWorkspacePath: (path: string | null) => void

  // Subagent actions
  setSubagents: (subagents: Subagent[]) => void

  // Loading state actions
  setLoadingThreadId: (threadId: string | null) => void

  // Error state actions
  setThreadError: (threadId: string, error: string) => void
  clearThreadError: (threadId: string) => void

  // Model actions
  loadModels: () => Promise<void>
  loadProviders: () => Promise<void>
  setCurrentModel: (modelId: string) => Promise<void>
  setApiKey: (providerId: string, apiKey: string) => Promise<void>
  deleteApiKey: (providerId: string) => Promise<void>

  // Panel actions
  setRightPanelTab: (tab: 'todos' | 'files' | 'subagents') => void
  setRightPanelMode: (mode: 'chat' | 'inspector') => void

  // Settings actions
  setSettingsOpen: (open: boolean) => void

  // Sidebar actions
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void

  // File viewer tab actions
  openFile: (path: string, name: string) => void
  closeFile: (path: string) => void
  setActiveTab: (tab: 'agent' | string) => void
  setFileContents: (path: string, content: string) => void

  // Notes actions
  loadNotes: () => Promise<void>
  loadFolders: () => Promise<void>
  loadTags: () => Promise<void>
  setNotesFilter: (filter: NotesFilter) => void
  createNote: (folder?: string, filename?: string) => Promise<NoteInfo>
  createFolder: (parentFolder?: string, name?: string) => Promise<FolderNode>
  deleteNote: (path: string) => Promise<void>
  restoreNote: (trashPath: string, targetFolder?: string) => Promise<void>
  permanentDeleteNote: (trashPath: string) => Promise<void>
  toggleNoteFavorite: (path: string) => Promise<void>
  updateNote: (path: string, content: string) => Promise<void>
  deleteFolder: (folderPath: string) => Promise<void>
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  projects: [],
  currentProjectId: null,
  threads: [],
  currentThreadId: null,
  isNewChat: true, // Start in new chat mode
  messages: [],
  pendingApproval: null,
  todos: [],
  workspaceFiles: [],
  workspacePath: null,
  subagents: [],
  loadingThreadId: null,
  errorByThread: {},
  models: [],
  providers: [],
  currentModel: 'claude-sonnet-4-5-20250929',
  rightPanelTab: 'todos',
  rightPanelMode: 'chat',
  settingsOpen: false,
  sidebarCollapsed: false,
  openFiles: [],
  activeTab: 'agent',
  fileContents: {},
  tabStateByThread: {},
  tabStateByProject: {},

  // Notes system initial state
  notes: [],
  folders: [],
  tags: [],
  notesFilter: { type: 'smart', value: 'all' },
  notesPath: null,

  // Project actions
  loadProjects: async () => {
    const projects = await window.api.projects.list()
    set({ projects })
  },

  createProject: async (name: string) => {
    const project = await window.api.projects.create({ name })
    set((state) => ({ projects: [project, ...state.projects] }))
    // Switch to the new project
    get().selectProject(project.id)
    return project
  },

  selectProject: (projectId: string | null) => {
    const state = get()
    const { currentProjectId, loadThreads, loadNotes, loadFolders, loadTags, projects, notesPath, tabStateByProject } = state
    if (currentProjectId === projectId) return

    // Save current project's tab state before switching
    let updatedTabStateByProject = tabStateByProject
    if (currentProjectId !== null) {
      updatedTabStateByProject = {
        ...tabStateByProject,
        [currentProjectId]: {
          openFiles: state.openFiles,
          activeTab: state.activeTab,
          fileContents: state.fileContents
        }
      }
    }

    // Find the project to get its folder
    const project = projectId ? projects.find((p) => p.id === projectId) : null
    
    // Build the workspace path for this project
    const projectWorkspacePath = project && notesPath 
      ? `${notesPath}/${project.notesFolder}` 
      : null

    // Restore tab state for the target project (or default to empty)
    const savedTabState = projectId ? updatedTabStateByProject[projectId] : null
    const newTabState = savedTabState || {
      openFiles: [],
      activeTab: 'agent' as const,
      fileContents: {}
    }
    
    set({
      currentProjectId: projectId,
      currentThreadId: null,
      isNewChat: true,
      messages: [],
      // Restore tab state for this project
      openFiles: newTabState.openFiles,
      activeTab: newTabState.activeTab,
      fileContents: newTabState.fileContents,
      // Save updated tab state
      tabStateByProject: updatedTabStateByProject,
      // Set workspace to project folder
      workspacePath: projectWorkspacePath,
      workspaceFiles: []
    })

    // If selecting a project, set the notes filter to that project's folder
    if (project) {
      set({ notesFilter: { type: 'folder', value: project.notesFolder } })
    } else {
      // "All Projects" - show all notes
      set({ notesFilter: { type: 'smart', value: 'all' } })
    }

    // Reload threads for this project scope
    loadThreads()
    loadNotes()
    loadFolders()
    loadTags()
  },

  deleteProject: async (projectId: string) => {
    await window.api.projects.delete(projectId)
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== projectId),
      // If we deleted the current project, switch to "All Projects"
      currentProjectId: state.currentProjectId === projectId ? null : state.currentProjectId
    }))
    // Reload threads if we switched project
    if (get().currentProjectId === null) {
      get().loadThreads()
    }
  },

  updateProject: async (projectId: string, updates: Partial<Project>) => {
    const project = await window.api.projects.update(projectId, updates)
    set((state) => ({
      projects: state.projects.map((p) => (p.id === projectId ? project : p))
    }))
  },

  // Thread actions
  loadThreads: async () => {
    const { currentProjectId, isNewChat } = get()
    // If no project selected (All Projects view), get all threads
    // If a project is selected, get only that project's threads
    const threads = await window.api.threads.list(currentProjectId === null ? undefined : currentProjectId)
    set({ threads })

    // Select first thread if none selected AND not in new chat mode
    // (new chat mode means user wants to start fresh, don't auto-select)
    if (!get().currentThreadId && !isNewChat && threads.length > 0) {
      await get().selectThread(threads[0].thread_id)
    }
  },

  createThread: async (metadata?: Record<string, unknown>) => {
    const currentState = get()

    // Save current thread's tab state before switching
    let newTabStateByThread = currentState.tabStateByThread
    if (currentState.currentThreadId) {
      const currentTabState: TabState = {
        openFiles: currentState.openFiles,
        activeTab: currentState.activeTab,
        fileContents: currentState.fileContents
      }
      newTabStateByThread = {
        ...newTabStateByThread,
        [currentState.currentThreadId]: currentTabState
      }
    }

    // Create thread with current project ID (or null for unassigned)
    const thread = await window.api.threads.create({
      metadata,
      projectId: currentState.currentProjectId
    })
    set((state) => ({
      threads: [thread, ...state.threads],
      currentThreadId: thread.thread_id,
      isNewChat: false, // Now we have a real thread
      messages: [],
      todos: [],
      workspaceFiles: [],
      // Keep workspacePath - it may have been pre-set (e.g., from project selection)
      subagents: [],
      // Reset tabs for new thread
      openFiles: [],
      activeTab: 'agent',
      fileContents: {},
      tabStateByThread: newTabStateByThread
    }))
    return thread
  },

  selectThread: async (threadId: string) => {
    // Update thread selection but preserve open files/tabs
    // Notes belong to the project, not the thread, so switching threads
    // shouldn't close notes
    set((state) => ({
      currentThreadId: threadId,
      isNewChat: false, // Selecting an existing thread
      messages: [],
      todos: [],
      workspaceFiles: [],
      // Keep workspacePath - will be loaded from thread metadata below
      subagents: []
      // DON'T reset openFiles, activeTab, fileContents - notes persist across threads
    }))

    // Load workspace path from thread metadata
    try {
      const path = await window.api.workspace.get(threadId)
      if (path) {
        set({ workspacePath: path })

        // Load files from disk when workspace is linked
        const diskResult = await window.api.workspace.loadFromDisk(threadId)
        if (diskResult.success) {
          set({ workspaceFiles: diskResult.files })
        }
      }
    } catch (error) {
      console.error('Failed to load workspace path:', error)
    }

    // Load thread history from checkpoints
    try {
      const history = await window.api.threads.getHistory(threadId)

      // Get the most recent checkpoint (first in the list since it's ordered DESC)
      if (history.length > 0) {
        const latestCheckpoint = history[0] as {
          checkpoint?: {
            channel_values?: {
              messages?: Array<{
                id?: string
                _getType?: () => string
                type?: string
                content?: string | unknown[]
                tool_calls?: unknown[]
                tool_call_id?: string
                name?: string
              }>
              todos?: Array<{
                id?: string
                content?: string
                status?: string
              }>
            }
          }
        }

        const channelValues = latestCheckpoint.checkpoint?.channel_values

        // Extract messages
        if (channelValues?.messages && Array.isArray(channelValues.messages)) {
          const messages: Message[] = channelValues.messages.map((msg, index) => {
            // Determine role from message type
            let role: 'user' | 'assistant' | 'system' | 'tool' = 'assistant'
            if (typeof msg._getType === 'function') {
              const type = msg._getType()
              if (type === 'human') role = 'user'
              else if (type === 'ai') role = 'assistant'
              else if (type === 'system') role = 'system'
              else if (type === 'tool') role = 'tool'
            } else if (msg.type) {
              if (msg.type === 'human') role = 'user'
              else if (msg.type === 'ai') role = 'assistant'
              else if (msg.type === 'system') role = 'system'
              else if (msg.type === 'tool') role = 'tool'
            }

            // Handle content - could be string or array of content blocks
            let content: Message['content'] = ''
            if (typeof msg.content === 'string') {
              content = msg.content
            } else if (Array.isArray(msg.content)) {
              content = msg.content as Message['content']
            }

            return {
              id: msg.id || `msg-${index}`,
              role,
              content,
              tool_calls: msg.tool_calls as Message['tool_calls'],
              // Include tool_call_id and name for tool messages
              ...(role === 'tool' && msg.tool_call_id && { tool_call_id: msg.tool_call_id }),
              ...(role === 'tool' && msg.name && { name: msg.name }),
              created_at: new Date()
            }
          })

          set({ messages })
        }

        // Extract todos if present
        if (channelValues?.todos && Array.isArray(channelValues.todos)) {
          const todos: Todo[] = channelValues.todos.map((todo, index) => ({
            id: todo.id || `todo-${index}`,
            content: todo.content || '',
            status: (todo.status as Todo['status']) || 'pending'
          }))

          set({ todos })
        }
      }
    } catch (error) {
      console.error('Failed to load thread history:', error)
    }
  },

  deleteThread: async (threadId: string) => {
    console.log('[Store] Deleting thread:', threadId)
    try {
      await window.api.threads.delete(threadId)
      console.log('[Store] Thread deleted from backend')

      set((state) => {
        const threads = state.threads.filter((t) => t.thread_id !== threadId)
        const wasCurrentThread = state.currentThreadId === threadId
        const newCurrentId = wasCurrentThread
          ? threads[0]?.thread_id || null
          : state.currentThreadId

        console.log('[Store] Updating state:', {
          remainingThreads: threads.length,
          wasCurrentThread,
          newCurrentId
        })

        // Remove tab state for deleted thread
        const { [threadId]: _, ...remainingTabState } = state.tabStateByThread

        // If we're switching to a new thread, restore its tab state
        const newThreadTabState = newCurrentId ? remainingTabState[newCurrentId] : null

        return {
          threads,
          currentThreadId: newCurrentId,
          // Clear messages if we deleted the current thread
          messages: wasCurrentThread ? [] : state.messages,
          // Clear other state if we deleted the current thread
          todos: wasCurrentThread ? [] : state.todos,
          workspaceFiles: wasCurrentThread ? [] : state.workspaceFiles,
          workspacePath: wasCurrentThread ? null : state.workspacePath,
          subagents: wasCurrentThread ? [] : state.subagents,
          // Clean up tab state for deleted thread and restore new thread's tab state if switching
          tabStateByThread: remainingTabState,
          openFiles: wasCurrentThread ? (newThreadTabState?.openFiles || []) : state.openFiles,
          activeTab: wasCurrentThread ? (newThreadTabState?.activeTab || 'agent') : state.activeTab,
          fileContents: wasCurrentThread ? (newThreadTabState?.fileContents || {}) : state.fileContents
        }
      })
    } catch (error) {
      console.error('[Store] Failed to delete thread:', error)
    }
  },

  updateThread: async (threadId: string, updates: Partial<Thread>) => {
    const updated = await window.api.threads.update(threadId, updates)
    set((state) => ({
      threads: state.threads.map((t) => (t.thread_id === threadId ? updated : t))
    }))
  },

  startNewChat: () => {
    // Enter ephemeral "new chat" mode - clear current thread but keep UI ready
    set({
      currentThreadId: null,
      isNewChat: true,
      messages: [],
      todos: [],
      workspaceFiles: [],
      subagents: [],
      // Keep workspace path so user doesn't have to re-select
      // Reset tabs for new chat
      openFiles: [],
      activeTab: 'agent',
      fileContents: {}
    })
  },

  ensureThread: async () => {
    const state = get()
    // If we already have a thread, return it
    if (state.currentThreadId) {
      return state.currentThreadId
    }
    // Create a new thread (this will set isNewChat to false)
    const thread = await get().createThread({
      title: `Chat ${new Date().toLocaleDateString()}`
    })
    
    // If we have a pre-set workspace path (e.g., from project selection), save it to the thread
    if (state.workspacePath) {
      await window.api.workspace.set(thread.thread_id, state.workspacePath)
    }
    
    return thread.thread_id
  },

  // Message actions
  appendMessage: (message: Message) => {
    set((state) => {
      // Check if message already exists (by id)
      const exists = state.messages.some((m) => m.id === message.id)
      if (exists) {
        return { messages: state.messages.map((m) => (m.id === message.id ? message : m)) }
      }
      return { messages: [...state.messages, message] }
    })
  },

  setMessages: (messages: Message[]) => {
    set({ messages })
  },

  // Auto-generate title for first message in a thread
  generateTitleForFirstMessage: async (threadId: string, content: string) => {
    try {
      const generatedTitle = await window.api.threads.generateTitle(content)
      await get().updateThread(threadId, { title: generatedTitle })
    } catch (error) {
      console.error('[Store] Failed to generate title:', error)
    }
  },

  // HITL actions
  setPendingApproval: (request: HITLRequest | null) => {
    set({ pendingApproval: request })
  },

  respondToApproval: async (
    decision: 'approve' | 'reject' | 'edit',
    editedArgs?: Record<string, unknown>
  ) => {
    const { currentThreadId, pendingApproval } = get()
    if (!currentThreadId || !pendingApproval) return

    // Clear pending approval immediately so UI updates
    set({ pendingApproval: null })

    // Send interrupt decision - streaming response handled by useStream hook
    window.api.agent.interrupt(
      currentThreadId,
      {
        type: decision,
        tool_call_id: pendingApproval.tool_call.id,
        edited_args: editedArgs
      }
      // Note: We don't pass onEvent here - the useStream hook in ChatContainer
      // will pick up the stream events on the same channel
    )
  },

  // Todo actions
  setTodos: (todos: Todo[]) => {
    set({ todos })
  },

  // Workspace actions
  setWorkspaceFiles: (files: FileInfo[] | ((prev: FileInfo[]) => FileInfo[])) => {
    if (typeof files === 'function') {
      set((state) => ({ workspaceFiles: files(state.workspaceFiles) }))
    } else {
      set({ workspaceFiles: files })
    }
  },

  setWorkspacePath: (path: string | null) => {
    set({ workspacePath: path })
  },

  // Subagent actions
  setSubagents: (subagents: Subagent[]) => {
    set({ subagents })
  },

  // Loading state actions
  setLoadingThreadId: (threadId: string | null) => {
    set({ loadingThreadId: threadId })
  },

  // Error state actions
  setThreadError: (threadId: string, error: string) => {
    set((state) => ({
      errorByThread: { ...state.errorByThread, [threadId]: error }
    }))
  },

  clearThreadError: (threadId: string) => {
    set((state) => {
      const { [threadId]: _, ...rest } = state.errorByThread
      return { errorByThread: rest }
    })
  },

  // Model actions
  loadModels: async () => {
    const models = await window.api.models.list()
    const currentModel = await window.api.models.getDefault()
    set({ models, currentModel })
  },

  loadProviders: async () => {
    const providers = await window.api.models.listProviders()
    set({ providers })
  },

  setCurrentModel: async (modelId: string) => {
    await window.api.models.setDefault(modelId)
    set({ currentModel: modelId })
  },

  setApiKey: async (providerId: string, apiKey: string) => {
    console.log('[Store] setApiKey called:', { providerId, keyLength: apiKey.length })
    try {
      await window.api.models.setApiKey(providerId, apiKey)
      console.log('[Store] API key saved via IPC')
      // Reload providers and models to update availability
      await get().loadProviders()
      await get().loadModels()
      console.log('[Store] Providers and models reloaded')
    } catch (e) {
      console.error('[Store] Failed to set API key:', e)
      throw e
    }
  },

  deleteApiKey: async (providerId: string) => {
    await window.api.models.deleteApiKey(providerId)
    // Reload providers and models to update availability
    await get().loadProviders()
    await get().loadModels()
  },

  // Panel actions
  setRightPanelTab: (tab: 'todos' | 'files' | 'subagents') => {
    set({ rightPanelTab: tab })
  },

  setRightPanelMode: (mode: 'chat' | 'inspector') => {
    set({ rightPanelMode: mode })
  },

  // Settings actions
  setSettingsOpen: (open: boolean) => {
    set({ settingsOpen: open })
  },

  // Sidebar actions
  toggleSidebar: () => {
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }))
  },

  setSidebarCollapsed: (collapsed: boolean) => {
    set({ sidebarCollapsed: collapsed })
  },

  // File viewer tab actions
  openFile: (path: string, name: string) => {
    set((state) => {
      // Check if file is already open
      const alreadyOpen = state.openFiles.some((f) => f.path === path)
      if (alreadyOpen) {
        // Just switch to it
        return { activeTab: path }
      }
      // Add to open files and switch to it
      return {
        openFiles: [...state.openFiles, { path, name }],
        activeTab: path
      }
    })
  },

  closeFile: (path: string) => {
    set((state) => {
      const newOpenFiles = state.openFiles.filter((f) => f.path !== path)
      // Remove from content cache
      const { [path]: _, ...newFileContents } = state.fileContents

      // If closing the active tab, switch to agent or the previous file
      let newActiveTab = state.activeTab
      if (state.activeTab === path) {
        const closedIndex = state.openFiles.findIndex((f) => f.path === path)
        if (newOpenFiles.length === 0) {
          newActiveTab = 'agent'
        } else if (closedIndex > 0) {
          newActiveTab = newOpenFiles[closedIndex - 1].path
        } else {
          newActiveTab = newOpenFiles[0].path
        }
      }

      return {
        openFiles: newOpenFiles,
        activeTab: newActiveTab,
        fileContents: newFileContents
      }
    })
  },

  setActiveTab: (tab: 'agent' | string) => {
    set({ activeTab: tab })
  },

  setFileContents: (path: string, content: string) => {
    set((state) => ({
      fileContents: { ...state.fileContents, [path]: content }
    }))
  },

  // Notes actions
  loadNotes: async () => {
    try {
      const notes = await window.api.notes.list()
      const notesPath = await window.api.notes.getPath()
      set({ notes, notesPath })
    } catch (error) {
      console.error('[Store] Failed to load notes:', error)
    }
  },

  loadFolders: async () => {
    try {
      const folders = await window.api.notes.listFolders() as FolderNode[]
      set({ folders })
    } catch (error) {
      console.error('[Store] Failed to load folders:', error)
    }
  },

  loadTags: async () => {
    try {
      const tags = await window.api.notes.getTags() as TagNode[]
      set({ tags })
    } catch (error) {
      console.error('[Store] Failed to load tags:', error)
    }
  },

  setNotesFilter: (filter: NotesFilter) => {
    set({ notesFilter: filter })
  },

  createNote: async (folder?: string, filename?: string) => {
    // Use ISO date format to avoid slashes in filename
    const dateStr = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    const finalFilename = filename || `Note ${dateStr}.md`
    const note = await window.api.notes.create({ folder, filename: finalFilename })
    // Reload notes and folders
    await get().loadNotes()
    await get().loadFolders()
    await get().loadTags()
    return note
  },

  createFolder: async (parentFolder?: string, name?: string) => {
    const finalName = name || `New Folder ${Date.now()}`
    const folder = await window.api.notes.createFolder({ parentFolder, name: finalName }) as FolderNode
    // Reload folders
    await get().loadFolders()
    return folder
  },

  deleteNote: async (path: string) => {
    await window.api.notes.delete(path)
    // Reload notes
    await get().loadNotes()
    await get().loadTags()
  },

  restoreNote: async (trashPath: string, targetFolder?: string) => {
    await window.api.notes.restore({ trashPath, targetFolder })
    // Reload notes
    await get().loadNotes()
    await get().loadTags()
  },

  permanentDeleteNote: async (trashPath: string) => {
    await window.api.notes.permanentDelete(trashPath)
    // Reload notes
    await get().loadNotes()
  },

  toggleNoteFavorite: async (path: string) => {
    const updatedNote = await window.api.notes.toggleFavorite(path)
    // Update the note in state
    set((state) => ({
      notes: state.notes.map((n) => (n.path === path ? updatedNote : n))
    }))
  },

  updateNote: async (path: string, content: string) => {
    const updatedNote = await window.api.notes.update({ path, content })
    // Update the note in state
    set((state) => ({
      notes: state.notes.map((n) => (n.path === path ? updatedNote : n))
    }))
    // Reload tags in case they changed
    await get().loadTags()
  },

  deleteFolder: async (folderPath: string) => {
    await window.api.notes.deleteFolder(folderPath)
    // Reload notes and folders
    await get().loadNotes()
    await get().loadFolders()
    await get().loadTags()
  }
}))
