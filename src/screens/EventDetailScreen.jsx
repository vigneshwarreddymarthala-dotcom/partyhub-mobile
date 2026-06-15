import { useEffect, useState } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Linking, Dimensions,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import RSVPModal from '../components/RSVPModal';
import CancelModal from '../components/CancelModal';

const RECURRENCE_LABELS = {
  hourly_1: 'Repeats every hour',
  hourly_2: 'Repeats every 2 hours',
  daily: 'Repeats daily',
  weekly: 'Repeats weekly',
  monthly: 'Repeats monthly',
};

export default function EventDetailScreen({ route, navigation }) {
  const { eventId } = route.params;
  const { session, profile } = useAuth();
  const insets = useSafeAreaInsets();

  const [event, setEvent] = useState(null);
  const [rsvpCount, setRsvpCount] = useState(0);
  const [myRsvp, setMyRsvp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeImage, setActiveImage] = useState(0);
  const [chatRoom, setChatRoom] = useState(null);

  useEffect(() => { fetchEvent(); }, [eventId, session]);

  async function fetchEvent() {
    setLoading(true);
    const { data: evt } = await supabase
      .from('events')
      .select('*, profiles!events_created_by_fkey(full_name, company_name, avatar_url)')
      .eq('id', eventId)
      .maybeSingle();

    if (!evt || evt.deleted_at) { navigation.goBack(); return; }

    setEvent(evt);
    navigation.setOptions({ headerTitle: evt.title });

    const { count } = await supabase
      .from('rsvps')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId);
    setRsvpCount(count ?? 0);

    if (session) {
      const { data: rsvp } = await supabase
        .from('rsvps')
        .select('*')
        .eq('event_id', eventId)
        .eq('user_id', session.user.id)
        .maybeSingle();
      setMyRsvp(rsvp);
    }

    const { data: room } = await supabase
      .from('chat_rooms')
      .select('id, event_id')
      .eq('event_id', eventId)
      .maybeSingle();
    setChatRoom(room);

    setLoading(false);
  }

  async function confirmRSVP() {
    setActionLoading(true); setError('');
    const { error } = await supabase.from('rsvps').insert({ event_id: eventId, user_id: session.user.id });
    if (error) { setError(error.message); setActionLoading(false); return; }
    setModal(null);
    await fetchEvent();
    setActionLoading(false);
  }

  async function confirmCancel() {
    setActionLoading(true); setError('');
    const { error } = await supabase.from('rsvps').delete().eq('id', myRsvp.id);
    if (error) { setError(error.message); setActionLoading(false); return; }
    setModal(null); setMyRsvp(null);
    await fetchEvent();
    setActionLoading(false);
  }

  function openMaps(url) {
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    Linking.openURL(href);
  }

  function openMeet(url) {
    Linking.openURL(url);
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6c47ff" />
      </View>
    );
  }

  const isFull = rsvpCount >= event.capacity;
  const isEnded = event.status === 'ended' || event.status === 'cancelled';
  const isScheduled = event.status === 'scheduled';
  const date = new Date(event.date);
  const images = [event.image_url, event.image_url_2, event.image_url_3].filter(Boolean);
  const fillPct = Math.min(100, (rsvpCount / event.capacity) * 100);
  const meetHref = event.meet_link && /^https?:\/\//i.test(event.meet_link) ? event.meet_link : null;

  const organizer = event.profiles;
  const avatarLetter = organizer?.full_name?.[0]?.toUpperCase() ?? '?';

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Image carousel */}
        <View style={styles.imageWrapper}>
          {images.length > 0 ? (
            <>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={e => {
                  const idx = Math.round(e.nativeEvent.contentOffset.x / e.nativeEvent.layoutMeasurement.width);
                  setActiveImage(idx);
                }}
              >
                {images.map((img, i) => (
                  <Image key={i} source={{ uri: img }} style={[styles.image, { width: SCREEN_WIDTH - 32 }]} resizeMode="cover" />
                ))}
              </ScrollView>
              {images.length > 1 && (
                <View style={styles.dots}>
                  {images.map((_, i) => (
                    <View key={i} style={[styles.dot, i === activeImage && styles.dotActive]} />
                  ))}
                </View>
              )}
            </>
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={{ fontSize: 60, opacity: 0.3 }}>🎉</Text>
            </View>
          )}

          {/* Status overlay */}
          {isEnded && (
            <View style={styles.overlay}>
              <View style={styles.overlayChip}>
                <Text style={styles.overlayChipText}>Event Ended</Text>
              </View>
            </View>
          )}
          {isScheduled && (
            <View style={styles.overlay}>
              <Text style={{ fontSize: 28, marginBottom: 8 }}>🕐</Text>
              <View style={[styles.overlayChip, styles.overlayChipYellow]}>
                <Text style={styles.overlayChipTextYellow}>
                  Going live {event.scheduled_at
                    ? new Date(event.scheduled_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                    : 'soon'}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Title */}
        <Text style={styles.title}>{event.title}</Text>

        {/* Meta rows */}
        <View style={styles.metaBox}>
          <View style={styles.metaRow}>
            <Text style={styles.metaIcon}>📅</Text>
            <Text style={styles.metaText}>
              {date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              {' at '}
              {date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaIcon}>📍</Text>
            <Text style={[styles.metaText, event.maps_url && styles.metaLink]} onPress={event.maps_url ? () => openMaps(event.maps_url) : undefined}>
              {event.venue}{event.maps_url ? ' ↗' : ''}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaIcon}>👥</Text>
            <Text style={styles.metaText}>{rsvpCount} / {event.capacity} going</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaIcon}>🎟️</Text>
            {event.price > 0
              ? <Text style={[styles.metaText, { color: '#fff', fontWeight: '700' }]}>€{Number(event.price).toFixed(2)}</Text>
              : <Text style={[styles.metaText, { color: '#4ade80', fontWeight: '600' }]}>Free entry</Text>
            }
          </View>
          {event.recurrence && event.recurrence !== 'none' && (
            <View style={styles.metaRow}>
              <Text style={styles.metaIcon}>🔁</Text>
              <Text style={[styles.metaText, { color: '#a78bfa' }]}>
                {RECURRENCE_LABELS[event.recurrence] ?? `Repeats ${event.recurrence}`}
              </Text>
            </View>
          )}
        </View>

        {/* Description */}
        {event.description && (
          <Text style={styles.description}>{event.description}</Text>
        )}

        {/* Organizer */}
        {organizer && (
          <TouchableOpacity
            style={styles.organizer}
            onPress={() => navigation.navigate('OrganizerProfile', { userId: event.created_by })}
            activeOpacity={0.8}
          >
            <View style={styles.avatar}>
              {organizer.avatar_url
                ? <Image source={{ uri: organizer.avatar_url }} style={styles.avatarImage} />
                : <Text style={styles.avatarLetter}>{avatarLetter}</Text>
              }
            </View>
            <View style={styles.organizerInfo}>
              <Text style={styles.organizedBy}>Organised by</Text>
              <Text style={styles.organizerName}>{organizer.full_name}</Text>
              {organizer.company_name && <Text style={styles.organizerCompany}>{organizer.company_name}</Text>}
            </View>
            <Text style={{ color: '#444', fontSize: 18 }}>›</Text>
          </TouchableOpacity>
        )}

        {/* Capacity bar */}
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${fillPct}%`, backgroundColor: isFull ? '#ef4444' : '#6c47ff' }]} />
        </View>

        {/* Error */}
        {error !== '' && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Maps button */}
        {event.maps_url && (
          <TouchableOpacity style={styles.mapsBtn} onPress={() => openMaps(event.maps_url)}>
            <Text style={styles.mapsBtnText}>🗺️  Open in Maps</Text>
          </TouchableOpacity>
        )}

        {/* Meet link — RSVPed users only */}
        {myRsvp && meetHref && !isEnded && (
          <TouchableOpacity style={styles.meetBtn} onPress={() => openMeet(meetHref)}>
            <Text style={styles.meetBtnText}>📹  Join Google Meet</Text>
          </TouchableOpacity>
        )}

        {/* Action buttons */}
        <View style={styles.actions}>
          {isScheduled ? (
            <View style={styles.scheduledBanner}>
              <Text style={styles.scheduledText}>🕐  Not live yet — check back later</Text>
            </View>
          ) : isEnded ? (
            <View style={styles.endedBanner}>
              <Text style={styles.endedText}>Event has ended</Text>
            </View>
          ) : myRsvp ? (
            <>
              <TouchableOpacity
                style={styles.chatBtn}
                onPress={() => {
                  if (chatRoom) {
                    navigation.navigate('Chat', {
                      room: {
                        id: chatRoom.id,
                        event_id: event.id,
                        events: { id: event.id, title: event.title, date: event.date, status: event.status, meet_link: event.meet_link },
                      },
                      isAdmin: profile?.role === 'admin' || profile?.role === 'sub_admin',
                    });
                  } else {
                    navigation.navigate('Main', { screen: 'Rooms' });
                  }
                }}
              >
                <Text style={styles.chatBtnText}>💬  Open Chat Room</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelRsvpBtn} onPress={() => setModal('cancel')}>
                <Text style={styles.cancelRsvpText}>Cancel RSVP</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.rsvpBtn, isFull && styles.rsvpBtnDisabled]}
              onPress={() => setModal('rsvp')}
              disabled={isFull}
            >
              <Text style={styles.rsvpBtnText}>{isFull ? 'Event is Full' : 'RSVP Now'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {modal === 'rsvp' && (
        <RSVPModal event={event} onConfirm={confirmRSVP} onClose={() => setModal(null)} loading={actionLoading} />
      )}
      {modal === 'cancel' && (
        <CancelModal event={event} onConfirm={confirmCancel} onClose={() => setModal(null)} loading={actionLoading} />
      )}
    </>
  );
}

const IMG_HEIGHT = 240;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  content: { padding: 16 },
  loadingContainer: { flex: 1, backgroundColor: '#0f0f0f', justifyContent: 'center', alignItems: 'center' },

  // Image
  imageWrapper: { height: IMG_HEIGHT, borderRadius: 18, overflow: 'hidden', marginBottom: 18, backgroundColor: '#1a1a1a' },
  image: { width: '100%', height: IMG_HEIGHT },
  imagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2d1f5e' },
  dots: { position: 'absolute', bottom: 10, flexDirection: 'row', alignSelf: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' },
  dotActive: { backgroundColor: '#fff', width: 18 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  overlayChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#1f1f1f' },
  overlayChipText: { color: '#bbb', fontSize: 14, fontWeight: '600' },
  overlayChipYellow: { backgroundColor: 'rgba(113,63,18,0.8)' },
  overlayChipTextYellow: { color: '#fbbf24', fontSize: 14, fontWeight: '600' },

  // Title & meta
  title: { color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 14, lineHeight: 30 },
  metaBox: { gap: 10, marginBottom: 16 },
  metaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  metaIcon: { fontSize: 15, width: 22 },
  metaText: { color: '#999', fontSize: 14, flex: 1, lineHeight: 20 },
  metaLink: { color: '#8b5cf6' },

  // Description
  description: { color: '#bbb', fontSize: 14, lineHeight: 22, marginBottom: 18 },

  // Organizer
  organizer: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#1a1a1a', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#2a2a2a', marginBottom: 16,
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#4c1d95', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarImage: { width: 40, height: 40 },
  avatarLetter: { color: '#fff', fontSize: 16, fontWeight: '700' },
  organizerInfo: { flex: 1 },
  organizedBy: { color: '#555', fontSize: 11, marginBottom: 2 },
  organizerName: { color: '#fff', fontSize: 14, fontWeight: '700' },
  organizerCompany: { color: '#7c3aed', fontSize: 12, marginTop: 1 },

  // Capacity bar
  barTrack: { height: 5, backgroundColor: '#1f1f1f', borderRadius: 4, overflow: 'hidden', marginBottom: 20 },
  barFill: { height: 5, borderRadius: 4 },

  // Error
  errorBox: { backgroundColor: 'rgba(127,29,29,0.2)', borderWidth: 1, borderColor: 'rgba(153,27,27,0.4)', borderRadius: 10, padding: 12, marginBottom: 14 },
  errorText: { color: '#f87171', fontSize: 13 },

  // Buttons
  mapsBtn: {
    borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 14,
    paddingVertical: 13, alignItems: 'center', marginBottom: 10,
  },
  mapsBtnText: { color: '#ccc', fontSize: 14, fontWeight: '600' },

  meetBtn: {
    backgroundColor: 'rgba(20,83,45,0.3)', borderWidth: 1, borderColor: 'rgba(22,101,52,0.5)',
    borderRadius: 14, paddingVertical: 13, alignItems: 'center', marginBottom: 10,
  },
  meetBtnText: { color: '#4ade80', fontSize: 14, fontWeight: '700' },

  actions: { gap: 10, marginTop: 4 },
  rsvpBtn: { backgroundColor: '#6c47ff', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  rsvpBtnDisabled: { backgroundColor: '#2a2a2a' },
  rsvpBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  chatBtn: { backgroundColor: '#6c47ff', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  chatBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  cancelRsvpBtn: { borderWidth: 1, borderColor: '#7f1d1d', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  cancelRsvpText: { color: '#f87171', fontSize: 14, fontWeight: '600' },

  scheduledBanner: { backgroundColor: 'rgba(113,63,18,0.3)', borderWidth: 1, borderColor: 'rgba(146,64,14,0.4)', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  scheduledText: { color: '#fbbf24', fontSize: 14, fontWeight: '600' },

  endedBanner: { backgroundColor: '#1a1a1a', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  endedText: { color: '#555', fontSize: 14, fontWeight: '600' },
});
