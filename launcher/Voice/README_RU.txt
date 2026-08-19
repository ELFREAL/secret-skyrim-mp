SECRET SKYRIM MP — VOICE RUNTIME

Эта папка после developer-build содержит приватный runtime обычного Mumble 1.5.x и SkyrimVoice.dll.
Игрок ничего не устанавливает и не настраивает вручную.

runtime\mumble.exe                 — официальный Mumble client
runtime\plugins\SkyrimVoice.dll   — наш proximity voice plugin
profile\                          — отдельный профиль Mumble, генерируется launcher
logs\                             — место для будущих voice diagnostics

Подготовка на машине разработчика:
  powershell -ExecutionPolicy Bypass -File .\tools\prepare-voice-runtime.ps1
  powershell -ExecutionPolicy Bypass -File .\tools\build-voice-plugin.ps1

После build.ps1 папка Voice копируется рядом с portable launcher EXE.
