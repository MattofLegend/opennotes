import { useCallback, useRef } from "react"

interface ResizeHandleProps {
  onDrag: (totalDelta: number) => void
}

export function ResizeHandle({ onDrag }: ResizeHandleProps) {
  const startXRef = useRef<number>(0)
  
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    startXRef.current = e.clientX
    
    const handleMouseMove = (e: MouseEvent) => {
      // Calculate total delta from drag start
      const totalDelta = e.clientX - startXRef.current
      onDrag(totalDelta)
    }
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [onDrag])

  return (
    <div
      onMouseDown={handleMouseDown}
      className="relative cursor-col-resize shrink-0 select-none hover:bg-primary/20 active:bg-primary/40 transition-colors"
      style={{ width: 4, marginLeft: -2, marginRight: -2 }}
    />
  )
}
