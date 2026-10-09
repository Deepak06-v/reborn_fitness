# Gym photographs

Real photographs used by the "Inside Reborn Fitness" gallery
(`src/components/sections/Zones.tsx`). The gallery reads them through the flat
registry in `src/data/facilityImages.ts` — dropping a file here does nothing on
its own.

The uploads currently live in `zone-01` … `zone-04` subfolders (the original
folder names are kept so the files did not have to be moved); the gallery itself
treats them as one flat set of photos.

## Adding or changing a photo

1. Save the image as a lowercase, hyphenated `.jpeg`/`.jpg`/`.webp` anywhere
   under `public/`.
2. Add an entry to `facilityPhotos` in `src/data/facilityImages.ts`:

   ```ts
   { src: '/images/zones/zone-01/gym-03.jpeg', alt: 'Describe the photo' }
   ```

Aim for landscape photos (roughly 4:3 to 3:2) around 1600px on the long edge.
Add a `focalPoint` (e.g. `'50% 30%'`) if the subject is off-centre, and an
optional `caption` if the shot needs a label.
