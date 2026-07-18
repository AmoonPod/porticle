## What changed

<!-- Describe the user-visible outcome and the smallest relevant implementation detail. -->

## Why

<!-- Link an issue or describe the workflow problem. -->

## Safety and platform impact

- [ ] No new renderer authority or IPC channel.
- [ ] New IPC is sender-checked, strictly validated, and resolves main-process state.
- [ ] No shell interpolation or unbounded subprocess output.
- [ ] Termination/process identity behavior is unchanged, or the race analysis is explained below.
- [ ] macOS and Windows behavior was considered.
- [ ] No secrets or private process data appear in fixtures or screenshots.

Details:

<!-- Explain any changed permissions, commands, persistence, URLs, or OS APIs. -->

## Verification

- [ ] `npm run format:check`
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npm run test:e2e` when renderer behavior changed
- [ ] Tested at 420 × 640 in light and dark themes when UI changed
- [ ] Added parser/race/permission fixtures when platform behavior changed

## Screenshots

<!-- Required for visible UI changes. Redact command lines and paths. -->

## Changelog

- [ ] Added an entry under `CHANGELOG.md` → `Unreleased`, or this change is not user-visible.
