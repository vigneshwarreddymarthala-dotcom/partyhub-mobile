import { useEffect, useState, useRef } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function ChatScreen({ route, navigation }) {
  const { room, isAdmin } = route.params;
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const ev = room.events;
  const isEnded = ev?.status === 'ended';

  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [kicked, setKicked] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    navigation.setOptions({ headerTitle: ev?.title ?? 'Chat' });
    fetchMessages();

    const msgChannel = supabase
      .channel(`room:${room.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${room.id}` },
        async (payload) => {
          // Fetch profile name for new message
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', payload.new.user_id)
            .maybeSingle();
          const enriched = { ...payload.new, profiles: profile };
          setMessages(prev => [...prev, enriched]);
          setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
        }
      ).subscribe();

    return () => supabase.removeChannel(msgChannel);
  }, [room.id]);

  // Watch for RSVP deletion (kick)
  useEffect(() => {
    if (isAdmin) return;
    const channel = supabase
      .channel(`kick_watch:${room.event_id}`)
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'rsvps', filter: `user_id=eq.${session.user.id}` },
        (payload) => {
          if (payload.old.event_id === room.event_id) setKicked(true);
        }
      ).subscribe();
    return () => supabase.removeChannel(channel);
  }, [isAdmin, room.event_id, session]);

  async function fetchMessages() {
    const { data } = await supabase
      .from('messages')
      .select('id, content, created_at, user_id, profiles(full_name)')
      .eq('room_id', room.id)
      .order('created_at', { ascending: true })
      .limit(100);
    setMessages(data ?? []);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);
  }

  async function sendMessage() {
    if (!newMsg.trim() || !room) return;
    setSending(true);
    const content = newMsg.trim();
    setNewMsg('');
    await supabase.from('messages').insert({
      room_id: room.id,
      user_id: session.user.id,
      content,
    });
    setSending(false);
  }

  if (kicked) {
    return (
      <View style={styles.kickedContainer}>
        <Text style={styles.kickedEmoji}>🚫</Text>
        <Text style={styles.kickedTitle}>You've been removed</Text>
        <Text style={styles.kickedSub}>An admin removed you from this event's chat.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Back to Rooms</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderMessage({ item: msg, index }) {
    const isMe = msg.user_id === session.user.id;
    const prevMsg = messages[index - 1];
    const sameUser = prevMsg?.user_id === msg.user_id;
    const time = new Date(msg.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

    return (
      <View style={[styles.msgWrapper, isMe ? styles.msgWrapperMe : styles.msgWrapperThem, !sameUser && styles.msgGroupTop]}>
        {!isMe && !sameUser && (
          <Text style={styles.senderName}>{msg.profiles?.full_name ?? 'User'}</Text>
        )}
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
          <Text style={styles.bubbleText}>{msg.content}</Text>
          <Text style={[styles.bubbleTime, isMe ? styles.bubbleTimeMe : styles.bubbleTimeThem]}>{time}</Text>
        </View>
      </View>
    );
  }

  const canSend = !isEnded || isAdmin;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Meet link banner */}
      {ev?.meet_link && !isEnded && (
        <TouchableOpacity
          style={styles.meetBanner}
          onPress={() => Linking.openURL(ev.meet_link)}
        >
          <Text style={styles.meetBannerPin}>📌 Meet link</Text>
          <Text style={styles.meetBannerLink} numberOfLines={1}>📹 Join Google Meet ↗</Text>
        </TouchableOpacity>
      )}

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <Text style={styles.emptyChatEmoji}>👋</Text>
            <Text style={styles.emptyChatText}>No messages yet. Say hi!</Text>
          </View>
        }
      />

      {/* Input */}
      {canSend ? (
        <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
          <TextInput
            style={styles.input}
            value={newMsg}
            onChangeText={setNewMsg}
            placeholder={isAdmin ? 'Message as admin…' : 'Message…'}
            placeholderTextColor="#555"
            maxLength={1000}
            multiline
            returnKeyType="send"
            onSubmitEditing={sendMessage}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!newMsg.trim() || sending) && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!newMsg.trim() || sending}
          >
            <Text style={styles.sendBtnIcon}>➤</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.readOnlyBar, { paddingBottom: insets.bottom + 8 }]}>
          <Text style={styles.readOnlyText}>This event has ended. Chat is read-only.</Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0814' },

  // Meet banner
  meetBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: 'rgba(5,46,22,0.6)', borderBottomWidth: 1, borderBottomColor: 'rgba(22,101,52,0.4)',
  },
  meetBannerPin: { color: '#4ade80', fontSize: 12, fontWeight: '600' },
  meetBannerLink: { color: '#86efac', fontSize: 12, fontWeight: '700', flex: 1, textAlign: 'right' },

  // Messages
  messageList: { padding: 12, paddingBottom: 8, flexGrow: 1 },
  emptyChat: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyChatEmoji: { fontSize: 36, marginBottom: 10 },
  emptyChatText: { color: '#555', fontSize: 14 },

  msgWrapper: { marginTop: 2 },
  msgWrapperMe: { alignItems: 'flex-end' },
  msgWrapperThem: { alignItems: 'flex-start' },
  msgGroupTop: { marginTop: 12 },

  senderName: { color: '#8b5cf6', fontSize: 12, fontWeight: '600', marginBottom: 2, marginLeft: 2 },

  bubble: { maxWidth: '78%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18 },
  bubbleMe: { backgroundColor: '#6c47ff', borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: '#1f1f1f', borderBottomLeftRadius: 4 },
  bubbleText: { color: '#fff', fontSize: 14, lineHeight: 20 },
  bubbleTime: { fontSize: 10, marginTop: 3 },
  bubbleTimeMe: { color: 'rgba(255,255,255,0.5)', textAlign: 'right' },
  bubbleTimeThem: { color: '#555' },

  // Input bar
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 12, paddingTop: 10,
    backgroundColor: '#111', borderTopWidth: 1, borderTopColor: '#1f1f1f',
  },
  input: {
    flex: 1, backgroundColor: '#1f1f1f', borderRadius: 20, borderWidth: 1, borderColor: '#2a2a2a',
    paddingHorizontal: 16, paddingVertical: 10, color: '#fff', fontSize: 14, maxHeight: 100,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: '#6c47ff',
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.35 },
  sendBtnIcon: { color: '#fff', fontSize: 16, marginLeft: 2 },

  readOnlyBar: {
    paddingHorizontal: 16, paddingTop: 12,
    backgroundColor: '#111', borderTopWidth: 1, borderTopColor: '#1f1f1f', alignItems: 'center',
  },
  readOnlyText: { color: '#444', fontSize: 12 },

  // Kicked
  kickedContainer: { flex: 1, backgroundColor: '#0f0f0f', alignItems: 'center', justifyContent: 'center', padding: 32 },
  kickedEmoji: { fontSize: 52, marginBottom: 16 },
  kickedTitle: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 8 },
  kickedSub: { color: '#666', fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  backBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, backgroundColor: '#1f1f1f' },
  backBtnText: { color: '#bbb', fontSize: 14, fontWeight: '600' },
});
