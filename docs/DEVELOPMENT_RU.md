> **Voice Stage 2 + 3 реализованы в Core GM v5.2.0 (2026-08-19).** Launcher теперь управляет bundled Mumble Voice Runtime: отдельный профиль, автоматическое подключение, проверка SkyrimVoice bridge до запуска SKSE и закрытие launcher-owned Mumble после выхода Skyrim. В клиент добавлен `secret-skyrim-voice.js`, в gamemode — RAM-only proximity `VoiceService`/`gmVoiceTransport` с distance + world/cell routing. Исходник Mumble plugin и Windows build scripts лежат в `launcher/secret-skyrim-electron-launcher/Voice/` и `tools/`. Подробности и реальные проверки: `docs/VOICE_STAGE2_3_RU.md`. Windows-only сборка DLL и двухклиентский аудиотест должны быть выполнены на build-машине.

> **Актуализация Core GM v5.1.0 (2026-08-19):** четыре cleanup-задачи из первоначального review уже выполнены: `T/F6` синхронизировано, `gmUiState` убран из persistent state, `profileId` читается напрямую из стандартного actor property без scan `1..100`, UI вынесен в `runtime/ui/core-ui.html`. Подробности: `docs/CHANGES_5_1_RU.md`. Ниже сохранён исходный большой анализ; места, описывающие эти проблемы как «текущие», следует читать как исторический review до v5.1.0.

# SkyMP RP fork — документация для дальнейшей разработки

Статус документа: зафиксировано по содержимому рабочего архива на 2026-08-19.

Цель этого файла — описать именно текущий форк, а не абстрактный SkyMP: что сейчас является рабочим ядром, где находится логика, как проходит подключение игрока, как устроены чат и админка, за счёт чего сохраняется позиция, что можно менять безопасно и в каком порядке развивать проект дальше.

## 1. Что уже работает

Текущий форк представляет собой компактное RP-ядро поверх готовой серверной и клиентской сборки SkyMP.

Рабочий контур:

- запуск сервера через `START_SERVER.bat`;
- загрузка Skyrim master-файлов из локальной легальной установки через `COPY_SKYRIM_MASTERS.bat`;
- подключение клиента к серверу;
- создание нового персонажа для нового `profileId`;
- повторное присоединение к уже существующему персонажу по `profileId`;
- сохранение физического состояния персонажа в native world-store SkyMP;
- сохранение позиции/world/cell между сессиями;
- RP-чат с локальными радиусами и командами;
- глобальный OOC;
- RP-имя;
- базовая статистика входов, смертей и времени онлайн;
- staff-роли `moderator`, `admin`, `owner`;
- `/admin` CEF-панель;
- inspect, teleport, bring, back, tpcoords, heal, resurrect, RaceMenu, kick, announcement;
- аудит staff-действий в `runtime/admin-audit.log`;
- hot-reload `runtime/gamemode.js`.

Это хорошая точка для продолжения разработки: основная кастомная серверная логика сосредоточена в одном файле и пока не зависит от внешней БД, Discord-бота, веб-панели или набора микросервисов.

---

## 2. Базовая версия и происхождение сборки

Архив собран вокруг SkyMP commit:

`2abd0a0391278335face3c13ff0e2cabf76344b0`

Публичная мета сборки также лежит в:

`CLIENT/Data/Platform/Distribution/build-metadata-public.json`

Серверный runtime использует:

`runtime/dist_back/skymp5-server.js`

Native-модуль:

`runtime/scam_native.node`

Главный кастомный gamemode:

`runtime/gamemode.js`

Текущая внутренняя версия gamemode:

`5.0.0`

Важно: в комментариях файла всё ещё встречаются старые обозначения `v4` и `Core v3`. Это только рассинхрон документации в исходнике, но перед следующей версией стоит унифицировать versioning.

---

## 3. Какие файлы считать source of truth

### Редактировать в первую очередь

`runtime/gamemode.js`

Главная серверная логика проекта: сессии, RP properties, чат, staff/RBAC, CEF bridge, команды, admin UI transport.

`runtime/gamemode-config.json`

Конфигурация вашего gamemode.

`runtime/server-settings.json`

Исходная конфигурация самого SkyMP server runtime.

`CLIENT/Data/Platform/Plugins/skymp5-client-settings.txt`

Настройки конкретного клиента: адрес сервера, порт, offline `profileId`.

### Не редактировать вручную как основной источник

`runtime/server-settings-merged.json`

Генерируемый итог после merge server settings.

`runtime/server-settings-dump.json`

Кэш/служебный dump механизма settings.

`runtime/data/manifest.json`

