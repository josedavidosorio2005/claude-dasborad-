// InConexion Platform — app de escritorio (Electron).
//
// Cliente LIGERO: no embebe el backend. Abre una ventana que carga el sitio real
// por HTTPS. El backend (SQLite multiusuario con roles) vive en AWS; escritorio,
// web y Android consumen la MISMA API.
//
// Seguridad: nodeIntegration OFF, contextIsolation ON. La ventana solo navega
// dentro del dominio de produccion; cualquier link externo se abre en el
// navegador del sistema.

'use strict';

const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

const PROD_URL = 'https://inconexionpruebasclaude.duckdns.org';
const PROD_ORIGIN = new URL(PROD_URL).origin;
const OFFLINE_FILE = path.join(__dirname, 'offline.html');

// Codigos de red de Chromium que significan "no hay conexion" (equivalente
// a los que MainActivity.java filtra en Android). NO incluye errores
// 4xx/5xx del servidor -- esos SI cargan la pagina (con status de error),
// no disparan did-fail-load. -3 (ERR_ABORTED) se ignora aparte: lo dispara
// una navegacion cancelada a proposito (por ejemplo, cuando nosotros mismos
// mandamos a cargar otra URL antes de que la anterior terminara), no una
// falla real.
const NETWORK_ERROR_CODES = new Set([
  -100, // ERR_CONNECTION_CLOSED
  -101, // ERR_CONNECTION_RESET
  -102, // ERR_CONNECTION_REFUSED
  -105, // ERR_NAME_NOT_RESOLVED
  -106, // ERR_INTERNET_DISCONNECTED
  -109, // ERR_ADDRESS_UNREACHABLE
  -118, // ERR_CONNECTION_TIMED_OUT
  -21,  // ERR_NETWORK_CHANGED
  -7,   // ERR_TIMED_OUT
]);

// Recordar tamano/posicion de la ventana entre sesiones (archivo simple en userData).
const stateFile = path.join(app.getPath('userData'), 'window-state.json');
function loadState() {
  try {
    const s = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    if (s && Number.isFinite(s.width) && Number.isFinite(s.height)) return s;
  } catch (_) {}
  return { width: 1280, height: 800 };
}
function saveState(win) {
  if (!win || win.isDestroyed()) return;
  const b = win.getBounds();
  try {
    fs.writeFileSync(stateFile, JSON.stringify({ x: b.x, y: b.y, width: b.width, height: b.height }));
  } catch (_) {}
}

function isProdUrl(u) {
  try {
    return new URL(u).origin === PROD_ORIGIN;
  } catch (_) {
    return false;
  }
}

let win;
let splashWin;

function createSplashWindow() {
  splashWin = new BrowserWindow({
    width: 420,
    height: 320,
    frame: false,
    resizable: false,
    movable: true,
    backgroundColor: '#ffffff',
    icon: path.join(__dirname, 'build', 'icon.png'),
    show: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
  });
  splashWin.loadFile('splash.html');
  splashWin.on('closed', () => { splashWin = null; });
}

function closeSplash() {
  if (splashWin && !splashWin.isDestroyed()) splashWin.close();
}

function createWindow() {
  const state = loadState();
  win = new BrowserWindow({
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
    minWidth: 900,
    minHeight: 600,
    title: 'InConexion Platform',
    backgroundColor: '#0d4a5e',
    icon: path.join(__dirname, 'build', 'icon.png'),
    show: false, // se muestra recien cuando termina de cargar (o falla) -- mientras tanto se ve el splash
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      spellcheck: true,
    },
  });

  win.loadURL(PROD_URL);

  let showedOnce = false;
  const revealMain = () => {
    if (showedOnce || !win || win.isDestroyed()) return;
    showedOnce = true;
    closeSplash();
    win.show();
  };

  // Splash visible hasta que el sitio real termine de cargar -- no por un
  // tiempo fijo. Si falla por red, mostramos igual la ventana (con la
  // pantalla de "sin conexion" propia) en vez de dejar el splash pegado.
  win.webContents.on('did-finish-load', revealMain);
  win.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (errorCode === -3) return; // ERR_ABORTED: navegacion cancelada a proposito, no es una falla real
    if (!isMainFrame) return;
    revealMain();
    if (NETWORK_ERROR_CODES.has(errorCode)) {
      win.loadFile(OFFLINE_FILE);
    }
    // errores que no son de red (ej. certificado) se dejan visibles tal cual los reporta Chromium
  });

  // Navegacion fuera del dominio de produccion -> navegador del sistema.
  win.webContents.on('will-navigate', (event, url) => {
    if (!isProdUrl(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isProdUrl(url)) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Guardar el estado de la ventana.
  let saveTimer = null;
  const scheduleSave = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveState(win), 400);
  };
  win.on('resize', scheduleSave);
  win.on('move', scheduleSave);
  win.on('close', () => saveState(win));
  win.on('closed', () => { win = null; });
}

// Menu minimo (recargar, zoom, salir, herramientas de dev).
function buildMenu() {
  const template = [
    {
      label: 'InConexion',
      submenu: [
        { role: 'reload', label: 'Recargar' },
        { role: 'forceReload', label: 'Forzar recarga' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Zoom normal' },
        { role: 'zoomIn', label: 'Acercar' },
        { role: 'zoomOut', label: 'Alejar' },
        { type: 'separator' },
        { role: 'toggleDevTools', label: 'Herramientas de desarrollador' },
        { type: 'separator' },
        { role: 'quit', label: 'Salir' },
      ],
    },
    {
      label: 'Editar',
      submenu: [
        { role: 'undo', label: 'Deshacer' }, { role: 'redo', label: 'Rehacer' },
        { type: 'separator' },
        { role: 'cut', label: 'Cortar' }, { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Pegar' }, { role: 'selectAll', label: 'Seleccionar todo' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// Una sola instancia.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    buildMenu();
    createSplashWindow();
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
