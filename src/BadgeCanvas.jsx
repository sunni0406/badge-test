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

// ─── Typography ──────────────────────────────────────────────────────
const YEAR_FONT  = 92
const ROLE_FONT  = 60
const ROLE_LH    = 72
const GAP_ROLE_FILM = 10  // role → film title gap (tight)

// Name: fixed 77px; only drop to 60px if 2 lines still can't fit
function getNameFontSize(name) {
  return countLines(name, `normal 77px "UNicod Sans Bold"`, TEXT_W) <= 2 ? 77 : 60
}

// Film title: step down until it fits on one line (60 → 48 → 36)
function getFilmFontSize(filmTitle) {
  for (const size of [60, 48, 36]) {
    if (countLines(filmTitle, `normal ${size}px "UNicod Sans Medium Italic"`, TEXT_W) <= 1) {
      return size
    }
  }
  return 36
}

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

// Cache bg images by URL so switching badge types doesn't re-fetch
const _bgCache = {}
function loadBg(url) {
  if (!_bgCache[url]) _bgCache[url] = loadImage(url)
  return _bgCache[url]
}

// Break text into lines splitting ONLY on spaces.
// Hyphenated words (e.g. "Kore-eda") are treated as a single atomic unit.
function wrapLines(text, fontStr, maxW) {
  const ctx = document.createElement('canvas').getContext('2d')
  ctx.font = fontStr
  const words = text.split(' ')
  const lines = []
  let cur = ''
  for (const word of words) {
    const test = cur ? `${cur} ${word}` : word
    if (cur && ctx.measureText(test).width > maxW) {
      lines.push(cur)
      cur = word
    } else {
      cur = test
    }
  }
  if (cur) lines.push(cur)
  return lines.length ? lines : ['']
}

