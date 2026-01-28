// supabaseClient.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import 'react-native-url-polyfill/auto'

// Env vars (ensure these are EXPO_PUBLIC_*)
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

/**
 * 1️⃣ Singleton client for public queries
 * Example: fetching all videos, channels, etc.
 */
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

/**
 * 2️⃣ Function to create a per-user client with Clerk JWT
 * Example: fetching / updating user-specific data
 */
export function createSupabaseClientWithToken(token: string): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  })
}
