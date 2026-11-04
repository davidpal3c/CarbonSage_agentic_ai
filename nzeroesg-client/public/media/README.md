# Public media (temporary photography)

Every public-site image is a local file here, delivered through `next/image`
(responsive widths, WebP/AVIF on demand). Nothing is hotlinked, and no image
comes from Atalanta, Waabi or any reference site. The slots are defined in
`app/lib/media-slots.ts`. These are **temporary, representative** photographs
chosen to judge the composition; replace them with commissioned or licensed
CarbonSage photography before launch, keeping the art direction below.

All files were obtained from Wikimedia Commons (2 November 2026 for the first
three, 3 November 2026 for the rest). Public-domain and CC0 images need no
attribution but are recorded for provenance. The CC BY and CC BY-SA images
**require attribution**, which the site footer shows (`photoCredits` in
`app/lib/media-slots.ts`); the CC BY-SA licence covers the photograph and any
adaptation of it, not the rest of the site. Files were resized (2400 px hero,
1800 px forest, 1000-1200 px others) and re-encoded as progressive JPEG; no
other edits (scrims and crops are applied in CSS).

| File (slot) | Source page | Author | Licence | Original size |
| --- | --- | --- | --- | --- |
| `hero-terminal-night.jpg` (`hero-terminal-night`) | [Container terminal in Minneapolis](https://commons.wikimedia.org/wiki/File:Container_terminal_in_Minneapolis.jpg) | Wikideas1 | CC0 1.0 | 3947 × 2825 |
| `freight-sea.jpg` (`mode-sea`) | [Aerial photograph of the Port of Miami Container Port](https://commons.wikimedia.org/wiki/File:Aerial_photograph_of_the_Port_of_Miami_Container_Port.jpg) | James R. Tourtellotte, US Customs and Border Protection | Public domain (US federal government work) | 3040 × 2008 |
| `freight-rail.jpg` (`mode-rail`) | [A long freight train approaches between a wind-turbine farm and desert land outside the town of Cabazon, California](https://commons.wikimedia.org/wiki/File:A_long_freight_train_approaches_between_a_wind-turbine_farm_and_desert_land_outside_the_town_of_Cabazon_in_Riverside_County,_California_LCCN2013631271.tif) | Carol M. Highsmith, Library of Congress | Public domain (donated by the photographer) | 7360 × 4912 |
| `freight-air.jpg` (`mode-air`) | [Palm Springs International Airport](https://commons.wikimedia.org/wiki/File:Palm_Springs_International_Airport_photo_Don_Ramey_Logan.jpg) | Don Ramey Logan | CC BY 4.0 | see source page |
| `freight-road.jpg` (`mode-road`) | [A591 road, Lake District, June 2009](https://commons.wikimedia.org/wiki/File:A591_road,_Lake_District_-_June_2009_Edit_1.jpg) | Diliff | CC BY-SA 3.0 | see source page |
| `env-forest.jpg` (`env-forest`) | [Bois Raquet, in the High Fens, Eifel Nature Park](https://commons.wikimedia.org/wiki/File:Bois_Raquet,_in_the_High_Fens_%E2%80%93_Eifel_Nature_Park_(DSCF6655).jpg) | Trougnouf (Benoit Brummer) | CC BY 4.0 | see source page |

Replaced in Pass 04: the US Air Force C-17 night photograph (military airlift)
and the Philippine port-road photograph with a third-party shipping line's
markings. The replacements are **infrastructure and landscape, not freight
vehicles**: a permissively licensed commercial air-cargo or truck photograph
with no legible branding was not found among Commons results, so the air and
road images show a runway and a road. Licensed commercial stock is the Pass 06
fix. The two images that remain are US locations (Miami port, Cabazon rail).

## Art direction for replacements

- **Where each image is used.** Hero: full-bleed under a scrim. Rail (large,
  portrait, with parallax) and sea (inset): the offset freight section. Forest:
  full-bleed behind the trust headline, under an overlapping paper panel, with
  parallax. Air, sea, rail and road also appear as 48 px legend thumbnails in the
  modes table, so each needs a recognisable centre at tiny sizes.
- **Text-safe area.** Headlines on photographs sit in the upper-left over a dark
  olive scrim. Keep the upper third quiet: sky, haze, canopy or open ground.
- **Subject.** Real operations at working scale in an environment, not a studio
  or product shot. Avoid legible livery, plates and faces.
- **Palette.** Muted and slightly warm; avoid strong colour casts against the
  olive and paper grounds.
- **Aspect and size.** Hero 16:10 or wider, at least 2400 px. Rail 4:5 portrait
  crop-friendly, at least 1600 px tall. Forest at least 1800 px wide with a
  quiet top half. Provide the focal point as `position` in `media-slots.ts`.
- **Motion.** Parallax only (a bounded transform, off under
  `prefers-reduced-motion`). If a poster loop is added later, keep the still as
  the fallback.

The homepage product glimpse is not a photograph: it is a coded rendering of the
workspace Overview using the demo dataset's real figures (`DashboardGlimpse.tsx`).
