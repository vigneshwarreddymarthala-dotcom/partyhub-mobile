import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';

export default function EventCard({ event, rsvpCount, onPress }) {
  const date = new Date(event.date);
  const isFull = rsvpCount >= event.capacity;
  const isEnded = event.status === 'ended' || event.status === 'cancelled';
  const fillPct = Math.min(100, (rsvpCount / event.capacity) * 100);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      {/* Image */}
      <View style={styles.imageContainer}>
        {event.image_url ? (
          <Image source={{ uri: event.image_url }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.imagePlaceholderText}>🎉</Text>
          </View>
        )}

        {/* Price badge */}
        <View style={[styles.badge, styles.badgeLeft, event.price > 0 ? styles.badgePurple : styles.badgeGreen]}>
          <Text style={styles.badgeText}>
            {event.price > 0 ? `€${Number(event.price).toFixed(2)}` : 'Free'}
          </Text>
        </View>

        {/* Status badge */}
        {isEnded && (
          <View style={[styles.badge, styles.badgeRight, styles.badgeGray]}>
            <Text style={styles.badgeText}>Ended</Text>
          </View>
        )}
        {isFull && !isEnded && (
          <View style={[styles.badge, styles.badgeRight, styles.badgeRed]}>
            <Text style={styles.badgeText}>Full</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>{event.title}</Text>
        <Text style={styles.description} numberOfLines={2}>{event.description}</Text>

        <View style={styles.meta}>
          <Text style={styles.metaText}>
            📍 {event.city || event.venue}
          </Text>
          <Text style={styles.metaText}>
            {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            {' · '}
            {date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </Text>
        </View>

        {/* Capacity bar */}
        <View style={styles.capacityRow}>
          <Text style={styles.capacityText}>{rsvpCount} going</Text>
          <Text style={styles.capacityText}>{event.capacity} spots</Text>
        </View>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${fillPct}%`, backgroundColor: isFull ? '#ef4444' : '#6c47ff' }]} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    marginBottom: 14,
  },
  imageContainer: { height: 160, position: 'relative' },
  image: { width: '100%', height: '100%' },
  imagePlaceholder: {
    flex: 1,
    backgroundColor: '#2d1f5e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderText: { fontSize: 48, opacity: 0.4 },
  badge: {
    position: 'absolute',
    top: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  badgeLeft: { left: 10 },
  badgeRight: { right: 10 },
  badgePurple: { backgroundColor: 'rgba(108,71,255,0.9)' },
  badgeGreen: { backgroundColor: 'rgba(20,83,45,0.9)' },
  badgeGray: { backgroundColor: 'rgba(30,30,30,0.9)' },
  badgeRed: { backgroundColor: 'rgba(127,29,29,0.9)' },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  info: { padding: 14 },
  title: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 4 },
  description: { color: '#888', fontSize: 12, marginBottom: 10, lineHeight: 17 },
  meta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  metaText: { color: '#666', fontSize: 11 },
  capacityRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  capacityText: { color: '#555', fontSize: 11 },
  barTrack: { height: 4, backgroundColor: '#2a2a2a', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 4, borderRadius: 4 },
});
