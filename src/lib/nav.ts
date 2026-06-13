/**
 * isActivePath — determina si un enlace de navegación corresponde a la ruta actual.
 *
 * Para la raíz '/' usa comparación exacta para evitar que coincida con todos los paths.
 * Para el resto de rutas usa comparación por prefijo para cubrir sub-rutas.
 */
export function isActivePath(current: string, href: string): boolean {
  if (href === '/') {
    return current === '/'
  }
  return current.startsWith(href)
}
