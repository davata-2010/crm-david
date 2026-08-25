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

| Pantalla | Ruta | Qué hace |
|---|---|---|
| Dashboard | `/` | KPIs enlazados, pipeline por etapa, "tu foco" con tareas vencidas y de hoy, deals que necesitan atención |
| Contactos | `/contacts` | Tabla con selección múltiple, acciones en lote, filtros por estado/empresa/etiqueta, orden, paginación, import/export CSV |
| Detalle contacto | `/contacts/[id]` | Ficha, etiquetas, stats, tareas pendientes, timeline filtrable, deals abiertos, edición y borrado |
| Empresas | `/companies` | Fichas de cuenta con valor abierto y ganado, contactos vinculados |
| Detalle empresa | `/companies/[id]` | Datos, deals de la cuenta, contactos y timeline agregado |
| Pipeline | `/pipeline` | Kanban de 7 etapas con drag & drop, filtros, vista ponderada, columna de perdidos con motivo |
| Deal | `/deals/new`, `/deals/[id]` | Formulario con resumen en vivo, etiquetas, motivo de pérdida, cambio de etapa |
| Tareas | `/tasks` | Vencidas, hoy, esta semana, más adelante y completadas; alta rápida, completar y posponer |
| Actividad | `/activity` | Feed global agrupado por día, filtros por tipo y periodo, exportación |
| Informes | `/reports` | Embudo de conversión, ingresos por mes, ranking de empresas, motivos de pérdida, tipos de proyecto, volumen de actividad |
| Ajustes | `/settings` | Perfil y preferencias, etapas, equipo, integraciones y pestaña de datos (exportar todo / vaciar workspace) |

### Menú contextual propio

El clic derecho está capturado en toda la aplicación: en lugar del menú de Chrome sale uno propio, con las acciones que tienen sentido según dónde pulses.

- **Fila de contacto:** abrir, abrir en pestaña nueva, editar, duplicar, enviar email, copiar email o teléfono, crear deal, añadir tarea, cambiar estado y **eliminar**.
- **Varios contactos seleccionados:** cambiar estado en bloque, etiquetar, desasignar empresa, exportar la selección y **eliminar en lote**.
- **Tarjeta del kanban:** abrir, editar, duplicar, ir al contacto, añadir tarea, copiar valor, mover a cualquier etapa y eliminar.
- **Columna del kanban:** nuevo deal en esa etapa, exportar la columna, alternar ponderado y ocultar cerrados.
- **Tarea:** completar, posponer 1 día / 3 días / 1 semana, ir al contacto o al deal, eliminar.
- **Empresa, actividad y fondo de cada página** tienen su propio menú con exportación, selección y limpieza de filtros.

Se cierra con `Esc`, con un clic fuera o al hacer scroll, y se reposiciona solo si no cabe en pantalla.

### Otras piezas

- **Paleta de comandos** con `⌘K` / `Ctrl+K`: busca contactos, deals y empresas en Supabase y salta a cualquier sección.
- **Diálogos de confirmación y avisos** propios, en lugar de los `confirm()` y `alert()` del navegador.
- **Etiquetas de colores** en contactos y deals, con color estable derivado del texto.
- **Import/export CSV** con cabeceras en español o inglés; la importación crea las empresas que falten.
- **Selección con Mayús+clic** para marcar rangos completos en la tabla.
- **Tiempo real:** `components/Realtime.tsx` se suscribe a `postgres_changes` de las cuatro tablas y refresca los Server Components.

## Estructura

```
app/
  (app)/            layout con sidebar + rutas autenticadas
  login/            alta y acceso con Supabase Auth
  actions.ts        server actions: CRUD de contactos, empresas, deals y actividades
  seed.ts           carga del set de datos de ejemplo
components/         Sidebar, PageHeader, PipelineBoard, Timeline, formularios…
lib/                cliente Supabase (browser/server), métricas, formato, tipos
supabase/schema.sql esquema + RLS + realtime
middleware.ts       refresco de sesión y guarda de rutas
```

## Notas

- `.env.local` contiene la URL y la anon key del proyecto. La anon key es pública por diseño: el acceso lo controla RLS (`owner_id = auth.uid()`).
- `SUPABASE_SERVICE_KEY` está en `.env.local`, que es un fichero ignorado por git y nunca ha entrado en este repositorio. La app **no** la usa: todo el acceso pasa por la sesión del usuario y las políticas RLS.
