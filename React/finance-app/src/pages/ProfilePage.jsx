import { useState } from 'react'
import { getApiErrorMessage } from '../services/transactions'
import { updatePassword, updateProfile } from '../services/profile'

/**
 * @param {{
 *   user: { username: string, email: string, designation: string, mobile_number: string },
 *   onProfileUpdated: (user: { username: string, email: string, designation: string, mobile_number: string }) => void
 * }} props
 */
function ProfilePage({ user, onProfileUpdated }) {
  const [form, setForm] = useState({
    username: user.username,
    email: user.email,
    designation: user.designation,
    mobile_number: user.mobile_number,
  })
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  })
  const [isSaving, setIsSaving] = useState(false)
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)
  const [error, setError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [success, setSuccess] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')

  const updateField = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
    setSuccess('')
  }

  const updatePasswordField = (event) => {
    setPasswordForm((current) => ({ ...current, [event.target.name]: event.target.value }))
    setPasswordError('')
    setPasswordSuccess('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (isSaving) return

    setIsSaving(true)
    setError('')
    setSuccess('')
    try {
      const updatedUser = await updateProfile({
        username: form.username.trim(),
        email: form.email.trim(),
        designation: form.designation.trim(),
        mobile_number: form.mobile_number.trim(),
      })
      onProfileUpdated(updatedUser)
      setForm({
        username: updatedUser.username,
        email: updatedUser.email,
        designation: updatedUser.designation,
        mobile_number: updatedUser.mobile_number,
      })
      setSuccess('Your profile has been updated.')
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Profile could not be updated. Please try again.'))
    } finally {
      setIsSaving(false)
    }
  }

  const handlePasswordSubmit = async (event) => {
    event.preventDefault()
    if (isUpdatingPassword) return

    if (passwordForm.new_password.length < 8) {
      setPasswordError('Your new password must be at least 8 characters.')
      return
    }

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordError('Your new password and confirmation do not match.')
      return
    }

    setIsUpdatingPassword(true)
    setPasswordError('')
    setPasswordSuccess('')
    try {
      await updatePassword({
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      })
      setPasswordForm({
        current_password: '',
        new_password: '',
        confirm_password: '',
      })
      setPasswordSuccess('Your password has been updated.')
    } catch (requestError) {
      setPasswordError(getApiErrorMessage(requestError, 'Password could not be updated. Please try again.'))
    } finally {
      setIsUpdatingPassword(false)
    }
  }

  return (
    <main className="dashboard">
      <section className="intro records-intro">
        <p className="eyebrow">Your account</p>
        <h1>Your profile.</h1>
        <p className="intro-copy">Update the contact and account details associated with your finance ledger.</p>
      </section>

      <form className="profile-form" onSubmit={handleSubmit}>
        <div className="form-heading">
          <div>
            <p className="section-kicker">Basic details</p>
            <h2>Account information</h2>
          </div>
        </div>
        <div className="field-group">
          <label htmlFor="profile-username">Name</label>
          <input
            autoComplete="name"
            id="profile-username"
            maxLength={50}
            minLength={3}
            name="username"
            onChange={updateField}
            required
            value={form.username}
          />
        </div>
        <div className="field-group">
          <label htmlFor="profile-email">Email address</label>
          <input
            autoComplete="email"
            id="profile-email"
            maxLength={254}
            name="email"
            onChange={updateField}
            required
            type="email"
            value={form.email}
          />
          <small className="profile-field-help">You use this email address to sign in.</small>
        </div>
        <div className="field-group">
          <label htmlFor="profile-designation">Designation / qualification</label>
          <input
            id="profile-designation"
            maxLength={100}
            minLength={2}
            name="designation"
            onChange={updateField}
            required
            value={form.designation}
          />
        </div>
        <div className="field-group">
          <label htmlFor="profile-mobile">Mobile number</label>
          <input
            autoComplete="tel"
            id="profile-mobile"
            maxLength={20}
            minLength={7}
            name="mobile_number"
            onChange={updateField}
            pattern="\\+?[0-9][0-9\\s-]{6,18}[0-9]"
            required
            type="tel"
            value={form.mobile_number}
          />
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {success && <p className="profile-success" role="status">{success}</p>}
        <button className="submit-button profile-save-button" disabled={isSaving} type="submit">
          {isSaving ? 'Saving profile...' : 'Save profile'}
        </button>
      </form>

      <form className="profile-form" onSubmit={handlePasswordSubmit}>
        <div className="form-heading">
          <div>
            <p className="section-kicker">Security</p>
            <h2>Update password</h2>
          </div>
        </div>
        <div className="field-group">
          <label htmlFor="profile-current-password">Current password</label>
          <input
            autoComplete="current-password"
            id="profile-current-password"
            minLength={8}
            name="current_password"
            onChange={updatePasswordField}
            required
            type="password"
            value={passwordForm.current_password}
          />
        </div>
        <div className="field-group">
          <label htmlFor="profile-new-password">New password</label>
          <input
            autoComplete="new-password"
            id="profile-new-password"
            minLength={8}
            name="new_password"
            onChange={updatePasswordField}
            required
            type="password"
            value={passwordForm.new_password}
          />
        </div>
        <div className="field-group">
          <label htmlFor="profile-confirm-password">Confirm new password</label>
          <input
            autoComplete="new-password"
            id="profile-confirm-password"
            minLength={8}
            name="confirm_password"
            onChange={updatePasswordField}
            required
            type="password"
            value={passwordForm.confirm_password}
          />
        </div>
        {passwordError && <p className="form-error" role="alert">{passwordError}</p>}
        {passwordSuccess && <p className="profile-success" role="status">{passwordSuccess}</p>}
        <button className="submit-button profile-save-button" disabled={isUpdatingPassword} type="submit">
          {isUpdatingPassword ? 'Updating password...' : 'Update password'}
        </button>
      </form>
    </main>
  )
}

export default ProfilePage
