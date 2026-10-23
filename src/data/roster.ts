import { RNG, hashString } from '../core/rng';
import { clamp } from '../core/math';
import type { Team } from './teams';

export interface PlayerInfo {
  name: string;
  number: number;
  pos: 'F' | 'D' | 'G';
  spd: number;
  sht: number;
  pas: number;
  hnd: number;
  chk: number;
  def: number;
  fo: number;
  goa: number;
  stamina: number;
}

export interface Roster {
  forwards: PlayerInfo[]; // 12, lines of 3 (C, LW, RW)
  defense: PlayerInfo[]; // 6, pairs (LD, RD)
  goalies: PlayerInfo[]; // 2
}

// Fictional surnames only: no real NHL players.
const SURNAMES = [
  'ABBOTT', 'ALDER', 'BAKKE', 'BARRETT', 'BECK', 'BERGSTROM', 'BLAIS', 'BRODY', 'CALLAHAN', 'CARVER', 'CHASE', 'CLOUTIER',
  'CORBIN', 'CROSSLEY', 'DALEY', 'DEVRIES', 'DOYLE', 'DRAPEAU', 'DUNMORE', 'EKLUND', 'ELLIS', 'FALK', 'FENWICK', 'FISCHER',
  'FOLEY', 'FROST', 'GAGNE', 'GALLOWAY', 'GRAHAM', 'GRIMSBY', 'HALLER', 'HARLOW', 'HAYES', 'HOLM', 'HUSAK', 'IVERSEN',
  'JANSEN', 'JOLICOEUR', 'KAPANEN', 'KEMP', 'KIRBY', 'KOVAC', 'KRAUSE', 'LACHANCE', 'LANGLEY', 'LARSEN', 'LEDUC', 'LINDGREN',
  'MACRAE', 'MALLORY', 'MARCHETTI', 'MERCIER', 'MOREAU', 'NASH', 'NIEMI', 'NORDIN', 'NOVAK', 'OAKES', 'OLSEN', 'ORLOV',
  'PAGE', 'PELLETIER', 'PETRIK', 'PRATT', 'QUILL', 'RADEK', 'REILLY', 'RIDGE', 'ROUSSEL', 'RYDER', 'SAARI', 'SALO',
  'SAVARD', 'SHAW', 'SKALA', 'SORENSEN', 'STROM', 'SULLY', 'TALBOT', 'TESSIER', 'THORNE', 'TOIVONEN', 'TRUDEAU', 'VACHON',
  'VANEK', 'VOSS', 'WADE', 'WALLIN', 'WEBER', 'WHITLOCK', 'WINTER', 'YATES', 'ZAJAC', 'ZELLER', 'BOUCHARD', 'HENNING',
];

const cache = new Map<string, Roster>();

export function rosterFor(team: Team): Roster {
  const hit = cache.get(team.abbr);
  if (hit) return hit;
  const r = new RNG(hashString(team.abbr + team.name));
  const used = new Set<number>();
  const names = new Set<string>();
  const num = () => {
    let n = 0;
    do n = r.int(2, 98);
    while (used.has(n));
    used.add(n);
    return n;
  };
  const name = () => {
    let s = '';
    do s = r.pick(SURNAMES);
    while (names.has(s));
    names.add(s);
    return s;
  };
  const rate = (base: number, spread: number, tier: number) => clamp(Math.round(base + r.gauss() * spread - tier * 3), 45, 99);

  const forwards: PlayerInfo[] = [];
  for (let i = 0; i < 12; i++) {
    const tier = Math.floor(i / 3);
    const o = team.off;
    forwards.push({
      name: name(), number: num(), pos: 'F',
      spd: rate(o, 5, tier), sht: rate(o + 2, 6, tier), pas: rate(o, 5, tier), hnd: rate(o + 1, 5, tier),
      chk: rate(team.def - 4, 8, tier), def: rate(team.def - 6, 6, tier), fo: rate(o - 2, 8, tier), goa: 0, stamina: 100,
    });
  }
  const defense: PlayerInfo[] = [];
  for (let i = 0; i < 6; i++) {
    const tier = Math.floor(i / 2);
    const d = team.def;
    defense.push({
      name: name(), number: num(), pos: 'D',
      spd: rate(team.off - 5, 5, tier), sht: rate(team.off - 4, 7, tier), pas: rate(team.off - 2, 5, tier), hnd: rate(team.off - 5, 5, tier),
      chk: rate(d + 3, 6, tier), def: rate(d + 3, 5, tier), fo: 50, goa: 0, stamina: 100,
    });
  }
  const goalies: PlayerInfo[] = [0, 1].map((i) => ({
    name: name(), number: i === 0 ? r.pick([1, 30, 31, 35, 40]) : r.pick([29, 33, 34, 39, 50]), pos: 'G' as const,
    spd: 60, sht: 40, pas: 60, hnd: 60, chk: 40, def: 60, fo: 0, goa: clamp(team.goa - i * 6, 50, 99), stamina: 100,
  }));
  const roster = { forwards, defense, goalies };
  cache.set(team.abbr, roster);
  return roster;
}
