import { useRef, useState } from 'react'
import {
  Aperture,
  ArrowUpRight,
  BarChart3,
  Check,
  CircleHelp,
  ImagePlus,
  Images,
  LoaderCircle,
  MousePointer2,
  Palette,
  Sparkles,
  X,
} from 'lucide-react'
import PointCloudViewer from './PointCloudViewer.jsx'
import FocusViewer from './FocusViewer.jsx'
import DepthIsolator from './DepthIsolator.jsx'
import BenchmarkViewer from './BenchmarkViewer.jsx'
import { COLORMAP_NAMES, COLORMAP_GRADIENTS, applyColormapToCanvas, getColorForValue } from './colormaps.js'

const API_URL = '/api/estimate'

const SAMPLE_PRESETS = [
  {
    id: 'living_room',
    title: 'Living Room',
    subtitle: 'Indoor Depth Layers',
    src: '/samples/living_room.jpg',
    tag: 'INDOOR',
  },
  {
    id: 'arched_corridor',
    title: 'Arched Corridor',
    subtitle: 'Vanishing Perspective',
    src: '/samples/arched_corridor.jpg',
    tag: 'TUNNEL',
  },
  {
    id: 'park_bench',
    title: 'Park Bench',
    subtitle: 'Foreground Silhouette',
    src: '/samples/park_bench.jpg',
    tag: 'OBJECT',
  },
  {
    id: 'forest_stream',
    title: 'Forest Stream',
    subtitle: 'Gnarled Roots & Trees',
    src: '/samples/forest_stream.jpg',
    tag: 'NATURE',
  },
  {
    id: 'waterfall_cliff',
    title: 'Waterfall Cliff',
    subtitle: 'Epic Landscape Scale',
    src: '/samples/waterfall_cliff.jpg',
    tag: 'LANDSCAPE',
  },
]

