# Secret Skyrim MP Launcher — Stage 1

Статус: **завершён и проверен на Windows** 19.08.2026.

## Назначение

Stage 1 заменяет пользовательский запуск через `.bat/.cmd` полноценным Electron launcher.

Исходники:

```text
launcher/secret-skyrim-electron-launcher/
```

## Что реализовано

- Electron desktop launcher;
- Skyrim/Nordic оформление;
- portable Windows build через `electron-builder`;
- при первом запуске системный выбор папки Skyrim Special Edition;
- выбранный путь хранится в Electron `userData/launcher-config.json`;
- проверяются:
  - `SkyrimSE.exe`;
  - `skse64_loader.exe`;
  - `Data/Platform/Plugins/skymp5-client.js`;
- запуск игры выполняется **только через `skse64_loader.exe`**;
- рабочая директория процесса SKSE — выбранная папка Skyrim;
- перед запуском проверяется, что `SkyrimSE.exe` ещё не работает;
- после старта SKSE launcher ожидает реальный процесс `SkyrimSE.exe`;
- launcher запоминает PID игры и отслеживает завершение;
- после успешного запуска окно сворачивается;
- после выхода Skyrim окно возвращается;
- действует single-instance lock самого launcher.

## Что намеренно отсутствует

Stage 1 не содержит:

- Mumble;
- voice transport;
- positional audio;
- PTT;
- Discord;
- радио/телефоны;
- серверную voice routing логику.

## Сборка

Подробная инструкция:

```text
launcher/secret-skyrim-electron-launcher/README_BUILD_RU.md
```

Основная команда на Windows PowerShell:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\build.ps1
```

Готовый portable binary:

```text
dist/Secret Skyrim MP Launcher.exe
```

Build script может извлечь иконку из локального `SkyrimSE.exe` для Windows binary.

## Принятый жизненный цикл игры

```text
Launcher
   |
   +-- выбрать/прочитать сохранённую папку Skyrim
   |
   +-- проверить SkyrimSE.exe / SKSE / SkyMP
   |
   +-- запустить skse64_loader.exe
   |
   +-- дождаться SkyrimSE.exe
   |
   +-- отслеживать PID SkyrimSE.exe
   |
   +-- Skyrim завершён
   |
   `-- вернуть launcher в ready state
```

## Следующий этап

Stage 2 должен расширить **этот же launcher**, а не создавать отдельный механизм запуска:

```text
Играть
  |
  +-- запустить launcher-owned Mumble client / Voice Runtime
  +-- автоматически подключить его к Mumble Server
  +-- запустить SKSE
  +-- отслеживать SkyrimSE.exe
  `-- после выхода Skyrim корректно закрыть только тот Mumble process,
      который был запущен этим launcher
```

На Stage 2 ещё не требуется positional voice внутри Skyrim — сначала только надёжный lifecycle Mumble вместе с игровой сессией.

После успешной проверки Stage 2 начинается Stage 3: voice integration внутри игры.
