# Anchor curation guide — how to onboard your dataset (30 min)

The loader (`context/atlas.js`) auto-attaches any matching files in this
folder to every API call. No code changes needed — just drop files here.

## File names (exact)

| File | Shows | Pick from |
|---|---|---|
| `anchor-L0.jpg` | Perfectly healthy retina | IDRiD grading set, DR level 0 |
| `anchor-L1.jpg` | Only a few microaneurysms | IDRiD, MA-only cases |
| `anchor-L2.jpg` | First bleed or yellow deposit | IDRiD / APTOS rural, the referral boundary |
| `anchor-L3.jpg` | Bleeds in several zones + beading | IDRiD severe cases |
| `anchor-L4.jpg` | Any new fragile vessels | IDRiD proliferative cases |
| `atlas-ma.jpg` | Close crop: pin-head red dots | Any IDRiD lesion mask (MA) |
| `atlas-he.jpg` | Close crop: blot bleed | Any IDRiD lesion mask (HE) |
| `atlas-ex.jpg` | Close crop: yellow deposits | Any IDRiD lesion mask (EX) |
| `atlas-nv.jpg` | Close crop: lacy new vessels | IDRiD severe cases (NV) |

JPG or PNG. Each file must be under 800 KB (loader skips bigger ones to
protect prompt cost/latency). Aim ~1024px on the long edge.

## Picking rules (what makes a good anchor)

1. **Canonical, not interesting.** The most textbook example of the grade —
   borderline cases make bad anchors (they teach the API to dither).
2. **L2 deserves the most care.** It's the referral threshold and the most
   common doctor dispute. Pick one where a junior would hesitate but a senior
   is sure.
3. **Match deployment.** Prefer portable-camera, field-condition shots
   (APTOS rural) over pristine tabletop images for L0–L2.
4. **One eye per file.** No montages, no annotation overlays burned in —
   overlays teach the API to look for drawings, not disease.
5. **De-identified.** Cropped to fundus only, no patient text in frame.

## After dropping files

1. Restart the API (`node index.js`).
2. Open the Memory page → packet section lists attached images.
3. Re-run the harness: `npm run eval -- --synthetic 60` for plumbing, or
   the real directories for measured gains.
4. If grades shift, that shift IS the experiment — record packet version +
   QWK in your judging notes.
