export interface FooterLink {
  label: string
  href: string
}

export interface FooterLinkGroup {
  title: string
  links: FooterLink[]
}

export const footerLinkGroups: FooterLinkGroup[] = [
  {
    title: 'Sitemap',
    links: [
      { label: 'Jobs', href: '/jobs' },
      { label: 'Participants', href: '/participants' },
      { label: 'Question library', href: '/questions' },
    ],
  },
  {
    title: 'Useful links',
    links: [
      { label: 'Your inbox', href: '/inbox' },
      { label: 'Calendar', href: '/calendar' },
      { label: 'Your profile', href: '/profile' },
      { label: 'Interview team', href: '/users' },
    ],
  },
]
