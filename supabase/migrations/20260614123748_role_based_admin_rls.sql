-- Migration: role-based admin RLS (issue #14)
--
-- Reemplaza las políticas admin "para cualquier authenticated" por políticas
-- basadas en el ROL del usuario, leído del JWT en `app_metadata.role`.
--
-- Por qué: antes, CUALQUIER usuario autenticado de Supabase pasaba la barrera
-- RLS de admin (`auth.role() = 'authenticated'`). Con el cliente anon + RLS,
-- la autorización debe depender del rol, no solo de estar autenticado. El rol
-- vive en `app_metadata` (gestionado por servidor, NO editable por el usuario,
-- a diferencia de `user_metadata`) y viaja dentro del JWT, así que se evalúa
-- sin queries extra.
--
-- Defensa en profundidad: el panel admin usa hoy la service key (bypasea RLS),
-- por lo que la barrera primaria es el middleware. Estas políticas protegen
-- cualquier acceso vía cliente anon (con el JWT del usuario) como segunda capa.

-- ---------------------------------------------------------------------------
-- Helper: rol actual desde el JWT (NULL si no hay rol o no hay sesión)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT auth.jwt() -> 'app_metadata' ->> 'role'
$$;

-- ---------------------------------------------------------------------------
-- paneles_sip
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "admin paneles" ON paneles_sip;
CREATE POLICY "admin paneles" ON paneles_sip
  FOR ALL
  USING (public.current_app_role() = 'admin')
  WITH CHECK (public.current_app_role() = 'admin');

-- ---------------------------------------------------------------------------
-- casas_prefabricadas
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "admin casas" ON casas_prefabricadas;
CREATE POLICY "admin casas" ON casas_prefabricadas
  FOR ALL
  USING (public.current_app_role() = 'admin')
  WITH CHECK (public.current_app_role() = 'admin');

-- ---------------------------------------------------------------------------
-- cotizaciones
-- (la política pública de INSERT "insertar cotizacion" se mantiene intacta;
--  aquí solo se restringe el acceso administrativo de lectura/gestión)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "admin cotizaciones" ON cotizaciones;
CREATE POLICY "admin cotizaciones" ON cotizaciones
  FOR ALL
  USING (public.current_app_role() = 'admin')
  WITH CHECK (public.current_app_role() = 'admin');
