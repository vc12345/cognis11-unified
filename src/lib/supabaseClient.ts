import { createClient } from '@supabase/supabase-js'

// These match the exact names we put in your .env.local file
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// This creates the single connection object used by the frontend
export const supabase = createClient(supabaseUrl, supabaseAnonKey)