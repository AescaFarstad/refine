# Bundled fonts

These original, unmodified TTF files are distributed with the application.
Vite copies this directory, including copyright notices and licenses, into
dist/fonts. No external font service or locally installed font is required
for the primary UI fonts.

## Ubuntu 0.83

Source: https://github.com/google/fonts/tree/main/ufl/ubuntu
Downloaded 2026-09-11 from raw.githubusercontent.com/google/fonts/main/ufl/ubuntu/.
Files: Ubuntu-Regular.ttf, Ubuntu-Medium.ttf, Ubuntu-Bold.ttf and their
Italic, MediumItalic and BoldItalic counterparts.
License: ubuntu/UFL.txt. Copyright: ubuntu/COPYRIGHT.txt and font metadata.

The Linux audit used Regular for weight 400, Medium for 500, and Bold for
600 through 900. src/fonts.css preserves this mapping with CSS aliases;
the font files and their internal names have not been changed.

## Liberation 2.1.5

Source archive:
https://github.com/liberationfonts/liberation-fonts/files/7261482/liberation-fonts-ttf-2.1.5.tar.gz
Downloaded 2026-09-11. Included faces: Liberation Sans and Liberation Mono,
Regular and Bold. Copyright and SIL Open Font License: liberation/LICENSE.
Upstream contributors: liberation/AUTHORS.

Liberation Sans replaces Arial for controls and generic sans-serif canvas
text. Liberation Mono is used for numeric and monospace displays. Ubuntu
is used for body text and canvas text that previously requested system-ui.
Symbols listed below use the bundled DejaVu face. Other rare symbols outside
these fonts retain browser/system fallback.

## DejaVu Sans 2.37

Source archive:
https://github.com/dejavu-fonts/dejavu-fonts/releases/download/version_2_37/dejavu-fonts-ttf-2.37.tar.bz2
Included face: the original, unmodified DejaVuSans.ttf.
Copyright and redistribution terms: dejavu/LICENSE.

The Linux audit records DejaVu Sans Regular as a fallback, including in bold
labels. Refine Symbols selects that face for U+231E, U+231F, U+25CC and U+2764
(corner brackets, dotted circle, and heart) at all weights. A CSS unicode-range
restricts the alias to those characters, so ordinary text keeps its own font.
The symbol face is loaded before canvas atlas generation.

## Loading and verification

src/main.ts loads all declared faces before generating canvas atlases or
mounting the UI. This prevents cached canvas text from using a temporary
fallback font. SHA256SUMS.txt records the bundled font and license bytes.
Keep the license and copyright files when redistributing these assets.
