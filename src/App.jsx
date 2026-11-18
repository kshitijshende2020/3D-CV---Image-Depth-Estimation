import { useRef, useState } from 'react'
import { Aperture, ArrowUpRight, Check, CircleHelp, ImagePlus, LoaderCircle, MousePointer2, Sparkles, X } from 'lucide-react'

const API_URL = '/api/estimate'

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
    } catch (e) {
      setError(e.message || 'Could not reach the depth service. Check that the API is running.')
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

  const loadMap = (image) => {
    const canvas = depthCanvasRef.current
    if (!canvas || !image) return
    const context = canvas.getContext('2d', { willReadFrequently: true })
    const bitmap = new Image()
    bitmap.onload = () => {
      canvas.width = bitmap.naturalWidth
      canvas.height = bitmap.naturalHeight
      context.drawImage(bitmap, 0, 0)
    }
    bitmap.src = image
  }

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#top" aria-label="Seeing Depth home"><span className="brand-mark"><Aperture size={18} strokeWidth={1.8} /></span><span>seeing<span className="brand-light">depth</span></span></a>
      <div className="topbar-right"><span className="model-status"><i /> MODEL READY</span><span className="topbar-divider" /><span className="version-label">A VISUAL EXPLORATION</span></div>
    </header>

    <main id="top">
      <section className={`upload-section ${result ? 'has-result' : ''}`}>
        <div className="section-heading"><div><div className="section-kicker">IMAGE INPUT</div><h2>Upload a photo</h2></div><div className="step-label"><span>JPG · PNG · WEBP</span></div></div>
        <div className={`upload-box ${dragging ? 'is-dragging' : ''} ${file ? 'has-file' : ''}`} onDragOver={(e) => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files[0]) }}>
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => pickFile(e.target.files[0])} />
          {preview ? <div className="file-preview"><img src={preview} alt="Selected photo preview" /><div className="file-overlay"><div className="file-name"><Check size={14} />{file.name}</div><button className="icon-button" onClick={() => { setFile(null); setResult(null); setPreview(''); setPoint(null); setStory(null); setStoryError(''); if (inputRef.current) inputRef.current.value = '' }} aria-label="Remove image"><X size={16} /></button></div></div> : <><div className="upload-icon"><ImagePlus size={22} strokeWidth={1.6} /></div><div className="upload-copy"><strong>Drop your image here</strong><span>or <button className="text-button" onClick={() => inputRef.current?.click()}>browse files</button> from your device</span></div><span className="file-types">JPG · PNG · WEBP <i /> MAX 15 MB</span></>}
        </div>
        <div className="upload-actions"><span className="privacy-note"><CircleHelp size={14} /> Your image stays on your machine</span><button className="analyze-button" disabled={!file || loading} onClick={estimate}>{loading ? <><LoaderCircle className="spin" size={16} /> Reading the scene…</> : <><Sparkles size={15} /> {result ? 'Re-analyze image' : 'Reveal depth'} <ArrowUpRight size={15} /></>}</button></div>
        {error && <div className="error-message"><span>!</span>{error}</div>}
      </section>

      {result && <section className="results" aria-live="polite">
        <div className="results-heading"><div className="result-meta"><span><i className="meta-live" /> ANALYSIS COMPLETE</span><span>{result.width} × {result.height} PX</span></div><div className="story-action"><button className="story-button" title="First use downloads the optional BLIP caption model (about 990 MB)." onClick={story ? () => setStory(null) : buildStory} disabled={storyLoading}>{storyLoading ? <><LoaderCircle className="spin" size={13} /> Finding the layers…</> : story ? 'Hide story' : <><Sparkles size={13} /> Tell the depth story</>}</button>{!story && <small>Optional model · ~990 MB first use</small>}</div></div>
        <div className="image-grid">
          <article className="image-card"><div className="card-head"><div><span className="card-index">A</span><span className="card-title">Original photograph</span></div><span className="card-tag">INPUT</span></div><div className="visual-frame"><img src={preview} alt="Original uploaded photograph" /></div><div className="card-caption"><span>RGB IMAGE</span><span>{result.width} × {result.height}</span></div></article>
          <article className="image-card"><div className="card-head"><div><span className="card-index index-warm">B</span><span className="card-title">Relative depth</span></div><span className="card-tag color-tag">DEPTH MAP</span></div><div className="visual-frame depth-frame" onClick={inspectPoint} onKeyDown={(e) => e.key === 'Enter' && inspectPoint(e)} role="button" tabIndex={0} aria-label="Click a location in the depth map to inspect it"><img src={`data:image/png;base64,${result.color}`} alt="Colorized depth map. Cool colors are farther; warm colors are nearer." onLoad={(e) => loadMap(e.currentTarget.src)} />{point && <span className="point-marker" style={{ left: `${point.x}%`, top: `${point.y}%` }}><i /></span>}<span className="click-hint"><MousePointer2 size={12} /> CLICK TO INSPECT</span></div><div className="depth-legend"><div className="legend-ramp" /><div className="legend-labels"><span>FARTHER</span><span>NEARER</span></div></div></article>
        </div>
        <canvas ref={depthCanvasRef} className="hidden-canvas" />
        {story ? <div className="story-panel"><div className="story-intro"><div><span className="insight-label">A WALK THROUGH YOUR PHOTO</span><p>From what sits closest to what recedes into the distance.</p></div><span className="story-time">BLIP · {(story.elapsedMs / 1000).toFixed(1)}S</span></div><div className="story-layers">{story.layers.map((layer) => <article className={`story-layer layer-${layer.key}`} key={layer.key}><div className="story-layer-head"><i /><span>{layer.title}</span><b>{layer.share}%</b></div><p>{layer.caption}{!/[.!?]$/.test(layer.caption) ? '.' : ''}</p></article>)}</div><div className="story-footnote">AI-GENERATED REGIONAL CAPTIONS · DEPTH IS RELATIVE, NOT A DISTANCE MEASUREMENT</div></div> : <><div className="insight-row"><div className={`insight-card ${point ? 'insight-active' : ''}`}><div className="insight-icon"><MousePointer2 size={17} /></div><div className="insight-copy"><span className="insight-label">POINT INSPECTOR</span>{point ? <strong>{point.value > .67 ? 'Closer' : point.value < .33 ? 'Farther' : 'Mid-range'} <small>· {Math.round(point.value * 100)}% relative depth</small></strong> : <strong>Click anywhere on the map <small>to read a point</small></strong>}</div>{point && <span className="point-coords">{point.x}% · {point.y}%</span>}</div><div className="insight-card model-card"><div className="insight-icon"><Aperture size={17} /></div><div className="insight-copy"><span className="insight-label">MODEL & PROCESSING</span><strong>{result.model} <small>· {(result.inferenceMs / 1000).toFixed(1)}s</small></strong></div><span className="model-badge">AI</span></div></div>
        <div className="disclaimer"><Sparkles size={15} /><p><strong>A helpful approximation, not a measurement.</strong> Depth is estimated relative to this image only. Reflective surfaces, fine details, and areas with little texture can be harder for the model to read.</p><span>ABOUT THE MODEL <ArrowUpRight size={13} /></span></div></>}
        {storyError && <div className="error-message story-error"><span>!</span>{storyError}</div>}
      </section>}

      <footer className="footer"><span>SEEING DEPTH <i>©</i> 2026</span><span>POWERED BY DEPTH ANYTHING V2 <span className="footer-sep">·</span> BUILT FOR CURIOSITY</span></footer>
    </main>
  </div>
}

export default App