Генерируется сервером на основе load order и master-файлов.

`runtime/world/changeForms/*.json`

Рабочее persistent-состояние мира. Это данные, а не конфиг и не исходный код.

`runtime/dist_back/skymp5-server.js`

Собранный upstream server bundle. Не рекомендуется патчить его для обычной RP-разработки.

`CLIENT/Data/Platform/Plugins/skymp5-client.js`

Stock client plugin этой сборки. Текущий RP UI не требует правок этого файла.

`CLIENT/src/...`

В основном upstream SKSE source tree. Не является местом текущей RP-логики.

---

## 4. Структура проекта

```text
SERVER_ROOT/
├─ START_SERVER.bat
├─ COPY_SKYRIM_MASTERS.bat
├─ README_RU.txt
├─ DEVELOPMENT_RU.md             <- этот документ
│
├─ gameData/                     <- локально копируются Skyrim master files
│  ├─ Skyrim.esm
│  ├─ Update.esm
│  ├─ Dawnguard.esm
│  ├─ HearthFires.esm
│  └─ Dragonborn.esm
│
├─ runtime/
│  ├─ gamemode.js                <- основная кастомная логика
│  ├─ gamemode-config.json       <- конфиг RP-ядра
│  ├─ server-settings.json       <- конфиг SkyMP server
│  ├─ admin-audit.log            <- аудит staff
│  ├─ scam_native.node           <- native server module
│  ├─ dist_back/
│  │  └─ skymp5-server.js        <- server runtime
│  ├─ data/
│  │  └─ manifest.json
│  └─ world/
│     └─ changeForms/            <- persistent world/characters
│
├─ CLIENT/
│  └─ Data/Platform/Plugins/
│     ├─ skymp5-client.js
│     └─ skymp5-client-settings.txt
│
├─ original/                     <- сохранённые CI-оригиналы
└─ RP_RESEARCH/                  <- исследование внешних RP-реализаций
```

---

## 5. Как запускается сервер

`START_SERVER.bat` делает три основные вещи:

1. переходит в `runtime/`;
2. проверяет наличие `node`;
3. проверяет наличие пяти master-файлов в `../gameData/`;
4. запускает:

```bat
node dist_back\skymp5-server.js
```

В `runtime/server-settings.json` load order указан относительными путями:

```json
[
  "../gameData/Skyrim.esm",
  "../gameData/Update.esm",
  "../gameData/Dawnguard.esm",
  "../gameData/HearthFires.esm",
  "../gameData/Dragonborn.esm"
]
```

Это важное отличие от CI-конфига в `original/`, где были абсолютные пути build machine.

---

## 6. Архитектура выполнения

Упрощённо runtime выглядит так:

```text
Skyrim client
   │
   │ SkyMP networking
   ▼
skymp5-server.js
   │
   ├─ native ScampServer (scam_native.node)
   ├─ Login system
   ├─ Spawn system
   ├─ Save storage
   └─ gamemode.js
        │
        ├─ sessions
        ├─ custom properties gm*
        ├─ chat/RP commands
        ├─ staff/RBAC
        ├─ admin audit
        └─ makeEventSource -> Skyrim Platform browser/CEF
```

Серверный bundle вызывает `attachSaveStorage()`, после чего native world-state сохраняется в `runtime/world/`.

Gamemode загружается отдельно и отслеживается watcher'ом. При изменении `gamemode.js` runtime перечитывает файл. В вашем gamemode есть cleanup предыдущих timers через глобальную функцию:

```js
globalThis.__SKYMP_CORE_GM_CLEANUP__
```

Поэтому hot-reload серверной JS-логики уже предусмотрен.

---

## 7. Подключение игрока и создание персонажа

### 7.1 Offline mode сейчас включён

В `runtime/server-settings.json`:

```json
"offlineMode": true
```

В клиенте:

```json
"gameData": {
  "profileId": 1
}
```

При offline mode именно этот `profileId` фактически является ключом персонажа.

Для второго тестового клиента нужен другой `profileId`, например `2`. Два клиента с одинаковым offline `profileId` не должны использоваться как два независимых персонажа.

### 7.2 Spawn system

Встроенный Spawn runtime делает следующее:

```text
login/profileId
      │
      ▼
getActorsByProfileId(profileId)
      │
      ├─ actor найден
      │    ├─ setEnabled(actor, true)
      │    └─ setUserActor(userId, actor)
      │
      └─ actor не найден
           ├─ createActor(..., profileId)
           ├─ setUserActor(...)
           └─ setRaceMenuOpen(actor, true)
```

То есть character persistence уже встроен в SkyMP server runtime.

### 7.3 Gamemode session detection

