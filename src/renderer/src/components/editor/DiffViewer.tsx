import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { MilkdownReadOnly } from './MilkdownEditor'

interface DiffViewerProps {
  originalContent: string
  oldString: string
  newString: string
  className?: string
}

interface DiffBlock {
  type: 'context' | 'removed' | 'added'
  lines: string[]
}

/**
 * Computes a unified diff view showing the original content with
 * the old_string replaced by new_string, highlighting changes.
 * Context looks identical to normal editor, only changes are highlighted.
 */
export function DiffViewer({ originalContent, oldString, newString, className }: DiffViewerProps) {
  const diffBlocks = useMemo(() => {
    const blocks: DiffBlock[] = []
    
    // Find where the old_string appears in the original content
    const matchIndex = originalContent.indexOf(oldString)
    
    if (matchIndex === -1) {
      // old_string not found - show entire content as context and new as added
      if (originalContent.trim()) {
        blocks.push({ type: 'context', lines: originalContent.split('\n') })
      }
      blocks.push({ type: 'added', lines: ['[Could not locate edit position]', ...newString.split('\n')] })
      return blocks
    }

    // Split content into before, match, and after
    const before = originalContent.substring(0, matchIndex)
    const after = originalContent.substring(matchIndex + oldString.length)

    // Add content before the change as context
    if (before.trim()) {
      blocks.push({ type: 'context', lines: before.split('\n') })
    }

    // Add removed content (old_string)
    if (oldString.trim()) {
      blocks.push({ type: 'removed', lines: oldString.split('\n') })
    }

    // Add added content (new_string)
    if (newString.trim()) {
      blocks.push({ type: 'added', lines: newString.split('\n') })
    }

    // Add content after the change as context
    if (after.trim()) {
      blocks.push({ type: 'context', lines: after.split('\n') })
    }

    return blocks
  }, [originalContent, oldString, newString])

  return (
    <div className={cn('overflow-auto', className)}>
      {diffBlocks.map((block, index) => (
        <div
          key={index}
          className={cn(
            block.type === 'removed' && 'bg-status-critical/10 border-l-4 border-l-status-critical pl-4',
            block.type === 'added' && 'bg-status-nominal/10 border-l-4 border-l-status-nominal pl-4'
          )}
        >
          {/* Only show label for changes, not context */}
          {block.type !== 'context' && (
            <div className={cn(
              'text-[10px] font-medium pt-1 uppercase tracking-wide',
              block.type === 'removed' && 'text-status-critical',
              block.type === 'added' && 'text-status-nominal'
            )}>
              {block.type === 'removed' && '− Removed'}
              {block.type === 'added' && '+ Added'}
            </div>
          )}
          
          {/* Context uses normal styling, changes use compact diff styling */}
          <MilkdownReadOnly 
            content={block.lines.join('\n')} 
            className={block.type !== 'context' ? 'diff-milkdown' : undefined} 
          />
        </div>
      ))}
    </div>
  )
}

interface FullFileDiffViewerProps {
  originalContent: string
  newContent: string
  className?: string
}

/**
 * Shows a diff for write_file where we're replacing the entire file content.
 * Context looks identical to normal editor, only changes are highlighted.
 */
export function FullFileDiffViewer({ originalContent, newContent, className }: FullFileDiffViewerProps) {
  const diffBlocks = useMemo(() => {
    const blocks: DiffBlock[] = []
    
    const oldLines = originalContent.split('\n')
    const newLines = newContent.split('\n')

    // Find common prefix
    let commonPrefix = 0
    while (
      commonPrefix < oldLines.length &&
      commonPrefix < newLines.length &&
      oldLines[commonPrefix] === newLines[commonPrefix]
    ) {
      commonPrefix++
    }

    // Find common suffix
    let commonSuffix = 0
    while (
      commonSuffix < oldLines.length - commonPrefix &&
      commonSuffix < newLines.length - commonPrefix &&
      oldLines[oldLines.length - 1 - commonSuffix] === newLines[newLines.length - 1 - commonSuffix]
    ) {
      commonSuffix++
    }

    // Add common prefix as context
    const prefixLines = oldLines.slice(0, commonPrefix)
    if (prefixLines.length > 0 && prefixLines.some(l => l.trim())) {
      blocks.push({ type: 'context', lines: prefixLines })
    }

    // Add removed lines
    const removedLines = oldLines.slice(commonPrefix, oldLines.length - commonSuffix)
    if (removedLines.length > 0 && removedLines.some(l => l.trim())) {
      blocks.push({ type: 'removed', lines: removedLines })
    }

    // Add added lines
    const addedLines = newLines.slice(commonPrefix, newLines.length - commonSuffix)
    if (addedLines.length > 0 && addedLines.some(l => l.trim())) {
      blocks.push({ type: 'added', lines: addedLines })
    }

    // Add common suffix as context
    const suffixLines = oldLines.slice(oldLines.length - commonSuffix)
    if (suffixLines.length > 0 && suffixLines.some(l => l.trim())) {
      blocks.push({ type: 'context', lines: suffixLines })
    }

    return blocks
  }, [originalContent, newContent])

  return (
    <div className={cn('overflow-auto', className)}>
      {diffBlocks.map((block, index) => (
        <div
          key={index}
          className={cn(
            block.type === 'removed' && 'bg-status-critical/10 border-l-4 border-l-status-critical pl-4',
            block.type === 'added' && 'bg-status-nominal/10 border-l-4 border-l-status-nominal pl-4'
          )}
        >
          {/* Only show label for changes, not context */}
          {block.type !== 'context' && (
            <div className={cn(
              'text-[10px] font-medium pt-1 uppercase tracking-wide',
              block.type === 'removed' && 'text-status-critical',
              block.type === 'added' && 'text-status-nominal'
            )}>
              {block.type === 'removed' && '− Removed'}
              {block.type === 'added' && '+ Added'}
            </div>
          )}
          
          {/* Context uses normal styling, changes use compact diff styling */}
          <MilkdownReadOnly 
            content={block.lines.join('\n')} 
            className={block.type !== 'context' ? 'diff-milkdown' : undefined} 
          />
        </div>
      ))}
    </div>
  )
}
