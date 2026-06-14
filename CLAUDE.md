# CLAUDE.md — Catálogo SIP & Casas Prefabricadas

> Este archivo es la fuente de verdad del proyecto. Léelo completo antes de escribir
> cualquier línea de código. Si algo no está claro o falta información crítica,
> **pregunta antes de asumir**.

---

## 1. Visión general del proyecto

Plataforma web para una empresa fabricante de **paneles SIP** y **casas prefabricadas**.
Fase actual: catálogo público autoadministrable.
Fase futura (ya considerada en la arquitectura): e-commerce con carrito y pagos.

**Regla de oro:** cada decisión de arquitectura debe soportar ambas fases sin reescritura mayor.

---

## 2. Stack tecnológico — NO negociable

| Capa | Tecnología | Versión mínima | Notas |
|---|---|---|---|
| Framework | Astro | 4.x | Modo híbrido (SSR + estático) |
| Componentes interactivos | React | 18.x | Solo donde hay interactividad real |
| Estado compartido | Nano Stores | latest | Para carrito y estado global |
| Base de datos | Supabase (PostgreSQL) | — | Con RLS activado en TODAS las tablas |
| Storage archivos | Supabase Storage | — | Buckets separados por tipo |
| Autenticación | Supabase Auth | — | Solo para panel admin |
| Hosting | Vercel | — | Con soporte SSR para Astro |
| Pagos (fase 2) | MercadoPago | — | Preparar estructura, no implementar aún |
| Lenguaje | TypeScript | 5.x | Obligatorio en todo el proyecto |
| Estilos | Tailwind CSS | v4.x | Integración oficial @astrojs/tailwind |

**Si consideras agregar una dependencia que no está en esta lista, pregunta primero.**

---

## 3. Estructura de carpetas

```
/
├── src/
│   ├── components/
│   │   ├── catalogo/          # Componentes del catálogo público
│   │   ├── admin/             # Componentes del panel admin (React)
│   │   └── ui/                # Componentes genéricos reutilizables
│   ├── layouts/
│   │   ├── Layout.astro       # Layout principal público
│   │   └── AdminLayout.astro  # Layout del panel admin
│   ├── pages/
│   │   ├── index.astro        # Home con hero + catálogo
│   │   ├── paneles/           # Catálogo de paneles SIP
│   │   ├── casas/             # Catálogo de casas prefabricadas
│   │   ├── contacto.astro     # Formulario de cotización
│   │   └── admin/             # Panel de administración (protegido)
│   │       ├── index.astro    # Dashboard admin
│   │       ├── productos/     # CRUD paneles SIP
│   │       └── casas/         # CRUD casas prefabricadas
│   ├── lib/
│   │   ├── supabase.ts        # Cliente Supabase (server y client)
│   │   ├── auth.ts            # Helpers de autenticación
│   │   └── storage.ts         # Helpers de Supabase Storage
│   ├── stores/
│   │   └── cart.ts            # Nano Store del carrito (preparado para fase 2)
│   ├── types/
│   │   ├── producto.ts        # Tipos de paneles SIP
│   │   ├── casa.ts            # Tipos de casas prefabricadas
│   │   └── supabase.ts        # Tipos generados por Supabase CLI
│   └── middleware.ts           # Protección de rutas admin
├── public/
├── supabase/
│   └── migrations/            # Migraciones SQL versionadas
├── .env.example               # Variables de entorno documentadas (sin valores reales)
├── .env                       # Variables reales (nunca commitear)
├── astro.config.mjs
├── tailwind.config.mjs        # Tokens de color, fuentes y spacing del proyecto
└── CLAUDE.md                  # Este archivo
```

**Nunca crear archivos fuera de esta estructura sin preguntar.**

---

## 4. Variables de entorno

### Regla crítica de seguridad

```
PUBLIC_*   →  disponible en el cliente (browser). Solo ANON KEY y URL.
Sin PREFIX →  solo disponible en el servidor. SERVICE KEY nunca al cliente.
```

### `.env.example` (debe existir siempre en el repo)

