import React from 'react'

const Header: React.FC = () => {
    return (
        <header className="header">
            <div className="header-content">
                <h1 className="header-title">VERA</h1>
                <nav className="header-nav">
                    <ul className="header-nav-list">
                        <li className="header-nav-item"><a href="/">Home</a></li>
                        <li className="header-nav-item"><a href="/persona-creator">Create Persona</a></li>
                    </ul>
                </nav>
            </div>
        </header>
    )
}

export default Header