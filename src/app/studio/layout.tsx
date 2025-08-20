import StudioClientLayout from '@/components/studio-client-layout'
import { cookies } from 'next/headers'
import { PropsWithChildren } from 'react'

export default async function Layout({ children }: PropsWithChildren) {
  const cookieStore = await cookies()
  const sidebarWidth = cookieStore.get('sidebar:width')
  const sidebarState = cookieStore.get('sidebar:state')

  return (
    <StudioClientLayout 
      width={sidebarWidth} 
      state={sidebarState}
    >
      {children}
    </StudioClientLayout>
  )
}