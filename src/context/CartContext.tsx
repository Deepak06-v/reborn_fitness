import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react'
import type { CartItem, Product } from '../types'
import { products } from '../data/products'

const STORAGE_KEY = 'reborn.cart'

interface PersistedCart {
  items: CartItem[]
}

interface CartState {
  items: CartItem[]
  isOpen: boolean
}

type CartAction =
  | { type: 'hydrate'; items: CartItem[] }
  | { type: 'add'; productId: string }
  | { type: 'increment'; productId: string }
  | { type: 'decrement'; productId: string }
  | { type: 'remove'; productId: string }
  | { type: 'open' }
  | { type: 'close' }
  | { type: 'toggle' }

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'hydrate':
      return { ...state, items: action.items }
    case 'add':
    case 'increment': {
      const existing = state.items.find((item) => item.productId === action.productId)
      const items = existing
        ? state.items.map((item) =>
            item.productId === action.productId
              ? { ...item, quantity: item.quantity + 1 }
              : item,
          )
        : [...state.items, { productId: action.productId, quantity: 1 }]
      return { ...state, items }
    }
    case 'decrement': {
      const items = state.items
        .map((item) =>
          item.productId === action.productId
            ? { ...item, quantity: item.quantity - 1 }
            : item,
        )
        .filter((item) => item.quantity > 0)
      return { ...state, items }
    }
    case 'remove':
      return {
        ...state,
        items: state.items.filter((item) => item.productId !== action.productId),
      }
    case 'open':
      return { ...state, isOpen: true }
    case 'close':
      return { ...state, isOpen: false }
    case 'toggle':
      return { ...state, isOpen: !state.isOpen }
    default:
      return state
  }
}

function loadPersistedItems(): CartItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !Array.isArray((parsed as PersistedCart).items)
    ) {
      return []
    }
    const valid = (parsed as PersistedCart).items.filter(
      (item): item is CartItem =>
        !!item &&
        typeof item.productId === 'string' &&
        typeof item.quantity === 'number' &&
        item.quantity > 0,
    )
    return valid.filter((item) => products.some((p) => p.id === item.productId))
  } catch {
    return []
  }
}

export interface CartContextValue {
  items: CartItem[]
  isOpen: boolean
  count: number
  subtotal: number
  lines: Array<{ product: Product; quantity: number }>
  addItem: (productId: string) => void
  increment: (productId: string) => void
  decrement: (productId: string) => void
  removeItem: (productId: string) => void
  openCart: () => void
  closeCart: () => void
  toggleCart: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, undefined, () => ({
    items: loadPersistedItems(),
    isOpen: false,
  }))

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ items: state.items }))
    } catch {
      /* storage unavailable - cart stays in memory */
    }
  }, [state.items])

  const addItem = useCallback(
    (productId: string) => {
      dispatch({ type: 'add', productId })
      dispatch({ type: 'open' })
    },
    [],
  )
  const increment = useCallback(
    (productId: string) => dispatch({ type: 'increment', productId }),
    [],
  )
  const decrement = useCallback(
    (productId: string) => dispatch({ type: 'decrement', productId }),
    [],
  )
  const removeItem = useCallback(
    (productId: string) => dispatch({ type: 'remove', productId }),
    [],
  )
  const openCart = useCallback(() => dispatch({ type: 'open' }), [])
  const closeCart = useCallback(() => dispatch({ type: 'close' }), [])
  const toggleCart = useCallback(() => dispatch({ type: 'toggle' }), [])

  const lines = useMemo(
    () =>
      state.items
        .map((item) => ({
          product: products.find((p) => p.id === item.productId),
          quantity: item.quantity,
        }))
        .filter((line): line is { product: Product; quantity: number } => !!line.product),
    [state.items],
  )

  const count = useMemo(
    () => state.items.reduce((sum, item) => sum + item.quantity, 0),
    [state.items],
  )
  const subtotal = useMemo(
    () => lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0),
    [lines],
  )

  const value = useMemo<CartContextValue>(
    () => ({
      items: state.items,
      isOpen: state.isOpen,
      count,
      subtotal,
      lines,
      addItem,
      increment,
      decrement,
      removeItem,
      openCart,
      closeCart,
      toggleCart,
    }),
    [
      state.items,
      state.isOpen,
      count,
      subtotal,
      lines,
      addItem,
      increment,
      decrement,
      removeItem,
      openCart,
      closeCart,
      toggleCart,
    ],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export { CartContext }