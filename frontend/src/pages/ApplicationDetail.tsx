import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  ApiError,
  createInterview,
  createNote,
  deleteApplication,
  deleteInterview,
  deleteNote,
  errorText,
  getApplication,
  listInterviews,
  listNotes,
  updateInterviewOutcome,
  updateNote,
} from '../api'
import BackLink, { useBackTarget } from '../components/BackLink'
import StatusBadge from '../components/StatusBadge'
import { formatDate, formatDateTime } from '../format'
import {
  INTERVIEW_OUTCOMES,
  INTERVIEW_TYPES,
  label,
  type Application,
  type Interview,
  type InterviewOutcome,
  type InterviewType,
  type Note,
} from '../types'

const byScheduledAt = (a: Interview, b: Interview) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt)

export default function ApplicationDetail() {
  const navigate = useNavigate()
  const location = useLocation()
  const back = useBackTarget()
  const id = Number(useParams().id)
  const [app, setApp] = useState<Application | null>(null)
  const [notFound, setNotFound] = useState(false)
  // Lists come back already ordered by the API. Do not sort them again.
  const [interviews, setInterviews] = useState<Interview[] | null>(null)
  const [notes, setNotes] = useState<Note[] | null>(null)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      let a: Application
      try {
        a = await getApplication(id)
      } catch (err) {
        if (cancelled) return
        // A missing application skips the interview and note calls.
        if (err instanceof ApiError && err.status === 404) setNotFound(true)
        else setError(errorText(err))
        return
      }
      if (cancelled) return
      setApp(a)
      try {
        const [i, n] = await Promise.all([listInterviews(id), listNotes(id)])
        if (cancelled) return
        setInterviews(i)
        setNotes(n)
      } catch (err) {
        if (!cancelled) setError(errorText(err))
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id])

  if (notFound) {
    return (
      <main className="page">
        <BackLink to={back.to} label={back.label} />
        <p className="card">Application not found.</p>
      </main>
    )
  }

  if (!app || !interviews || !notes) {
    return (
      <main className="page narrow">
        <BackLink to={back.to} label={back.label} />
        {error ? <div className="alert">{error}</div> : <p className="muted">Loading...</p>}
      </main>
    )
  }

  const handleDelete = async () => {
    if (!confirm('Delete this application? Its interviews and notes will be deleted too.')) return
    setDeleting(true)
    setError('')
    try {
      await deleteApplication(app.id)
      navigate(back.to)
    } catch (err) {
      setError(errorText(err))
      setDeleting(false)
    }
  }

  const empty = <span className="muted">-</span>

  return (
    <main className="page narrow">
      <BackLink to={back.to} label={back.label} />

      {error && <div className="alert">{error}</div>}

      <section className="card">
        <div className="section-header">
          <div>
            <h1>{app.jobTitle}</h1>
            <p className="muted">
              {app.company.name} - {app.location}
            </p>
          </div>
          <div className="actions">
            <Link to={`/applications/${app.id}/edit`} state={location.state} className="btn">
              Edit
            </Link>
            <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
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
          <dd>{app.salary || empty}</dd>
          <dt>Date applied</dt>
          <dd>{app.dateApplied ? formatDate(app.dateApplied) : empty}</dd>
          <dt>Job posting</dt>
          <dd>
            {app.jobPostingUrl ? (
              <a href={app.jobPostingUrl} target="_blank" rel="noreferrer">
                {app.jobPostingUrl}
              </a>
            ) : (
              empty
            )}
          </dd>
          <dt>Description</dt>
          <dd>{app.description || empty}</dd>
        </dl>
      </section>

      <InterviewsSection
        applicationId={app.id}
        interviews={interviews}
        onAdd={(i) => setInterviews((list) => [...(list ?? []), i].sort(byScheduledAt))}
        onReplace={(i) => setInterviews((list) => (list ?? []).map((x) => (x.id === i.id ? i : x)))}
        onDelete={(iid) => setInterviews((list) => (list ?? []).filter((i) => i.id !== iid))}
      />

      <NotesSection
        applicationId={app.id}
        notes={notes}
        onAdd={(n) => setNotes((list) => [n, ...(list ?? [])])}
        onReplace={(n) => setNotes((list) => (list ?? []).map((x) => (x.id === n.id ? n : x)))}
        onDelete={(nid) => setNotes((list) => (list ?? []).filter((n) => n.id !== nid))}
      />
    </main>
  )
}

