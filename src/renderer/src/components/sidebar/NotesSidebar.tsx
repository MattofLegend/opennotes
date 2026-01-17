import { useState, useEffect, useCallback } from 'react'
import {
  Plus,
  FolderKanban,
  Trash2,
  Pencil,
  FileText,
  Clock,
  Star,
  Trash,
  ChevronLeft,
  ChevronDown,
  Layers,
  CircleOff
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAppStore } from '@/lib/store'
import { cn, truncate } from '@/lib/utils'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import { FolderBrowser } from '@/components/notes/FolderBrowser'
import { TagsTree } from '@/components/notes/TagsTree'
import type { SmartViewType } from '@/types'

// Smart View configuration
const SMART_VIEWS: { id: SmartViewType; label: string; icon: React.ElementType }[] = [
  { id: 'all', label: 'All Notes', icon: FileText },
  { id: 'untagged', label: 'Untagged', icon: CircleOff },
  { id: 'recent', label: 'Recent', icon: Clock },
  { id: 'favorites', label: 'Favorites', icon: Star },
  { id: 'trash', label: 'Trash', icon: Trash }
]

export function NotesSidebar(): React.JSX.Element {
  const {
    projects,
    currentProjectId,
    loadProjects,
    createProject,
    selectProject,
    deleteProject,
    updateProject,
    notesFilter,
    setNotesFilter,
    loadNotes,
    loadFolders,
    loadTags,
    createFolder,
    moveNote,
    moveFolder,
    // Threads/Chats
    threads,
    currentThreadId,
    startNewChat,
    selectThread,
    deleteThread,
    updateThread
  } = useAppStore()

  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [isSubmittingProject, setIsSubmittingProject] = useState(false)

  // Section collapse states
  const [projectsOpen, setProjectsOpen] = useState(true)
  const [foldersOpen, setFoldersOpen] = useState(true)
  const [tagsOpen, setTagsOpen] = useState(true)
  const [chatsOpen, setChatsOpen] = useState(true)

  // Chat editing state
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null)
  const [editingThreadTitle, setEditingThreadTitle] = useState('')

  // Creating new folder state
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  // Drag-over state for drop targets
  const [dragOverProjectId, setDragOverProjectId] = useState<string | null>(null)

  // Load data on mount
  useEffect(() => {
    loadProjects()
    loadNotes()
    loadFolders()
    loadTags()
  }, [loadProjects, loadNotes, loadFolders, loadTags])

  const startEditingProject = (projectId: string, currentName: string): void => {
    setEditingProjectId(projectId)
    setEditingName(currentName || '')
  }

  const saveProjectName = async (): Promise<void> => {
    if (editingProjectId && editingName.trim()) {
      await updateProject(editingProjectId, { name: editingName.trim() })
    }
    setEditingProjectId(null)
    setEditingName('')
  }

  const cancelEditingProject = (): void => {
    setEditingProjectId(null)
    setEditingName('')
  }

  const handleNewProject = (): void => {
    setIsCreatingProject(true)
    setNewProjectName('')
    setProjectsOpen(true)
  }

  const handleSubmitProject = async (): Promise<void> => {
    if (isSubmittingProject) return
    setIsSubmittingProject(true)
    
    try {
      if (newProjectName.trim()) {
        await createProject(newProjectName.trim())
      }
    } catch (error) {
      console.error('Failed to create project:', error)
    } finally {
      setIsCreatingProject(false)
      setNewProjectName('')
      setIsSubmittingProject(false)
    }
  }

  const handleCancelProject = (): void => {
    setIsCreatingProject(false)
    setNewProjectName('')
  }

  const handleSmartViewClick = (viewId: SmartViewType): void => {
    setNotesFilter({ type: 'smart', value: viewId })
  }

  const handleCreateFolder = (): void => {
    setIsCreatingFolder(true)
    setNewFolderName('')
    setFoldersOpen(true)
  }

  const handleSubmitFolder = async (): Promise<void> => {
    if (newFolderName.trim()) {
      // If in a project, create folder inside the project's folder
      const currentProject = currentProjectId ? projects.find((p) => p.id === currentProjectId) : null
      const parentFolder = currentProject?.notesFolder || undefined
      await createFolder(parentFolder, newFolderName.trim())
    }
    setIsCreatingFolder(false)
    setNewFolderName('')
  }

  const handleCancelFolder = (): void => {
    setIsCreatingFolder(false)
    setNewFolderName('')
  }

  // Drag and drop handlers for projects
  const handleDragEnter = useCallback((e: React.DragEvent, projectId: string) => {
    e.preventDefault()
    e.stopPropagation()
    console.log('[NotesSidebar] Drag enter project:', projectId, 'types:', e.dataTransfer.types)
    setDragOverProjectId(projectId)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // Only clear if we're leaving the element itself, not entering a child
    const relatedTarget = e.relatedTarget as Node | null
    const currentTarget = e.currentTarget as Node
    if (!relatedTarget || !currentTarget.contains(relatedTarget)) {
      setDragOverProjectId(null)
    }
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent, project: { id: string; notesFolder: string }) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverProjectId(null)

    const notePath = e.dataTransfer.getData('application/x-note-path')
    const folderPath = e.dataTransfer.getData('application/x-folder-path')

    console.log('[NotesSidebar] Drop event:', { notePath, folderPath, targetFolder: project.notesFolder })

    try {
      if (notePath) {
        // Move note to project folder
        console.log('[NotesSidebar] Moving note:', notePath, 'to', project.notesFolder)
        await moveNote(notePath, project.notesFolder)
      } else if (folderPath) {
        // Move folder to project folder
        console.log('[NotesSidebar] Moving folder:', folderPath, 'to', project.notesFolder)
        await moveFolder(folderPath, project.notesFolder)
      }
    } catch (error) {
      console.error('Failed to move item:', error)
    }
  }, [moveNote, moveFolder])

  return (
    <aside className="flex h-full w-full flex-col bg-sidebar overflow-hidden">
      <ScrollArea className="flex-1 min-h-0">
        <div
          className="flex flex-col"
          style={{ paddingTop: 'calc(8px + var(--sidebar-safe-padding, 0px))' }}
        >
          {/* Projects Section */}
          <WideHeader
            title="All Projects"
            isOpen={projectsOpen}
            onToggle={() => setProjectsOpen(!projectsOpen)}
            onTitleClick={() => selectProject(null)}
            onAdd={handleNewProject}
            isSelected={currentProjectId === null}
            borderedSelection
          />
          {projectsOpen && (
            <div className="py-1">
              {projects.map((project) => (
                <ContextMenu key={project.id}>
                  <ContextMenuTrigger asChild>
                    <div
                      className={cn(
                        'group flex items-center gap-1.5 pr-2 py-1 cursor-pointer transition-colors overflow-hidden text-sm',
                        currentProjectId === project.id
                          ? 'ring-1 ring-primary ring-inset text-primary'
                          : '',
                        dragOverProjectId === project.id && 'ring-2 ring-primary ring-inset bg-primary/10'
                      )}
                      style={{ paddingLeft: 12 }}
                      onClick={() => {
                        if (editingProjectId !== project.id) {
                          selectProject(project.id)
                        }
                      }}
                      onDragEnter={(e) => handleDragEnter(e, project.id)}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, project)}
                    >
                      <FolderKanban className="size-4 shrink-0 text-muted-foreground" />
                      {editingProjectId === project.id ? (
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onBlur={saveProjectName}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveProjectName()
                            if (e.key === 'Escape') cancelEditingProject()
                          }}
                          className="flex-1 min-w-0 bg-background border border-border rounded px-1 py-0.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className="flex-1 truncate">{project.name}</span>
                      )}
                      <button
                        className="opacity-0 group-hover:opacity-100 shrink-0 p-0.5 hover:bg-primary/10 rounded"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteProject(project.id)
                        }}
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onClick={() => startEditingProject(project.id, project.name)}>
                      <Pencil className="size-4 mr-2" />
                      Rename
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem variant="destructive" onClick={() => deleteProject(project.id)}>
                      <Trash2 className="size-4 mr-2" />
                      Delete
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              ))}

              {/* New project input */}
              {isCreatingProject && (
                <div className="flex items-center gap-2 px-3 py-1">
                  <FolderKanban className="size-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleSubmitProject()
                      }
                      if (e.key === 'Escape') handleCancelProject()
                    }}
                    onBlur={() => handleSubmitProject()}
                    className="flex-1 bg-background border border-border rounded px-1.5 py-0.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                    placeholder="Project name"
                    autoFocus
                  />
                </div>
              )}

              {projects.length === 0 && !isCreatingProject && (
                <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                  No projects yet
                </div>
              )}
            </div>
          )}

          {/* Smart Views - No header */}
          <div className="py-1">
            {SMART_VIEWS.map((view) => {
              const Icon = view.icon
              const isSelected = notesFilter.type === 'smart' && notesFilter.value === view.id
              return (
                <div
                  key={view.id}
                  className={cn(
                    'flex items-center gap-1.5 py-1 pr-2 cursor-pointer transition-colors text-sm',
                    isSelected
                      ? 'bg-primary/15 text-primary'
                      : ''
                  )}
                  style={{ paddingLeft: 12 }}
                  onClick={() => handleSmartViewClick(view.id)}
                >
                  <Icon className="size-4 text-muted-foreground" />
                  <span>{view.label}</span>
                </div>
              )
            })}
          </div>

          {/* Folders Section */}
          {(() => {
            const currentProject = currentProjectId ? projects.find((p) => p.id === currentProjectId) : null
            const projectFolder = currentProject?.notesFolder || ''
            return (
              <WideHeader
                title={currentProjectId ? 'Folders' : 'All Folders'}
                isOpen={foldersOpen}
                onToggle={() => setFoldersOpen(!foldersOpen)}
                onTitleClick={() => setNotesFilter({ type: 'folder', value: projectFolder })}
                onAdd={handleCreateFolder}
                isSelected={notesFilter.type === 'folder' && notesFilter.value === projectFolder}
              />
            )
          })()}
          {foldersOpen && (
            <>
              <FolderBrowser />
              {isCreatingFolder && (
                <div className="flex items-center gap-2 px-3 py-1">
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSubmitFolder()
                      if (e.key === 'Escape') handleCancelFolder()
                    }}
                    onBlur={handleSubmitFolder}
                    className="flex-1 bg-background border border-border rounded px-1.5 py-0.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                    placeholder="Folder name"
                    autoFocus
                  />
                </div>
              )}
            </>
          )}

          {/* Tags Section */}
          <WideHeader title="Tags" isOpen={tagsOpen} onToggle={() => setTagsOpen(!tagsOpen)} />
          {tagsOpen && <TagsTree />}

          {/* Chats Section */}
          <WideHeader
            title={currentProjectId ? 'Chats' : 'All Chats'}
            isOpen={chatsOpen}
            onToggle={() => setChatsOpen(!chatsOpen)}
            onAdd={() => startNewChat()}
          />
          {chatsOpen && (
            <div className="py-1">
              {threads.map((thread) => (
                <ContextMenu key={thread.thread_id}>
                  <ContextMenuTrigger asChild>
                    <div
                      className={cn(
                        'group flex items-center gap-1.5 pr-2 py-1 cursor-pointer transition-colors overflow-hidden text-sm',
                        currentThreadId === thread.thread_id
                          ? 'bg-primary/15 text-primary'
                          : ''
                      )}
                      style={{ paddingLeft: 12 }}
                      onClick={() => {
                        if (editingThreadId !== thread.thread_id) {
                          selectThread(thread.thread_id)
                        }
                      }}
                    >
                      <div className="flex-1 min-w-0 overflow-hidden">
                        {editingThreadId === thread.thread_id ? (
                          <input
                            type="text"
                            value={editingThreadTitle}
                            onChange={(e) => setEditingThreadTitle(e.target.value)}
                            onBlur={async () => {
                              if (editingThreadTitle.trim()) {
                                await updateThread(thread.thread_id, { title: editingThreadTitle.trim() })
                              }
                              setEditingThreadId(null)
                              setEditingThreadTitle('')
                            }}
                            onKeyDown={async (e) => {
                              if (e.key === 'Enter') {
                                if (editingThreadTitle.trim()) {
                                  await updateThread(thread.thread_id, { title: editingThreadTitle.trim() })
                                }
                                setEditingThreadId(null)
                                setEditingThreadTitle('')
                              }
                              if (e.key === 'Escape') {
                                setEditingThreadId(null)
                                setEditingThreadTitle('')
                              }
                            }}
                            className="w-full bg-background border border-border rounded px-1 py-0.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <div className="truncate block">
                            {thread.title || truncate(thread.thread_id, 20)}
                          </div>
                        )}
                      </div>
                      <button
                        className="opacity-0 group-hover:opacity-100 shrink-0 p-0.5 hover:bg-primary/10 rounded"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteThread(thread.thread_id)
                        }}
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onClick={() => {
                      setEditingThreadId(thread.thread_id)
                      setEditingThreadTitle(thread.title || '')
                    }}>
                      <Pencil className="size-4 mr-2" />
                      Rename
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem variant="destructive" onClick={() => deleteThread(thread.thread_id)}>
                      <Trash2 className="size-4 mr-2" />
                      Delete
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              ))}

              {threads.length === 0 && (
                <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                  No chats yet
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </aside>
  )
}

