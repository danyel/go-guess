import { Link } from 'react-router-dom'

function Logo() {
  return (
    <Link className="logo" to="/jobs" aria-label="Go Guess home">
      <span className="logo-mark" aria-hidden="true">
        G
      </span>
      <span>
        <strong>GO GUESS</strong>
        <small>Talent workspace</small>
      </span>
    </Link>
  )
}

export default Logo
