import React from 'react'
import Header from '../components/Header'
import Footer from '../components/Footer'
import './Persona.css'

const Persona: React.FC = () => {
  return (
    <>
      <Header />
      <header className="persona-header">
        <h1>Your Persona</h1>
        <p>Persona Title goes here</p>
      </header>
      <main className="content">
        <div className="persona-card">
          <h2>Name</h2>
          <p>Age, bio, summary, and goal will show up here.</p>
        </div>
      </main>
      <Footer />
    </>
  )
}

export default Persona