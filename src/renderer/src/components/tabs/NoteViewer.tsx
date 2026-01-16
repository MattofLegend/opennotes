import { useEffect, useState, useCallback, useRef } from 'react'
import { Loader2, AlertCircle, FileText, Save } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { ScrollArea } from '@/components/ui/scroll-area'

interface NoteViewerProps {
  /** Relative path from notes directory */
  relativePath: string
}

export function NoteViewer({ relativePath }: NoteViewerProps) {
  const { updateNote, loadNotes } = useAppStore()
  const [content, setContent] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load note content
  useEffect(() => {
    async function loadNote() {
      setIsLoading(true)
      setError(null)
      try {
        const noteContent = await window.api.notes.read(relativePath)
        setContent(noteContent)
        setIsDirty(false)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to read note')
      } finally {
        setIsLoading(false)
      }
    }
    loadNote()
  }, [relativePath])

  // Save note
  const handleSave = useCallback(async () => {
    if (!isDirty || content === null) return

    setIsSaving(true)
    try {
      await updateNote(relativePath, content)
      setIsDirty(false)
      // Refresh notes list to update title/preview
      loadNotes()
    } catch (e) {
      console.error('Failed to save note:', e)
    } finally {
      setIsSaving(false)
    }
  }, [relativePath, content, isDirty, updateNote, loadNotes])

  // Handle keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSave])

  // Auto-save on blur
  const handleBlur = () => {
    if (isDirty) {
      handleSave()
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value)
    setIsDirty(true)
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <Loader2 className="size-6 animate-spin mr-2" />
        <span>Loading note...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground gap-3 p-8">
        <AlertCircle className="size-10 text-status-critical" />
        <div className="text-center">
          <div className="font-medium text-foreground mb-1">Failed to load note</div>
          <div className="text-sm">{error}</div>
        </div>
      </div>
    )
  }

  if (content === null) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <FileText className="size-6 mr-2" />
        <span>No content</span>
      </div>
    )
  }

  const fileName = relativePath.split('/').pop() || relativePath
  const lineCount = content.split('\n').length

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-background/50 text-xs text-muted-foreground shrink-0">
        <FileText className="size-3.5" />
        <span className="truncate">{relativePath}</span>
        <span className="text-muted-foreground/50">•</span>
        <span>{lineCount} lines</span>
        {isDirty && (
          <>
            <span className="text-muted-foreground/50">•</span>
            <span className="text-accent-gold">Unsaved</span>
          </>
        )}
        {isSaving && (
          <>
            <span className="text-muted-foreground/50">•</span>
            <Save className="size-3 animate-pulse" />
            <span>Saving...</span>
          </>
        )}
      </div>

      {/* Editor */}
      <ScrollArea className="flex-1 min-h-0">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onBlur={handleBlur}
          className="w-full h-full min-h-[calc(100vh-200px)] p-4 bg-transparent text-foreground text-sm font-mono leading-relaxed resize-none focus:outline-none"
          placeholder="Start writing..."
          spellCheck={false}
        />
      </ScrollArea>
    </div>
  )
}
