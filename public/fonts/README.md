# Brand fonts

## Boston Angel (display — "Spruce & Co")

Boston Angel is a licensed face and is not redistributed here. Drop the
bold weight into this folder and it is picked up automatically — no code
change needed. Any one of these filenames works:

    BostonAngel-Bold.woff2   <- preferred, smallest
    BostonAngel-Bold.woff
    BostonAngel-Bold.otf
    BostonAngel-Bold.ttf

Until a file is present the stack falls back to Playfair Display, the
closest high-contrast serif available on Google Fonts.

To convert an .otf or .ttf to .woff2, use https://cloudconvert.com/otf-to-woff2
or `woff2_compress BostonAngel-Bold.otf`.

## Poppins (body — "PRIVATE LIMITED" and all UI text)

Loaded from Google Fonts in `src/app/layout.tsx`. Nothing to install.
