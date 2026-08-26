# Aurum · AI Agency CRM

Implementación del handoff de Claude Design `Aurum CRM.dc.html` en **Next.js 14 (App Router) + TypeScript + Tailwind + Supabase**.

**En producción:** https://crm-david-538.netlify.app

Cada push a `main` despliega automáticamente en Netlify.

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
npm install && npm run dev
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

### Menú contextual propio

El clic derecho está capturado en toda la aplicación y ofrece acciones según dónde pulses: filas de contacto (abrir, editar, duplicar, email, crear deal, asignar, cambiar estado, papelera), selección múltiple (estado, responsable, etiquetas, empresa, fusionar, exportar, papelera), tarjetas y columnas del kanban, tareas, empresas, actividades, papelera y la propia barra lateral.

### API de captación de leads

```
POST /api/leads
X-Api-Key: aur_live_…
{ "name": "...", "email": "...", "company": "...", "tags": "a,b", "message": "..." }
```

Crea el contacto, la empresa si no existe y la primera actividad. Si el email ya está en el workspace no duplica: añade una actividad al contacto existente. La clave se ve, se copia y se rota desde Ajustes → API.

### Asistente

Botones de resumen de cuenta, borrador de email de seguimiento y puntuación de lead en la ficha de contactos y deals. Cada llamada arma un briefing con los datos reales del registro y su historial.

**Requiere configurar `ANTHROPIC_API_KEY`** en las variables de entorno de Netlify. Sin ella, los botones responden con un aviso explicando qué falta; el resto del CRM funciona igual.

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
