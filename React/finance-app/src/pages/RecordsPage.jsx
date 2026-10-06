import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import AccountBalance from '../components/AccountBalance'
import CsvImport from '../components/CsvImport'
import TransactionTable from '../components/TransactionTable'
import usePaginatedTransactions from '../hooks/usePaginatedTransactions'
import {
  bulkDeleteTransactions,
  getApiErrorMessage,
  updateTransaction,
} from '../services/transactions'

/**
 * @param {{ exportError: string, isExporting: boolean, onExport: (startDate: string, endDate: string) => void, error?: string }} props
 */
function RecordsPage({
  exportError,
  isExporting,
  onExport,
  error: appError,
  balance,
  balanceLoading,
  balanceError,
  onTransactionsChanged,
}) {
  const records = usePaginatedTransactions()
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [deletingIds, setDeletingIds] = useState(() => new Set())
  const [deleteError, setDeleteError] = useState('')
  const [deleteConfirmation, setDeleteConfirmation] = useState(null)
  const [editingTransaction, setEditingTransaction] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [editError, setEditError] = useState('')

const toggleSelected = (id) => {
  setSelectedIds((current) => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else if (next.size < 100) next.add(id)
    return next
  })
}

const toggleCurrentPage = (checked) => {
  setSelectedIds((current) => {
    const next = new Set(current)
    const unselectedCount = records.items.filter(({ id }) => !next.has(id)).length

    if (checked && next.size + unselectedCount > 100) return current

    records.items.forEach(({ id }) => {
      if (checked) next.add(id)
      else next.delete(id)
    })

    return next
  })
}

const handleBulkDelete = async () => {
  const ids = Array.from(selectedIds)

  if (ids.length === 0) return
  setDeleteConfirmation({ ids })
}

const handleDeleteTransaction = async (id) => {
  if (deletingIds.has(id)) return
  setDeleteConfirmation({ ids: [id] })
}

const confirmDelete = async () => {
  if (!deleteConfirmation || deletingIds.size > 0) return
  const { ids } = deleteConfirmation
  setDeleteError('')
  setDeletingIds(new Set(ids))

  try {
    await bulkDeleteTransactions(ids)
    setSelectedIds((current) => new Set([...current].filter((id) => !ids.includes(id))))
    setDeleteConfirmation(null)
    await records.refresh()
    await onTransactionsChanged()
  } catch (error) {
    setDeleteError(getApiErrorMessage(error, 'Could not delete the selected transaction(s). Please try again.'))
  } finally {
    setDeletingIds(new Set())
  }
}

const openEditDialog = (transaction) => {
  setEditingTransaction(transaction)
  setEditForm({
    date: transaction.date,
    description: transaction.description || '',
    category: transaction.category,
    amount: String(transaction.amount),
  })
  setEditError('')
}

const closeEditDialog = () => {
  if (isSavingEdit) return
  setEditingTransaction(null)
  setEditForm(null)
  setEditError('')
}

