// Scientific and perceptual colormaps for depth visualization

const STOPS = {
  turbo: [
    [37, 52, 148],
    [0, 166, 218],
    [55, 177, 126],
    [255, 209, 102],
    [247, 127, 0],
    [214, 40, 40],
  ],
  inferno: [
    [0, 0, 4],
    [40, 11, 84],
    [101, 21, 110],
    [159, 42, 99],
    [212, 72, 66],
    [245, 125, 21],
    [250, 193, 39],
    [252, 255, 164],
  ],
  viridis: [
    [68, 1, 84],
    [71, 44, 122],
    [59, 81, 139],
    [44, 113, 142],
    [33, 144, 141],
    [39, 173, 129],
    [92, 200, 99],
    [253, 231, 37],
  ],
  plasma: [
    [13, 8, 135],
    [75, 3, 161],
    [126, 3, 168],
    [172, 40, 145],
    [204, 71, 120],
    [229, 107, 93],
    [248, 149, 64],
    [240, 249, 33],
  ],
  grayscale: [
    [0, 0, 0],
    [255, 255, 255],
  ],
}

// Pre-compute 256-entry Look-Up Tables (LUTs) for instant 0ms coloring
const LUTS = {}
for (const [name, stops] of Object.entries(STOPS)) {
  const lut = new Uint8Array(256 * 3)
  const numStops = stops.length
  for (let i = 0; i < 256; i++) {
    const t = i / 255
    const pos = t * (numStops - 1)
    const idx = Math.min(Math.floor(pos), numStops - 2)
    const factor = pos - idx
    const c0 = stops[idx]
    const c1 = stops[idx + 1]
    lut[i * 3 + 0] = Math.round(c0[0] + (c1[0] - c0[0]) * factor)
    lut[i * 3 + 1] = Math.round(c0[1] + (c1[1] - c0[1]) * factor)
    lut[i * 3 + 2] = Math.round(c0[2] + (c1[2] - c0[2]) * factor)
  }
  LUTS[name] = lut
}

export const COLORMAP_NAMES = [
  { id: 'turbo', label: 'Turbo (Heat)' },
  { id: 'inferno', label: 'Inferno' },
  { id: 'viridis', label: 'Viridis' },
  { id: 'plasma', label: 'Plasma' },
  { id: 'grayscale', label: 'Grayscale' },
]

export const COLORMAP_GRADIENTS = {
  turbo: 'linear-gradient(90deg, #253494 0%, #00a6da 22%, #37b17e 45%, #ffd166 68%, #f77f00 83%, #d62828 100%)',
  inferno: 'linear-gradient(90deg, #000004 0%, #280b54 18%, #65156e 36%, #9f2a63 54%, #d44842 72%, #f57d15 85%, #fac127 94%, #fcffa4 100%)',
  viridis: 'linear-gradient(90deg, #440154 0%, #472c7a 15%, #3b518b 30%, #2c718e 45%, #21908d 60%, #27ad81 75%, #5cc863 90%, #fde725 100%)',
  plasma: 'linear-gradient(90deg, #0d0887 0%, #4b03a1 16%, #7e03a8 32%, #ac2891 48%, #cc4778 64%, #e56b5d 80%, #f89540 92%, #f0f921 100%)',
  grayscale: 'linear-gradient(90deg, #050708 0%, #ffffff 100%)',
}

/**
 * Colorizes a grayscale depth canvas or ImageData into a colored PNG Data URL
 */
export function applyColormapToCanvas(grayscaleCanvas, colormapName = 'turbo') {
  if (!grayscaleCanvas || grayscaleCanvas.width === 0 || grayscaleCanvas.height === 0) return null
  const { width, height } = grayscaleCanvas
  const srcCtx = grayscaleCanvas.getContext('2d', { willReadFrequently: true })
  const srcData = srcCtx.getImageData(0, 0, width, height)
  const pixels = srcData.data
  const lut = LUTS[colormapName] || LUTS.turbo

  const outCanvas = document.createElement('canvas')
  outCanvas.width = width
  outCanvas.height = height
  const outCtx = outCanvas.getContext('2d')
  const outData = outCtx.createImageData(width, height)
  const outPixels = outData.data

  for (let i = 0; i < pixels.length; i += 4) {
    const gray = pixels[i] // R channel has grayscale depth
    const lutIdx = gray * 3
    outPixels[i + 0] = lut[lutIdx + 0]
    outPixels[i + 1] = lut[lutIdx + 1]
    outPixels[i + 2] = lut[lutIdx + 2]
    outPixels[i + 3] = 255
  }

  outCtx.putImageData(outData, 0, 0)
  return outCanvas.toDataURL('image/png')
}

export function getColorForValue(normalizedValue, colormapName = 'turbo') {
  const lut = LUTS[colormapName] || LUTS.turbo
  const idx = Math.max(0, Math.min(255, Math.round(normalizedValue * 255))) * 3
  return `rgb(${lut[idx]}, ${lut[idx + 1]}, ${lut[idx + 2]})`
}
