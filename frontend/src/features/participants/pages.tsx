import {
  ArrowLeft,
  Check,
  ChevronRight,
  FileText,
  Plus,
  Search,
  Upload,
  UserRound,
} from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api/client'
import { useData } from '../../app/useData'
import { ErrorAlert, errorMessage, Loading } from '../../components/actions'
import { FormActions, FormField } from '../../components/form'
import { EmptyState, Fact } from '../../components/ui/Display'
import { PageHeader } from '../../components/ui/PageHeader'
import type { Participant } from '../../types'

export function ParticipantsPage() {
  const { participants, loading, error, reload } = useData()
  const [query, setQuery] = useState('')
  const filtered = participants.filter((person) =>
    `${person.firstName} ${person.lastName} ${person.email} ${person.traits.join(' ')}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  )
  return (
    <>
      <PageHeader
        eyebrow="Talent pool"
        title="Participants"
        description="Manage candidate profiles and application documents."
        action={
          <Link to="/participants/new" className="button primary">
            <Plus size={18} /> Add participant
          </Link>
        }
      />
      {error && <ErrorAlert message={error} retry={reload} />}
      <section className="card">
        <div className="toolbar">
          <label className="search-field">
            <Search size={18} />
            <span className="sr-only">Search participants</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search people or traits…"
            />
          </label>
          <span className="result-count">{filtered.length} participants</span>
        </div>
        {loading ? (
          <Loading />
        ) : (
          <div className="people-grid">
            {filtered.map((person) => (
              <Link className="person-card" to={`/participants/${person.id}`} key={person.id}>
                <Avatar person={person} large />
                <div>
                  <h2>
                    {person.firstName} {person.lastName}
                  </h2>
                  <p>{person.email}</p>
                  <small>{person.contactInfo}</small>
                </div>
                <div className="tag-list">
                  {person.traits.slice(0, 3).map((trait) => (
                    <span key={trait}>{trait}</span>
                  ))}
                </div>
                <ChevronRight className="person-arrow" />
              </Link>
            ))}
          </div>
        )}
        {!loading && !filtered.length && !error && (
          <EmptyState
            title="No participants found"
            description="Add a participant or adjust your search."
          />
        )}
      </section>
    </>
  )
}

export function CreateParticipantPage() {
  const { createParticipant } = useData()
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [photoPreview, setPhotoPreview] = useState('')
  const [photo, setPhoto] = useState<File>()
  const [cv, setCv] = useState<File>()

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    const form = new FormData(event.currentTarget)
    try {
      const person = await createParticipant({
        firstName: String(form.get('firstName')),
        lastName: String(form.get('lastName')),
        birthday: String(form.get('birthday')),
        email: String(form.get('email')),
        contactInfo: String(form.get('contactInfo')),
        photo,
        cv,
      })
      navigate(`/participants/${person.id}`)
    } catch (requestError) {
      setError(errorMessage(requestError))
      setSaving(false)
    }
  }

  return (
    <>
      <Link className="back-link" to="/participants">
        <ArrowLeft size={17} /> Cancel
      </Link>
      <PageHeader
        eyebrow="New profile"
        title="Add a participant"
        description="Create a candidate profile and attach application documents."
      />
      <form className="card form-card" onSubmit={submit}>
        <div className="form-section">
          <h2>Profile photo</h2>
          <div className="photo-upload">
            <span className="avatar upload-avatar">
              {photoPreview ? (
                <img src={photoPreview} alt="Selected profile preview" />
              ) : (
                <UserRound />
              )}
            </span>
            <label className="button secondary file-button">
              <Upload size={17} /> Choose photo
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  setPhoto(file)
                  if (file) setPhotoPreview(URL.createObjectURL(file))
                }}
              />
            </label>
            <small>JPG, PNG or WebP.</small>
          </div>
        </div>
        <div className="form-section">
          <h2>Personal information</h2>
          <div className="form-grid">
            <FormField label="First name" htmlFor="firstName">
              <input id="firstName" name="firstName" required />
            </FormField>
            <FormField label="Last name" htmlFor="lastName">
              <input id="lastName" name="lastName" required />
            </FormField>
            <FormField label="Birthday" htmlFor="birthday">
              <input id="birthday" name="birthday" type="date" />
            </FormField>
            <FormField label="Email address" htmlFor="email">
              <input id="email" name="email" type="email" required />
            </FormField>
          </div>
          <FormField
            label="Contact information"
            htmlFor="contactInfo"
            hint="Phone, location, or preferred contact details."
          >
            <textarea id="contactInfo" name="contactInfo" rows={3} required />
          </FormField>
        </div>
        <div className="form-section">
          <h2>Curriculum vitae</h2>
          <label className="dropzone">
            <FileText size={28} />
            <span>
              <strong>{cv?.name ?? 'Upload CV'}</strong>
              <small>PDF or Word document</small>
            </span>
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={(event) => setCv(event.target.files?.[0])}
            />
          </label>
        </div>
        {error && <ErrorAlert message={error} />}
        <FormActions saving={saving} cancelTo="/participants" label="Create participant" />
      </form>
    </>
  )
}

export function ParticipantDetailPage() {
  const id = Number(useParams().participantId)
  const [person, setPerson] = useState<Participant>()
  const [error, setError] = useState('')
  useEffect(() => {
    void api.participants
      .get(id)
      .then(setPerson)
      .catch((value) => setError(errorMessage(value)))
  }, [id])
  if (error) return <ErrorAlert message={error} />
  if (!person) return <Loading />

  async function downloadCV() {
    try {
      const blob = await api.participants.cv(id)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = person?.cvFilename ?? 'cv'
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (requestError) {
      setError(errorMessage(requestError))
    }
  }

  return (
    <>
      <Link className="back-link" to="/participants">
        <ArrowLeft size={17} /> All participants
      </Link>
      <section className="profile-hero">
        <Avatar person={person} large />
        <div>
          <span className="eyebrow">Candidate profile</span>
          <h1>
            {person.firstName} {person.lastName}
          </h1>
          <p>{person.email}</p>
        </div>
        <a className="button secondary" href={`mailto:${person.email}`}>
          Contact candidate
        </a>
      </section>
      <div className="detail-grid">
        <section className="card prose">
          <h2>Extracted traits</h2>
          <div className="tag-list large">
            {person.traits.map((trait) => (
              <span key={trait}>{trait}</span>
            ))}
          </div>
          {!person.traits.length && <p className="muted">No traits extracted.</p>}
        </section>
        <aside className="card facts">
          <h2>Contact & documents</h2>
          <Fact label="Email" value={person.email} />
          <Fact label="Contact information" value={person.contactInfo} />
          <Fact label="Birthday" value={person.birthday ?? 'Not provided'} />
          <Fact label="Created" value={new Date(person.createdAt).toLocaleDateString()} />
          {person.cvUrl && (
            <button className="document-row" type="button" onClick={downloadCV}>
              <FileText />
              <span>
                <strong>{person.cvFilename}</strong>
                <small>Download candidate CV</small>
              </span>
            </button>
          )}
        </aside>
      </div>
    </>
  )
}

export function Avatar({ person, large = false }: { person: Participant; large?: boolean }) {
  const [source, setSource] = useState('')
  useEffect(() => {
    if (!person.photoUrl) return
    let active = true
    let objectUrl = ''
    void api.participants
      .photo(person.id)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob)
        if (active) setSource(objectUrl)
      })
      .catch(() => undefined)
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [person.id, person.photoUrl])
  return (
    <span className={`avatar ${large ? 'large' : ''}`}>
      {source ? <img src={source} alt="" /> : `${person.firstName[0]}${person.lastName[0]}`}
    </span>
  )
}

export function SkillList({ skills }: { skills: string[] }) {
  return skills.length ? (
    <ul className="check-list">
      {skills.map((skill) => (
        <li key={skill}>
          <Check size={17} /> {skill}
        </li>
      ))}
    </ul>
  ) : (
    <p className="muted">None specified.</p>
  )
}
