import { useMemo } from 'react'
import { FileText, Star, Plus, Trash2, RotateCcw, X, FolderOpen } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/store'
import { cn, formatRelativeTime } from '@/lib/utils'
import type { NoteInfo } from '@/types'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@/components/ui/context-menu'

// Filter notes based on current filter
function filterNotes(notes: NoteInfo[], filter: { type: string; value: string }): NoteInfo[] {
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  switch (filter.type) {
    case 'smart':
      switch (filter.value) {
        case 'all':
          return notes.filter((n) => !n.isDeleted)
        case 'recent':
          return notes
            .filter((n) => !n.isDeleted && new Date(n.modifiedAt) >= sevenDaysAgo)
            .sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime())
        case 'favorites':
          return notes.filter((n) => !n.isDeleted && n.isFavorite)
        case 'trash':
          return notes.filter((n) => n.isDeleted)
        default:
          return notes.filter((n) => !n.isDeleted)
      }
    case 'folder':
      return notes.filter((n) => !n.isDeleted && n.folder === filter.value)
    case 'tag':
      // Filter notes that have this tag or a child tag
      // e.g., filter "work" matches notes with #work, #work/meeting, etc.
      return notes.filter((n) => {
        if (n.isDeleted) return false
        return n.tags.some((tag) => tag === filter.value || tag.startsWith(filter.value + '/'))
      })
    default:
      return notes.filter((n) => !n.isDeleted)
  }
}

// Get filter display name
function getFilterDisplayName(filter: { type: string; value: string }): string {
  switch (filter.type) {
    case 'smart':
      switch (filter.value) {
        case 'all':
          return 'All Notes'
        case 'recent':
          return 'Recent'
        case 'favorites':
          return 'Favorites'
        case 'trash':
          return 'Trash'
        default:
          return 'Notes'
      }
    case 'folder':
      return filter.value || 'Root'
    case 'tag':
      return `#${filter.value}`
    default:
      return 'Notes'
  }
}

export function NotesList(): React.JSX.Element {
  const {
    notes,
    notesFilter,
    notesPath,
    openFile,
    createNote,
    deleteNote,
    restoreNote,
    permanentDeleteNote,
    toggleNoteFavorite
  } = useAppStore()

  const filteredNotes = useMemo(() => filterNotes(notes, notesFilter), [notes, notesFilter])
  const isTrash = notesFilter.type === 'smart' && notesFilter.value === 'trash'
  const filterName = getFilterDisplayName(notesFilter)

  // Build full path for notes using the notes directory
  const getFullNotePath = (relativePath: string): string => {
    if (!notesPath) return relativePath
    return `${notesPath}/${relativePath}`
  }

  const handleCreateNote = async (): Promise<void> => {
    const folder = notesFilter.type === 'folder' ? notesFilter.value : undefined
    const note = await createNote(folder)
    // Open the new note with full path
    openFile(getFullNotePath(note.path), note.title)
  }

  const handleOpenNote = (note: NoteInfo): void => {
    openFile(getFullNotePath(note.path), note.title)
  }

  return (
    <div className="flex flex-col h-full bg-background border-r border-border">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0"
        style={{ paddingTop: 'calc(12px + var(--sidebar-safe-padding, 0px))' }}
      >
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium truncate">{filterName}</span>
          <span className="text-[10px] text-muted-foreground">
            {filteredNotes.length} {filteredNotes.length === 1 ? 'note' : 'notes'}
          </span>
        </div>
        {!isTrash && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleCreateNote}
            title="New Note"
          >
            <Plus className="size-4" />
          </Button>
        )}
      </div>

      {/* Notes List */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="py-1">
          {filteredNotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center text-sm text-muted-foreground py-12 px-4">
              {isTrash ? (
                <>
                  <Trash2 className="size-8 mb-2 opacity-50" />
                  <span>Trash is empty</span>
                </>
              ) : (
                <>
                  <FileText className="size-8 mb-2 opacity-50" />
                  <span>No notes yet</span>
                  <span className="text-xs mt-1">
                    Click + to create your first note
                  </span>
                </>
              )}
            </div>
          ) : (
            filteredNotes.map((note) => (
              <NoteItem
                key={note.path}
                note={note}
                isTrash={isTrash}
                onOpen={handleOpenNote}
                onDelete={deleteNote}
                onRestore={restoreNote}
                onPermanentDelete={permanentDeleteNote}
                onToggleFavorite={toggleNoteFavorite}
                onShowInFinder={async (path) => {
                  try {
                    await window.api.notes.showInFinder(path)
                  } catch (e) {
                    console.error('Failed to show in Finder:', e)
                  }
                }}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

interface NoteItemProps {
  note: NoteInfo
  isTrash: boolean
  onOpen: (note: NoteInfo) => void
  onDelete: (path: string) => Promise<void>
  onRestore: (trashPath: string, targetFolder?: string) => Promise<void>
  onPermanentDelete: (trashPath: string) => Promise<void>
  onToggleFavorite: (path: string) => Promise<void>
  onShowInFinder: (path: string) => Promise<void>
}

function NoteItem({
  note,
  isTrash,
  onOpen,
  onDelete,
  onRestore,
  onPermanentDelete,
  onToggleFavorite,
  onShowInFinder
}: NoteItemProps): React.JSX.Element {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={cn(
            'group px-4 py-3 cursor-pointer transition-colors hover:bg-background-interactive border-b border-border/50'
          )}
          onClick={() => onOpen(note)}
        >
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium truncate">{note.title}</span>
                {note.isFavorite && !isTrash && (
                  <Star className="size-3 text-status-warning fill-status-warning shrink-0" />
                )}
              </div>
              {note.preview && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {note.preview}
                </p>
              )}
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-muted-foreground">
                  {formatRelativeTime(note.modifiedAt)}
                </span>
                {note.folder && !isTrash && (
                  <span className="text-[10px] text-muted-foreground truncate">
                    • {note.folder}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {isTrash ? (
          <>
            <ContextMenuItem onClick={() => onRestore(note.path)}>
              <RotateCcw className="size-4 mr-2" />
              Restore
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              variant="destructive"
              onClick={() => onPermanentDelete(note.path)}
            >
              <X className="size-4 mr-2" />
              Delete Permanently
            </ContextMenuItem>
          </>
        ) : (
          <>
            <ContextMenuItem onClick={() => onShowInFinder(note.path)}>
              <FolderOpen className="size-4 mr-2" />
              Show in Finder
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => onToggleFavorite(note.path)}>
              <Star className={cn('size-4 mr-2', note.isFavorite && 'fill-current')} />
              {note.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              variant="destructive"
              onClick={() => onDelete(note.path)}
            >
              <Trash2 className="size-4 mr-2" />
              Move to Trash
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}
