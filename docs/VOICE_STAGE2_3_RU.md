# Voice Stage 2 + 3 — Mumble lifecycle и proximity voice

Дата: 19.08.2026
Core GM: **5.2.0**
Цель: встроенный для игрока голос без пересборки SkyMP/Mumble.

## Stage 2 — launcher + Voice Runtime

Реализовано в `launcher/secret-skyrim-electron-launcher/`.

Launcher управляет Mumble как дочерним runtime игровой сессии:

```text
Играть
  -> Voice/runtime/mumble.exe
  -> отдельный Voice/profile/mumble_settings.json
  -> SkyrimVoice.dll поднимает 127.0.0.1:38471
  -> skse64_loader.exe
  -> SkyrimSE.exe
  -> выход Skyrim
  -> закрытие только launcher-owned Mumble PID
```

Используется штатный Mumble `--config` и `--multiple`, поэтому личный Mumble пользователя не используется.

Mumble runtime не хранится в исходном ZIP репозитория как сторонний бинарник. На Windows build-машине `tools/prepare-voice-runtime.ps1` копирует официальный установленный Mumble 1.5.x в дистрибутив. Игрок ничего не устанавливает.

## Stage 3 — игровой proximity voice

### Client

Новые файлы:

- `CLIENT/Data/Platform/Plugins/secret-skyrim-voice.js`
- `CLIENT/Data/Platform/Plugins/secret-skyrim-voice-settings.txt`

Client bridge отправляет только localhost-данные:

- `profileId`;
- позицию;
- направление персонажа;
- heartbeat;
- PTT;
- server-authorized `audible[]`.

Аудиопакеты через SkyMP не передаются.

### Mumble plugin

Исходник:

`launcher/secret-skyrim-electron-launcher/Voice/plugin-src/SkyrimVoice.cpp`

Функции:

- Mumble positional data;
- Mumble audio feature;
- localhost HTTP bridge `127.0.0.1:38471`;
- `/state`, `/route`, `/ptt`, `/health`;
- PTT через Mumble API;
- mapping `sk_<profileId>` -> Mumble userId;
- fail-safe PTT timeout;
- fail-closed route timeout;
- серверная voice-route применяется в `mumble_onAudioSourceFetched`: PCM пользователей вне `audible[]` обнуляется до микширования.

### Server

`runtime/gamemode.js` обновлён до **5.2.0**.

Добавлено:

- `gmVoiceTransport` — transient owner-only transport;
- `voiceRoutes` — authoritative route state только в RAM;
- пересчёт каждые 250 ms;
- same-cell/world check;
- enter radius 1190 units;
- leave radius 1330 units;
- отправка route только при изменении.

`gmVoiceTransport` после доставки очищается. Физическая позиция по-прежнему остаётся нативной SkyMP world persistence; voice не создаёт отдельное сохранение координат.

## Проверки в этой сборке

В Linux/container выполнено:

- `node --check runtime/gamemode.js` — OK;
- `node --check secret-skyrim-voice.js` — OK;
- launcher JS syntax — OK;
- launcher runtime tests — OK;
- voice-runtime config tests — OK;
- mock SkyMP с 1 игроком — `gmVoiceTransport` создаётся;
- mock SkyMP с 2 игроками в одной cell на расстоянии 500 units — `[2]` попадает в audible игрока 1;
- после смены cell игрока 2 — audible игрока 1 становится `[]`.

Здесь нельзя выполнить Windows-only части: сборку MSVC `SkyrimVoice.dll`, запуск Mumble/Skyrim и реальный двухклиентский audio test. Для них `build.ps1` и Windows acceptance sequence описаны в launcher README.

## Следующая реальная проверка на Windows

1. Запустить `build.ps1` и получить `dist/Launcher.exe + Voice/`.
2. Убедиться, что launcher показывает `Голос — ГОТОВО`.
3. Нажать `Играть`: Mumble должен запуститься автоматически и bridge стать ready до SKSE.
4. На двух клиентах войти с разными `profileId`.
5. Проверить PTT N, направление звука, дистанцию и разные interiors.
6. Закрыть Skyrim и проверить, что launcher-owned Mumble завершился.
