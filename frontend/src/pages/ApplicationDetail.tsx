import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import BackLink, { useBackTarget } from '../components/BackLink'
import StatusBadge from '../components/StatusBadge'
import {
  applications,
  companyName,
  deleteApplication,
  formatDate,
  formatDateTime,
  interviews as allInterviews,
  notes as allNotes,
} from '../mockData'
import {
  INTERVIEW_OUTCOMES,
  INTERVIEW_TYPES,
  label,
  type Interview,
  type InterviewOutcome,
  type InterviewType,
  type Note,
} from '../types'

export default function ApplicationDetail() {
  const navigate = useNavigate()
  const location = useLocation()
  const back = useBackTarget()
  const id = Number(useParams().id)
  const app = applications.find((a) => a.id === id)

  // Local copies so add/edit/delete can be clicked through. Lost on refresh.
  const [interviews, setInterviews] = useState<Interview[]>(() =>
    allInterviews
      .filter((i) => i.applicationId === id)
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)),
  )
  const [notes, setNotes] = useState<Note[]>(() => allNotes.filter((n) => n.applicationId === id))

  if (!app) {
    return (
      <main className="page">
        <BackLink to={back.to} label={back.label} />
        <p className="card">Application not found.</p>
      </main>
    )
  }

  const handleDelete = () => {
    if (confirm('Delete this application? Its interviews and notes will be deleted too.')) {
      // Mock: removes the record until refresh.
      deleteApplication(app.id)
      navigate(back.to)
    }
  }

  return (
    <main className="page narrow">
      <BackLink to={back.to} label={back.label} />

      <section className="card">
        <div className="section-header">
          <div>
            <h1>{app.jobTitle}</h1>
            <p className="muted">
              {companyName(app.companyId)} · {app.location}
            </p>
          </div>
          <div className="actions">
            <Link to={`/applications/${app.id}/edit`} state={location.state} className="btn">
              Edit
            </Link>
            <button className="btn btn-danger" onClick={handleDelete}>
              Delete
            </button>
          </div>
        </div>

        <dl className="details">
          <dt>Status</dt>
          <dd>
            <StatusBadge status={app.status} />
          </dd>
          <dt>Salary</dt>
          <dd>{app.salary || <span className="muted">—</span>}</dd>
          <dt>Date applied</dt>
          <dd>{app.dateApplied ? formatDate(app.dateApplied) : <span className="muted">—</span>}</dd>
          <dt>Job posting</dt>
          <dd>
            {app.jobPostingUrl ? (
              <a href={app.jobPostingUrl} target="_blank" rel="noreferrer">
                {app.jobPostingUrl}
              </a>
            ) : (
              <span className="muted">—</span>
            )}
          </dd>
          <dt>Description</dt>
          <dd>{app.description || <span className="muted">—</span>}</dd>
        </dl>
      </section>

      <InterviewsSection
        applicationId={app.id}
        interviews={interviews}
        onAdd={(i) =>
          setInterviews((list) => [...list, i].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)))
        }
        onDelete={(iid) => setInterviews((list) => list.filter((i) => i.id !== iid))}
      />

      <NotesSection
        applicationId={app.id}
        notes={notes}
        onAdd={(n) => setNotes((list) => [...list, n])}
        onUpdate={(nid, text) =>
          setNotes((list) =>
            list.map((n) => (n.id === nid ? { ...n, text, updatedAt: new Date().toISOString() } : n)),
          )
        }
        onDelete={(nid) => setNotes((list) => list.filter((n) => n.id !== nid))}
      />
    </main>
  )
}

