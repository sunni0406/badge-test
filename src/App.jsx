import { useState, useRef, useCallback, useEffect } from 'react'
import { jsPDF } from 'jspdf'
import { parseCSV } from './csvParser'
import BadgeCanvas from './BadgeCanvas'
import './App.css'

const TEMPLATE_CSV = `name,role,filmTitle,badgeType,photo\nJohn Smith,Director,Film Title Here,GUEST,john.jpg\nJane Doe,Producer,Another Film,VIP,jane.jpg`

export default function App() {
  const [guests, setGuests]   = useState([])
  const [photos, setPhotos]   = useState({})
  const [csvName, setCsvName] = useState('')

  const [generating, setGenerating] = useState(false)
  const [batchGuest, setBatchGuest] = useState(null)
  const [progress, setProgress]     = useState({ done: 0, total: 0 })
  const [finished, setFinished]     = useState(false)

  const batchRef      = useRef()
  const pdfPagesRef   = useRef([])   // collects dataURLs, one per badge
  const batchIdxRef   = useRef(0)
  const guestsRef   = useRef([])
  const photosRef   = useRef({})

  useEffect(() => { guestsRef.current = guests }, [guests])
  useEffect(() => { photosRef.current = photos },  [photos])

  // ── Template download ───────────────────────────────────────────────
  const downloadTemplate = useCallback(() => {
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = Object.assign(document.createElement('a'), { href: url, download: 'nyaff-badge-template.csv' })
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [])

  // ── CSV upload ──────────────────────────────────────────────────────
  const handleCSV = useCallback(async e => {
    const file = e.target.files[0]
    if (!file) return
    const text = await file.text()
    setGuests(parseCSV(text))
    setCsvName(file.name)
    setFinished(false)
    e.target.value = ''
  }, [])

  // ── Photo folder upload ─────────────────────────────────────────────
  const photoInputRef = useRef()
  useEffect(() => {
    photoInputRef.current?.setAttribute('webkitdirectory', '')
  }, [])

  const handlePhotos = useCallback(e => {
    const map = {}
    Array.from(e.target.files).forEach(f => { map[f.name] = URL.createObjectURL(f) })
    setPhotos(map)
    e.target.value = ''
  }, [])

  // ── Resolve photo URL ───────────────────────────────────────────────
  const resolvePhoto = useCallback(filename => {
    if (!filename) return null
    return photosRef.current[filename] || null
  }, [])

  // ── Batch export callback ───────────────────────────────────────────
  const handleExportReady = useCallback(() => {
    const dataURL = batchRef.current?.exportPNG()
    if (!dataURL) return

    // Collect this badge as a PDF page
    pdfPagesRef.current.push(dataURL)

    const next = batchIdxRef.current + 1
    batchIdxRef.current = next
    setProgress({ done: next, total: guestsRef.current.length })

    if (next < guestsRef.current.length) {
      const g = guestsRef.current[next]
      setBatchGuest({ ...g, photoUrl: resolvePhoto(g.photo) })
    } else {
      // All badges collected — build one PDF, one page per badge (4.09" × 5.65" @ 300dpi)
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'in', format: [4.09, 5.65] })
      pdfPagesRef.current.forEach((url, i) => {
        if (i > 0) pdf.addPage([4.09, 5.65], 'portrait')
        pdf.addImage(url, 'PNG', 0, 0, 4.09, 5.65)
      })
      pdf.save('nyaff-2026-badges.pdf')

      setGenerating(false)
      setFinished(true)
      setBatchGuest(null)
      pdfPagesRef.current = []
    }
  }, [resolvePhoto])

  // ── Start generation ────────────────────────────────────────────────
  const startGeneration = useCallback(() => {
    if (!guests.length || generating) return
    setGenerating(true)
    setFinished(false)
    setProgress({ done: 0, total: guests.length })
    pdfPagesRef.current = []
    batchIdxRef.current = 0
    const g = guests[0]
    setBatchGuest({ ...g, photoUrl: resolvePhoto(g.photo) })
  }, [guests, generating, resolvePhoto])

  // ── Stats ───────────────────────────────────────────────────────────
  const photoCount   = Object.keys(photos).length
  const hasPhotos    = photoCount > 0
  const photoGuests  = guests.filter(g => g.photo)
  const matchedCount = hasPhotos ? photoGuests.filter(g =>  photos[g.photo]).length : 0
  const missingCount = hasPhotos ? photoGuests.filter(g => !photos[g.photo]).length : 0

  const statusCell = g => {
    if (!g.photo)       return <span className="status-na">—</span>
    if (!hasPhotos)     return <span className="status-na">—</span>
    if (photos[g.photo]) return <span className="status-found">✓ Found</span>
    return <span className="status-missing">✗ Missing</span>
  }

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div className="app">
      <div className="brand-line" />

      {/* Header */}
      <header className="app-header">
        <h1 className="app-title">NYAFF 2026 Guest &amp; VIP Badge Generator</h1>
        <p className="app-subtitle">Generate print-ready guest badges in seconds</p>

        <div className="steps">
          <div className="step">
            <span className="step-num">1</span>
            <div className="step-text">
              <strong>Download CSV template</strong>
              <span>Fill in guest info</span>
            </div>
          </div>
          <div className="step-arrow">→</div>
          <div className="step">
            <span className="step-num">2</span>
            <div className="step-text">
              <strong>Upload CSV + photo folder</strong>
              <span>Match filenames to CSV</span>
            </div>
          </div>
          <div className="step-arrow">→</div>
          <div className="step">
            <span className="step-num">3</span>
            <div className="step-text">
              <strong>Generate &amp; download</strong>
              <span>All badges as one PDF</span>
            </div>
          </div>
        </div>
      </header>

      {/* Template download */}
      <section className="card">
        <div className="template-row">
          <button className="btn-primary" onClick={downloadTemplate}>
            ↓ Download CSV Template
          </button>
          <div className="naming-rules">
            <div className="naming-rules-title">Photo Naming Rules</div>
            <ul>
              <li>Photo filename must match <em>exactly</em> what's in the CSV "photo" column</li>
              <li>Supported formats: .jpg, .jpeg, .png</li>
              <li>Example: if CSV says <code>john.jpg</code>, your file must be named <code>john.jpg</code></li>
              <li>Names are case-sensitive: <code>John.jpg</code> ≠ <code>john.jpg</code></li>
            </ul>
          </div>
        </div>
      </section>

      {/* Upload */}
      <section className="card">
        <div className="upload-row">
          <label className="upload-zone">
            <input type="file" accept=".csv" onChange={handleCSV} hidden />
            <span className="upload-icon">📄</span>
            <span className="upload-label">Upload CSV</span>
            {csvName
              ? <span className="upload-chip">{csvName} · {guests.length} guests</span>
              : <span className="upload-hint">.csv files only</span>
            }
          </label>

          <label className="upload-zone">
            <input ref={photoInputRef} type="file" multiple onChange={handlePhotos} hidden />
            <span className="upload-icon">🖼</span>
            <span className="upload-label">Upload Photos Folder</span>
            {hasPhotos
              ? <span className="upload-chip">{photoCount} files loaded</span>
              : <span className="upload-hint">Select entire folder</span>
            }
          </label>
        </div>
      </section>

      {/* Guest table */}
      {guests.length > 0 && (
        <section className="card table-card">
          <table className="guest-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Role</th>
                <th>Film Title</th>
                <th>Badge</th>
                <th>Photo File</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {guests.map((g, i) => (
                <tr key={i} className={hasPhotos && g.photo && !photos[g.photo] ? 'row-missing' : ''}>
                  <td className="td-num">{i + 1}</td>
                  <td className="td-name">{g.name      || <em className="empty">—</em>}</td>
                  <td>{g.role      || <em className="empty">—</em>}</td>
                  <td>{g.filmTitle || <em className="empty">—</em>}</td>
                  <td>
                    {g.badgeType?.toUpperCase() === 'VIP'
                      ? <span className="badge-vip">VIP</span>
                      : <span className="badge-guest">GUEST</span>
                    }
                  </td>
                  <td className="td-mono">{g.photo || <em className="empty">—</em>}</td>
                  <td>{statusCell(g)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="table-summary">
            <span>{guests.length} guests loaded</span>
            {hasPhotos && (
              <>
                <span className="sep">·</span>
                <span className="s-matched">{matchedCount} photos matched</span>
                {missingCount > 0 && (
                  <>
                    <span className="sep">·</span>
                    <span className="s-missing">{missingCount} missing</span>
                  </>
                )}
              </>
            )}
          </div>
        </section>
      )}

      {/* Generate */}
      {guests.length > 0 && (
        <section className="card generate-card">
          {missingCount > 0 && !generating && (
            <div className="missing-warning">
              ⚠ {missingCount} photo{missingCount > 1 ? 's' : ''} missing — check filenames before generating.
              Missing photos will use a gray placeholder.
            </div>
          )}

          <button
            className="btn-generate"
            onClick={startGeneration}
            disabled={generating}
          >
            {generating
              ? `Generating ${progress.done} / ${progress.total}…`
              : 'Generate All Badges'
            }
          </button>

          {generating && (
            <div className="progress-wrap">
              <div
                className="progress-fill"
                style={{ width: `${(progress.done / progress.total) * 100}%` }}
              />
            </div>
          )}

          {finished && (
            <div className="done-msg">✓ Done! <strong>nyaff-2026-badges.pdf</strong> downloaded</div>
          )}
        </section>
      )}

      {/* Footer */}
      <footer className="app-footer">
        NYAFF 2026 Guest &amp; VIP Badge Generator · Internal Tool · For Design Team Use Only
      </footer>

      {/* Hidden off-screen batch canvas */}
      {generating && batchGuest && (
        <div className="batch-hidden">
          <BadgeCanvas
            ref={batchRef}
            name={batchGuest.name}
            role={batchGuest.role}
            filmTitle={batchGuest.filmTitle}
            photo={batchGuest.photoUrl}
            badgeType={batchGuest.badgeType}
            onExportReady={handleExportReady}
          />
        </div>
      )}
    </div>
  )
}
