import { ArrowLeft, Pencil, Plus, Search, X } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api/client'
import { useDomainEvent } from '../../app/useDomainEvent'
import { ErrorAlert, errorMessage, Loading } from '../../components/actions'
import { FormField } from '../../components/form'
import { EmptyState } from '../../components/ui/Display'
import { PageHeader } from '../../components/ui/PageHeader'
import { QuestionRow } from '../jobs'
import type { CreateQuestionInput, Job, Question, QuestionType } from '../../types'

export function QuestionPage() {
  const id = Number(useParams().jobId)
  const navigate = useNavigate()
  const [job, setJob] = useState<Job>()
  const [loadError, setLoadError] = useState('')
  useEffect(() => {
    void api.jobs
      .get(id)
      .then(setJob)
      .catch((value) => setLoadError(errorMessage(value)))
  }, [id])
  if (loadError) return <ErrorAlert message={loadError} />
  if (!job) return <Loading />

  async function createAndAttach(input: CreateQuestionInput) {
    const question = await api.questions.create(input)
    await api.jobs.attachQuestion(id, question.id)
    navigate(`/jobs/${id}`)
  }

  return (
    <>
      <Link className="back-link" to={`/jobs/${id}`}>
        <ArrowLeft size={17} /> {job.title}
      </Link>
      <PageHeader
        eyebrow="Assessment builder"
        title="Create a question"
        description="Create a reusable library question and attach it to this job."
      />
      <QuestionForm
        submitLabel="Create and attach question"
        onSubmit={createAndAttach}
        onCancel={() => navigate(`/jobs/${id}`)}
      />
    </>
  )
}

