import { useCallback, useEffect, useRef, useState } from 'react'
import { BrowserRouter, NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import api from './api'
import { fetchAccounts } from './services/accounts'
import { downloadTransactionsCsv, fetchTransactionBalance } from './services/transactions'
import AccountsPage from './pages/AccountsPage'
import AuthPage from './pages/AuthPage'
import ImportTemplatePage from './pages/ImportTemplatePage'
import ProfilePage from './pages/ProfilePage'
import RecordsPage from './pages/RecordsPage'
import TransactionFormPage from './pages/TransactionFormPage'

const initialFormData = {
  amount: '',
  category: '',
  description: '',
  is_income: false,
  date: '',
  account_id: '',
}

function Layout({ children, user, onLogout }) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink className="brand" to="/add">Ledger</NavLink>
        <nav className="main-nav" aria-label="Main navigation">
          <NavLink className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} to="/add">Add transaction</NavLink>
          <NavLink className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} to="/records">Saved records</NavLink>
          <NavLink className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} to="/accounts">Accounts</NavLink>
          <NavLink className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} to="/import-template">CSV template</NavLink>
          <NavLink className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} to="/profile">Profile</NavLink>
        </nav>
        <div className="account-actions"><span className="topbar-caption">{user.username}</span><button className="logout-button" type="button" onClick={onLogout}>Log out</button></div>
      </header>
      {children}
    </div>
  )
}

function AppContent() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState(initialFormData)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [exportError, setExportError] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const [user, setUser] = useState(null)
  const [isAuthLoading, setIsAuthLoading] = useState(() => Boolean(localStorage.getItem('access_token')))
  const [balance, setBalance] = useState('0.00')
  const [isBalanceLoading, setIsBalanceLoading] = useState(false)
  const [balanceError, setBalanceError] = useState('')
  const balanceRequestId = useRef(0)
  const [accounts, setAccounts] = useState([])
  const [isAccountsLoading, setIsAccountsLoading] = useState(false)
  const [accountsError, setAccountsError] = useState('')
  const accountsRequestId = useRef(0)

  const refreshBalance = useCallback(async () => {
    const requestId = ++balanceRequestId.current
    setIsBalanceLoading(true)
    setBalanceError('')
    try {
      const result = await fetchTransactionBalance()
      if (balanceRequestId.current === requestId) setBalance(result.balance)
    } catch {
      if (balanceRequestId.current === requestId) {
        setBalanceError('Current balance could not be loaded.')
      }
    } finally {
      if (balanceRequestId.current === requestId) setIsBalanceLoading(false)
    }
  }, [])

  const refreshAccounts = useCallback(async () => {
    const requestId = ++accountsRequestId.current
    setIsAccountsLoading(true)
    setAccountsError('')
    try {
      const results = await fetchAccounts()
      if (accountsRequestId.current === requestId) setAccounts(results)
    } catch {
      if (accountsRequestId.current === requestId) {
        setAccountsError('Accounts could not be loaded. Please try again.')
      }
    } finally {
      if (accountsRequestId.current === requestId) setIsAccountsLoading(false)
    }
  }, [])

  const handleAuthenticated = (authData) => {
    localStorage.setItem('access_token', authData.access_token)
    setUser(authData.user)
    void refreshBalance()
    void refreshAccounts()
  }

  const handleLogout = useCallback(() => {
    balanceRequestId.current += 1
    accountsRequestId.current += 1
    localStorage.removeItem('access_token')
    setUser(null)
    setBalance('0.00')
    setIsBalanceLoading(false)
    setBalanceError('')
    setAccounts([])
    setIsAccountsLoading(false)
    setAccountsError('')
    navigate('/login', { replace: true })
  }, [navigate])

  const handleExportTransactions = async (startDate, endDate) => {
    setIsExporting(true)
    setExportError('')
    try {
      await downloadTransactionsCsv(startDate, endDate)
    } catch {
      setExportError('Transactions could not be exported. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) return

    const loadCurrentUser = async () => {
      try {
        const userResponse = await api.get('/auth/me')
        setUser(userResponse.data)
        await Promise.all([refreshBalance(), refreshAccounts()])
      } catch {
        handleLogout()
        setError('Your session could not be verified. Please sign in again.')
      } finally {
        setIsAuthLoading(false)
      }
    }

    loadCurrentUser()
  }, [handleLogout, refreshBalance, refreshAccounts])

  if (isAuthLoading) return <div className="auth-loading">Loading your ledger...</div>

  const handleFormSubmit = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    setError('')
    try {
      await api.post('/transactions/', {
        ...formData,
        account_id: Number(formData.account_id),
      })
      setFormData(initialFormData)
      await Promise.all([refreshBalance(), refreshAccounts()])
      return true
    } catch {
      setError('Your transaction could not be saved. Please check the details and try again.')
      return false
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      {!user ? <AuthPage onAuthenticated={handleAuthenticated} /> : <Layout user={user} onLogout={handleLogout}>
        <Routes>
          <Route path="/" element={<TransactionFormPage accounts={accounts} accountsLoading={isAccountsLoading} formData={formData} setFormData={setFormData} onSubmit={handleFormSubmit} isSubmitting={isSubmitting} error={error} balance={balance} balanceLoading={isBalanceLoading} balanceError={balanceError} />} />
          <Route path="/add" element={<TransactionFormPage accounts={accounts} accountsLoading={isAccountsLoading} formData={formData} setFormData={setFormData} onSubmit={handleFormSubmit} isSubmitting={isSubmitting} error={error} balance={balance} balanceLoading={isBalanceLoading} balanceError={balanceError} />} />
          <Route path="/records" element={<RecordsPage error={error} exportError={exportError} isExporting={isExporting} onExport={handleExportTransactions} balance={balance} balanceLoading={isBalanceLoading} balanceError={balanceError} onTransactionsChanged={() => Promise.all([refreshBalance(), refreshAccounts()])} accounts={accounts} />} />
          <Route path="/accounts" element={<AccountsPage accounts={accounts} isLoading={isAccountsLoading} error={accountsError} onAccountsChanged={() => Promise.all([refreshAccounts(), refreshBalance()])} />} />
          <Route path="/import-template" element={<ImportTemplatePage />} />
          <Route path="/profile" element={<ProfilePage user={user} onProfileUpdated={setUser} />} />
        </Routes>
         
      </Layout>}
    </>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}

export default App
