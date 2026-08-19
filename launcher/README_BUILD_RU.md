# Secret Skyrim MP Launcher + Voice — сборка Windows

Статус проекта: **Stage 1 launcher принят; Stage 2 (Mumble lifecycle) + Stage 3 (Skyrim proximity voice) реализованы в исходниках.**

## Что теперь делает launcher

1. При первом запуске просит указать папку Skyrim и запоминает её.
2. Проверяет `SkyrimSE.exe`, `skse64_loader.exe`, SkyMP client.
3. Проверяет локальный `Voice\runtime\mumble.exe` и `Voice\runtime\plugins\SkyrimVoice.dll`.
4. Читает `profileId` и адрес игрового сервера из выбранной Skyrim-папки.
5. Запускает **свой** Mumble с отдельным JSON-профилем (`--config`, `--multiple`).
6. Автоматически подключает Mumble как `sk_<profileId>` к voice server.
7. Ждёт `SkyrimVoice` localhost bridge на `127.0.0.1:38471`.
8. Только после готовности голоса запускает `skse64_loader.exe`.
9. Следит за `SkyrimSE.exe`.
10. После выхода Skyrim закрывает только тот Mumble PID, который запустил сам.

Личный Mumble пользователя и его настройки launcher не использует.

## Требования только к машине разработчика

- Windows 10/11 x64;
- Node.js LTS + npm;
- Visual Studio 2022 Build Tools с `Desktop development with C++`;
- официальный Mumble **1.5.x x64**, установленный на build-машине (только чтобы один раз скопировать runtime в дистрибутив);
- папка Skyrim с `SkyrimSE.exe` для извлечения иконки.

**Игроку Mumble и Visual Studio устанавливать не нужно.** В готовый дистрибутив Mumble попадает как `Voice Runtime` рядом с launcher.

## Сборка одной командой

```powershell
cd "D:\path\to\secret-skyrim-electron-launcher"
Set-ExecutionPolicy -Scope Process Bypass
.\build.ps1
```

`build.ps1`:

1. извлекает Skyrim icon;
2. копирует установленный Mumble client в `Voice\runtime`;
3. скачивает официальный `MumblePlugin.h` ветки `1.5.x`;
4. собирает `SkyrimVoice.dll` MSVC x64;
5. ставит Electron dependencies;
6. запускает JS tests;
7. собирает portable launcher;
8. копирует готовый `Voice` рядом с EXE.

Выдавать игроку нужно **оба** объекта:

```text
dist\
├── Secret Skyrim MP Launcher.exe
└── Voice\
    ├── runtime\
    │   ├── mumble.exe
    │   ├── ...официальные Mumble DLL...
    │   └── plugins\
    │       └── SkyrimVoice.dll
    └── profile\
```

`Voice\profile\mumble_settings.json` launcher генерирует заново под собственный voice runtime: PTT, positional audio, 2–15 м, отдельная БД и plugin settings.

## Что должно быть установлено в Skyrim

Из папки проекта `CLIENT` должны быть скопированы в выбранную папку игры, в частности:

```text
Data\Platform\Plugins\skymp5-client.js
Data\Platform\Plugins\skymp5-client-settings.txt
Data\Platform\Plugins\secret-skyrim-voice.js
Data\Platform\Plugins\secret-skyrim-voice-settings.txt
```

## Voice server

Launcher запускает **клиентский** Mumble runtime игрока. Сам Mumble Server работает на серверной машине постоянно.

По умолчанию voice host берётся из `server-ip` SkyMP, порт — `64738`. Если Mumble Server находится на другом хосте, укажи в `secret-skyrim-voice-settings.txt`:

```json
{
  "mumbleHost": "voice.example.local",
  "mumblePort": 64738
}
```

`mumbleHost: ""` означает: использовать адрес SkyMP server.

## Proximity voice

- PTT: `N` (`pttScanCode: 49`);
- координаты Skyrim отправляются в localhost примерно 10 раз/сек;
- `70 Skyrim units = 1 m` — начальная калибровка;
- Mumble positional audio: full около 0–2 м, затем затухание, 0 громкости к 15 м;
- SkyMP route: новый игрок входит в слышимость до 1190 units (~17 м), выходит после 1330 units (~19 м), чтобы не было дребезга на границе;
- разные `world/cell` сервер не включает друг другу в `audible[]`;
- если Skyrim heartbeat исчез >1.5 сек — plugin принудительно отпускает микрофон;
- если route не обновляется >5 сек — plugin fail-closed и глушит входящую речь.

## Ограничение текущего MVP

Сервер определяет допустимый `audible[]`, но исполнение происходит в клиентском Mumble plugin. Это нормальная архитектура для нашего штатного клиента, но не криптографический voice-античит против специально модифицированного Mumble.

Радио, телефоны и Discord в эту архитектуру не входят. Возможная будущая телепатия — отдельное игровое правило поверх `VoiceService`, если понадобится.
