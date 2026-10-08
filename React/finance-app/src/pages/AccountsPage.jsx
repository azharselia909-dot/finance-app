import { useState } from 'react'
import { Link } from 'react-router-dom'
import { createAccount } from '../services/accounts'
import { getApiErrorMessage } from '../services/transactions'

const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
})

const accountTypes = [
  ['cash', 'Cash'],
  ['wallet', 'Wallet'],
  ['bank', 'Bank account'],
]

function AccountsPage({ accounts, isLoading, error, onAccountsChanged }) {
  const [form, setForm] = useState({
    name: '',
    account_type: 'cash',
    opening_balance: '0.00',
  })
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (isSaving) return

    setIsSaving(true)
    setFormError('')
    setSuccessMessage('')
    try {
      await createAccount({
        ...form,
        name: form.name.trim(),
        opening_balance: form.opening_balance || '0.00',
      })
      setForm({ name: '', account_type: 'cash', opening_balance: '0.00' })
      setSuccessMessage('Account created.')
      await onAccountsChanged()
    } catch (requestError) {
      setFormError(getApiErrorMessage(requestError, 'Account could not be created. Please try again.'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="dashboard">
      <section className="intro records-intro">
        <p className="eyebrow">Your money, organized</p>
        <h1>Manage accounts.</h1>
        <p className="intro-copy">
          Keep cash, digital wallets, and bank accounts separate. Each balance updates when you record income or an expense.
        </p>
      </section>
      <section className="accounts-layout" aria-label="Account management">
        <form className="transaction-form account-form" onSubmit={handleSubmit}>
          <div className="form-heading">
            <div><p className="section-kicker">New account</p><h2>Add an account</h2></div>
            <span className="form-mark" aria-hidden="true">+</span>
          </div>
          <div className="field-group">
            <label htmlFor="account-name">Account name</label>
            <input
              autoComplete="off"
              id="account-name"
              maxLength="100"
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="e.g. Everyday wallet"
              required
              value={form.name}
            />
          </div>
          <div className="field-group">
            <label htmlFor="account-type">Account type</label>
            <select
              id="account-type"
              onChange={(event) => setForm({ ...form, account_type: event.target.value })}
              value={form.account_type}
            >
              {accountTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div className="field-group">
            <label htmlFor="account-opening-balance">Starting balance</label>
            <input
              id="account-opening-balance"
              onChange={(event) => setForm({ ...form, opening_balance: event.target.value })}
              step="0.01"
              type="number"
              value={form.opening_balance}
            />
          </div>
          {formError && <p className="form-error" role="alert">{formError}</p>}
          {successMessage && <p className="profile-success" role="status">{successMessage}</p>}
          <button className="submit-button" disabled={isSaving} type="submit">
            {isSaving ? 'Creating...' : 'Create account'}<span aria-hidden="true">-&gt;</span>
          </button>
        </form>
        <section className="account-list-panel" aria-labelledby="account-list-title">
          <div className="section-header">
            <div><p className="section-kicker">Balances</p><h2 id="account-list-title">Your accounts</h2></div>
            <span className="transaction-count">{accounts.length} total</span>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          {isLoading && <p className="account-empty">Loading accounts...</p>}
          {!isLoading && accounts.length === 0 && (
            <div className="account-empty">
              <p>No accounts yet. Create one to start tracking balances.</p>
              <Link className="text-button" to="/add">Go to transactions</Link>
            </div>
          )}
          <div className="account-card-list">
            {accounts.map((account) => (
              <article className="account-card" key={account.id}>
                <div>
                  <span className={`account-type-badge ${account.account_type}`}>
                    {accountTypes.find(([value]) => value === account.account_type)?.[1] || account.account_type}
                  </span>
                  <h3>{account.name}</h3>
                </div>
                <strong>{currencyFormatter.format(Number(account.balance))}</strong>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  )
}

export default AccountsPage
