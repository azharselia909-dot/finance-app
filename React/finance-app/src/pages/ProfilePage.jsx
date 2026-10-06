import { useState } from 'react'
import { getApiErrorMessage } from '../services/transactions'
import { updateProfile } from '../services/profile'

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
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const updateField = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
    setSuccess('')
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
    </main>
  )
}

export default ProfilePage
