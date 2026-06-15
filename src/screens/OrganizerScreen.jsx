import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, FlatList,
  StyleSheet, Alert, ActivityIndicator, Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import CountryPickerModal from '../components/CountryPickerModal';

const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'One-time' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'hourly_1', label: 'Every 1h' },
  { value: 'hourly_2', label: 'Every 2h' },
];

const EMPTY_FORM = {
  title: '', description: '', date: new Date(), venue: '', city: '',
  capacity: '', price: '', target_country: '', maps_url: '', meet_link: '',
  recurrence: 'none',
};

export default function OrganizerScreen({ navigation }) {
  const { session, profile } = useAuth();
  const insets = useSafeAreaInsets();
  const isMainAdmin = profile?.role === 'admin';
  const isSubAdmin = profile?.role === 'sub_admin';
  const isOrganizer = isMainAdmin || isSubAdmin;

  const [tab, setTab] = useState('stats');
  const [stats, setStats] = useState({ activeEvents: 0, totalUsers: 0, totalRSVPs: 0 });
  const [events, setEvents] = useState([]);
  const [archivedEvents, setArchivedEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [archivedLoading, setArchivedLoading] = useState(false);

  // Create form
  const [form, setForm] = useState(EMPTY_FORM);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);

  useEffect(() => {
    if (isOrganizer) { fetchStats(); fetchEvents(); }
  }, [profile]);

  useEffect(() => {
    if (tab === 'archived') fetchArchivedEvents();
  }, [tab]);

  async function fetchStats() {
    if (isSubAdmin) {
      const [{ count: myEvents }, { count: myRSVPs }] = await Promise.all([
        supabase.from('events').select('*', { count: 'exact', head: true }).eq('created_by', session.user.id).eq('status', 'active'),
        supabase.from('rsvps').select('events!inner(*)', { count: 'exact', head: true }).eq('events.created_by', session.user.id),
      ]);
      setStats({ activeEvents: myEvents ?? 0, totalUsers: null, totalRSVPs: myRSVPs ?? 0 });
    } else {
      const [{ count: activeEvents }, { count: totalUsers }, { count: totalRSVPs }] = await Promise.all([
        supabase.from('events').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('rsvps').select('*', { count: 'exact', head: true }),
      ]);
      setStats({ activeEvents: activeEvents ?? 0, totalUsers: totalUsers ?? 0, totalRSVPs: totalRSVPs ?? 0 });
    }
  }

  async function fetchEvents() {
    setEventsLoading(true);
    let query = supabase
      .from('events').select('*, rsvps(id)')
      .is('deleted_at', null).order('date', { ascending: false });
    if (isSubAdmin) query = query.eq('created_by', session.user.id);
    const { data } = await query;
    setEvents(data ?? []);
    setEventsLoading(false);
  }

  async function fetchArchivedEvents() {
    setArchivedLoading(true);
    let query = supabase
      .from('events').select('*, rsvps(id)')
      .not('deleted_at', 'is', null).order('deleted_at', { ascending: false });
    if (isSubAdmin) query = query.eq('created_by', session.user.id);
    const { data } = await query;
    setArchivedEvents(data ?? []);
    setArchivedLoading(false);
  }

  async function createEvent() {
    if (!form.title.trim() || !form.venue.trim() || !form.capacity) {
      setFormError('Title, venue and capacity are required.');
      return;
    }
    setFormLoading(true); setFormError(''); setFormSuccess('');
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      date: form.date.toISOString(),
      venue: form.venue.trim(),
      city: form.city.trim() || null,
      capacity: parseInt(form.capacity),
      price: form.price !== '' ? parseFloat(form.price) : null,
      target_country: form.target_country || null,
      maps_url: form.maps_url.trim() || null,
      meet_link: form.meet_link.trim() || null,
      recurrence: form.recurrence,
      created_by: session.user.id,
    };
    const { data: insertedEvent, error } = await supabase.from('events').insert(payload).select('id').single();
    if (error) { setFormError(error.message); setFormLoading(false); return; }
    if (insertedEvent?.id) await supabase.from('chat_rooms').insert({ event_id: insertedEvent.id });
    setForm(EMPTY_FORM);
    await Promise.all([fetchStats(), fetchEvents()]);
    setFormSuccess('✓ Event created! Chat room auto-created.');
    setFormLoading(false);
    setTimeout(() => setFormSuccess(''), 4000);
  }

  async function archiveEvent(id, title) {
    Alert.alert('Archive Event', `Archive "${title}"? It will be hidden from the public.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Archive', style: 'destructive', onPress: async () => {
        await supabase.from('events').update({ deleted_at: new Date().toISOString() }).eq('id', id);
        fetchEvents(); fetchStats();
      }},
    ]);
  }

  async function restoreEvent(id) {
    await supabase.from('events').update({ deleted_at: null }).eq('id', id);
    fetchArchivedEvents(); fetchEvents(); fetchStats();
  }

  async function hardDeleteEvent(id, title) {
    Alert.alert('Delete Forever', `Permanently delete "${title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await supabase.from('events').delete().eq('id', id);
        fetchArchivedEvents(); fetchStats();
      }},
    ]);
  }

  if (!isOrganizer) {
    return (
      <View style={styles.center}>
        <Text style={styles.noAccessEmoji}>🔒</Text>
        <Text style={styles.noAccessTitle}>Organizer Access Only</Text>
        <Text style={styles.noAccessSub}>This section is for event organizers and admins.</Text>
      </View>
    );
  }

  const tabs = [
    { key: 'stats', label: '📊', title: 'Stats' },
    { key: 'create', label: '➕', title: 'Create' },
    { key: 'events', label: '🗂', title: 'Events' },
    { key: 'archived', label: '🗃', title: 'Archive' },
  ];

  const dateLabel = form.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const timeLabel = form.date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  return (
    <>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>{isMainAdmin ? '🛡️ Admin Console' : '🎉 Organizer'}</Text>
            <Text style={styles.headerSub}>Hi, {profile?.full_name}</Text>
          </View>
          <View style={[styles.roleBadge, { backgroundColor: isMainAdmin ? 'rgba(124,58,237,0.2)' : 'rgba(37,99,235,0.2)' }]}>
            <Text style={[styles.roleBadgeText, { color: isMainAdmin ? '#a78bfa' : '#60a5fa' }]}>
              {isMainAdmin ? 'Admin' : 'Sub-Admin'}
            </Text>
          </View>
        </View>

        {/* Tab bar */}
        <View style={styles.tabBar}>
          {tabs.map(t => (
            <TouchableOpacity key={t.key} style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]} onPress={() => setTab(t.key)}>
              <Text style={styles.tabEmoji}>{t.label}</Text>
              <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>{t.title}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Stats ── */}
        {tab === 'stats' && (
          <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statEmoji}>🎉</Text>
                <Text style={styles.statValue}>{stats.activeEvents}</Text>
                <Text style={styles.statLabel}>{isSubAdmin ? 'My Active Events' : 'Active Parties'}</Text>
              </View>
              {isMainAdmin && (
                <View style={styles.statCard}>
                  <Text style={styles.statEmoji}>👥</Text>
                  <Text style={styles.statValue}>{stats.totalUsers}</Text>
                  <Text style={styles.statLabel}>Total Sign-ups</Text>
                </View>
              )}
              <View style={styles.statCard}>
                <Text style={styles.statEmoji}>✅</Text>
                <Text style={styles.statValue}>{stats.totalRSVPs}</Text>
                <Text style={styles.statLabel}>{isSubAdmin ? 'My Total RSVPs' : 'Total RSVPs'}</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.quickCreateBtn} onPress={() => setTab('create')}>
              <Text style={styles.quickCreateText}>➕  Create New Event</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* ── Create Event ── */}
        {tab === 'create' && (
          <ScrollView
            contentContainerStyle={[styles.tabContent, { paddingBottom: insets.bottom + 32 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.sectionTitle}>New Event</Text>

            <View style={styles.field}>
              <Text style={styles.label}>Title <Text style={styles.req}>*</Text></Text>
              <TextInput style={styles.input} value={form.title} onChangeText={v => setForm(f => ({ ...f, title: v }))} placeholder="Summer Rooftop Party" placeholderTextColor="#444" />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Description</Text>
              <TextInput style={[styles.input, styles.textArea]} value={form.description} onChangeText={v => setForm(f => ({ ...f, description: v }))} placeholder="Tell guests what to expect…" placeholderTextColor="#444" multiline numberOfLines={3} textAlignVertical="top" maxLength={500} />
            </View>

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

            <View style={styles.row}>
              <View style={[styles.field, styles.flex]}>
                <Text style={styles.label}>Capacity <Text style={styles.req}>*</Text></Text>
                <TextInput style={styles.input} value={form.capacity} onChangeText={v => setForm(f => ({ ...f, capacity: v }))} placeholder="50" placeholderTextColor="#444" keyboardType="numeric" />
              </View>
              <View style={[styles.field, styles.flex]}>
                <Text style={styles.label}>Price (€)</Text>
                <TextInput style={styles.input} value={form.price} onChangeText={v => setForm(f => ({ ...f, price: v }))} placeholder="blank = free" placeholderTextColor="#444" keyboardType="decimal-pad" />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Target Country <Text style={styles.hint}>(blank = everyone)</Text></Text>
              <TouchableOpacity style={styles.pickerBtn} onPress={() => setCountryPickerOpen(true)}>
                <Text style={styles.pickerBtnText}>{form.target_country ? `🌍  ${form.target_country}` : '🔍  All countries'}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Google Maps Link</Text>
              <TextInput style={styles.input} value={form.maps_url} onChangeText={v => setForm(f => ({ ...f, maps_url: v }))} placeholder="Paste map link…" placeholderTextColor="#444" autoCapitalize="none" />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>📹 Meet Link <Text style={styles.hint}>(RSVPed only)</Text></Text>
              <TextInput style={styles.input} value={form.meet_link} onChangeText={v => setForm(f => ({ ...f, meet_link: v }))} placeholder="https://meet.google.com/…" placeholderTextColor="#444" autoCapitalize="none" />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Recurrence</Text>
              <View style={styles.chipRow}>
                {RECURRENCE_OPTIONS.map(opt => (
                  <TouchableOpacity key={opt.value} style={[styles.chip, form.recurrence === opt.value && styles.chipActive]} onPress={() => setForm(f => ({ ...f, recurrence: opt.value }))}>
                    <Text style={[styles.chipText, form.recurrence === opt.value && styles.chipTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {formError !== '' && <View style={[styles.msgBox, styles.msgError]}><Text style={[styles.msgText, styles.msgTextError]}>{formError}</Text></View>}
            {formSuccess !== '' && <View style={[styles.msgBox, styles.msgSuccess]}><Text style={[styles.msgText, styles.msgTextSuccess]}>{formSuccess}</Text></View>}

            <TouchableOpacity style={[styles.createBtn, formLoading && styles.createBtnDisabled]} onPress={createEvent} disabled={formLoading}>
              <Text style={styles.createBtnText}>{formLoading ? 'Creating…' : '🚀  Post Event'}</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* ── Events ── */}
        {tab === 'events' && (
          <View style={styles.flex}>
            {eventsLoading ? (
              <ActivityIndicator style={{ marginTop: 40 }} color="#6c47ff" />
            ) : events.length === 0 ? (
              <View style={styles.center}>
                <Text style={{ fontSize: 40, marginBottom: 12 }}>📭</Text>
                <Text style={styles.emptyText}>No events yet.</Text>
                <TouchableOpacity onPress={() => setTab('create')}>
                  <Text style={styles.emptyLink}>Create your first event →</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={events}
                keyExtractor={item => item.id}
                renderItem={({ item: ev }) => {
                  const rsvpCount = ev.rsvps?.length ?? 0;
                  const statusColor = ev.status === 'active' ? '#4ade80' : ev.status === 'scheduled' ? '#fbbf24' : '#555';
                  return (
                    <View style={styles.eventRow}>
                      <View style={styles.eventInfo}>
                        <Text style={styles.eventTitle} numberOfLines={1}>{ev.title}</Text>
                        <View style={styles.eventMeta}>
                          <Text style={styles.eventMetaText}>
                            {new Date(ev.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </Text>
                          <Text style={[styles.eventMetaText, { color: statusColor }]}>{ev.status}</Text>
                          <Text style={[styles.eventMetaText, { color: '#6c47ff' }]}>👥 {rsvpCount}/{ev.capacity}</Text>
                        </View>
                      </View>
                      <View style={styles.eventActions}>
                        <TouchableOpacity style={styles.manageBtn} onPress={() => navigation.navigate('ManageEvent', { eventId: ev.id })}>
                          <Text style={styles.manageBtnText}>Manage</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.archiveBtn} onPress={() => archiveEvent(ev.id, ev.title)}>
                          <Text style={styles.archiveBtnText}>Archive</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                }}
                ItemSeparatorComponent={() => <View style={styles.divider} />}
                contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        )}

        {/* ── Archived ── */}
        {tab === 'archived' && (
          <View style={styles.flex}>
            <Text style={styles.archivedNote}>Hidden from public. Restore or delete permanently.</Text>
            {archivedLoading ? (
              <ActivityIndicator style={{ marginTop: 40 }} color="#6c47ff" />
            ) : archivedEvents.length === 0 ? (
              <View style={styles.center}>
                <Text style={{ fontSize: 40, marginBottom: 12 }}>🗃</Text>
                <Text style={styles.emptyText}>No archived events.</Text>
              </View>
            ) : (
              <FlatList
                data={archivedEvents}
                keyExtractor={item => item.id}
                renderItem={({ item: ev }) => (
                  <View style={[styles.eventRow, styles.archivedRow]}>
                    <View style={styles.eventInfo}>
                      <View style={styles.eventTitleRow}>
                        <Text style={[styles.eventTitle, { color: '#888' }]} numberOfLines={1}>{ev.title}</Text>
                        <View style={styles.archivedBadge}><Text style={styles.archivedBadgeText}>Archived</Text></View>
                      </View>
                      <Text style={styles.eventMetaText}>
                        {new Date(ev.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        {' · '}👥 {ev.rsvps?.length ?? 0} RSVPs
                      </Text>
                    </View>
                    <View style={styles.eventActions}>
                      <TouchableOpacity style={styles.restoreBtn} onPress={() => restoreEvent(ev.id)}>
                        <Text style={styles.restoreBtnText}>↩ Restore</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.deleteBtn} onPress={() => hardDeleteEvent(ev.id, ev.title)}>
                        <Text style={styles.deleteBtnText}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                ItemSeparatorComponent={() => <View style={styles.divider} />}
                contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        )}
      </View>

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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  flex: { flex: 1 },

  noAccessEmoji: { fontSize: 52, marginBottom: 14 },
  noAccessTitle: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 8 },
  noAccessSub: { color: '#555', fontSize: 14, textAlign: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  headerSub: { color: '#555', fontSize: 12, marginTop: 2 },
  roleBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  roleBadgeText: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },

  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, gap: 2, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: '#6c47ff' },
  tabEmoji: { fontSize: 16 },
  tabLabel: { color: '#555', fontSize: 11, fontWeight: '600' },
  tabLabelActive: { color: '#6c47ff' },

  tabContent: { padding: 16, gap: 14 },
  sectionTitle: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 4 },

  statsGrid: { gap: 12 },
  statCard: { backgroundColor: '#1a1a1a', borderRadius: 16, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16, borderWidth: 1, borderColor: '#2a2a2a' },
  statEmoji: { fontSize: 30 },
  statValue: { color: '#fff', fontSize: 32, fontWeight: '800' },
  statLabel: { color: '#666', fontSize: 13, marginTop: 2 },

  quickCreateBtn: { backgroundColor: '#6c47ff', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  quickCreateText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  field: { gap: 6 },
  row: { flexDirection: 'row', gap: 12 },
  label: { color: '#888', fontSize: 12, fontWeight: '600' },
  req: { color: '#ef4444' },
  hint: { color: '#444', fontWeight: '400' },
  input: { backgroundColor: '#1a1a1a', borderRadius: 12, borderWidth: 1, borderColor: '#2a2a2a', paddingHorizontal: 14, paddingVertical: 12, color: '#fff', fontSize: 14 },
  textArea: { height: 80, paddingTop: 12 },
  pickerBtn: { backgroundColor: '#1a1a1a', borderRadius: 12, borderWidth: 1, borderColor: '#2a2a2a', paddingHorizontal: 14, paddingVertical: 12 },
  pickerBtnText: { color: '#ccc', fontSize: 14 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a' },
  chipActive: { backgroundColor: '#6c47ff', borderColor: '#6c47ff' },
  chipText: { color: '#666', fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  msgBox: { borderRadius: 12, padding: 12, borderWidth: 1 },
  msgSuccess: { backgroundColor: 'rgba(20,83,45,0.2)', borderColor: 'rgba(22,101,52,0.4)' },
  msgError: { backgroundColor: 'rgba(127,29,29,0.2)', borderColor: 'rgba(153,27,27,0.4)' },
  msgText: { fontSize: 13 },
  msgTextSuccess: { color: '#4ade80' },
  msgTextError: { color: '#f87171' },
  createBtn: { backgroundColor: '#6c47ff', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  createBtnDisabled: { opacity: 0.6 },
  createBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  eventRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  archivedRow: { opacity: 0.75 },
  eventInfo: { flex: 1, gap: 4 },
  eventTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eventTitle: { color: '#fff', fontSize: 14, fontWeight: '700', flexShrink: 1 },
  eventMeta: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  eventMetaText: { color: '#555', fontSize: 12 },
  eventActions: { flexDirection: 'row', gap: 8 },
  manageBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a' },
  manageBtnText: { color: '#ccc', fontSize: 12, fontWeight: '600' },
  archiveBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: 'rgba(113,63,18,0.3)' },
  archiveBtnText: { color: '#fbbf24', fontSize: 12, fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#1a1a1a' },
  archivedNote: { color: '#444', fontSize: 12, paddingHorizontal: 16, paddingVertical: 10 },
  archivedBadge: { backgroundColor: 'rgba(113,63,18,0.3)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  archivedBadgeText: { color: '#fbbf24', fontSize: 11 },
  restoreBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: 'rgba(20,83,45,0.3)' },
  restoreBtnText: { color: '#4ade80', fontSize: 12, fontWeight: '600' },
  deleteBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: 'rgba(127,29,29,0.3)' },
  deleteBtnText: { color: '#f87171', fontSize: 12, fontWeight: '600' },
  emptyText: { color: '#555', fontSize: 14, marginBottom: 10 },
  emptyLink: { color: '#6c47ff', fontSize: 14, fontWeight: '600' },
});
