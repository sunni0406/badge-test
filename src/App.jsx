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

  const batchRef    = useRef()
  const pdfRef      = useRef(null)
  const batchIdxRef = useRef(0)
  const guestsRef   = useRef([])
  const photosRef   = useRef({})

  useEffect(() => { guestsRef.current = guests }, [guests])
  useEffect(() => { photosRef.current = photos },  [photos])

  const downloadTemplate = useCallback(() => {
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = Object.assign(document.createElement('a'), { href: url, download: 'nyaff-badge-template.csv' })
    document.body.appendChild(a); a.click()
    document.body.removeChild(a); URL.revokeObjectURL(url)
  }, [])

  const handleCSV = useCallback(async e => {
    const file = e.target.files[0]
    if (!file) return
    const text = await file.text()
    setGuests(parseCSV(text))
    setCsvName(file.name)
    setFinished(false)
    e.target.value = ''
  }, [])

  const photoInputRef = useRef()
  useEffect(() => { photoInputRef.current?.setAttribute('webkitdirectory', '') }, [])

  const handlePhotos = useCallback(e => {
    const map = {}
    Array.from(e.target.files).forEach(f => { map[f.name] = URL.createObjectURL(f) })
    setPhotos(map)
    e.target.value = ''
  }, [])

  const resolvePhoto = useCallback(filename => {
    if (!filename) return null
    return photosRef.current[filename] || null
  }, [])

  const handleExportReady = useCallback(() => {
    const dataURL = batchRef.current?.exportForPDF()
    if (!dataURL) return
    const idx = batchIdxRef.current
    if (idx > 0) pdfRef.current.addPage()
    pdfRef.current.addImage(dataURL, 'PNG', 0, 0, 4.09, 5.65)
    const next = idx + 1
    batchIdxRef.current = next
    setProgress({ done: next, total: guestsRef.current.length })
    if (next < guestsRef.current.length) {
      const g = guestsRef.current[next]
      setBatchGuest({ ...g, photoUrl: resolvePhoto(g.photo) })
    } else {
      pdfRef.current.save('NYAFF-badges.pdf')
      setGenerating(false); setFinished(true); setBatchGuest(null)
    }
  }, [resolvePhoto])

  const startGeneration = useCallback(() => {
    if (!guests.length || generating) return
    setGenerating(true); setFinished(false)
    setProgress({ done: 0, total: guests.length })
    pdfRef.current      = new jsPDF({ orientation: 'portrait', unit: 'in', format: [4.09, 5.65] })
    batchIdxRef.current = 0
    const g = guests[0]
    setBatchGuest({ ...g, photoUrl: resolvePhoto(g.photo) })
  }, [guests, generating, resolvePhoto])

  const photoCount   = Object.keys(photos).length
  const hasPhotos    = photoCount > 0
  const photoGuests  = guests.filter(g => g.photo)
  const matchedCount = hasPhotos ? photoGuests.filter(g =>  photos[g.photo]).length : 0
  const missingCount = hasPhotos ? photoGuests.filter(g => !photos[g.photo]).length : 0

  const statusCell = g => {
    if (!g.photo || !hasPhotos) return <span className="status-na">—</span>
    if (photos[g.photo])        return <span className="status-found">✓</span>
    return <span className="status-missing">✗ Missing</span>
  }

  return (
    <div className="app">
      <div className="brand-bar" />

      <header className="header">
        <div className="header-row">
          <h1 className="title">NYAFF Badge Generator</h1>
          <span className="year-tag">2026</span>
        </div>
        <p className="subtitle">Generate print-ready guest and VIP badges.</p>
      </header>

      <div className="rule" />

      {/* Steps */}
      <section className="section steps-section">
        <div className="steps">
          <div className="step-item">
            <span className="step-n">01</span>
            <strong>Download template</strong>
            <span>Fill in one row per guest.</span>
          </div>
          <div className="step-item">
            <span className="step-n">02</span>
            <strong>Upload guest list + headshots</strong>
            <span>Upload your CSV and headshots folder.</span>
          </div>
          <div className="step-item">
            <span className="step-n">03</span>
            <strong>Generate PDF</strong>
            <span>Download all badges as one PDF.</span>
          </div>
        </div>
      </section>

      <div className="rule" />

      {/* Template download + CSV field guide */}
      <section className="section">
        <button className="btn-download" onClick={downloadTemplate}>
          ↓ Download CSV Template
        </button>

        <div className="csv-guide">
          <div className="csv-guide-title">CSV Column Reference</div>
          <div className="csv-fields">
            <div className="csv-field">
              <code>name</code>
              <span>Full guest name — e.g. <em>Hirokazu Kore-eda</em></span>
            </div>
            <div className="csv-field">
              <code>role</code>
              <span>Job title or role — e.g. <em>Director</em></span>
            </div>
            <div className="csv-field">
              <code>filmTitle</code>
              <span>Film being presented — e.g. <em>Shoplifters</em></span>
            </div>
            <div className="csv-field">
              <code>badgeType</code>
              <span>Must be <strong>GUEST</strong> or <strong>VIP</strong></span>
            </div>
            <div className="csv-field csv-field-photo">
              <code>photo</code>
              <span>
                Exact filename, case-sensitive — e.g. <em>hirokazu.jpg</em>.
                Must match the file in your headshots folder. Supported: .jpg, .jpeg, .png
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className="rule" />

      {/* Upload */}
      <section className="section">
        <label className="file-row">
          <input type="file" accept=".csv" onChange={handleCSV} hidden />
          <span className="file-label">Upload Guest List</span>
          <span className={`file-value ${csvName ? 'has-value' : ''}`}>
            {csvName ? `${csvName} · ${guests.length} guests` : 'No file selected'}
          </span>
          <span className="file-browse">Browse</span>
        </label>

        <label className="file-row">
          <input ref={photoInputRef} type="file" multiple onChange={handlePhotos} hidden />
          <span className="file-label">Upload Headshots Folder</span>
          <span className={`file-value ${hasPhotos ? 'has-value' : ''}`}>
            {hasPhotos ? `${photoCount} photos loaded` : 'No folder selected'}
          </span>
          <span className="file-browse">Browse</span>
        </label>
      </section>

      {/* Guest table */}
      {guests.length > 0 && (
        <>
          <div className="rule" />
          <section className="section">
            <div className="table-wrap">
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
                          : <span className="badge-guest">GUEST</span>}
                      </td>
                      <td className="td-mono">{g.photo || <em className="empty">—</em>}</td>
                      <td>{statusCell(g)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="table-footer">
                <span>{guests.length} guests</span>
                {hasPhotos && (
                  <>
                    <span className="sep">·</span>
                    <span className="s-matched">{matchedCount} matched</span>
                    {missingCount > 0 && (
                      <>
                        <span className="sep">·</span>
                        <span className="s-missing">{missingCount} missing</span>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </section>
        </>
      )}

      {/* Generate */}
      {guests.length > 0 && (
        <>
          <section className="section generate-section">
            {missingCount > 0 && !generating && (
              <p className="warning-text">
                {missingCount} photo{missingCount > 1 ? 's' : ''} missing — these will use a gray placeholder.
              </p>
            )}
            <div className="generate-row">
              <button className="btn-generate" onClick={startGeneration} disabled={generating}>
                {generating ? `Generating ${progress.done} / ${progress.total}…` : 'Generate PDF'}
              </button>
              {finished && <span className="done-msg">✓ NYAFF-badges.pdf downloaded</span>}
            </div>
            {generating && (
              <div className="progress-wrap">
                <div className="progress-fill" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
              </div>
            )}
          </section>
        </>
      )}

      <footer className="footer">
        NYAFF 2026 · Internal Tool · For Design Team Use Only
      </footer>

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