interface WideHeaderProps {
  title: string
  isOpen: boolean
  onToggle: () => void
  onTitleClick?: () => void
  onAdd?: () => void
  isSelected?: boolean
  borderedSelection?: boolean
}

function WideHeader({
  title,
  isOpen,
  onToggle,
  onTitleClick,
  onAdd,
  isSelected,
  borderedSelection = false
}: WideHeaderProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex items-center justify-between px-3 py-1 mt-1 border-t border-border/50 transition-colors cursor-pointer',
        isSelected
          ? borderedSelection
            ? 'ring-1 ring-primary ring-inset text-primary'
            : 'bg-primary/15 text-primary'
          : ''
      )}
      onClick={onTitleClick || onToggle}
    >
      <span className="text-sm font-medium text-foreground">
        {title}
      </span>
      <div className="flex items-center gap-1">
        {onAdd && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={(e) => {
              e.stopPropagation()
              onAdd()
            }}
            className="h-5 w-5 hover:bg-primary/10"
            title={`New ${title.replace('All ', '')}`}
          >
            <Plus className="size-3.5" />
          </Button>
        )}
        <button
          className="p-0.5 hover:bg-primary/10 rounded cursor-pointer"
          onClick={(e) => {
            e.stopPropagation()
            onToggle()
          }}
        >
          {isOpen ? (
            <ChevronDown className="size-4 text-muted-foreground" />
          ) : (
            <ChevronLeft className="size-4 text-muted-foreground" />
          )}
        </button>
      </div>
    </div>
  )
}
