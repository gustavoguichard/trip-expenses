import { activeExpenses, activeMembers, type Trip } from './store.common.ts'

type Transfer = {
  from: string
  to: string
  amountCents: number
}

function memberBalances(trip: Trip) {
  const balances = new Map<string, number>(
    activeMembers(trip).map((member) => [member.id, 0])
  )
  const add = (memberId: string, amountCents: number) => {
    balances.set(memberId, (balances.get(memberId) ?? 0) + amountCents)
  }

  for (const expense of activeExpenses(trip)) {
    add(expense.paidBy, expense.amountCents)
    for (const share of expense.shares) add(share.memberId, -share.amountCents)
  }

  return balances
}

function simplifyDebts(balances: Map<string, number>) {
  const debtors = [...balances]
    .filter(([, amount]) => amount < 0)
    .map(([memberId, amount]) => ({ memberId, remaining: -amount }))
    .sort((a, b) => b.remaining - a.remaining)
  const creditors = [...balances]
    .filter(([, amount]) => amount > 0)
    .map(([memberId, amount]) => ({ memberId, remaining: amount }))
    .sort((a, b) => b.remaining - a.remaining)

  const transfers: Transfer[] = []
  let debtorIndex = 0
  let creditorIndex = 0

  while (true) {
    const debtor = debtors[debtorIndex]
    const creditor = creditors[creditorIndex]
    if (!debtor || !creditor) break
    const amountCents = Math.min(debtor.remaining, creditor.remaining)

    if (amountCents > 0) {
      transfers.push({
        from: debtor.memberId,
        to: creditor.memberId,
        amountCents,
      })
    }

    debtor.remaining -= amountCents
    creditor.remaining -= amountCents
    if (debtor.remaining === 0) debtorIndex += 1
    if (creditor.remaining === 0) creditorIndex += 1
  }

  return transfers
}

function spendingOnly(trip: Trip) {
  return activeExpenses(trip).filter((expense) => expense.kind === 'expense')
}

function tripTotal(trip: Trip) {
  return spendingOnly(trip).reduce(
    (total, expense) => total + expense.amountCents,
    0
  )
}

function totalsByCategory(trip: Trip) {
  const totals = new Map<string, number>()
  for (const expense of spendingOnly(trip)) {
    totals.set(
      expense.categoryId,
      (totals.get(expense.categoryId) ?? 0) + expense.amountCents
    )
  }
  return [...totals]
    .map(([categoryId, amountCents]) => ({ categoryId, amountCents }))
    .sort((a, b) => b.amountCents - a.amountCents)
}

function totalsByDay(trip: Trip) {
  const totals = new Map<string, number>()
  for (const expense of spendingOnly(trip)) {
    totals.set(
      expense.date,
      (totals.get(expense.date) ?? 0) + expense.amountCents
    )
  }
  return [...totals]
    .map(([date, amountCents]) => ({ date, amountCents }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

function totalsByMember(trip: Trip) {
  const paid = new Map<string, number>()
  const share = new Map<string, number>()
  for (const expense of spendingOnly(trip)) {
    paid.set(
      expense.paidBy,
      (paid.get(expense.paidBy) ?? 0) + expense.amountCents
    )
    for (const split of expense.shares) {
      share.set(
        split.memberId,
        (share.get(split.memberId) ?? 0) + split.amountCents
      )
    }
  }
  return activeMembers(trip).map((member) => ({
    memberId: member.id,
    paidCents: paid.get(member.id) ?? 0,
    shareCents: share.get(member.id) ?? 0,
  }))
}

export type { Transfer }
export {
  memberBalances,
  simplifyDebts,
  totalsByCategory,
  totalsByDay,
  totalsByMember,
  tripTotal,
}
