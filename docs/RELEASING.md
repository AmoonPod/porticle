# Releasing Porticle

Releases are tag-driven and intentionally require platform signing. The workflow will fail rather than publish unsigned production installers.

## Artifacts

Each release produces:

| Platform | Architecture | Artifact       |
| -------- | ------------ | -------------- |
| macOS    | ARM64        | DMG + ZIP      |
| macOS    | x64          | DMG + ZIP      |
| Windows  | ARM64        | NSIS installer |
| Windows  | x64          | NSIS installer |

It also publishes `latest-mac.yml`, `latest.yml`, required update blockmaps, `SHA256SUMS.txt`, two
CycloneDX SBOMs, and GitHub artifact provenance attestations. Native jobs first upload private
workflow artifacts. The publish job creates a draft, uploads the complete validated set, and makes it
public only after every required file is present.

## Repository secrets

### macOS signing and notarization

Configure:

- `MAC_CSC_LINK`: Base64-encoded `.p12`, a secure URL, or another certificate source accepted by electron-builder.
- `MAC_CSC_KEY_PASSWORD`: password for the Developer ID Application certificate.
- `APPLE_ID`: Apple ID used for notarization.
- `APPLE_APP_SPECIFIC_PASSWORD`: app-specific password for that Apple ID.
- `APPLE_TEAM_ID`: Apple Developer team identifier.

An App Store Connect API key is preferable for organizations that manage it centrally. If switching to API-key notarization, replace the three Apple ID variables in the workflow with electron-builder’s `APPLE_API_KEY`, `APPLE_API_KEY_ID`, and `APPLE_API_ISSUER` inputs; `APPLE_API_KEY` must point to a temporary `.p8` file created from an encrypted secret.

### Windows signing

Configure:

- `WIN_CSC_LINK`: Base64-encoded `.pfx`, a secure URL, or supported certificate source.
- `WIN_CSC_KEY_PASSWORD`: password for that certificate.

For an HSM or cloud signing provider, replace this pair with the provider-specific electron-builder signing hook and document its least-privilege credentials before enabling a release.

## First production release gate

Do not push the first public version tag until all signing and notarization secrets above are
configured. Local ad-hoc builds can validate application behavior and package structure, but they
cannot prove Gatekeeper, SmartScreen, or production updater behavior. Before calling updates
production-verified, publish two signed patch releases and exercise the complete previous-version to
new-version download and restart flow on clean macOS ARM64, macOS Intel, and Windows machines.

## Prepare a release

1. Start from a clean `main` branch with green CI and CodeQL.
2. Move relevant `CHANGELOG.md` entries from **Unreleased** to a new version heading with the release date.
3. Set the same semantic version in `package.json` and `package-lock.json`:

   ```bash
   npm version 0.1.0 --no-git-tag-version
   ```

4. Run the full local suite:

   ```bash
   npm ci
   npm run format:check
   npm run lint
   npm run typecheck
   npm test
   npm run test:e2e
   npm run build
   ```

5. Commit the version/changelog update.
6. Create and push an annotated tag:

   ```bash
   git tag -a v0.1.0 -m "Porticle v0.1.0"
   git push origin v0.1.0
   ```

The release workflow verifies that the tag exists and exactly matches `package.json`, repeats
lint/typecheck/tests, builds both platforms, signs and notarizes, verifies updater manifests and
checksums, validates every updater payload's SHA-512 and size, attests the artifacts, then publishes
the release atomically.

## Inspect the release candidates

GitHub Actions verifies every architecture before publication. After publication, download the
artifacts as an independent smoke test; never replace a published asset with a locally rebuilt file.

### macOS

```bash
codesign --verify --deep --strict --verbose=2 Porticle.app
spctl --assess --type execute --verbose=2 Porticle.app
stapler validate Porticle.app
npx @electron/fuses read --app Porticle.app
plutil -extract NSAppTransportSecurity json -o - Porticle.app/Contents/Info.plist
```

Expected fuse state:

- RunAsNode disabled;
- cookie encryption enabled;
- Node options disabled;
- CLI inspect disabled;
- embedded ASAR validation enabled;
- only-load-from-ASAR enabled;
- browser-specific V8 snapshot disabled (Porticle does not ship a custom snapshot);
- file protocol extra privileges disabled;
- WebAssembly trap handlers enabled.

The plist check must report `NSAllowsArbitraryLoads: false` and `NSAllowsLocalNetworking: true`.
Porticle's main plist must not contain camera, microphone, audio-capture, or Bluetooth usage
descriptions.

Open the app, verify the tray icon, inspect live TCP/UDP records, copy/open a known development server, watch an unused port, and safely stop a disposable fixture process.

### Windows

Verify the Authenticode signature in file properties and PowerShell:

```powershell
Get-AuthenticodeSignature .\Porticle-0.1.0-windows-x64.exe | Format-List
```

Install per-user, verify the tray icon and startup preference, inspect a disposable TCP and UDP fixture across IPv4/IPv6 where available, exercise graceful and force fallback, then uninstall and confirm settings remain by default.

## Local package smoke tests

macOS contributors without a Developer ID certificate can build a runnable ad-hoc package:

```bash
npm run package:mac:adhoc
```

Ad-hoc signing is necessary because flipping Electron fuses changes the Electron binary. It is not a substitute for Developer ID signing or notarization and must never be uploaded as a release artifact.

Windows contributors can build an unpacked smoke package with:

```powershell
npm run build
npx electron-builder --win dir --x64 --publish never
```

## Failure policy

- Do not publish an unsigned or unnotarized replacement manually.
- Do not disable ASAR integrity or security fuses to get a release through.
- Do not reuse a version tag after artifact publication. Increment the patch version.
- If one architecture fails, keep the release draft and fix the source/workflow; do not publish a partial release without documenting and approving the exception.
- Never omit `latest-mac.yml`, `latest.yml`, the macOS ZIP blockmaps, or Windows NSIS blockmaps; the
  in-app updater depends on those exact files.
