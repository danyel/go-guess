import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

export function FormActions({
  saving,
  cancelTo,
  label,
}: {
  saving: boolean
  cancelTo: string
  label: string
}) {
  return (
    <div className="form-actions">
      <Link className="button ghost" to={cancelTo}>
        Cancel
      </Link>
      <button className="button primary" type="submit" disabled={saving}>
        {saving ? 'Saving…' : label}
        <ArrowRight size={17} />
      </button>
    </div>
  )
}
