# Voice HUD и lipsync — Secret Skyrim MP

Версия gamemode: 5.3.0.

## Архитектура

Stock `skymp5-client.js` не изменяется. Voice UI и lipsync исполняются через `_coreVoice`, который сервер доставляет штатным `mp.makeEventSource()` после подключения к SkyMP.

`SkyrimVoice.dll` остаётся Mumble plugin и дополнительно измеряет реальный голос:

- `mumble_onAudioInput` — локальный микрофон;
- `mumble_onAudioSourceFetched` — декодированный голос каждого удалённого Mumble-пользователя;
- `GET http://127.0.0.1:38471/talkers` — локальный PTT/talking/level и список слышимых remote talkers.

HUD обновляется в уже существующем Core RP browser UI. Отдельный SkyrimPlatform JS plugin не добавляется.

## HUD

Нижний правый угол:

- тусклый — bridge недоступен;
- серый — voice готов;
- золотой — PTT `N` зажат;
- голубой пульс + шкала — Mumble действительно определяет речь, уровень берётся из PCM.

## Lipsync

Для локального игрока используется `Game.getPlayer()`.

Для удалённых игроков сервер передаёт пары `{ profileId, actorId }` только для текущего audible route. На клиенте server form ID переводится штатным `ctx.getFormIdInClientFormat()`, затем используется `Game.getFormEx()` + `Actor.from()`.

MVP управляет только phoneme-каналами 0/2/5/6/11 и сбрасывает только их. Интенсивность зависит от реального RMS Mumble audio. Это amplitude lipsync, а не распознавание фонем из речи.

Pinned SkyrimPlatform API содержит `Actor.setExpressionPhoneme()` и `Actor.resetExpressionOverrides()`, поэтому сначала тестируется встроенный API без дополнительной SKSE-зависимости.

### Ограничение

SkyrimNet в своей новой lipsync-реализации требует Mfg Fix NG. Это не доказывает, что он обязателен для `Actor.setExpressionPhoneme()` в нашем pinned SkyrimPlatform. Если HUD/talking работают, но рот визуально не двигается или работает нестабильно, следующий шаг — отдельно проверить Mfg Fix NG. Stock SkyMP client при этом всё равно не меняется.

## Настройки

Новые параметры необязательны: если их нет в `gamemode-config.json`, используются defaults.

```json
{
  "voiceTalkerPollMs": 90,
  "voiceHudEnabled": true,
  "voiceLipSyncEnabled": true,
  "voiceLipMaxStrength": 72
}
```

Для мгновенного отключения lipsync без отката commit достаточно добавить:

```json
"voiceLipSyncEnabled": false
```

## Проверка одним игроком

После нового Windows build:

1. `http://127.0.0.1:38471/health` во время игры должен вернуть `{"status":"ok","game":true}`.
2. `http://127.0.0.1:38471/talkers` должен открываться.
3. В idle: `ptt=false`, `localTalking=false`.
4. При удержании `N`: `ptt=true`.
5. При удержании `N` и речи: `localTalking=true`, `localLevel>0`; HUD пульсирует и показывает уровень.
6. В третьем лице рот локального персонажа должен двигаться во время речи.

## Проверка двумя игроками

У игроков должны быть разные `profileId`. Когда они находятся в одном voice route, у слушателя `/talkers` должен содержать `profileId` говорящего и его `level`. Рот соответствующего remote actor должен двигаться синхронно с реально слышимым Mumble audio. После выхода из audible route звук и lipsync должны прекратиться.

## Откат

Feature делается отдельным commit. После push его можно откатить обычным `git revert <commit>` и затем `git push origin main`.
