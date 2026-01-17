import { FileCode } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { TabBar } from './TabBar'
import { FileViewer } from './FileViewer'
import { NoteViewer } from './NoteViewer'
import { ChatContainer } from '@/components/chat/ChatContainer'

interface TabbedPanelProps {
  showTabBar?: boolean
}

export function TabbedPanel({ showTabBar = true }: TabbedPanelProps) {
  const { activeTab, openFiles, notesPath, chatExpanded, currentThreadId, isNewChat } = useAppStore()

  const activeFile = openFiles.find((f) => f.path === activeTab)

  // Check if the active file is a note (path starts with notesPath)
  const isNote = activeFile && notesPath && activeFile.path.startsWith(notesPath)
  // Get relative path for notes (strip notesPath prefix)
  const noteRelativePath = isNote ? activeFile.path.slice(notesPath.length + 1) : null

  // Show chat when expanded and agent tab is active
  const isAgentTab = activeTab === 'agent'
  const hasThreadOrNewChat = (currentThreadId && currentThreadId.length > 0) || isNewChat
  const showChat = chatExpanded && isAgentTab && hasThreadOrNewChat
  const showFile = activeFile !== undefined
  const showEmptyState = !showChat && !showFile

  return (
    <div className="flex flex-1 flex-col min-w-0 min-h-0 overflow-hidden">
      {/* Tab Bar (optional - can be rendered externally in titlebar) */}
      {showTabBar && <TabBar />}

      {/* Content Area */}
      <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
        {showChat ? (
          <ChatContainer threadId={currentThreadId || ''} />
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
                {chatExpanded && isAgentTab && !hasThreadOrNewChat ? 'No Chat Selected' : 'No File Open'}
              </div>
              <div className="text-xs mt-1 opacity-75">
                {chatExpanded && isAgentTab && !hasThreadOrNewChat
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
