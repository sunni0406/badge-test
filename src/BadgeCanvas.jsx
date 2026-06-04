import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { Stage, Layer, Image as KonvaImage, Text, Rect, Group } from 'react-konva'

// ─── Canvas ──────────────────────────────────────────────────────────
const W = 1227
const H = 1695
const BG_H = 848
const LOWER_Y = BG_H
const LOWER_H = H - BG_H   // 847
const PIXEL_RATIO = 3

// ─── Horizontal layout (derived right-to-left from Figma values) ─────
// Right margin: 118 | Text width: 516 | Photo: 355 | Gap year→photo: 77
const TEXT_X    = W - 118 - 516   // 593
const TEXT_W    = 516
const PHOTO_X   = TEXT_X - 40 - 355  // 198  (40px gap photo→text)
const PHOTO_SIZE   = 355
const PHOTO_RADIUS = 15
const YEAR_X    = PHOTO_X - 77 - 75  // 46   (77px gap, 75px col width)
const YEAR_W    = 75
const YEAR_SPACING = 112             // px between char top positions @ 92px font

// ─── Typography (exact Figma values) ────────────────────────────────
const YEAR_FONT  = 92
const NAME_FONT  = 77
const NAME_LH    = 90   // line-height px  → ratio = NAME_LH / NAME_FONT
const ROLE_FONT  = 60
const ROLE_LH    = 72
const FILM_FONT  = 60
const FILM_LH    = 72
const TEXT_GAP   = 20   // px between name/role/film blocks

const BRAND_RED  = '#B20419'

// ─── Font loading (singleton — loads once per page) ─────────────────
const FONT_DEFS = [
  { family: 'UNicod Sans Bold',      file: 'UNicod%20Sans%20Condensed%20Bold.ttf' },
  { family: 'UNicod Sans',           file: 'UNicod%20Sans.ttf' },
  { family: 'UNicod Sans Condensed', file: 'UNicod%20Sans%20Condensed.ttf' },
]

let _fontsPromise = null
function ensureFonts() {
  if (!_fontsPromise) {
    _fontsPromise = Promise.all(
      FONT_DEFS.map(({ family, file }) =>
        new FontFace(family, `url(/assets/fonts/${file})`).load()
          .then(f => { document.fonts.add(f); return f })
      )
    )
  }
  return _fontsPromise
}

// ─── Helpers ─────────────────────────────────────────────────────────
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload  = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

// Measure word-wrapped line count using Canvas 2D (fonts must be loaded first)
function countLines(text, fontStr, maxW) {
  const ctx = document.createElement('canvas').getContext('2d')
  ctx.font = fontStr
  let lines = 1
  let cur = ''
  for (const word of text.split(' ')) {
    const test = cur ? `${cur} ${word}` : word
    if (ctx.measureText(test).width > maxW && cur) {
      lines++
      cur = word
    } else {
      cur = test
    }
  }
  return lines
}

// Centre-crop image to square
function squareCrop(img) {
  const size = Math.min(img.naturalWidth, img.naturalHeight)
  return {
    cropX:      (img.naturalWidth  - size) / 2,
    cropY:      (img.naturalHeight - size) / 2,
    cropWidth:  size,
    cropHeight: size,
  }
}

function roundedRectClip(ctx, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(r, 0)
  ctx.lineTo(w - r, 0)
  ctx.quadraticCurveTo(w, 0, w, r)
  ctx.lineTo(w, h - r)
  ctx.quadraticCurveTo(w, h, w - r, h)
  ctx.lineTo(r, h)
  ctx.quadraticCurveTo(0, h, 0, h - r)
  ctx.lineTo(0, r)
  ctx.quadraticCurveTo(0, 0, r, 0)
  ctx.closePath()
}

