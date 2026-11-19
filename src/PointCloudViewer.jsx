import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, RotateCcw } from 'lucide-react'

function PointCloudViewer({ points }) {
  const canvasRef = useRef(null)
  const dragRef = useRef(null)
  const [rotation, setRotation] = useState({ x: -0.15, y: 0.32 })
  const [zoom, setZoom] = useState(1)

  const center = useMemo(() => {
    if (!points?.length) return [0, 0, 0]
    const sum = points.reduce((acc, point) => {
      acc[0] += point[0]
      acc[1] += point[1]
      acc[2] += point[2]
      return acc
    }, [0, 0, 0])
    return sum.map((value) => value / points.length)
  }, [points])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !points?.length) return undefined
    const context = canvas.getContext('2d')

    const draw = () => {
      const bounds = canvas.getBoundingClientRect()
      if (!bounds.width || !bounds.height) return
      const ratio = window.devicePixelRatio || 1
      canvas.width = Math.round(bounds.width * ratio)
      canvas.height = Math.round(bounds.height * ratio)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      context.fillStyle = '#06090a'
      context.fillRect(0, 0, bounds.width, bounds.height)

      const cosX = Math.cos(rotation.x)
      const sinX = Math.sin(rotation.x)
      const cosY = Math.cos(rotation.y)
      const sinY = Math.sin(rotation.y)
      const cameraDistance = 5.2 / zoom
      const focalPixels = Math.min(bounds.width, bounds.height) * 1.18
      const projected = []

      for (const point of points) {
        const x0 = point[0] - center[0]
        const y0 = point[1] - center[1]
        const z0 = point[2] - center[2]
        const x1 = x0 * cosY + z0 * sinY
        const z1 = -x0 * sinY + z0 * cosY
        const y1 = y0 * cosX - z1 * sinX
        const z2 = y0 * sinX + z1 * cosX
        const distance = cameraDistance - z2
        if (distance < 0.25) continue
        const perspective = focalPixels / distance
        const screenX = bounds.width / 2 + x1 * perspective
        const screenY = bounds.height / 2 - y1 * perspective
        if (screenX < -3 || screenX > bounds.width + 3 || screenY < -3 || screenY > bounds.height + 3) continue
        projected.push({ screenX, screenY, distance, r: point[3], g: point[4], b: point[5] })
      }

      // Draw distant points first so nearer points appear on top.
      projected.sort((a, b) => b.distance - a.distance)
      for (const point of projected) {
        const brightness = Math.max(0.55, Math.min(1, 1.08 - point.distance * 0.055))
        const red = Math.round(point.r * brightness)
        const green = Math.round(point.g * brightness)
        const blue = Math.round(point.b * brightness)
        context.fillStyle = `rgb(${red} ${green} ${blue})`
        context.beginPath()
        context.arc(point.screenX, point.screenY, 1.55, 0, Math.PI * 2)
        context.fill()
      }
    }

    draw()
    const observer = new ResizeObserver(draw)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [center, points, rotation, zoom])

  const startDrag = (event) => {
    dragRef.current = { x: event.clientX, y: event.clientY, rotation }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const moveDrag = (event) => {
    if (!dragRef.current) return
    const dx = event.clientX - dragRef.current.x
    const dy = event.clientY - dragRef.current.y
    setRotation({
      y: dragRef.current.rotation.y + dx * 0.008,
      x: Math.max(-1.2, Math.min(1.2, dragRef.current.rotation.x + dy * 0.008)),
    })
  }

  const downloadPly = () => {
    const rows = points.map(([x, y, z, r, g, b]) => `${x} ${y} ${z} ${r} ${g} ${b}`)
    const header = [
      'ply',
      'format ascii 1.0',
      'comment Relative depth projected with an assumed 60 degree horizontal field of view.',
      'comment Coordinates use arbitrary normalized units; they are not measurements in meters.',
      `element vertex ${points.length}`,
      'property float x',
      'property float y',
      'property float z',
      'property uchar red',
      'property uchar green',
      'property uchar blue',
      'end_header',
    ].join('\n')
    const file = new Blob([`${header}\n${rows.join('\n')}\n`], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = url
    link.download = 'seeing-depth-point-cloud.ply'
    link.click()
    URL.revokeObjectURL(url)
  }

  return <div className="point-cloud-wrap">
    <div className="point-cloud-canvas-wrap">
      <canvas
        ref={canvasRef}
        className="point-cloud-canvas"
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={() => { dragRef.current = null }}
        onPointerCancel={() => { dragRef.current = null }}
        onWheel={(event) => {
          event.preventDefault()
          setZoom((current) => Math.max(0.65, Math.min(1.7, current + (event.deltaY < 0 ? 0.08 : -0.08))))
        }}
        aria-label="Rotatable, approximate colored 3D point cloud"
      />
      <div className="point-cloud-hint">DRAG TO ORBIT <i /> SCROLL TO ZOOM</div>
      <button className="point-cloud-reset" onClick={() => { setRotation({ x: -0.15, y: 0.32 }); setZoom(1) }}>
        <RotateCcw size={12} style={{ display: 'inline', verticalAlign: '-1px', marginRight: '6px' }} />RESET VIEW
      </button>
    </div>
    <div className="point-cloud-meta">
      <div><strong>{points.length.toLocaleString()}</strong><span>colored points</span></div>
      <p>Approximate shape · assumed 60° camera field of view · arbitrary depth scale</p>
      <button className="story-button" onClick={downloadPly}>
        <Download size={14} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '6px' }} />Download .PLY point cloud
      </button>
    </div>
  </div>
}

export default PointCloudViewer
