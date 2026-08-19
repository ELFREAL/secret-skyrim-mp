# Core Gamemode v5.1.0 — cleanup перед дальнейшей разработкой

## Что изменено

1. Welcome и UI используют одну клавишу чата: `T`.
2. `gmUiState` удалён. Chat/UI state находится в RAM; доставка идёт через краткоживущий `gmUiTransport`.
3. `profileId` читается напрямую через стандартный SkyMP property `profileId`; scan `1..100` удалён.
4. Добавлены RAM identity indexes: `sessionsByActor`, `sessionsByProfile`.
5. UI вынесен в `runtime/ui/core-ui.html`; hardcoded base64 удалён из `gamemode.js`.
6. Из существующего `runtime/world/changeForms/0.json` удалены старые `gmUiState` и `gmAdminUi`.
7. `gamemode-config.json`: удалён `maxProfileIdScan`, добавлен `chatOpenKeyLabel`.

## Почему direct `profileId` корректен

Проверено по SkyMP commit `2abd0a0391278335face3c13ff0e2cabf76344b0`, на который рассчитан этот runtime.

В `PropertyBindingFactory.cpp` стандартное property имя `profileId` связано с `ProfileIdBinding`. В `ProfileIdBinding.cpp` getter возвращает `actor->GetProfileId()`.

Spawn system сам создаёт/загружает actor по `userProfileId` и связывает его с `userId` через `setUserActor()`. Поэтому после `getUserActor(userId)` gamemode может читать identity напрямую с actor.

## Почему оставлен transport property

Stock client уже умеет получать owner properties через стандартный gamemode property mechanism. Это позволяет не изменять `CLIENT/Data/Platform/Plugins/skymp5-client.js`.

`gmUiTransport` не является source of truth. Payload формируется из RAM, получает nonce и очищается через 700 ms. При дальнейшей разработке собственного client build его можно заменить custom packet protocol.

## Проверки

- `node --check runtime/gamemode.js` — OK.
- mock-load gamemode с пустыми подключениями — OK.
- mock actor-ready с `profileId=1` — session корректно получает profile 1 и создаёт `gmUiTransport.kind=state`.
- все runtime JSON после изменения читаются JSON parser'ом.
