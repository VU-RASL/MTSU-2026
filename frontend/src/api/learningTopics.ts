export interface LearningTopic {
  id: number
  createdAt: string
  title: string
  content: string
  position: number
}

export async function listLearningTopics(): Promise<LearningTopic[]> {
  const response = await fetch('/api/learning-topics')

  if (!response.ok) {
    throw new Error('Failed to load learning topics')
  }

  return response.json()
}