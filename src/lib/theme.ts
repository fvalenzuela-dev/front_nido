/**
 * Lógica pura de tema claro/oscuro.
 * El DOM (aplicar la clase, leer localStorage) se maneja en el componente;
 * aquí solo viven las decisiones, para poder testearlas sin navegador.
 */
export type Theme = 'light' | 'dark'

/**
 * Decide el tema inicial: la preferencia explícita guardada gana; si no hay
 * (o es inválida), se respeta la preferencia del sistema operativo.
 */
export function resolveInitialTheme(
  stored: string | null,
  systemPrefersDark: boolean,
): Theme {
  if (stored === 'light' || stored === 'dark') return stored
  return systemPrefersDark ? 'dark' : 'light'
}

/** Devuelve el tema opuesto al actual. */
export function nextTheme(current: Theme): Theme {
  return current === 'dark' ? 'light' : 'dark'
}