function App() {
  const inputRef = useRef(null)
  const depthCanvasRef = useRef(null)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [point, setPoint] = useState(null)
  const [story, setStory] = useState(null)
  const [storyLoading, setStoryLoading] = useState(false)
  const [storyError, setStoryError] = useState('')
  const [displayMode, setDisplayMode] = useState('split') // 'split' | 'overlay' | 'focus' | 'isolator' | 'pointcloud'
  const [overlayPosition, setOverlayPosition] = useState(50)
  const [histogram, setHistogram] = useState(Array(16).fill(0))

  // Colormap palette state
  const [colormap, setColormap] = useState('turbo')
  const [customColorMapUrl, setCustomColorMapUrl] = useState('')

  // Benchmark dashboard view toggle
  const [showBenchmark, setShowBenchmark] = useState(false)

  const pickFile = (next) => {
    if (!next) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(next.type)) {
      setError('Please choose a JPG, PNG, or WebP image.')
      return
    }
    if (next.size > 15 * 1024 * 1024) {
      setError('This image is over 15 MB. Choose a smaller photo.')
      return
    }
    setError('')
    setFile(next)
    setResult(null)
    setPoint(null)
    setStory(null)
    setStoryError('')
    setDisplayMode('split')
    setOverlayPosition(50)
    setCustomColorMapUrl('')
    setPreview(URL.createObjectURL(next))
  }

  const estimate = async () => {
    if (!file) return
    setLoading(true)
    setError('')
    setPoint(null)
    try {
      const body = new FormData()
      body.append('file', file)
      const response = await fetch(API_URL, { method: 'POST', body })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.detail || 'Could not estimate depth.')
      setResult(payload)
      setCustomColorMapUrl('')
    } catch (e) {
      setError(e.message || 'Could not reach the depth service. Check that the API is running.')
    } finally {
      setLoading(false)
    }
  }

  // Load sample image with one click
  const loadSample = async (sample) => {
    try {
      setLoading(true)
      setError('')
      setPoint(null)
      setStory(null)
      setStoryError('')
      setCustomColorMapUrl('')
      setDisplayMode('split')

      const response = await fetch(sample.src)
      const blob = await response.blob()
      const sampleFile = new File([blob], `${sample.id}.jpg`, { type: 'image/jpeg' })

      setFile(sampleFile)
      setPreview(sample.src)

      const body = new FormData()
      body.append('file', sampleFile)
      const apiRes = await fetch(API_URL, { method: 'POST', body })
      const payload = await apiRes.json()
      if (!apiRes.ok) throw new Error(payload.detail || 'Could not estimate depth.')
      setResult(payload)
    } catch (err) {
      setError(err.message || 'Could not load sample image.')
    } finally {
      setLoading(false)
    }
  }

  const buildStory = async () => {
    if (!file || !result) return
    setStoryLoading(true)
    setStoryError('')
    try {
      const body = new FormData()
      body.append('file', file)
      body.append('depth', result.depth)
      const response = await fetch('/api/story', { method: 'POST', body })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.detail || 'Could not build the depth story.')
      setStory(payload)
    } catch (e) {
      setStoryError(e.message || 'Could not reach the story service.')
    } finally {
      setStoryLoading(false)
    }
  }

  const inspectPoint = (event) => {
    const canvas = depthCanvasRef.current
    if (!canvas || !result) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const scale = Math.min(bounds.width / canvas.width, bounds.height / canvas.height)
    const shownWidth = canvas.width * scale
    const shownHeight = canvas.height * scale
    const offsetX = (bounds.width - shownWidth) / 2
    const offsetY = (bounds.height - shownHeight) / 2
    const x = Math.max(0, Math.min(canvas.width - 1, Math.floor((event.clientX - bounds.left - offsetX) / shownWidth * canvas.width)))
    const y = Math.max(0, Math.min(canvas.height - 1, Math.floor((event.clientY - bounds.top - offsetY) / shownHeight * canvas.height)))
    const value = canvas.getContext('2d').getImageData(x, y, 1, 1).data[0] / 255
    setPoint({ x: Math.round((offsetX + x / canvas.width * shownWidth) / bounds.width * 100), y: Math.round((offsetY + y / canvas.height * shownHeight) / bounds.height * 100), value })
  }

  const applyPalette = (cm) => {
    const canvas = depthCanvasRef.current
    if (!canvas || canvas.width === 0) return
    const coloredUrl = applyColormapToCanvas(canvas, cm)
    if (coloredUrl) {
      setCustomColorMapUrl(coloredUrl)
    }
  }

  const changeColormap = (nextColormap) => {
    setColormap(nextColormap)
    applyPalette(nextColormap)
  }

  const loadMap = (image) => {
    const canvas = depthCanvasRef.current
    if (!canvas || !image) return
    const context = canvas.getContext('2d', { willReadFrequently: true })
    const bitmap = new Image()
    bitmap.onload = () => {
      canvas.width = bitmap.naturalWidth
      canvas.height = bitmap.naturalHeight
      context.drawImage(bitmap, 0, 0)
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
      const bins = Array(16).fill(0)
      for (let i = 0; i < pixels.length; i += 4) bins[Math.min(15, Math.floor(pixels[i] / 16))] += 1
      setHistogram(bins)
      applyPalette(colormap)
    }
    bitmap.src = image
  }

  const activeDepthColor = customColorMapUrl || (result ? `data:image/png;base64,${result.color}` : '')

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Seeing Depth home">
          <span className="brand-mark"><Aperture size={20} strokeWidth={2} /></span>
          <span>seeing<span className="brand-light">depth</span></span>
        </a>
        <div className="topbar-right">
          <button
            className={`topbar-nav-button ${showBenchmark || displayMode === 'benchmark' ? 'active' : ''}`}
            onClick={() => {
              if (result) {
                setDisplayMode(displayMode === 'benchmark' ? 'split' : 'benchmark')
              } else {
                setShowBenchmark(!showBenchmark)
              }
            }}
            aria-label="Toggle benchmark metrics"
          >
            <BarChart3 size={15} />
            <span>BENCHMARK (NYU V2)</span>
          </button>
          <span className="topbar-divider" />
          <span className="model-status"><i /> MODEL READY</span>
        </div>
      </header>

      {/* Benchmark Dashboard Overlay / Modal */}
      {showBenchmark && (
        <BenchmarkViewer onClose={() => setShowBenchmark(false)} />
      )}

      <main id="top">
        <section className={`upload-section ${result ? 'has-result' : ''}`}>
          <div className="section-heading">
            <div>
              <div className="section-kicker">IMAGE INPUT</div>
              <h2>Upload or choose a test scene</h2>
            </div>
            <div className="step-label"><span>JPG · PNG · WEBP</span></div>
          </div>

          <div
            className={`upload-box ${dragging ? 'is-dragging' : ''} ${file ? 'has-file' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files[0]) }}
          >
            <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => pickFile(e.target.files[0])} />
            {preview ? (
              <div className="file-preview">
                <img src={preview} alt="Selected photo preview" />
                <div className="file-overlay">
                  <div className="file-name"><Check size={16} />{file.name}</div>
                  <button
                    className="icon-button"
                    onClick={() => {
                      setFile(null)
                      setResult(null)
                      setPreview('')
                      setPoint(null)
                      setStory(null)
                      setStoryError('')
                      setCustomColorMapUrl('')
                      if (inputRef.current) inputRef.current.value = ''
                    }}
                    aria-label="Remove image"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="upload-icon"><ImagePlus size={32} strokeWidth={1.8} /></div>
                <div className="upload-copy">
                  <strong>Drop your image here</strong>
                  <span>or <button className="text-button" onClick={() => inputRef.current?.click()}>browse files</button> from your device</span>
                </div>
                <span className="file-types">JPG · PNG · WEBP <i /> MAX 15 MB</span>
              </>
            )}
          </div>

          <div className="upload-actions">
            <span className="privacy-note"><CircleHelp size={16} /> Your image stays on your machine</span>
            <button className="analyze-button" disabled={!file || loading} onClick={estimate}>
              {loading ? (
                <><LoaderCircle className="spin" size={17} /> Reading the scene…</>
              ) : (
                <><Sparkles size={16} /> {result ? 'Re-analyze image' : 'Reveal depth'} <ArrowUpRight size={16} /></>
              )}
            </button>
          </div>

          {/* Quick-Test Sample Gallery Strip */}
          <div className="gallery-section">
            <div className="gallery-header">
              <Images size={16} />
              <span>OR TEST INSTANTLY WITH A SAMPLE SCENE:</span>
            </div>
            <div className="gallery-grid">
              {SAMPLE_PRESETS.map((sample) => (
                <button
                  key={sample.id}
                  className={`gallery-card ${file?.name === `${sample.id}.jpg` ? 'active-sample' : ''}`}
                  onClick={() => loadSample(sample)}
                  disabled={loading}
                >
                  <div className="gallery-thumb">
                    <img src={sample.src} alt={sample.title} />
                    <span className="gallery-tag">{sample.tag}</span>
                  </div>
                  <div className="gallery-info">
                    <strong>{sample.title}</strong>
                    <span>{sample.subtitle}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {error && <div className="error-message"><span>!</span>{error}</div>}
        </section>

        {result && (
          <section className="results" aria-live="polite">
            <div className="results-heading">
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                <div className="view-toggle" aria-label="Result view">
                  <button className={displayMode === 'split' ? 'selected' : ''} onClick={() => setDisplayMode('split')}>Side by side</button>
                  <button className={displayMode === 'overlay' ? 'selected' : ''} onClick={() => setDisplayMode('overlay')}>Overlay</button>
                  <button className={displayMode === 'focus' ? 'selected' : ''} onClick={() => setDisplayMode('focus')}>Box focus</button>
                  <button className={displayMode === 'isolator' ? 'selected' : ''} onClick={() => setDisplayMode('isolator')}>Depth slice</button>
                  <button className={displayMode === 'pointcloud' ? 'selected' : ''} onClick={() => setDisplayMode('pointcloud')}>3D cloud</button>
                  <button className={displayMode === 'benchmark' ? 'selected' : ''} onClick={() => setDisplayMode('benchmark')}>Benchmark (NYU)</button>
                </div>

                {/* Colormap Selector */}
                <div className="colormap-select-wrap">
                  <Palette size={15} />
                  <span className="colormap-select-label">PALETTE</span>
                  <select
                    className="colormap-select"
                    value={colormap}
                    onChange={(e) => changeColormap(e.target.value)}
                    aria-label="Select depth map color palette"
                  >
                    {COLORMAP_NAMES.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="story-action">
                <button
                  className="story-button"
                  title="First use downloads the optional BLIP caption model (about 990 MB)."
                  onClick={story ? () => setStory(null) : buildStory}
                  disabled={storyLoading}
                >
                  {storyLoading ? (
                    <><LoaderCircle className="spin" size={13} /> Finding the layers…</>
                  ) : story ? (
                    'Hide story'
                  ) : (
                    <><Sparkles size={13} /> Tell the depth story</>
                  )}
                </button>
                {!story && <small>Optional model · ~990 MB first use</small>}
              </div>
            </div>

            {/* View Modes */}
            {displayMode === 'benchmark' ? (
              <BenchmarkViewer isTab={true} />
            ) : displayMode === 'focus' ? (
              <FocusViewer originalSrc={preview} depthCanvas={depthCanvasRef.current} />
            ) : displayMode === 'isolator' ? (
              <DepthIsolator originalSrc={preview} depthCanvas={depthCanvasRef.current} />
            ) : displayMode === 'pointcloud' ? (
              <article className="point-cloud-card">
                <div className="card-head">
                  <div>
                    <span className="card-index index-warm">C</span>
                    <span className="card-title">Approximate colored point cloud</span>
                  </div>
                  <span className="card-tag color-tag">PSEUDO-3D</span>
                </div>
                <PointCloudViewer points={result.pointCloud || []} />
              </article>
            ) : (
              <div className={`image-grid ${displayMode === 'overlay' ? 'overlay-grid' : ''}`}>
                {displayMode === 'overlay' ? (
                  <article className="image-card overlay-card">
                    <div className="card-head">
                      <div>
                        <span className="card-index index-warm">↔</span>
                        <span className="card-title">Drag to compare photo and depth</span>
                      </div>
                      <span className="card-tag color-tag">OVERLAY</span>
                    </div>
                    <div
                      className="visual-frame overlay-frame"
                      onClick={inspectPoint}
                      role="button"
                      tabIndex={0}
                      aria-label="Click to inspect a point or use the slider to compare the original photo and depth map"
                    >
                      <img className="overlay-original" src={preview} alt="Original photograph" />
                      <img
                        className="overlay-depth"
                        src={activeDepthColor}
                        alt="Colorized relative depth map"
                        style={{ clipPath: `inset(0 ${100 - overlayPosition}% 0 0)` }}
                        onLoad={() => loadMap(`data:image/png;base64,${result.depth}`)}
                      />
                      <span className="overlay-divider" style={{ left: `${overlayPosition}%` }}><i /></span>
                      <span className="overlay-label overlay-label-left">DEPTH</span>
                      <span className="overlay-label overlay-label-right">PHOTO</span>
                      {point && <span className="point-marker" style={{ left: `${point.x}%`, top: `${point.y}%` }}><i /></span>}
                    </div>
                    <input
                      className="overlay-slider"
                      type="range"
                      min="0"
                      max="100"
                      value={overlayPosition}
                      onChange={(e) => setOverlayPosition(Number(e.target.value))}
                      aria-label="Adjust depth overlay comparison"
                    />
                    <div className="overlay-scale">
                      <span>DEPTH MAP</span>
                      <span>↔</span>
                      <span>ORIGINAL PHOTO</span>
                    </div>
                  </article>
                ) : (
                  <>
                    <article className="image-card">
                      <div className="card-head">
                        <div>
                          <span className="card-index">A</span>
                          <span className="card-title">Original photograph</span>
                        </div>
                        <span className="card-tag">INPUT</span>
                      </div>
                      <div className="visual-frame">
                        <img src={preview} alt="Original uploaded photograph" />
                      </div>
                      <div className="card-caption">
                        <span>RGB IMAGE</span>
                        <span>{result.width} × {result.height}</span>
                      </div>
                    </article>

                    <article className="image-card">
                      <div className="card-head">
                        <div>
                          <span className="card-index index-warm">B</span>
                          <span className="card-title">Relative depth</span>
                        </div>
                        <span className="card-tag color-tag">DEPTH MAP</span>
                      </div>
                      <div
                        className="visual-frame depth-frame"
                        onClick={inspectPoint}
                        onKeyDown={(e) => e.key === 'Enter' && inspectPoint(e)}
                        role="button"
                        tabIndex={0}
                        aria-label="Click a location in the depth map to inspect it"
                      >
                        <img
                          src={activeDepthColor}
                          alt="Colorized depth map"
                          onLoad={() => loadMap(`data:image/png;base64,${result.depth}`)}
                        />
                        {point && <span className="point-marker" style={{ left: `${point.x}%`, top: `${point.y}%` }}><i /></span>}
                        <span className="click-hint"><MousePointer2 size={12} /> CLICK TO INSPECT</span>
                      </div>
                      <div className="depth-legend">
                        <div
                          className="legend-ramp"
                          style={{ background: COLORMAP_GRADIENTS[colormap] || COLORMAP_GRADIENTS.turbo }}
                        />
                        <div className="legend-labels">
                          <span>FARTHER</span>
                          <span>NEARER</span>
                        </div>
                      </div>
                    </article>
                  </>
                )}
              </div>
            )}

            <canvas ref={depthCanvasRef} className="hidden-canvas" />

            {/* Depth Story Section */}
            {story ? (
              <div className="story-panel">
                <div className="story-intro">
                  <div>
                    <span className="insight-label">A WALK THROUGH YOUR PHOTO</span>
                    <p>From what sits closest to what recedes into the distance.</p>
                  </div>
                  <span className="story-time">BLIP · {(story.elapsedMs / 1000).toFixed(1)}S</span>
                </div>
                <div className="story-layers">
                  {story.layers.map((layer) => (
                    <article className={`story-layer layer-${layer.key}`} key={layer.key}>
                      <div className="story-layer-head">
                        <i />
                        <span>{layer.title}</span>
                        <b>{layer.share}%</b>
                      </div>
                      <p>{layer.caption}{!/[.!?]$/.test(layer.caption) ? '.' : ''}</p>
                    </article>
                  ))}
                </div>
                <div className="story-footnote">
                  AI-GENERATED REGIONAL CAPTIONS · DEPTH IS RELATIVE, NOT A DISTANCE MEASUREMENT
                </div>
              </div>
            ) : (
              <>
                <div className="insight-row">
                  <div className={`insight-card ${point ? 'insight-active' : ''}`}>
                    <div className="insight-icon"><MousePointer2 size={17} /></div>
                    <div className="insight-copy">
                      <span className="insight-label">POINT INSPECTOR</span>
                      {point ? (
                        <strong>
                          {point.value > 0.67 ? 'Closer' : point.value < 0.33 ? 'Farther' : 'Mid-range'}
                          <small> · {Math.round(point.value * 100)}% relative depth</small>
                        </strong>
                      ) : (
                        <strong>Click anywhere on the map <small>to read a point</small></strong>
                      )}
                    </div>
                    {point && <span className="point-coords">{point.x}% · {point.y}%</span>}
                  </div>

                  <div className="histogram-card">
                    <div className="histogram-heading">
                      <span className="insight-label">DEPTH DISTRIBUTION</span>
                      <span className="histogram-value">{result.model}</span>
                    </div>
                    <div className="histogram-bars" role="img" aria-label="Histogram showing pixel count per relative depth">
                      {histogram.map((count, index) => (
                        <span
                          key={index}
                          style={{
                            height: `${Math.max(6, (count / Math.max(...histogram, 1)) * 100)}%`,
                            backgroundColor: getColorForValue(index / 15, colormap),
                          }}
                        />
                      ))}
                    </div>
                    <div className="histogram-labels">
                      <span>FARTHER</span>
                      <span>NEARER</span>
                    </div>
                  </div>
                </div>

                <div className="disclaimer">
                  <Sparkles size={15} />
                  <p>
                    <strong>A helpful approximation, not a measurement.</strong> Depth is estimated relative to this image only. Reflective surfaces, fine details, and areas with little texture can be harder for the model to read.
                  </p>
                  <button
                    className="benchmark-inline-link"
                    onClick={() => setShowBenchmark(true)}
                  >
                    VIEW NYU V2 BENCHMARK RESULTS <ArrowUpRight size={14} />
                  </button>
                </div>
              </>
            )}

            {storyError && <div className="error-message story-error"><span>!</span>{storyError}</div>}
          </section>
        )}

        <footer className="footer">
          <span>SEEING DEPTH <i>©</i> 2026</span>
          <span>POWERED BY DEPTH ANYTHING V2 <span className="footer-sep">·</span> BUILT FOR CURIOSITY</span>
        </footer>
      </main>
    </div>
  )
}

export default App
