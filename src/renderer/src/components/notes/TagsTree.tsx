import { useState, useCallback } from 'react'
import { Hash, ChevronRight, ChevronDown } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import type { TagNode } from '@/types'

export function TagsTree(): React.JSX.Element {
  const { tags, notesFilter, setNotesFilter } = useAppStore()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggleExpand = useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }, [])

  const handleSelectTag = (fullPath: string): void => {
    setNotesFilter({ type: 'tag', value: fullPath })
  }

  const isSelected = notesFilter.type === 'tag'

  if (tags.length === 0) {
    return (
      <div className="px-3 py-4 text-center text-xs text-muted-foreground">
        No tags yet
        <div className="mt-1 opacity-75">
          Add #tags to your notes
        </div>
      </div>
    )
  }

  return (
    <div className="py-1">
      {tags.map((tag) => (
        <TagItem
          key={tag.fullPath}
          tag={tag}
          depth={0}
          expanded={expanded}
          selectedPath={isSelected ? notesFilter.value : null}
          onToggle={toggleExpand}
          onSelect={handleSelectTag}
        />
      ))}
    </div>
  )
}

interface TagItemProps {
  tag: TagNode
  depth: number
  expanded: Set<string>
  selectedPath: string | null
  onToggle: (path: string) => void
  onSelect: (fullPath: string) => void
}

function TagItem({
  tag,
  depth,
  expanded,
  selectedPath,
  onToggle,
  onSelect
}: TagItemProps): React.JSX.Element {
  const isExpanded = expanded.has(tag.fullPath)
  const hasChildren = tag.children.length > 0
  const isSelected = selectedPath === tag.fullPath
  const paddingLeft = 12 + depth * 16

  return (
    <>
      <div
        className={cn(
          'group flex items-center gap-1.5 py-1.5 pr-2 cursor-pointer transition-colors text-sm',
          isSelected
            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
            : 'hover:bg-sidebar-accent/50'
        )}
        style={{ paddingLeft }}
        onClick={() => onSelect(tag.fullPath)}
      >
        {/* Expand chevron */}
        <button
          className="w-4 h-4 flex items-center justify-center shrink-0"
          onClick={(e) => {
            e.stopPropagation()
            if (hasChildren) onToggle(tag.fullPath)
          }}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="size-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="size-3 text-muted-foreground" />
            )
          ) : (
            <span className="w-3" />
          )}
        </button>

        {/* Tag icon */}
        <Hash className="size-3.5 text-primary shrink-0" />

        {/* Tag name */}
        <span className="flex-1 truncate">{tag.name}</span>

        {/* Count */}
        <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
          {tag.count}
        </span>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <>
          {tag.children.map((child) => (
            <TagItem
              key={child.fullPath}
              tag={child}
              depth={depth + 1}
              expanded={expanded}
              selectedPath={selectedPath}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </>
      )}
    </>
  )
}

export function TagsSection(): React.JSX.Element {
  return (
    <div className="flex flex-col">
      <div className="flex items-center px-3 py-2">
        <span className="text-section-header">TAGS</span>
      </div>
      <TagsTree />
    </div>
  )
}
