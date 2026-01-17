import { useState, useCallback } from 'react'
import { Folder, FolderOpen, ChevronLeft, ChevronDown, Plus, Trash2, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import type { FolderNode } from '@/types'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@/components/ui/context-menu'

export function FolderBrowser(): React.JSX.Element {
  const { folders, notesFilter, setNotesFilter, createFolder, deleteFolder, currentProjectId, projects } =
    useAppStore()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [isCreating, setIsCreating] = useState<string | null>(null) // Parent folder path or '' for root
  const [newFolderName, setNewFolderName] = useState('')

  // Get the current project's folder if we're in a project
  const currentProject = currentProjectId ? projects.find((p) => p.id === currentProjectId) : null
  const projectFolder = currentProject?.notesFolder || null

  // Filter folders based on project scope
  const scopedFolders = projectFolder
    ? // In project: find the project folder and show its children
      folders.find((f) => f.path === projectFolder)?.children || []
    : // All projects: show all root folders
      folders

  const toggleExpand = useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }, [])

  const handleSelectFolder = (path: string): void => {
    setNotesFilter({ type: 'folder', value: path })
  }

  const handleCreateFolder = async (parentPath?: string): Promise<void> => {
    // If in a project and no parent specified, use the project folder as parent
    const effectiveParent = parentPath ?? (projectFolder || '')
    setIsCreating(effectiveParent)
    setNewFolderName('')
    // Expand the parent if creating in a subfolder
    if (effectiveParent) {
      setExpanded((prev) => new Set([...prev, effectiveParent]))
    }
  }

  const handleSubmitNewFolder = async (): Promise<void> => {
    if (!newFolderName.trim()) {
      setIsCreating(null)
      return
    }
    try {
      await createFolder(isCreating || undefined, newFolderName.trim())
    } catch (error) {
      console.error('Failed to create folder:', error)
    }
    setIsCreating(null)
    setNewFolderName('')
  }

  const handleCancelCreate = (): void => {
    setIsCreating(null)
    setNewFolderName('')
  }

  const handleDeleteFolder = async (path: string): Promise<void> => {
    try {
      await deleteFolder(path)
    } catch (error) {
      console.error('Failed to delete folder:', error)
    }
  }

  const handleDragStart = (e: React.DragEvent, folder: FolderNode): void => {
    console.log('[FolderBrowser] Drag start:', folder.path)
    // Set the data early in the event
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('application/x-folder-path', folder.path)
    e.dataTransfer.setData('text/plain', folder.name)
    
    // Create a custom drag image
    const dragEl = document.createElement('div')
    dragEl.textContent = `📁 ${folder.name}`
    dragEl.style.cssText = 'position: absolute; top: -1000px; padding: 8px 12px; background: var(--primary); color: var(--primary-foreground); border-radius: 4px; font-size: 12px; white-space: nowrap;'
    document.body.appendChild(dragEl)
    e.dataTransfer.setDragImage(dragEl, 0, 0)
    setTimeout(() => document.body.removeChild(dragEl), 0)
  }

  const isSelected = notesFilter.type === 'folder'

  return (
    <div className="py-1">
      {/* Folder tree */}
      {scopedFolders.map((folder) => (
        <FolderItem
          key={folder.path}
          folder={folder}
          depth={0}
          expanded={expanded}
          selectedPath={isSelected ? notesFilter.value : null}
          isCreating={isCreating}
          newFolderName={newFolderName}
          onToggle={toggleExpand}
          onSelect={handleSelectFolder}
          onCreate={handleCreateFolder}
          onDelete={handleDeleteFolder}
          onNewFolderNameChange={setNewFolderName}
          onSubmitNewFolder={handleSubmitNewFolder}
          onCancelCreate={handleCancelCreate}
          onDragStart={handleDragStart}
        />
      ))}

      {/* New folder input at root level */}
      {isCreating === '' && (
        <div className="flex items-center gap-2 px-3 py-1" style={{ paddingLeft: 12 }}>
          <Folder className="size-4 text-status-warning" />
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmitNewFolder()
              if (e.key === 'Escape') handleCancelCreate()
            }}
            onBlur={handleSubmitNewFolder}
            className="flex-1 bg-background border border-border rounded px-1.5 py-0.5 text-sm outline-none focus:ring-1 focus:ring-ring"
            placeholder="Folder name"
            autoFocus
          />
        </div>
      )}

      {/* Empty state */}
      {folders.length === 0 && isCreating === null && (
        <div className="px-3 py-4 text-center text-xs text-muted-foreground">
          No folders yet
        </div>
      )}
    </div>
  )
}

