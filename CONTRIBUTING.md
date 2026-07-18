# Contributing to Porticle

Thanks for helping make local development less mysterious. Porticle is intentionally focused, so a small, well-tested change is preferable to a broad new subsystem.

## Before opening a change

- Search existing issues and pull requests.
- For a bug or contained improvement, open a pull request directly.
- For a new platform, background service, elevated helper, persistent data store, network integration, or major workflow, open a proposal first. Those change Porticle’s trust or product boundary.
- Never include private command-line arguments, usernames, paths, tokens, or customer project names in fixtures or screenshots.

## Development setup

You need Node.js 24+, npm 11+, and macOS or Windows.

```bash
npm ci
npm run dev
```

For renderer work without starting Electron:

```bash
npm run dev:renderer
```

That mode uses deterministic local mock data. It cannot execute process actions.

## Required checks

Run these before submitting:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Parser or platform changes must include anonymized fixtures for success, empty output, malformed output, missing metadata, and permission-limited behavior where applicable.

## Project conventions

### TypeScript

- Keep `strict`, `exactOptionalPropertyTypes`, and `noUncheckedIndexedAccess` clean.
- Prefer explicit domain types at process and IPC boundaries.
- Do not use `any` to bypass OS output validation.
- Keep renderer contracts serializable and platform-neutral.

### Security

- Renderer code must not import Node.js or Electron.
- Do not expose `ipcRenderer`, an arbitrary channel, filesystem access, command execution, or `shell.openExternal` through preload.
- Every new IPC channel needs sender validation, a strict Zod argument tuple, and main-process state resolution.
- Spawn fixed executables with argument arrays and `shell: false`.
- Never interpolate renderer or user input into PowerShell, command prompt, or POSIX shell text.
- Maintain ordinary-user operation. Elevation proposals require a separate threat model and will not be accepted as incidental changes.

### UI

- Design for the canonical 420 × 640 popover first.
- Keep primary actions usable by keyboard.
- Add an accessible name to icon-only controls.
- Do not add persistent navigation, vanity metrics, animation systems, or generic settings categories.
- Test light, dark, system preference, custom accent, 200% scaling, long commands, empty results, permission errors, and reduced motion.

### Platform adapters

The discovery interface belongs in `src/main/ports/`. A platform adapter returns raw endpoints plus a process catalog; shared normalization owns IDs, scopes, recognition, protection, and sorting.

Do not parse localized human-readable output when a stable field/JSON mode exists. Fixed OS programs should use absolute trusted paths when practical.

## Updating brand assets

Edit the canonical SVGs, then regenerate and inspect all outputs:

```bash
npm run icons
npm run screenshots
```

Tray changes must remain legible at 16–20 physical pixels. Commit the source SVGs, generated package icons, and documentation screenshots. `resources/generated/` is a disposable working directory and is ignored.

## Commit and pull request quality

- Keep commits logically scoped.
- Use an imperative subject, for example `fix: preserve IPv6 scope during Windows discovery`.
- Explain user impact, safety considerations, and verification in the pull request template.
- Update `CHANGELOG.md` under **Unreleased** for user-visible changes.
- Do not commit generated `out/`, `release/`, coverage, Playwright report, logs, or local settings.

## Reporting security issues

Do not open a public issue. Follow [SECURITY.md](SECURITY.md).

Participation is governed by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
