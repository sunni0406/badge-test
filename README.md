# NYAFF 2026 Badge Generator

Internal tool for the NYAFF design team. Upload a guest CSV and photo folder, then generate all print-ready badges as a single PDF in seconds.

---

## How to Use

**Step 1 — Download the CSV template**

Click **Download CSV Template** in the app. Fill in one row per guest:

| Column | Description | Example |
|---|---|---|
| `name` | Guest full name | Hirokazu Kore-eda |
| `role` | Job title or role | Director |
| `filmTitle` | Film being presented | Shoplifters |
| `badgeType` | `GUEST` or `VIP` | GUEST |
| `photo` | Photo filename (must match exactly) | hirokazu.jpg |

**Step 2 — Upload CSV and photos**

- Click **Upload CSV** and select your filled-in file.
- Click **Upload Photos Folder** and select the folder containing all headshots.
- The guest table will show a green **✓ Found** or red **✗ Missing** status for each photo.

> Photo filenames are case-sensitive. `John.jpg` and `john.jpg` are different files.

**Step 3 — Generate**

Click **Generate PDF**. The app processes each badge one by one and downloads `NYAFF-badges.pdf` when done. Guests with missing photos get a gray placeholder.

---

## CSV Tips

- Columns are matched by name (case-insensitive, spaces and hyphens ignored).
- camelCase headers like `filmTitle` and `badgeType` are supported.
- BOM-encoded Excel CSVs and tab-delimited files are handled automatically.
- Supported photo formats: `.jpg`, `.jpeg`, `.png`

---

## Development

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # production build → dist/
```

**Dependencies:** React 18, Vite 6, Konva.js, react-konva, jsPDF, JSZip

**Font files** go in `public/assets/fonts/` (UNicod Sans family).  
**Background images** go in `public/assets/images/` — the tool expects:
- `2026 GUEST BADGE.png`
- `2026 VIP BADGE.png`

---

## Badge Layout

- Canvas: 1227 × 1695 px (4.09" × 5.65" @ 300 dpi)
- Name: all-caps, 77 px bold — drops to 60 px only if more than 2 lines needed
- Role: 60 px medium, single line, ellipsis on overflow
- Film title: italic, starts at 60 px — steps down to 48, then 36 to stay on one line
- Photo: 355 × 355 px square crop, 15 px rounded corners
- "2026" vertical: gray, anchored to bottom

---

*NYAFF 2026 · Internal Tool · For Design Team Use Only*
