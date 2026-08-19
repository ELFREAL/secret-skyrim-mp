# Voice architecture — stable baseline

The stock SkyMP client bundle is pinned and must not contain Secret Skyrim MP gameplay logic.

Verified stock client:
- file: `client/skyrim-platform/skymp5-client.js`
- size: 1,362,222 bytes
- SHA-256: `57e9b912d7095966eb808a9ad139bb526afd42428f898fa3c05c8ba437067080`

Secret Skyrim MP gameplay code is server-delivered through the stock SkyMP `GamemodeEventSourceService` and properties.
The proximity voice event source is `_coreVoice` in `server/runtime/gamemode.js`.

Client-native runtime that remains necessary:
- stock SkyrimPlatform / MpClientPlugin
- Mumble client
- `SkyrimVoice.dll` Mumble plugin
- launcher for lifecycle and auto-connect

The compatibility file `secret-skyrim-voice.js` intentionally has no runtime behavior. It exists only because the current launcher still checks that path.