function InterviewsSection({
  applicationId,
  interviews,
  onAdd,
  onReplace,
  onDelete,
}: {
  applicationId: number
  interviews: Interview[]
  onAdd: (i: Interview) => void
  onReplace: (i: Interview) => void
  onDelete: (id: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [scheduledAt, setScheduledAt] = useState('')
  const [type, setType] = useState<InterviewType>('PHONE')
  const [outcome, setOutcome] = useState<InterviewOutcome>('SCHEDULED')
  const [roundName, setRoundName] = useState('')
  const [interviewerName, setInterviewerName] = useState('')
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  // Interviews with a write in flight: an outcome change or a delete.
  const [pending, setPending] = useState<number[]>([])

  const reset = () => {
    setScheduledAt('')
    setType('PHONE')
    setOutcome('SCHEDULED')
    setRoundName('')
    setInterviewerName('')
    setOpen(false)
  }

  const track = async (iid: number, write: () => Promise<void>) => {
    setPending((ids) => [...ids, iid])
    setError('')
    try {
      await write()
    } catch (err) {
      setError(errorText(err))
    } finally {
      setPending((ids) => ids.filter((x) => x !== iid))
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setAdding(true)
    setError('')
    try {
      // datetime-local has no offset. toISOString sends it as UTC.
      const created = await createInterview(applicationId, {
        scheduledAt: new Date(scheduledAt).toISOString(),
        type,
        outcome,
        roundName,
        interviewerName,
      })
      onAdd(created)
      reset()
    } catch (err) {
      setError(errorText(err))
    } finally {
      setAdding(false)
    }
  }

  // On failure the select keeps the outcome it had, since state only changes on 200.
  const changeOutcome = (i: Interview, next: InterviewOutcome) =>
    track(i.id, async () => onReplace(await updateInterviewOutcome(applicationId, i.id, next)))

  const remove = (i: Interview) => {
    if (!confirm('Delete this interview?')) return
    track(i.id, async () => {
      await deleteInterview(applicationId, i.id)
      onDelete(i.id)
    })
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

      {error && <div className="alert">{error}</div>}

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
            <button type="submit" className="btn btn-primary" disabled={adding}>
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
                  {[i.roundName, i.interviewerName].filter(Boolean).join(' - ') || 'No round details'}
                </div>
              </div>
              <div className="list-row-meta">
                <span className="tag">{label(i.type)}</span>
                <select
                  aria-label="Outcome"
                  className={`btn-sm outcome-${i.outcome.toLowerCase()}`}
                  value={i.outcome}
                  disabled={pending.includes(i.id)}
                  onChange={(e) => changeOutcome(i, e.target.value as InterviewOutcome)}
                >
                  {INTERVIEW_OUTCOMES.map((o) => (
                    <option key={o} value={o}>
                      {label(o)}
                    </option>
                  ))}
                </select>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={pending.includes(i.id)}
                  onClick={() => remove(i)}
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
  onReplace,
  onDelete,
}: {
  applicationId: number
  notes: Note[]
  onAdd: (n: Note) => void
  onReplace: (n: Note) => void
  onDelete: (id: number) => void
}) {
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editText, setEditText] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const run = async (write: () => Promise<void>) => {
    setBusy(true)
    setError('')
    try {
      await write()
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  const handleAdd = (e: FormEvent) => {
    e.preventDefault()
    if (!draft.trim()) return
    run(async () => {
      onAdd(await createNote(applicationId, draft.trim()))
      setDraft('')
    })
  }

  const saveEdit = (e: FormEvent) => {
    e.preventDefault()
    if (editingId === null || !editText.trim()) return
    const nid = editingId
    run(async () => {
      onReplace(await updateNote(applicationId, nid, editText.trim()))
      setEditingId(null)
    })
  }

  const remove = (nid: number) => {
    if (!confirm('Delete this note?')) return
    run(async () => {
      await deleteNote(applicationId, nid)
      onDelete(nid)
    })
  }

  return (
    <section className="card">
      <h2>Notes</h2>

      {error && <div className="alert">{error}</div>}

      {notes.length === 0 && <p className="muted">No notes yet.</p>}

      <ul className="notes">
        {notes.map((n) => (
          <li key={n.id} className="note">
            {editingId === n.id ? (
              <form onSubmit={saveEdit}>
                <textarea rows={3} value={editText} onChange={(e) => setEditText(e.target.value)} />
                <div className="actions">
                  <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
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
                    {Date.parse(n.updatedAt) > Date.parse(n.createdAt) && (
                      <> - Edited {formatDateTime(n.updatedAt)}</>
                    )}
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
                    <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => remove(n.id)}>
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
        <button type="submit" className="btn btn-primary" disabled={busy || !draft.trim()}>
          Add note
        </button>
      </form>
    </section>
  )
}
