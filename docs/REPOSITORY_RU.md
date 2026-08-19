# Репозиторий Secret Skyrim MP

## Зачем он нужен

GitHub — единая точка исходников, CI и версий проекта. Тяжёлые build-зависимости не хранятся в Git и не требуются на обычной машине разработчика.

## Что происходит при push в main

Workflow `Build Windows` на `windows-latest`:

1. проверяет gamemode/client/launcher;
2. скачивает официальный Mumble 1.5.915;
3. временно устанавливает его только на GitHub runner;
4. копирует Mumble в bundled `Voice/runtime`;
5. MSVC собирает наш `SkyrimVoice.dll`;
6. npm устанавливает Electron-зависимости только на runner;
7. собирается portable `Secret Skyrim MP Launcher.exe`;
8. создаются client/server/source ZIP и SHA-256;
9. архивы сохраняются как GitHub Actions Artifact на 30 дней.

## Релизы

Создание тега:

```text
v0.1.0
v0.2.0
v1.0.0
```

запускает workflow `Release`, который публикует постоянный GitHub Release:

```text
secret-skyrim-mp-client-X.Y.Z.zip
secret-skyrim-mp-server-X.Y.Z.zip
secret-skyrim-mp-source-X.Y.Z.zip
SHA256SUMS.txt
```

## Не коммитить

- SkyrimSE.exe и master/BSA игровые файлы;
- `gameData/`;
- `world/changeForms/`;
- логи/audit;
- `.env` и реальные secrets/tokens;
- production IP/hostname в tracked config;
- `node_modules/`;
- Mumble runtime;
- Electron `dist/`.

## Тяжёлые зависимости

- Mumble 1.5.915 скачивается официально только на Windows runner.
- Visual Studio/MSVC используется с готового `windows-latest` runner.
- Electron/npm dependencies устанавливаются только во время CI build.
- В Git остаются только исходники, build scripts и небольшой pinned SkyMP server runtime.

## SkyMP

Pinned upstream commit:

`2abd0a0391278335face3c13ff0e2cabf76344b0`

Серверный prebuilt runtime хранится в `server/vendor/skymp`, чтобы серверный release можно было собрать без полной компиляции SkyMP. Полный CEF/SkyMP client runtime в Git не хранится.

## Конфигурация

Tracked `skymp5-client-settings.txt` использует `127.0.0.1` как безопасное dev-значение. Production endpoint должен попадать в release/deploy pipeline отдельно, а не коммититься в публичную историю.
