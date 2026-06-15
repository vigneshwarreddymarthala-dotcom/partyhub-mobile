import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function ProfileScreen() {
  const { profile, session } = useAuth();

  async function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.name}>{profile?.full_name || 'User'}</Text>
      <Text style={styles.email}>{session?.user?.email}</Text>
      <Text style={styles.role}>{profile?.role || 'user'}</Text>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f', padding: 24, paddingTop: 60 },
  name: { fontSize: 26, fontWeight: '800', color: '#fff', marginBottom: 4 },
  email: { fontSize: 15, color: '#888', marginBottom: 4 },
  role: { fontSize: 13, color: '#6c47ff', textTransform: 'uppercase', fontWeight: '600', marginBottom: 40 },
  logoutButton: { borderWidth: 1, borderColor: '#ff4444', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 'auto' },
  logoutText: { color: '#ff4444', fontWeight: '700', fontSize: 15 },
});
