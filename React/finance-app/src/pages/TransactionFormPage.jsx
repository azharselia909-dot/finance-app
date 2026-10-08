import { Link, useNavigate } from 'react-router-dom'
import AccountBalance from '../components/AccountBalance'

function TransactionFormPage({
  accounts,
  accountsLoading,
  formData,
  setFormData,
  onSubmit,
  isSubmitting,
  error,
  balance,
  balanceLoading,
  balanceError,
}) {
  const navigate = useNavigate()
  const selectedAccount = accounts.find((account) => String(account.id) === String(formData.account_id))

  const handleInputChange = (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value
    setFormData({ ...formData, [event.target.name]: value })
  }

  const handleSubmit = async (event) => {
    const saved = await onSubmit(event)
    if (saved) navigate('/records')
  }

  return (
    <main className="dashboard">
      <section className="intro">
        <p className="eyebrow">New transaction</p>
        <h1>Give every dollar a direction.</h1>
        <p className="intro-copy">Choose an account, then record income or an expense to keep its balance up to date.</p>
      </section>
      <AccountBalance balance={balance} isLoading={balanceLoading} error={balanceError} />
      {!accountsLoading && accounts.length === 0 && (
        <p className="account-required-notice">
          Create a cash, wallet, or bank account before recording a transaction. <Link to="/accounts">Manage accounts</Link>
        </p>
      )}

      <form className="transaction-form form-page" onSubmit={handleSubmit}>
        <div className="form-heading">
          <div><p className="section-kicker">Transaction details</p><h2>Record a transaction</h2></div>
          <span className="form-mark" aria-hidden="true">+</span>
        </div>
        <div className="field-group">
          <label htmlFor="amount">Amount</label>
          <div className="amount-input"><span aria-hidden="true">$</span><input type="number" min="0.01" step="0.01" id="amount" name="amount" placeholder="0.00" required onChange={handleInputChange} value={formData.amount} /></div>
        </div>
        <div className="field-group">
          <label htmlFor="transaction-account">Account</label>
          <select id="transaction-account" name="account_id" onChange={handleInputChange} required value={formData.account_id}>
            <option value="">Select an account</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>{account.name} ({account.account_type})</option>
            ))}
          </select>
          {selectedAccount && (
            <span className="account-balance-hint">
              Current balance: {new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(selectedAccount.balance))}
            </span>
          )}
        </div>
        <fieldset className="field-group type-field">
          <legend>Type</legend>
          <div className="type-options">
            <label className={`type-option ${!formData.is_income ? 'selected expense' : ''}`}><input type="radio" name="transaction_type" checked={!formData.is_income} onChange={() => setFormData({ ...formData, is_income: false })} /><span>Expense</span></label>
            <label className={`type-option ${formData.is_income ? 'selected income' : ''}`}><input type="radio" name="transaction_type" checked={formData.is_income} onChange={() => setFormData({ ...formData, is_income: true })} /><span>Income</span></label>
          </div>
        </fieldset>
        <div className="form-row">
          <div className="field-group"><label htmlFor="category">Category</label><input type="text" id="category" name="category" placeholder="e.g. Groceries" required onChange={handleInputChange} value={formData.category} /></div>
          <div className="field-group"><label htmlFor="date">Date</label><input type="date" id="date" name="date" required onChange={handleInputChange} value={formData.date} /></div>
        </div>
        <div className="field-group"><label htmlFor="description">Description <span>(optional)</span></label><input type="text" id="description" name="description" placeholder="What was this for?" onChange={handleInputChange} value={formData.description} /></div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="submit-button" type="submit" disabled={isSubmitting || accountsLoading || accounts.length === 0}>{isSubmitting ? 'Saving...' : 'Save transaction'}<span aria-hidden="true">-&gt;</span></button>
      </form>
    </main>
  )
}

export default TransactionFormPage
