import { describe, it, expect, beforeEach } from 'vitest'
import { cartItems, cartOpen, addToCart, removeFromCart } from './cart'
import type { CartItem } from './cart'

const panel: CartItem = {
  id: 'panel-100',
  nombre: 'Panel SIP 100mm',
  precio_clp: 50000,
  cantidad: 1,
  tipo: 'panel',
}

beforeEach(() => {
  cartItems.set({})
  cartOpen.set(false)
})

describe('addToCart', () => {
  it('agrega un item nuevo al carrito', () => {
    addToCart(panel)
    expect(cartItems.get()[panel.id]).toEqual(panel)
  })

  it('incrementa la cantidad si el item ya existe', () => {
    addToCart(panel)
    addToCart(panel)
    expect(cartItems.get()[panel.id].cantidad).toBe(2)
  })
})

describe('removeFromCart', () => {
  it('elimina un item del carrito', () => {
    addToCart(panel)
    removeFromCart(panel.id)
    expect(cartItems.get()[panel.id]).toBeUndefined()
  })
})
