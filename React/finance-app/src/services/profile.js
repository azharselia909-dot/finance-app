import api from '../api'

/**
 * @param {{ username: string, email: string, designation: string, mobile_number: string }} profile
 */
export async function updateProfile(profile) {
  const response = await api.patch('/auth/me', profile)
  return response.data
}

/**
 * @param {{ current_password: string, new_password: string }} passwordUpdate
 */
export async function updatePassword(passwordUpdate) {
  const response = await api.patch('/auth/me/password', passwordUpdate)
  return response.data
}