function InterviewsSection({
  applicationId,
  interviews,
  onAdd,
  onDelete,
}: {
  applicationId: number
  interviews: Interview[]
  onAdd: (i: Interview) => void
  onDelete: (id: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [scheduledAt, setScheduledAt] = useState('')
  const [type, setType] = useState<InterviewType>('PHONE')
  const [outcome, setOutcome] = useState<InterviewOutcome>('SCHEDULED')
  const [roundName, setRoundName] = useState('')
  const [interviewerName, setInterviewerName] = useState('')

  const reset = () => {
    setScheduledAt('')
    setType('PHONE')
    setOutcome('SCHEDULED')
    setRoundName('')
    setInterviewerName('')
    setOpen(false)
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    onAdd({
      id: Date.now(),
      applicationId,
      scheduledAt: new Date(scheduledAt).toISOString(),
      type,
      outcome,
      roundName: roundName || undefined,
      interviewerName: interviewerName || undefined,
    })
    reset()
  }

  return (
    <section className="card">
      <div className="section-header">
        <h2>Interviews</h2>
        {!open && (
          <button className="btn" onClick={() => setOpen(true)}>
            + Add interview
          </button>
        )}
      </div>

      {open && (
        <form className="inline-form" onSubmit={handleSubmit}>
          <div className="form-grid">
            <label className="field">
              <span>Date and time *</span>
              <input
                type="datetime-local"
                required
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Type *</span>
              <select value={type} onChange={(e) => setType(e.target.value as InterviewType)}>
                {INTERVIEW_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {label(t)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Outcome *</span>
              <select value={outcome} onChange={(e) => setOutcome(e.target.value as InterviewOutcome)}>
                {INTERVIEW_OUTCOMES.map((o) => (
                  <option key={o} value={o}>
                    {label(o)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Round name</span>
              <input value={roundName} onChange={(e) => setRoundName(e.target.value)} />
            </label>
            <label className="field">
              <span>Interviewer name</span>
              <input value={interviewerName} onChange={(e) => setInterviewerName(e.target.value)} />
            </label>
          </div>
          <div className="actions">
            <button type="submit" className="btn btn-primary">
              Add interview
            </button>
            <button type="button" className="btn" onClick={reset}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {interviews.length === 0 ? (
        <p className="muted">No interviews yet.</p>
      ) : (
        <ul className="list">
          {interviews.map((i) => (
            <li key={i.id} className="list-row">
              <div>
                <strong>{formatDateTime(i.scheduledAt)}</strong>
                <div className="muted">
                  {[i.roundName, i.interviewerName].filter(Boolean).join(' · ') || 'No round details'}
                </div>
              </div>
              <div className="list-row-meta">
                <span className="tag">{label(i.type)}</span>
                <span className={`tag outcome-${i.outcome.toLowerCase()}`}>{label(i.outcome)}</span>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => confirm('Delete this interview?') && onDelete(i.id)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function NotesSection({
  applicationId,
  notes,
  onAdd,
  onUpdate,
  onDelete,
}: {
  applicationId: number
  notes: Note[]
  onAdd: (n: Note) => void
  onUpdate: (id: number, text: string) => void
  onDelete: (id: number) => void
}) {
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editText, setEditText] = useState('')

  const handleAdd = (e: FormEvent) => {
    e.preventDefault()
    if (!draft.trim()) return
    const now = new Date().toISOString()
    onAdd({ id: Date.now(), applicationId, text: draft.trim(), createdAt: now, updatedAt: now })
    setDraft('')
  }

  const saveEdit = (e: FormEvent) => {
    e.preventDefault()
    if (editingId !== null && editText.trim()) onUpdate(editingId, editText.trim())
    setEditingId(null)
  }

  return (
    <section className="card">
      <h2>Notes</h2>

      {notes.length === 0 && <p className="muted">No notes yet.</p>}

      <ul className="notes">
        {notes.map((n) => (
          <li key={n.id} className="note">
            {editingId === n.id ? (
              <form onSubmit={saveEdit}>
                <textarea rows={3} value={editText} onChange={(e) => setEditText(e.target.value)} />
                <div className="actions">
                  <button type="submit" className="btn btn-primary btn-sm">
                    Save
                  </button>
                  <button type="button" className="btn btn-sm" onClick={() => setEditingId(null)}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                <p>{n.text}</p>
                <div className="note-footer">
                  <span className="muted small">
                    Added {formatDateTime(n.createdAt)}
                    {n.updatedAt !== n.createdAt && <> · Edited {formatDateTime(n.updatedAt)}</>}
                  </span>
                  <div className="actions">
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        setEditingId(n.id)
                        setEditText(n.text)
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => confirm('Delete this note?') && onDelete(n.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>

      <form className="note-add" onSubmit={handleAdd}>
        <textarea
          rows={3}
          placeholder="Add a note…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={!draft.trim()}>
          Add note
        </button>
      </form>
    </section>
  )
}
