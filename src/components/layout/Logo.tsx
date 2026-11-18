import { Link } from 'react-router-dom'

interface Props {
  to: string
  /** 'sky' uses the sky text color and a white tile. */
  variant?: 'surface' | 'sky'
  size?: 'md' | 'lg'
}

export function Logo({ to, variant = 'surface', size = 'md' }: Props) {
  const sky = variant === 'sky'
  return (
    <Link
      to={to}
      className={[
        'flex items-center gap-2.5 font-extrabold tracking-tight',
        size === 'lg' ? 'text-2xl' : 'text-xl',
        sky ? 'text-on-sky' : 'text-text',
      ].join(' ')}
    >
      <span
        aria-hidden
        className={[
          'grid h-[34px] w-[34px] place-items-center rounded-[10px] text-base font-extrabold',
          sky ? 'bg-cta text-cta-fg' : 'bg-accent text-accent-contrast',
        ].join(' ')}
      >
        <svg viewBox="0 0 32 32" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 8.5h22M9 8.5v14.2" />
          <path d="M16.6 15.8c-.6-.7-1.4-1-2.2-1-1.4 0-2.1.8-2.1 1.7 0 1 .8 1.4 2.2 1.8 1.4.4 2.2.9 2.2 2.1 0 1.1-.9 2-2.3 2-1 0-1.8-.4-2.3-1M19.8 12.8v9.6M19.8 17.6c0-1.7 1-2.6 2.2-2.6s2 .8 2 2.2v5.2M27.2 15.2v7.2M27.2 12.3h.01" />
        </svg>
      </span>
      {/* Icon only on narrow phones so the header stays on one line; the name is still read out. */}
      <span className="max-[420px]:sr-only">Typeshi</span>
    </Link>
  )
}
