# Protocol / properties / commands reference — v5.1.0

## Client -> server CEF messages

| Browser message | Payload | Server event |
|---|---|---|
| `core-rp-ready` | none | `{type:"ready"}` |
| `core-rp-close` | none | local close only |
| `core-rp-chat` | string | `{type:"chat", text}` |
| `core-admin-close` | none | `{type:"adminClose"}` |
| `core-admin-action` | JSON string, max 4096 | `{type:"adminAction", payload}` |

## Server -> client owner properties

### `gmNotification`

```json
{"id":1,"text":"..."}
```

Client action: `Debug.notification()`.

### `gmUiTransport`

Единый краткоживущий transport для chat state и admin state. После доставки сервер очищает envelope по `nonce`.

Chat state:

```json
{
  "nonce": 1,
  "kind": "state",
  "state": {
    "version": "5.1.0",
    "serverName": "SkyMP Test RP",
    "playerId": 1,
    "profileId": 1,
    "staffRole": "owner",
    "online": 1,
    "messages": []
  }
}
```

Client action: `window.coreRpSetState(state)`.

Admin state:

```json
{
  "nonce": 2,
  "kind": "admin",
  "state": {
    "version": "5.1.0",
    "serverName": "SkyMP Test RP",
    "role": "owner",
    "permissions": [],
    "canAnnounce": true,
    "self": {},
    "players": []
  }
}
```

Client action: `window.coreAdminReceive({nonce,state})`.

`gmUiState` и `gmAdminUi` больше не используются.

## Identity

После появления actor:

```js
const profileId = mp.get(actorId, "profileId");
```

RAM indexes:

```text
userId -> session
actorId -> session
profileId -> session
```

Нет `maxProfileIdScan` и нет перебора `getActorsByProfileId(1..100)` в gamemode.

## Admin UI actions

| action | maps to |
|---|---|
| `refresh` | direct state refresh |
| `inspect` | `/inspect ID` |
| `tp` | `/tp ID` |
| `bring` | `/bring ID` |
| `heal` | `/heal ID` |
| `resurrect` | `/resurrect ID` |
| `racemenu` | `/racemenu ID` |
| `kick` | `/kick ID reason` |
| `back` | `/back` |
| `healSelf` | `/heal` |
| `resurrectSelf` | `/resurrect` |
| `tpcoords` | `/tpcoords X Y Z` |
| `announce` | `/announce text` |

## Persistent gm properties

| property | type | meaning |
|---|---|---|
| `gmFirstSeen` | number | epoch ms |
| `gmLastSeen` | number | epoch ms |
| `gmJoinCount` | number | joins |
| `gmDeathCount` | number | deaths |
| `gmPlaytimeSeconds` | number | accumulated online seconds |
| `gmRpName` | string | RP display name |

## Config defaults

```json
{
  "maxUserId": 100,
  "connectionPollMs": 1000,
  "playtimeFlushMs": 30000,
  "welcomeDelayMs": 1200,
  "chatOpenKeyScanCode": 20,
  "chatOpenKeyLabel": "T",
  "chatHistorySize": 22,
  "chatRadius": 1500,
  "whisperRadius": 450,
  "shoutRadius": 3500,
  "maxMessageLength": 180,
  "spamWindowMs": 10000,
  "spamMaxMessages": 6,
  "adminPanelRefreshMs": 3000
}
```

## UI source

```text
runtime/ui/core-ui.html
```

## Player commands

```text
/help
/players
/id
/stats
/coords
/name Имя Фамилия
/me действие
/do описание
/try действие
/w текст
/whisper текст
/s текст
/shout текст
/b текст
```

Для staff/admin команд см. `DEVELOPMENT_RU.md` и исходный `gamemode.js`.
