# Core GM 5.2.0 — Voice Stage 2 + 3

Дата: 19.08.2026

## Добавлено

### Launcher / Stage 2

- bundled `Voice Runtime` рядом с portable Electron launcher;
- launcher запускает Mumble до SKSE;
- Mumble запускается с отдельным `--config` и `--multiple`;
- отдельный Mumble JSON-profile и SQLite database;
- username автоматически `sk_<profileId>`;
- voice host по умолчанию совпадает с SkyMP server host, порт 64738;
- plugin discovery зафиксирован через `MUMBLE_VERSION_ROOT=Voice/runtime`;
- launcher ждёт `GET 127.0.0.1:38471/health` перед запуском SKSE;
- после выхода `SkyrimSE.exe` завершается только launcher-owned Mumble PID;
- portable Electron корректно использует `PORTABLE_EXECUTABLE_DIR`, а не `%TEMP%` runtime path;
- build pipeline копирует официальный Mumble runtime с developer PC и собирает SkyrimVoice.dll через MSVC.

### Skyrim client / Stage 3

Новые файлы:

- `CLIENT/Data/Platform/Plugins/secret-skyrim-voice.js`;
- `CLIENT/Data/Platform/Plugins/secret-skyrim-voice-settings.txt`.

Реализовано:

- local position -> localhost bridge примерно 10 Hz;
- Skyrim XYZ -> Mumble meters conversion;
- avatar direction по `getAngleZ()`;
- PTT `N`;
- heartbeat;
- получение server route из `sp.storage.secretSkyrimVoiceRoute`;
- route refresh только пока `mpClientPlugin.isConnected()`.

### Mumble plugin

Исходник:

`launcher/secret-skyrim-electron-launcher/Voice/plugin-src/SkyrimVoice.cpp`

Реализовано:

- Mumble Plugin API 1.5.x;
- positional data;
- audio callback filtering;
- localhost HTTP endpoints `/health`, `/state`, `/route`, `/ptt`;
- `profileId` mapping через Mumble username `sk_<id>`;
- PTT через `requestMicrophoneActivationOvewrite`;
- PTT fail-safe 1.5 sec;
- route fail-closed 5 sec;
- пользователи вне `audible[]` глушатся до финального mix через `mumble_onAudioSourceFetched`.

### Server / Core GM 5.2.0

- `gmVoiceTransport` owner-only transient property;
- `voiceRoutes` хранится только в RAM;
- route calculation 250 ms;
- same-world/cell filtering;
- enter radius 1190 Skyrim units;
- leave radius 1330 units (hysteresis);
- route packet отправляется только при изменении;
- disconnect/reconnect принудительно пересчитывает routes.

## Не добавлено намеренно

- Discord;
- radio;
- telephone;
- faction voice channels;
- WebRTC;
- собственный Opus transport;
- изменения `scam_native.node`;
- изменения C++ SkyMP;
- изменения SkyrimPlatform binary.

Телепатия оставлена только как возможная будущая игровая магия, не часть текущего voice MVP.

## Что проверено здесь

- все 95 JSON-файлов парсятся;
- `node --check` gamemode/client/launcher JS — OK;
- launcher runtime tests — OK;
- voice runtime tests/config generation — OK;
- mock SkyMP: один игрок получает empty audible route;
- mock SkyMP: два игрока в одной cell на 500 units -> audible `[2]`;
- mock SkyMP: после смены cell -> audible `[]`;
- gamemode hot-reload cleanup работает.

## Что проверяется на Windows после сборки

- MSVC compile `SkyrimVoice.dll`;
- Mumble 1.5.x loads plugin automatically from `Voice/runtime/plugins`;
- localhost bridge is ready before SKSE;
- Mumble URL connection succeeds;
- PTT N;
- 3D position and attenuation;
- different interiors isolation;
- Mumble closes after Skyrim;
- crash/heartbeat fail-safe.
