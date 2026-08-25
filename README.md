# Aurum · AI Agency CRM

Implementación del handoff de Claude Design `Aurum CRM.dc.html` en **Next.js 14 (App Router) + TypeScript + Tailwind + Supabase**.

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

| Pantalla del handoff | Ruta | Datos |
|---|---|---|
| Dashboard | `/` | KPIs, pipeline por etapa, próximas actividades y "deals que necesitan atención", todo calculado sobre filas reales |
| Contactos | `/contacts` | Filtros por estado, búsqueda, orden por columna, valor = suma de deals abiertos |
| Detalle contacto | `/contacts/[id]` | Ficha, stats, timeline filtrable, deals abiertos, alta de actividad, edición y borrado |
| Pipeline | `/pipeline` | Kanban de 6 etapas con drag & drop (`@dnd-kit/core`); cada movimiento persiste el deal y registra una actividad |
| Nuevo/editar deal | `/deals/new`, `/deals/[id]` | Formulario con resumen en vivo idéntico al handoff |
| Empresas | `/companies` | CRUD con contactos y valor abierto por cuenta |
| Ajustes | `/settings` | Perfil y preferencias reales en `profiles`; etapas con conteos reales; equipo; integraciones |

**Tiempo real:** `components/Realtime.tsx` se suscribe a `postgres_changes` de las cuatro tablas filtrando por `owner_id` y refresca los Server Components, así que dashboard, tabla y kanban se actualizan solos entre pestañas.

**Diseño:** paleta, tipografías, radios, tamaños y espaciados salen literalmente del handoff (`#080808` / `#111111` / `#FAC51C`, Inter, tarjetas `14px`, chips `999px`). Los tokens están en `tailwind.config.ts` y `app/globals.css`.

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
- `SUPABASE_SERVICE_KEY` está en `.env.local` pero la app **no** la usa: todo pasa por la sesión del usuario. No la subas a un repo público.
