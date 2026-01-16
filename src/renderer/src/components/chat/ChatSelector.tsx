import { useState, useRef, useEffect } from 'react'
import { Plus, MessageSquare, ChevronDown, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/store'
import { cn, formatRelativeTime, truncate } from '@/lib/utils'

export function ChatSelector(): React.JSX.Element {
  const {
    threads,
    currentThreadId,
    isNewChat,
    loadingThreadId,
    startNewChat,
    selectThread,
    loadThreads
  } = useAppStore()

  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Load threads on mount
  useEffect(() => {
    loadThreads()
  }, [loadThreads])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const currentThread = threads.find((t) => t.thread_id === currentThreadId)

  const handleNewChat = (): void => {
    startNewChat()
    setIsOpen(false)
  }

  const handleSelectThread = async (threadId: string): Promise<void> => {
    await selectThread(threadId)
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex items-center gap-2">
        {/* Chat selector button */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-3 gap-2"
          onClick={() => setIsOpen(!isOpen)}
        >
          <MessageSquare className="size-4" />
          <span className="text-sm truncate max-w-[200px]">
            {isNewChat ? 'New Chat' : currentThread?.title || 'Select chat'}
          </span>
          <ChevronDown className={cn('size-4 transition-transform', isOpen && 'rotate-180')} />
        </Button>

        {/* New chat button */}
        <Button
          variant="ghost"
          size="icon-sm"
          className="h-8 w-8"
          onClick={handleNewChat}
          title="New chat"
        >
          <Plus className="size-4" />
        </Button>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="p-2 border-b border-border">
            <div className="text-xs text-muted-foreground px-2">Recent Chats</div>
          </div>
          <div className="max-h-[300px] overflow-y-auto">
            {threads.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No chats yet
              </div>
            ) : (
              threads.slice(0, 20).map((thread) => (
                <div
                  key={thread.thread_id}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors',
                    currentThreadId === thread.thread_id
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-accent/50'
                  )}
                  onClick={() => handleSelectThread(thread.thread_id)}
                >
                  {loadingThreadId === thread.thread_id ? (
                    <Loader2 className="size-4 shrink-0 animate-spin" />
                  ) : (
                    <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">
                      {thread.title || truncate(thread.thread_id, 20)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {formatRelativeTime(thread.updated_at)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="p-2 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2"
              onClick={handleNewChat}
            >
              <Plus className="size-4" />
              New Chat
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
