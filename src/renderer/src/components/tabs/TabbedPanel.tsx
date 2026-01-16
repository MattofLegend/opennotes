import { FileCode } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { TabBar } from './TabBar'
import { FileViewer } from './FileViewer'
import { NoteViewer } from './NoteViewer'
import { ChatContainer } from '@/components/chat/ChatContainer'

interface TabbedPanelProps {
  threadId: string
  showTabBar?: boolean
}

export function TabbedPanel({ threadId, showTabBar = true }: TabbedPanelProps) {
  const { activeTab, openFiles, rightPanelMode, notesPath, isNewChat } = useAppStore()

  const isAgentTab = activeTab === 'agent'
  const activeFile = openFiles.find((f) => f.path === activeTab)
  const chatInRightPanel = rightPanelMode === 'chat'

  // Check if the active file is a note (path starts with notesPath)
  const isNote = activeFile && notesPath && activeFile.path.startsWith(notesPath)
  // Get relative path for notes (strip notesPath prefix)
  const noteRelativePath = isNote ? activeFile.path.slice(notesPath.length + 1) : null

  // Show chat if we have a thread OR we're in new chat mode (ready to create one)
  const hasThreadOrNewChat = (threadId && threadId.length > 0) || isNewChat
  const showChat = isAgentTab && !chatInRightPanel && hasThreadOrNewChat
  const showFile = activeFile !== undefined
  const showEmptyState = !showChat && !showFile

  return (
    <div className="flex flex-1 flex-col min-w-0 min-h-0 overflow-hidden">
      {/* Tab Bar (optional - can be rendered externally in titlebar) */}
      {showTabBar && <TabBar />}

      {/* Subtle gradient fade from titlebar */}
      <div className="h-1 shrink-0 bg-gradient-to-b from-sidebar/80 to-transparent" />

      {/* Content Area */}
      <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
        {showChat ? (
          <ChatContainer threadId={threadId} />
        ) : showFile && isNote && noteRelativePath ? (
          // Use NoteViewer for notes
          <NoteViewer key={activeFile.path} relativePath={noteRelativePath} />
        ) : showFile ? (
          // Use FileViewer for workspace files
          <FileViewer key={activeFile.path} filePath={activeFile.path} />
        ) : showEmptyState ? (
          <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground gap-3">
            <FileCode className="size-12 opacity-30" />
            <div className="text-center">
              <div className="text-sm font-medium">
                {isAgentTab && !hasThreadOrNewChat ? 'No Chat Selected' : 'No File Open'}
              </div>
              <div className="text-xs mt-1 opacity-75">
                {isAgentTab && !hasThreadOrNewChat
                  ? 'Create or select a chat to begin'
                  : 'Click a note in the list to view it here'}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
