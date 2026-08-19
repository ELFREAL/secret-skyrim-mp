# Server Voice Runtime — bundled Mumble Server

Статус: подготовлено для CI-сборки после Core 5.2.

## Требование

Mumble Server является частью серверного дистрибутива Secret Skyrim MP.
Администратор сервера не устанавливает и не запускает его отдельно.

Серверный ZIP содержит:

```text
START_SECRET_SKYRIM_SERVER.cmd
start-secret-skyrim-server.ps1
runtime/
VoiceServer/
  mumble-server.exe
  mumble-server.ini
  MUMBLE_LICENSE.txt
  ...runtime DLLs...
gameData/
```

`START_SECRET_SKYRIM_SERVER.cmd` запускает supervisor, который:

1. проверяет наличие Skyrim masters, SkyMP runtime и Mumble Server;
2. запускает только bundled `mumble-server.exe` с нашим `mumble-server.ini`;
3. ждёт успешного старта;
4. запускает SkyMP RP server;
5. после остановки SkyMP завершает только запущенный им Mumble Server process.

Voice server слушает TCP/UDP 64738. SkyMP остаётся на настроенном игровом порту
(текущий dev-конфиг: 7777).

## CI

GitHub Actions скачивает pinned Mumble Server 1.5.915 с официального
`dl.mumble.info` на Windows runner, устанавливает его временно и копирует
полный server runtime в release artifact. Бинарники Mumble Server не хранятся
в Git history.

## Client database fix

Bundled Mumble client использует отдельную SQLite database в `Voice/profile`.
Перед запуском launcher теперь создаёт пустой database file, если его ещё нет.
Это предотвращает интерактивную ошибку `Database: File not found` на первом
запуске; Mumble затем самостоятельно создаёт SQLite schema.
