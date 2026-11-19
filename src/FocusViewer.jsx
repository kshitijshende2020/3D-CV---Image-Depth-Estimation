import { useEffect, useRef, useState, useCallback } from 'react'
import { Aperture, Download, MousePointer2, RotateCcw, Sparkles, Target, Eye } from 'lucide-react'

export default function FocusViewer({ originalSrc, depthCanvas }) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)

  // Bounding box state (normalized percentages [0, 100])
  const [box, setBox] = useState({ x: 30, y: 25, width: 40, height: 50 })
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawStart, setDrawStart] = useState(null)

  // Depth stats inside box
  const [boxDepthStats, setBoxDepthStats] = useState({ min: 0.5, max: 0.8, avg: 0.65 })

  // Focus mode: 'box' (Subject Isolation) or 'plane' (Optical Depth Plane)
  const [focusMode, setFocusMode] = useState('box') // 'box' | 'plane'

  // Blur controls
  const [blurRadius, setBlurRadius] = useState(16) // 0 to 24px
  const [feather, setFeather] = useState(0.06)     // Falloff softness

  // Cache offscreen canvases
  const cacheRef = useRef({
    originalImg: null,
    sharpCanvas: null,
    blurCanvas: null,
    currentBlurRadius: null,
  })

  // Load and cache original image
  useEffect(() => {
    if (!originalSrc) return
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const sharpCanvas = document.createElement('canvas')
      sharpCanvas.width = img.naturalWidth
      sharpCanvas.height = img.naturalHeight
      const sCtx = sharpCanvas.getContext('2d')
      sCtx.drawImage(img, 0, 0)

      cacheRef.current.originalImg = img
      cacheRef.current.sharpCanvas = sharpCanvas
      cacheRef.current.blurCanvas = null
      cacheRef.current.currentBlurRadius = null

      computeBoxDepth(box, sharpCanvas.width, sharpCanvas.height)
    }
    img.src = originalSrc
  }, [originalSrc, depthCanvas])

  // Compute depth range inside the bounding box
  const computeBoxDepth = useCallback((currentBox) => {
    if (!depthCanvas || depthCanvas.width === 0) return

    const dCtx = depthCanvas.getContext('2d', { willReadFrequently: true })
    const dW = depthCanvas.width
    const dH = depthCanvas.height

    const x1 = Math.max(0, Math.min(dW - 1, Math.floor((currentBox.x / 100) * dW)))
    const y1 = Math.max(0, Math.min(dH - 1, Math.floor((currentBox.y / 100) * dH)))
    const x2 = Math.max(x1 + 1, Math.min(dW, Math.floor(((currentBox.x + currentBox.width) / 100) * dW)))
    const y2 = Math.max(y1 + 1, Math.min(dH, Math.floor(((currentBox.y + currentBox.height) / 100) * dH)))

    const boxW = x2 - x1
    const boxH = y2 - y1
    if (boxW <= 0 || boxH <= 0) return

    const imgData = dCtx.getImageData(x1, y1, boxW, boxH).data
    let minD = 1.0
    let maxD = 0.0
    let sumD = 0
    let count = 0

    // Sample pixels inside box
    for (let i = 0; i < imgData.length; i += 16) {
      const d = imgData[i] / 255.0
      if (d < minD) minD = d
      if (d > maxD) maxD = d
      sumD += d
      count++
    }

    if (count > 0) {
      setBoxDepthStats({
        min: Number(minD.toFixed(3)),
        max: Number(maxD.toFixed(3)),
        avg: Number((sumD / count).toFixed(3)),
      })
    }
  }, [depthCanvas])

  // Core render function
  const renderFocus = useCallback(() => {
    const canvas = canvasRef.current
    const cache = cacheRef.current
    if (!canvas || !cache.sharpCanvas || !depthCanvas || depthCanvas.width === 0) return

    const width = cache.sharpCanvas.width
    const height = cache.sharpCanvas.height
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }

    const ctx = canvas.getContext('2d')

    // If blur is 0, render sharp original
    if (blurRadius <= 0) {
      ctx.drawImage(cache.sharpCanvas, 0, 0)
      return
    }

    // Prepare blurred copy if blurRadius changed
    if (!cache.blurCanvas || cache.currentBlurRadius !== blurRadius) {
      const bCanvas = document.createElement('canvas')
      bCanvas.width = width
      bCanvas.height = height
      const bCtx = bCanvas.getContext('2d')
      bCtx.filter = `blur(${blurRadius}px)`
      bCtx.drawImage(cache.originalImg, -blurRadius, -blurRadius, width + blurRadius * 2, height + blurRadius * 2)
      cache.blurCanvas = bCanvas
      cache.currentBlurRadius = blurRadius
    }

    const sharpPix = cache.sharpCanvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, width, height).data
    const blurPix = cache.blurCanvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, width, height).data

    // Sample depth from depthCanvas
    let depthPix
    if (depthCanvas.width === width && depthCanvas.height === height) {
      depthPix = depthCanvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, width, height).data
    } else {
      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = width
      tempCanvas.height = height
      const tCtx = tempCanvas.getContext('2d', { willReadFrequently: true })
      tCtx.drawImage(depthCanvas, 0, 0, width, height)
      depthPix = tCtx.getImageData(0, 0, width, height).data
    }

    const outData = ctx.createImageData(width, height)
    const outPix = outData.data
    const totalPixels = width * height

    const minDepth = boxDepthStats.min
    const maxDepth = boxDepthStats.max
    const falloff = Math.max(0.015, feather)

    // Bounding box pixel boundaries
    const bLeft = (box.x / 100) * width
    const bTop = (box.y / 100) * height
    const bRight = ((box.x + box.width) / 100) * width
    const bBottom = ((box.y + box.height) / 100) * height
    const maxSpatialDist = Math.max(width, height) * 0.25 // spatial falloff range

    for (let i = 0; i < totalPixels; i++) {
      const pIdx = i * 4
      const d = depthPix[pIdx] / 255.0
      const px = i % width
      const py = Math.floor(i / width)

      // 1. Calculate depth difference
      let depthBlend = 0
      if (d < minDepth) {
        depthBlend = Math.min(1.0, (minDepth - d) / falloff)
      } else if (d > maxDepth) {
        depthBlend = Math.min(1.0, (d - maxDepth) / falloff)
      }

      let blend = depthBlend

      // 2. In 'box' mode (Subject Lock): pixels outside the box get blurred
      // even if they share similar depth to the subject (e.g. distant sky vs distant ridge)
      if (focusMode === 'box') {
        const dx = px < bLeft ? bLeft - px : px > bRight ? px - bRight : 0
        const dy = py < bTop ? bTop - py : py > bBottom ? py - bBottom : 0
        const spatialDist = Math.sqrt(dx * dx + dy * dy)

        if (spatialDist > 0) {
          // Increase blur smoothly as distance from box grows
          const spatialBlend = Math.min(1.0, spatialDist / maxSpatialDist)
          // Combine depth blend and spatial blend so only the box area stays sharp
          blend = Math.max(depthBlend, spatialBlend)
        }
      }

      if (blend <= 0) {
        outPix[pIdx] = sharpPix[pIdx]
        outPix[pIdx + 1] = sharpPix[pIdx + 1]
        outPix[pIdx + 2] = sharpPix[pIdx + 2]
        outPix[pIdx + 3] = 255
      } else if (blend >= 1) {
        outPix[pIdx] = blurPix[pIdx]
        outPix[pIdx + 1] = blurPix[pIdx + 1]
        outPix[pIdx + 2] = blurPix[pIdx + 2]
        outPix[pIdx + 3] = 255
      } else {
        const inv = 1.0 - blend
        outPix[pIdx] = Math.round(sharpPix[pIdx] * inv + blurPix[pIdx] * blend)
        outPix[pIdx + 1] = Math.round(sharpPix[pIdx + 1] * inv + blurPix[pIdx + 1] * blend)
        outPix[pIdx + 2] = Math.round(sharpPix[pIdx + 2] * inv + blurPix[pIdx + 2] * blend)
        outPix[pIdx + 3] = 255
      }
    }

    ctx.putImageData(outData, 0, 0)
  }, [box, boxDepthStats, focusMode, blurRadius, feather, depthCanvas])

  useEffect(() => {
    let animId = requestAnimationFrame(() => {
      renderFocus()
    })
    return () => cancelAnimationFrame(animId)
  }, [renderFocus])

  // Mouse drag handlers
  const handleMouseDown = (e) => {
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const xPct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
    const yPct = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100))

    setIsDrawing(true)
    setDrawStart({ xPct, yPct })
    setBox({ x: xPct, y: yPct, width: 2, height: 2 })
  }

  const handleMouseMove = (e) => {
    if (!isDrawing || !drawStart) return
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const currentX = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
    const currentY = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100))

    const x = Math.min(drawStart.xPct, currentX)
    const y = Math.min(drawStart.yPct, currentY)
    const width = Math.max(4, Math.abs(currentX - drawStart.xPct))
    const height = Math.max(4, Math.abs(currentY - drawStart.yPct))

    const newBox = { x, y, width, height }
    setBox(newBox)
    computeBoxDepth(newBox)
  }

  const handleMouseUp = () => {
    if (isDrawing) {
      setIsDrawing(false)
      setDrawStart(null)
      computeBoxDepth(box)
    }
  }

  const downloadPortrait = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = 'seeing-depth-portrait-refocus.png'
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  const apertureFStop = blurRadius <= 2
    ? 'f/16 (Sharp / No Blur)'
    : blurRadius <= 6
    ? 'f/8.0 (Subtle Bokeh)'
    : blurRadius <= 12
    ? 'f/4.0 (Balanced Portrait)'
    : blurRadius <= 18
    ? 'f/2.0 (Strong Bokeh)'
    : 'f/1.4 (Creamy DSLR Bokeh)'

  return (
    <article className="focus-card">
      <div className="card-head">
        <div>
          <span className="card-index index-warm"><Aperture size={18} /></span>
          <span className="card-title">Interactive Box Focus & Bokeh Mode</span>
        </div>
        <span className="card-tag color-tag">PRECISION BOX SELECTOR</span>
      </div>

      {/* Control Toolbar */}
      <div className="focus-toolbar">
        {/* Focus Scope Mode Toggle */}
        <div className="focus-mode-toggle-group">
          <label><span>FOCUS SCOPE</span></label>
          <div className="view-toggle">
            <button
              className={focusMode === 'box' ? 'selected' : ''}
              onClick={() => setFocusMode('box')}
              title="Isolates the marked box: only what you boxed stays sharp, everything outside blurs"
            >
              <Target size={14} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '4px' }} />
              Isolate Box Subject
            </button>
            <button
              className={focusMode === 'plane' ? 'selected' : ''}
              onClick={() => setFocusMode('plane')}
              title="Optical Lens: keeps all objects at this exact depth sharp across the whole photo"
            >
              <Eye size={14} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '4px' }} />
              Full Depth Plane
            </button>
          </div>
        </div>

        <div className="focus-control-group">
          <label>
            <span>APERTURE BOKEH STRENGTH</span>
            <strong>{apertureFStop}</strong>
          </label>
          <input
            type="range"
            min="0"
            max="24"
            step="1"
            value={blurRadius}
            onChange={(e) => setBlurRadius(Number(e.target.value))}
            aria-label="Aperture blur strength"
          />
        </div>

        <div className="focus-control-group">
          <label>
            <span>EDGE FALLOFF SOFTNESS</span>
            <strong>{Math.round(feather * 100)}% falloff</strong>
          </label>
          <input
            type="range"
            min="0.01"
            max="0.20"
            step="0.01"
            value={feather}
            onChange={(e) => setFeather(Number(e.target.value))}
            aria-label="Edge falloff softness"
          />
        </div>

        <div className="focus-meta-group">
          <div className="focus-stat">
            <span>FOCUSED DEPTH WINDOW</span>
            <strong>
              {Math.round(boxDepthStats.min * 100)}% → {Math.round(boxDepthStats.max * 100)}%
              <small> ({Math.round(boxDepthStats.avg * 100)}% mean)</small>
            </strong>
          </div>
          <button className="story-button" onClick={downloadPortrait}>
            <Download size={15} /> Download Portrait
          </button>
        </div>
      </div>

      {/* Interactive Photo Canvas with Draggable Focus Box */}
      <div
        ref={containerRef}
        className="visual-frame focus-frame"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        role="button"
        tabIndex={0}
        aria-label="Drag a box over any subject to focus it"
      >
        <canvas ref={canvasRef} className="focus-canvas" />

        {/* Selected Focus Box Overlay */}
        <div
          className="focus-box-overlay"
          style={{
            left: `${box.x}%`,
            top: `${box.y}%`,
            width: `${box.width}%`,
            height: `${box.height}%`,
          }}
        >
          <div className="box-corner tl" />
          <div className="box-corner tr" />
          <div className="box-corner bl" />
          <div className="box-corner br" />
          <div className="box-tag">
            <span>SHARP ZONE</span>
            <b>{Math.round(boxDepthStats.min * 100)}%–{Math.round(boxDepthStats.max * 100)}%</b>
          </div>
        </div>

        <div className="click-hint">
          <MousePointer2 size={13} /> CLICK & DRAG TO BOX ANY OBJECT
        </div>
      </div>

      <div className="focus-footer">
        <p>
          <Sparkles size={15} style={{ display: 'inline', verticalAlign: '-3px', marginRight: '6px', color: 'var(--accent-teal)' }} />
          <strong>{focusMode === 'box' ? 'Subject Isolation Mode Active:' : 'Optical Depth Plane Active:'}</strong>{' '}
          {focusMode === 'box'
            ? 'Only the subject inside and immediately around your box remains sharp. Backgrounds, sky, and distant scenery outside the box are smoothly blurred.'
            : 'Simulates a physical camera lens where all objects sharing the exact same depth distance stay sharp across the entire field of view.'}
        </p>
      </div>
    </article>
  )
}