```bash
# Supabase — públicas (seguras con RLS)
PUBLIC_SUPABASE_URL=https://TU_PROYECTO.supabase.co
PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Supabase — privada (NUNCA en el cliente)
SUPABASE_SERVICE_KEY=eyJ...

# Sitio
PUBLIC_SITE_URL=https://tu-dominio.com

# MercadoPago (fase 2 — dejar como placeholder)
# MP_ACCESS_TOKEN=
# MP_PUBLIC_KEY=
```

**Si en algún momento ves SUPABASE_SERVICE_KEY siendo importada en un componente
cliente o en una página que no sea SSR, detente y avisa. Es una vulnerabilidad crítica.**

---

## 5. Cliente Supabase — dos instancias, no una

```typescript
// src/lib/supabase.ts

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

// Cliente para el SERVIDOR (SSR, API routes, middleware)
// Usa SERVICE KEY — bypasea RLS cuando es necesario para admin
export const supabaseAdmin = createClient<Database>(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_KEY  // sin PUBLIC_ prefix
)

// Cliente para el NAVEGADOR (componentes React, islands)
// Usa ANON KEY — RLS lo protege
export const supabaseClient = createClient<Database>(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY
)
```

**Regla:** `supabaseAdmin` solo en archivos `.astro` con frontmatter SSR o en
`src/lib/`. Nunca en componentes `.tsx` que se hidratan en el cliente.

---

## 6. Base de datos — esquema completo

### Tabla: `paneles_sip`

```sql
CREATE TABLE paneles_sip (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        TEXT NOT NULL,
  descripcion   TEXT,
  espesor_mm    INTEGER NOT NULL,          -- espesor total en mm
  ancho_mm      INTEGER NOT NULL DEFAULT 1220,
  largo_mm      INTEGER NOT NULL DEFAULT 2440,
  r_value       DECIMAL(4,2),              -- resistencia térmica
  peso_kg_m2    DECIMAL(6,2),              -- peso por m²
  precio_clp    INTEGER,                   -- precio en pesos chilenos (fase 2)
  stock         INTEGER DEFAULT 0,
  publicado     BOOLEAN DEFAULT false,
  imagenes      TEXT[],                    -- array de URLs de Supabase Storage
  archivos      TEXT[],                    -- array de URLs (fichas técnicas PDF)
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
```

### Tabla: `casas_prefabricadas`

```sql
CREATE TABLE casas_prefabricadas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          TEXT NOT NULL,
  descripcion     TEXT,
  metros_cuadrados DECIMAL(8,2) NOT NULL,
  dormitorios     INTEGER,
  banos           INTEGER,
  precio_base_clp INTEGER,                 -- precio base (fase 2)
  publicado       BOOLEAN DEFAULT false,
  imagenes        TEXT[],                  -- renders, fotos
  planos          TEXT[],                  -- URLs de PDFs de planos
  especificaciones JSONB,                  -- datos adicionales flexibles
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
```

### Tabla: `cotizaciones` (para el formulario de contacto)

```sql
CREATE TABLE cotizaciones (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        TEXT NOT NULL,
  email         TEXT NOT NULL,
  telefono      TEXT,
  tipo          TEXT CHECK (tipo IN ('panel', 'casa', 'general')),
  mensaje       TEXT NOT NULL,
  producto_id   UUID,                      -- referencia opcional al producto
  atendido      BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now()
);
```

### Políticas RLS — aplicar TODAS antes de usar las tablas

```sql
-- Activar RLS en todas las tablas (obligatorio)
ALTER TABLE paneles_sip ENABLE ROW LEVEL SECURITY;
ALTER TABLE casas_prefabricadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotizaciones ENABLE ROW LEVEL SECURITY;

-- Catálogo público: cualquiera puede ver productos publicados
CREATE POLICY "paneles publicos" ON paneles_sip
  FOR SELECT USING (publicado = true);

CREATE POLICY "casas publicas" ON casas_prefabricadas
  FOR SELECT USING (publicado = true);

-- Cotizaciones: cualquiera puede insertar, nadie puede leer sin auth
CREATE POLICY "insertar cotizacion" ON cotizaciones
  FOR INSERT WITH CHECK (true);

-- Admin: acceso total solo para usuarios con rol 'admin' (app_metadata.role).
-- El rol viaja en el JWT; current_app_role() lo lee sin queries extra.
-- (ver migración 20260614123748_role_based_admin_rls.sql)
CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT auth.jwt() -> 'app_metadata' ->> 'role'
$$;

CREATE POLICY "admin paneles" ON paneles_sip
  FOR ALL USING (public.current_app_role() = 'admin')
  WITH CHECK (public.current_app_role() = 'admin');

CREATE POLICY "admin casas" ON casas_prefabricadas
  FOR ALL USING (public.current_app_role() = 'admin')
  WITH CHECK (public.current_app_role() = 'admin');

CREATE POLICY "admin cotizaciones" ON cotizaciones
  FOR ALL USING (public.current_app_role() = 'admin')
  WITH CHECK (public.current_app_role() = 'admin');
```