const handleEditSubmit = async (event) => {
  event.preventDefault()
  if (!editingTransaction || !editForm || isSavingEdit) return

  setEditError('')
  setIsSavingEdit(true)
  try {
    await updateTransaction(editingTransaction.id, {
      date: editForm.date,
      description: editForm.description.trim(),
      category: editForm.category.trim(),
      amount: editForm.amount,
    })
    setEditingTransaction(null)
    setEditForm(null)
    await records.refresh()
    await onTransactionsChanged()
  } catch (error) {
    setEditError(getApiErrorMessage(error, 'Could not update this transaction. Please try again.'))
  } finally {
    setIsSavingEdit(false)
  }
}
  const [categoryDraft, setCategoryDraft] = useState('')
  const [startDateDraft, setStartDateDraft] = useState('')
  const [endDateDraft, setEndDateDraft] = useState('')
  const [filterError, setFilterError] = useState('')

  const applyFilters = () => {
    if (startDateDraft && endDateDraft && startDateDraft > endDateDraft) {
      setFilterError('Start date must be on or before end date.')
      return
    }
    setFilterError('')
    records.applyFilters(categoryDraft.trim(), startDateDraft, endDateDraft)
  }

  const clearFilters = () => {
    setCategoryDraft('')
    setStartDateDraft('')
    setEndDateDraft('')
    setFilterError('')
    records.clearFilters()
  }

  const handleImportComplete = () => {
    setCategoryDraft('')
    setStartDateDraft('')
    setEndDateDraft('')
    setFilterError('')
    records.clearFilters()
    records.refresh()
    onTransactionsChanged()
  }

  return (
    <main className="dashboard">
      <section className="intro records-intro">
        <p className="eyebrow">Your activity</p>
        <h1>Saved records.</h1>
        <p className="intro-copy">Review every transaction in one place and keep an eye on where your money goes.</p>
      </section>
      <AccountBalance balance={balance} isLoading={balanceLoading} error={balanceError} />
      <CsvImport onImported={handleImportComplete} />
      <section className="transactions-section records-page">
        <div className="section-header">
          <div><p className="section-kicker">Activity</p><h2>All transactions</h2></div>
          <span className="transaction-count">{records.total} total</span>
        </div>
        {appError && <p className="form-error" role="alert">{appError}</p>}
        <div className="filter-toolbar" aria-label="Transaction filters">
          <label className="search-field" htmlFor="transaction-search">Search
            <input id="transaction-search" type="search" value={records.searchInput} onChange={(event) => records.setSearchInput(event.target.value)} placeholder="Description or category" />
          </label>
          <label className="filter-field" htmlFor="category-filter">Category
            <input id="category-filter" type="text" value={categoryDraft} onChange={(event) => setCategoryDraft(event.target.value)} placeholder="Exact category" />
          </label>
          <label className="filter-field" htmlFor="date-from-filter">From
            <input id="date-from-filter" type="date" value={startDateDraft} onChange={(event) => setStartDateDraft(event.target.value)} />
          </label>
          <label className="filter-field" htmlFor="date-to-filter">To
            <input id="date-to-filter" type="date" value={endDateDraft} onChange={(event) => setEndDateDraft(event.target.value)} />
          </label>
          <button className="filter-button" type="button" onClick={applyFilters}>Apply filters</button>
          <button className="text-button clear-filter-button" type="button" onClick={clearFilters}>Clear</button>
        </div>
        <div className="records-toolbar">
          <button className="export-button" type="button" onClick={() => onExport(records.startDate, records.endDate)} disabled={isExporting}>
            {isExporting ? 'Exporting...' : 'Export CSV'}
          </button>
          <button className="bulk-delete-button" type="button" onClick={handleBulkDelete} disabled={selectedIds.size === 0}>
            <Trash2 aria-hidden="true" size={18} strokeWidth={1.8} />
            Delete selected ({selectedIds.size})
          </button>
        </div>
        {filterError && <p className="form-error" role="alert">{filterError}</p>}
        {records.error && <p className="form-error" role="alert">{records.error}</p>}
        {exportError && <p className="form-error" role="alert">{exportError}</p>}
        {deleteError && <p className="form-error" role="alert">{deleteError}</p>}
        {deleteConfirmation && (
          <div className="delete-confirmation-overlay">
            <section
              aria-labelledby="delete-confirmation-title"
              aria-describedby="delete-confirmation-message"
              aria-modal="true"
              className="delete-confirmation-dialog"
              onKeyDown={(event) => {
                if (event.key === 'Escape' && deletingIds.size === 0) {
                  setDeleteConfirmation(null)
                }
              }}
              role="alertdialog"
            >
              <div className="delete-confirmation-icon"><Trash2 aria-hidden="true" size={22} /></div>
              <h2 id="delete-confirmation-title">Delete {deleteConfirmation.ids.length === 1 ? 'transaction' : 'transactions'}?</h2>
              <p id="delete-confirmation-message">
                {deleteConfirmation.ids.length === 1
                  ? 'This transaction will be permanently deleted. This action cannot be undone.'
                  : `${deleteConfirmation.ids.length} transactions will be permanently deleted. This action cannot be undone.`}
              </p>
              {deleteError && <p className="delete-confirmation-error" role="alert">{deleteError}</p>}
              <div className="delete-confirmation-actions">
                <button
                  autoFocus
                  className="delete-cancel-button"
                  disabled={deletingIds.size > 0}
                  onClick={() => setDeleteConfirmation(null)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="delete-confirm-button"
                  disabled={deletingIds.size > 0}
                  onClick={confirmDelete}
                  type="button"
                >
                  {deletingIds.size > 0 ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </section>
          </div>
        )}
        {editingTransaction && editForm && (
          <div className="edit-modal-overlay">
            <section
              aria-labelledby="edit-transaction-title"
              aria-modal="true"
              className="edit-transaction-dialog"
              role="dialog"
            >
              <div className="edit-dialog-heading">
                <div>
                  <p className="section-kicker">Transaction details</p>
                  <h2 id="edit-transaction-title">Edit record</h2>
                </div>
                <button
                  aria-label="Close edit dialog"
                  className="edit-dialog-close"
                  disabled={isSavingEdit}
                  onClick={closeEditDialog}
                  type="button"
                >
                  ×
                </button>
              </div>
              <form className="edit-transaction-form" onSubmit={handleEditSubmit}>
                <label htmlFor="edit-transaction-date">Date</label>
                <input
                  autoFocus
                  id="edit-transaction-date"
                  onChange={(event) => setEditForm((current) => ({ ...current, date: event.target.value }))}
                  required
                  type="date"
                  value={editForm.date}
                />
                <label htmlFor="edit-transaction-description">Description</label>
                <input
                  id="edit-transaction-description"
                  maxLength={500}
                  onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))}
                  type="text"
                  value={editForm.description}
                />
                <label htmlFor="edit-transaction-category">Category</label>
                <input
                  id="edit-transaction-category"
                  maxLength={100}
                  onChange={(event) => setEditForm((current) => ({ ...current, category: event.target.value }))}
                  required
                  type="text"
                  value={editForm.category}
                />
                <label htmlFor="edit-transaction-amount">Amount</label>
                <input
                  id="edit-transaction-amount"
                  min="0.01"
                  onChange={(event) => setEditForm((current) => ({ ...current, amount: event.target.value }))}
                  required
                  step="0.01"
                  type="number"
                  value={editForm.amount}
                />
                {editError && <p className="edit-form-error" role="alert">{editError}</p>}
                <div className="edit-form-actions">
                  <button className="delete-cancel-button" disabled={isSavingEdit} onClick={closeEditDialog} type="button">
                    Cancel
                  </button>
                  <button className="edit-save-button" disabled={isSavingEdit} type="submit">
                    {isSavingEdit ? 'Saving...' : 'Save changes'}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}
        <TransactionTable
          items={records.items}
          total={records.total}
          page={records.page}
          pageSize={records.pageSize}
          totalPages={records.total_pages}
          sortBy={records.sortBy}
          sortOrder={records.sortOrder}
          isLoading={records.isLoading}
          onSort={records.toggleSort}
          onPageChange={records.setPage}
          onPageSizeChange={records.changePageSize}
          selectedIds={selectedIds}
          onToggleSelected={toggleSelected}
          onToggleCurrentPage={toggleCurrentPage}
          deletingIds={deletingIds}
          onDeleteTransaction={handleDeleteTransaction}
          onEditTransaction={openEditDialog}
        />
      </section>
    </main>
  )
}

export default RecordsPage
