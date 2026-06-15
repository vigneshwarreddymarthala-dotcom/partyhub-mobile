import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function CancelModal({ event, onConfirm, onClose, loading }) {
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Cancel RSVP?</Text>
          <Text style={styles.subtitle}>
            Are you sure you want to cancel your spot at{' '}
            <Text style={styles.eventName}>{event.title}</Text>?
          </Text>

          <View style={styles.warning}>
            <Text style={styles.warningText}>
              ⚠️  You'll lose access to the event's chat room and your spot may be taken by someone else.
            </Text>
          </View>

          <View style={styles.buttons}>
            <TouchableOpacity style={styles.keepBtn} onPress={onClose} disabled={loading}>
              <Text style={styles.keepBtnText}>Keep RSVP</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.cancelBtn, loading && styles.disabled]} onPress={onConfirm} disabled={loading}>
              <Text style={styles.cancelBtnText}>{loading ? 'Cancelling…' : 'Yes, Cancel'}</Text>
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
  warning: { backgroundColor: 'rgba(234,179,8,0.1)', borderRadius: 12, padding: 14, marginBottom: 22 },
  warningText: { color: '#ca8a04', fontSize: 13, lineHeight: 19 },
  buttons: { flexDirection: 'row', gap: 12 },
  keepBtn: { flex: 1, paddingVertical: 13, borderRadius: 14, borderWidth: 1, borderColor: '#333', alignItems: 'center' },
  keepBtnText: { color: '#aaa', fontSize: 14, fontWeight: '600' },
  cancelBtn: { flex: 1, paddingVertical: 13, borderRadius: 14, backgroundColor: '#b91c1c', alignItems: 'center' },
  cancelBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.6 },
});
