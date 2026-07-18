# Security policy

Porticle can enumerate local processes and terminate them. Treat vulnerabilities that cross that boundary seriously.

## Supported versions

| Version                  | Security updates      |
| ------------------------ | --------------------- |
| `0.1.x`                  | Yes                   |
| older / unreleased forks | No guaranteed support |

After the first stable release, this table will track the current and previous supported minor lines.

## Report privately

Use **GitHub private vulnerability reporting** on the repository’s Security tab. Do not open a public issue, discussion, or pull request containing exploit details.

Include:

- affected Porticle version and commit;
- operating system, version, and architecture;
- clear reproduction steps;
- expected and observed authority boundary;
- impact and any known workaround;
- logs or fixtures with secrets, usernames, commands, and paths redacted.

If private vulnerability reporting is unavailable on a fork, contact that fork’s maintainers through a private channel before publishing details.

## Response targets

- Acknowledgement: within 3 business days.
- Initial severity assessment: within 7 business days.
- Coordinated fix target: based on severity and platform dependencies.

Maintainers will keep the reporter informed, request a CVE when appropriate, and credit the reporter unless anonymity is requested.

## High-priority examples

- A compromised renderer can execute an arbitrary command or signal an arbitrary PID.
- IPC sender or frame validation can be bypassed.
- A crafted endpoint or command causes shell/PowerShell injection.
- Porticle elevates, persists, or expands OS authority without explicit user action.
- A race lets a stale request terminate a different process after PID reuse.
- Navigation or external URL checks permit non-local or attacker-controlled content.
- Packaged code can bypass ASAR integrity or hardened fuses.
- Update metadata can redirect the app away from the fixed GitHub release channel, permit a
  downgrade, or install an unsigned artifact.
- Persisted settings allow code execution or unsafe path traversal.

## Expected behavior, not vulnerabilities

- An ordinary user cannot stop a protected or other-user process.
- Some command lines are unavailable without additional OS permission.
- A supervisor can restart a process and reopen a port after termination.
- Process command lines may contain secrets supplied by that process. Porticle displays them locally and never transmits them; screenshots and reports must be redacted.
- A local administrator can tamper with the application or other processes. Porticle does not claim to defend against an already privileged attacker.

## Security baseline

The current baseline is documented in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): sandboxed renderer, context isolation, frozen typed preload methods, sender-checked strict IPC, secure custom protocol, restrictive CSP, deny-by-default navigation and permissions, fixed no-shell subprocesses, identity-bound termination, a fixed GitHub update channel with manual install controls, platform-signed release artifacts, ASAR integrity, and hardened Electron fuses.
