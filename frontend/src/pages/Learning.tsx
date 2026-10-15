import React, { useState } from 'react'
import Header from '../components/Header'
import Footer from '../components/Footer'

const learningTopics = [
  {
    id: 1,
    title: 'What is Autism?',
    content:
      'Learn about autism spectrum disorder, common characteristics, and how autism may affect communication, behavior, and social interaction.',
  },
  {
    id: 2,
    title: 'Communication',
    content:
      'Explore communication differences and strategies for supporting effective communication with autistic individuals.',
  },
  {
    id: 3,
    title: 'Social Interaction',
    content:
      'Learn about social interaction differences and ways to create supportive and inclusive environments.',
  },
  {
    id: 4,
    title: 'Sensory Processing',
    content:
      'Understand sensory sensitivities and how different environments may affect autistic individuals.',
  },
  {
    id: 5,
    title: 'Behavior and Support',
    content:
      'Explore supportive approaches for understanding behavior and responding to individual needs.',
  },
]

const Learning: React.FC = () => {
  const [openTopic, setOpenTopic] = useState<number | null>(null)

  const toggleTopic = (id: number) => {
    setOpenTopic(openTopic === id ? null : id)
  }

  return (
    <>
      <Header />

      <div className="content">
        <div className="persona-creator">
          <h1>Learning Resources</h1>

          <p style={{ textAlign: 'center', color: 'var(--text)' }}>
            Explore educational resources and information about autism.
          </p>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              marginTop: '24px',
            }}
          >
            {learningTopics.map((topic) => (
              <div
                key={topic.id}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  backgroundColor: 'white',
                  overflow: 'hidden',
                }}
              >
                <button
                  type="button"
                  onClick={() => toggleTopic(topic.id)}
                  style={{
                    width: '100%',
                    padding: '16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    textAlign: 'left',
                  }}
                >
                  <strong>{topic.title}</strong>
                  <span>{openTopic === topic.id ? '▲' : '▼'}</span>
                </button>

                {openTopic === topic.id && (
                  <div
                    style={{
                      padding: '16px',
                      borderTop: '1px solid var(--border)',
                      color: 'var(--text)',
                    }}
                  >
                    <p style={{ margin: 0 }}>{topic.content}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <Footer />
    </>
  )
}

export default Learning