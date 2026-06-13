/**
 * cn — helper de combinación de clases CSS.
 * Filtra valores falsy y une los resultantes con un espacio.
 * Sin dependencias externas (no clsx, no tailwind-merge).
 */
export const cn = (...classes: Array<string | false | null | undefined>): string =>
  classes.filter(Boolean).join(' ')
