import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  FlatList, StyleSheet, Alert, ActivityIndicator, Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import CountryPickerModal from '../components/CountryPickerModal';

const STATUS_OPTIONS = ['active', 'scheduled', 'ended', 'cancelled'];
const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'One-time' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'hourly_1', label: 'Every 1h' },
  { value: 'hourly_2', label: 'Every 2h' },
];

export default function ManageEventScreen({ route, navigation }) {
  const { eventId } = route.params;
  const { session, profile } = useAuth();
  const insets = useSafeAreaInsets();
  const isAdmin = profile?.role === 'admin';

  const [event, setEvent] = useState(null);
  const [tab, setTab] = useState('guests');
  const [loading, setLoading] = useState(true);

  // Edit form
  const [form, setForm] = useState({
    title: '', description: '', date: new Date(), venue: '', city: '',
    capacity: '', price: '', status: 'active', maps_url: '', meet_link: '',
    recurrence: 'none', target_country: '',
  });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [saveMsgType, setSaveMsgType] = useState('success');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);

  // Guest roster
  const [guests, setGuests] = useState([]);
  const [guestsLoading, setGuestsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [kickingId, setKickingId] = useState(null);

  useEffect(() => {
    fetchEvent();
    fetchGuests();

    const channel = supabase
      .channel(`admin_rsvps_${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rsvps', filter: `event_id=eq.${eventId}` }, fetchGuests)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [eventId]);

  async function fetchEvent() {
    setLoading(true);
    const { data } = await supabase.from('events').select('*').eq('id', eventId).maybeSingle();
    if (!data) { navigation.goBack(); return; }
    setEvent(data);
    navigation.setOptions({ headerTitle: data.title });
    const d = new Date(data.date);
    setForm({
      title: data.title ?? '',
      description: data.description ?? '',
      date: d,
      venue: data.venue ?? '',
      city: data.city ?? '',
      capacity: String(data.capacity ?? ''),
      price: data.price != null ? String(data.price) : '',
      status: data.status ?? 'active',
      maps_url: data.maps_url ?? '',
      meet_link: data.meet_link ?? '',
      recurrence: data.recurrence ?? 'none',
      target_country: data.target_country ?? '',
    });
    setLoading(false);
  }

  async function fetchGuests() {
    setGuestsLoading(true);
    const { data } = await supabase
      .from('rsvps')
      .select('id, checked_in, created_at, user_id, profiles(full_name, username)')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });
    setGuests(data ?? []);
    setGuestsLoading(false);
  }

  async function saveEvent() {
    if (!form.title.trim() || !form.venue.trim() || !form.capacity) {
      Alert.alert('Missing fields', 'Title, venue and capacity are required.');
      return;
    }
    setSaving(true); setSaveMsg('');
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      date: form.date.toISOString(),
      venue: form.venue.trim(),
      city: form.city.trim() || null,
      capacity: parseInt(form.capacity),
      price: form.price !== '' ? parseFloat(form.price) : null,
      status: form.status,
      maps_url: form.maps_url.trim() || null,
      meet_link: form.meet_link.trim() || null,
      recurrence: form.recurrence,
      target_country: form.target_country || null,
    };
    const { error } = await supabase.from('events').update(payload).eq('id', eventId);
    if (error) { setSaveMsgType('error'); setSaveMsg(error.message); }
    else { setSaveMsgType('success'); setSaveMsg('✓ Changes saved!'); setTimeout(() => setSaveMsg(''), 3000); }
    setSaving(false);
  }

  async function toggleCheckIn(rsvpId, current) {
    await supabase.from('rsvps').update({ checked_in: !current }).eq('id', rsvpId);
    setGuests(prev => prev.map(g => g.id === rsvpId ? { ...g, checked_in: !current } : g));
  }

  async function kickGuest(rsvpId, name) {
    Alert.alert('Remove Guest', `Remove ${name} from this event?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          setKickingId(rsvpId);
          await supabase.from('rsvps').delete().eq('id', rsvpId);
          setGuests(prev => prev.filter(g => g.id !== rsvpId));
          setKickingId(null);
        },
      },
    ]);
  }

  const filteredGuests = guests.filter(g =>
    !search ||
    (g.profiles?.full_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (g.profiles?.username ?? '').toLowerCase().includes(search.toLowerCase())
  );
  const checkedInCount = guests.filter(g => g.checked_in).length;

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#6c47ff" />
    </View>
  );

  const dateLabel = form.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const timeLabel = form.date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  return (
    <>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Tab toggle */}
        <View style={styles.tabBar}>
          {[{ key: 'guests', label: '👥 Guests' }, { key: 'edit', label: '✏️ Edit' }].map(t => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}
              onPress={() => setTab(t.key)}
            >
              <Text style={[styles.tabBtnText, tab === t.key && styles.tabBtnTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Guest Roster ── */}
        {tab === 'guests' && (
          <View style={styles.flex}>
            <View style={styles.guestHeader}>
              <Text style={styles.guestCount}>{guests.length} / {event?.capacity} guests</Text>
              <Text style={styles.checkedInCount}>{checkedInCount} checked in</Text>
            </View>

            {/* Check-in progress bar */}
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: guests.length ? `${(checkedInCount / guests.length) * 100}%` : '0%' }]} />
            </View>

            <View style={styles.searchBox}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search guests…"
                placeholderTextColor="#555"
                value={search}
                onChangeText={setSearch}
              />
            </View>

            {guestsLoading ? (
              <ActivityIndicator style={{ marginTop: 32 }} color="#6c47ff" />
            ) : (
              <FlatList
                data={filteredGuests}
                keyExtractor={item => item.id}
                renderItem={({ item: g }) => (
                  <View style={styles.guestRow}>
                    <TouchableOpacity
                      style={[styles.checkBox, g.checked_in && styles.checkBoxChecked]}
                      onPress={() => toggleCheckIn(g.id, g.checked_in)}
                    >
                      {g.checked_in && <Text style={styles.checkMark}>✓</Text>}
                    </TouchableOpacity>
                    <View style={styles.guestInfo}>
                      <Text style={styles.guestName}>{g.profiles?.full_name ?? 'Unknown'}</Text>
                      <Text style={styles.guestUsername}>@{g.profiles?.username ?? '—'}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.kickBtn}
                      onPress={() => kickGuest(g.id, g.profiles?.full_name ?? 'this guest')}
                      disabled={kickingId === g.id}
                    >
                      <Text style={styles.kickBtnText}>{kickingId === g.id ? '…' : 'Kick'}</Text>
                    </TouchableOpacity>
                  </View>
                )}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                ListEmptyComponent={
                  <Text style={styles.noGuests}>{search ? 'No guests match your search' : 'No guests yet'}</Text>
                }
                contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        )}

        {/* ── Edit Event ── */}
        {tab === 'edit' && (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[styles.editScroll, { paddingBottom: insets.bottom + 32 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Title */}
            <View style={styles.field}>
              <Text style={styles.label}>Title <Text style={styles.req}>*</Text></Text>
              <TextInput style={styles.input} value={form.title} onChangeText={v => setForm(f => ({ ...f, title: v }))} placeholder="Event title" placeholderTextColor="#444" />
            </View>

            {/* Description */}
            <View style={styles.field}>
              <Text style={styles.label}>Description</Text>
              <TextInput style={[styles.input, styles.textArea]} value={form.description} onChangeText={v => setForm(f => ({ ...f, description: v }))} placeholder="Tell guests what to expect…" placeholderTextColor="#444" multiline numberOfLines={3} textAlignVertical="top" maxLength={500} />
            </View>

            {/* Date & Time pickers */}
            <View style={styles.row}>
              <View style={[styles.field, styles.flex]}>
                <Text style={styles.label}>Date <Text style={styles.req}>*</Text></Text>
                <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowDatePicker(true)}>
                  <Text style={styles.pickerBtnText}>📅  {dateLabel}</Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.field, styles.flex]}>
                <Text style={styles.label}>Time <Text style={styles.req}>*</Text></Text>
                <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowTimePicker(true)}>
                  <Text style={styles.pickerBtnText}>🕐  {timeLabel}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Venue & City */}
            <View style={styles.row}>
              <View style={[styles.field, styles.flex]}>
                <Text style={styles.label}>Venue <Text style={styles.req}>*</Text></Text>
                <TextInput style={styles.input} value={form.venue} onChangeText={v => setForm(f => ({ ...f, venue: v }))} placeholder="The Grand Hall" placeholderTextColor="#444" />
              </View>
              <View style={[styles.field, styles.flex]}>
                <Text style={styles.label}>City</Text>
                <TextInput style={styles.input} value={form.city} onChangeText={v => setForm(f => ({ ...f, city: v }))} placeholder="Berlin" placeholderTextColor="#444" />
              </View>
            </View>

            {/* Capacity & Price */}
            <View style={styles.row}>
              <View style={[styles.field, styles.flex]}>
                <Text style={styles.label}>Capacity <Text style={styles.req}>*</Text></Text>
                <TextInput style={styles.input} value={form.capacity} onChangeText={v => setForm(f => ({ ...f, capacity: v }))} placeholder="50" placeholderTextColor="#444" keyboardType="numeric" />
              </View>
              <View style={[styles.field, styles.flex]}>
                <Text style={styles.label}>Price (€)</Text>
                <TextInput style={styles.input} value={form.price} onChangeText={v => setForm(f => ({ ...f, price: v }))} placeholder="0.00 = free" placeholderTextColor="#444" keyboardType="decimal-pad" />
              </View>
            </View>

            {/* Status */}
            <View style={styles.field}>
              <Text style={styles.label}>Status</Text>
              <View style={styles.statusRow}>
                {STATUS_OPTIONS.map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.statusChip, form.status === s && styles.statusChipActive]}
                    onPress={() => setForm(f => ({ ...f, status: s }))}
                  >
                    <Text style={[styles.statusChipText, form.status === s && styles.statusChipTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Recurrence */}
            <View style={styles.field}>
              <Text style={styles.label}>Recurrence</Text>
              <View style={styles.statusRow}>
                {RECURRENCE_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.statusChip, form.recurrence === opt.value && styles.statusChipActive]}
                    onPress={() => setForm(f => ({ ...f, recurrence: opt.value }))}
                  >
                    <Text style={[styles.statusChipText, form.recurrence === opt.value && styles.statusChipTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Target Country */}
            <View style={styles.field}>
              <Text style={styles.label}>Target Country <Text style={styles.hint}>(blank = everyone)</Text></Text>
              <TouchableOpacity style={styles.pickerBtn} onPress={() => setCountryPickerOpen(true)}>
                <Text style={styles.pickerBtnText}>{form.target_country ? `🌍  ${form.target_country}` : '🔍  All countries'}</Text>
              </TouchableOpacity>
            </View>

            {/* Maps URL */}
            <View style={styles.field}>
              <Text style={styles.label}>Google Maps Link</Text>
              <TextInput style={styles.input} value={form.maps_url} onChangeText={v => setForm(f => ({ ...f, maps_url: v }))} placeholder="Paste map link…" placeholderTextColor="#444" autoCapitalize="none" />
            </View>

            {/* Meet Link */}
            <View style={styles.field}>
              <Text style={styles.label}>📹 Meet Link <Text style={styles.hint}>(RSVPed only)</Text></Text>
              <TextInput style={styles.input} value={form.meet_link} onChangeText={v => setForm(f => ({ ...f, meet_link: v }))} placeholder="https://meet.google.com/…" placeholderTextColor="#444" autoCapitalize="none" />
            </View>

            {saveMsg !== '' && (
              <View style={[styles.msgBox, saveMsgType === 'success' ? styles.msgSuccess : styles.msgError]}>
                <Text style={[styles.msgText, saveMsgType === 'success' ? styles.msgTextSuccess : styles.msgTextError]}>{saveMsg}</Text>
              </View>
            )}

            <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={saveEvent} disabled={saving}>
              <Text style={styles.saveBtnText}>{saving ? 'Saving…' : '💾  Save Changes'}</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>

      {/* Date picker */}
      {showDatePicker && (
        <DateTimePicker
          value={form.date}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, d) => { setShowDatePicker(false); if (d) setForm(f => ({ ...f, date: new Date(d.setHours(f.date.getHours(), f.date.getMinutes())) })); }}
        />
      )}
      {showTimePicker && (
        <DateTimePicker
          value={form.date}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, d) => { setShowTimePicker(false); if (d) setForm(f => { const nd = new Date(f.date); nd.setHours(d.getHours(), d.getMinutes()); return { ...f, date: nd }; }); }}
        />
      )}

      <CountryPickerModal
        visible={countryPickerOpen}
        value={form.target_country}
        onSelect={c => setForm(f => ({ ...f, target_country: c }))}
        onClose={() => setCountryPickerOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  center: { flex: 1, backgroundColor: '#0f0f0f', justifyContent: 'center', alignItems: 'center' },
  flex: { flex: 1 },

  tabBar: { flexDirection: 'row', gap: 6, margin: 14, padding: 4, backgroundColor: '#1a1a1a', borderRadius: 14 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabBtnActive: { backgroundColor: '#6c47ff' },
  tabBtnText: { color: '#555', fontSize: 13, fontWeight: '700' },
  tabBtnTextActive: { color: '#fff' },

  // Guest roster
  guestHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 8 },
  guestCount: { color: '#fff', fontSize: 13, fontWeight: '700' },
  checkedInCount: { color: '#4ade80', fontSize: 12 },
  progressTrack: { height: 4, backgroundColor: '#1f1f1f', marginHorizontal: 16, borderRadius: 4, overflow: 'hidden', marginBottom: 12 },
  progressFill: { height: 4, backgroundColor: '#4ade80', borderRadius: 4 },
  searchBox: { marginHorizontal: 16, marginBottom: 10 },
  searchInput: { backgroundColor: '#1a1a1a', borderRadius: 12, borderWidth: 1, borderColor: '#2a2a2a', paddingHorizontal: 14, paddingVertical: 10, color: '#fff', fontSize: 14 },
  guestRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  checkBox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#333', alignItems: 'center', justifyContent: 'center' },
  checkBoxChecked: { backgroundColor: '#22c55e', borderColor: '#22c55e' },
  checkMark: { color: '#fff', fontSize: 12, fontWeight: '800' },
  guestInfo: { flex: 1 },
  guestName: { color: '#fff', fontSize: 14, fontWeight: '600' },
  guestUsername: { color: '#555', fontSize: 12, marginTop: 1 },
  kickBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: 'rgba(127,29,29,0.3)' },
  kickBtnText: { color: '#f87171', fontSize: 12, fontWeight: '600' },
  separator: { height: 1, backgroundColor: '#1a1a1a', marginLeft: 64 },
  noGuests: { textAlign: 'center', color: '#555', fontSize: 14, paddingTop: 40 },

  // Edit form
  editScroll: { padding: 16, gap: 14 },
  field: { gap: 6 },
  row: { flexDirection: 'row', gap: 12 },
  label: { color: '#888', fontSize: 12, fontWeight: '600' },
  req: { color: '#ef4444' },
  hint: { color: '#444', fontWeight: '400' },
  input: { backgroundColor: '#1a1a1a', borderRadius: 12, borderWidth: 1, borderColor: '#2a2a2a', paddingHorizontal: 14, paddingVertical: 12, color: '#fff', fontSize: 14 },
  textArea: { height: 80, paddingTop: 12 },
  pickerBtn: { backgroundColor: '#1a1a1a', borderRadius: 12, borderWidth: 1, borderColor: '#2a2a2a', paddingHorizontal: 14, paddingVertical: 12 },
  pickerBtnText: { color: '#ccc', fontSize: 14 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a' },
  statusChipActive: { backgroundColor: '#6c47ff', borderColor: '#6c47ff' },
  statusChipText: { color: '#666', fontSize: 12, fontWeight: '600' },
  statusChipTextActive: { color: '#fff' },
  msgBox: { borderRadius: 12, padding: 12, borderWidth: 1 },
  msgSuccess: { backgroundColor: 'rgba(20,83,45,0.2)', borderColor: 'rgba(22,101,52,0.4)' },
  msgError: { backgroundColor: 'rgba(127,29,29,0.2)', borderColor: 'rgba(153,27,27,0.4)' },
  msgText: { fontSize: 13 },
  msgTextSuccess: { color: '#4ade80' },
  msgTextError: { color: '#f87171' },
  saveBtn: { backgroundColor: '#6c47ff', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
