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

export function addToCart(item: CartItem): void {
  const existing = cartItems.get()[item.id]
  if (existing) {
    cartItems.setKey(item.id, { ...existing, cantidad: existing.cantidad + 1 })
  } else {
    cartItems.setKey(item.id, item)
  }
}

export function removeFromCart(id: string): void {
  const items = { ...cartItems.get() }
  delete items[id]
  cartItems.set(items)
}
