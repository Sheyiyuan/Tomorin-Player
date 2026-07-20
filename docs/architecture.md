# Frontend Architecture

The frontend uses four domain contexts as its only shared state sources:

- `PlayerContext`: current song, queue, playback status, volume, and play mode.
- `DataContext`: songs, favorites, selected playlist, settings, and lyrics.
- `ThemeContext`: theme collection, active theme, derived theme values, and persistence entry points.
- `UIContext`: typed modal visibility and open/close commands.

`App.tsx` connects domain hooks and lifecycle effects, then delegates view props to `useAppPanelsProps` and modal props to `useAppModalsProps`. Modal props are grouped per modal instead of using one flat interface, and each modal is loaded with `React.lazy` only while open.

Queue persistence is owned by `PlayerContext`. Theme changes use `applyTheme`, and durable application data is owned by SQLite through the Wails service layer. Removed legacy contexts and V2 player hooks are not compatibility APIs and must not be reintroduced as parallel state sources.

Initial backend data is loaded by `useAppLifecycle`. Song, playlist, and settings mutations await the Wails RPC before replacing Context state; failures keep the previous value and report an error. Theme selection persists the selected ID before calling `applyTheme`, so a backend failure leaves the active UI theme unchanged. Theme create, update, delete, and selection RPCs own theme persistence; `useSettingsPersistence` saves playback settings and volume compensation without duplicating theme writes. Queue persistence is enabled only after hydration and writes each queue or index change once, including an empty queue. Play history is written when a song starts, so shutdown does not depend on asynchronous `beforeunload` work.

## Context Reads

The `usePlayerStore`, `useDataStore`, `useThemeStore`, and `useUIStore` selector arguments select return values only. React Context still rerenders every consumer when its Provider value changes. The four-domain split prevents unrelated domains from sharing a Provider, but it is not a fine-grained subscription mechanism.

Further Provider splitting should be driven by React Profiler measurements. A sustained update over one frame (16 ms) in a frequently changing provider is the threshold for splitting state/actions or adopting a context-selector library.
