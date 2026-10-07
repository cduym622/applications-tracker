import { useNavigate } from 'react-router-dom'
import ApplicationForm, { emptyForm } from '../components/ApplicationForm'
import BackLink from '../components/BackLink'

export default function ApplicationCreate() {
  const navigate = useNavigate()

  return (
    <main className="page narrow">
      <BackLink />
      <header className="page-header">
        <h1>New application</h1>
      </header>
      <ApplicationForm
        initial={emptyForm}
        submitLabel="Create application"
        // Mock: no save. Opens an existing detail screen to show the flow.
        onSubmit={() => navigate('/applications/1')}
        onCancel={() => navigate('/dashboard')}
      />
    </main>
  )
}