> **Autorización por rol:** el panel admin solo admite usuarios con
> `app_metadata.role = 'admin'`. La barrera primaria es el middleware
> (`resolveAuthGate` + `resolveAllowedRoles`); estas políticas RLS son la
> segunda capa para el cliente anon. Asignar el rol: ver sección 4 / Supabase
> (`UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'`).

**Si vas a crear una tabla nueva, primero muéstrame el DDL para revisarlo.**

---

## 7. Supabase Storage — buckets

```
imagenes-publicas/     → bucket PUBLIC  → imágenes del catálogo
  paneles/
  casas/

documentos-privados/   → bucket PRIVATE → fichas técnicas, planos PDF
  paneles/
  casas/
```

URLs de imágenes públicas: se guardan directamente en la columna `imagenes[]`.
URLs de documentos privados: se generan con tokens firmados que expiran en 1 hora.

---

## 8. Middleware de protección de rutas admin

```typescript
// src/middleware.ts
import { defineMiddleware } from 'astro:middleware'
import { supabaseAdmin } from '@/lib/supabase'

export const onRequest = defineMiddleware(async ({ url, cookies, redirect }, next) => {
  const isAdminRoute = url.pathname.startsWith('/admin')

  if (isAdminRoute) {
    const accessToken = cookies.get('sb-access-token')?.value
    const refreshToken = cookies.get('sb-refresh-token')?.value

    if (!accessToken || !refreshToken) {
      return redirect('/login')
    }

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(accessToken)

    if (error || !user) {
      return redirect('/login')
    }
  }

  return next()
})
```

**La sesión se guarda en cookies HttpOnly, nunca en localStorage.**

---

## 9. Configuración de Astro

```javascript
// astro.config.mjs
import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import tailwind from '@astrojs/tailwind'
import vercel from '@astrojs/vercel/serverless'

export default defineConfig({
  output: 'hybrid',          // estático por defecto, SSR donde se necesita
  adapter: vercel(),
  integrations: [
    react(),
    tailwind(),              // integración oficial, lee tailwind.config.mjs
  ],
  image: {
    domains: ['TU_PROYECTO.supabase.co']   // dominio de Supabase Storage
  }
})
```

---

## 10. Tipos TypeScript

```typescript
// src/types/producto.ts
export interface PanelSIP {
  id: string
  nombre: string
  descripcion: string | null
  espesor_mm: number
  ancho_mm: number
  largo_mm: number
  r_value: number | null
  peso_kg_m2: number | null
  precio_clp: number | null
  stock: number
  publicado: boolean
  imagenes: string[]
  archivos: string[]
  created_at: string
  updated_at: string
}

// src/types/casa.ts
export interface CasaPrefabricada {
  id: string
  nombre: string
  descripcion: string | null
  metros_cuadrados: number
  dormitorios: number | null
  banos: number | null
  precio_base_clp: number | null
  publicado: boolean
  imagenes: string[]
  planos: string[]
  especificaciones: Record<string, unknown> | null
  created_at: string
  updated_at: string
}
```

---

## 11. Nano Store del carrito (preparado para fase 2)

