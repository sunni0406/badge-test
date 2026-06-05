function parseRow(line, delim = ',') {
  const result = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === delim && !inQuotes) {
      result.push(cur); cur = ''
    } else {
      cur += ch
    }
  }
  result.push(cur)
  return result
}

// Find first non-empty value whose key matches any of the given keywords
function pick(obj, keywords) {
  // 1. Exact match
  for (const kw of keywords) {
    if (obj[kw] !== undefined && obj[kw] !== '') return obj[kw]
  }
  // 2. Partial / fuzzy match — column name must contain the keyword,
  // not the other way around. The reverse direction caused "filmname".includes("name")
  // to match the name column as filmTitle.
  const stripped = kw => kw.replace(/[_\s-]/g, '')
  const kwNorm = keywords.map(stripped)
  const fuzzyKey = Object.keys(obj).find(k => {
    const kn = stripped(k)
    return kwNorm.some(kw => kn.includes(kw))
  })
  return fuzzyKey ? obj[fuzzyKey] : ''
}

export function parseCSV(text) {
  // Strip BOM (Excel exports often include it)
  const clean = text.replace(/^﻿/, '').trim()

  // Auto-detect delimiter: tab or comma
  const firstLine = clean.split(/\r?\n/)[0]
  const delim = firstLine.includes('\t') ? '\t' : ','

  const lines = clean.split(/\r?\n/)
  const headers = parseRow(lines[0], delim).map(h =>
    h.trim()
      .replace(/([a-z])([A-Z])/g, '$1_$2')   // camelCase → snake_case
      .toLowerCase()
      .replace(/[\s-]+/g, '_')
  )

  console.log('[CSV] columns detected:', headers)

  const rows = lines.slice(1)
    .filter(l => l.trim())
    .map(line => {
      const vals = parseRow(line, delim)
      const obj = {}
      headers.forEach((h, i) => { obj[h] = (vals[i] ?? '').trim() })

      const guest = {
        name:      pick(obj, ['name', 'full_name', 'guest_name', 'guest']),
        role:      pick(obj, ['role', 'position', 'job_title', 'job', 'designation', 'title_role']),
        filmTitle: pick(obj, ['film_title', 'film', 'movie_title', 'movie', 'film_name', 'title', 'project', 'work']),
        photo:     pick(obj, ['photo', 'image', 'headshot', 'pic', 'photo_file', 'filename', 'file', 'img']),
      }
      return guest
    })

  console.log('[CSV] parsed guests:', rows)
  return rows
}
