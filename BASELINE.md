# Performance Baseline

Recorded: 2026-08-09

This is a measurement snapshot taken before any performance optimization
work. No application code was changed to produce it. It exists so later
optimization work has a "before" to compare against.

## Environment

- Local dev (`vite dev`), Chrome DevTools Network tab, cache disabled, hard reload
- Backend: local Express server against MongoDB Atlas (remote DB, not local Mongo)
- Data: 33 listings seeded

## Network (DevTools, cache disabled)

- `GET /api/product/list` — 12.6 kB transferred, ~695 ms
  - Fires **twice** per page load, both from `ShopContext.jsx:21`
- Homepage total — 84 requests, 6.9 MB transferred
- `DOMContentLoaded` — 543 ms
- `Load` — 1.36 s

## Production build output (`npm run build`, frontendprj)

```
dist/index.html                           0.66 kB │ gzip:   0.40 kB
dist/assets/hero-EC2f2POh.png           191.26 kB
dist/assets/contact_img-CyOum2vk.png  1,062.42 kB
dist/assets/about_img-BAJyTXw9.png    1,201.91 kB
dist/assets/index-CsuFqPc7.css           34.58 kB │ gzip:   7.26 kB
dist/assets/index-PFeFdZHd.js           356.57 kB │ gzip: 119.13 kB

✓ built in 1.39s
```

- JS bundle: 356.57 kB, gzipped 119.13 kB
- CSS bundle: 34.58 kB, gzipped 7.26 kB

## Known issues to fix

- No pagination on `/api/product/list` — returns the entire collection
- No indexes on `category` or `date` fields
- Duplicate fetch on mount (`ShopContext.jsx:21`)
- Listing images hotlinked from LoremFlickr — 302 redirect, ~370 ms each
- `hero.png` is 192 kB unoptimized