interface FolderItemProps {
  folder: FolderNode
  depth: number
  expanded: Set<string>
  selectedPath: string | null
  isCreating: string | null
  newFolderName: string
  onToggle: (path: string) => void
  onSelect: (path: string) => void
  onCreate: (parentPath?: string) => void
  onDelete: (path: string) => void
  onNewFolderNameChange: (name: string) => void
  onSubmitNewFolder: () => void
  onCancelCreate: () => void
  onDragStart: (e: React.DragEvent, folder: FolderNode) => void
}

function FolderItem({
  folder,
  depth,
  expanded,
  selectedPath,
  isCreating,
  newFolderName,
  onToggle,
  onSelect,
  onCreate,
  onDelete,
  onNewFolderNameChange,
  onSubmitNewFolder,
  onCancelCreate,
  onDragStart
}: FolderItemProps): React.JSX.Element {
  const isExpanded = expanded.has(folder.path)
  const hasChildren = folder.children.length > 0
  const isSelected = selectedPath === folder.path
  const paddingLeft = 12 + depth * 16

  return (
    <>
      <div
        draggable
        onDragStart={(e) => onDragStart(e, folder)}
      >
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div
              className={cn(
                'group flex items-center gap-1.5 py-1 pr-2 cursor-pointer cursor-grab active:cursor-grabbing transition-colors text-sm',
                isSelected
                  ? 'bg-primary/15 text-primary'
                  : ''
              )}
              style={{ paddingLeft }}
              onClick={() => onSelect(folder.path)}
            >
            {/* Folder icon */}
            {isExpanded ? (
              <FolderOpen className="size-4 text-status-warning shrink-0" />
            ) : (
              <Folder className="size-4 text-status-warning shrink-0" />
            )}

            {/* Folder name */}
            <span className="flex-1 truncate">{folder.name}</span>

            {/* Expand chevron - on the right */}
            {(hasChildren || isCreating === folder.path) && (
              <button
                className="w-4 h-4 flex items-center justify-center shrink-0"
                onClick={(e) => {
                  e.stopPropagation()
                  onToggle(folder.path)
                }}
              >
                {isExpanded ? (
                  <ChevronDown className="size-3 text-muted-foreground" />
                ) : (
                  <ChevronLeft className="size-3 text-muted-foreground" />
                )}
              </button>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={async () => {
            try {
              await window.api.notes.showInFinder(folder.path)
            } catch (e) {
              console.error('Failed to show in Finder:', e)
            }
          }}>
            <ExternalLink className="size-4 mr-2" />
            Show in Finder
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => onCreate(folder.path)}>
            <Plus className="size-4 mr-2" />
            New Subfolder
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive" onClick={() => onDelete(folder.path)}>
            <Trash2 className="size-4 mr-2" />
            Delete Folder
          </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </div>

      {/* Children and new folder input */}
      {isExpanded && (
        <>
          {folder.children.map((child) => (
            <FolderItem
              key={child.path}
              folder={child}
              depth={depth + 1}
              expanded={expanded}
              selectedPath={selectedPath}
              isCreating={isCreating}
              newFolderName={newFolderName}
              onToggle={onToggle}
              onSelect={onSelect}
              onCreate={onCreate}
              onDelete={onDelete}
              onNewFolderNameChange={onNewFolderNameChange}
              onSubmitNewFolder={onSubmitNewFolder}
              onCancelCreate={onCancelCreate}
              onDragStart={onDragStart}
            />
          ))}

          {/* New folder input as child */}
          {isCreating === folder.path && (
            <div
              className="flex items-center gap-2 py-1 pr-2"
              style={{ paddingLeft: paddingLeft + 20 }}
            >
              <Folder className="size-4 text-status-warning" />
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => onNewFolderNameChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSubmitNewFolder()
                  if (e.key === 'Escape') onCancelCreate()
                }}
                onBlur={onSubmitNewFolder}
                className="flex-1 bg-background border border-border rounded px-1.5 py-0.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                placeholder="Folder name"
                autoFocus
              />
            </div>
          )}
        </>
      )}
    </>
  )
}

interface FoldersSectionProps {
  onCreateFolder: () => void
}

export function FoldersSection({ onCreateFolder }: FoldersSectionProps): React.JSX.Element {
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-section-header">FOLDERS</span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onCreateFolder}
          className="h-5 w-5"
          title="New Folder"
        >
          <Plus className="size-3" />
        </Button>
      </div>
      <FolderBrowser />
    </div>
  )
}
