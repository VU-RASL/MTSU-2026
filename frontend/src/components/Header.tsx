import { useEffect, useState } from 'react'
import { getCurrentUser } from '../api/auth'
import type { CurrentUser } from '../api/auth'

type HeaderProps = {
    variant?: 'application' | 'public'
}

const Header: React.FC<HeaderProps> = ({ variant = 'application' }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const [user, setUser] = useState<CurrentUser | null>(null)
    const [loadingUser, setLoadingUser] = useState(variant !== 'public')
    const [userError, setUserError] = useState('')

    useEffect(() => {
        if (variant === 'public') return

        let isActive = true
        getCurrentUser()
            .then((currentUser) => {
                if (isActive) setUser(currentUser)
            })
            .catch((cause: unknown) => {
                if (isActive) {
                    setUserError(cause instanceof Error ? cause.message : 'Could not load user role')
                }
            })
            .finally(() => {
                if (isActive) setLoadingUser(false)
            })

        return () => {
            isActive = false
        }
    }, [variant])

    const links = variant === 'public'
        ? [
            { label: 'Login', href: '/' },
            { label: 'Register', href: '/register' },
        ]
        : user?.role === 'student'
            ? [
                { label: 'Home', href: '/home' },
                { label: 'Learning', href: '/learning' },
                { label: 'Student Portal', href: '/student-portal' },
            ]
            : user?.role === 'educator' || user?.role === 'admin'
                ? [
                    { label: 'Home', href: '/home' },
                    { label: 'Educator Portal', href: '/educator-portal' },
                    { label: 'Learning', href: '/learning' },
                    { label: 'Create Persona', href: '/persona-creator' },
                    { label: 'Create Scenario', href: '/scenario-creator' },
                    { label: 'RTC', href: '/rtc' },
                ]
                : [
                    { label: 'Login', href: '/' },
                    { label: 'Register', href: '/register' },
                ]

    return (
        <header className="header">
            <div className="header-content">
                <h1 className="header-title">VERA</h1>
                <button
                    className="header-menu-toggle"
                    type="button"
                    aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                    aria-expanded={isMenuOpen}
                    aria-controls="header-navigation"
                    onClick={() => setIsMenuOpen((open) => !open)}
                >
                    <span />
                    <span />
                    <span />
                </button>
                <nav
                    className={`header-nav${isMenuOpen ? ' is-open' : ''}`}
                    id="header-navigation"
                    aria-label="Main navigation"
                >
                    <ul className="header-nav-list">
                        {loadingUser && variant !== 'public' && (
                            <li className="header-nav-item" role="status">Loading navigation…</li>
                        )}
                        {!loadingUser && links.map((link) => (
                            <li className="header-nav-item" key={link.href}>
                                <a href={link.href}>{link.label}</a>
                            </li>
                        ))}
                        {userError && (
                            <li className="header-nav-item" role="alert">
                                Could not load role-based navigation: {userError}
                            </li>
                        )}
                    </ul>
                </nav>
            </div>
        </header>
    )
}

export default Header
