
import { api } from './http'

export type Persona = {
  id: number
  title: string
  identity?: {
    name?: string
  }
}

export const listPersonas = () =>
  api<Persona[]>('/api/personas')
