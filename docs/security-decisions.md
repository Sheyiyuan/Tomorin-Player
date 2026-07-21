# Security Decisions

## Loopback Proxy CORS

The loopback audio/image proxy keeps `Access-Control-Allow-Origin: *`. Wails production origins and the Vite development origin differ by platform, and media range requests must work from each of them. Access is still constrained by all of the following controls:

- The server listens only on loopback and uses a dynamically selected port.
- Every request requires the current process's random proxy token.
- Only the required HTTP methods are accepted.
- Upstream URL scheme, credentials, port, hostname, DNS results, redirects, and resolved IP addresses are validated against the Bilibili/CDN policy.

Restricting the origin header would add a platform-specific compatibility list without replacing the token boundary.

## SQLite Concurrency

SQLite uses a 5-second busy timeout, foreign keys, and a single database connection. WAL is intentionally not enabled: the desktop process is the only database owner and serializes writes through one connection, so WAL would add migration and sidecar-file behavior without a measured concurrency benefit.

`SongRef` updates are full replacements inside a transaction. Existing row IDs preserve insertion order when associations are loaded. A new unique/order schema is deferred because adding composite indexes to existing databases could reject historical duplicate rows; any future schema change must first include a repeatable cleanup migration and an explicit position column.

## Deferred Static Analysis And Signing

`go test`, `go vet`, TypeScript, ESLint, and dependency-locked builds are required today. `govulncheck` should be added only with a pinned tool version and a documented vulnerability triage policy so tool/database updates do not make releases non-reproducible.

Windows code signing and macOS signing/notarization require protected signing identities and platform secrets. The current unsigned artifacts are identified in the release verification document; signing remains release infrastructure work rather than an untracked build-script toggle.
