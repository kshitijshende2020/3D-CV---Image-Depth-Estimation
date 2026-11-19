import { useEffect, useRef, useState, useCallback } from 'react'
import { Download, Layers, Scissors, Sparkles, Eye, Sliders } from 'lucide-react'

export default function DepthIsolator({ originalSrc, depthCanvas }) {
  const canvasRef = useRef(null)
  const [minDepth, setMinDepth] = useState(0.40) // 0.0 (far) to 1.0 (near)
  const [maxDepth, setMaxDepth] = useState(1.00)
  const [bgMode, setBgMode] = useState('transparent') // 'transparent' | 'black' | 'green' | 'grayscale'
  const [feather, setFeather] = useState(0.04)
  const [isolatedPercent, setIsolatedPercent] = useState(0)

  const cacheRef = useRef({
    originalImg: null,
    sharpCanvas: null,
  })

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
    }
    img.src = originalSrc
  }, [originalSrc])

  const renderCutout = useCallback(() => {
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
    const sharpData = cache.sharpCanvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, width, height)
    const sharpPix = sharpData.data

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
    let insideCount = 0

    const lowCut = Math.min(minDepth, maxDepth)
    const highCut = Math.max(minDepth, maxDepth)
    const fth = Math.max(0.005, feather)

    for (let i = 0; i < totalPixels; i++) {
      const pIdx = i * 4
      const d = depthPix[pIdx] / 255.0

      let alpha = 1.0
      if (d < lowCut) {
        alpha = Math.max(0.0, 1.0 - (lowCut - d) / fth)
      } else if (d > highCut) {
        alpha = Math.max(0.0, 1.0 - (d - highCut) / fth)
      }

      const r = sharpPix[pIdx]
      const g = sharpPix[pIdx + 1]
      const b = sharpPix[pIdx + 2]

      if (alpha > 0.5) insideCount++

      if (bgMode === 'transparent') {
        outPix[pIdx] = r
        outPix[pIdx + 1] = g
        outPix[pIdx + 2] = b
        outPix[pIdx + 3] = Math.round(alpha * 255)
      } else if (bgMode === 'green') {
        // Chroma Key Green (0, 255, 0)
        outPix[pIdx] = Math.round(r * alpha)
        outPix[pIdx + 1] = Math.round(g * alpha + 255 * (1 - alpha))
        outPix[pIdx + 2] = Math.round(b * alpha)
        outPix[pIdx + 3] = 255
      } else if (bgMode === 'black') {
        // Pitch Black Background
        outPix[pIdx] = Math.round(r * alpha)
        outPix[pIdx + 1] = Math.round(g * alpha)
        outPix[pIdx + 2] = Math.round(b * alpha)
        outPix[pIdx + 3] = 255
      } else if (bgMode === 'grayscale') {
        // Spotlight mode: background in dim B&W, isolated subject in full color
        const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b) * 0.4
        outPix[pIdx] = Math.round(r * alpha + gray * (1 - alpha))
        outPix[pIdx + 1] = Math.round(g * alpha + gray * (1 - alpha))
        outPix[pIdx + 2] = Math.round(b * alpha + gray * (1 - alpha))
        outPix[pIdx + 3] = 255
      }
    }

    ctx.putImageData(outData, 0, 0)
    setIsolatedPercent(Math.round((insideCount / totalPixels) * 100))
  }, [minDepth, maxDepth, bgMode, feather, depthCanvas])

  useEffect(() => {
    let animId = requestAnimationFrame(() => {
      renderCutout()
    })
    return () => cancelAnimationFrame(animId)
  }, [renderCutout])

  const downloadCutout = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `seeing-depth-isolated-cutout-${bgMode}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  return (
    <article className="isolator-card">
      <div className="card-head">
        <div>
          <span className="card-index index-warm"><Scissors size={18} /></span>
          <span className="card-title">Depth Range Isolator & Background Removal</span>
        </div>
        <span className="card-tag color-tag">DEPTH SLICER</span>
      </div>

      {/* Control Toolbar */}
      <div className="isolator-toolbar">
        <div className="isolator-slider-group">
          <label>
            <span>FAR CUTOFF DEPTH (MIN)</span>
            <strong>{Math.round(minDepth * 100)}% depth</strong>
          </label>
          <input
            type="range"
            min="0.0"
            max="1.0"
            step="0.01"
            value={minDepth}
            onChange={(e) => setMinDepth(Number(e.target.value))}
            aria-label="Minimum depth threshold"
          />
        </div>

        <div className="isolator-slider-group">
          <label>
            <span>NEAR CUTOFF DEPTH (MAX)</span>
            <strong>{Math.round(maxDepth * 100)}% depth</strong>
          </label>
          <input
            type="range"
            min="0.0"
            max="1.0"
            step="0.01"
            value={maxDepth}
            onChange={(e) => setMaxDepth(Number(e.target.value))}
            aria-label="Maximum depth threshold"
          />
        </div>

        <div className="isolator-mode-group">
          <span className="group-label">BACKGROUND:</span>
          <div className="view-toggle">
            <button
              className={bgMode === 'transparent' ? 'selected' : ''}
              onClick={() => setBgMode('transparent')}
            >
              Transparent
            </button>
            <button
              className={bgMode === 'grayscale' ? 'selected' : ''}
              onClick={() => setBgMode('grayscale')}
            >
              Dim B&W
            </button>
            <button
              className={bgMode === 'green' ? 'selected' : ''}
              onClick={() => setBgMode('green')}
            >
              Green Screen
            </button>
            <button
              className={bgMode === 'black' ? 'selected' : ''}
              onClick={() => setBgMode('black')}
            >
              Black
            </button>
          </div>
        </div>

        <div className="isolator-meta-group">
          <div className="isolator-stat">
            <span>ISOLATED SHARE</span>
            <strong>{isolatedPercent}% <small>of photo</small></strong>
          </div>
          <button className="story-button" onClick={downloadCutout}>
            <Download size={15} /> Download Cutout
          </button>
        </div>
      </div>

      {/* Output Canvas */}
      <div className={`visual-frame isolator-frame ${bgMode === 'transparent' ? 'has-checkerboard' : ''}`}>
        <canvas ref={canvasRef} className="isolator-canvas" />
      </div>

      <div className="isolator-footer">
        <p>
          <Sparkles size={15} style={{ display: 'inline', verticalAlign: '-3px', marginRight: '6px', color: 'var(--accent-teal)' }} />
          <strong>AI Depth Matting:</strong> Strips out background and foreground layers without a green screen by thresholding the continuous 3D depth slice. Export as a transparent PNG for graphic design, VFX, or presentations.
        </p>
      </div>
    </article>
  )
}
