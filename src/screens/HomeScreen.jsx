import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, RefreshControl, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import EventCard from '../components/EventCard';

export default function HomeScreen({ navigation }) {
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();

  const [events, setEvents] = useState([]);
  const [rsvpCounts, setRsvpCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('active');
  const [cityFilter, setCityFilter] = useState('all');
  const [cities, setCities] = useState([]);
  const [citySearch, setCitySearch] = useState('');

  useEffect(() => { fetchCities(); }, []);
  useEffect(() => { fetchEvents(); }, [filter, cityFilter, profile]);

  async function fetchCities() {
    const { data } = await supabase.from('events').select('city').neq('status', 'scheduled');
    const unique = [...new Set((data ?? []).map(e => e.city).filter(Boolean))].sort();
    setCities(unique);
  }

  async function fetchEvents(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    await supabase.rpc('publish_due_scheduled_events');

    let query = supabase
      .from('events')
      .select('*')
      .order('date', { ascending: true })
      .neq('status', 'scheduled')
      .is('deleted_at', null);

    if (filter === 'active') query = query.eq('status', 'active');
    if (cityFilter !== 'all') query = query.eq('city', cityFilter);
    if (profile?.country) {
      query = query.or(`target_country.is.null,target_country.eq.${profile.country}`);
    }

    const { data } = await query;
    if (!data) { setLoading(false); setRefreshing(false); return; }

    setEvents(data);

    const counts = {};
    await Promise.all(data.map(async (e) => {
      const { count } = await supabase
        .from('rsvps')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', e.id);
      counts[e.id] = count ?? 0;
    }));
    setRsvpCounts(counts);
    setLoading(false);
    setRefreshing(false);
  }

  const onRefresh = useCallback(() => fetchEvents(true), [filter, cityFilter, profile]);

  const filteredCities = citySearch
    ? cities.filter(c => c.toLowerCase().includes(citySearch.toLowerCase()))
    : cities;

  function renderHeader() {
    return (
      <View>
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>🎉</Text>
          <Text style={styles.heroTitle}>Find your next <Text style={styles.heroAccent}>party</Text></Text>
          <Text style={styles.heroSub}>Discover local events for expats across Germany</Text>

          <View style={styles.badges}>
            {['Free to join', 'Live chat rooms', 'All German cities'].map(b => (
              <View key={b} style={styles.chip}>
                <Text style={styles.chipText}>{b}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Status filter */}
        <View style={styles.filterRow}>
          {[{ key: 'active', label: 'Upcoming' }, { key: 'all', label: 'All Events' }].map(f => (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterTab, filter === f.key && styles.filterTabActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.filterTabText, filter === f.key && styles.filterTabTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* City search */}
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search city..."
            placeholderTextColor="#555"
            value={citySearch}
            onChangeText={setCitySearch}
          />
          {citySearch !== '' && (
            <TouchableOpacity onPress={() => { setCitySearch(''); setCityFilter('all'); }}>
              <Text style={styles.clearBtn}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* City chips */}
        {cities.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.cityScroll}
            contentContainerStyle={styles.cityScrollContent}
          >
            <TouchableOpacity
              style={[styles.cityChip, cityFilter === 'all' && styles.cityChipActive]}
              onPress={() => { setCityFilter('all'); setCitySearch(''); }}
            >
              <Text style={[styles.cityChipText, cityFilter === 'all' && styles.cityChipTextActive]}>
                All
              </Text>
            </TouchableOpacity>
            {filteredCities.map(city => (
              <TouchableOpacity
                key={city}
                style={[styles.cityChip, cityFilter === city && styles.cityChipActive]}
                onPress={() => { setCityFilter(city); setCitySearch(city); }}
              >
                <Text style={[styles.cityChipText, cityFilter === city && styles.cityChipTextActive]}>
                  {city}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
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
        data={events}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <EventCard
            event={item}
            rsvpCount={rsvpCounts[item.id] ?? 0}
            onPress={() => navigation.navigate('EventDetail', { eventId: item.id })}
          />
        )}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🎈</Text>
            <Text style={styles.emptyTitle}>
              {cityFilter !== 'all' ? `No events in ${cityFilter}` : 'No events yet'}
            </Text>
            {cityFilter !== 'all' && (
              <TouchableOpacity onPress={() => setCityFilter('all')}>
                <Text style={styles.emptyLink}>Show all cities</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6c47ff" />}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  centered: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 32 },

  // Hero
  hero: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 8 },
  heroEmoji: { fontSize: 48, marginBottom: 10 },
  heroTitle: { fontSize: 28, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 8 },
  heroAccent: { color: '#6c47ff' },
  heroSub: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 16, lineHeight: 20 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  chip: { backgroundColor: '#1a1433', borderWidth: 1, borderColor: '#2d1f5e', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  chipText: { color: '#a78bfa', fontSize: 11, fontWeight: '600' },

  // Filters
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  filterTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#1a1a1a' },
  filterTabActive: { backgroundColor: '#6c47ff' },
  filterTabText: { color: '#666', fontSize: 13, fontWeight: '600' },
  filterTabTextActive: { color: '#fff' },

  // City search
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1a1a1a', borderRadius: 12, borderWidth: 1,
    borderColor: '#2a2a2a', paddingHorizontal: 14, marginBottom: 10,
  },
  searchInput: { flex: 1, color: '#fff', fontSize: 14, paddingVertical: 10 },
  clearBtn: { color: '#555', fontSize: 14, paddingLeft: 8 },

  // City chips
  cityScroll: { marginBottom: 16 },
  cityScrollContent: { gap: 8, paddingRight: 4 },
  cityChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#1a1a1a' },
  cityChipActive: { backgroundColor: '#6c47ff' },
  cityChipText: { color: '#666', fontSize: 12, fontWeight: '600' },
  cityChipTextActive: { color: '#fff' },

  // Skeletons
  skeletons: { padding: 16, gap: 14 },
  skeleton: { height: 220, borderRadius: 16, backgroundColor: '#1a1a1a' },

  // Empty
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { color: '#666', fontSize: 15, fontWeight: '600', marginBottom: 8 },
  emptyLink: { color: '#6c47ff', fontSize: 14, fontWeight: '600' },
});
