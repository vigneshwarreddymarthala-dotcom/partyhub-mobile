import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function RoomsScreen({ navigation }) {
  const { session, profile } = useAuth();
  const insets = useSafeAreaInsets();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'sub_admin';

  const [rooms, setRooms] = useState([]);
  const [unreadSet, setUnreadSet] = useState(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session) fetchRooms();
  }, [session, profile]);

  // Watch for RSVP deletions to remove rooms in real-time
  useEffect(() => {
    if (!session || isAdmin) return;
    const channel = supabase
      .channel('my_rsvps_watch')
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'rsvps', filter: `user_id=eq.${session.user.id}` },
        (payload) => {
          setRooms(prev => prev.filter(r => r.event_id !== payload.old.event_id));
        }
      ).subscribe();
    return () => supabase.removeChannel(channel);
  }, [session, isAdmin]);

  async function fetchRooms() {
    setLoading(true);
    let data;
    if (isAdmin) {
      ({ data } = await supabase
        .from('chat_rooms')
        .select('id, event_id, events(id, title, date, status, meet_link)')
        .order('created_at', { ascending: false }));
    } else {
      const { data: myRsvps } = await supabase
        .from('rsvps')
        .select('event_id')
        .eq('user_id', session.user.id);
      const eventIds = (myRsvps ?? []).map(r => r.event_id);
      if (eventIds.length === 0) { setRooms([]); setLoading(false); return; }
      ({ data } = await supabase
        .from('chat_rooms')
        .select('id, event_id, events(id, title, date, status, meet_link)')
        .in('event_id', eventIds)
        .order('created_at', { ascending: false }));
    }
    setRooms(data ?? []);
    setLoading(false);
  }

  function markRead(roomId) {
    setUnreadSet(prev => { const n = new Set(prev); n.delete(roomId); return n; });
  }

  // Listen to new messages across all rooms to show unread dots
  useEffect(() => {
    if (!session || rooms.length === 0) return;
    const channels = rooms.map(room =>
      supabase
        .channel(`unread:${room.id}`)
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${room.id}` },
          () => setUnreadSet(prev => new Set([...prev, room.id]))
        ).subscribe()
    );
    return () => channels.forEach(c => supabase.removeChannel(c));
  }, [rooms, session]);

  function openRoom(room) {
    markRead(room.id);
    navigation.navigate('Chat', { room, isAdmin });
  }

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#6c47ff" />
      </View>
    );
  }

  if (rooms.length === 0) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.emptyEmoji}>💬</Text>
        <Text style={styles.emptyTitle}>No rooms yet</Text>
        <Text style={styles.emptySubtitle}>RSVP to an event to unlock its private chat room.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{isAdmin ? '🛡️ All Rooms' : 'Chats'}</Text>
        <Text style={styles.headerSub}>{rooms.length} room{rooms.length !== 1 ? 's' : ''}</Text>
      </View>

      <FlatList
        data={rooms}
        keyExtractor={item => item.id}
        renderItem={({ item }) => {
          const ev = item.events;
          const hasUnread = unreadSet.has(item.id);
          const isEnded = ev?.status === 'ended';
          return (
            <TouchableOpacity style={styles.roomRow} onPress={() => openRoom(item)} activeOpacity={0.7}>
              <View style={styles.roomAvatar}>
                <Text style={styles.roomAvatarEmoji}>{isAdmin ? '🛡️' : '🎉'}</Text>
                {hasUnread && <View style={styles.unreadDot} />}
              </View>
              <View style={styles.roomInfo}>
                <Text style={[styles.roomTitle, hasUnread && styles.roomTitleUnread]} numberOfLines={1}>
                  {ev?.title ?? 'Event'}
                </Text>
                <Text style={[styles.roomSub, hasUnread && styles.roomSubUnread]}>
                  {hasUnread
                    ? 'New messages'
                    : isEnded
                      ? '🔴 Ended'
                      : `📅 ${new Date(ev?.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          );
        }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  center: { flex: 1, backgroundColor: '#0f0f0f', alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyEmoji: { fontSize: 52, marginBottom: 14 },
  emptyTitle: { color: '#ccc', fontSize: 18, fontWeight: '700', marginBottom: 6 },
  emptySubtitle: { color: '#555', fontSize: 14, textAlign: 'center', lineHeight: 20 },

  header: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1f1f1f' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  headerSub: { color: '#555', fontSize: 12, marginTop: 2 },

  roomRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  roomAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#1f1f1f', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  roomAvatarEmoji: { fontSize: 20 },
  unreadDot: { position: 'absolute', top: -1, right: -1, width: 13, height: 13, borderRadius: 7, backgroundColor: '#ef4444', borderWidth: 2, borderColor: '#0f0f0f' },
  roomInfo: { flex: 1 },
  roomTitle: { color: '#ccc', fontSize: 14, fontWeight: '600', marginBottom: 3 },
  roomTitleUnread: { color: '#fff', fontWeight: '800' },
  roomSub: { color: '#555', fontSize: 12 },
  roomSubUnread: { color: '#f87171' },
  chevron: { color: '#333', fontSize: 22 },
  separator: { height: 1, backgroundColor: '#1a1a1a', marginLeft: 74 },
});