function QuestionForm({
  initialQuestion,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initialQuestion?: Question
  submitLabel: string
  onSubmit: (input: CreateQuestionInput) => Promise<void>
  onCancel?: () => void
}) {
  const [text, setText] = useState(initialQuestion?.text ?? '')
  const [type, setType] = useState<QuestionType>(initialQuestion?.type ?? 'open')
  const [options, setOptions] = useState(
    initialQuestion?.type === 'multiple_choice' || initialQuestion?.type === 'radio'
      ? initialQuestion.options
      : [],
  )
  const [referenceAnswer, setReferenceAnswer] = useState(initialQuestion?.referenceAnswer ?? '')
  const [codeSnippet, setCodeSnippet] = useState(
    initialQuestion?.type === 'code_review' ? initialQuestion.codeSnippet : '',
  )
  const [optionDraft, setOptionDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const choiceType = type === 'multiple_choice' || type === 'radio'

  function changeType(nextType: QuestionType) {
    setType(nextType)
    setError('')
    if (nextType === 'open' || nextType === 'code_review') {
      setOptions([])
      setOptionDraft('')
    } else {
      setReferenceAnswer('')
    }
    if (nextType !== 'code_review') setCodeSnippet('')
  }

  function addOption() {
    const option = optionDraft.trim()
    if (!option) return
    setOptions((current) => [...current, option])
    setOptionDraft('')
    setError('')
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (choiceType && options.length < 2) {
      setError('Add at least two options before saving this question.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSubmit({
        text: text.trim(),
        type,
        options: choiceType ? options : [],
        referenceAnswer: choiceType ? '' : referenceAnswer.trim(),
        codeSnippet: type === 'code_review' ? codeSnippet : '',
      })
      if (!initialQuestion) {
        setText('')
        setType('open')
        setOptions([])
        setOptionDraft('')
        setReferenceAnswer('')
        setCodeSnippet('')
      }
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="card form-card library-form" onSubmit={submit}>
      <div className="form-section">
        <h2>{initialQuestion ? 'Edit question' : 'Create question'}</h2>
        <FormField label="Question prompt" htmlFor="question-form-text">
          <textarea
            id="question-form-text"
            name="text"
            rows={type === 'code_review' ? 10 : 5}
            value={text}
            onChange={(event) => setText(event.target.value)}
            required
          />
        </FormField>
        <FormField label="Response type" htmlFor="question-form-type">
          <select
            id="question-form-type"
            value={type}
            onChange={(event) => changeType(event.target.value as QuestionType)}
          >
            <option value="open">Open answer</option>
            <option value="multiple_choice">Multiple choice</option>
            <option value="radio">Single choice</option>
            <option value="code_review">Code review</option>
          </select>
        </FormField>
        {type === 'code_review' && (
          <FormField label="Code snippet" htmlFor="question-form-code-snippet">
            <textarea
              id="question-form-code-snippet"
              rows={12}
              value={codeSnippet}
              onChange={(event) => setCodeSnippet(event.target.value)}
              required
            />
          </FormField>
        )}
        {!choiceType && (
          <FormField
            label={type === 'code_review' ? 'Expected answer' : 'Reference answer'}
            htmlFor="question-form-reference-answer"
          >
            <textarea
              id="question-form-reference-answer"
              rows={5}
              value={referenceAnswer}
              onChange={(event) => setReferenceAnswer(event.target.value)}
            />
          </FormField>
        )}
        {choiceType && (
          <fieldset className="option-builder">
            <legend className="field-label">Answer options</legend>
            <div className="option-entry">
              <input
                aria-label="New option"
                value={optionDraft}
                onChange={(event) => setOptionDraft(event.target.value)}
                placeholder="Type an option"
              />
              <button
                className="button secondary option-add"
                type="button"
                onClick={addOption}
                disabled={!optionDraft.trim()}
                aria-label="Add option"
              >
                <Plus size={18} />
              </button>
            </div>
            <div className="option-list" aria-live="polite">
              {options.map((option, index) => (
                <div className="option-item" key={`${option}-${index}`}>
                  <span>{option}</span>
                  <button
                    className="icon-button"
                    type="button"
                    onClick={() =>
                      setOptions((current) => current.filter((_, itemIndex) => itemIndex !== index))
                    }
                    aria-label={`Remove option ${option}`}
                  >
                    <X size={17} />
                  </button>
                </div>
              ))}
            </div>
            <small className="field-hint">Add at least two options.</small>
          </fieldset>
        )}
        {error && <ErrorAlert message={error} />}
        <div className="question-form-actions">
          {onCancel && (
            <button className="button ghost" type="button" onClick={onCancel} disabled={saving}>
              Cancel
            </button>
          )}
          <button className="button primary" type="submit" disabled={saving}>
            {saving ? 'Saving…' : submitLabel}
          </button>
        </div>
      </div>
    </form>
  )
}

export function QuestionLibraryPage() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Question>()
  const [formVersion, setFormVersion] = useState(0)
  const [error, setError] = useState('')

  async function load(search = query) {
    setError('')
    try {
      setQuestions(await api.questions.list(search))
    } catch (requestError) {
      setError(errorMessage(requestError))
    }
  }

  useEffect(() => {
    let active = true
    const timeout = window.setTimeout(() => {
      void api.questions
        .list(query)
        .then((items) => {
          if (active) setQuestions(items)
        })
        .catch((requestError) => {
          if (active) setError(errorMessage(requestError))
        })
    }, 200)
    return () => {
      active = false
      window.clearTimeout(timeout)
    }
  }, [query])

  useDomainEvent<Question>('questions', (event) => {
    setQuestions((current) => {
      const existing = current.some((question) => question.id === event.data.id)
      return existing
        ? current.map((question) => (question.id === event.data.id ? event.data : question))
        : [event.data, ...current]
    })
    setEditing((current) => (current?.id === event.data.id ? event.data : current))
  })

  async function create(input: CreateQuestionInput) {
    await api.questions.create(input)
    setFormVersion((current) => current + 1)
  }

  async function update(input: CreateQuestionInput) {
    if (!editing) return
    await api.questions.update(editing.id, input)
    setEditing(undefined)
  }

  async function toggle(question: Question) {
    setError('')
    try {
      await api.questions.setDeprecated(question.id, !question.deprecated)
    } catch (requestError) {
      setError(errorMessage(requestError))
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Assessment builder"
        title="Question library"
        description="Create reusable interview questions and retire questions without deleting them."
      />
      {error && <ErrorAlert message={error} retry={load} />}
      <div className="library-grid">
        <section className="card">
          <div className="toolbar">
            <label className="search-field">
              <Search size={18} />
              <span className="sr-only">Search questions</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search questions…"
              />
            </label>
            <span className="result-count">{questions.length} questions</span>
          </div>
          <div className="question-list">
            {questions.map((question) => (
              <QuestionRow
                key={question.id}
                question={question}
                action={
                  <div className="library-question-actions">
                    <button
                      className="button ghost"
                      type="button"
                      onClick={() => setEditing(question)}
                      aria-label={`Edit ${question.text}`}
                    >
                      <Pencil size={16} /> Edit
                    </button>
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={question.deprecated}
                        onChange={() => void toggle(question)}
                        aria-label={`Deprecated: ${question.text}`}
                      />
                      <span>Deprecated</span>
                    </label>
                  </div>
                }
              />
            ))}
            {!questions.length && (
              <EmptyState
                title="No questions found"
                description="Create a question or adjust your search."
              />
            )}
          </div>
        </section>
        <QuestionForm
          key={editing ? `edit-${editing.id}` : `create-${formVersion}`}
          initialQuestion={editing}
          submitLabel={editing ? 'Save changes' : 'Create question'}
          onSubmit={editing ? update : create}
          onCancel={editing ? () => setEditing(undefined) : undefined}
        />
      </div>
    </>
  )
}
