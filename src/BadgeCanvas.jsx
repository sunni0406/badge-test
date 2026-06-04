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
// Stage dimensions match bgImage.naturalWidth/Height exactly (no scaling).
// Dynamic content lives in the bottom CONTENT_H pixels, transparent over the bg.
const PIXEL_RATIO = 3
const CONTENT_H   = 469   // px — fixed height of the dynamic content band

// ─── Horizontal layout (Figma values for 1227px canvas width) ────────
// Right margin: 118 | Text width: 516 | Photo: 355 | Gap year→photo: 77
const TEXT_W       = 516
const TEXT_X       = 1227 - 118 - TEXT_W      // 593
const PHOTO_SIZE   = 355
const PHOTO_RADIUS = 15
const PHOTO_X      = TEXT_X - 40 - PHOTO_SIZE // 198  (40px gap photo→text)
const YEAR_W       = 75
const YEAR_X       = PHOTO_X - 20 - YEAR_W    // 103  (20px gap, 75px col width)
const YEAR_SPACING = 88                        // tight spacing @ 92px font

// ─── Typography (exact Figma values) ────────────────────────────────
const YEAR_FONT  = 92
const NAME_FONT  = 77
const NAME_LH    = 90   // line-height px  → ratio = NAME_LH / NAME_FONT
const ROLE_FONT  = 60
const ROLE_LH    = 72
const FILM_FONT  = 60
const FILM_LH    = 72
const GAP_NAME_ROLE = 40  // px between name and role
const GAP_ROLE_FILM = 10  // px between role and film title (tight)

const BRAND_RED  = '#B20419'

// ─── Font loading (singleton — loads once per page) ─────────────────
const FONT_DEFS = [
  { family: 'UNicod Sans Bold',      file: 'UNicod%20Sans%20Condensed%20Bold.ttf' },
  { family: 'UNicod Sans',           file: 'UNicod%20Sans.ttf' },
  { family: 'UNicod Sans Medium',    file: 'UNicod%20Sans%20Medium.ttf' },
  { family: 'UNicod Sans Condensed',      file: 'UNicod%20Sans%20Condensed.ttf' },
  { family: 'UNicod Sans Medium Italic',  file: 'UNicod%20Sans%20Medium%20Italic.ttf' },
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

  // ── Canvas dimensions from background image ────────────────────────
  const cw         = bgImage?.naturalWidth  ?? 1227
  const ch         = bgImage?.naturalHeight ?? 1695
  // Anchor from bottom: year column (tallest element, 428px) ends 74px from bottom
  const yearTotalH = 3 * YEAR_SPACING + YEAR_FONT  // 374px
  const midY       = ch - 64 - yearTotalH / 2      // year bottom = ch - 64

  // ── Derived vertical layout (runs only after fonts are ready) ──────
  const nameLines   = ready ? countLines(name, `normal ${NAME_FONT}px "UNicod Sans Bold"`, TEXT_W) : 1
  const nameBlockH  = nameLines * NAME_LH
  const textBlockH  = nameBlockH + GAP_NAME_ROLE + ROLE_LH + GAP_ROLE_FILM + FILM_LH

  const textY       = Math.round(midY - textBlockH / 2)
  const photoY      = Math.round(midY - PHOTO_SIZE / 2)
  const yearStartY  = Math.round(midY - yearTotalH / 2) + 15

  const photoClipFn = useCallback(
    ctx => roundedRectClip(ctx, PHOTO_SIZE, PHOTO_SIZE, PHOTO_RADIUS),
    []
  )

  // ── Export API ────────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    exportPNG: () =>
      stageRef.current?.toDataURL({ pixelRatio: PIXEL_RATIO, mimeType: 'image/png' }),
  }), [])

  // ── Loading state — Stage is not mounted until fonts + bg are ready ─
  if (!ready) {
    return (
      <div style={{
        width: 1227, height: 1695,
        background: '#f5f5f5',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 28, color: '#999',
      }}>
        Loading…
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────
  return (
    // Stage size = background image's natural pixel dimensions
    <Stage ref={stageRef} width={cw} height={ch}>
      <Layer>

        {/* Background — rendered at natural size, no scaling */}
        {bgImage && (
          <KonvaImage
            image={bgImage}
            x={0} y={0}
            width={bgImage.naturalWidth}
            height={bgImage.naturalHeight}
          />
        )}

        {/* "2026" — vertical, left column, centred in bottom 469px */}
        {['2', '0', '2', '6'].map((digit, i) => (
          <Text
            key={i}
            x={YEAR_X}
            y={yearStartY + i * YEAR_SPACING}
            text={digit}
            fontSize={YEAR_FONT}
            fontFamily="UNicod Sans Bold"
            fontStyle="normal"
            fill="#AAAAAA"
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
            fill={null}
            stroke="#aaaaaa"
            strokeWidth={2}
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
          align="left"
          wrap="word"
          lineHeight={NAME_LH / NAME_FONT}
        />

        {/* Role — 60px, UNicod Sans, #B20419 */}
        <Text
          x={TEXT_X} y={textY + nameBlockH + GAP_NAME_ROLE}
          text={role}
          fontSize={ROLE_FONT}
          fontFamily="UNicod Sans Medium"
          fontStyle="normal"
          fill={BRAND_RED}
          width={TEXT_W}
          align="left"
          wrap="word"
          lineHeight={ROLE_LH / ROLE_FONT}
        />

        {/* Film title — 60px, UNicod Sans Condensed, italic, #B20419 */}
        <Text
          x={TEXT_X} y={textY + nameBlockH + GAP_NAME_ROLE + ROLE_LH + GAP_ROLE_FILM}
          text={filmTitle}
          fontSize={FILM_FONT}
          fontFamily="UNicod Sans Medium Italic"
          fontStyle="normal"
          fill={BRAND_RED}
          width={TEXT_W}
          align="left"
          wrap="word"
          lineHeight={FILM_LH / FILM_FONT}
        />

      </Layer>
    </Stage>
  )
})

export default BadgeCanvas
