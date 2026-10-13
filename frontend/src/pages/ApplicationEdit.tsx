import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ApiError, errorText, getApplication, listCompanies, updateApplication } from '../api'
import ApplicationForm, { toApplicationInput, type ApplicationFormValues } from '../components/ApplicationForm'
import BackLink from '../components/BackLink'
import type { Application, Company } from '../types'

export default function ApplicationEdit() {
  const navigate = useNavigate()
  // Carry the detail screen's origin through edit so its Back still works.
  const { state } = useLocation()
  const id = Number(useParams().id)
  const [app, setApp] = useState<Application | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [companies, setCompanies] = useState<Company[] | null>(null)
  const [error, setError] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    getApplication(id).then(
      (a) => !cancelled && setApp(a),
      (err) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 404) setNotFound(true)
        else setError(errorText(err))
      },
    )
    listCompanies().then(
      (list) => !cancelled && setCompanies(list),
      (err) => {
        if (cancelled) return
        // A typed name still works. The server creates the company.
        setCompanies([])
        setError(errorText(err))
      },
    )
    return () => {
      cancelled = true
    }
  }, [id])

  if (notFound) {
    return (
      <main className="page narrow">
        <BackLink />
        <p className="card">Application not found.</p>
      </main>
    )
  }

  const handleSubmit = async (values: ApplicationFormValues) => {
    setBusy(true)
    setError('')
    setErrors({})
    try {
      await updateApplication(id, toApplicationInput(values))
      navigate(`/applications/${id}`, { state })
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fieldErrors)
      setError(err instanceof ApiError ? err.message : errorText(err))
      setBusy(false)
    }
  }

  return (
    <main className="page narrow">
      <BackLink />
      <header className="page-header">
        <h1>Edit application</h1>
      </header>
      {error && <div className="alert">{error}</div>}
      {!app ? (
        !error && <p className="muted">Loading...</p>
      ) : (
        <ApplicationForm
          initial={{
            jobTitle: app.jobTitle,
            company: app.company.name,
            location: app.location,
            status: app.status,
            salary: app.salary ?? '',
            jobPostingUrl: app.jobPostingUrl ?? '',
            dateApplied: app.dateApplied ?? '',
            description: app.description ?? '',
          }}
          submitLabel="Save changes"
          companies={companies}
          errors={errors}
          busy={busy}
          onSubmit={handleSubmit}
          onCancel={() => navigate(`/applications/${id}`, { state })}
        />
      )}
    </main>
  )
}