```typescript
// src/stores/cart.ts
import { atom, map } from 'nanostores'

export interface CartItem {
  id: string
  nombre: string
  precio_clp: number
  cantidad: number
  tipo: 'panel' | 'casa'
}

export const cartItems = map<Record<string, CartItem>>({})
export const cartOpen = atom(false)

export function addToCart(item: CartItem) {
  const existing = cartItems.get()[item.id]
  if (existing) {
    cartItems.setKey(item.id, { ...existing, cantidad: existing.cantidad + 1 })
  } else {
    cartItems.setKey(item.id, item)
  }
}

export function removeFromCart(id: string) {
  const items = { ...cartItems.get() }
  delete items[id]
  cartItems.set(items)
}
```

**No implementar el checkout en fase 1. La store existe para que los botones
"Agregar al carrito" ya funcionen visualmente cuando se activen.**

---

## 12. Diseño visual — identidad de marca

### Instalación (Tailwind v4 — CSS-first)

El proyecto usa **Tailwind CSS v4** con el plugin oficial de Vite. No usa
`@astrojs/tailwind` (esa integración es de v3) ni `tailwind.config.mjs`.

```bash
pnpm add -D tailwindcss @tailwindcss/vite
```

Configuración en `astro.config.mjs` — el plugin va en `vite.plugins`, no en
`integrations`:

```javascript
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // ...
  vite: {
    plugins: [tailwindcss()],
  },
})
```

### `src/styles/global.css` — tokens del proyecto

En v4 la configuración es CSS-first: los tokens viven en un bloque `@theme`
dentro del CSS global, y ese CSS se importa desde los layouts
(`import '../styles/global.css'` en `Layout.astro` y `AdminLayout.astro`).

```css
@import "tailwindcss";

@theme {
  --color-primary: #4a7c59;   /* verde musgo — acción principal */
  --color-secondary: #8b6914; /* ocre — acentos */
  --color-bg: #f5f0e8;        /* crema — fondo general */
  --color-surface: #ffffff;   /* blanco — tarjetas y paneles */
  --color-ink: #2c2416;       /* marrón oscuro — texto principal */
  --color-muted: #6b5e4e;     /* marrón medio — texto secundario */

  --font-display: "Playfair Display", serif; /* títulos grandes */
  --font-body: Inter, sans-serif;            /* cuerpo de texto */

  --radius: 8px;              /* radio por defecto (clase `rounded`) */
}
```

Cada `--color-*` genera automáticamente sus utilidades (`bg-primary`,
`text-ink`, `border-bg`, etc.), `--font-*` genera `font-display` / `font-body`,
y `--radius` define el valor de la clase `rounded`.

### Uso en componentes

```astro
<!-- Astro -->
<h1 class="font-display text-4xl text-ink">Paneles SIP</h1>
<p class="font-body text-muted">Descripción del producto</p>
<button class="bg-primary text-white px-6 py-3 rounded hover:bg-primary/90">
  Ver catálogo
</button>
```

```tsx
// React (island)
export function ProductCard() {
  return (
    <div className="bg-surface rounded border border-bg p-6">
      <h2 className="font-display text-ink text-xl">Panel 100mm</h2>
    </div>
  )
}
```

### Clases de color disponibles

| Clase Tailwind | Color | Uso |
|---|---|---|
| `bg-primary` / `text-primary` | `#4A7C59` Verde musgo | Acción principal |
| `bg-secondary` / `text-secondary` | `#8B6914` Ocre | Acentos |
| `bg-bg` | `#F5F0E8` Crema | Fondo de página |
| `bg-surface` | `#FFFFFF` Blanco | Tarjetas |
| `text-ink` | `#2C2416` Marrón oscuro | Texto principal |
| `text-muted` | `#6B5E4E` Marrón medio | Texto secundario |

### Modo oscuro (claro/oscuro)

El tema se controla con la clase `.dark` en `<html>`. En `global.css`, la clase
`.dark` **redefine los mismos tokens** (`--color-bg`, `--color-ink`, etc.) con
una paleta oscura cálida, así que todo el markup que usa `bg-bg`, `text-ink`,
`text-primary`… se adapta solo, sin clases `dark:` repartidas por las páginas.

| Token | Claro | Oscuro |
|---|---|---|
| `bg` | `#F5F0E8` | `#1A150E` café muy oscuro |
| `surface` | `#FFFFFF` | `#2C2416` marrón oscuro |
| `ink` | `#2C2416` | `#F5F0E8` crema |
| `muted` | `#6B5E4E` | `#B5A88E` arena apagada |
| `primary` | `#4A7C59` | `#6FA882` musgo claro |
| `secondary` | `#8B6914` | `#C9A24B` dorado |

