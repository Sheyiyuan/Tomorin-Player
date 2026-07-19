# Frontend Performance Baseline

Measured on 2026-07-19 with:

```bash
cd frontend
pnpm run build
```

Vite production output:

| Chunk | Minified | Gzip |
| --- | ---: | ---: |
| Main application JS | 539.18 kB | 165.77 kB |
| Theme detail modal | 871.68 kB | 307.27 kB |
| Login modal | 26.85 kB | 10.87 kB |
| Global search modal | 11.47 kB | 3.77 kB |
| Playlist modal | 3.87 kB | 1.68 kB |
| BV add modal | 4.11 kB | 1.83 kB |
| Edit favorite modal | 1.11 kB | 0.62 kB |

All feature modals are emitted as separate chunks, so lazy loading is effective. The theme detail chunk is intentionally deferred because its JSON code editor is the largest optional dependency.

Download status refresh uses one `GetDownloadedSongIDs` Wails call for the current song library. Image proxy resolution coalesces pending requests and caches resolved proxy URLs. Window maximize state is updated from resize events rather than polling.

## List Virtualization Decision

Virtualization was evaluated but is not enabled yet. The current list rows contain several interactive controls and typical libraries remain below the point where the extra focus and measurement complexity is justified. Re-evaluate with React Profiler when a playlist exceeds 500 visible rows or a list commit exceeds 50 ms on a supported minimum-spec machine. Batch download lookup removes the previous per-row RPC cost regardless of row count.

Context subscription behavior and the threshold for further splitting are documented in [architecture.md](architecture.md).
