import { useState, useCallback, useMemo } from 'react'
import { Hash, ChevronLeft, ChevronDown } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import type { TagNode, NoteInfo } from '@/types'

// Build tag tree from notes within a folder scope
function buildTagTreeFromNotes(notes: NoteInfo[], folderScope: string | null): TagNode[] {
  // Filter notes by folder scope if specified
  const scopedNotes = folderScope
    ? notes.filter((n) => !n.isDeleted && (n.folder === folderScope || n.folder.startsWith(folderScope + '/')))
    : notes.filter((n) => !n.isDeleted)

  // Collect all tags and their counts
  const tagCounts = new Map<string, number>()
  for (const note of scopedNotes) {
    for (const tag of note.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
    }
  }

  // Build tree structure
  const rootTags: TagNode[] = []
  const tagMap = new Map<string, TagNode>()

  // Sort tags for consistent ordering
  const sortedTags = Array.from(tagCounts.entries()).sort((a, b) => a[0].localeCompare(b[0]))

  for (const [fullPath, count] of sortedTags) {
    const parts = fullPath.split('/')
    let currentPath = ''

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const parentPath = currentPath
      currentPath = currentPath ? `${currentPath}/${part}` : part

      if (!tagMap.has(currentPath)) {
        const node: TagNode = {
          name: part,
          fullPath: currentPath,
          count: 0,
          children: []
        }
        tagMap.set(currentPath, node)

        if (parentPath) {
          const parent = tagMap.get(parentPath)
          if (parent) {
            parent.children.push(node)
          }
        } else {
          rootTags.push(node)
        }
      }

      // Add count to this tag if it's the full path
      if (currentPath === fullPath) {
        const node = tagMap.get(currentPath)
        if (node) {
          node.count = count
        }
      }
    }
  }

  return rootTags
}

export function TagsTree(): React.JSX.Element {
  const { notes, notesFilter, setNotesFilter, currentProjectId, projects } = useAppStore()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // Get the current project's folder for scoping
  const currentProject = currentProjectId ? projects.find((p) => p.id === currentProjectId) : null
  const projectFolder = currentProject?.notesFolder || null

  // Build scoped tags from notes within the project folder
  const scopedTags = useMemo(
    () => buildTagTreeFromNotes(notes, projectFolder),
    [notes, projectFolder]
  )

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

  if (scopedTags.length === 0) {
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
      {scopedTags.map((tag) => (
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
          'group flex items-center gap-1.5 py-1 pr-2 cursor-pointer transition-colors text-sm',
          isSelected
            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
            : 'hover:bg-sidebar-accent/50'
        )}
        style={{ paddingLeft }}
        onClick={() => onSelect(tag.fullPath)}
      >
        {/* Tag icon */}
        <Hash className="size-3.5 text-primary shrink-0" />

        {/* Tag name */}
        <span className="flex-1 truncate">{tag.name}</span>

        {/* Count */}
        <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
          {tag.count}
        </span>

        {/* Expand chevron - on the right */}
        {hasChildren && (
          <button
            className="w-4 h-4 flex items-center justify-center shrink-0"
            onClick={(e) => {
              e.stopPropagation()
              onToggle(tag.fullPath)
            }}
          >
            {isExpanded ? (
              <ChevronDown className="size-3 text-muted-foreground" />
            ) : (
              <ChevronLeft className="size-3 text-muted-foreground" />
            )}
          </button>
        )}
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
