import { useEffect, useCallback, useRef } from 'react'
import { Editor, rootCtx, defaultValueCtx, editorViewOptionsCtx } from '@milkdown/kit/core'
import { commonmark } from '@milkdown/kit/preset/commonmark'
import { gfm } from '@milkdown/kit/preset/gfm'
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener'
import { history } from '@milkdown/kit/plugin/history'
import { clipboard } from '@milkdown/kit/plugin/clipboard'
import { replaceAll } from '@milkdown/kit/utils'
import { cn } from '@/lib/utils'

interface MilkdownEditorProps {
  content: string
  onChange: (content: string) => void
  onBlur?: () => void
}

interface MilkdownReadOnlyProps {
  content: string
  className?: string
}

export function MilkdownEditor({ content, onChange, onBlur }: MilkdownEditorProps) {
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
