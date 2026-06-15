import { useEffect, useState } from 'react';
import {
  View, Text, Image, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import EventCard from '../components/EventCard';

export default function OrganizerProfileScreen({ route, navigation }) {
  const { userId } = route.params;
  const insets = useSafeAreaInsets();

  const [organizer, setOrganizer] = useState(null);
  const [upcoming, setUpcoming] = useState([]);
  const [past, setPast] = useState([]);
  const [rsvpCounts, setRsvpCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => { fetchAll(); }, [userId]);

  async function fetchAll() {
    setLoading(true);
    const { data: prof } = await supabase
      .from('profiles').select('*').eq('id', userId).maybeSingle();

    if (!prof || (prof.role !== 'admin' && prof.role !== 'sub_admin')) {
      setNotFound(true); setLoading(false); return;
    }
    setOrganizer(prof);
    navigation.setOptions({ headerTitle: prof.full_name ?? 'Organizer' });

    const { data: events } = await supabase
      .from('events').select('*')
      .eq('created_by', userId)
      .is('deleted_at', null)
      .neq('status', 'scheduled')
      .order('date', { ascending: false });

    const all = events ?? [];
    const now = new Date();
    setUpcoming(all.filter(e => e.status === 'active' && new Date(e.date) >= now));
    setPast(all.filter(e => e.status === 'ended' || e.status === 'cancelled' || (e.status === 'active' && new Date(e.date) < now)));

    const counts = {};
    await Promise.all(all.map(async (e) => {
      const { count } = await supabase.from('rsvps').select('*', { count: 'exact', head: true }).eq('event_id', e.id);
      counts[e.id] = count ?? 0;
    }));
    setRsvpCounts(counts);
    setLoading(false);
  }

  if (loading) return (
    <View style={styles.center}><ActivityIndicator size="large" color="#6c47ff" /></View>
  );

  if (notFound) return (
    <View style={styles.center}>
      <Text style={styles.nfEmoji}>🔍</Text>
      <Text style={styles.nfTitle}>Organizer not found</Text>
      <Text style={styles.nfSub}>This page doesn't exist or the organizer has been removed.</Text>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backBtnText}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );

  const initials = organizer.full_name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() ?? '?';
  const totalEvents = upcoming.length + past.length;

  // Build flat list data: profile header + section headers + event cards
  const listData = [
    { type: 'header' },
    { type: 'sectionTitle', title: 'Upcoming Events', count: upcoming.length, dot: '#4ade80' },
    ...(upcoming.length === 0
      ? [{ type: 'empty', message: 'No upcoming events right now — check back soon!' }]
      : upcoming.map(e => ({ type: 'event', event: e, opacity: 1 }))),
    ...(past.length > 0 ? [
      { type: 'sectionTitle', title: 'Past Events', count: past.length, dot: '#374151' },
      ...past.map(e => ({ type: 'event', event: e, opacity: 0.6 })),
    ] : []),
  ];

  return (
    <FlatList
      data={listData}
      keyExtractor={(item, i) => item.type + i + (item.event?.id ?? '')}
      contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 32 }]}
      showsVerticalScrollIndicator={false}
      renderItem={({ item }) => {
        if (item.type === 'header') return (
          <View style={styles.profileCard}>
            {/* Cover banner */}
            <View style={styles.cover}>
              {organizer.cover_url
                ? <Image source={{ uri: organizer.cover_url }} style={styles.coverImage} resizeMode="cover" />
                : null}
              <View style={styles.coverOverlay} />
            </View>

            {/* Avatar */}
            <View style={styles.avatarWrapper}>
              <View style={styles.avatar}>
                {organizer.avatar_url
                  ? <Image source={{ uri: organizer.avatar_url }} style={styles.avatarImage} />
                  : <Text style={styles.avatarInitials}>{initials}</Text>}
              </View>
            </View>

            {/* Info */}
            <View style={styles.profileInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{organizer.full_name}</Text>
                <View style={styles.roleBadge}>
                  <Text style={styles.roleBadgeText}>
                    {organizer.role === 'admin' ? '🛡️ Organiser' : '🎉 Host'}
                  </Text>
                </View>
              </View>
              {organizer.company_name && (
                <Text style={styles.company}>{organizer.company_name}</Text>
              )}
              {organizer.bio && (
                <Text style={styles.bio}>{organizer.bio}</Text>
              )}
              <View style={styles.statsRow}>
                {organizer.country && (
                  <Text style={styles.statItem}>🌍  {organizer.country}</Text>
                )}
                <Text style={styles.statItem}>
                  🎉  <Text style={styles.statBold}>{totalEvents}</Text> event{totalEvents !== 1 ? 's' : ''} hosted
                </Text>
                {upcoming.length > 0 && (
                  <View style={styles.upcomingPill}>
                    <View style={styles.greenDot} />
                    <Text style={styles.upcomingText}>{upcoming.length} upcoming</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        );

        if (item.type === 'sectionTitle') return (
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionDot, { backgroundColor: item.dot }]} />
            <Text style={styles.sectionTitle}>{item.title}</Text>
            <Text style={styles.sectionCount}>({item.count})</Text>
          </View>
        );

        if (item.type === 'empty') return (
          <View style={styles.emptySection}>
            <Text style={styles.emptyEmoji}>📭</Text>
            <Text style={styles.emptyText}>{item.message}</Text>
          </View>
        );

        if (item.type === 'event') return (
          <View style={{ opacity: item.opacity }}>
            <EventCard
              event={item.event}
              rsvpCount={rsvpCounts[item.event.id] ?? 0}
              onPress={() => navigation.navigate('EventDetail', { eventId: item.event.id })}
            />
          </View>
        );

        return null;
      }}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: '#0f0f0f', justifyContent: 'center', alignItems: 'center', padding: 24 },
  nfEmoji: { fontSize: 48, marginBottom: 14 },
  nfTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 6 },
  nfSub: { color: '#555', fontSize: 14, textAlign: 'center', marginBottom: 24 },
  backBtn: { backgroundColor: '#6c47ff', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 },
  backBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  list: { backgroundColor: '#0f0f0f', padding: 16, gap: 0 },

  // Profile card
  profileCard: { backgroundColor: '#1a1a1a', borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#2a2a2a', marginBottom: 24 },
  cover: { height: 120, backgroundColor: '#2d1f5e', position: 'relative' },
  coverImage: { ...StyleSheet.absoluteFillObject },
  coverOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)' },
  avatarWrapper: { position: 'absolute', top: 80, left: 16 },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#4c1d95', alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: '#1a1a1a', overflow: 'hidden',
  },
  avatarImage: { width: 72, height: 72 },
  avatarInitials: { color: '#fff', fontSize: 26, fontWeight: '800' },
  profileInfo: { paddingTop: 50, paddingHorizontal: 16, paddingBottom: 16 },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  name: { color: '#fff', fontSize: 20, fontWeight: '800' },
  roleBadge: { backgroundColor: 'rgba(108,71,255,0.2)', borderWidth: 1, borderColor: 'rgba(108,71,255,0.4)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  roleBadgeText: { color: '#a78bfa', fontSize: 11, fontWeight: '700' },
  company: { color: '#8b5cf6', fontSize: 14, fontWeight: '600', marginBottom: 8 },
  bio: { color: '#aaa', fontSize: 14, lineHeight: 20, marginBottom: 12 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center' },
  statItem: { color: '#666', fontSize: 13 },
  statBold: { color: '#fff', fontWeight: '700' },
  upcomingPill: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  greenDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ade80' },
  upcomingText: { color: '#4ade80', fontSize: 13, fontWeight: '600' },

  // Section headers
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 12 },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: { color: '#fff', fontSize: 15, fontWeight: '800' },
  sectionCount: { color: '#555', fontSize: 13 },

  // Empty section
  emptySection: { alignItems: 'center', paddingVertical: 28, backgroundColor: '#1a1a1a', borderRadius: 16, borderWidth: 1, borderColor: '#2a2a2a', marginBottom: 16 },
  emptyEmoji: { fontSize: 32, marginBottom: 8 },
  emptyText: { color: '#555', fontSize: 13 },
});