Ваш `gamemode.js` дополнительно не подписывается напрямую на socket connect. Вместо этого раз в `connectionPollMs` выполняется scan:

```js
mp.isConnected(userId)
mp.getUserActor(userId)
```

После появления actor вызывается `actorReady()`.

`actorReady()`:

- связывает `userId -> actorId`;
- находит `profileId`;
- создаёт in-memory chat history;
- инициализирует persistent `gm*` поля;
- отправляет приветствие;
- объявляет join;
- обновляет admin panel state.

---

## 8. Три разных идентификатора игрока

Это место важно не путать при дальнейшей разработке.

### `userId`

Текущий сетевой ID подключения.

Пример: `1`.

Не является постоянным character ID.

Используется в UI и командах как удобный ID online-игрока.

### `profileId`

Идентификатор профиля/auth identity.

В offline mode задаётся клиентом в `skymp5-client-settings.txt`.

Именно его встроенный Spawn использует для поиска уже созданного actor.

### `actorId`

Form ID созданного персонажа внутри server world.

В логах вашего gamemode выводится в hex, например:

`0xff000000`

В `runtime/world/changeForms/` тот же dynamic actor может находиться в файле `0.json` с `formDesc: "0"`.

### Правило для новых систем

Не хранить долговременные RP-сущности по `userId`.

Для долговременной логики нужен стабильный identity key:

- сначала `profileId`;
- затем, когда появится многоперсонажность, отдельный `characterId` из вашей БД.

---

## 9. Как сейчас сохраняется позиция

Это один из ключевых моментов текущего форка.

В `gamemode.js` нет собственного `savePosition()` и нет отдельной JSON/SQL БД позиций.

Сохранение выполняется native save storage SkyMP.

В changeForm персонажа сохраняются поля типа:

```json
{
  "profileId": 1,
  "position": [-14210.390625, -51308.296875, 2504.14697265625],
  "angle": [32.209571838378906, 0.0, 193.5347137451172],
  "worldOrCellDesc": "3c:Skyrim.esm"
}
```

После повторного входа Spawn находит этого actor по `profileId`, не создаёт нового и назначает существующего actor текущему соединению.

Поэтому текущая цепочка position persistence:

```text
движение игрока
   │
   ▼
SkyMP native actor state
   │
   ▼
attachSaveStorage()
   │
   ▼
runtime/world/changeForms/<form>.json
   │
   ▼
restart / reconnect
   │
   ▼
getActorsByProfileId(profileId)
   │
   ▼
существующий actor + сохранённая позиция
```

### Что ещё живёт в changeForm

В зависимости от actor/state там находятся:

- position;
- angle;
- world/cell;
- appearance;
- inventory/equipment;
- health/magicka/stamina state;
- death/disabled flags;
- RaceMenu state;
- custom `dynamicFields`.

### Не путать с `/back`

`/back` использует:

```js
const backLocations = new Map();
```

Это только память текущего процесса gamemode.

Она очищается при disconnect и hot-reload. `/back` не является долговременным сохранением позиции.

---

## 10. Custom persistent properties `gm*`

Gamemode регистрирует следующие server-side properties:

```text
gmFirstSeen
gmLastSeen
gmJoinCount
gmDeathCount
gmPlaytimeSeconds
gmRpName
```

Они создаются как невидимые owner/neighbors свойства и используются как серверное persistent RP metadata.

Текущие значения попадают в `dynamicFields` changeForm и таким образом переживают restart.

### Назначение

`gmFirstSeen`

Timestamp первого входа.

`gmLastSeen`

Timestamp последней активности/flush.

`gmJoinCount`

Количество входов.

`gmDeathCount`

Счётчик смертей.

`gmPlaytimeSeconds`

Накопленное время online.

`gmRpName`

Пользовательское RP-имя.

### Временные UI properties

Также есть:

```text
gmNotification
gmUiState
gmAdminUi
```

Они используются как server -> owner transport.

`gmNotification` и `gmAdminUi` очищаются после доставки.

`gmUiState` хранит последний snapshot chat UI. Поскольку это dynamic property, snapshot фактически может оказаться в changeForm. На следующем этапе разработки лучше отделить persistent domain fields от transient transport state, чтобы сообщения UI не попадали в world save.

---

## 11. Chat UI transport

Ключевая особенность форка: отдельного web-server/frontend build сейчас нет.

В `gamemode.js` создаётся `eventSource` через:

```js
mp.makeEventSource("_coreRpUi", eventSource)
```

Внутри event source находится `data:text/html;base64,...` — полностью встроенный HTML/CSS/JS интерфейс чата и админки.

