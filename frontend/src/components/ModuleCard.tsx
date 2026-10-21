import { useState } from 'react'

export type Module = {
  id: number
  title: string
  description: string
  difficulty: string
  objectives?: string[]
}

type ModuleCardProps = {
  module: Module
  onStart: (id: number) => void
}

export default function ModuleCard({ module, onStart }: ModuleCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const detailsId = `module-details-${module.id}`

  return (
    <article className="module-card">
      <div className="module-card-header">
        <div>
          <h3>{module.title}</h3>
          <p className="module-difficulty">{module.difficulty}</p>
        </div>
        <div className="module-actions">
          <button
            type="button"
            className="module-review-button"
            onClick={() => setIsExpanded((expanded) => !expanded)}
            aria-expanded={isExpanded}
            aria-controls={detailsId}
          >
            {isExpanded ? 'Hide Details' : 'Review'}
          </button>
          <button
            type="button"
            className="module-start-button"
            onClick={() => onStart(module.id)}
          >
            Start
          </button>
        </div>
      </div>
      {isExpanded && (
        <div id={detailsId} className="module-details">
          <h4>Module Details</h4>
          <p>{module.description}</p>
          <p><strong>Difficulty:</strong> {module.difficulty}</p>
          {module.objectives && module.objectives.length > 0 && (
            <>
              <h4>Learning Objectives (Sample)</h4>
              <ul>
                {module.objectives.map((objective) => (
                  <li key={objective}>{objective}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </article>
  )
}
