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
  return current === href || current.startsWith(`${href}/`)
}

export interface NavLink {
  href: string
  label: string
}

/**
 * Secciones públicas principales del catálogo, en el orden del recorrido
 * natural de descubrimiento: inicio → productos → casas.
 * Fuente de verdad única consumida por el navbar (escritorio y móvil).
 */
export const primaryNavLinks: NavLink[] = [
  { href: '/', label: 'Inicio' },
  { href: '/paneles', label: 'Paneles SIP' },
  { href: '/casas', label: 'Casas' },
]

/**
 * CTA de conversión. El contacto es la meta del catálogo, por eso se expone
 * como acción destacada en lugar de un enlace más de la lista.
 */
export const quoteCta: NavLink = { href: '/contacto', label: 'Cotizar' }

/**
 * Enlaces del pie de página: todas las secciones públicas, incluido el
 * contacto con su etiqueta descriptiva (no el verbo del CTA).
 */
export const footerNavLinks: NavLink[] = [
  ...primaryNavLinks,
  { href: '/contacto', label: 'Contacto' },
]
