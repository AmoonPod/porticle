# Porticle assets

`icon.svg`, `trayTemplate.svg`, and `tray-windows.svg` are the editable source assets. Run
`npm run icons` to regenerate the platform PNG, ICNS, and ICO files used by Electron Builder.

- `icon.*` is the stable application icon.
- `trayTemplate*` is the monochrome macOS menu-bar asset.
- `tray-windows*` is the Windows notification-area asset.
- `generated/` is reproducible intermediate output and is intentionally ignored.

Product screenshots live under `docs/assets/`; packaged release artifacts live under the ignored
`release/` directory.
