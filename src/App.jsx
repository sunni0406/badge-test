import { useState, useRef, useCallback, useEffect } from 'react'
import JSZip from 'jszip'
import { parseCSV } from './csvParser'
import BadgeCanvas from './BadgeCanvas'
import './App.css'

export default function App() {
  const [guests, setGuests]   = useState([])
  const [photos, setPhotos]   = useState({})   // filename → objectURL
  const [csvName, setCsvName] = useState('')

  // Batch generation
  const [generating, setGenerating] = useState(false)
  const [batchGuest, setBatchGuest] = useState(null)
  const [progress, setProgress]     = useState({ done: 0, total: 0 })
  const [finished, setFinished]     = useState(false)

  const batchRef      = useRef()
  const zipRef        = useRef(null)
  const batchIdxRef   = useRef(0)
  const guestsRef     = useRef([])
  const photosRef     = useRef({})

  useEffect(() => { guestsRef.current = guests }, [guests])
  useEffect(() => { photosRef.current = photos },  [photos])

  // ── CSV upload ──────────────────────────────────────────────────────
  const handleCSV = useCallback(async e => {
    const file = e.target.files[0]
    if (!file) return
    const text = await file.text()
    setGuests(parseCSV(text))
    setCsvName(file.name)
    setFinished(false)
    e.target.value = ''   // allow re-uploading the same file
  }, [])

  // ── Photo folder upload ─────────────────────────────────────────────
  const photoInputRef = useRef()
  useEffect(() => {
    photoInputRef.current?.setAttribute('webkitdirectory', '')
  }, [])

  const handlePhotos = useCallback(e => {
    const map = {}
    Array.from(e.target.files).forEach(f => {
      map[f.name] = URL.createObjectURL(f)
    })
    setPhotos(map)
    e.target.value = ''   // allow re-uploading the same folder
  }, [])

  // ── Resolve photo URL for a guest ───────────────────────────────────
  const resolvePhoto = useCallback(filename => {
    if (!filename) return null
    return photosRef.current[filename] || null  // null → gray placeholder in canvas
  }, [])

  // ── Batch: export-ready callback ────────────────────────────────────
  const handleExportReady = useCallback(async () => {
    const dataURL = batchRef.current?.exportPNG()
    if (!dataURL) return

    const idx   = batchIdxRef.current
    const guest = guestsRef.current[idx]

    // Sanitise filename (strip diacritics, keep letters/numbers/hyphens)
    const safe = guest.name
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9\s-]/g, '').trim().replace(/\s+/g, '-')
    const filename = `${String(idx + 1).padStart(2, '0')}_${safe}.png`

    zipRef.current.file(filename, dataURL.split(',')[1], { base64: true })

    const next = idx + 1
    batchIdxRef.current = next
    setProgress({ done: next, total: guestsRef.current.length })

    if (next < guestsRef.current.length) {
      const g = guestsRef.current[next]
      setBatchGuest({ ...g, photoUrl: resolvePhoto(g.photo) })
    } else {
      // All done — zip & download
      const blob = await zipRef.current.generateAsync({ type: 'blob' })
      const url  = URL.createObjectURL(blob)
      const a    = Object.assign(document.createElement('a'), {
        href: url, download: 'badges.zip',
      })
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setGenerating(false)
      setFinished(true)
      setBatchGuest(null)
    }
  }, [resolvePhoto])

  // ── Start generation ────────────────────────────────────────────────
  const startGeneration = useCallback(() => {
    if (!guests.length || generating) return
    setGenerating(true)
    setFinished(false)
    setProgress({ done: 0, total: guests.length })
    zipRef.current    = new JSZip()
    batchIdxRef.current = 0

    const g = guests[0]
    setBatchGuest({ ...g, photoUrl: resolvePhoto(g.photo) })
  }, [guests, generating, resolvePhoto])

  // ── Render ───────────────────────────────────────────────────────────
  const photoCount = Object.keys(photos).length

  return (
    <div className="app">
      <h1>NYAFF 2026 Badge Generator</h1>

      {/* Upload row */}
      <div className="upload-row">
        <label className="upload-btn">
          <input type="file" accept=".csv" onChange={handleCSV} hidden />
          <span className="icon">📄</span>
          Upload CSV
          {csvName && <span className="chip">{guests.length} guests</span>}
        </label>

        <label className="upload-btn">
          <input
            ref={photoInputRef}
            type="file"
            multiple
            onChange={handlePhotos}
            hidden
          />
          <span className="icon">🖼</span>
          Upload Photos Folder
          {photoCount > 0 && <span className="chip">{photoCount} files</span>}
        </label>
      </div>

      {/* Guest list */}
      {guests.length > 0 && (
        <div className="guest-list">
          <div className="guest-list-header">
            {guests.length} {guests.length === 1 ? 'guest' : 'guests'}
          </div>
          {guests.map((g, i) => {
            const thumbSrc = photos[g.photo] || null
            return (
              <div key={i} className="guest-row">
                <div className="thumb">
                  {thumbSrc && (
                    <img
                      src={thumbSrc}
                      alt=""
                      onError={e => { e.target.style.display = 'none' }}
                    />
                  )}
                </div>
                <div className="guest-info">
                  <div className="guest-name">{g.name}</div>
                  <div className="guest-role">{g.role || <span style={{color:'#ccc'}}>no role</span>}</div>
                  <div className="guest-film">{g.filmTitle || <span style={{color:'#ccc'}}>no film title</span>}</div>
                </div>
                <div className="guest-idx">#{i + 1}</div>
              </div>
            )
          })}
        </div>
      )}

      {/* Generate button + status */}
      {guests.length > 0 && (
        <div className="generate-area">
          <button
            className="generate-btn"
            onClick={startGeneration}
            disabled={generating}
          >
            {generating
              ? `Generating ${progress.done} / ${progress.total}…`
              : 'Generate All Badges'}
          </button>

          {generating && (
            <div className="progress-bar-wrap">
              <div
                className="progress-bar-fill"
                style={{ width: `${(progress.done / progress.total) * 100}%` }}
              />
            </div>
          )}

          {finished && (
            <div className="done-msg">
              ✅ Done! Downloaded <strong>badges.zip</strong>
            </div>
          )}
        </div>
      )}

      {/* Hidden off-screen batch canvas */}
      {generating && batchGuest && (
        <div className="batch-hidden">
          <BadgeCanvas
            ref={batchRef}
            name={batchGuest.name}
            role={batchGuest.role}
            filmTitle={batchGuest.filmTitle}
            photo={batchGuest.photoUrl}
            onExportReady={handleExportReady}
          />
        </div>
      )}
    </div>
  )
}
