import { useEffect, useState, useCallback, useRef, useLayoutEffect } from 'react'
import { NotesSidebar } from '@/components/sidebar/NotesSidebar'
import { NotesList } from '@/components/notes/NotesList'
import { TabbedPanel, TabBar } from '@/components/tabs'
import { RightPanel } from '@/components/panels/RightPanel'
import { ResizeHandle } from '@/components/ui/resizable'
import { useAppStore } from '@/lib/store'

// Badge requires ~235 screen pixels to display with comfortable margin
const BADGE_MIN_SCREEN_WIDTH = 235
const LEFT_MAX = 350
const LEFT_DEFAULT = 240

// Notes list panel dimensions
const NOTES_LIST_MIN = 200
const NOTES_LIST_MAX = 400
const NOTES_LIST_DEFAULT = 280

const RIGHT_MIN = 250
const RIGHT_MAX = 450
const RIGHT_DEFAULT = 320

function App(): React.JSX.Element {
  const { currentThreadId, loadThreads, createThread, loadProjects } = useAppStore()
  const [isLoading, setIsLoading] = useState(true)
  const [leftWidth, setLeftWidth] = useState(LEFT_DEFAULT)
  const [notesListWidth, setNotesListWidth] = useState(NOTES_LIST_DEFAULT)
  const [rightWidth, setRightWidth] = useState(RIGHT_DEFAULT)
  const [zoomLevel, setZoomLevel] = useState(1)

  // Track drag start widths
  const dragStartWidths = useRef<{ left: number; notesList: number; right: number } | null>(null)

  // Track zoom level changes and update CSS custom properties for safe areas
  useLayoutEffect(() => {
    const updateZoom = (): void => {
      // Detect zoom by comparing outer/inner window dimensions
      const detectedZoom = Math.round((window.outerWidth / window.innerWidth) * 100) / 100
      if (detectedZoom > 0.5 && detectedZoom < 3) {
        setZoomLevel(detectedZoom)

        // Traffic lights are at fixed screen position (y: ~28px bottom including padding)
        // Titlebar is 36px CSS, which becomes 36*zoom screen pixels
        // Extra padding needed when titlebar shrinks below traffic lights
        const TRAFFIC_LIGHT_BOTTOM_SCREEN = 40 // screen pixels to clear traffic lights
        const TITLEBAR_HEIGHT_CSS = 36
        const titlebarScreenHeight = TITLEBAR_HEIGHT_CSS * detectedZoom
        const extraPaddingScreen = Math.max(0, TRAFFIC_LIGHT_BOTTOM_SCREEN - titlebarScreenHeight)
        const extraPaddingCss = Math.round(extraPaddingScreen / detectedZoom)

        document.documentElement.style.setProperty('--sidebar-safe-padding', `${extraPaddingCss}px`)
      }
    }

    updateZoom()
    window.addEventListener('resize', updateZoom)
    return () => window.removeEventListener('resize', updateZoom)
  }, [])

  // Calculate zoom-compensated minimum width to always contain the badge
  const leftMinWidth = Math.ceil(BADGE_MIN_SCREEN_WIDTH / zoomLevel)

  // Enforce minimum width when zoom changes
  useEffect(() => {
    if (leftWidth < leftMinWidth) {
      setLeftWidth(leftMinWidth)
    }
  }, [leftMinWidth, leftWidth])

  const handleLeftResize = useCallback(
    (totalDelta: number) => {
      if (!dragStartWidths.current) {
        dragStartWidths.current = { left: leftWidth, notesList: notesListWidth, right: rightWidth }
      }
      const newWidth = dragStartWidths.current.left + totalDelta
      setLeftWidth(Math.min(LEFT_MAX, Math.max(leftMinWidth, newWidth)))
    },
    [leftWidth, notesListWidth, rightWidth, leftMinWidth]
  )

  const handleNotesListResize = useCallback(
    (totalDelta: number) => {
      if (!dragStartWidths.current) {
        dragStartWidths.current = { left: leftWidth, notesList: notesListWidth, right: rightWidth }
      }
      const newWidth = dragStartWidths.current.notesList + totalDelta
      setNotesListWidth(Math.min(NOTES_LIST_MAX, Math.max(NOTES_LIST_MIN, newWidth)))
    },
    [leftWidth, notesListWidth, rightWidth]
  )

  const handleRightResize = useCallback(
    (totalDelta: number) => {
      if (!dragStartWidths.current) {
        dragStartWidths.current = { left: leftWidth, notesList: notesListWidth, right: rightWidth }
      }
      const newWidth = dragStartWidths.current.right - totalDelta
      setRightWidth(Math.min(RIGHT_MAX, Math.max(RIGHT_MIN, newWidth)))
    },
    [leftWidth, notesListWidth, rightWidth]
  )

  // Reset drag start on mouse up
  useEffect(() => {
    const handleMouseUp = (): void => {
      dragStartWidths.current = null
    }
    document.addEventListener('mouseup', handleMouseUp)
    return () => document.removeEventListener('mouseup', handleMouseUp)
  }, [])

  useEffect(() => {
    async function init(): Promise<void> {
      try {
        // Load projects first
        await loadProjects()
        // Load threads (scoped to current project, which is null = all)
        await loadThreads()
        // Create a default thread if none exist
        const threads = useAppStore.getState().threads
        if (threads.length === 0) {
          await createThread()
        }
      } catch (error) {
        console.error('Failed to initialize:', error)
      } finally {
        setIsLoading(false)
      }
    }
    init()
  }, [loadProjects, loadThreads, createThread])

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground">Initializing...</div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Fixed app badge - zoom independent position and size */}
      <div
        className="app-badge"
        style={{
          // Compensate both position and scale for zoom
          // Target screen position: top 14px, left 82px (just past traffic lights)
          top: `${14 / zoomLevel}px`,
          left: `${82 / zoomLevel}px`,
          transform: `scale(${1 / zoomLevel})`,
          transformOrigin: 'top left'
        }}
      >
        <span className="app-badge-name">OPENNOTES</span>
        <span className="app-badge-version">{__APP_VERSION__}</span>
      </div>

      {/* Left Sidebar - Full height */}
      <div style={{ width: leftWidth }} className="shrink-0 flex flex-col h-full">
        {/* Titlebar spacer for traffic lights + badge */}
        <div className="h-9 shrink-0 app-drag-region bg-sidebar" />
        <NotesSidebar />
      </div>

      <ResizeHandle onDrag={handleLeftResize} />

      {/* Notes List Panel - Full height (NotesList has its own header with safe padding) */}
      <div style={{ width: notesListWidth }} className="shrink-0 h-full">
        <NotesList />
      </div>

      <ResizeHandle onDrag={handleNotesListResize} />

      {/* Center column - with titlebar tabs */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Titlebar row with tabs */}
        <div className="h-9 shrink-0 app-drag-region bg-sidebar">
          <TabBar className="h-full border-b-0" />
        </div>

        {/* Center - Content Panel (Agent Chat + File Viewer) */}
        <main className="flex flex-1 flex-col min-w-0 overflow-hidden">
          <TabbedPanel threadId={currentThreadId || ''} showTabBar={false} />
        </main>
      </div>

      <ResizeHandle onDrag={handleRightResize} />

      {/* Right Panel - Full height */}
      <div style={{ width: rightWidth }} className="shrink-0">
        <RightPanel />
      </div>
    </div>
  )
}

export default App
