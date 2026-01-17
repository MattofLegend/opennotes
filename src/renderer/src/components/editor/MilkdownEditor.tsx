import { useEffect, useCallback, useRef } from 'react'
import { Editor, rootCtx, defaultValueCtx, editorViewOptionsCtx } from '@milkdown/kit/core'
import { commonmark } from '@milkdown/kit/preset/commonmark'
import { gfm } from '@milkdown/kit/preset/gfm'
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener'
import { history } from '@milkdown/kit/plugin/history'
import { clipboard } from '@milkdown/kit/plugin/clipboard'
import { replaceAll } from '@milkdown/kit/utils'
import { $prose } from '@milkdown/kit/utils'
import { Plugin, PluginKey } from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'
import { cn } from '@/lib/utils'

// Plugin to style wiki-links [[Title]]
const wikiLinkDecorationKey = new PluginKey('wiki-link-decoration')

const wikiLinkPlugin = $prose(() => {
  return new Plugin({
    key: wikiLinkDecorationKey,
    state: {
      init(_, state) {
        return findWikiLinks(state.doc)
      },
      apply(tr, oldDecorations) {
        if (tr.docChanged) {
          return findWikiLinks(tr.doc)
        }
        return oldDecorations.map(tr.mapping, tr.doc)
      }
    },
    props: {
      decorations(state) {
        return this.getState(state)
      }
    }
  })
})

function findWikiLinks(doc: any): DecorationSet {
  const decorations: Decoration[] = []
  
  doc.descendants((node: any, pos: number) => {
    if (node.isText) {
      const text = node.text || ''
      const regex = /\[\[([^\]]+)\]\]/g
      let match
      while ((match = regex.exec(text)) !== null) {
        const from = pos + match.index
        const to = from + match[0].length
        decorations.push(
          Decoration.inline(from, to, {
            class: 'wiki-link',
            style: 'color: var(--primary); text-decoration: underline; text-decoration-color: color-mix(in srgb, var(--primary) 40%, transparent); cursor: pointer;'
          })
        )
      }
    }
  })
  
  return DecorationSet.create(doc, decorations)
}

interface MilkdownEditorProps {
  content: string
  onChange: (content: string) => void
  onBlur?: () => void
  onLinkClick?: (href: string) => void
}

interface MilkdownReadOnlyProps {
  content: string
  className?: string
}

export function MilkdownEditor({ content, onChange, onBlur, onLinkClick }: MilkdownEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<Editor | null>(null)
  const contentRef = useRef(content)
  const isInitializedRef = useRef(false)

  useEffect(() => {
    contentRef.current = content
  }, [content])

  const handleChange = useCallback(
    (markdown: string) => {
      if (markdown !== contentRef.current) {
        contentRef.current = markdown
        onChange(markdown)
      }
    },
    [onChange]
  )

  // Handle link clicks via event delegation on the container
  useEffect(() => {
    const container = containerRef.current
    if (!container || !onLinkClick) return

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      
      // Check for regular <a> links
      const link = target.closest('a')
      if (link) {
        const href = link.getAttribute('href')
        if (href) {
          e.preventDefault()
          e.stopPropagation()
          onLinkClick(href)
          return
        }
      }
      
      // Check for wiki-style [[Title]] links in text
      // Get the text content around the click
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        const textNode = range.startContainer
        if (textNode.nodeType === Node.TEXT_NODE && textNode.textContent) {
          const text = textNode.textContent
          const offset = range.startOffset
          
          // Find [[...]] pattern around the cursor position
          const wikiLinkRegex = /\[\[([^\]]+)\]\]/g
          let match
          while ((match = wikiLinkRegex.exec(text)) !== null) {
            const start = match.index
            const end = start + match[0].length
            if (offset >= start && offset <= end) {
              e.preventDefault()
              e.stopPropagation()
              onLinkClick(match[0]) // Pass the full [[Title]] pattern
              return
            }
          }
        }
      }
    }

    container.addEventListener('click', handleClick, true) // Use capture phase
    return () => container.removeEventListener('click', handleClick, true)
  }, [onLinkClick])

  useEffect(() => {
    if (!containerRef.current || isInitializedRef.current) return

    isInitializedRef.current = true

    const initEditor = async () => {
      const editor = await Editor.make()
        .config((ctx) => {
          ctx.set(rootCtx, containerRef.current!)
          ctx.set(defaultValueCtx, content)
          ctx.update(editorViewOptionsCtx, (prev) => ({
            ...prev,
            attributes: {
              class: 'milkdown-editor',
              spellcheck: 'false'
            }
          }))
          ctx.get(listenerCtx).markdownUpdated((_, markdown) => {
            handleChange(markdown)
          })
          if (onBlur) {
            ctx.get(listenerCtx).blur(() => {
              onBlur()
            })
          }
        })
        .use(commonmark)
        .use(gfm)
        .use(listener)
        .use(history)
        .use(clipboard)
        .use(wikiLinkPlugin)
        .create()

      editorRef.current = editor
    }

    initEditor()

    return () => {
      if (editorRef.current) {
        editorRef.current.destroy()
        editorRef.current = null
        isInitializedRef.current = false
      }
    }
  }, [])

  useEffect(() => {
    const editor = editorRef.current
    if (editor && content !== contentRef.current) {
      editor.action(replaceAll(content))
      contentRef.current = content
    }
  }, [content])

  return (
    <div className="milkdown-wrapper">
      <div ref={containerRef} className="milkdown" />
    </div>
  )
}

/**
 * Read-only Milkdown renderer for displaying markdown content.
 * Used for diff previews and other non-editable displays.
 */
export function MilkdownReadOnly({ content, className }: MilkdownReadOnlyProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<Editor | null>(null)
  const isInitializedRef = useRef(false)
  const contentRef = useRef(content)

  useEffect(() => {
    if (!containerRef.current || isInitializedRef.current) return

    isInitializedRef.current = true

    const initEditor = async () => {
      const editor = await Editor.make()
        .config((ctx) => {
          ctx.set(rootCtx, containerRef.current!)
          ctx.set(defaultValueCtx, content)
          ctx.update(editorViewOptionsCtx, (prev) => ({
            ...prev,
            editable: () => false, // Make read-only
            attributes: {
              class: 'milkdown-editor milkdown-readonly',
              spellcheck: 'false'
            }
          }))
        })
        .use(commonmark)
        .use(gfm)
        .create()

      editorRef.current = editor
      contentRef.current = content
    }

    initEditor()

    return () => {
      if (editorRef.current) {
        editorRef.current.destroy()
        editorRef.current = null
        isInitializedRef.current = false
      }
    }
  }, [])

  // Update content when it changes
  useEffect(() => {
    const editor = editorRef.current
    if (editor && content !== contentRef.current) {
      editor.action(replaceAll(content))
      contentRef.current = content
    }
  }, [content])

  return (
    <div className={cn('milkdown-wrapper', className)}>
      <div ref={containerRef} className="milkdown" />
    </div>
  )
}
