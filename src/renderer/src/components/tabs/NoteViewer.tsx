import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { Loader2, AlertCircle, FileText, Save, Check, X, GitCompare } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { MilkdownEditor, DiffViewer, FullFileDiffViewer } from '@/components/editor'
import { Button } from '@/components/ui/button'

const DEBOUNCE_DELAY = 1000

interface NoteViewerProps {
  relativePath: string
}

export function NoteViewer({ relativePath }: NoteViewerProps) {
  const { updateNote, loadNotes, pendingApproval, respondToApproval, notesPath, openFile, notes } = useAppStore()
  const [content, setContent] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [savedContent, setSavedContent] = useState<string | null>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const contentRef = useRef<string | null>(null)

  // Check if there's a pending approval for this file
  const pendingEdit = useMemo(() => {
    if (!pendingApproval || !notesPath) return null

    const toolName = pendingApproval.tool_call.name
    const args = pendingApproval.tool_call.args as Record<string, string>

    if (toolName !== 'edit_file' && toolName !== 'write_file') return null

    // Get the file path from the tool args
    const filePath = args.path || args.file_path || ''
    
    // Build the full path for this note
    const fullNotePath = `${notesPath}/${relativePath}`

    // Check if this approval is for the current file
    if (filePath !== fullNotePath && !filePath.endsWith(relativePath)) return null

    if (toolName === 'edit_file') {
      return {
        type: 'edit' as const,
        oldString: args.old_string || '',
        newString: args.new_string || ''
      }
    } else {
      return {
        type: 'write' as const,
        newContent: args.content || ''
      }
    }
  }, [pendingApproval, notesPath, relativePath])

  const handleApprove = useCallback(async () => {
    // Optimistically update the content based on what we know will be written
    if (pendingEdit && content) {
      let newContent: string
      if (pendingEdit.type === 'edit') {
        // Apply the edit to current content
        newContent = content.replace(pendingEdit.oldString, pendingEdit.newString)
      } else {
        // Full file replacement
        newContent = pendingEdit.newContent
      }
      setContent(newContent)
      setSavedContent(newContent)
      contentRef.current = newContent
    }
    
    await respondToApproval('approve')
  }, [respondToApproval, pendingEdit, content])

  const handleReject = useCallback(async () => {
    await respondToApproval('reject')
  }, [respondToApproval])

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

  // Handle link clicks in the editor
  const handleLinkClick = useCallback((href: string) => {
    if (!notesPath) return

    // Check if it's an external URL
    if (href.startsWith('http://') || href.startsWith('https://')) {
      window.open(href, '_blank')
      return
    }

    // Decode URL-encoded characters
    let target = decodeURIComponent(href)
    
    // Handle wiki-style links [[Title]] - extract title
    const wikiMatch = target.match(/\[\[([^\]]+)\]\]/)
    if (wikiMatch) {
      target = wikiMatch[1] // Extract just the title part
    }
    
    // Remove .md extension for title matching
    const titleToMatch = target.replace(/\.md$/, '')
    
    // Get current folder for relative path resolution
    const currentDir = relativePath.includes('/') 
      ? relativePath.substring(0, relativePath.lastIndexOf('/'))
      : ''

    // Strategy 1: Match by title (most common for wiki-links)
    let targetNote = notes.find(n => 
      n.title.toLowerCase() === titleToMatch.toLowerCase()
    )
    
    // Strategy 2: Match by title within current project/folder first
    if (!targetNote && currentDir) {
      targetNote = notes.find(n => 
        n.folder.startsWith(currentDir.split('/')[0]) && 
        n.title.toLowerCase() === titleToMatch.toLowerCase()
      )
    }
    
    // Strategy 3: Exact path match
    if (!targetNote) {
      const pathWithExt = target.endsWith('.md') ? target : `${target}.md`
      targetNote = notes.find(n => n.path === pathWithExt)
    }
    
    // Strategy 4: Relative path from current note
    if (!targetNote && currentDir) {
      const relativePath = `${currentDir}/${target.endsWith('.md') ? target : `${target}.md`}`
      targetNote = notes.find(n => n.path === relativePath)
    }
    
    // Strategy 5: Path ends with target
    if (!targetNote) {
      const pathWithExt = target.endsWith('.md') ? target : `${target}.md`
      targetNote = notes.find(n => n.path.endsWith(pathWithExt))
    }

    if (targetNote) {
      openFile(`${notesPath}/${targetNote.path}`, targetNote.title)
    }
  }, [notesPath, relativePath, notes, openFile])

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

  // Show diff view if there's a pending edit for this file
  if (pendingEdit) {
    return (
      <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
        {/* Header with approval status - same height as normal header */}
        <div className="flex items-center gap-2 px-4 h-9 border-b border-status-warning/30 bg-status-warning/5 text-xs shrink-0">
          <GitCompare className="size-3.5 text-status-warning" />
          <span className="text-status-warning font-medium">Pending Changes</span>
          <span className="text-muted-foreground/50">•</span>
          <span className="text-muted-foreground truncate">{relativePath}</span>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={handleReject}
          >
            <X className="size-3 mr-1" />
            Reject
          </Button>
          <Button
            variant="nominal"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={handleApprove}
          >
            <Check className="size-3 mr-1" />
            Apply
          </Button>
        </div>

        {/* Diff view */}
        <div className="flex-1 min-h-0 overflow-auto">
          {pendingEdit.type === 'edit' ? (
            <DiffViewer
              originalContent={content}
              oldString={pendingEdit.oldString}
              newString={pendingEdit.newString}
            />
          ) : (
            <FullFileDiffViewer
              originalContent={content}
              newContent={pendingEdit.newContent}
            />
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      <div className="flex items-center gap-2 px-4 h-9 border-b border-border bg-background/50 text-xs text-muted-foreground shrink-0">
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
          onLinkClick={handleLinkClick}
        />
      </div>
    </div>
  )
}
