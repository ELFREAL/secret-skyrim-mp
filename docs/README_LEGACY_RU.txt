SECRET SKYRIM MP — SkyMP core 5.2 + Launcher + Voice MVP
Target SkyMP commit: 2abd0a0391278335face3c13ff0e2cabf76344b0

SERVER
1) Install current Node.js LTS x64 (`node -v`).
2) Run COPY_SKYRIM_MASTERS.bat and point it at your legal Skyrim Special Edition Data folder.
3) Edit runtime\server-settings.json if needed.
4) Run START_SERVER.bat.
5) SkyMP gameplay port is 7777 unless changed in settings.

Skyrim masters are NOT redistributed. `offlineMode=true` remains development/offline identity mode.

CLIENT LAUNCHER
Source: launcher\secret-skyrim-electron-launcher\
Build: launcher\secret-skyrim-electron-launcher\README_BUILD_RU.md

Stage 1 was manually verified on Windows: the Electron launcher asks for the Skyrim folder and starts strictly through skse64_loader.exe.

VOICE STAGE 2 + 3
- Launcher now manages bundled Mumble Voice Runtime automatically.
- Players do NOT install/configure Mumble manually.
- Developer build copies official Mumble 1.5.x into dist\Voice.
- Launcher starts its own Mumble, waits for SkyrimVoice localhost bridge, then starts SKSE.
- When Skyrim exits, launcher terminates only the Mumble PID it owns.
- Client plugin: Data\Platform\Plugins\secret-skyrim-voice.js
- Voice settings: Data\Platform\Plugins\secret-skyrim-voice-settings.txt
- Mumble plugin source: launcher\secret-skyrim-electron-launcher\Voice\plugin-src\SkyrimVoice.cpp
- Core GM voice routing: runtime\gamemode.js v5.2.0
- Detailed architecture/tests: docs\VOICE_STAGE2_3_RU.md

Voice MVP is Skyrim-only natural proximity speech. No Discord, radio or phones. A future telepathy spell may be implemented later as a separate game rule.

IMPORTANT WINDOWS CHECK STILL REQUIRED
This package was prepared in Linux, so Windows-only MSVC compilation of SkyrimVoice.dll and the real two-client Mumble/Skyrim audio test could not be executed here. The build scripts are included and JS/server mock tests passed.
