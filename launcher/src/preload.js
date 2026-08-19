'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('launcher', {
  getStatus: () => ipcRenderer.invoke('launcher:get-status'),
  chooseFolder: () => ipcRenderer.invoke('launcher:choose-folder'),
  launch: () => ipcRenderer.invoke('launcher:launch'),
  minimize: () => ipcRenderer.invoke('window:minimize'),
  close: () => ipcRenderer.invoke('window:close'),
  onEvent: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('launcher:event', handler);
    return () => ipcRenderer.removeListener('launcher:event', handler);
  }
});
