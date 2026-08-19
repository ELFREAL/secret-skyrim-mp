'use strict';

const gamePath = document.getElementById('gamePath');
const chooseBtn = document.getElementById('chooseBtn');
const playBtn = document.getElementById('playBtn');
const stateText = document.getElementById('stateText');
const detailText = document.getElementById('detailText');
const minimizeBtn = document.getElementById('minimizeBtn');
const closeBtn = document.getElementById('closeBtn');

let busy = false;

function setCheck(key, exists) {
  const row = document.querySelector(`.check[data-key="${key}"]`);
  if (!row) return;
  row.classList.remove('ok', 'bad');
  row.classList.add(exists ? 'ok' : 'bad');
  row.querySelector('b').textContent = exists ? 'ГОТОВО' : 'НЕТ';
}

function render(status) {
  const validation = status.validation;
  const configured = Boolean(status.config?.gameDir);

  gamePath.textContent = configured ? status.config.gameDir : 'Не выбрана';
  gamePath.title = configured ? status.config.gameDir : '';

  const checks = validation?.checks || [];
  for (const key of ['skyrim', 'skse', 'skymp']) {
    const item = checks.find((x) => x.key === key);
    setCheck(key, Boolean(item?.exists));
  }
  const voiceClient = checks.find((x) => x.key === 'voiceClient');
  setCheck('voice', Boolean(status.voiceValidation?.valid && voiceClient?.exists));

  if (status.running) {
    stateText.textContent = 'Skyrim запущен';
    detailText.textContent = `Процесс SkyrimSE.exe · PID ${status.trackedSkyrimPid}`;
    playBtn.disabled = true;
  } else if (busy || status.launchInProgress) {
    stateText.textContent = 'Запуск через SKSE…';
    detailText.textContent = 'Ожидаю процесс SkyrimSE.exe.';
    playBtn.disabled = true;
  } else if (validation?.valid && status.voiceValidation?.valid) {
    stateText.textContent = 'Готово к запуску';
    detailText.textContent = status.voiceBridgeReady
      ? 'Голосовой модуль уже активен.'
      : 'Launcher запустит голос, затем SKSE.';
    playBtn.disabled = false;
  } else if (validation?.valid && !status.voiceValidation?.valid) {
    stateText.textContent = 'Не готов Voice Runtime';
    detailText.textContent = 'Соберите/подготовьте Voice рядом с launcher.';
    playBtn.disabled = true;
  } else if (configured) {
    stateText.textContent = 'Папка не готова';
    detailText.textContent = 'Не найдены обязательные файлы клиента.';
    playBtn.disabled = true;
  } else {
    stateText.textContent = 'Укажите папку Skyrim';
    detailText.textContent = 'Путь будет сохранён для следующих запусков.';
    playBtn.disabled = true;
  }
}

async function refresh() {
  const status = await window.launcher.getStatus();
  render(status);
  return status;
}

chooseBtn.addEventListener('click', async () => {
  await window.launcher.chooseFolder();
  await refresh();
});

playBtn.addEventListener('click', async () => {
  if (busy) return;
  busy = true;
  playBtn.disabled = true;
  stateText.textContent = 'Запуск через SKSE…';
  detailText.textContent = 'Ожидаю SkyrimSE.exe.';

  const result = await window.launcher.launch();
  busy = false;

  if (!result.ok) {
    stateText.textContent = 'Ошибка запуска';
    detailText.textContent = result.message || 'Неизвестная ошибка.';
  }
  await refresh();
});

minimizeBtn.addEventListener('click', () => window.launcher.minimize());
closeBtn.addEventListener('click', () => window.launcher.close());

window.launcher.onEvent(async (event) => {
  if (event.type === 'voice-ready') {
    stateText.textContent = 'Голос готов';
    detailText.textContent = `Voice Runtime · PID ${event.pid}`;
  }
  if (event.type === 'game-started') {
    stateText.textContent = 'Skyrim запущен';
    detailText.textContent = `PID ${event.pid}`;
  }
  if (event.type === 'game-exited' || event.type === 'folder-changed') {
    await refresh();
  }
});

(async () => {
  const status = await refresh();
  if (!status.config?.gameDir) {
    setTimeout(async () => {
      await window.launcher.chooseFolder();
      await refresh();
    }, 250);
  }
})();
