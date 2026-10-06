const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
})

/**
 * @param {{ balance: string, isLoading: boolean, error: string }} props
 */
function AccountBalance({ balance, isLoading, error }) {
  return (
    <section className="account-balance" aria-label="Current account balance" aria-live="polite">
      <div>
        <p className="section-kicker">Current balance</p>
        <strong>{isLoading ? 'Updating...' : currencyFormatter.format(Number(balance))}</strong>
      </div>
      {error && <p className="account-balance-error" role="alert">{error}</p>}
    </section>
  )
}

export default AccountBalance
