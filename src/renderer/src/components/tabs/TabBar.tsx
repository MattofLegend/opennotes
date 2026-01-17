import { X, FileCode, FileText, FileJson, File, Bot } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore, type OpenFile } from '@/lib/store'

interface TabBarProps {
  className?: string
}

export function TabBar({ className }: TabBarProps) {
  const { openFiles, activeTab, setActiveTab, closeFile, chatExpanded, setChatExpanded } = useAppStore()

  const handleCloseAgentTab = (e: React.MouseEvent) => {
    e.stopPropagation()
    setChatExpanded(false)
  }

  return (
    <div className={cn(
      "flex items-center h-9 bg-sidebar overflow-x-auto scrollbar-hide app-drag-region",
      className
    )}>
      {/* Agent Tab - shown when chat is expanded */}
      {chatExpanded && (
        <div
          role="tab"
          tabIndex={0}
          onClick={() => setActiveTab('agent')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setActiveTab('agent')
            }
          }}
          className={cn(
            "group flex items-center gap-2 px-3 h-full text-sm transition-colors shrink-0 border-r border-border cursor-pointer app-no-drag",
            activeTab === 'agent'
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-background-interactive border-b border-border"
          )}
        >
          <Bot className="size-4" />
          <span>Agent</span>
          <button
            onClick={handleCloseAgentTab}
            className={cn(
              "size-4 flex items-center justify-center rounded-sm hover:bg-background-interactive transition-colors",
              activeTab === 'agent' ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}
          >
            <X className="size-3" />
          </button>
        </div>
      )}

      {/* File Tabs */}
      {openFiles.map((file) => (
        <FileTab
          key={file.path}
          file={file}
          isActive={activeTab === file.path}
          onSelect={() => setActiveTab(file.path)}
          onClose={() => closeFile(file.path)}
        />
      ))}

      {/* Spacer to fill remaining space */}
      <div className="flex-1 min-w-0 h-full border-b border-border" />
    </div>
  )
}

interface FileTabProps {
  file: OpenFile
  isActive: boolean
  onSelect: () => void
  onClose: () => void
}

function FileTab({ file, isActive, onSelect, onClose }: FileTabProps) {
  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation()
    onClose()
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    // Middle click to close
    if (e.button === 1) {
      e.preventDefault()
      onClose()
    }
  }

  return (
    <div
      role="tab"
      tabIndex={0}
      onClick={onSelect}
      onMouseDown={handleMouseDown}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      className={cn(
        "group flex items-center gap-2 px-3 h-full text-sm transition-colors shrink-0 border-r border-border max-w-[200px] cursor-pointer app-no-drag",
        isActive
          ? "bg-background text-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-background-interactive border-b border-border"
      )}
      title={file.path}
    >
      <FileIcon name={file.name} />
      <span className="truncate">{file.name}</span>
      <button
        onClick={handleClose}
        className={cn(
          "size-4 flex items-center justify-center rounded-sm hover:bg-background-interactive transition-colors",
          isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}
      >
        <X className="size-3" />
      </button>
    </div>
  )
}

function FileIcon({ name }: { name: string }) {
  const ext = name.includes('.') ? name.split('.').pop()?.toLowerCase() : ''

  switch (ext) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
    case 'py':
    case 'css':
    case 'scss':
    case 'html':
      return <FileCode className="size-3.5 text-primary shrink-0" />
    case 'json':
      return <FileJson className="size-3.5 text-primary shrink-0" />
    case 'md':
    case 'mdx':
    case 'txt':
      return <FileText className="size-3.5 text-muted-foreground shrink-0" />
    default:
      return <File className="size-3.5 text-muted-foreground shrink-0" />
  }
}
