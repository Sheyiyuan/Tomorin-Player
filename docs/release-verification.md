# Release Verification Status

The release workflow builds only after the shared `make check` quality job passes. Platform packaging is routed through the root Makefile, while the existing shell and PowerShell scripts remain the platform-specific implementations. It publishes:

- Windows portable executable and NSIS installer.
- Debian `half-beat_<version>_amd64.deb`.
- RPM `half-beat-<version>-<release>.x86_64.rpm`.
- macOS `half-beat-<version>.dmg`.

No standalone Linux binary is currently published.

## Verification Matrix

| Target | Automated coverage | Installation or launch status |
| --- | --- | --- |
| Linux source | Go test/vet, frontend typecheck/lint/test/build, shell syntax | Verified on Linux development host |
| DEB | Package build plus clean Debian Bookworm container install in CI | Dependency resolution and `ldd` checked before release |
| RPM | Package build plus clean Fedora 43 container install in CI | Dependency resolution and `ldd` checked before release |
| Windows | Canonical icon check, cross-compile, PE icon-resource verification, and NSIS generation in CI | Windows runner performs silent install, version check, and uninstall |
| macOS | Canonical icon check, universal app, `CFBundleIconFile`/ICNS checks, and required DMG generation | macOS runner launches the `.app` and verifies the application remains running |

The release job depends on all platform smoke jobs, so failed installation or launch checks prevent publication. Code signing and macOS notarization are still future release-hardening work.

Windows UI builds retain the complete semantic development version. PE and NSIS metadata use the numeric `x.y.z` prefix because Windows version resources cannot represent prerelease suffixes; the Windows smoke test checks this normalized value.

Windows 11 visual verification is still required before a release when the application icon changes. Test a clean install and an overwrite install in Explorer, Start, Alt+Tab, and the running taskbar. An icon mismatch limited to a taskbar item pinned before the upgrade is treated as shell cache state after the EXE resource check passes.
