import api from '../api'

export async function fetchAccounts() {
  const response = await api.get('/api/v1/accounts')
  return response.data
}

export async function createAccount(account) {
  const response = await api.post('/api/v1/accounts', account)
  return response.data
}
