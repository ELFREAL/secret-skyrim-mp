# GitHub bootstrap — Secret Skyrim MP

Remote repository:

`https://github.com/ELFREAL/secret-skyrim-mp`

Репозиторий подготовлен как source-first проект. Тяжёлые зависимости не хранятся в Git:

- Electron `node_modules` и `dist`;
- Mumble runtime;
- Visual Studio toolchain;
- Skyrim/Bethesda assets;
- runtime saves/logs;
- production secrets и production endpoint.

## Первый push

Если эта папка уже содержит `.git`:

```powershell
git remote set-url origin https://github.com/ELFREAL/secret-skyrim-mp.git
git push -u origin main
```

Если используется `secret-skyrim-mp.bundle`:

```powershell
git clone .\secret-skyrim-mp.bundle secret-skyrim-mp
cd secret-skyrim-mp
git remote set-url origin https://github.com/ELFREAL/secret-skyrim-mp.git
git push -u origin main
```

После push автоматически стартуют два workflow:

- `Validate` — быстрые syntax/config/unit checks;
- `Build Windows` — Windows runner собирает SkyrimVoice, Electron launcher и versioned dev ZIP artifacts.

## Версионный release

После успешной dev-сборки:

```powershell
git tag v0.1.0
git push origin v0.1.0
```

Tag `v*` запускает `Release`, который публикует в GitHub Releases:

- `secret-skyrim-mp-client-X.Y.Z.zip`;
- `secret-skyrim-mp-server-X.Y.Z.zip`;
- `secret-skyrim-mp-source-X.Y.Z.zip`;
- `SHA256SUMS.txt`.

## Важно

Tracked client settings используют только безопасный development endpoint `127.0.0.1`. Production IP/keys должны задаваться при deployment и не коммититься в Git.
