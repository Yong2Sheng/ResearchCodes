[中文](https://github.com/Yong2Sheng/compton-telescope-visualization/blob/main/README.md) | **English**

# Compton Telescope Visualization

Three offline 3D demonstrations for research talks and teaching: event-cone geometry, photon event reconstruction and the Compton Data Space (CDS), and the 2D-to-3D Compton scattering process. Open the HTML files directly — a WebGL-capable browser is required, and no server is needed.

## Demo pages

Click a page name to open the live demo (GitHub Pages) — nothing to download. To use a demo offline, open the HTML file with the same name from the repository root. GitHub's file view shows the HTML source only and never runs the page, which is why these links point to the hosted demos instead of the repository files.

| Live demo | What it shows |
| --- | --- |
| [reconstruction.html](https://yong2sheng.github.io/compton-telescope-visualization/reconstruction.html) | **Full pipeline.** Photon incidence → first Compton scatter → full absorption at the second site → event cone → parameter card → CDS point accumulation. Includes Klein–Nishina sampling, incident-energy and source-direction controls, batch addition of 1000 events, two map projections, event history, Chinese/English UI and free navigation. |
| [event-cone-rotation.html](https://yong2sheng.github.io/compton-telescope-visualization/event-cone-rotation.html) | **Geometry explorer.** Manually control the scattering angle and rotate around the source axis to see a real event cone and the trace left by the back-projection axis endpoint on the direction sphere; tracks from different scattering angles are kept. |
| [compton-scattering.html](https://yong2sheng.github.io/compton-telescope-visualization/compton-scattering.html) | **Step-by-step walkthrough.** Electron at rest and incident photon → one Compton scatter, with the scattered photon and recoil electron revealed together → measurements at the two interaction sites → planar-to-3D camera move → event circle and candidate incident-direction sweep. Includes energy and scattering-angle controls, automatic stepping, Chinese/English UI and free navigation. |

`event-cone-rotation.html` is the new name of the original rotation animation. The transitional projection preview page has been removed; both projections remain available in the full demo.

## Documentation

- [Changelog](https://github.com/Yong2Sheng/compton-telescope-visualization/blob/main/CHANGELOG.md): changes listed by date, with scope and corresponding commits for traceability.
- [Full reconstruction demo](https://github.com/Yong2Sheng/compton-telescope-visualization/blob/main/RECONSTRUCTION.md): operation, physical model, projections, limitations and verification.
- [Rotation demo](https://github.com/Yong2Sheng/compton-telescope-visualization/blob/main/EVENT_CONE_ROTATION.md): original geometric derivation, track rules and validation record.
- [Stepwise scattering demo](https://github.com/Yong2Sheng/compton-telescope-visualization/blob/main/SCATTERING_DEMO.md): presentation sequence, physical model and PowerPoint usage notes.
- [Azimuthal equidistant projection (ArcGIS Pro help)](https://doc.esri.com/en/arcgis-pro/latest/help/mapping/properties/azimuthal-equidistant.html): official description of different planar projections, useful when interpreting the projection choices in the demos.

The current version does not implement rigid translation of the standard cone for arbitrary source positions. The relevant conventions and possible future display modes are documented in the "Limitations" section of the full reconstruction description.

## Build

The HTML files embed all required scripts. The KaTeX math fonts used by the full demo are embedded as well, so the pages work offline. Build dependencies are only needed when changing the source and regenerating the pages.

```bash
npm install
npm run build:all
```

Individual builds:

```bash
npm run build                  # event-cone-rotation.html
npm run build:reconstruction   # reconstruction.html
npm run build:scattering       # compton-scattering.html
```

## Checks

```bash
npm test
npm run test:psi
npm run test:reconstruction
npm run test:browser
npm run test:reconstruction-browser
npm run test:notation
npm run test:origin
npm run test:projection-seams
npm run test:audit-fixes
npm run test:angle-guides
npm run test:angle-guides-browser
npm run test:scattering
npm run test:scattering-browser
npm run test:scattering-reveal
```

Browser checks require Google Chrome.

## Project layout

- `src/physics.js`, `src/geometry.js`: shared angle conventions, vectors, energies and event-cone geometry.
- `src/app.js`, `src/scene.js`, `src/history.js`: rotation demo.
- `src/event-simulation.js`: idealized event generation, Klein–Nishina sampling and reconstruction.
- `src/reconstruction*.js`: full pipeline, scene, UI and language handling.
- `src/angle-relations*.js`: optional 3D angle guides in the full demo.
- `src/scattering*.js`: model and UI logic of the stepwise scattering demo.
- `src/cds-projections.js`: projection from directions onto the planar display.
- `src/math-typesetting.js`: unified math typesetting.
- `src/healpix-reference-data.json`: HEALPix pixel boundaries used by the delivered pages, plus reference events used by the math tests.
- `src/*.template.html`, `build*.mjs`: page templates and build scripts.
- `tests/`: currently runnable verification entry points.
- `artifacts/`, `output/`, `node_modules/`: local development and test artifacts, not versioned; a fresh clone can open the HTML files without them.

## License

Released under the MIT License; see [LICENSE](LICENSE). You are free to use, modify and redistribute, provided the copyright and license notice are retained. These demos are idealized models for teaching and are not intended for direct use in scientific data analysis.