function countLines(text, fontStr, maxW) {
  return wrapLines(text, fontStr, maxW).length
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
    name           = 'Guest Name',
    role           = 'Director',
    filmTitle      = 'Film Title',
    photo          = null,
    badgeType      = 'guest',  // 'vip' → VIP bg, anything else → guest bg
    onExportReady  = null,
  },
  ref
) {
  const stageRef = useRef()
  const [ready, setReady]               = useState(false)
  const [bgImage, setBgImage]           = useState(null)
  const [photoImage, setPhotoImage]     = useState(null)
  const [loadedPhotoUrl, setLoadedPhotoUrl] = useState(null)

  // Stable ref so the effect below never stale-closes over onExportReady
  const onExportReadyRef = useRef(onExportReady)
  useEffect(() => { onExportReadyRef.current = onExportReady }, [onExportReady])

  // Guard: fire onExportReady exactly once per (photo, badgeType) combination
  const exportFiredRef = useRef(false)
  useEffect(() => { exportFiredRef.current = false }, [photo, badgeType])

  // Load fonts (once) + background (per badgeType, cached)
  const bgUrl = badgeType?.toLowerCase() === 'vip'
    ? '/assets/images/2026%20VIP%20BADGE.png'
    : '/assets/images/2026%20GUEST%20BADGE.png'

  useEffect(() => {
    let alive = true
    setReady(false)
    async function init() {
      await ensureFonts()
      try {
        const img = await loadBg(bgUrl)
        if (alive) setBgImage(img)
      } catch {
        // missing background — canvas still renders without it
      }
      if (alive) setReady(true)
    }
    init()
    return () => { alive = false }
  }, [bgUrl])

  // Reload photo when prop changes.
  // We also track loadedPhotoUrl so the export-ready check can verify
  // that the image currently painted matches the current photo prop —
  // without this, the check fires with a stale image from the previous guest.
  useEffect(() => {
    if (!photo) {
      setPhotoImage(null)
      setLoadedPhotoUrl(null)
      return
    }
    let alive = true
    setPhotoImage(null)       // clear old image immediately
    setLoadedPhotoUrl(null)   // mark as "not yet loaded"
    loadImage(photo)
      .then(img => {
        if (alive) {
          setPhotoImage(img)
          setLoadedPhotoUrl(photo)  // confirm which URL is now painted
        }
      })
      .catch(() => {
        if (alive) setLoadedPhotoUrl(photo)  // error → use placeholder, still proceed
      })
    return () => { alive = false }
  }, [photo])

  // Fire onExportReady when stage is ready AND the current photo URL has been
  // fully resolved (loaded or errored).  Using loadedPhotoUrl === photo instead
  // of photoImage !== null prevents a false positive when photo prop changes but
  // photoImage still holds the previous guest's image.
  useEffect(() => {
    if (!ready) return
    if (exportFiredRef.current) return
    const photoReady = !photo || loadedPhotoUrl === photo
    if (photoReady) {
      exportFiredRef.current = true
      requestAnimationFrame(() => requestAnimationFrame(() => {
        onExportReadyRef.current?.()
      }))
    }
  }, [ready, loadedPhotoUrl, photo])

  // ── Canvas dimensions from background image ────────────────────────
  const cw         = bgImage?.naturalWidth  ?? 1227
  const ch         = bgImage?.naturalHeight ?? 1695
  // Anchor from bottom: year column (tallest element, 428px) ends 74px from bottom
  const yearTotalH = 3 * YEAR_SPACING + YEAR_FONT  // 374px
  const midY       = ch - 64 - yearTotalH / 2      // year bottom = ch - 64

  // ── Derived vertical layout ────────────────────────────────────────
  // Name — pre-compute space-only line breaks so Konva never sees hyphens as break points
  const nameUpper    = name.toUpperCase()
  const nameFontSize = ready ? getNameFontSize(nameUpper) : 77
  const nameLH       = Math.round(nameFontSize * 1.17)
  const nameWrapped  = ready
    ? wrapLines(nameUpper, `normal ${nameFontSize}px "UNicod Sans Bold"`, TEXT_W).join('\n')
    : nameUpper
  const nameBlockH   = nameWrapped.split('\n').length * nameLH

  // Film title — always 1 line; font size steps down to fit
  const filmFontSize = ready ? getFilmFontSize(filmTitle) : 60
  const filmLH       = Math.round(filmFontSize * 1.17)
  const filmBlockH   = filmLH   // single line, never wraps

  // Photo: vertically centred at midY
  const photoY = Math.round(midY - PHOTO_SIZE / 2)

  // Text: Name top = photo top | Film Title bottom = photo bottom
  const nameY      = photoY
  const filmTitleY = photoY + PHOTO_SIZE - filmBlockH
  const roleY      = filmTitleY - GAP_ROLE_FILM - ROLE_LH  // Role sits above film title

  const yearStartY = Math.round(midY - yearTotalH / 2) + 15

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
            fill="#D0D0D0"
            cornerRadius={PHOTO_RADIUS}
          />
        )}

        {/* Name — line breaks pre-computed (space-only), so Konva won't split on hyphens */}
        <Text
          x={TEXT_X} y={nameY}
          text={nameWrapped}
          fontSize={nameFontSize}
          fontFamily="UNicod Sans Bold"
          fontStyle="normal"
          fill="#000000"
          width={TEXT_W}
          align="left"
          wrap="none"
          lineHeight={nameLH / nameFontSize}
        />

        {/* Role — single line, truncate with ellipsis if too long */}
        <Text
          x={TEXT_X} y={roleY}
          text={role}
          fontSize={ROLE_FONT}
          fontFamily="UNicod Sans Medium"
          fontStyle="normal"
          fill={BRAND_RED}
          width={TEXT_W}
          height={ROLE_LH}
          align="left"
          wrap="none"
          ellipsis={true}
          lineHeight={ROLE_LH / ROLE_FONT}
        />

        {/* Film title — single line, bottom aligns with photo bottom */}
        <Text
          x={TEXT_X} y={filmTitleY}
          text={filmTitle}
          fontSize={filmFontSize}
          fontFamily="UNicod Sans Medium Italic"
          fontStyle="normal"
          fill={BRAND_RED}
          width={TEXT_W}
          align="left"
          wrap="none"
          lineHeight={filmLH / filmFontSize}
        />

      </Layer>
    </Stage>
  )
})

export default BadgeCanvas
