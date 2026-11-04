import { Peer, type DataConnection } from 'peerjs';

/**
 * Peer-to-peer link for online 1v1. PeerJS's free public broker only
 * introduces the two players; game traffic then flows directly over a
 * WebRTC data channel (or PeerJS's TURN relay on strict networks), so the
 * game needs no server of its own.
 *
 * Phones drop the broker connection whenever the app goes to the
 * background (for example while the host texts the room code), so the link
 * reconnects to the broker on its own and the guest keeps retrying a room
 * for a while before giving up.
 */
const PREFIX = 'pixelhockey-v1-';
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LEN = 5;
export const CODE_ALPHABET = ALPHABET;
export const NET_VERSION = 1;
const JOIN_TIMEOUT = 30000;
const ROOM_RETRY_MS = 2500;

function newCode() {
  let s = '';
  for (let i = 0; i < CODE_LEN; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}

export function isRoomCode(s: string) {
  return s.length === CODE_LEN && [...s].every((c) => ALPHABET.includes(c));
}

function peerOptions() {
  // ?peer=host:port points the game at a self-hosted PeerServer (used by tests)
  const q = new URLSearchParams(location.search).get('peer');
  if (q) {
    const [host, port] = q.split(':');
    return { host, port: Number(port || 9000), path: '/', secure: false, debug: 0 as const };
  }
  return { debug: 0 as const };
}

function describe(type: string) {
  switch (type) {
    case 'peer-unavailable':
      return 'ROOM NOT FOUND - CHECK THE CODE, AND THAT YOUR FRIEND IS STILL ON THE ROOM SCREEN';
    case 'browser-incompatible':
      return 'THIS BROWSER CAN NOT PLAY ONLINE';
    case 'network':
    case 'server-error':
    case 'socket-error':
    case 'socket-closed':
      return "CAN'T REACH THE MATCHMAKING SERVER - CHECK YOUR INTERNET AND TRY AGAIN";
    case 'webrtc':
      return "COULDN'T OPEN A CONNECTION BETWEEN YOUR DEVICES - TRY ANOTHER NETWORK";
    default:
      return `CONNECTION ERROR (${type.toUpperCase()})`;
  }
}

export type NetMessage = { t: string; [k: string]: unknown };

export class NetLink {
  code = '';
  status = 'CONNECTING TO SERVER...';
  error = '';
  open = false;
  onMessage: (m: NetMessage) => void = () => {};
  onOpen: () => void = () => {};
  onClose: () => void = () => {};
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private closed = false;
  private hosting = false;
  private joinDeadline = 0;
  private joinTimer = 0;
  private reconnectTimer = 0;
  private onVisible = () => {
    if (!document.hidden) this.ensureBroker();
  };

  constructor() {
    document.addEventListener('visibilitychange', this.onVisible);
  }

  /** Create a room and wait for an opponent to join with its code. */
  static host() {
    const link = new NetLink();
    link.hosting = true;
    link.startHost(0);
    return link;
  }

  /** Join the room with this code. */
  static join(code: string) {
    const link = new NetLink();
    link.code = code.toUpperCase();
    link.joinDeadline = Date.now() + JOIN_TIMEOUT;
    link.startJoin();
    return link;
  }

  /** Link to send a friend: opening it jumps straight into joining this room. */
  inviteUrl() {
    const u = new URL(location.href);
    u.search = '';
    u.hash = '';
    u.searchParams.set('join', this.code);
    const peer = new URLSearchParams(location.search).get('peer');
    if (peer) u.searchParams.set('peer', peer);
    return u.toString();
  }

  /** Bytes queued on the data channel but not yet sent (a sign the link is falling behind). */
  backlog() {
    try {
      return this.conn?.dataChannel?.bufferedAmount ?? 0;
    } catch {
      return 0;
    }
  }

  private watchBroker(peer: Peer) {
    peer.on('disconnected', () => {
      if (this.closed || peer !== this.peer) return;
      if (!this.open) this.status = 'RECONNECTING TO SERVER...';
      this.scheduleReconnect(800);
    });
  }

  private scheduleReconnect(ms: number) {
    window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = window.setTimeout(() => this.ensureBroker(), ms);
  }

  /** Get back onto the broker (keeping the same room code) if the phone dropped it. */
  private ensureBroker() {
    const peer = this.peer;
    if (this.closed || !peer || peer.destroyed || !peer.disconnected) return;
    try {
      peer.reconnect();
    } catch {
      /* retried below */
    }
    this.scheduleReconnect(4000);
  }

  private startHost(attempt: number) {
    this.code = newCode();
    const peer = new Peer(PREFIX + this.code, peerOptions());
    this.peer = peer;
    this.watchBroker(peer);
    peer.on('open', () => {
      if (!this.open) this.status = 'WAITING FOR OPPONENT...';
    });
    peer.on('connection', (conn) => {
      if (this.conn && this.open) {
        conn.close();
        return;
      }
      this.attach(conn);
    });
    peer.on('error', (err: { type: string }) => {
      if (this.closed) return;
      if (err.type === 'unavailable-id' && attempt < 5) {
        peer.destroy();
        this.startHost(attempt + 1);
        return;
      }
      // the broker blips on phones: keep the room alive and reconnect
      if (['network', 'server-error', 'socket-error', 'socket-closed', 'disconnected'].includes(err.type) && !peer.destroyed) {
        this.status = 'RECONNECTING TO SERVER...';
        this.scheduleReconnect(1500);
        return;
      }
      if (err.type === 'webrtc' && !this.open) {
        // a failed attempt by the guest; keep waiting for the next one
        this.status = 'WAITING FOR OPPONENT...';
        return;
      }
      this.fail(describe(err.type));
    });
  }

  private startJoin() {
    const peer = new Peer(peerOptions());
    this.peer = peer;
    this.watchBroker(peer);
    this.joinTimer = window.setTimeout(() => {
      if (!this.open) this.fail(this.conn ? describe('webrtc') : describe('peer-unavailable'));
    }, JOIN_TIMEOUT);
    const tryConnect = () => {
      if (this.closed || this.open) return;
      this.status = `LOOKING FOR ROOM ${this.code}...`;
      this.conn?.close();
      const conn = peer.connect(PREFIX + this.code, { reliable: true, serialization: 'json' });
      this.attach(conn);
      window.setTimeout(() => {
        if (!this.closed && !this.open && this.conn === conn) this.status = 'CONNECTING TO YOUR FRIEND...';
      }, 1200);
    };
    peer.on('open', () => tryConnect());
    peer.on('error', (err: { type: string }) => {
      if (this.closed || this.open) return;
      // the host may be reconnecting after switching apps: keep trying for a while
      if ((err.type === 'peer-unavailable' || err.type === 'webrtc') && Date.now() + ROOM_RETRY_MS < this.joinDeadline) {
        this.status = err.type === 'peer-unavailable' ? `WAITING FOR ROOM ${this.code}...` : 'RETRYING...';
        window.setTimeout(() => {
          if (peer.disconnected) this.ensureBroker();
          else tryConnect();
        }, ROOM_RETRY_MS);
        return;
      }
      if (['network', 'server-error', 'socket-error', 'socket-closed', 'disconnected'].includes(err.type) && Date.now() < this.joinDeadline) {
        this.status = 'RECONNECTING TO SERVER...';
        this.scheduleReconnect(1500);
        return;
      }
      this.fail(describe(err.type));
    });
  }

  private attach(conn: DataConnection) {
    this.conn = conn;
    conn.on('open', () => {
      if (this.closed) return;
      window.clearTimeout(this.joinTimer);
      this.open = true;
      this.status = 'CONNECTED';
      this.onOpen();
    });
    conn.on('data', (d) => {
      if (d && typeof d === 'object') this.onMessage(d as NetMessage);
    });
    conn.on('close', () => {
      if (conn === this.conn) this.lost();
    });
    conn.on('error', () => {
      if (conn === this.conn && this.open) this.lost();
    });
  }

  private lost() {
    if (this.closed) return;
    if (!this.open) {
      // never opened: the host keeps waiting, the guest's retry loop carries on
      if (this.hosting) this.conn = null;
      return;
    }
    this.open = false;
    this.status = 'DISCONNECTED';
    this.onClose();
  }

  private fail(msg: string) {
    if (this.closed) return;
    this.error = msg;
    this.status = msg;
    this.onClose();
  }

  send(m: NetMessage) {
    if (this.conn && this.open) {
      try {
        this.conn.send(m);
      } catch {
        /* channel closing; the close handler reports it */
      }
    }
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    window.clearTimeout(this.joinTimer);
    window.clearTimeout(this.reconnectTimer);
    document.removeEventListener('visibilitychange', this.onVisible);
    try {
      if (this.open) this.conn?.send({ t: 'bye' });
      this.conn?.close();
      this.peer?.destroy();
    } catch {
      /* already gone */
    }
  }
}
