import { useEffect, useState, useCallback, useRef } from 'react'
import { Loader2, AlertCircle, FileText, Save } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { MilkdownEditor } from '@/components/editor'

const DEBOUNCE_DELAY = 1000

interface NoteViewerProps {
  relativePath: string
}

export function NoteViewer({ relativePath }: NoteViewerProps) {
  const { updateNote, loadNotes } = useAppStore()
  const [content, setContent] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [savedContent, setSavedContent] = useState<string | null>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const contentRef = useRef<string | null>(null)

  useEffect(() => {
    contentRef.current = content
  }, [content])

  useEffect(() => {
    async function loadNote() {
      setIsLoading(true)
      setError(null)
      try {
        const noteContent = await window.api.notes.read(relativePath)
        setContent(noteContent)
        setSavedContent(noteContent)
        contentRef.current = noteContent
        setIsDirty(false)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to read note')
      } finally {
        setIsLoading(false)
      }
    }
    loadNote()
  }, [relativePath])

  const saveNote = useCallback(async () => {
    const currentContent = contentRef.current
    if (currentContent === null) return

    setIsSaving(true)
    try {
      await updateNote(relativePath, currentContent)
      setSavedContent(currentContent)
      setIsDirty(false)
      loadNotes()
    } catch (e) {
      console.error('Failed to save note:', e)
    } finally {
      setIsSaving(false)
    }
  }, [relativePath, updateNote, loadNotes])

  const debouncedSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveNote()
    }, DEBOUNCE_DELAY)
  }, [saveNote])

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
        if (contentRef.current !== null) {
          updateNote(relativePath, contentRef.current).catch(console.error)
        }
      }
    }
  }, [relativePath, updateNote])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current)
        }
        saveNote()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [saveNote])

  const handleBlur = useCallback(() => {
    if (isDirty) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      saveNote()
    }
  }, [isDirty, saveNote])

  const handleChange = useCallback((newContent: string) => {
    setContent(newContent)
    const isChanged = newContent !== savedContent
    setIsDirty(isChanged)
    if (isChanged) {
      debouncedSave()
    }
  }, [savedContent, debouncedSave])

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

  const lineCount = content.split('\n').length

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-background/50 text-xs text-muted-foreground shrink-0">
        <FileText className="size-3.5" />
        <span className="truncate">{relativePath}</span>
        <span className="text-muted-foreground/50">•</span>
        <span>{lineCount} lines</span>
        {isDirty && (
          <>
            <span className="text-muted-foreground/50">•</span>
            <span className="text-accent">Unsaved</span>
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

      <div className="flex-1 min-h-0 overflow-auto">
        <MilkdownEditor
          content={content}
          onChange={handleChange}
          onBlur={handleBlur}
        />
      </div>
    </div>
  )
}
