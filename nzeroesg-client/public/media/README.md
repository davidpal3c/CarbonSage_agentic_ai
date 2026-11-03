# Public media (temporary photography)

Every public-site image is a local file here, delivered through `next/image`
(responsive widths, WebP/AVIF on demand). Nothing is hotlinked, and no image
comes from Atalanta, Waabi or any reference site. The slots are defined in
`app/lib/media-slots.ts`. These are **temporary, representative** photographs
chosen to judge the composition; replace them with commissioned or licensed
CarbonSage photography before launch, keeping the art direction below.

All five were obtained from Wikimedia Commons on 2 November 2026 and are
either dedicated to the public domain (CC0) or works of the US federal
government / donated to the public domain. None requires attribution, but
sources are recorded for provenance. Files were resized (2400 px hero, 1200 px
others) and re-encoded as progressive JPEG; no other edits (the dark scrims
and crops are applied in CSS).

| File (slot) | Source page | Author | Licence | Original size |
| --- | --- | --- | --- | --- |
| `hero-terminal-night.jpg` (`hero-terminal-night`) | [Container terminal in Minneapolis](https://commons.wikimedia.org/wiki/File:Container_terminal_in_Minneapolis.jpg) | Wikideas1 | CC0 1.0 | 3947 × 2825 |
| `freight-air.jpg` (`mode-air`) | [C-17 Globemaster III Unloads Cargo During REFORPAC 2025](https://commons.wikimedia.org/wiki/File:C-17_Globemaster_III_Unloads_Cargo_During_REFORPAC_2025_(9200089).jpg) | US Air Force, Senior Airman Patrick Boyle | Public domain (US federal government work) | 6906 × 4604 |
| `freight-sea.jpg` (`mode-sea`) | [Aerial photograph of the Port of Miami Container Port](https://commons.wikimedia.org/wiki/File:Aerial_photograph_of_the_Port_of_Miami_Container_Port.jpg) | James R. Tourtellotte, US Customs and Border Protection | Public domain (US federal government work) | 3040 × 2008 |
| `freight-rail.jpg` (`mode-rail`) | [A long freight train approaches between a wind-turbine farm and desert land outside the town of Cabazon, California](https://commons.wikimedia.org/wiki/File:A_long_freight_train_approaches_between_a_wind-turbine_farm_and_desert_land_outside_the_town_of_Cabazon_in_Riverside_County,_California_LCCN2013631271.tif) | Carol M. Highsmith, Library of Congress | Public domain (donated by the photographer) | 7360 × 4912 |
| `freight-road.jpg` (`mode-road`) | [Roxas Bridge, Del Pan, Tondo Port Area 43](https://commons.wikimedia.org/wiki/File:170Roxas_Bridge_Del_Pan_Tondo_Port_Area_43.jpg) | Judgefloro | CC0 1.0 | 4608 × 3456 |

Known compromises (why these are temporary): the air photograph is a military
airlift aircraft rather than commercial air freight; the road photograph shows
a container truck with a third-party shipping line's markings; the freight
operations are US and Philippine locations, while the demo dataset's lanes are
global.

## Art direction for replacements

- **Text-safe area.** Headlines and copy sit on the top-left of each image
  band under a dark olive scrim (about 90% at the top fading to 15–25%). Keep
  the upper third quiet: sky, night, haze, or open ground.
- **Subject.** Real operations at working scale, in an environment (terrain,
  water, weather), not a studio or product shot. Show the mode, not a brand:
  avoid legible livery, plates and faces.
- **Palette.** Muted and slightly warm. Heavy colour casts fight the olive
  and paper grounds; grade towards low saturation.
- **Aspect and size.** Hero: 16:10 or wider, at least 2400 px. Mode bands:
  3:2 to 16:10, at least 1600 px. Provide the focal point as `position` in
  `media-slots.ts`; the band crops with `object-cover` at roughly 3:1 on
  desktop and 3:4 on phones.
- **Motion.** None today. If a poster loop is added later, keep the still as
  the fallback and honour `prefers-reduced-motion`.

The homepage product glimpse is not a photograph: it is a coded rendering of
the workspace Overview using the demo dataset's real figures (see
`DashboardGlimpse.tsx`).
