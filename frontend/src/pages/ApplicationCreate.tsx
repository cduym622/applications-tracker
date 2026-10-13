import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, createApplication, errorText, listCompanies } from '../api'
import ApplicationForm, {
  emptyForm,
  toApplicationInput,
  type ApplicationFormValues,
} from '../components/ApplicationForm'
import BackLink from '../components/BackLink'
import type { Company } from '../types'

export default function ApplicationCreate() {
  const navigate = useNavigate()
  const [companies, setCompanies] = useState<Company[] | null>(null)
  const [error, setError] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
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
  }, [])

  const handleSubmit = async (values: ApplicationFormValues) => {
    setBusy(true)
    setError('')
    setErrors({})
    try {
      const app = await createApplication(toApplicationInput(values))
      navigate(`/applications/${app.id}`)
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
        <h1>New application</h1>
      </header>
      {error && <div className="alert">{error}</div>}
      <ApplicationForm
        initial={emptyForm}
        submitLabel="Create application"
        companies={companies}
        errors={errors}
        busy={busy}
        onSubmit={handleSubmit}
        onCancel={() => navigate('/dashboard')}
      />
    </main>
  )
}
