import { downloadTransactionImportTemplate } from '../services/transactions'

function ImportTemplatePage() {
  return (
    <main className="dashboard">
      <section className="intro records-intro">
        <p className="eyebrow">CSV import</p>
        <h1>Start with a template.</h1>
        <p className="intro-copy">
          Download the header-only CSV, add your transactions, then upload it from Saved records.
        </p>
      </section>
      <section className="template-card" aria-labelledby="template-title">
        <div className="template-heading">
          <div>
            <p className="section-kicker">Import format</p>
            <h2 id="template-title">Prepare your transactions</h2>
          </div>
          <span className="template-badge" aria-hidden="true">CSV</span>
        </div>
        <p className="template-copy">
          The template contains column headers only, so no example rows can be mistaken for real financial records.
        </p>
        <div className="template-columns" aria-label="CSV columns">
          <div><code>date</code><span>Required · YYYY-MM-DD</span></div>
          <div><code>description</code><span>Required · up to 500 characters</span></div>
          <div><code>amount</code><span>Required · positive amount, up to 2 decimal places</span></div>
          <div><code>category</code><span>Required · up to 100 characters</span></div>
          <div><code>type</code><span>Required · income or expense</span></div>
        </div>
        <div className="template-example">
          <p className="section-kicker">Example row format</p>
          <code>2026-10-06,Paycheck,2500.00,Salary,income</code>
          <small>Example only. Add your own transaction rows after downloading the template.</small>
        </div>
        <button className="submit-button template-download" type="button" onClick={downloadTransactionImportTemplate}>
          Download CSV template <span aria-hidden="true">↓</span>
        </button>
        <p className="template-note">CSV files only · Maximum file size 5 MB · Uploads with invalid rows are not imported.</p>
      </section>
    </main>
  )
}

export default ImportTemplatePage
