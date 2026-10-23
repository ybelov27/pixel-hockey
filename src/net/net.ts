import { Peer, type DataConnection } from 'peerjs';

/**
 * Peer-to-peer link for online 1v1. PeerJS's free public broker only
 * introduces the two players; game traffic then flows directly over a
 * WebRTC data channel, so the game needs no server of its own.
 */
const PREFIX = 'pixelhockey-v1-';
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LEN = 5;
export const CODE_ALPHABET = ALPHABET;
export const NET_VERSION = 1;

function newCode() {
  let s = '';
  for (let i = 0; i < CODE_LEN; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
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
      return 'ROOM NOT FOUND - CHECK THE CODE';
    case 'browser-incompatible':
      return 'THIS BROWSER CAN NOT PLAY ONLINE';
    case 'network':
    case 'server-error':
    case 'socket-error':
    case 'socket-closed':
      return "CAN'T REACH THE MATCHMAKING SERVER";
    default:
      return 'CONNECTION ERROR';
  }
}

export type NetMessage = { t: string; [k: string]: unknown };

export class NetLink {
  code = '';
  status = 'CONNECTING...';
  error = '';
  open = false;
  onMessage: (m: NetMessage) => void = () => {};
  onOpen: () => void = () => {};
  onClose: () => void = () => {};
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private closed = false;

  /** Create a room and wait for an opponent to join with its code. */
  static host() {
    const link = new NetLink();
    link.startHost(0);
    return link;
  }

  /** Join the room with this code. */
  static join(code: string) {
    const link = new NetLink();
    link.code = code.toUpperCase();
    link.startJoin();
    return link;
  }

  private startHost(attempt: number) {
    this.code = newCode();
    const peer = new Peer(PREFIX + this.code, peerOptions());
    this.peer = peer;
    peer.on('open', () => {
      this.status = 'WAITING FOR OPPONENT...';
    });
    peer.on('connection', (conn) => {
      if (this.conn) {
        conn.close();
        return;
      }
      this.attach(conn);
    });
    peer.on('error', (err: { type: string }) => {
      if (err.type === 'unavailable-id' && attempt < 5) {
        peer.destroy();
        this.startHost(attempt + 1);
        return;
      }
      this.fail(describe(err.type));
    });
  }

  private startJoin() {
    const peer = new Peer(peerOptions());
    this.peer = peer;
    const timer = window.setTimeout(() => {
      if (!this.open) this.fail("COULDN'T CONNECT - TRY AGAIN");
    }, 15000);
    peer.on('open', () => {
      this.status = 'JOINING ROOM...';
      const conn = peer.connect(PREFIX + this.code, { reliable: true, serialization: 'json' });
      this.attach(conn);
    });
    peer.on('error', (err: { type: string }) => {
      window.clearTimeout(timer);
      this.fail(describe(err.type));
    });
  }

  private attach(conn: DataConnection) {
    this.conn = conn;
    conn.on('open', () => {
      this.open = true;
      this.status = 'CONNECTED';
      this.onOpen();
    });
    conn.on('data', (d) => {
      if (d && typeof d === 'object') this.onMessage(d as NetMessage);
    });
    conn.on('close', () => this.lost());
    conn.on('error', () => this.lost());
  }

  private lost() {
    if (this.closed) return;
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
    if (this.conn && this.open) this.conn.send(m);
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    try {
      if (this.open) this.conn?.send({ t: 'bye' });
      this.conn?.close();
      this.peer?.destroy();
    } catch {
      /* already gone */
    }
  }
}
