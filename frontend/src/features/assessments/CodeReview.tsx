import { FileText } from 'lucide-react'
import { FormField } from '../../components/form'

export function CodePanel({ codeSnippet }: { codeSnippet: string }) {
  return (
    <section className="code-review-panel" aria-label="Code changes">
      <header>
        <FileText size={17} />
        <strong>Code changes</strong>
      </header>
      <div className="code-lines">
        {codeSnippet.split('\n').map((line, index) => {
          const added = line.startsWith('+') && !line.startsWith('+++')
          return (
            <div className={added ? 'code-line added' : 'code-line'} key={index}>
              <span className="line-number" aria-hidden="true">
                {index + 1}
              </span>
              <code>{line || ' '}</code>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export function CodeReviewAnswer({
  codeSnippet,
  answer,
  onChange,
}: {
  codeSnippet: string
  answer: string
  onChange: (answer: string) => void
}) {
  return (
    <div className="code-review-answer">
      <CodePanel codeSnippet={codeSnippet} />
      <FormField label="Review comment" htmlFor="review-comment">
        <textarea
          id="review-comment"
          rows={7}
          value={answer}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Describe issues, suggestions, and approval notes…"
        />
      </FormField>
    </div>
  )
}
