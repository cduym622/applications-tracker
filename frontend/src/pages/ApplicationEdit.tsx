import { useLocation, useNavigate, useParams } from 'react-router-dom'
import ApplicationForm from '../components/ApplicationForm'
import BackLink from '../components/BackLink'
import { applications, companyName } from '../mockData'

export default function ApplicationEdit() {
  const navigate = useNavigate()
  // Carry the detail screen's origin through edit so its Back still works.
  const { state } = useLocation()
  const id = Number(useParams().id)
  const app = applications.find((a) => a.id === id)

  if (!app) {
    return (
      <main className="page narrow">
        <BackLink />
        <p className="card">Application not found.</p>
      </main>
    )
  }

  return (
    <main className="page narrow">
      <BackLink />
      <header className="page-header">
        <h1>Edit application</h1>
      </header>
      <ApplicationForm
        initial={{
          jobTitle: app.jobTitle,
          company: companyName(app.companyId),
          location: app.location,
          status: app.status,
          salary: app.salary ?? '',
          jobPostingUrl: app.jobPostingUrl ?? '',
          dateApplied: app.dateApplied ?? '',
          description: app.description ?? '',
        }}
        submitLabel="Save changes"
        // Mock: no save. Returns to the detail screen.
        onSubmit={() => navigate(`/applications/${app.id}`, { state })}
        onCancel={() => navigate(`/applications/${app.id}`, { state })}
      />
    </main>
  )
}