### Server -> client

Gamemode делает:

```js
mp.set(actorId, "gmUiState", state)
```

`updateOwner` property выполняет на клиенте:

```js
ctx.sp.browser.executeJavaScript(
  'window.coreRpSetState && window.coreRpSetState(...)'
)
```

Для admin panel аналогично используется:

```text
gmAdminUi
 -> updateOwner
 -> window.coreAdminReceive(payload)
```

### Browser -> server

HTML вызывает:

```js
window.skyrimPlatform.sendMessage(...)
```

Event source слушает:

```js
ctx.sp.on('browserMessage', ...)
```

После чего отправляет событие назад серверу:

```js
ctx.sendEvent(...)
```

И оно приходит в:

```js
mp._coreRpUi = (pcFormId, event) => { ... }
```

Полный bridge:

```text
CEF/HTML
  │ skyrimPlatform.sendMessage
  ▼
browserMessage
  │ ctx.sendEvent
  ▼
mp._coreRpUi
  │
  ▼
server command/chat handler
```

---

## 12. Открытие чата

В config:

```json
"chatOpenKeyScanCode": 20
```

Client event source слушает `buttonEvent` и при совпадении scan code вызывает `openChat()`.

В HTML hint указана клавиша `T`.

В server console также выводится `Chat: T`.

### Найденная мелкая рассинхронизация

В `actorReady()` сейчас выводится:

```text
F6 — открыть чат.
```

Это не совпадает с текущим input handler/UI, где используется `T`.

Перед следующим релизом эту строку нужно исправить или формировать динамически из настройки.

---

## 13. Chat state

На сервере:

```js
const uiHistory = new Map();
```

Ключ — `actorId`.

История существует только для текущего процесса/sessions и ограничивается `chatHistorySize`.

Сообщение хранится как:

```json
{
  "id": 123,
  "kind": "chat",
  "text": "Имя: текст",
  "ts": 1787090000000
}
```

После каждого append сервер пересылает новый `gmUiState` владельцу actor.

### Важная деталь

На сервере `chatHistorySize` конфигурируемый.

Но текущий встроенный HTML дополнительно делает:

```js
state.messages.slice(-22)
```

Поэтому UI фактически жёстко ограничен 22 строками, даже если серверный config увеличить.

Это ещё один аргумент вынести HTML в нормальный отдельный source file.

---

## 14. Chat proximity

Позиция для чата берётся через:

```js
mp.getActorPos(actorId)
mp.getActorCellOrWorld(actorId)
```

Если API позиции недоступно, используется fallback `mp.get(actorId, "pos")`.

Перед distance check игроки дополнительно фильтруются по cell/world:

```js
if (src.cell && loc.cell && src.cell !== loc.cell) continue;
```

Затем считается обычное 3D Euclidean distance.

Текущие радиусы:

```json
"chatRadius": 1500,
"whisperRadius": 450,
"shoutRadius": 3500
```

---

## 15. Chat-команды

| Команда | Назначение | Область |
|---|---|---|
| обычный текст | IC chat | `chatRadius` |
| `/me текст` | действие персонажа | `chatRadius` |
| `/do текст` | описание ситуации | `chatRadius` |
| `/try текст` | 50/50 RP attempt | `chatRadius` |
| `/w`, `/whisper` | шёпот | `whisperRadius` |
| `/s`, `/shout` | крик | `shoutRadius` |
| `/b текст` | локальный OOC | `chatRadius` |
| `/ooc текст` | глобальный OOC | весь сервер |
| `/roll [max]` | случайное число 1..max | `chatRadius` |
| `/name Имя Фамилия` | RP-имя | persistent |
| `/players` | список online | только отправителю |
| `/id` | user/profile/actor ID | только отправителю |
| `/stats` | joins/deaths/playtime | только отправителю |
| `/coords` | position/cell | только отправителю |
| `/help` | помощь | только отправителю |

`/roll` ограничивает max диапазоном `2..100000`.

`/name` допускает unicode letters/numbers, пробел, `_ . ' -`.

При `allowSelfNameChange=false` имя может менять только staff.

---

## 16. Anti-spam

Используется in-memory sliding window:

```json
"spamWindowMs": 10000,
"spamMaxMessages": 6
```

По умолчанию: максимум 6 chat submissions за 10 секунд на actor.

Ограничение применяется до разбора slash-command, поэтому обычные команды, введённые через чат, тоже расходуют лимит.

Admin UI вызывает `handleCommand()` напрямую и этот chat limiter не использует.

Для публичного RP этого недостаточно как полноценной moderation/abuse защиты, но для текущего test core приемлемо.

---

