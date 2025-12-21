// Supabase Edge Function for sending Web Push Notifications
// Uses native Web Crypto API (works in Deno)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@rally.app'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// ============================================================================
// WEB PUSH CRYPTO IMPLEMENTATION (RFC 8291)
// ============================================================================

function base64UrlDecode(str: string): Uint8Array {
  const padding = '='.repeat((4 - str.length % 4) % 4)
  const base64 = (str + padding).replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function concatBuffers(...buffers: Uint8Array[]): Uint8Array {
  const totalLength = buffers.reduce((sum, buf) => sum + buf.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const buf of buffers) {
    result.set(buf, offset)
    offset += buf.length
  }
  return result
}

// HKDF implementation using Web Crypto
async function hkdf(
  ikm: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array,
  length: number
): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    keyMaterial,
    length * 8
  )
  return new Uint8Array(derivedBits)
}

// Create VAPID JWT for authorization
async function createVapidAuthHeader(audience: string): Promise<string> {
  const header = { typ: 'JWT', alg: 'ES256' }
  const now = Math.floor(Date.now() / 1000)
  const payload = { aud: audience, exp: now + 12 * 60 * 60, sub: VAPID_SUBJECT }

  const headerB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)))
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)))
  const unsignedToken = `${headerB64}.${payloadB64}`

  // Import VAPID private key
  const privateKeyBytes = base64UrlDecode(VAPID_PRIVATE_KEY)
  const publicKeyBytes = base64UrlDecode(VAPID_PUBLIC_KEY)

  // Public key is 65 bytes: 0x04 + 32 bytes X + 32 bytes Y
  const x = base64UrlEncode(publicKeyBytes.slice(1, 33))
  const y = base64UrlEncode(publicKeyBytes.slice(33, 65))
  const d = base64UrlEncode(privateKeyBytes)

  const jwk = { kty: 'EC', crv: 'P-256', x, y, d }
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(unsignedToken)
  )

  // Convert from DER to raw format if needed (Web Crypto returns raw r||s for P-256)
  const signatureB64 = base64UrlEncode(new Uint8Array(signature))

  return `vapid t=${unsignedToken}.${signatureB64}, k=${VAPID_PUBLIC_KEY}`
}

// Encrypt payload using Web Push encryption (aes128gcm)
async function encryptPayload(
  payload: string,
  p256dhKey: string,
  authSecret: string
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; localPublicKey: Uint8Array }> {
  const encoder = new TextEncoder()

  // Decode subscriber keys
  const subscriberPublicKeyBytes = base64UrlDecode(p256dhKey)
  const authSecretBytes = base64UrlDecode(authSecret)

  // Generate ephemeral ECDH key pair
  const localKeyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])

  // Export local public key (uncompressed format)
  const localPublicKeyRaw = await crypto.subtle.exportKey('raw', localKeyPair.publicKey)
  const localPublicKey = new Uint8Array(localPublicKeyRaw)

  // Import subscriber's public key
  const subscriberPublicKey = await crypto.subtle.importKey(
    'raw',
    subscriberPublicKeyBytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  )

  // ECDH key agreement
  const sharedSecretBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: subscriberPublicKey },
    localKeyPair.privateKey,
    256
  )
  const sharedSecret = new Uint8Array(sharedSecretBits)

  // Generate random salt
  const salt = crypto.getRandomValues(new Uint8Array(16))

  // Derive IKM using HKDF
  // IKM = HKDF(salt=auth_secret, ikm=ecdh_secret, info=key_info, L=32)
  const keyInfoPrefix = encoder.encode('WebPush: info\0')
  const keyInfo = concatBuffers(keyInfoPrefix, subscriberPublicKeyBytes, localPublicKey)
  const ikm = await hkdf(sharedSecret, authSecretBytes, keyInfo, 32)

  // Derive CEK and nonce using HKDF with the random salt
  // Both use the same salt+ikm (so same PRK internally), but different info
  const cekInfo = encoder.encode('Content-Encoding: aes128gcm\0')
  const nonceInfo = encoder.encode('Content-Encoding: nonce\0')

  const cek = await hkdf(ikm, salt, cekInfo, 16)
  const nonce = await hkdf(ikm, salt, nonceInfo, 12)

  // Pad the plaintext (RFC 8291 aes128gcm format)
  // Format: [plaintext][0x02] where 0x02 indicates final record
  const plaintext = encoder.encode(payload)
  const paddedPlaintext = concatBuffers(
    plaintext,
    new Uint8Array([2]) // Delimiter byte: 2 = final record
  )

  // Encrypt with AES-128-GCM
  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, tagLength: 128 },
    aesKey,
    paddedPlaintext
  )

  return {
    ciphertext: new Uint8Array(ciphertextBuffer),
    salt,
    localPublicKey,
  }
}

