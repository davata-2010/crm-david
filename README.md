# Aurum · AI Agency CRM

Implementación del handoff de Claude Design `Aurum CRM.dc.html` en **Next.js 14 + TypeScript + Tailwind + Supabase**.

**Aurum no se aloja: se instala.** No hay servidor propio ni alojamiento web.
La aplicación se compila a ficheros estáticos que van dentro del instalador de
escritorio y del APK, y habla directamente con Supabase, donde están los datos.

| | |
|---|---|
| Ordenador | `npm run desktop:dist` → `desktop/dist/Aurum-CRM-Instalador-1.0.0.exe` |
| Móvil | `android/build-apk.ps1` → `android/dist/Aurum-CRM-1.0.0.apk` |

Lo único que sigue atendiendo llamadas de fuera son cinco funciones en Supabase
(ver [Lo que vive en Supabase](#lo-que-vive-en-supabase)).

## Puesta en marcha

### 1. Base de datos — ya aplicada

El esquema de [`supabase/schema.sql`](supabase/schema.sql) ya está creado en el proyecto: tablas `profiles`, `companies`, `contacts`, `deals`, `activities`, RLS por usuario, triggers de `updated_at`/`closed_at`, alta automática de perfil al registrarse y publicación realtime.

Para volver a comprobarlo en cualquier momento:

```bash
npm run db:check
```

Si cambias el esquema, vuelve a ejecutar el fichero en el [SQL Editor](https://supabase.com/dashboard/project/octfqtwkafqenktigevn/sql/new) — es idempotente.

### 2. Arrancar

```bash
npm install && npm run dev      # desarrollo, en el navegador
npm run build                   # exportación estática en out/
npm run desktop                 # compila y abre la aplicación de escritorio
```

Regístrate en `/login` con email y contraseña. En el dashboard vacío puedes pulsar **Cargar datos de ejemplo** para poblar el workspace con el set del handoff (8 empresas, 8 contactos, 10 deals y su timeline) — todo se escribe en Supabase.

> La confirmación por email está desactivada en este proyecto (`mailer_autoconfirm = true`), así que el registro entra directo. Actívala en Authentication → Providers → Email antes de pasar a producción.

## Qué hay implementado

### Multiusuario

El CRM dejó de ser una isla por usuario. Hay **workspaces** con miembros y cuatro roles: propietario, administrador, miembro y sólo lectura. Las políticas RLS pasaron de `owner_id = auth.uid()` a "eres miembro de este workspace", así que el equipo comparte contactos, empresas, deals y actividades. Contactos y deals tienen responsable asignado, y el selector del workspace está en la cabecera de la barra lateral.

Las invitaciones se crean desde Ajustes → Equipo y generan un enlace `/invite/<token>`. El CRM todavía no envía emails: copia el enlace y mándalo tú. Si la persona se registra con ese email, el alta la mete directamente en el workspace.

### Papelera

Nada se borra de golpe. Todo pasa por `deleted_at` y aterriza en `/trash`, donde se puede restaurar o borrar definitivamente. Vaciar la papelera es cosa de administradores.

### Rendimiento

La tabla de contactos ya no se trae la base de datos entera. Filtros, búsqueda, orden y paginación se resuelven en Postgres contra la vista `contact_rows`, que agrega valor abierto, número de deals, última actividad y tareas pendientes por contacto. El estado vive en la URL, así que las vistas se pueden compartir y guardar.

### Móvil

Barra lateral deslizante, rejillas que colapsan y tablas con scroll horizontal. La aplicación es usable desde el teléfono.

### Pantallas

| Pantalla | Ruta | Qué hace |
|---|---|---|
| Dashboard | `/` | KPIs enlazados, pipeline por etapa, foco del día con tareas vencidas, deals que necesitan atención |
| Contactos | `/contacts` | Filtrado y paginación en servidor, selección múltiple, acciones en lote, vistas guardadas, duplicados, import/export CSV |
| Detalle contacto | `/contacts/[id]` | Ficha, etiquetas, campos personalizados, responsable, tareas, timeline, adjuntos y asistente |
| Empresas | `/companies`, `/companies/[id]` | Cuentas con valor abierto y ganado, contactos, deals y timeline agregado |
| Pipeline | `/pipeline` | Kanban de 7 etapas con drag & drop, vista ponderada, filtros, columna de perdidos con motivo |
| Deal | `/deals/new`, `/deals/[id]` | Formulario con resumen en vivo, campos personalizados, adjuntos y asistente |
| Tareas | `/tasks` | Vencidas, hoy, semana, más adelante y completadas; completar y posponer |
| Actividad | `/activity` | Feed global agrupado por día con filtros y exportación |
| Informes | `/reports` | Embudo, ingresos por mes, ranking de empresas, motivos de pérdida, tipos, volumen de actividad |
| Papelera | `/trash` | Restaurar o borrar definitivamente |
| Ajustes | `/settings` | Perfil, equipo, pipeline, campos personalizados, API, historial de cambios y datos |

### Cuadrícula al estilo Airtable en contactos, empresas y deals

Las tres entidades principales comparten el mismo motor de vistas: `/contacts`, `/companies` y `/deals` son hojas de trabajo, no tablas de solo lectura.

- **Edición en la propia celda.** Doble clic (o Intro sobre la celda activa) y editas: texto, email, teléfono, estado, empresa, responsable, etiquetas y campos personalizados. El valor se pinta antes de que responda el servidor y se revierte si falla.
- **Cuatro vistas sobre los mismos datos:** tabla, kanban (apilable por estado, empresa, responsable o cualquier campo agrupable, con arrastre entre columnas), calendario mensual y galería de fichas.
- **Constructor de filtros** con varias condiciones encadenadas, operadores por tipo de campo (contiene, es, está vacío, mayor que, incluye, antes de…) y traducción a consultas de Postgres.
- **Orden múltiple**: primero por un campo, luego por otro.
- **Agrupación** por cualquier campo agrupable, con grupos plegables, conteo y suma de valor por grupo.
- **Gestión de campos**: mostrar, ocultar y reordenar columnas; redimensionar arrastrando; altura de fila corta, media o alta.
- **Navegación con teclado**: flechas para moverse, Intro para editar, Tab para saltar de columna, barra espaciadora para abrir la ficha, Esc para salir.
- **Ficha expandida** en panel lateral, con los mismos campos editables y los calculados aparte.
- **Alta rápida** escribiendo un nombre en la última fila.
- **Todo el estado vive en la URL**, así que cualquier configuración de vista se comparte con un enlace y se guarda como vista con nombre.

Los campos calculados se marcan con `ƒ` en la cabecera y salen de vistas de Postgres con agregados:

| Vista | Calcula |
|---|---|
| `contact_rows` | valor abierto, deals abiertos, tareas pendientes, última actividad |
| `company_rows` | contactos, deals, valor en pipeline, valor ganado, última actividad |
| `deal_rows` | ponderado por probabilidad de etapa, probabilidad, días abierto, días al cierre, nº de actividades |

El pipeline kanban especializado sigue en `/pipeline` con sus etapas, forecast ponderado y motivo de pérdida; `/deals` es la misma información en cuadrícula. Se salta de uno a otro desde la cabecera.

### Automatizaciones

`/automations` — el «cuando pase esto, haz esto otro» de GoHighLevel.

**Disparadores:** se crea un contacto · se le añade una etiqueta concreta · cambia de estado · se crea un deal · un deal llega a una etapa · se envía un formulario.

**Condiciones** opcionales con el mismo constructor que los filtros de la cuadrícula.

**Acciones encadenables:** esperar (días, horas o minutos) · añadir o quitar etiqueta · cambiar estado · mover de etapa · asignar responsable · crear tarea con vencimiento · añadir nota · crear deal · llamar a un webhook.

En cualquier texto se puede usar `{{name}}`, `{{email}}` o cualquier campo del registro; se sustituye al ejecutarse.

El motor vive en TypeScript y se dispara desde las propias acciones del CRM. Postgres guarda la definición, el historial paso a paso de cada ejecución y las esperas pendientes. Un trabajo de `pg_cron` llama cada minuto a la función `cron-workflows` (protegida por `CRON_SECRET`) para reanudar lo que ya venció.

Si una automatización falla, la ejecución queda marcada con el error y **no rompe la acción del usuario que la disparó**.

### Ejecutar en n8n o en Make

Cada automatización elige **dónde se ejecuta**, en el panel «Dónde se ejecuta» de su ficha.

- **Dentro de Aurum** (por defecto). Sin dependencias externas y con esperas de cualquier duración.
- **En n8n.** Aurum sigue evaluando el disparador y las condiciones —es quien conoce los datos— y llama al webhook del workflow con `{ workflow, entity, record, firedAt }`. n8n orquesta los pasos y vuelve a Aurum por API para escribir.

El reparto es a propósito: el workflow que aparece en n8n es funcional de verdad y se puede ampliar allí con cualquier otro nodo (email, SMS, Slack, lo que sea) sin tocar el CRM.

**Conectar n8n:** Ajustes → Integraciones → URL de la instancia y clave de API (en n8n: *Settings → n8n API → Create an API key*). El botón «Probar conexión» comprueba las credenciales de verdad contra `/api/v1/workflows`.

**Reflejarla:** desde la automatización, «En n8n». Aurum crea el workflow —o actualiza el que ya creó, sin duplicar— y lo publica, porque un workflow despublicado no atiende su webhook. Guarda el id, el nombre, la URL del webhook y la fecha de la última sincronización.

**Make** no permite crear escenarios por API sin plan de equipo, así que ahí la sincronización automática no existe. Desde cada automatización se descarga su *blueprint* y se importa con *Create a new scenario → Import Blueprint*: el escenario resultante funciona igual.

Los dos JSON también se pueden descargar a mano («JSON para n8n», «Blueprint para Make»). El de n8n incluye el id del workflow, que es lo que `n8n import:workflow` necesita.

**La API que ejecutan esos workflows:**

```
POST https://<proyecto>.supabase.co/functions/v1/automation-action
X-Api-Key: aur_live_…
{ "action": "add_tag", "entity": "contacts", "id": "…", "value": "vip" }
```

Acciones: `get_record` · `add_tag` · `remove_tag` · `set_status` · `set_stage` · `assign` · `create_task` · `add_note` · `create_deal`. Acepta `{{campo}}` en los textos igual que el motor interno, valida estado y etapa, y sólo toca registros del workspace al que pertenece la clave.

> La clave del workspace viaja dentro del workflow generado, en la cabecera de cada nodo HTTP. Ese JSON es material sensible.

### Formularios de captación

`/forms` — constructor de formularios que se entregan como código.

- Campos configurables: nombre, email, teléfono, empresa, mensaje y campos personalizados; cada uno con su etiqueta, tipo y obligatoriedad.
- **Se publican pegando**: el constructor da el HTML completo del formulario, sin dependencias externas, para pegarlo en cualquier web; o descarga la página entera para subirla donde quieras. Aurum ya no aloja nada, y Supabase tampoco puede: su pasarela devuelve todo como `text/plain` con `sandbox` en el dominio compartido, así que no se pueden servir páginas HTML desde una función. Lo que sí vive allí es el endpoint que recibe los envíos.
- Cada envío crea el contacto —**sin duplicar si el email ya existe**, en ese caso añade otra actividad—, crea la empresa si hace falta, aplica las etiquetas del formulario, lo registra en el timeline y dispara las automatizaciones.
- Vista previa en vivo mientras editas.

### Lo que vive en Supabase

Cinco funciones, en el mismo proyecto que guarda los datos. Son lo único que
atiende llamadas de fuera, porque tienen que hacerlo: un cliente no puede abrir
una página que vive en tu móvil.

| Función | Para qué | Protección |
|---|---|---|
| `leads` | Alta de contactos desde una web, un anuncio o cualquier integración | Clave del workspace (`aur_live_…`) |
| `form-submit` | Recibe los envíos de los formularios de captación | El slug del formulario, que debe existir y estar activo |
| `automation-action` | Las nueve acciones del CRM que ejecutan n8n y Make | Clave del workspace |
| `cron-workflows` | Reanuda las automatizaciones que estaban esperando | `CRON_SECRET`; la llama pg_cron cada minuto |
| `ai` | El asistente | El JWT del usuario: sólo ve lo que él vería |

```bash
npm run edge:deploy      # copia el código compartido y despliega
supabase secrets set CRON_SECRET=…
```

El motor de automatizaciones no se duplica: `npm run edge:sync` copia
`lib/workflows.ts`, `lib/constants.ts` y `lib/format.ts` a
`supabase/functions/_shared/`, así que no pueden divergir. Editar esas copias a
mano no sirve de nada — el siguiente despliegue las pisa.

### Menú contextual propio

El clic derecho está capturado en toda la aplicación y ofrece acciones según dónde pulses: filas de contacto (abrir, editar, duplicar, email, crear deal, asignar, cambiar estado, papelera), selección múltiple (estado, responsable, etiquetas, empresa, fusionar, exportar, papelera), tarjetas y columnas del kanban, tareas, empresas, actividades, papelera y la propia barra lateral.

### API de captación de leads

```
POST https://<proyecto>.supabase.co/functions/v1/leads
X-Api-Key: aur_live_…
{ "name": "...", "email": "...", "company": "...", "tags": "a,b", "message": "..." }
```

Crea el contacto, la empresa si no existe y la primera actividad. Si el email ya está en el workspace no duplica: añade una actividad al contacto existente. La clave se ve, se copia y se rota desde Ajustes → API.

### Asistente

Botones de resumen de cuenta, borrador de email de seguimiento y puntuación de lead en la ficha de contactos y deals. Cada llamada arma un briefing con los datos reales del registro y su historial.

Se ejecuta en Supabase, no en la aplicación: la clave de Anthropic no puede
viajar dentro de un instalador ni de un APK, donde cualquiera podría leerla. La
petición va firmada con el JWT de quien pregunta, así que las consultas se hacen
con su sesión y las RLS siguen aplicando.

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-…
```

Sin esa clave los botones responden con un aviso explicando qué falta; el resto del CRM funciona igual.

### Aplicación Android (APK)

`android/` es un APK que **lleva el CRM dentro**: la exportación estática viaja
en `assets/web/`. No abre ninguna URL ni pasa por el navegador.

```powershell
$env:AURUM_KEYSTORE_PASS = "..."
powershell -ExecutionPolicy Bypass -File androiduild-apk.ps1
# genera android\dist\Aurum-CRM-1.0.0.apk
```

Requiere Android Studio (aporta el JDK y el SDK) y haber hecho `npm run build`
antes: el script copia `out/` a los assets. El APK pesa **menos de 2 MB** porque
el render lo hace el WebView del sistema, no un motor incrustado.

Dos detalles del empaquetado que, mal resueltos, dejan la aplicación en negro:

- aapt ignora por defecto las carpetas que empiezan por guión bajo, y Next pone
  todo su JavaScript en `_next/`. Por eso `app/build.gradle` ajusta
  `ignoreAssetsPattern`.
- Se sirve con `WebViewAssetLoader` bajo `appassets.androidplatform.net`, que es
  un origen **https** de verdad. Con `file://` no habría almacenamiento local
  —donde Supabase guarda la sesión— y las llamadas a la API fallarían por CORS.
  `WebAssets.java` resuelve cada ruta a su fichero (`/contacts/` →
  `contacts/index.html`), algo que el handler que trae la librería no hace.

La clave de firma (`android/aurum.keystore`) **no está en el repositorio**. Para regenerarla:

```
keytool -genkeypair -v -keystore android/aurum.keystore -alias aurum   -keyalg RSA -keysize 2048 -validity 10950   -dname "CN=Aurum CRM, OU=Aurum, O=Aurum, L=Madrid, C=ES"
```

Los iconos de las cinco densidades los genera `npm run icons`, igual que los de la PWA y el `.ico` de escritorio.

### Aplicación de escritorio (Electron)

`desktop/` empaqueta Aurum como aplicación de Windows, con la exportación
estática dentro.

```bash
npm run desktop:dist     # compila la app y genera instalador y portable
npm run desktop          # compila y la abre sin empaquetar, para probar
```

Se sirve por un esquema propio, `aurum://app`, en vez de `file://`: un origen de
fichero no tiene almacenamiento propio, y ahí es donde Supabase guarda la
sesión. El handler se registra **en la partición de la ventana**, no en la
sesión por defecto — en la equivocada, la ventana se abre en blanco — y declara
el `Content-Type` de cada fichero, sin el cual Chromium no reconoce el índice
como HTML.

Al llevar la aplicación dentro, actualizar el CRM significa volver a generar el
instalador.

- Sesión persistente en su propia partición, así que el login se mantiene entre arranques.
- Menú en español con atajos: `Ctrl+1` a `Ctrl+5` para saltar de sección, `Ctrl+N` para una ventana nueva.
- Los enlaces externos se abren en el navegador del sistema; la app no puede navegar fuera de su dominio.
- Recuerda tamaño y posición de la ventana.
- Pantalla propia de «sin conexión» si no hay internet.
- Una sola instancia: al abrirla de nuevo se trae al frente la que ya estaba.
- `Ayuda → Cerrar sesión en esta app` borra la sesión guardada.

El icono `.ico` multi-resolución lo genera el mismo script que los de la PWA (`npm run icons`), sin dependencias externas.

**El instalador no está firmado digitalmente.** Windows mostrará el aviso de SmartScreen la primera vez: *Más información → Ejecutar de todas formas*. Firmarlo requiere un certificado de pago.

### Instalable como aplicación (PWA)

Aurum se instala en móvil y ordenador desde el propio navegador: sin tiendas, sin cuenta de desarrollador y sin coste. Incluye manifiesto, iconos (normales y *maskable*), service worker y pantalla de sin conexión.

- **Android / Chrome:** menú ⋮ → *Instalar aplicación*.
- **iPhone / iPad:** Safari → Compartir → *Añadir a pantalla de inicio*. En iOS sólo funciona desde Safari.
- **Ordenador (Chrome o Edge):** icono de instalar en la barra de direcciones, o menú ⋮ → *Instalar Aurum*.

También hay un botón de instalación en **Ajustes → Aplicación**, que aparece cuando el navegador lo permite.

El service worker es deliberadamente conservador: cachea sólo el armazón estático y la pantalla de sin conexión. **No cachea datos ni respuestas de la API**, porque enseñar un pipeline de hace tres días sería peor que no enseñar nada. Los iconos se regeneran con `npm run icons`.

### Otras piezas

- **Historial de cambios** por triggers en Postgres: quién creó, editó, borró o restauró qué y qué campos cambiaron. Visible en Ajustes → Historial.
- **Campos personalizados** por workspace, para contactos y deals, con tipos texto, número, fecha, desplegable y casilla.
- **Adjuntos** en Supabase Storage con bucket privado y URLs firmadas de 60 segundos.
- **Detección y fusión de duplicados** por email o nombre normalizado; la fusión mueve deals, actividades y adjuntos al superviviente.
- **Vistas guardadas** de la tabla de contactos, compartidas con el equipo.
- **Paleta de comandos** con `⌘K` / `Ctrl+K`.
- **Diálogos y avisos propios** en lugar de los del navegador.
- **Tiempo real** por `postgres_changes` filtrado por workspace.

## Estructura

```
app/
  (app)/            layout con sidebar + rutas autenticadas
  api/leads/        captación de leads con clave de API
  api/ai/           asistente (requiere ANTHROPIC_API_KEY)
  invite/[token]/   aceptación de invitaciones
  login/            alta y acceso con Supabase Auth
  actions.ts        server actions: CRUD, lote, papelera, equipo, vistas, campos
  seed.ts           carga del set de datos de ejemplo
components/         Sidebar, PageHeader, PipelineBoard, Timeline, formularios…
lib/                cliente Supabase (browser/server), métricas, formato, tipos
supabase/
  schema.sql        esquema inicial
  migrations/       002 pro · 003 workspaces · 004 storage · 005 vistas
middleware.ts       refresco de sesión y guarda de rutas
```

## Notas

- `.env.local` contiene la URL y la anon key del proyecto. La anon key es pública por diseño: el acceso lo controla RLS (`owner_id = auth.uid()`).
- `SUPABASE_SERVICE_KEY` está en `.env.local`, que es un fichero ignorado por git y nunca ha entrado en este repositorio. La app **no** la usa: todo el acceso pasa por la sesión del usuario y las políticas RLS.
