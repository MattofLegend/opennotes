import { useState, useEffect } from 'react'
import {
  Plus,
  FolderKanban,
  Trash2,
  Pencil,
  FileText,
  Clock,
  Star,
  Trash,
  ChevronRight,
  ChevronDown,
  Layers
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'
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
    createFolder
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

  // Creating new folder state
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

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

  return (
    <aside className="flex h-full w-full flex-col border-r border-border bg-sidebar overflow-hidden">
      <ScrollArea className="flex-1 min-h-0">
        <div
          className="flex flex-col"
          style={{ paddingTop: 'calc(8px + var(--sidebar-safe-padding, 0px))' }}
        >
          {/* Smart Views - No header */}
          <div className="py-1">
            {SMART_VIEWS.map((view) => {
              const Icon = view.icon
              const isSelected = notesFilter.type === 'smart' && notesFilter.value === view.id
              return (
                <div
                  key={view.id}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors text-sm',
                    isSelected
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'hover:bg-sidebar-accent/50'
                  )}
                  onClick={() => handleSmartViewClick(view.id)}
                >
                  <Icon className="size-4 text-muted-foreground" />
                  <span>{view.label}</span>
                </div>
              )
            })}
          </div>

          {/* Projects Section */}
          <WideHeader
            title="All Projects"
            isOpen={projectsOpen}
            onToggle={() => setProjectsOpen(!projectsOpen)}
            onTitleClick={() => selectProject(null)}
            onAdd={handleNewProject}
            isSelected={currentProjectId === null}
          />
          {projectsOpen && (
            <div className="py-1">
              {projects.map((project) => (
                <ContextMenu key={project.id}>
                  <ContextMenuTrigger asChild>
                    <div
                      className={cn(
                        'group flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors overflow-hidden',
                        currentProjectId === project.id
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                          : 'hover:bg-sidebar-accent/50'
                      )}
                      onClick={() => {
                        if (editingProjectId !== project.id) {
                          selectProject(project.id)
                        }
                      }}
                    >
                      <FolderKanban className="size-4 shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0 overflow-hidden">
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
                            className="w-full bg-background border border-border rounded px-1 py-0.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <div className="text-sm truncate block">{project.name}</div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="opacity-0 group-hover:opacity-100 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteProject(project.id)
                        }}
                      >
                        <Trash2 className="size-3" />
                      </Button>
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
}

function WideHeader({
  title,
  isOpen,
  onToggle,
  onTitleClick,
  onAdd,
  isSelected
}: WideHeaderProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex items-center justify-between px-3 py-2.5 mt-2 border-t border-border/50 transition-colors',
        isSelected ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'hover:bg-sidebar-accent/30'
      )}
    >
      <div className="flex items-center gap-2">
        <button
          className="p-0.5 hover:bg-sidebar-accent/50 rounded cursor-pointer"
          onClick={onToggle}
        >
          {isOpen ? (
            <ChevronDown className="size-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 text-muted-foreground" />
          )}
        </button>
        <span
          className="text-sm font-medium text-foreground cursor-pointer"
          onClick={onTitleClick || onToggle}
        >
          {title}
        </span>
      </div>
      {onAdd && (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onAdd}
          className="h-6 w-6 hover:bg-sidebar-accent"
          title={`New ${title.replace('All ', '')}`}
        >
          <Plus className="size-4" />
        </Button>
      )}
    </div>
  )
}
