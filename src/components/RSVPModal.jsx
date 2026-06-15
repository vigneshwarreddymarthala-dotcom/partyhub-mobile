import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function RSVPModal({ event, onConfirm, onClose, loading }) {
  const date = new Date(event.date);
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Confirm RSVP</Text>
          <Text style={styles.subtitle}>
            You're reserving a spot at{' '}
            <Text style={styles.eventName}>{event.title}</Text>.
          </Text>

          <View style={styles.meta}>
            <Text style={styles.metaRow}>
              📅  {date.toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </Text>
            <Text style={styles.metaRow}>📍  {event.venue}</Text>
          </View>

          <Text style={styles.note}>
            After confirming, you'll get access to the event's private chat room.
          </Text>

          <View style={styles.buttons}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={loading}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.confirmBtn, loading && styles.disabled]} onPress={onConfirm} disabled={loading}>
              <Text style={styles.confirmBtnText}>{loading ? 'Confirming…' : 'Confirm RSVP'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  sheet: { backgroundColor: '#1a1a1a', borderRadius: 20, padding: 24, width: '100%', borderWidth: 1, borderColor: '#2a2a2a' },
  title: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 6 },
  subtitle: { color: '#888', fontSize: 14, marginBottom: 18, lineHeight: 20 },
  eventName: { color: '#fff', fontWeight: '700' },
  meta: { gap: 8, marginBottom: 16 },
  metaRow: { color: '#bbb', fontSize: 13, lineHeight: 20 },
  note: { color: '#555', fontSize: 12, marginBottom: 22, lineHeight: 18 },
  buttons: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, paddingVertical: 13, borderRadius: 14, borderWidth: 1, borderColor: '#333', alignItems: 'center' },
  cancelBtnText: { color: '#aaa', fontSize: 14, fontWeight: '600' },
  confirmBtn: { flex: 1, paddingVertical: 13, borderRadius: 14, backgroundColor: '#6c47ff', alignItems: 'center' },
  confirmBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.6 },
});
