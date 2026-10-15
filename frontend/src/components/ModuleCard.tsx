
export type Module = {
  id: number
  title: string
  description: string
  difficulty: string
}

type ModuleCardProps = {
  module: Module
  onSelect: (id: number) => void
}

export default function ModuleCard({
  module,
  onSelect
}: ModuleCardProps) {
  return (
    <div className="module-card">
      <h3>{module.title}</h3>
      <p>{module.description}</p>
      <p>Difficulty: {module.difficulty}</p>

      <button
        type="button"
        onClick={() => onSelect(module.id)}
      >
        Select Module
      </button>
    </div>
  )
}
