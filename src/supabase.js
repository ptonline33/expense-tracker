// Supabase client — cloud backend when env vars are present,
// otherwise the app runs on localStorage (localhost dev).
// Vercel env vars needed: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = url && anon ? createClient(url, anon) : null

// 'supabase' on Vercel (env set), 'local' on localhost (no env)
export const backend = supabase ? 'supabase' : 'local'
