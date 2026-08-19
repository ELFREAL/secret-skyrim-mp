# Review findings рабочего форка — после Core GM v5.1.0

Этот файл отражает состояние после cleanup-патча v5.1.0.

## Исправлено в v5.1.0

### ✅ `profileId` больше не сканируется `1..100`

Удалены `findProfileId()` и `maxProfileIdScan`.

Identity берётся напрямую из стандартного SkyMP property binding:

```js
mp.get(actorId, "profileId")
```

После `getUserActor(userId)` gamemode создаёт явную связь:

```text
userId -> session -> actorId -> profileId
```

Дополнительно используются RAM-индексы `sessionsByActor` и `sessionsByProfile`.

### ✅ UI вынесен из hardcoded base64

Исходник UI теперь находится здесь:

```text
runtime/ui/core-ui.html
```

`gamemode.js` читает файл при загрузке и формирует `data:text/html;charset=utf-8,...` URL для stock SkyMP browser. В исходнике gamemode больше нет огромной base64-строки.

### ✅ `gmUiState` удалён из persistent save

История чата и UI state являются RAM state (`uiHistory`, `sessions`, `adminUiOpen`).

Для доставки на stock client используется краткоживущий owner-only transport `gmUiTransport`; payload снабжён `nonce` и очищается после доставки. Старые `gmUiState`/`gmAdminUi` удалены из сохранённого `changeForm` текущего персонажа.

Важно: SkyMP custom properties по своей природе сохраняются, поэтому transport после очистки может присутствовать в save как `null`. Authoritative UI state и chat history в save больше не хранятся.

### ✅ T/F6 синхронизировано

Фактическая клавиша чата и welcome теперь обе используют `T`. Текст берётся из `chatOpenKeyLabel`.

## P0 — перед публичным Internet deployment

### Offline identity нельзя использовать как production auth

Сейчас `offlineMode=true`, а клиент задаёт `gameData.profileId` локально. Это удобно для разработки, но не является security boundary.

Перед публичным запуском нужны authenticated session/master side, authoritative account identity, whitelist/ban lookup и server-side staff mapping.

### Runtime state и endpoints не должны попадать в публичный Git

В рабочей копии есть world state, audit log и client settings. Для публичного репозитория разделить source/config examples, runtime saves, logs и production endpoints/secrets.

## P1 — следующий технический cleanup

### Session lifecycle всё ещё polling-based

Раз в `connectionPollMs` gamemode проверяет `1..maxUserId` через `mp.isConnected()` и затем `getUserActor()`.

Это уже не связано с поиском `profileId`; identity после actor-ready определяется напрямую. Но при дальнейшем росте проекта можно перейти на event-driven connection/session adapter.

### Transport properties остаются механизмом доставки stock-клиенту

`gmNotification` и `gmUiTransport` используются как owner-only transport. Если позже появится собственный client build, их можно заменить на явный custom-packet protocol без записи transport properties в actor changeForm.

## P2 — архитектура RP

- permissions пока достаточно крупные; `inspect/heal/resurrect/racemenu` используют общий permission `teleport`;
- часть permission names (`ban`, `set_gold`, `add_item`, `manage_whitelist`) пока зарезервирована без полной реализации;
- `chatHistorySize` на сервере configurable, а UI rendering имеет собственные ограничения;
- `offlineMode` должен исчезнуть до публичной эксплуатации.

## Что пока лучше не менять

- не дублировать native position persistence собственной JSON-БД;
- не использовать `runtime/world/changeForms` как application database;
- не патчить `runtime/dist_back/skymp5-server.js` для RP-фич, если задача решается через API/gamemode;
- не переносить economy/governance до появления нормальной DB/transaction model.
