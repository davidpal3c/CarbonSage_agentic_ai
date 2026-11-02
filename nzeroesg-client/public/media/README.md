# Media slots

Every public-site image has a slot in `app/lib/media-slots.ts` with an original,
designed fallback (`*.fallback.svg`, generated artwork, no third-party assets).
To replace a slot: add the optimized file here, set `photo` on the slot with
meaningful alt text, and record the source and licence below.

| Slot | Shot requirements | Source / licence |
| --- | --- | --- |
| `hero-operations-environment` | Portrait or square crop, subject in the lower two thirds, quiet upper third for the sun/sky area. Human or industrial activity in a real environment; no single transport mode as the subject; no legible brand names or faces. The evidence-trail overlay is drawn on top, so avoid busy detail along the lower-left to upper-right diagonal. | Placeholder (original artwork) |
| `mode-air` | 4:3. Cargo aircraft or air-freight apron at working scale; no legible livery. | Placeholder (original artwork) |
| `mode-sea` | 4:3. Container vessel or port at working scale; no legible names. | Placeholder (original artwork) |
| `mode-rail` | 4:3. Freight rail corridor or intermodal yard; no legible markings. | Placeholder (original artwork) |
| `mode-road` | 4:3. Highway or distribution-centre road freight; no legible plates or brands. | Placeholder (original artwork) |

The product screenshot is not a file slot: the homepage renders a coded
dashboard glimpse from the demo dataset's real figures. Replace it with a
captured screenshot only once the workspace redesign has settled.
