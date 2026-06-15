import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, RefreshControl, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function MyEventsScreen({ navigation }) {
  const { session } = useAuth();
  const insets = useSafeAreaInsets();

  const [rsvps, setRsvps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');

  useEffect(() => { if (session) fetchMyEvents(); }, [session]);

  async function fetchMyEvents(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const { data } = await supabase
      .from('rsvps')
      .select('id, checked_in, created_at, events(id, title, description, date, venue, capacity, status, image_url, meet_link)')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    setRsvps(data ?? []);
    setLoading(false);
    setRefreshing(false);
  }

  const onRefresh = useCallback(() => fetchMyEvents(true), [session]);

  function cancelRSVP(rsvpId, eventTitle) {
    Alert.alert(
      'Cancel RSVP',
      `Cancel your spot at "${eventTitle}"?`,
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Cancel RSVP', style: 'destructive',
          onPress: async () => {
            await supabase.from('rsvps').delete().eq('id', rsvpId);
            setRsvps(prev => prev.filter(r => r.id !== rsvpId));
          },
        },
      ]
    );
  }

  const upcomingCount = rsvps.filter(r => r.events?.status === 'active').length;
  const endedCount = rsvps.filter(r => r.events?.status !== 'active').length;

  const filtered = rsvps.filter(r => {
    if (filter === 'upcoming') return r.events?.status === 'active';
    if (filter === 'ended') return r.events?.status !== 'active';
    return true;
  });

  const tabs = [
    { key: 'all', label: `All (${rsvps.length})` },
    { key: 'upcoming', label: `Upcoming (${upcomingCount})` },
    { key: 'ended', label: `Ended (${endedCount})` },
  ];

  function renderHeader() {
    return (
      <View>
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>My Events</Text>
          <Text style={styles.pageSubtitle}>All the parties you've joined</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabScroll}
          contentContainerStyle={styles.tabScrollContent}
        >
          {tabs.map(t => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, filter === t.key && styles.tabActive]}
              onPress={() => setFilter(t.key)}
            >
              <Text style={[styles.tabText, filter === t.key && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  }

  function renderRsvp({ item }) {
    const { id: rsvpId, checked_in, events: ev } = item;
    if (!ev) return null;

    const date = new Date(ev.date);
    const isEnded = ev.status !== 'active';

    return (
      <View style={styles.card}>
        {/* Left color strip */}
        <View style={[styles.strip, { backgroundColor: isEnded ? '#374151' : '#6c47ff' }]} />

        <View style={styles.cardBody}>
          {/* Title row */}
          <View style={styles.titleRow}>
            <Text style={styles.eventTitle} numberOfLines={1}>{ev.title}</Text>
            <View style={styles.badgeRow}>
              {checked_in && (
                <View style={styles.badgeGreen}>
                  <Text style={styles.badgeGreenText}>✓ Checked in</Text>
                </View>
              )}
              {isEnded && (
                <View style={styles.badgeGray}>
                  <Text style={styles.badgeGrayText}>Ended</Text>
                </View>
              )}
            </View>
          </View>

          {/* Meta */}
          <Text style={styles.metaText}>
            📅 {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            {' · '}
            {date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </Text>
          <Text style={styles.metaText} numberOfLines={1}>📍 {ev.venue}</Text>

          {/* Actions */}
          <View style={styles.actions}>
            {!isEnded && (
              <TouchableOpacity
                style={styles.chatBtn}
                onPress={() => navigation.navigate('Main', { screen: 'Rooms' })}
              >
                <Text style={styles.chatBtnText}>💬 Chat</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.viewBtn}
              onPress={() => navigation.navigate('EventDetail', { eventId: ev.id })}
            >
              <Text style={styles.viewBtnText}>View</Text>
            </TouchableOpacity>
            {!isEnded && (
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => cancelRSVP(rsvpId, ev.title)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {renderHeader()}
        <View style={styles.skeletons}>
          {[0, 1, 2].map(i => <View key={i} style={styles.skeleton} />)}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={renderRsvp}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🎈</Text>
            <Text style={styles.emptyTitle}>
              {filter === 'all' ? "You haven't joined any events yet" : `No ${filter} events`}
            </Text>
            <Text style={styles.emptySub}>Browse events and hit RSVP to join!</Text>
            {filter === 'all' && (
              <TouchableOpacity
                style={styles.browseBtn}
                onPress={() => navigation.navigate('Home')}
              >
                <Text style={styles.browseBtnText}>Browse Events</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6c47ff" />}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  listContent: { padding: 16, paddingBottom: 40 },

  pageHeader: { marginBottom: 16 },
  pageTitle: { color: '#fff', fontSize: 26, fontWeight: '800' },
  pageSubtitle: { color: '#555', fontSize: 13, marginTop: 3 },

  tabScroll: { marginBottom: 16 },
  tabScrollContent: { gap: 8 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#1a1a1a' },
  tabActive: { backgroundColor: '#6c47ff' },
  tabText: { color: '#666', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#fff' },

  card: {
    flexDirection: 'row', backgroundColor: '#1a1a1a',
    borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  strip: { width: 4 },
  cardBody: { flex: 1, padding: 14 },

  titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  eventTitle: { color: '#fff', fontSize: 15, fontWeight: '700', flexShrink: 1 },
  badgeRow: { flexDirection: 'row', gap: 6 },
  badgeGreen: { backgroundColor: 'rgba(20,83,45,0.6)', borderWidth: 1, borderColor: 'rgba(22,101,52,0.5)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  badgeGreenText: { color: '#4ade80', fontSize: 11, fontWeight: '600' },
  badgeGray: { backgroundColor: '#1f1f1f', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  badgeGrayText: { color: '#555', fontSize: 11 },

  metaText: { color: '#555', fontSize: 12, marginBottom: 3 },

  actions: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  chatBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, backgroundColor: '#6c47ff' },
  chatBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  viewBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, backgroundColor: '#252525' },
  viewBtnText: { color: '#bbb', fontSize: 12, fontWeight: '600' },
  cancelBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(127,29,29,0.6)' },
  cancelBtnText: { color: '#f87171', fontSize: 12, fontWeight: '600' },

  skeletons: { gap: 10, paddingHorizontal: 16 },
  skeleton: { height: 110, borderRadius: 16, backgroundColor: '#1a1a1a' },

  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 52, marginBottom: 14 },
  emptyTitle: { color: '#ccc', fontSize: 17, fontWeight: '700', textAlign: 'center', marginBottom: 6 },
  emptySub: { color: '#555', fontSize: 13, marginBottom: 24 },
  browseBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14, backgroundColor: '#6c47ff' },
  browseBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
