import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import { fetchTransactions, getApiErrorMessage } from '../services/transactions'

/**
 * @typedef {Object} PaginatedTransactionsState
 * @property {import('../services/transactions').TransactionRecord[]} items
 * @property {number} total
 * @property {number} total_pages
 * @property {number} page
 * @property {number} pageSize
 * @property {string} searchInput
 * @property {string} category
 * @property {string} startDate
 * @property {string} endDate
 * @property {string} sortBy
 * @property {'asc' | 'desc'} sortOrder
 * @property {boolean} isLoading
 * @property {string} error
 * @property {(page: number) => void} setPage
 * @property {(value: string) => void} setSearchInput
 * @property {(category: string, startDate: string, endDate: string) => void} applyFilters
 * @property {(value: string) => void} changePageSize
 * @property {(field: string) => void} toggleSort
 * @property {() => void} refresh
 * @property {() => void} clearFilters
 *  *   selectedIds: Set<number>,
 *   onToggleSelected: (id: number) => void,
 *   onToggleCurrentPage: (checked: boolean) => void
 */

/** @returns {PaginatedTransactionsState} */
export default function usePaginatedTransactions() {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [sortBy, setSortBy] = useState('date')
  const [sortOrder, setSortOrder] = useState('desc')
  const [refreshKey, setRefreshKey] = useState(0)
  const [result, setResult] = useState({
    items: [],
    total: 0,
    page: 1,
    page_size: 20,
    total_pages: 1,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const latestRequest = useRef(0)

  const beginRequest = useCallback(() => {
    setIsLoading(true)
    setError('')
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const normalizedSearch = searchInput.trim()
      if (search !== normalizedSearch) setPage(1)
      setSearch(normalizedSearch)
    }, 350)
    return () => window.clearTimeout(timeoutId)
  }, [searchInput, search])

  const dateRange = useMemo(() => {
    if (!startDate && !endDate) return undefined
    return `${startDate},${endDate}`
  }, [startDate, endDate])

  useEffect(() => {
    const controller = new AbortController()
    const requestId = latestRequest.current + 1
    latestRequest.current = requestId
    fetchTransactions({
      page,
      page_size: pageSize,
      search: search || undefined,
      category: category || undefined,
      date_range: dateRange,
      sort_by: sortBy,
      sort_order: sortOrder,
    }, controller.signal)
      .then((data) => {
        if (latestRequest.current === requestId) setResult(data)
      })
      .catch((requestError) => {
        if (axios.isCancel(requestError) || controller.signal.aborted) return
        if (latestRequest.current === requestId) {
          setError(getApiErrorMessage(requestError, 'Transactions could not be loaded. Please try again.'))
        }
      })
      .finally(() => {
        if (latestRequest.current === requestId && !controller.signal.aborted) {
          setIsLoading(false)
        }
      })

    return () => controller.abort()
  }, [page, pageSize, search, category, dateRange, sortBy, sortOrder, refreshKey])

  const changePage = useCallback((value) => {
    beginRequest()
    setPage(value)
  }, [beginRequest])

  const changeSearchInput = useCallback((value) => {
    beginRequest()
    setSearchInput(value)
  }, [beginRequest])

  const clearFilters = useCallback(() => {
    beginRequest()
    setCategory('')
    setStartDate('')
    setEndDate('')
    setSearchInput('')
    setSearch('')
    setPage(1)
  }, [beginRequest])

  const applyFilters = useCallback((nextCategory, from, to) => {
    beginRequest()
    setCategory(nextCategory)
    setStartDate(from)
    setEndDate(to)
    setSearch(searchInput.trim())
    setPage(1)
  }, [beginRequest, searchInput])

  const changeCategory = useCallback((value) => {
    beginRequest()
    setCategory(value)
    setPage(1)
  }, [beginRequest])

  const changeDateRange = useCallback((from, to) => {
    beginRequest()
    setStartDate(from)
    setEndDate(to)
    setPage(1)
  }, [beginRequest])

  const changePageSize = useCallback((value) => {
    beginRequest()
    setPageSize(Number(value))
    setPage(1)
  }, [beginRequest])

  const toggleSort = useCallback((field) => {
    beginRequest()
    if (sortBy === field) {
      setSortOrder((order) => order === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder(field === 'date' ? 'desc' : 'asc')
    }
    setPage(1)
  }, [beginRequest, sortBy])

  const refresh = useCallback(() => {
    beginRequest()
    setPage(1)
    setRefreshKey((key) => key + 1)
  }, [beginRequest])

  return {
    ...result,
    page,
    pageSize,
    searchInput,
    category,
    startDate,
    endDate,
    sortBy,
    sortOrder,
    isLoading,
    error,
    setPage: changePage,
    setSearchInput: changeSearchInput,
    applyFilters,
    changeCategory,
    changeDateRange,
    changePageSize,
    toggleSort,
    refresh,
    clearFilters,
  }
}
