# macOS Icon Tool

This folder contains a Python 3.9-compatible utility that prepares a macOS
`icon.iconset` bundle from a single source image and converts it into an
`.icns` file with `iconutil`.

## Requirements

- macOS with `iconutil` available.
- Python 3.9 or newer.
- Pillow.

## Usage

```bash
python3 tools/macos_icon/build_icon.py path/to/source-image.png
```

If Pillow is not installed:

```bash
python3 -m pip install Pillow
```

By default the script writes:

- `build/macos-icon/icon.iconset`
- `build/macos-icon/app.icns`

To replace the application icon directly:

```bash
python3 tools/macos_icon/build_icon.py path/to/source-image.png --icns-path assets/app.icns
```

To also keep the pre-canvas resized images for inspection:

```bash
python3 tools/macos_icon/build_icon.py path/to/source-image.png --intermediates-dir build/macos-icon/intermediates
```

## Sizing Rules

The script generates the standard macOS iconset filenames required by
`iconutil`.

For physical sizes `1024`, `512`, and `256`, the source image is first resized
to an inner box and then centered in a larger square canvas:

- `1024` output uses an `812x812` inner image.
- `512` output uses a `406x406` inner image.
- `256` output uses a `203x203` inner image.

For all other icon sizes, the source image is resized directly to the target
square.