## 17. Staff roles и permissions

Текущая модель:

```js
moderator
admin
owner
```

Настройка:

```json
"staffProfiles": {
  "1": "owner"
}
```

Также сохранена backwards compatibility:

```json
"adminProfileIds": [1]
```

Если `profileId` находится в этом массиве, он считается `owner`.

### Permission sets

`moderator`:

```text
kick
teleport
view_audit
manage_whitelist
```

`admin`:

```text
kick
teleport
view_audit
manage_whitelist
ban
add_item
set_gold
retire_character
manage_recipes
reveal_identity
run_world_probe
```

`owner` дополнительно:

```text
manage_staff
```

### Важно

Часть permission names зарезервирована для будущих систем и сейчас не имеет реализации в командах/UI.

Например:

- `ban`;
- `add_item`;
- `set_gold`;
- `manage_whitelist`;
- `retire_character`;
- `manage_recipes`;
- `reveal_identity`;
- `run_world_probe`.

Не считать наличие permission готовой функцией.

---

## 18. Текущая admin panel

Открытие:

```text
/admin
```

Сервер проверяет staff role, добавляет actor в `adminUiOpen` и отправляет owner-only `gmAdminUi` state.

Панель автообновляется раз в:

```json
"adminPanelRefreshMs": 3000
```

UI специально сохраняет focus/caret активного input при periodic refresh.

### Что отображается

Для staff:

- собственный `userId`, `profileId`, `actorId`;
- role;
- online count;
- список игроков;
- имя;
- staff role игрока;
- position;
- cell/world;
- deaths;
- playtime.

### Действия по выбранному игроку

- Inspect;
- Teleport to player;
- Bring player;
- Heal;
- Resurrect;
- RaceMenu;
- Kick.

### Личные действия staff

- `/back`;
- heal self;
- resurrect self;
- tpcoords X/Y/Z.

### Senior staff

`admin` и `owner` дополнительно видят announcement section.

---

## 19. Почему Admin UI вызывает команды, а не дублирует бизнес-логику

Это одно из правильных архитектурных решений текущего кода.

`handleAdminUiAction()` не реализует teleport/heal/kick второй раз.

Он превращает UI payload в обычную команду:

```text
UI action "tp"
   -> "/tp <id>"
   -> handleCommand()
```

Таким образом CLI/chat command и кнопка панели проходят одну authorititative server path.

При дальнейшем рефакторинге этот принцип желательно сохранить, но сделать слой ещё чище:

```text
UI / chat command / API
       │
       ▼
command adapter
       │
       ▼
service/domain action
       │
       ▼
SkyMP API / repositories
```

---

## 20. Staff-команды

| Команда | Permission/role | Что делает |
|---|---|---|
| `/admin`, `/adm` | любой staff | открывает панель |
| `/staff`, `/adminhelp` | staff | показывает роль/permissions |
| `/stafflist` | staff | online staff |
| `/inspect ID` | `teleport` | info + IP + pos/stats |
| `/tp ID`, `/goto ID` | `teleport` | staff -> player |
| `/bring ID` | `teleport` | player -> staff |
| `/back` | `teleport` | предыдущая in-memory location |
| `/tpcoords X Y Z` | `teleport` | новая pos в текущей cell/world |
| `/heal [ID]` | сейчас `teleport` | restore actor values |
| `/resurrect [ID]` | сейчас `teleport` | Papyrus Resurrect |
| `/racemenu [ID]` | сейчас `teleport` | opens RaceMenu |
| `/kick ID [reason]` | `kick` | disconnect |
| `/announce text` | admin/owner | global admin message |

### Технический долг permission model

Сейчас `inspect`, `heal`, `resurrect`, `racemenu` проверяют permission `teleport`.

Это работает, но семантически неправильно.

Перед расширением staff-системы лучше ввести granular permissions, например:

```text
player.inspect
player.teleport.self
player.teleport.other
player.heal
player.resurrect
player.racemenu
player.kick
server.announce
```

---

## 21. Teleport и locationalData

Для staff teleport используется не только `position`, а полный:

```js
mp.get(actorId, "locationalData")
```

При установке выполняется clone JSON и:

```js
mp.set(actorId, "locationalData", location)
```

Это правильно для переходов между world/cell, потому что plain XYZ недостаточно.

`/tpcoords` берёт текущую `locationalData`, меняет только `pos` и сохраняет остальные location fields.

Перед teleport текущая location записывается в `backLocations`.

---

## 22. Audit log

Файл:

`runtime/admin-audit.log`

Формат: JSON Lines — одно JSON-событие на строку.

Пример структуры:

