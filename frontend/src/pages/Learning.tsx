import React, { useEffect, useState } from 'react'
import Header from '../components/Header'
import Footer from '../components/Footer'
import {
  listLearningTopics,
  type LearningTopic,
} from '../api/learningTopics'

const Learning: React.FC = () => {
  const [learningTopics, setLearningTopics] = useState<LearningTopic[]>([])
  const [openTopic, setOpenTopic] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadTopics = async () => {
      try {
        const topics = await listLearningTopics()
        setLearningTopics(topics)
      } catch {
        setError('Unable to load learning resources. Please try again later.')
      } finally {
        setLoading(false)
      }
    }

    loadTopics()
  }, [])

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

          {loading && (
            <p style={{ textAlign: 'center' }}>
              Loading learning resources...
            </p>
          )}

          {error && (
            <p style={{ textAlign: 'center' }}>
              {error}
            </p>
          )}

          {!loading && !error && (
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
          )}
        </div>
      </div>

      <Footer />
    </>
  )
}

export default Learning