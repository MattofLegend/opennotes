import { FileCode } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { TabBar } from './TabBar'
import { FileViewer } from './FileViewer'
import { ChatContainer } from '@/components/chat/ChatContainer'

interface TabbedPanelProps {
  threadId: string
  showTabBar?: boolean
}

export function TabbedPanel({ threadId, showTabBar = true }: TabbedPanelProps) {
  const { activeTab, openFiles, rightPanelMode } = useAppStore()

  const isAgentTab = activeTab === 'agent'
  const activeFile = openFiles.find((f) => f.path === activeTab)
  const chatInRightPanel = rightPanelMode === 'chat'

  const showChat = isAgentTab && !chatInRightPanel
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
        ) : showFile ? (
          // Use key to force remount when file changes, ensuring fresh state
          <FileViewer key={activeFile.path} filePath={activeFile.path} />
        ) : showEmptyState ? (
          <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground gap-3">
            <FileCode className="size-12 opacity-30" />
            <div className="text-center">
              <div className="text-sm font-medium">File Viewer</div>
              <div className="text-xs mt-1 opacity-75">
                Click a file in the sidebar to view it here
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