// ─── Component ───────────────────────────────────────────────────────
const BadgeCanvas = forwardRef(function BadgeCanvas(
  {
    name      = 'Guest Name',
    role      = 'Director',
    filmTitle = 'Film Title',
    photo     = null,
  },
  ref
) {
  const stageRef = useRef()
  const [ready, setReady]             = useState(false)
  const [bgImage, setBgImage]         = useState(null)
  const [photoImage, setPhotoImage]   = useState(null)

  // Await all fonts + background before showing Stage
  useEffect(() => {
    let alive = true
    async function init() {
      await ensureFonts()
      try {
        const img = await loadImage('/assets/images/bg%20placeholder.png')
        if (alive) setBgImage(img)
      } catch {
        // missing background — canvas still renders
      }
      if (alive) setReady(true)
    }
    init()
    return () => { alive = false }
  }, [])

  // Reload photo when prop changes
  useEffect(() => {
    if (!photo) { setPhotoImage(null); return }
    let alive = true
    loadImage(photo)
      .then(img => { if (alive) setPhotoImage(img) })
      .catch(() => {})
    return () => { alive = false }
  }, [photo])

  // ── Derived vertical layout (runs only after fonts are ready) ──────
  const nameLines   = ready ? countLines(name, `normal ${NAME_FONT}px "UNicod Sans Bold"`, TEXT_W) : 1
  const nameBlockH  = nameLines * NAME_LH
  const textBlockH  = nameBlockH + TEXT_GAP + ROLE_LH + TEXT_GAP + FILM_LH

  // All three columns centred independently around the lower-area midline
  const midY        = LOWER_Y + LOWER_H / 2

  const textY       = Math.round(midY - textBlockH / 2)
  const photoY      = Math.round(midY - PHOTO_SIZE / 2)
  const yearTotalH  = 3 * YEAR_SPACING + YEAR_FONT
  const yearStartY  = Math.round(midY - yearTotalH / 2)

  const photoClipFn = useCallback(
    ctx => roundedRectClip(ctx, PHOTO_SIZE, PHOTO_SIZE, PHOTO_RADIUS),
    []
  )

  // ── Export API ────────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    exportPNG: () =>
      stageRef.current?.toDataURL({ pixelRatio: PIXEL_RATIO, mimeType: 'image/png' }),
  }), [])

  // ── Loading state — Stage is not mounted until fonts are ready ────
  if (!ready) {
    return (
      <div style={{
        width: W, height: H,
        background: '#f5f5f5',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 28, color: '#999',
      }}>
        Loading fonts…
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────
  return (
    <Stage ref={stageRef} width={W} height={H}>
      <Layer>

        {/* Upper background */}
        {bgImage && (
          <KonvaImage image={bgImage} x={0} y={0} width={W} height={BG_H} />
        )}

        {/* Lower white panel */}
        <Rect x={0} y={LOWER_Y} width={W} height={LOWER_H} fill="white" />

        {/* "2026" — vertical, left column, centred */}
        {['2', '0', '2', '6'].map((ch, i) => (
          <Text
            key={i}
            x={YEAR_X}
            y={yearStartY + i * YEAR_SPACING}
            text={ch}
            fontSize={YEAR_FONT}
            fontFamily="UNicod Sans"
            fontStyle="normal"
            fill="#000000"
            width={YEAR_W}
            align="center"
          />
        ))}

        {/* Profile photo — square-cropped, rounded 15px */}
        {photoImage ? (
          <Group x={PHOTO_X} y={photoY} clipFunc={photoClipFn}>
            <KonvaImage
              image={photoImage}
              x={0} y={0}
              width={PHOTO_SIZE} height={PHOTO_SIZE}
              {...squareCrop(photoImage)}
            />
          </Group>
        ) : (
          <Rect
            x={PHOTO_X} y={photoY}
            width={PHOTO_SIZE} height={PHOTO_SIZE}
            fill="#d0d0d0"
            cornerRadius={PHOTO_RADIUS}
          />
        )}

        {/* Name — 77px, UNicod Sans Bold, #000000, wraps up to 2 lines */}
        <Text
          x={TEXT_X} y={textY}
          text={name}
          fontSize={NAME_FONT}
          fontFamily="UNicod Sans Bold"
          fontStyle="normal"
          fill="#000000"
          width={TEXT_W}
          wrap="word"
          lineHeight={NAME_LH / NAME_FONT}
        />

        {/* Role — 60px, UNicod Sans, #B20419 */}
        <Text
          x={TEXT_X} y={textY + nameBlockH + TEXT_GAP}
          text={role}
          fontSize={ROLE_FONT}
          fontFamily="UNicod Sans"
          fontStyle="normal"
          fill={BRAND_RED}
          width={TEXT_W}
          wrap="word"
          lineHeight={ROLE_LH / ROLE_FONT}
        />

        {/* Film title — 60px, UNicod Sans Condensed, italic, #B20419 */}
        <Text
          x={TEXT_X} y={textY + nameBlockH + TEXT_GAP + ROLE_LH + TEXT_GAP}
          text={filmTitle}
          fontSize={FILM_FONT}
          fontFamily="UNicod Sans Condensed"
          fontStyle="italic"
          fill={BRAND_RED}
          width={TEXT_W}
          wrap="word"
          lineHeight={FILM_LH / FILM_FONT}
        />

      </Layer>
    </Stage>
  )
})

export default BadgeCanvas
