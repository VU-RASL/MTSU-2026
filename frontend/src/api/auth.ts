import { api } from './http'
import { supabase } from '../supabase'

export type CurrentUser = {
  id: string
  role: 'student' | 'educator' | 'admin'
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error) {
    throw new Error(`Could not read the login session: ${error.message}`)
  }
  if (!session) return null

  return api<CurrentUser>('/api/auth/me')
}