// Build the encrypted content body (aes128gcm format)
function buildEncryptedBody(
  salt: Uint8Array,
  localPublicKey: Uint8Array,
  ciphertext: Uint8Array
): Uint8Array {
  // Header: salt (16) + rs (4) + idlen (1) + keyid (65)
  const rs = new Uint8Array([0, 0, 16, 0]) // Record size: 4096
  const idlen = new Uint8Array([65]) // Key ID length

  return concatBuffers(salt, rs, idlen, localPublicKey, ciphertext)
}

async function sendPushNotification(
  endpoint: string,
  p256dhKey: string,
  authKey: string,
  payload: object
): Promise<{ success: boolean; error?: string }> {
  try {
    const url = new URL(endpoint)
    const audience = `${url.protocol}//${url.host}`

    // Create VAPID authorization header
    const authHeader = await createVapidAuthHeader(audience)

    // Encrypt the payload
    const payloadString = JSON.stringify(payload)
    const { ciphertext, salt, localPublicKey } = await encryptPayload(payloadString, p256dhKey, authKey)

    // Build the body
    const body = buildEncryptedBody(salt, localPublicKey, ciphertext)

    // Send the request
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        'TTL': '86400',
        'Urgency': 'normal',
      },
      body,
    })

    if (response.ok || response.status === 201) {
      return { success: true }
    } else if (response.status === 410 || response.status === 404) {
      return { success: false, error: 'subscription_expired' }
    } else {
      const errorText = await response.text()
      return { success: false, error: `HTTP ${response.status}: ${errorText}` }
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// ============================================================================
// REQUEST HANDLING
// ============================================================================

interface PushRequest {
  type: 'session_created' | 'session_reminder' | 'waitlist_update' | 'game_results' | 'new_event' | 'event_reminder' | 'comment_reply' | 'custom'
  sessionId?: string
  playerId?: string
  eventId?: string
  title?: string
  body?: string
  url?: string
  sessionDetails?: { date: string; time: string; location: string }
  gameDetails?: { result: 'win' | 'loss'; ratingChange: number; newRating: number }
  eventDetails?: { title: string; date?: string; time?: string; host?: string; location?: string; commenterName?: string }
}

interface DBPushSubscription {
  player_id: string
  player_name: string
  endpoint: string
  p256dh_key: string
  auth_key: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function formatNotification(request: PushRequest): { title: string; body: string; data: object } {
  switch (request.type) {
    case 'session_created':
      return {
        title: 'New Session Posted!',
        body: request.sessionDetails
          ? `${request.sessionDetails.date} at ${request.sessionDetails.time} - ${request.sessionDetails.location}`
          : 'A new volleyball session is available!',
        data: { type: 'session_created', url: '/' }
      }
    case 'session_reminder':
      return {
        title: 'Session Starting Soon!',
        body: request.sessionDetails
          ? `Your session at ${request.sessionDetails.location} starts in 1 hour!`
          : 'Your volleyball session starts in 1 hour!',
        data: { type: 'session_reminder', url: '/' }
      }
    case 'waitlist_update':
      return {
        title: "You're In!",
        body: "A spot opened up and you've been moved off the waitlist.",
        data: { type: 'waitlist_update', url: '/' }
      }
    case 'game_results':
      if (request.gameDetails) {
        const change = request.gameDetails.ratingChange > 0
          ? `+${request.gameDetails.ratingChange}`
          : `${request.gameDetails.ratingChange}`
        return {
          title: request.gameDetails.result === 'win' ? 'Victory!' : 'Game Complete',
          body: `Rating: ${change} (now ${request.gameDetails.newRating})`,
          data: { type: 'game_results', url: '/profile' }
        }
      }
      return { title: 'Game Results', body: 'Check your updated rating!', data: { type: 'game_results', url: '/profile' } }
    case 'new_event':
      return {
        title: 'New Event Posted!',
        body: request.eventDetails
          ? `${request.eventDetails.title} - ${request.eventDetails.date} at ${request.eventDetails.time}`
          : 'A new volleyball event is available!',
        data: { type: 'new_event', url: request.eventId ? `/events/${request.eventId}` : '/events' }
      }
    case 'event_reminder':
      return {
        title: 'Event Starting Soon!',
        body: request.eventDetails
          ? `${request.eventDetails.title} at ${request.eventDetails.location} starts in 1 hour!`
          : 'Your volleyball event starts in 1 hour!',
        data: { type: 'event_reminder', url: request.eventId ? `/events/${request.eventId}` : '/events' }
      }
    case 'comment_reply':
      return {
        title: 'New Reply to Your Comment',
        body: request.eventDetails
          ? `${request.eventDetails.commenterName} replied on "${request.eventDetails.title}"`
          : 'Someone replied to your comment!',
        data: { type: 'comment_reply', url: request.eventId ? `/events/${request.eventId}` : '/events' }
      }
    case 'custom':
      return {
        title: request.title || 'Rally',
        body: request.body || 'You have a new notification',
        data: { type: 'custom', url: request.url || '/' }
      }
    default:
      return { title: 'Rally', body: 'You have a new notification', data: { type: 'unknown', url: '/' } }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      throw new Error('VAPID credentials not configured')
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const body: PushRequest = await req.json()
    const notification = formatNotification(body)

    let recipients: DBPushSubscription[] = []

    switch (body.type) {
      case 'session_created': {
        const { data, error } = await supabase.rpc('get_push_notification_recipients', { notification_type: 'session_created' })
        if (error) throw error
        recipients = data || []
        break
      }
      case 'session_reminder': {
        if (!body.sessionId) throw new Error('sessionId required')
        const { data, error } = await supabase.rpc('get_session_push_recipients', { session_uuid: body.sessionId })
        if (error) throw error
        recipients = data || []
        break
      }
      case 'waitlist_update':
      case 'game_results': {
        if (!body.playerId) throw new Error('playerId required')
        const { data: subs } = await supabase.from('push_subscriptions').select('*').eq('player_id', body.playerId)
        const { data: player } = await supabase.from('players').select('name, push_notifications_enabled, notification_preferences').eq('id', body.playerId).single()
        const prefKey = body.type === 'waitlist_update' ? 'waitlist_update' : 'game_results'
        if (player?.push_notifications_enabled && player.notification_preferences?.[prefKey]) {
          recipients = (subs || []).map(s => ({ ...s, player_name: player.name }))
        }
        break
      }
      case 'new_event': {
        // Use the same function as session_created - notify users with session_created preference
        const { data, error } = await supabase.rpc('get_push_notification_recipients', { notification_type: 'session_created' })
        if (error) throw error
        recipients = data || []
        break
      }
      case 'event_reminder': {
        // Notify users who RSVP'd "going" to the event
        if (!body.eventId) throw new Error('eventId required')
        const { data: rsvps } = await supabase
          .from('open_session_rsvps')
          .select('player_id')
          .eq('session_id', body.eventId)
          .eq('status', 'going')

        if (rsvps && rsvps.length > 0) {
          const playerIds = rsvps.map(r => r.player_id)
          const { data: subs } = await supabase
            .from('push_subscriptions')
            .select('*, players!inner(name, push_notifications_enabled, notification_preferences)')
            .in('player_id', playerIds)

          recipients = (subs || [])
            .filter((s: any) => s.players?.push_notifications_enabled && s.players?.notification_preferences?.session_reminder)
            .map((s: any) => ({ ...s, player_name: s.players?.name || 'Player' }))
        }
        break
      }
      case 'comment_reply': {
        // Notify the specific player who is receiving the reply
        if (!body.playerId) throw new Error('playerId required')
        const { data: subs } = await supabase.from('push_subscriptions').select('*').eq('player_id', body.playerId)
        const { data: player } = await supabase.from('players').select('name, push_notifications_enabled').eq('id', body.playerId).single()
        if (player?.push_notifications_enabled) {
          recipients = (subs || []).map(s => ({ ...s, player_name: player.name }))
        }
        break
      }
      case 'custom': {
        if (body.playerId) {
          const { data: subs } = await supabase.from('push_subscriptions').select('*').eq('player_id', body.playerId)
          const { data: player } = await supabase.from('players').select('name').eq('id', body.playerId).single()
          recipients = (subs || []).map(s => ({ ...s, player_name: player?.name || 'Player' }))
        }
        break
      }
    }

    const expiredSubscriptions: string[] = []
    const results = await Promise.all(
      recipients.map(async (r) => {
        const result = await sendPushNotification(r.endpoint, r.p256dh_key, r.auth_key, {
          title: notification.title,
          body: notification.body,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          data: notification.data,
        })

        await supabase.from('push_notification_logs').insert({
          player_id: r.player_id,
          notification_type: body.type,
          title: notification.title,
          body: notification.body,
          status: result.success ? 'sent' : 'failed',
          error_message: result.error,
          sent_at: result.success ? new Date().toISOString() : null,
        })

        if (result.error === 'subscription_expired') expiredSubscriptions.push(r.endpoint)
        return { playerId: r.player_id, playerName: r.player_name, success: result.success, error: result.error }
      })
    )

    if (expiredSubscriptions.length > 0) {
      await supabase.from('push_subscriptions').delete().in('endpoint', expiredSubscriptions)
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Push Error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
