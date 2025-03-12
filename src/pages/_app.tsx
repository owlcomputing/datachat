import type { AppProps } from 'next/app'
import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { SessionContextProvider, Session } from '@supabase/auth-helpers-react'
import '@/styles/globals.css'

function MyApp({ Component, pageProps }: AppProps<{ initialSession: Session }>) {
  const [supabaseClient] = useState(() => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  ))

  return (
    <SessionContextProvider 
      supabaseClient={supabaseClient} 
      initialSession={pageProps.initialSession}
    >
      <Component {...pageProps} />
    </SessionContextProvider>
  )
}

export default MyApp