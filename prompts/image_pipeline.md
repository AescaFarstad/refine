Image Processing Pipeline

- Location: `src/pipeline` (TypeScript scripts)
- Operates on: `data/img` folder
  - `data/img/source` — raw/source images
  - `data/img/split` — outputs (e.g., split sprites)
  - `data/img/packed` — outputs (e.g., atlases)

Prerequisites
- ts-node
- ImageMagick 6 (`convert` and `identify`) available on PATH

Notes
- Image names in pipeline items must include the file extension.

Ordering
- Jobs are sorted by numeric `priority` (ascending) before execution.
- Use lower numbers for earlier steps (e.g., `split_trim` at 10, `pack` at 20).

Pack job
- Settings-only pipeline file (no items needed)
- Settings:
  - `input_folder:` where to read images from
  - `output_folder:` where to write results
  - `name:` atlas base name (optional). If omitted, uses the `input_folder` name
  - `webp_lossless:` `true|false` (optional, default `true`)
  - `webp_quality:` integer 0–100 (optional; default `100` for lossless, `85` for lossy)
  - `webp_method:` integer (optional; if omitted, ImageMagick default)
  - `webp_alpha_quality:` integer 0–100 (optional, default `100`)
- Packs all images from `input_folder` into a single transparent atlas
- Outputs: `data/img/<output_folder>/<name>.png` and matching `.json`

Resize WebP job
- Settings-only pipeline file (no items needed)
- Settings:
  - `input_folder:` where to read images from
  - `output_folder:` where to write results
  - `width:` output width in pixels (default `1000`)
- Resizes each input image to `width` and writes `<original-name>.png` into `output_folder`
