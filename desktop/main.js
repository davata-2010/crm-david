const { app, BrowserWindow, Menu, shell, dialog, session } = require("electron");
const path = require("node:path");
const fs = require("node:fs");

const APP_URL = process.env.AURUM_URL || "https://crm-david-538.netlify.app";
const ORIGIN = new URL(APP_URL).origin;

/* ------------------------------------------------ tamaño de la ventana --- */
// Se recuerda entre sesiones en un JSON dentro de la carpeta de usuario.

const stateFile = () => path.join(app.getPath("userData"), "window-state.json");

function readState() {
  try {
    return JSON.parse(fs.readFileSync(stateFile(), "utf8"));
  } catch {
    return { width: 1440, height: 900 };
  }
}

function saveState(win) {
  if (!win || win.isDestroyed()) return;
  try {
    const b = win.getBounds();
    fs.writeFileSync(
      stateFile(),
      JSON.stringify({ ...b, maximized: win.isMaximized() })
    );
  } catch {
    // Si no se puede guardar, la próxima vez abre con el tamaño por defecto.
  }
}

/* ------------------------------------------------------------- ventana --- */

const windows = new Set();

function createWindow() {
  const state = readState();

  const win = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#080808",
    title: "Aurum CRM",
    icon: path.join(__dirname, "build", "icon.png"),
    autoHideMenuBar: false,
    show: false,
    webPreferences: {
      // La app es remota: nada de acceso al sistema desde la web.
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      spellcheck: true,
      partition: "persist:aurum", // mantiene la sesión iniciada
    },
  });

  if (state.maximized) win.maximize();
  windows.add(win);

  win.once("ready-to-show", () => win.show());
  win.on("close", () => saveState(win));
  win.on("closed", () => windows.delete(win));

  // Los enlaces externos van al navegador del sistema, no abren ventanas nuevas.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(ORIGIN)) {
      createWindow().loadURL(url);
    } else {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  // Impide que la app navegue fuera de su propio dominio.
  win.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(ORIGIN)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  win.webContents.on("did-fail-load", (_e, code, description, url, isMainFrame) => {
    if (!isMainFrame || code === -3) return; // -3 = abortado por el propio usuario
    win.loadFile(path.join(__dirname, "offline.html"));
    console.error(`No se pudo cargar ${url}: ${description} (${code})`);
  });

  win.loadURL(APP_URL);
  return win;
}

/* --------------------------------------------------------------- menú --- */

function buildMenu() {
  const go = (route) => () => {
    const win = BrowserWindow.getFocusedWindow() || [...windows][0];
    if (win) win.loadURL(ORIGIN + route);
  };

  const template = [
    {
      label: "Archivo",
      submenu: [
        { label: "Nueva ventana", accelerator: "CmdOrCtrl+N", click: () => createWindow() },
        { type: "separator" },
        { label: "Cerrar ventana", role: "close" },
        { label: "Salir", role: "quit" },
      ],
    },
    {
      label: "Editar",
      submenu: [
        { label: "Deshacer", role: "undo" },
        { label: "Rehacer", role: "redo" },
        { type: "separator" },
        { label: "Cortar", role: "cut" },
        { label: "Copiar", role: "copy" },
        { label: "Pegar", role: "paste" },
        { label: "Seleccionar todo", role: "selectAll" },
      ],
    },
    {
      label: "Ver",
      submenu: [
        { label: "Recargar", role: "reload" },
        { label: "Forzar recarga", role: "forceReload" },
        { type: "separator" },
        { label: "Tamaño original", role: "resetZoom" },
        { label: "Acercar", role: "zoomIn" },
        { label: "Alejar", role: "zoomOut" },
        { type: "separator" },
        { label: "Pantalla completa", role: "togglefullscreen" },
        { label: "Herramientas de desarrollo", role: "toggleDevTools" },
      ],
    },
    {
      label: "Ir",
      submenu: [
        { label: "Dashboard", accelerator: "CmdOrCtrl+1", click: go("/") },
        { label: "Contactos", accelerator: "CmdOrCtrl+2", click: go("/contacts") },
        { label: "Empresas", accelerator: "CmdOrCtrl+3", click: go("/companies") },
        { label: "Pipeline", accelerator: "CmdOrCtrl+4", click: go("/pipeline") },
        { label: "Tareas", accelerator: "CmdOrCtrl+5", click: go("/tasks") },
        { type: "separator" },
        { label: "Automatizaciones", click: go("/automations") },
        { label: "Formularios", click: go("/forms") },
        { label: "Informes", click: go("/reports") },
        { label: "Ajustes", click: go("/settings") },
      ],
    },
    {
      label: "Ayuda",
      submenu: [
        {
          label: "Abrir en el navegador",
          click: () => shell.openExternal(APP_URL),
        },
        {
          label: "Cerrar sesión en esta app",
          click: async () => {
            const { response } = await dialog.showMessageBox({
              type: "question",
              buttons: ["Cancelar", "Cerrar sesión"],
              defaultId: 1,
              cancelId: 0,
              title: "Cerrar sesión",
              message: "¿Borrar la sesión guardada en la aplicación?",
              detail: "Tendrás que volver a introducir tu email y contraseña.",
            });
            if (response !== 1) return;
            await session.fromPartition("persist:aurum").clearStorageData();
            const win = BrowserWindow.getFocusedWindow() || [...windows][0];
            if (win) win.loadURL(ORIGIN + "/login");
          },
        },
        { type: "separator" },
        {
          label: "Acerca de Aurum",
          click: () =>
            dialog.showMessageBox({
              type: "info",
              title: "Aurum CRM",
              message: `Aurum CRM ${app.getVersion()}`,
              detail: `Aplicación de escritorio.\nConectada a ${APP_URL}\n\nElectron ${process.versions.electron} · Chromium ${process.versions.chrome}`,
            }),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* --------------------------------------------------------------- ciclo --- */

// Una sola instancia: si ya está abierta, se trae al frente.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const win = [...windows][0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    buildMenu();
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
