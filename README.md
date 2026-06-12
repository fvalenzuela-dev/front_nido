# Nido — Catálogo SIP & Casas Prefabricadas

Plataforma web para empresa fabricante de **paneles SIP** y **casas prefabricadas**.

**Fase actual:** catálogo público autoadministrable.
**Fase futura:** e-commerce con carrito y pagos via MercadoPago.

---

## Stack tecnológico

| Capa | Tecnología | Notas |
|------|------------|-------|
| Framework | Astro 4.x | Modo híbrido (SSR + estático) |
| Componentes interactivos | React 18 | Solo donde hay interactividad real |
| Estado compartido | Nano Stores | Carrito y estado global |
| Base de datos | Supabase (PostgreSQL) | RLS activado en todas las tablas |
| Storage | Supabase Storage | Buckets separados por tipo |
| Autenticación | Supabase Auth | Solo para panel admin |
| Hosting | Vercel | Serverless adapter |
| Estilos | Tailwind CSS 3.x | Tokens de diseño personalizados |
| Lenguaje | TypeScript 5.x | Strict mode obligatorio |
| Tests | Vitest | Unit tests con jsdom |

---

## Requisitos

- Node.js 18+
- pnpm 11+
- Cuenta en [Supabase](https://supabase.com)
- Cuenta en [Vercel](https://vercel.com)

---

## Configuración inicial

### 1. Instalar dependencias

```bash
pnpm install
```

### 2. Variables de entorno

```bash
cp env.example .env
```

Edita `.env` con tus credenciales:

```bash
# Supabase — públicas (seguras con RLS)
PUBLIC_SUPABASE_URL=https://TU_PROYECTO.supabase.co
PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Supabase — privada (NUNCA en el cliente)
SUPABASE_SERVICE_KEY=eyJ...

# Sitio
PUBLIC_SITE_URL=https://tu-dominio.com
```

### 3. Generar tipos de Supabase (después de crear las tablas)

```bash
pnpm supabase gen types typescript --project-id TU_PROJECT_ID > src/types/supabase.ts
```

---

## Comandos

```bash
# Servidor de desarrollo
pnpm dev

# Build de producción
pnpm build

# Preview del build local
pnpm preview

# Verificación de tipos
pnpm typecheck

# Tests unitarios (modo watch)
pnpm test

# Tests unitarios (modo CI / una ejecución)
pnpm test:run

# Aplicar migración a Supabase
pnpm supabase db push
```

---

## Estructura del proyecto

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
│   │   ├── login.astro        # Login del panel admin
│   │   └── admin/             # Panel de administración (protegido)
│   ├── lib/
│   │   ├── supabase.ts        # Clientes Supabase (server y client)
│   │   ├── auth.ts            # Helpers de autenticación
│   │   └── storage.ts         # Helpers de Supabase Storage
│   ├── stores/
│   │   └── cart.ts            # Nano Store del carrito (fase 2)
│   └── types/
│       ├── producto.ts        # Interface PanelSIP
│       ├── casa.ts            # Interface CasaPrefabricada
│       └── supabase.ts        # Tipos generados por Supabase CLI
├── supabase/
│   └── migrations/            # Migraciones SQL versionadas
├── public/                    # Assets estáticos
├── env.example                # Template de variables de entorno
├── astro.config.mjs           # Configuración de Astro
├── tailwind.config.mjs        # Tokens de diseño
├── tsconfig.json              # Configuración TypeScript
├── vitest.config.ts           # Configuración de tests
└── CLAUDE.md                  # Fuente de verdad del proyecto
```

---

## Arquitectura

### Clientes Supabase

El proyecto usa **dos clientes distintos** para mantener la seguridad:

| Cliente | Variable | Dónde se usa |
|---------|----------|-------------|
| `supabaseAdmin` | `SUPABASE_SERVICE_KEY` | Solo en servidor (SSR, middleware, API routes) |
| `supabaseClient` | `PUBLIC_SUPABASE_ANON_KEY` | Solo en el browser (React islands) |

La `SUPABASE_SERVICE_KEY` nunca debe llegar al cliente — Vercel la mantiene como variable de servidor.

### Rutas SSR vs estáticas

Con `output: 'hybrid'`, todas las páginas son estáticas por defecto. Las páginas admin optan al SSR con:

```typescript
export const prerender = false
```

### Protección de rutas admin

El middleware en `src/middleware.ts` intercepta todas las rutas `/admin/*` y verifica las cookies `sb-access-token` y `sb-refresh-token`. Redirige a `/login` si no hay sesión válida.

### Diseño visual

| Token | Color | Uso |
|-------|-------|-----|
| `primary` | `#4A7C59` Verde musgo | Botones, links, acción principal |
| `secondary` | `#8B6914` Ocre | Acentos y highlights |
| `bg` | `#F5F0E8` Crema | Fondo de página |
| `surface` | `#FFFFFF` Blanco | Tarjetas |
| `ink` | `#2C2416` Marrón oscuro | Texto principal |
| `muted` | `#6B5E4E` Marrón medio | Texto secundario |

Tipografía: **Playfair Display** para títulos (`font-display`), **Inter** para cuerpo (`font-body`).

---

## Checklist antes de hacer un PR

- [ ] `pnpm typecheck` sin errores
- [ ] RLS activado en todas las tablas nuevas
- [ ] Variables de entorno nuevas en `env.example`
- [ ] `SUPABASE_SERVICE_KEY` no importada en componentes cliente
- [ ] Imágenes usando el componente `<Image>` de Astro
- [ ] Rutas admin con `export const prerender = false`
- [ ] Migraciones en `supabase/migrations/`

---

## Base de datos

Las tablas principales son `paneles_sip`, `casas_prefabricadas` y `cotizaciones`. Todas tienen RLS activado. Ver el esquema completo y las políticas en `CLAUDE.md` sección 6, y las migraciones en `supabase/migrations/`.

---

## Despliegue

El proyecto está configurado para Vercel con soporte SSR. Importa el repositorio en Vercel y agrega las variables de entorno del `env.example` en la configuración del proyecto.
