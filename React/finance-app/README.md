# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:


## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

# Finance App

This is a small React finance tracker. It lets you add income or expenses and displays the saved transactions returned by the FastAPI backend.

## How `App.jsx` works

### 1. Imports

```jsx
import { useEffect, useState } from 'react'
import api from './api'
```

- `useState` stores data that can change while the app is running.
- `useEffect` runs code after the component is displayed.
- `api` is the Axios client used to communicate with the FastAPI server.

### 2. Form state

```jsx
const [formData, setFormData] = useState(initialFormData)
```

`formData` contains the values typed into the form. `setFormData` updates those values and causes React to render the latest data.

The inputs are **controlled inputs** because their `value` comes from React state:

```jsx
value={formData.category}
```

### 3. Loading transactions

When the page opens, `useEffect` calls the API:

```jsx
useEffect(() => {
	loadTransactions()
}, [])
```

The empty array means this effect runs once when the component mounts. The API response is saved in the `transactions` state.

### 4. Handling input changes

```jsx
const handleInputChange = (event) => {
	setFormData({
		...formData,
		[event.target.name]: event.target.value,
	})
}
```

`...formData` keeps the existing fields. The field that changed is then replaced using its `name` attribute, such as `amount` or `category`.

### 5. Submitting the form

```jsx
await api.post('/transactions/', formData)
```

When the form is submitted, the default browser refresh is prevented. The form data is sent to the backend, the transaction list is refreshed, and the form is cleared.

`isSubmitting` disables the button and changes its text to `Saving...`. `error` stores a message if the API request fails.

### 6. Rendering transactions

```jsx
transactions.map((transaction) => (
	<article key={transaction.id}>
		{transaction.category}
	</article>
))
```

`map` creates one piece of JSX for each transaction. The `key` helps React identify each item efficiently.

### 7. Styling

- `src/App.css` contains the finance dashboard and form styles.
- `src/index.css` contains small global styles.
- `src/main.jsx` imports both stylesheets before rendering `App`.

## Run the app

From the `React/finance-app` folder:

```bash
npm install
npm run dev
```

The FastAPI backend must also be running so that the `/transactions/` API requests work.

## Export transactions

On the Saved records page, use the date controls and **Export CSV** to download the signed-in user's transactions. Either date may be left blank; supplied `start_date` and `end_date` values are inclusive and use `YYYY-MM-DD`.

The authenticated FastAPI endpoint is `GET /api/v1/transactions/export`. It streams CSV with the columns `id`, `date`, `category`, `description`, `amount`, and `is_income`.

The Add transaction and Saved records pages show the account-wide current balance (income minus expenses). It refreshes after creating, importing, editing, or deleting transactions. The balance is provided by the authenticated `GET /api/v1/transactions/balance` endpoint.

Use the **Profile** navigation page to update your name, email address, designation/qualification, and mobile number. The email address is also your sign-in identifier. You can also change your password from the same page by supplying your current password plus a new password that matches the confirmation field and is at least 8 characters long.

## Import and browse transactions

The Records page supports `.csv` imports using `date,description,amount,category,type` headers (`type` is `income` or `expense`). The authenticated backend also accepts the existing export format with an `is_income` column. Imports are limited to 5 MB and 20,000 rows and are atomic: any invalid row rejects the entire file with row-level feedback.

Transactions are displayed through server-side search, category/date filters, multi-column sorting, and pagination. Search requests are debounced and stale requests are aborted when filters or pages change. Before starting the backend, install `FastAPI/requirements.txt` and run `python -m scripts.migrate_decimal_amount` from the `FastAPI` directory. Back up the SQLite database before migrating.

Use the **CSV template** navigation page to download a header-only import template. Add one transaction per row using ISO dates (`YYYY-MM-DD`), positive amounts with at most two decimal places, and `income` or `expense` as the type, then upload it from Saved records.