Piezas: `ThemeScript.astro` (aplica el tema en el `<head>` antes del paint,
evita parpadeo), `ThemeToggle.astro` (botón sol/luna en el navbar público) y
`src/lib/theme.ts` (lógica pura testeada). La preferencia se guarda en
`localStorage` con clave `theme`; sin preferencia, se usa la del sistema.

**Tono:** cálido, sustentable, artesanal pero profesional. Sin efectos neón,
sin gradientes artificiales, sin sombras excesivas. Esto aplica a **ambos** modos.

**Regla crítica (v4):** Tailwind v4 detecta automáticamente las clases usadas
en el proyecto (no hay campo `content` que mantener). Lo que sí es obligatorio:
el CSS global (`src/styles/global.css`) debe importarse desde **todos** los
layouts. Si un layout no lo importa, sus páginas se renderizan sin estilos.

---

## 13. Comandos del proyecto

```bash
# Setup inicial — solo una vez
pnpm add -D tailwindcss @tailwindcss/vite   # Tailwind v4 (plugin de Vite, sin @astrojs/tailwind)
npx astro add react                         # instala @astrojs/react

# Desarrollo
npm run dev

# Build producción
npm run build

# Preview del build
npm run preview

# Generar tipos de Supabase (ejecutar después de cada migración)
npx supabase gen types typescript --project-id TU_PROJECT_ID > src/types/supabase.ts

# Aplicar migración nueva
npx supabase db push

# Verificar tipos
npx tsc --noEmit
```

---

## 14. Reglas de desarrollo — seguir siempre

1. **Preguntar antes de asumir.** Si un requisito es ambiguo, pregunta. No inventes comportamientos.
2. **RLS siempre activo.** Nunca crear una tabla sin políticas RLS definidas.
3. **SERVICE KEY solo en servidor.** Si hay duda de dónde corre el código, pregunta.
4. **TypeScript estricto.** No usar `any`. Si el tipo es desconocido, usar `unknown` y luego narrowing.
5. **Migraciones versionadas.** Todo cambio de schema va en `supabase/migrations/`, nunca manual en producción.
6. **Imágenes siempre optimizadas.** Usar el componente `<Image>` de Astro, nunca `<img>` directo.
7. **Variables de entorno documentadas.** Cada variable nueva va también en `.env.example` con comentario.
8. **Commits atómicos.** Un commit = una cosa. Mensajes en español, presentes: "Agrega catálogo de paneles".
9. **Sin dependencias innecesarias.** Proponer una nueva dependencia = mostrar por qué no se puede hacer sin ella.
10. **Fase 1 vs Fase 2.** No implementar pagos ni checkout en fase 1. Solo estructurar para que sea fácil agregar.

---

## 15. Checklist antes de hacer un PR o commit importante

- [ ] `npx tsc --noEmit` sin errores
- [ ] RLS activado en todas las tablas nuevas
- [ ] Variables de entorno nuevas en `.env.example`
- [ ] Ninguna SERVICE KEY en componentes cliente
- [ ] Imágenes usando `<Image>` de Astro
- [ ] Rutas admin protegidas por middleware
- [ ] Migraciones en `supabase/migrations/`
- [ ] Clases Tailwind usan solo los colores definidos en `tailwind.config.mjs`

---

## 16. Preguntas que Claude Code DEBE hacer antes de proceder

Si alguna de estas condiciones se cumple, **detente y pregunta**:

- No está claro si el código corre en servidor o cliente
- Se necesita acceder a una tabla que no tiene RLS definido
- El diseño de una página no coincide con los tokens de la sección 12
- Se requiere una dependencia nueva no listada en la sección 2
- Se va a modificar el schema de una tabla existente
- El flujo de autenticación no está claro
- Hay que manejar archivos privados y no está claro el mecanismo de URLs firmadas

---

*Última actualización: generado a partir de sesión de diseño arquitectónico.*
*Revisar y actualizar después de cada decisión técnica importante.*