```json
{
  "ts": "2026-08-18T22:04:52.543Z",
  "action": "admin_panel_open",
  "staff": {
    "userId": 1,
    "profileId": 1,
    "actorId": "0xff000000",
    "role": "owner"
  },
  "target": null,
  "details": {}
}
```

Staff actions логируются и в stdout, и append'ятся в audit file.

Для production потребуется:

- rotation;
- size limits;
- immutable/remote audit storage;
- политика хранения IP/PII;
- request/action ID;
- success/failure result;
- reason обязательный для destructive actions.

---

## 23. Security model текущей сборки

### Сейчас это development/test deployment

Главная причина:

```json
"offlineMode": true
```

В offline mode клиент сам предоставляет `profileId`.

Следствие: `profileId` нельзя считать надёжно аутентифицированной личностью при публичном Internet exposure.

А staff сейчас определяется именно по `profileId`.

Поэтому перед публичным сервером обязательно нужно перейти к нормальной auth/session схеме.

### Дополнительные чувствительные данные

В форке есть:

- конкретный server IP в client settings;
- IP игроков доступен `/inspect`;
- IP может попадать в console/logging;
- world files содержат character state;
- audit log содержит identity/activity.

При публикации репозитория эти данные нужно отделить от source control.

---

## 24. Известные ограничения и технический долг

### 24.1 Embedded HTML base64

Весь UI встроен одной base64 строкой в `gamemode.js`.

Плюсы:

- нет дополнительных файлов/HTTP server;
- всё работает из одного gamemode.

Минусы:

- тяжело читать diff;
- тяжело редактировать;
- легко ошибиться при ручном re-encode;
- UI и server logic связаны в одном файле.

Первый рекомендуемый refactor — хранить HTML source отдельно в dev tree и собирать/встраивать его автоматически.

### 24.2 Profile scan ограничен 100

`findProfileId(actorId)` перебирает:

```text
1..maxProfileIdScan
```

По умолчанию `100`.

Для offline тестов с profile 1/2 это нормально.

Для реальной auth-базы profile IDs могут быть значительно больше. Тогда staff role и отображаемый profileId перестанут определяться.

Нужно убрать brute-force scan и получать identity из авторитетного login/session flow.

### 24.3 User ID polling ограничен maxUserId

Gamemode каждую секунду делает:

```text
for userId = 1..maxUserId
```

По умолчанию `100`.

Это простой и рабочий test approach, но не лучший event-driven session lifecycle.

### 24.4 Config mismatch server/client UI

- серверный `chatHistorySize` configurable;
- HTML display hardcoded `22`;
- welcome говорит `F6`;
- реальный UI/handler указывает `T`.

Нужно сделать один source of truth.

### 24.5 Transient UI state сохраняется как dynamic field

`gmUiState` является transport property, но оказывается в changeForm.

Нужно минимизировать сохранение transient state.

### 24.6 In-memory state теряется

После disconnect/reload теряются:

- `uiHistory`;
- spam buckets;
- `/back` location;
- open admin state.

Для этих сущностей это в целом допустимо, но это нужно помнить.

### 24.7 Нет DB для RP domain

Нет нормализованных сущностей:

- account;
- character;
- whitelist;
- ban;
- inventory domain ownership;
- economy ledger;
- organizations/factions;
- houses/property;
- staff records;
- sanctions;
- quests/jobs;
- audit DB.

Native world save не стоит превращать в замену полноценной RP DB.

---

## 25. Что должно оставаться в native world-store, а что вынести в БД

Рекомендуемое разделение.

### SkyMP world-store

Оставить как physical game state:

- actor form;
- position;
- angle;
- world/cell;
- appearance;
- equipment/inventory, пока не появится отдельная authoritative economy model;
- basic actor state;
- Skyrim object/change state.

### RP database

Хранить как domain state:

- account/profile link;
- character record;
- RP name/history;
- whitelist;
- staff role;
- bans/sanctions;
- money/economy ledger;
- organizations;
- licenses;
- property ownership;
- jobs;
- criminal/governance data;
- death consequences;
- audit;
- moderation cases.

Важный принцип: БД не должна каждую секунду дублировать XYZ. Position уже нормально сохраняет движок.

---

## 26. Рекомендуемая архитектура следующей версии

Не наращивать весь проект внутри одного `gamemode.js`.

Целевая структура может быть такой:

```text
runtime/
  gamemode.js                 <- bootstrap only
  src/
    config.js
    core/
      sessions.js
      identities.js
      properties.js
      logging.js
    chat/
      chat.service.js
      commands.js
      proximity.js
    admin/
      permissions.js
      commands.js
      admin.service.js
      audit.js
    characters/
      character.service.js
      character.repository.js
    persistence/
      db.js
      migrations/
    ui/
      bridge.js
      core-ui.html
      embed-ui.js
```

