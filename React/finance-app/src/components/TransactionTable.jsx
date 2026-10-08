import { Pencil, Trash2 } from 'lucide-react'

const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
})

const columns = [
  ['date', 'Date'],
  ['description', 'Description'],
  ['category', 'Category'],
  ['account', 'Account'],
  ['type', 'Type'],
  ['amount', 'Amount'],
]

/**
 * @param {{
 *   items: Array<{ id: number, date: string, description: string, category: string, type: 'income' | 'expense', amount: string | number, account_name: string | null, account_type: string | null }>,
 *   total: number,
 *   page: number,
 *   pageSize: number,
 *   totalPages: number,
 *   sortBy: string,
 *   sortOrder: 'asc' | 'desc',
 *   isLoading: boolean,
 *   onSort: (field: string) => void,
 *   onPageChange: (page: number) => void,
 *   onPageSizeChange: (size: string) => void,
 *   selectedIds: Set<number>,
 *   onToggleSelected: (id: number) => void,
 *   onToggleCurrentPage: (checked: boolean) => void,
 *   deletingIds: Set<number>,
 *   onDeleteTransaction: (id: number) => void,
 *   onEditTransaction: (transaction: { id: number, date: string, description: string, category: string, type: 'income' | 'expense', amount: string | number, account_id: number | null, account_name: string | null, account_type: string | null }) => void
 * }} props
 */
function TransactionTable({
  items,
  total,
  page,
  pageSize,
  totalPages,
  sortBy,
  sortOrder,
  isLoading,
  onSort,
  onPageChange,
  onPageSizeChange,
  selectedIds,
  onToggleSelected,
  onToggleCurrentPage,
  deletingIds,
  onDeleteTransaction,
  onEditTransaction,
}) {

  const currentPageSelected = items.filter(({ id }) => selectedIds.has(id)).length
const allCurrentPageSelected =
  items.length > 0 && currentPageSelected === items.length
const canSelectCurrentPage =
  allCurrentPageSelected ||
  selectedIds.size + items.length - currentPageSelected <= 100


  return (
    <section className="data-table-section" aria-label="Transactions">
      <div className="table-scroll">
        <table className="transactions-table" aria-busy={isLoading}>
          <thead>
            <tr>
              <th scope="col">
                <input
                  type="checkbox"
                  aria-label="Select all transactions on this page"
                  checked={allCurrentPageSelected}
                  disabled={!canSelectCurrentPage}
                  onChange={(event) => onToggleCurrentPage(event.target.checked)}
                />
              </th>
              {columns.map(([field, label]) => (
                <th key={field} scope="col" aria-sort={sortBy === field ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  <button type="button" className="sort-button" onClick={() => onSort(field)}>
                    {label}{sortBy === field && <span aria-hidden="true">{sortOrder === 'asc' ? ' ↑' : ' ↓'}</span>}
                  </button>
                </th>
              ))}
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && items.length === 0 && <tr><td colSpan="8" className="table-message">Loading transactions...</td></tr>}
            {!isLoading && items.length === 0 && <tr><td colSpan="8" className="table-message">No transactions match these filters.</td></tr>}
            {items.map((transaction) => (
              <tr key={transaction.id}>
                <td data-label="Select">
                  <input
                    type="checkbox"
                    aria-label={`Select transaction ${transaction.id}`}
                    checked={selectedIds.has(transaction.id)}
                    disabled={!selectedIds.has(transaction.id) && selectedIds.size >= 100}
                    onChange={() => onToggleSelected(transaction.id)}
                  />
                </td>
                <td data-label="Date">{transaction.date}</td>
                <td data-label="Description" className="table-description">{transaction.description || '—'}</td>
                <td data-label="Category">{transaction.category}</td>
                <td data-label="Account">
                  {transaction.account_name
                    ? <><span className="table-account-type">{transaction.account_type}</span>{transaction.account_name}</>
                    : 'Unassigned'}
                </td>
                <td data-label="Type"><span className={`table-type ${transaction.type}`}>{transaction.type}</span></td>
                <td data-label="Amount" className={`table-amount ${transaction.type}`}>
                  {transaction.type === 'income' ? '+' : '−'}{currencyFormatter.format(Math.abs(Number(transaction.amount)))}
                </td>
                <td data-label="Actions">
                  <button
                    className="row-edit-button"
                    type="button"
                    aria-label={`Edit transaction ${transaction.description || transaction.id}`}
                    title="Edit transaction"
                    onClick={() => onEditTransaction(transaction)}
                  >
                    <Pencil aria-hidden="true" size={18} />
                  </button>
                  <button
                    className="row-delete-button"
                    type="button"
                    aria-label={`Delete transaction ${transaction.description || transaction.id}`}
                    title="Delete transaction"
                    disabled={deletingIds.has(transaction.id)}
                    onClick={() => onDeleteTransaction(transaction.id)}
                  >
                    <Trash2 aria-hidden="true" size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-pagination">
        <p>{total} transaction{total === 1 ? '' : 's'}</p>
        <label htmlFor="table-page-size">Rows per page
          <select id="table-page-size" value={pageSize} onChange={(event) => onPageSizeChange(event.target.value)}>
            {[10, 20, 50].map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
        <div className="pagination-controls">
          <button type="button" onClick={() => onPageChange(page - 1)} disabled={page <= 1 || isLoading}>Previous</button>
          <span>Page {page} of {totalPages}</span>
          <button type="button" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages || isLoading}>Next</button>
        </div>
      </div>
    </section>
  )
}

export default TransactionTable
