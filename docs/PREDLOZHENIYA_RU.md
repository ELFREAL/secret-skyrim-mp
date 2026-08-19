# Предложения по дальнейшей разработке Core GM

## Статус документа

Этот документ фиксирует направления, которые могут ускорить дальнейшую разработку текущего форка SkyMP Core GM 5.1.

Ключевое решение на текущем этапе:

- интеграция с Discord **не нужна и не планируется**;
- проект пока не должен зависеть от Discord-аккаунтов, Discord-ролей или Discord-ban систем;
- главный технический приоритет — **голосовой чат**;
- голосовой чат нужно реализовать **без пересборки SkyMP / scam_native.node / C++-ядра**;
- желаемая модель — отдельный Mumble-based voice слой, похожий по идее на голос в FiveM: игра управляет тем, кого и как слышно, а сам голос передаётся отдельной voice-системой.

---

## Принятый поэтапный план voice

Работа выполняется последовательно. Следующий этап начинается только после реальной проверки предыдущего.

### Stage 1 — Launcher — ЗАВЕРШЁН

Electron launcher реализован и проверен на Windows.

Он:

- просит выбрать папку Skyrim при первом запуске;
- сохраняет путь;
- проверяет Skyrim/SKSE/SkyMP client;
- запускает игру через `skse64_loader.exe`;
- отслеживает `SkyrimSE.exe`;
- возвращается после завершения игры.

Исходники: `launcher/secret-skyrim-electron-launcher/`.

### Stage 2 — Mumble lifecycle — РЕАЛИЗОВАН В ИСХОДНИКАХ

Mumble client включается в клиентскую поставку как Voice Runtime и управляется существующим launcher:

```text
Играть
  -> старт bundled Mumble
  -> автоматическое подключение к voice server
  -> старт SKSE
  -> ожидание SkyrimSE.exe
  -> Skyrim exit
  -> закрытие только launcher-owned Mumble
```

Launcher использует отдельный Mumble JSON-профиль, запускает только свой Mumble PID, ждёт localhost SkyrimVoice bridge перед SKSE и завершает свой Mumble после Skyrim.

### Stage 3 — Voice внутри Skyrim — РЕАЛИЗОВАН В ИСХОДНИКАХ

Реализовано:

1. `voice-client.js` получает локальную позицию/направление персонажа;
2. данные передаются локальному SkyrimVoice Mumble plugin;
3. включается positional audio;
4. PTT управляется из Skyrim;
5. `profileId` связывается с Mumble user;
6. SkyMP `VoiceService` рассчитывает допустимую слышимость;
7. учитываются расстояние и `world/cell`;
8. добавляются reconnect/fail-safe сценарии.

MVP Stage 3 — только естественная речь поблизости. Серверный gamemode обновлён до 5.2.0; клиентский bridge, Mumble plugin source и build scripts добавлены. Следующая операция — Windows build + двухклиентская проверка по `docs/VOICE_STAGE2_3_RU.md`.

---

# 1. Главный приоритет: голосовой чат на Mumble

## Цель

Сделать встроенный по ощущениям голосовой чат, при этом не встраивать Mumble внутрь SkyMP и не пересобирать сам проект SkyMP.

Игрок должен запускать клиент через Secret Skyrim MP Launcher и получать голос автоматически, не взаимодействуя с интерфейсом Mumble.

Желаемая архитектура:

```text
Skyrim + SkyMP client
        |
        | игровые данные
        | actorId / profileId / позиция / состояние
        v
Client Voice Bridge / Launcher
        |
        | управление Mumble
        v
Mumble client / voice component
        |
        | голосовой трафик
        v
Mumble Server
```

Серверная часть:

```text
SkyMP gamemode
     |
     | определяет правила слышимости
     | proximity / world/cell / mute
     v
Voice state / routing data
     |
     v
клиентский voice bridge
```

## Что означает «без пересборки проекта»

На первом варианте реализации **не трогаем**:

- C++ исходники SkyMP;
- `scam_native.node`;
- сетевой протокол SkyMP;
- сборку самого skymp5-server;
- сборку SkyrimPlatform, если можно обойтись существующими API.

Допустимые места интеграции:

- `gamemode.js` и будущие JS-модули gamemode;
- SkyrimPlatform/client-side JavaScript;
- CEF UI;
- launcher;
- стандартный Mumble server;
- Mumble client API / positional audio / IPC / plugin-механизм, если это позволит сделать интеграцию без изменения SkyMP core.

## Первая версия голосового чата

Первая рабочая версия должна быть максимально простой:

1. Игрок подключается к SkyMP.
2. Voice-компонент подключает его к нужному Mumble server.
3. SkyMP знает `actorId`, `profileId` и позицию игрока.
4. Voice bridge получает позицию локального игрока.
5. Игроки слышат друг друга по расстоянию.
6. Дальние игроки не слышны.
7. При выходе с сервера voice-сессия очищается.

На первой версии **не нужны**:

- Discord;
- телефон;
- рации;
- фракционные каналы;
- голосовые эффекты;
- сложная система помещений;
- голос через стены;
- многоуровневые permissions.

Сначала нужен надёжный proximity voice.

## После работающего proximity voice

После MVP приоритет — качество и надёжность базовой речи:

- корректная привязка voice identity к игровой сессии;
- стабильный reconnect;
- точная ориентация/позиционирование;
- корректная изоляция разных `world/cell`;
- настройка микрофона и громкости через наш UI;
- индикатор speaking/voice status в HUD;
- fail-safe при падении Skyrim, Mumble или локального bridge.

Радио, телефоны и современные коммуникационные каналы **не планируются**, так как не соответствуют сеттингу Skyrim.

