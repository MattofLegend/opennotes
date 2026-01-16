import { useState, useEffect } from 'react'
import {
  Plus,
  MessageSquare,
  Trash2,
  Pencil,
  Loader2,
  FileText,
  Clock,
  Star,
  Trash,
  ChevronRight,
  ChevronDown
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAppStore } from '@/lib/store'
import { cn, formatRelativeTime, truncate } from '@/lib/utils'
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
    threads,
    currentThreadId,
    loadingThreadId,
    createThread,
    selectThread,
    deleteThread,
    updateThread,
    notesFilter,
    setNotesFilter,
    loadNotes,
    loadFolders,
    loadTags,
    createFolder
  } = useAppStore()

  const [editingThreadId, setEditingThreadId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')

  // Section collapse states
  const [threadsOpen, setThreadsOpen] = useState(true)
  const [foldersOpen, setFoldersOpen] = useState(true)
  const [tagsOpen, setTagsOpen] = useState(true)

  // Creating new folder state
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  // Load notes data on mount
  useEffect(() => {
    loadNotes()
    loadFolders()
    loadTags()
  }, [loadNotes, loadFolders, loadTags])

  const startEditing = (threadId: string, currentTitle: string): void => {
    setEditingThreadId(threadId)
    setEditingTitle(currentTitle || '')
  }

  const saveTitle = async (): Promise<void> => {
    if (editingThreadId && editingTitle.trim()) {
      await updateThread(editingThreadId, { title: editingTitle.trim() })
    }
    setEditingThreadId(null)
    setEditingTitle('')
  }

  const cancelEditing = (): void => {
    setEditingThreadId(null)
    setEditingTitle('')
  }

  const handleNewThread = async (): Promise<void> => {
    await createThread({ title: `Thread ${new Date().toLocaleDateString()}` })
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
      await createFolder(undefined, newFolderName.trim())
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

          {/* Chats Section */}
          <WideHeader
            title="Chats"
            isOpen={threadsOpen}
            onToggle={() => setThreadsOpen(!threadsOpen)}
            onAdd={handleNewThread}
          />
          {threadsOpen && (
            <div className="py-1">
              {threads.map((thread) => (
                <ContextMenu key={thread.thread_id}>
                  <ContextMenuTrigger asChild>
                    <div
                      className={cn(
                        'group flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors overflow-hidden',
                        currentThreadId === thread.thread_id
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                          : 'hover:bg-sidebar-accent/50'
                      )}
                      onClick={() => {
                        if (editingThreadId !== thread.thread_id) {
                          selectThread(thread.thread_id)
                        }
                      }}
                    >
                      {loadingThreadId === thread.thread_id ? (
                        <Loader2 className="size-4 shrink-0 text-status-info animate-spin" />
                      ) : (
                        <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
                      )}
                      <div className="flex-1 min-w-0 overflow-hidden">
                        {editingThreadId === thread.thread_id ? (
                          <input
                            type="text"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onBlur={saveTitle}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveTitle()
                              if (e.key === 'Escape') cancelEditing()
                            }}
                            className="w-full bg-background border border-border rounded px-1 py-0.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <>
                            <div className="text-sm truncate block">
                              {thread.title || truncate(thread.thread_id, 20)}
                            </div>
                            <div className="text-[10px] text-muted-foreground truncate">
                              {formatRelativeTime(thread.updated_at)}
                            </div>
                          </>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="opacity-0 group-hover:opacity-100 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteThread(thread.thread_id)
                        }}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem
                      onClick={() => startEditing(thread.thread_id, thread.title || '')}
                    >
                      <Pencil className="size-4 mr-2" />
                      Rename
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      variant="destructive"
                      onClick={() => deleteThread(thread.thread_id)}
                    >
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

          {/* Folders Section */}
          <WideHeader
            title="All Folders"
            isOpen={foldersOpen}
            onToggle={() => setFoldersOpen(!foldersOpen)}
            onTitleClick={() => setNotesFilter({ type: 'folder', value: '' })}
            onAdd={handleCreateFolder}
            isSelected={notesFilter.type === 'folder' && notesFilter.value === ''}
          />
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
