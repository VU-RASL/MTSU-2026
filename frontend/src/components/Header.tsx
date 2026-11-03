import { useState } from 'react'

const Header: React.FC = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false)

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
                        <li className="header-nav-item"><a href="/">Home</a></li>
                        <li className="header-nav-item"><a href="/persona-creator">Create Persona</a></li>
                        <li className="header-nav-item"><a href="/student-portal">Student Portal</a></li>
                        <li className="header-nav-item"><a href="/learning">Learning</a></li>
                        <li className="header-nav-item"><a href="/educator-portal">Educator Portal</a></li>
                    </ul>
                </nav>
            </div>
        </header>
    )
}

export default Header
