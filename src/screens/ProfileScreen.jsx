import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import CountryPickerModal from '../components/CountryPickerModal';

const ROLE_COLORS = {
  admin:     { bg: 'rgba(124,58,237,0.2)', text: '#a78bfa', label: 'Admin' },
  sub_admin: { bg: 'rgba(37,99,235,0.2)',  text: '#60a5fa', label: 'Sub-Admin' },
  user:      { bg: 'rgba(30,30,30,1)',     text: '#555',    label: 'Member' },
};

export default function ProfileScreen() {
  const { session, profile, refreshProfile } = useAuth();
  const insets = useSafeAreaInsets();

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [country, setCountry] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? '');
      setUsername(profile.username ?? '');
      setBio(profile.bio ?? '');
      setCountry(profile.country ?? '');
    }
  }, [profile]);

  async function handleSave() {
    if (!fullName.trim()) { setError('Full name is required.'); return; }
    if (!username.trim()) { setError('Username is required.'); return; }

    setError(''); setSuccess(false); setLoading(true);

    const { error } = await supabase.from('profiles').upsert({
      id: session.user.id,
      full_name: fullName.trim(),
      username: username.trim(),
      bio: bio.trim(),
      country: country || null,
      role: profile?.role ?? 'user',
    });

    if (error) {
      setError(error.message.includes('unique') ? 'Username is already taken.' : error.message);
      setLoading(false);
      return;
    }

    await refreshProfile();
    setSuccess(true);
    setLoading(false);
  }

  function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  }

  const role = profile?.role ?? 'user';
  const roleStyle = ROLE_COLORS[role] ?? ROLE_COLORS.user;
  const avatarLetter = (profile?.full_name || session?.user?.email || '?')[0].toUpperCase();
  const isNewProfile = !profile;

  return (
    <>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Avatar + info */}
          <View style={styles.avatarSection}>
            <View style={styles.avatar}>
              <Text style={styles.avatarLetter}>{avatarLetter}</Text>
            </View>
            <Text style={styles.emailText}>{session?.user?.email}</Text>
            <View style={[styles.roleBadge, { backgroundColor: roleStyle.bg }]}>
              <Text style={[styles.roleBadgeText, { color: roleStyle.text }]}>{roleStyle.label}</Text>
            </View>
          </View>

          {/* Heading */}
          <Text style={styles.sectionTitle}>
            {isNewProfile ? 'Complete Your Profile' : 'Edit Profile'}
          </Text>
          <Text style={styles.sectionSubtitle}>
            {isNewProfile ? 'Set up your profile to start RSVPing to events.' : 'Update your details.'}
          </Text>

          {/* Fields */}
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Full Name <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={v => { setFullName(v); setSuccess(false); }}
                placeholder="Jane Doe"
                placeholderTextColor="#444"
                autoCapitalize="words"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Username <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={v => { setUsername(v); setSuccess(false); }}
                placeholder="janedoe"
                placeholderTextColor="#444"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Bio</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={bio}
                onChangeText={v => { setBio(v); setSuccess(false); }}
                placeholder="Tell people a bit about yourself…"
                placeholderTextColor="#444"
                multiline
                maxLength={200}
                numberOfLines={3}
                textAlignVertical="top"
              />
              <Text style={styles.charCount}>{bio.length}/200</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Country <Text style={styles.hint}>(helps show relevant events)</Text></Text>
              <TouchableOpacity
                style={styles.pickerTrigger}
                onPress={() => setCountryPickerOpen(true)}
              >
                <Text style={styles.pickerIcon}>{country ? '🌍' : '🔍'}</Text>
                <Text style={[styles.pickerText, !country && styles.pickerPlaceholder]}>
                  {country || 'Select your country…'}
                </Text>
                <Text style={styles.pickerChevron}>›</Text>
              </TouchableOpacity>
            </View>

            {/* Error / success */}
            {error !== '' && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            {success && (
              <View style={styles.successBox}>
                <Text style={styles.successText}>
                  {isNewProfile ? 'Profile created! You can now RSVP to events.' : '✓ Profile saved!'}
                </Text>
              </View>
            )}

            {/* Save */}
            <TouchableOpacity
              style={[styles.saveBtn, loading && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={loading}
            >
              <Text style={styles.saveBtnText}>{loading ? 'Saving…' : 'Save Profile'}</Text>
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Sign out */}
          <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <CountryPickerModal
        visible={countryPickerOpen}
        value={country}
        onSelect={c => { setCountry(c); setSuccess(false); }}
        onClose={() => setCountryPickerOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  content: { paddingHorizontal: 20 },

  // Avatar section
  avatarSection: { alignItems: 'center', marginBottom: 28 },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#4c1d95', alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  avatarLetter: { color: '#fff', fontSize: 30, fontWeight: '800' },
  emailText: { color: '#555', fontSize: 13, marginBottom: 8 },
  roleBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  roleBadgeText: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Heading
  sectionTitle: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 4 },
  sectionSubtitle: { color: '#555', fontSize: 13, marginBottom: 24 },

  // Form
  form: { gap: 16 },
  field: { gap: 6 },
  label: { color: '#888', fontSize: 12, fontWeight: '600' },
  required: { color: '#ef4444' },
  hint: { color: '#444', fontWeight: '400' },
  input: {
    backgroundColor: '#1a1a1a', borderRadius: 12, borderWidth: 1,
    borderColor: '#2a2a2a', paddingHorizontal: 14, paddingVertical: 12,
    color: '#fff', fontSize: 15,
  },
  textArea: { height: 90, paddingTop: 12 },
  charCount: { color: '#333', fontSize: 11, textAlign: 'right', marginTop: 2 },

  // Country picker trigger
  pickerTrigger: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#1a1a1a', borderRadius: 12, borderWidth: 1,
    borderColor: '#2a2a2a', paddingHorizontal: 14, paddingVertical: 13,
  },
  pickerIcon: { fontSize: 16 },
  pickerText: { flex: 1, color: '#fff', fontSize: 15 },
  pickerPlaceholder: { color: '#444' },
  pickerChevron: { color: '#444', fontSize: 20 },

  // Feedback
  errorBox: {
    backgroundColor: 'rgba(127,29,29,0.2)', borderWidth: 1,
    borderColor: 'rgba(153,27,27,0.4)', borderRadius: 10, padding: 12,
  },
  errorText: { color: '#f87171', fontSize: 13 },
  successBox: {
    backgroundColor: 'rgba(20,83,45,0.2)', borderWidth: 1,
    borderColor: 'rgba(22,101,52,0.4)', borderRadius: 10, padding: 12,
  },
  successText: { color: '#4ade80', fontSize: 13 },

  // Buttons
  saveBtn: {
    backgroundColor: '#6c47ff', borderRadius: 14,
    paddingVertical: 15, alignItems: 'center', marginTop: 4,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  divider: { height: 1, backgroundColor: '#1a1a1a', marginVertical: 28 },

  signOutBtn: {
    borderWidth: 1, borderColor: 'rgba(127,29,29,0.5)',
    borderRadius: 14, paddingVertical: 14, alignItems: 'center',
  },
  signOutText: { color: '#f87171', fontSize: 15, fontWeight: '700' },
});
