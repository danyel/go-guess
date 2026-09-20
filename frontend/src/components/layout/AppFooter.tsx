import { Link } from 'react-router-dom'
import { footerLinkGroups } from '../../config/navigation'

export function AppFooter() {
  return (
    <footer className="app-footer">
      <div className="app-footer-brand">
        <span className="logo-mark" aria-hidden="true">
          G
        </span>
        <div>
          <strong>GO GUESS</strong>
          <p>Structured interviews, shared decisions, better hiring.</p>
        </div>
      </div>
      <nav className="footer-navigation" aria-label="Footer navigation">
        {footerLinkGroups.map((group) => (
          <section key={group.title}>
            <h2>{group.title}</h2>
            {group.links.map((link) => (
              <Link to={link.href} key={link.href}>
                {link.label}
              </Link>
            ))}
          </section>
        ))}
      </nav>
      <p className="footer-meta">Go Guess recruitment workspace</p>
    </footer>
  )
}