Если runtime loader требует один JS file, dev-source всё равно можно держать модульно и собирать в `gamemode.js`.

---

## 27. Рекомендуемый порядок дальнейшей разработки

### Этап 0 — стабилизировать текущее ядро

Сначала ничего не добавлять из большого RP stack.

Сделать:

1. вынести UI source из base64;
2. добавить build/embed script;
3. унифицировать version/string `T/F6`;
4. валидировать config при старте;
5. убрать hardcoded chat history 22 из UI;
6. заменить brute-force `profileId` scan нормальным identity mapping;
7. добавить автоматические smoke tests для command parser/services;
8. добавить `.gitignore` для runtime state/logs/secrets.

### Этап 1 — identity + DB

Добавить SQL DB только для RP domain.

Минимальные таблицы:

```text
accounts
characters
staff_roles
bans
schema_migrations
```

Нужен стабильный `characterId`, не равный temporary `userId`.

### Этап 2 — auth / whitelist / bans

До публичного Internet exposure:

- authenticated sessions;
- whitelist;
- ban lookup до spawn;
- staff identity из DB;
- rate limits;
- server secret management.

### Этап 3 — chat/moderation

Добавить:

- chat channels/policies;
- whisper target если нужен person-to-person whisper;
- mute;
- moderation history;
- report system;
- configurable RP radii per channel;
- optional logging with privacy policy.

### Этап 4 — economy

Только server-authoritative ledger:

```text
accounts/balances
ledger_transactions
transaction_lines
idempotency_key
```

Не хранить деньги просто как `gmGold` без transaction log.

### Этап 5 — governance

После стабильной экономики:

- fines;
- arrests;
- taxes;
- warrants;
- staff/court audit.

### Этап 6 — death/downed/revive

Сначала server state machine, затем UI.

### Этап 7 — CEF interaction UI

После стабилизации domain services можно наращивать панели/interaction menu.

### Этап 8 — voice/launcher/modpack parity

Только после стабилизации core gameplay/auth.

---

## 28. Почему не нужно прямо сейчас копировать Heavy RP целиком

В `RP_RESEARCH/README_RU.txt` уже зафиксирован анализ существующих решений.

Полный Heavy RP stack интересен как reference implementation, но несёт собственные зависимости и assumptions:

- MariaDB/MySQL;
- дополнительные services;
- staff panel;
- Discord integration;
- launcher;
- feature flags;
- ещё не подтверждённый production/in-game статус.

Для текущего форка безопаснее переносить идеи и отдельные domain-модули, а не заменять рабочее ядро большим неподтверждённым stack.

---

## 29. Backup и восстановление

Перед risky изменениями:

1. остановить сервер;
2. скопировать `runtime/world/`;
3. сохранить `runtime/gamemode-config.json`;
4. сохранить `runtime/server-settings.json`;
5. при необходимости сохранить `admin-audit.log`;
6. только после этого запускать миграции/изменения persistence.

### Minimum character backup

Самое важное для текущих персонажей:

```text
runtime/world/
```

Если удалить world/changeForms, встроенный Spawn перестанет находить старых actors и будет создавать новых для profile IDs.

---

## 30. Source control / Git

В репозиторий рекомендуется коммитить:

- source gamemode;
- config examples без секретов;
- docs;
- build scripts;
- migrations;
- тесты.

Не коммитить:

- `runtime/world/`;
- `runtime/admin-audit.log`;
- реальные auth tokens/master keys;
- реальные production client endpoint configs;
- Skyrim `.esm/.bsa` assets;
- generated dumps;
- giant runtime binaries, если для них будет отдельный release artifact strategy.

Пример будущего `.gitignore`:

```gitignore
runtime/world/
runtime/admin-audit.log
runtime/server-settings-dump.json
runtime/server-settings-merged.json
gameData/*.esm
gameData/*.bsa
.env
*.log
```

---

## 31. Проверки перед каждым следующим релизом

### Подключение

- профиль 1 подключается;
- профиль 2 подключается;
- у них разные actors;
- reconnect возвращает того же actor;
- restart сервера сохраняет actor;
- позиция после restart сохраняется.

### Character persistence

- appearance сохраняется;
- inventory сохраняется;
- RP name сохраняется;
- deaths/joins/playtime сохраняются.

### Chat

- обычный local chat;
- `/me`;
- `/do`;
- `/try`;
- whisper radius;
- shout radius;
- `/b`;
- `/ooc`;
- разные cells не слышат local chat;
- anti-spam работает;
- control characters не ломают UI.

