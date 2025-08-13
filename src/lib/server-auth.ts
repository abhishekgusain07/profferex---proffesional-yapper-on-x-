import { auth } from './auth'
import { headers } from 'next/headers'
import 'server-only'

export async function getServerSession() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    })
    return session
  } catch (error) {
    console.error('Error getting server session:', error)
    return null
  }
}

export async function getServerUser() {
  const session = await getServerSession()
  return session?.user || null
}