/**
 * isActivePath — determina si un enlace de navegación corresponde a la ruta actual.
 *
 * Para la raíz '/' usa comparación exacta para evitar que coincida con todos los paths.
 * Para el resto de rutas coincide en match exacto o en sub-rutas reales (con
 * límite de segmento), de modo que '/paneles' no marque activo a '/paneles-sip'.
 */
export function isActivePath(current: string, href: string): boolean {
  if (href === '/') {
    return current === '/'
  }
  return current === href || current.startsWith(href + '/')
}
