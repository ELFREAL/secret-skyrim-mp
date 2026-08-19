# Secret Skyrim MP

Source, build automation and version history for the Secret Skyrim MP SkyMP fork.

Current project version: **0.1.0**. Core gamemode: **5.2.0**.

## Repository layout

- `server/` — Core GM 5.2, configuration, UI and pinned prebuilt SkyMP server runtime.
- `client/skyrim-platform/` — SkyMP/SkyrimPlatform client scripts and voice bridge.
- `launcher/` — Electron launcher source.
- `voice/mumble-plugin/` — SkyrimVoice Mumble plugin source.
- `scripts/` — validation and release packaging.
- `docs/` — Russian technical documentation and changelog.
- `.github/workflows/` — validation, Windows builds and tagged releases.

## Build model

The repository is intentionally source-first. Developers do **not** need to keep Visual Studio, Mumble or Electron runtime binaries in Git.

Every push to `main` runs the Windows build on GitHub Actions. The runner:

1. validates JS/configuration;
2. downloads pinned Mumble **1.5.915** from the official Mumble download host;
3. downloads the pinned official Mumble Server runtime for the server artifact;
4. builds `SkyrimVoice.dll` with MSVC available on `windows-latest`;
5. installs Electron dependencies only on the runner;
6. builds the portable launcher;
7. creates client/server/source ZIP archives and SHA-256 checksums.

A tag such as `v0.1.0` performs the same build and publishes permanent GitHub Release assets.


## Bundled voice server

The Windows server artifact contains the official pinned Mumble Server runtime.
Server administration is intentionally one-start:

`START_SECRET_SKYRIM_SERVER.cmd`

The supervisor starts the bundled `mumble-server.exe` on TCP/UDP 64738 first,
then starts the SkyMP RP server. When the RP server exits, it terminates only
the Mumble Server process that it started.

No Mumble Server installation is required on the host machine.

## Artifacts

Development build:

`Actions -> Build Windows -> Artifacts`

Versioned build:

`Releases -> vX.Y.Z`

Expected assets:

- `secret-skyrim-mp-client-X.Y.Z.zip`
- `secret-skyrim-mp-server-X.Y.Z.zip`
- `secret-skyrim-mp-source-X.Y.Z.zip`
- `SHA256SUMS.txt`

## Not stored in Git

- Skyrim executables, masters, BSA files or other Bethesda assets;
- world saves/changeForms and audit logs;
- production secrets/tokens;
- production server address (tracked client settings use localhost as a safe development default);
- Mumble runtime;
- Electron `node_modules` and `dist`;
- full generated SkyMP/CEF client distribution.

## Important security note

The checked-in development server configuration currently uses `offlineMode=true`. In that mode `profileId` is client-controlled and must **not** be trusted for a public production server, staff authorization or bans. Production authentication/master integration is a separate required milestone.

## Pinned upstream

SkyMP commit:

`2abd0a0391278335face3c13ff0e2cabf76344b0`

Mumble:

`1.5.915`

See `THIRD_PARTY/README.md` for provenance and redistribution notes.

## Local build

Local Windows build remains possible via `launcher/build.ps1`, but the preferred path is GitHub Actions so developers do not need the heavy build toolchain permanently installed.