Допустимое возможное расширение в далёком будущем — отдельная игровая механика **телепатии/магической связи**. Она должна реализовываться как правило игрового мира поверх базового voice routing, а не как радио или телефон.

---

# 2. RP Chat из skymp5-scripts

Готовые идеи из `alekcey0211/skymp5-scripts` стоит использовать как reference и частично перенести в JS.

Особенно полезны:

- proximity chat;
- RP chat;
- OOC chat;
- `/me`;
- action formatting;
- расстояния чата;
- цвета;
- локализация;
- registry команд.

Не рекомендуется переносить старую реализацию `/ban` как готовую систему наказаний.

Целевая структура:

```text
gamemode/
  chat/
    ChatService.js
    ChatFormatter.js
    ChatDistance.js
    ChatCommands.js
```

Важно: текстовый proximity chat и voice proximity должны в будущем использовать общий сервис расчёта расстояний/видимости, чтобы правила не расходились.

---

# 3. Rate limiting / антиспам

Рекомендуемый готовый модуль: `rate-limiter-flexible`.

Применение:

- сообщения чата;
- команды;
- admin actions;
- CEF events;
- будущие HTTP/API endpoints;
- защита от event flooding.

На первом этапе можно использовать in-memory storage без Redis/Mongo.

Пример логики:

```text
profileId
   |
   +-- не более N chat messages / период
   +-- не более N commands / период
   +-- не более N UI events / период
```

---

# 4. PermissionService

На текущем этапе не обязательно подключать тяжёлый RBAC framework.

Сначала лучше сделать собственный маленький интерфейс:

```js
Permissions.can(session, "admin.kick")
Permissions.can(session, "admin.teleport")
Permissions.can(session, "admin.mute")
```

Пример ролей:

```text
player
moderator
admin
developer
```

Позже, если появятся десятки ролей и permission rules, можно рассмотреть Casbin.

Discord-роли в этой системе **не используются**.

---

# 5. UI через data/ui + uiPort

Текущий UI уже вынесен из `gamemode.js`, но следующим этапом стоит отказаться от передачи большого HTML как data URL.

SkyMP умеет отдавать содержимое `${dataDir}/ui` через HTTP.

Целевая структура:

```text
data/
  ui/
    core/
      index.html
      app.js
      style.css
      assets/
```

Преимущества:

- нормальная структура frontend;
- отдельные CSS/JS файлы;
- проще hot reload;
- проще делать HUD, chat, admin и voice indicators;
- не нужно кодировать HTML в Base64/data URL;
- легче перейти на современный frontend stack позднее.

---

# 6. Metrics

В официальном SkyMP уже есть Prometheus infrastructure.

Стоит добавить свои игровые метрики:

```text
gm_players_online
gm_chat_messages_total
gm_commands_total
gm_admin_actions_total
gm_voice_connected
gm_voice_errors_total
gm_voice_reconnects_total
gm_tick_errors_total
```

Особенно важно добавить voice metrics при разработке Mumble integration: это позволит видеть проблемы соединения, реконнекты и рассинхронизацию игровых/voice сессий.

---

# 7. Database / persistence

SkyMP уже поддерживает:

- file;
- MongoDB;
- zip;
- migration driver.

Пока сервер находится в разработке, `file` driver можно оставить.

MongoDB стоит рассматривать позднее, когда понадобится публичный сервер, централизованные данные и резервное копирование.

Не нужно сейчас переписывать сохранение позиции/мира в собственную БД: native persistence SkyMP уже делает эту работу.

Отдельная БД в будущем больше нужна для прикладных сущностей:

- accounts;
- characters;
- bans;
- sanctions;
- economy transactions;
- organizations;
- audit history;
- voice/session metadata, если оно потребуется.

---

# 8. Koa + WebSocket для внешней админки

Это полезное направление, но не текущий приоритет.

В будущем отдельную web-админку можно построить как:

```text
Web Admin
   |
REST / WebSocket
   |
Koa + ws
   |
Gamemode Services
   |
SkyMP
```

Возможности:

- игроки online;
- characters;
- bans;
- chat logs;
- audit log;
- kick/mute/teleport;
- server status;
- voice status.

До стабилизации голосового чата эту задачу можно отложить.

---

# 9. Старые SkyMP UI проекты

`@skymp/skymp-ui-components` и старые SkyMP gamemode frontend проекты можно использовать как reference для:

- Skyrim-style дизайна;
- размеров элементов;
- шрифтовой композиции;
- chat UI;
- auth screens;
- HUD ideas.

Не рекомендуется строить новый frontend непосредственно на старом React 16 / node-sass stack.

---

# 10. NirnLab UI Platform

Сейчас не подключать.

Она может стать полезной позднее, если штатного CEF станет мало и потребуются:

- несколько независимых браузеров;
- сложный HUD;
- native cursor;
- отдельный inventory/browser;
- более глубокая C++ ↔ JS интеграция.

Но это добавляет SKSE/C++ dependencies и противоречит текущей цели — развиваться без пересборки ядра.

---

# Приоритет разработки

Текущий порядок работ:

```text
1. Launcher Stage 1 — ГОТОВО
2. Launcher Stage 2 — bundled Mumble lifecycle
3. Voice Stage 3 — Skyrim -> Mumble positional integration
4. Voice identity/session binding
5. Distance + world/cell mute lifecycle
6. UI voice indicator / microphone settings
7. ChatService + RP proximity chat
8. Rate limiting
9. PermissionService
10. UI migration в data/ui / metrics / дальнейшие RP системы
```

## Основной принцип

Сейчас задача не в том, чтобы построить всю RP-инфраструктуру.

Задача — сохранить уже рабочие:

- подключение игрока;
- persistence позиции;
- чат;
- админку;

и добавить к ним **надёжный proximity voice**, не превращая проект в собственный форк SkyMP C++.

