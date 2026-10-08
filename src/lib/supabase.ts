import { createClient } from '@supabase/supabase-js'
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
export const isSupabaseConfigured = Boolean(url && key && !url.includes('votre-projet'))
export const supabase = createClient(url || 'https://placeholder.supabase.co', key || 'placeholder-key')
export type Profile = { id: string; full_name: string; role: 'student' | 'trainer' }
export type Course = { id: string; title: string; description: string; category: string; trainer_id: string; created_at: string; profiles?: { full_name: string } }
