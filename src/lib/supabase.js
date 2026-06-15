import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = 'https://ulfwnuwousqsmjpubdgt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsZndudXdvdXNxc21qcHViZGd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzMzgwNjIsImV4cCI6MjA5NjkxNDA2Mn0.iHjKzpAdpvjSSWIroZnmj7vzXDOI8gORTbylbJh2148';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
