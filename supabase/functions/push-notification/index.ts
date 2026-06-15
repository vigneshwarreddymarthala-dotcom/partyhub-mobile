import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req) => {
  try {
    const payload = await req.json();

    // Database webhook sends { type, table, record, old_record }
    const message = payload.record ?? payload;
    const { room_id, user_id: sender_id, content } = message;

    if (!room_id || !sender_id) {
      return new Response('missing fields', { status: 400 });
    }

    // Get the event linked to this room
    const { data: room } = await supabase
      .from('chat_rooms')
      .select('event_id, events(title)')
      .eq('id', room_id)
      .single();

    if (!room) return new Response('room not found', { status: 404 });

    const eventTitle = room.events?.title ?? 'PartyHub';

    // Get all RSVPs for this event (everyone in the room)
    const { data: rsvps } = await supabase
      .from('rsvps')
      .select('user_id')
      .eq('event_id', room.event_id)
      .neq('user_id', sender_id); // exclude sender

    if (!rsvps || rsvps.length === 0) {
      return new Response('no recipients', { status: 200 });
    }

    const userIds = rsvps.map(r => r.user_id);

    // Get push tokens + sender name
    const [{ data: profiles }, { data: sender }] = await Promise.all([
      supabase.from('profiles').select('push_token').in('id', userIds),
      supabase.from('profiles').select('full_name').eq('id', sender_id).single(),
    ]);

    const tokens = (profiles ?? [])
      .map(p => p.push_token)
      .filter(Boolean);

    if (tokens.length === 0) {
      return new Response('no push tokens', { status: 200 });
    }

    const senderName = sender?.full_name ?? 'Someone';

    // Send via Expo Push API
    const notifications = tokens.map(token => ({
      to: token,
      title: eventTitle,
      body: `${senderName}: ${content.slice(0, 100)}`,
      sound: 'default',
      channelId: 'messages',
      data: { room_id, event_id: room.event_id },
    }));

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(notifications),
    });

    const result = await response.json();
    return new Response(JSON.stringify(result), { status: 200 });

  } catch (err) {
    console.error(err);
    return new Response(String(err), { status: 500 });
  }
});
