# NYAFF Badge Generator

## Goal
Batch-generate NYAFF event badges.
Input: CSV guest list + photo folder
Output: Print-quality PDF, one page per badge

## Print Specs
- Size: 4.09" × 5.65" @ 300 dpi
- Pixels: 1227 × 1695 px
- pixelRatio: 1 for PDF export (1227 × 1695 px = 300 dpi at 4.09" × 5.65")

## Tech Stack
- React + Vite
- Konva.js (canvas rendering — badges must not be generated with HTML/CSS)
- Export: stage.toDataURL() → jsPDF

## File Locations
- Background images: public/assets/images/
- Fonts: public/assets/fonts/
- Badge canvas component: src/BadgeCanvas.jsx
- App UI and batch logic: src/App.jsx

## Dynamic Fields (per guest)
- NAME: guest name, all-caps, adaptive font size, word-wrap on spaces only
- ROLE: job title, red, single line with ellipsis
- FILM_TITLE: film name, red italic, single line (font steps down 60→48→36px to fit)
- PHOTO: headshot, square-cropped, rounded corners
- BADGE_TYPE: "GUEST" or "VIP" — selects the correct background image

## Fixed Elements
- Background PNG (top portion): rendered at natural size
- Year "2026" vertical stack: fixed position
- Brand red: #B20419 (canvas) / #CC0000 (UI)

## Layout Rules
- Name top aligns with photo top
- Film title bottom aligns with photo bottom
- Role sits 10px above film title
- Word-wrap only on spaces — hyphenated words (e.g. "Kore-eda") never split
- Fonts loaded from public/assets/fonts/ via FontFace API before any render
