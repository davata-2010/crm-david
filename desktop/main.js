const { app, BrowserWindow, Menu, protocol, shell, dialog, session } = require("electron");
const path = require("node:path");
const fs = require("node:fs");

/**
 * Aurum de escritorio.
 *
 * La aplicación va DENTRO del instalador: `web/` es la exportación estática
 * del CRM. No hay servidor, ni propio ni ajeno. Se sirve por un esquema
 * propio, `aurum://app`, en vez de `file://`, porque un origen de fichero no
 * tiene almacenamiento local propio y Supabase guarda ahí la sesión: con
 * `file://` habría que iniciar sesión en cada arranque.
 */

const SCHEME = "aurum";
const ORIGIN = `${SCHEME}://app`;
const PARTITION = "persist:aurum"; // mantiene la sesión iniciada entre arranques

/** En desarrollo la exportación está en ../out; empaquetada, junto a main.js. */
const WEB_ROOT = app.isPackaged
  ? path.join(process.resourcesPath, "web")
  : path.join(__dirname, "..", "out");

/* -------------------------------------------------------- el servidor --- */
// Sin red: se responde con ficheros del disco.

protocol.registerSchemesAsPrivileged([
  {
    scheme: SCHEME,
    privileges: {
      standard: true, // hace que tenga origen, y con él localStorage
      secure: true, // contexto seguro: service worker, cripto, portapapeles
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

/**
 * Traduce una ruta de la aplicación a un fichero de la exportación.
 * `/contacts/` → contacts/index.html · `/_next/x.js` → _next/x.js
 */
function resolveFile(pathname) {
  const clean = decodeURIComponent(pathname).replace(/^\/+/, "");

  // Nadie puede salirse de la carpeta web, ni con ../ ni con rutas absolutas.
  const target = path.resolve(WEB_ROOT, clean);
  const root = path.resolve(WEB_ROOT);
  if (target !== root && !target.startsWith(root + path.sep)) return null;

  const candidates = clean.endsWith("/") || clean === ""
    ? [path.join(target, "index.html")]
    : [target, `${target}.html`, path.join(target, "index.html")];

  for (const file of candidates) {
    try {
      if (fs.statSync(file).isFile()) return file;
    } catch {
      // siguiente candidato
    }
  }
  return null;
}

/**
 * Tipo de contenido por extensión.
 *
 * Hay que declararlo: sin `Content-Type` Chromium no sabe que el índice es
 * HTML y deja la ventana en blanco, que es exactamente lo que pasaba.
 */
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json; charset=utf-8",
};

function registerProtocol() {
  // Se registra en la partición de la ventana, no en la sesión por defecto:
  // cada partición tiene su propio registro y la ventana vive en la suya.
  // Registrado en la equivocada, la ventana se abría en blanco.
  session.fromPartition(PARTITION).protocol.handle(SCHEME, async (request) => {
    const { pathname } = new URL(request.url);
    const file = resolveFile(pathname);

    // Una ruta desconocida devuelve la página de la aplicación igualmente:
    // el enrutador del cliente sabe qué hacer con ella.
    const fallback = path.join(WEB_ROOT, "404.html");
    const chosen = file ?? (fs.existsSync(fallback) ? fallback : null);

    if (!chosen)
      return new Response("No encontrado", {
        status: 404,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });

    const type = MIME[path.extname(chosen).toLowerCase()] ?? "application/octet-stream";
    return new Response(await fs.promises.readFile(chosen), {
      status: file ? 200 : 404,
      headers: { "Content-Type": type },
    });
  });
}

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
    fs.writeFileSync(stateFile(), JSON.stringify({ ...b, maximized: win.isMaximized() }));
  } catch {
    // Si no se puede guardar, la próxima vez abre con el tamaño por defecto.
  }
}

/* ------------------------------------------------------------- ventana --- */

const windows = new Set();

function createWindow(route = "/") {
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
      // La aplicación no necesita nada del sistema: se le cierra la puerta.
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      spellcheck: true,
      partition: PARTITION,
    },
  });

  if (state.maximized) win.maximize();
  windows.add(win);

  win.once("ready-to-show", () => win.show());
  win.on("close", () => saveState(win));
  win.on("closed", () => windows.delete(win));

  // Los enlaces externos van al navegador del sistema, no abren ventanas nuevas.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(ORIGIN)) createWindow(new URL(url).pathname);
    else shell.openExternal(url);
    return { action: "deny" };
  });

  // Nada saca a la ventana de la propia aplicación.
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

  win.loadURL(ORIGIN + route);
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
        { label: "Contactos", accelerator: "CmdOrCtrl+2", click: go("/contacts/") },
        { label: "Empresas", accelerator: "CmdOrCtrl+3", click: go("/companies/") },
        { label: "Pipeline", accelerator: "CmdOrCtrl+4", click: go("/pipeline/") },
        { label: "Tareas", accelerator: "CmdOrCtrl+5", click: go("/tasks/") },
        { type: "separator" },
        { label: "Automatizaciones", click: go("/automations/") },
        { label: "Formularios", click: go("/forms/") },
        { label: "Informes", click: go("/reports/") },
        { label: "Ajustes", click: go("/settings/") },
      ],
    },
    {
      label: "Ayuda",
      submenu: [
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
            await session.fromPartition(PARTITION).clearStorageData();
            const win = BrowserWindow.getFocusedWindow() || [...windows][0];
            if (win) win.loadURL(ORIGIN + "/login/");
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
              detail:
                `La aplicación va dentro del instalador; tus datos están en Supabase.\n\n` +
                `Electron ${process.versions.electron} · Chromium ${process.versions.chrome}`,
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
    registerProtocol();
    buildMenu();

    if (!fs.existsSync(path.join(WEB_ROOT, "index.html"))) {
      dialog.showErrorBox(
        "Falta la aplicación",
        `No encuentro la exportación del CRM en:\n${WEB_ROOT}\n\n` +
          `Si estás ejecutando desde el código, lanza antes "npm run build" en la raíz.`
      );
      app.quit();
      return;
    }

    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
