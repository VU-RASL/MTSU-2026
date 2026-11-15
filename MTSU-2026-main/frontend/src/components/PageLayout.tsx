
import type { ReactNode } from 'react'
import Header from './Header'
import Footer from './Footer'

type PageLayoutProps = {
  children: ReactNode
}

export default function PageLayout({ children }: PageLayoutProps) {
  return (
    <>
      <Header />
      <main className="content">
        {children}
      </main>
      <Footer />
    </>
  )
}
