# Compton scattering: 2D to 3D

Open `compton-scattering.html` directly in Safari or Chrome. This is a separate, single-scene teaching demonstration. `reconstruction.html` remains the full detector-to-CDS simulation; `event-cone-rotation.html` remains the manual rotation and persistent-track demonstration. The new page does not modify those pages.

## Presentation sequence

1. An electron initially at rest.
2. An incident photon approaches the first interaction at the origin.
3. One Compton scatter produces a scattered photon and a recoil electron. Both outgoing paths start at the interaction simultaneously and are progressively revealed over 2.5 seconds. The wave is revealed as a prefix of its final curve, preserving the wavelength and amplitude of the existing path. The reference line and gold scattering-angle arc follow over 0.55 seconds; k and varphi labels appear near the end of their corresponding reveal. Next is temporarily disabled during this sequence, while Previous cancels it and allows replay. Reduced-motion environments shorten the sequence. Reveal timing and arrow lengths are presentation choices, not a scale for particle speeds. The gold arc shows varphi between incident propagation n and scattered propagation k.
4. The detector measures two ordered interaction sites r1 and r2. Site 1 deposits the electron kinetic energy E1. Site 2 fully absorbs the remaining photon energy E2. The recoil electron direction is hidden by default at this step and is not used to reconstruct the source.
5. The camera moves continuously from the planar view into 3D. This is the same event, with the same measured direction and deposits.
6. The spherical event circle and its cone appear. Use the beta slider or Sweep 360° to enumerate alternative incident directions consistent with that event. The readout calculates the actual angle from the vectors on every update. It stays equal to varphi.

The page provides Previous/Next, arrow-key steps when focus is outside a form control, pauseable sweep, orbit/pan/zoom in 3D, reset view, energy and varphi controls, optional recoil electron and cone surface, Chinese/English and fullscreen. Returning to a planar step resets beta to zero to preserve the flat scattering diagram. Energy must be 10–10000 keV. Varphi is 5–175°; exactly 0 and 180° degenerate to a ray and are deliberately excluded from this introductory illustration.

## Physical model

The target electron is free and initially at rest. Measurements are ideal, both sites have a known order, and energy is fully contained. The model does not measure an electron track, model atomic binding/Doppler broadening, or transport photons through detector material.

For incident energy E and scattering angle varphi:

- E2 = E / [1 + E/(m_e c²) (1 − cos varphi)].
- E1 = E − E2, m_e c² = 510.99895 keV.
- k = normalize(r2 − r1), a = −k.
- Choose two orthonormal vectors u, v perpendicular to k.
- Candidate incident propagation n(beta) = cos(varphi) k + sin(varphi) [cos(beta) u + sin(beta) v].
- The candidate direction toward the source is s(beta) = −n(beta).
- Consequently n·k = s·a = cos(varphi), for every beta.
- Recoil momentum is p_e = (E/c)n − (E2/c)k. The electron direction must change as candidate n changes. Keeping the electron direction fixed would provide extra information and generally remove the circular ambiguity.

The source marker is R s(beta) on an arbitrary direction sphere of radius R=2.85 display units, not a material ring of sources at a fixed distance. Its angular distance from a is varphi. Its planar Euclidean radius is R sin(varphi), and its circle plane has signed offset R cos(varphi) along a. The displayed cone preserves obtuse angles; it is not replaced by a complementary acute cone.

This demonstration manually chooses varphi and explores the allowed directions. It does not generate random scattering events or claim a uniform distribution in varphi. Klein–Nishina sampling is relevant to the event probabilities and remains part of the separate full simulation. Wavy photon paths are schematic symbols, not a wavelength scale or a polarization measurement. Geometric arrow lengths and interaction distances are illustrative.

## PowerPoint on Mac

The delivered file runs offline in a browser and does not require a PowerPoint add-in. Open it before presenting, use fullscreen, and switch between PowerPoint and the browser for the demonstration. Slide-native interactive HTML would require an Office content add-in and a hosted web page. That integration is not part of this deliverable and has not been tested in PowerPoint.

References:

- Microsoft: PowerPoint content add-ins can display dynamic HTML5 on Mac and other platforms. https://learn.microsoft.com/en-us/office/dev/add-ins/powerpoint/powerpoint-add-ins
- Geant4 Physics Reference Manual: Compton photon-energy relation and recoil-electron energy/momentum. https://geant4.web.cern.ch/documentation/dev/prm_html/PhysicsReferenceManual/electromagnetic/gamma_incident/compton/compton.html

## Build and verification

- `npm run build:scattering` produces the self-contained HTML, including Three.js, KaTeX and fonts.
- `npm run test:scattering` checks 3630 candidate directions over five energies and six angles, constant measured quantities, reconstruction, momentum conservation and the electron mass shell, and spherical-circle geometry.
- `npm run test:scattering-browser` checks the six steps, actual camera drag, candidate rotation, pause, energy/angle changes, bilingual controls, offline loading and 1366×768 layout. Requires Google Chrome.
- `npm run test:scattering-reveal` checks actual partially drawn photon/electron geometry for synchronized progress, delayed angle annotation, unchanged event measurements, cancellation and replay at normal animation speed.
- Screenshots and browser results are under `output/scattering/` (ignored by Git).
