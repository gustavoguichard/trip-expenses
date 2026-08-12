type Category = {
  id: string
  label: string
  emoji: string
}

const categories: Category[] = [
  { id: 'food', label: 'Comida e bebida', emoji: '🍕' },
  { id: 'groceries', label: 'Mercado', emoji: '🛒' },
  { id: 'transport', label: 'Transporte', emoji: '🚕' },
  { id: 'lodging', label: 'Hospedagem', emoji: '🏨' },
  { id: 'activities', label: 'Passeios', emoji: '🎟️' },
  { id: 'shopping', label: 'Compras', emoji: '🛍️' },
  { id: 'other', label: 'Outros', emoji: '💸' },
]

const settlementCategory: Category = {
  id: 'settlement',
  label: 'Acerto',
  emoji: '🤝',
}

const findCategory = (categoryId: string) =>
  categories.find((category) => category.id === categoryId) ??
  (categoryId === settlementCategory.id ? settlementCategory : null)

export type { Category }
export { categories, findCategory, settlementCategory }
