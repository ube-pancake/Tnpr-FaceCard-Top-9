import saved from './framing.json'

// Per-photo framing, keyed by player id. x/y are the face position as a fraction of the
// original photo (0 = left/top, 1 = right/bottom); zoom > 1 crops in; fit shows the whole
// photo over a blurred copy of itself instead of cropping.
export const DEFAULT_FRAME = { x: 0.5, y: 0.3, zoom: 1, fit: false }

export const frames = { ...saved }

export const frameFor = (id) => ({ ...DEFAULT_FRAME, ...frames[id] })

// Where to place a photo of size imgW×imgH inside a box of the given aspect (width / height)
// so the face point is as close to the center as possible without leaving empty edges.
// Returns left/top/width/height as fractions of the box.
export const layoutFor = (frame, imgW, imgH, aspect) => {
  const boxH = 1 / aspect
  if (frame.fit) {
    const scale = Math.min(1 / imgW, boxH / imgH)
    const width = imgW * scale
    const height = imgH * scale
    return { left: (1 - width) / 2, top: (boxH - height) / 2 / boxH, width, height: height / boxH }
  }
  const scale = Math.max(1 / imgW, boxH / imgH) * frame.zoom
  const width = imgW * scale
  const height = imgH * scale
  const clamp = (value, min) => Math.min(0, Math.max(min, value))
  const left = clamp(0.5 - frame.x * width, 1 - width)
  const top = clamp(boxH / 2 - frame.y * height, boxH - height)
  return { left, top: top / boxH, width, height: height / boxH }
}

export const toStyle = ({ left, top, width, height }) => ({
  left: `${left * 100}%`,
  top: `${top * 100}%`,
  width: `${width * 100}%`,
  height: `${height * 100}%`,
})