### Admin

- non-staff не открывает `/admin`;
- moderator permissions;
- admin permissions;
- owner permissions;
- inspect;
- tp;
- bring;
- back;
- tpcoords;
- heal;
- resurrect;
- RaceMenu;
- kick;
- announcement;
- audit record.

### UI

- T открывает чат;
- Enter отправляет;
- Esc закрывает;
- `/admin` открывает panel;
- refresh не крадёт focus;
- announcement Enter работает;
- kick confirmation работает;
- periodic refresh не затирает введённые coordinates.

### Hot reload

- изменение gamemode загружает новую версию;
- старые intervals не продолжают работать;
- нет дублирующихся join/chat/admin событий.

---

## 32. Текущая зафиксированная working-state из архива

В world store присутствуют как минимум два player actors:

- `profileId=1`;
- `profileId=2`.

У `profileId=1` сохранены position/world и `gm*` dynamic fields.

Также audit log содержит открытие admin panel владельцем `profileId=1`.

Это подтверждает, что архив содержит не только code skeleton, а уже использовавшееся persistent runtime state.

---

## 33. Что я бы менял первым коммитом после этой документации

Не добавлять новые gameplay-фичи первым коммитом.

Первый технический PR лучше сделать `Core cleanup / no behavior change`:

1. `gamemode.js` оставить runtime entry;
2. извлечь HTML в readable source;
3. добавить deterministic embed/build step;
4. исправить `F6 -> T`;
5. сделать UI history size динамическим;
6. вынести permissions в отдельную структуру;
7. добавить `config schema`;
8. добавить smoke-test command handlers;
9. создать `.gitignore`;
10. добавить backup instruction в README.

После такого baseline будет значительно безопаснее добавлять DB, whitelist и economy.

---

## 34. Короткая карта: где менять конкретную функцию

Нужен новый chat command:

`runtime/gamemode.js -> handleCommand()`

Нужен новый chat radius/config:

`runtime/gamemode-config.json` + chat helper functions.

Нужно изменить staff role:

`ROLE_PERMISSIONS` + `staffProfiles`.

Нужна новая кнопка admin UI:

embedded HTML + `handleAdminUiAction()` + желательно существующий/new command handler.

Нужно изменить teleport:

`getLocationalData()` / `setLocationalData()` и соответствующие commands.

Нужно сохранить новый простой character field:

`mp.makeProperty()` + `mp.get/mp.set`.

Нужна сложная долговременная RP-сущность:

не добавлять десятки `gm*` properties; сначала вводить RP DB/repository layer.

Нужно изменить character spawn/reconnect:

это уже граница upstream server Spawn system; сначала понять встроенный lifecycle, не патчить `dist_back` без необходимости.

Нужно изменить UI transport:

`mp.makeEventSource("_coreRpUi", ...)`, `gmUiState`, `gmAdminUi`, `mp._coreRpUi`.

---

## 35. Definition of Done для следующего milestone

Следующий milestone можно считать здоровым, если:

- текущие join/chat/admin/position persistence сценарии не регрессировали;
- source UI больше не спрятан вручную в base64;
- identity не зависит от scan `1..100`;
- production secrets/runtime state не лежат в Git;
- DB имеет migrations;
- staff role хранится в authoritative identity layer;
- offline mode остаётся только dev режимом;
- есть repeatable smoke test reconnect + saved position;
- destructive staff actions audit'ятся;
- новая фича добавляется через service/domain layer, а не раздувает один switch бесконечно.

---

## 36. Static verification этой копии

Проверено без запуска игрового сервера:

- `node --check runtime/gamemode.js` — синтаксис корректен;
- `runtime/gamemode-config.json` — валидный JSON;
- `runtime/server-settings.json` — валидный JSON.

SHA-256 ключевых файлов этой зафиксированной версии:

```text
1f720f909435ddcfe89db3504ce9f06aadf62074f8f7157545f12e7bc802e1df  runtime/gamemode.js
88f48d409791bbcbb3c2e5a7239bd14d5ccbaa28fcef02ee7dae784af52bfc89  runtime/gamemode-config.json
bc86e14acf2dd59bab621a6a269a536dcbcc83ec0d8ccb9ee3aca9bae87b11b8  runtime/server-settings.json
9dfc651dbee8309c2461b59e38129690c92b8729887627a8d01750bf594aa6dc  CLIENT/Data/Platform/Plugins/skymp5-client-settings.txt
```

Если эти hashes изменились — документация всё ещё полезна архитектурно, но раздел «текущая версия» нужно перепроверить.
