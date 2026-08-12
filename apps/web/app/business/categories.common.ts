type Category = {
  id: string
  label: string
  emoji: string
}

const categories: Category[] = [
  { id: 'food', label: 'Food & drinks', emoji: '🍕' },
  { id: 'groceries', label: 'Groceries', emoji: '🛒' },
  { id: 'transport', label: 'Transport', emoji: '🚕' },
  { id: 'lodging', label: 'Lodging', emoji: '🏨' },
  { id: 'activities', label: 'Activities', emoji: '🎟️' },
  { id: 'shopping', label: 'Shopping', emoji: '🛍️' },
  { id: 'other', label: 'Other', emoji: '💸' },
]

const settlementCategory: Category = {
  id: 'settlement',
  label: 'Settle up',
  emoji: '🤝',
}

const findCategory = (categoryId: string) =>
  categories.find((category) => category.id === categoryId) ??
  (categoryId === settlementCategory.id ? settlementCategory : null)

export type { Category }
export { categories, findCategory, settlementCategory }
