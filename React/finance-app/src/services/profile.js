import api from '../api'

/**
 * @param {{ username: string, email: string, designation: string, mobile_number: string }} profile
 */
export async function updateProfile(profile) {
  const response = await api.patch('/auth/me', profile)
  return response.data
}
