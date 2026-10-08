import api from '../api'

/**
 * @typedef {{ id: number, date: string, description: string, category: string, type: 'income' | 'expense', amount: string | number, account_id: number | null, account_name: string | null, account_type: 'cash' | 'wallet' | 'bank' | null }} TransactionRecord
 * @typedef {{ items: TransactionRecord[], total: number, page: number, page_size: number, total_pages: number }} PaginatedTransactionsResponse
 */

/**
 * @param {{ page: number, page_size: number, search?: string, category?: string, date_range?: string, sort_by: string, sort_order: 'asc' | 'desc' }} params
 * @param {AbortSignal} signal
 * @returns {Promise<PaginatedTransactionsResponse>}
 */
export async function fetchTransactions(params, signal) {
  const response = await api.get('/api/v1/transactions', { params, signal })
  return response.data
}

/**
 * @returns {Promise<{ balance: string }>}
 */
export async function fetchTransactionBalance() {
  const response = await api.get('/api/v1/transactions/balance')
  return response.data
}

/**
 * @param {File} file
 * @param {(event: { loaded: number, total?: number }) => void} onUploadProgress
 * @returns {Promise<{ imported: number }>}
 */
export async function uploadTransactionsCsv(file, onUploadProgress) {
  const formData = new FormData()
  formData.append('upload', file)
  const response = await api.post('/api/v1/transactions/import', formData, {
    onUploadProgress,
  })
  return response.data
}

/**
 * @param {string} startDate
 * @param {string} endDate
 * @returns {Promise<void>}
 */
export async function downloadTransactionsCsv(startDate, endDate) {
  const response = await api.get('/api/v1/transactions/export', {
    params: {
      start_date: startDate || undefined,
      end_date: endDate || undefined,
    },
    responseType: 'blob',
  })
  const downloadUrl = window.URL.createObjectURL(response.data)
  const downloadLink = document.createElement('a')
  downloadLink.href = downloadUrl
  downloadLink.download = 'transactions.csv'
  document.body.appendChild(downloadLink)
  downloadLink.click()
  downloadLink.remove()
  window.setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 0)
}

export function downloadTransactionImportTemplate() {
  const template = 'date,description,amount,category,type,account_type,account_name\r\n'
  const blob = new Blob([template], { type: 'text/csv;charset=utf-8' })
  const downloadUrl = window.URL.createObjectURL(blob)
  const downloadLink = document.createElement('a')
  downloadLink.href = downloadUrl
  downloadLink.download = 'transaction-import-template.csv'
  document.body.appendChild(downloadLink)
  downloadLink.click()
  downloadLink.remove()
  window.setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 0)
}

/**
 * @param {import('axios').AxiosError} error
 * @param {string} fallback
 * @returns {string}
 */
export function getApiErrorMessage(error, fallback) {
  const detail = error.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (detail?.message && Array.isArray(detail.errors)) {
    const rowErrors = detail.errors.slice(0, 5)
      .map((item) => `Row ${item.row}: ${item.message}`)
      .join(' ')
    const remainder = detail.error_count > detail.errors.length
      ? ` ${detail.error_count - detail.errors.length} more row errors were omitted.`
      : ''
    return `${detail.message}. ${rowErrors}${remainder}`.trim()
  }
  if (Array.isArray(detail)) return detail.map((item) => item.msg).join('; ')
  return fallback
}

export async function bulkDeleteTransactions(ids) {
  const response = await api.post('/api/v1/transactions/bulk-delete', { ids })
  return response.data
}

/**
 * @param {number} id
 * @returns {Promise<{ deleted: number }>}
 */
export async function deleteTransaction(id) {
  return bulkDeleteTransactions([id])
}

/**
 * @param {number} id
 * @param {{ date: string, description: string, amount: string, category: string }} changes
 * @returns {Promise<unknown>}
 */
export async function updateTransaction(id, changes) {
  const response = await api.patch(`/api/v1/transactions/${id}`, changes)
  return response.data
}
