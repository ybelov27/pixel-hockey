import { TEAMS, teamByAbbr, type Conference, type Team } from '../data/teams';
import { RNG } from '../core/rng';

export type EndType = 'REG' | 'OT' | 'SO';

export interface Rec {
  gp: number;
  w: number;
  l: number;
  otl: number;
  pts: number;
  gf: number;
  ga: number;
}

export interface Game {
  home: string;
  away: string;
  hs: number;
  as: number;
  type: EndType;
  played: boolean;
}

export interface Series {
  hi: string;
  lo: string;
  winsHi: number;
  winsLo: number;
  conf: Conference | 'Final';
}

export interface Season {
  team: string;
  length: number;
  seriesLen: number;
  day: number;
  schedule: Game[][];
  records: Record<string, Rec>;
  phase: 'regular' | 'playoffs' | 'done';
  round: number;
  series: Series[];
  champion: string | null;
  news: string[];
  seed: number;
}

export interface Result {
  hs: number;
  as: number;
  type: EndType;
}

const emptyRec = (): Rec => ({ gp: 0, w: 0, l: 0, otl: 0, pts: 0, gf: 0, ga: 0 });

export function createSeason(team: string, length: number, seriesLen: number, seed = Date.now()): Season {
  const r = new RNG(seed);
  const abbrs = TEAMS.map((t) => t.abbr);
  const others = abbrs.filter((a) => a !== team);
  const me = teamByAbbr(team);
  // division rivals appear first in the rotation, like a real schedule
  const rivals = others.filter((a) => teamByAbbr(a).division === me.division);
  const rest = others.filter((a) => teamByAbbr(a).division !== me.division);
  shuffle(rivals, r);
  shuffle(rest, r);
  const rotation = [...rivals, ...rest];
  const schedule: Game[][] = [];
  for (let d = 0; d < length; d++) {
    const opp = rotation[d % rotation.length];
    const userHome = d % 2 === 0;
    const day: Game[] = [game(userHome ? team : opp, userHome ? opp : team)];
    const pool = abbrs.filter((a) => a !== team && a !== opp);
    shuffle(pool, r);
    for (let i = 0; i < pool.length; i += 2) day.push(game(pool[i], pool[i + 1]));
    schedule.push(day);
  }
  const records: Record<string, Rec> = {};
  for (const a of abbrs) records[a] = emptyRec();
  return { team, length, seriesLen, day: 0, schedule, records, phase: 'regular', round: 0, series: [], champion: null, news: [], seed };
}

function game(home: string, away: string): Game {
  return { home, away, hs: 0, as: 0, type: 'REG', played: false };
}

function shuffle<T>(a: T[], r: RNG) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r.next() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
}

function poisson(lambda: number, r: RNG) {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= r.next();
  } while (p > L);
  return k - 1;
}

/** Quick ratings-based simulation of a game. */
export function simGame(home: Team, away: Team, r: RNG, allowTie = true): Result {
  const lam = (o: Team, d: Team, homeIce: number) => 2.9 * (o.off / 82) * Math.pow(82 / d.def, 0.6) * Math.pow(82 / d.goa, 0.9) * homeIce;
  let hs = poisson(lam(home, away, 1.05), r);
  let as = poisson(lam(away, home, 1), r);
  let type: EndType = 'REG';
  if (hs === as) {
    const pHome = (home.off + home.goa) / (home.off + home.goa + away.off + away.goa) + 0.02;
    const homeWins = r.next() < pHome;
    type = allowTie && r.next() < 0.4 ? 'SO' : 'OT';
    if (homeWins) hs++;
    else as++;
  }
  return { hs, as, type };
}

export function applyResult(rec: Record<string, Rec>, g: Game) {
  const h = rec[g.home];
  const a = rec[g.away];
  h.gp++;
  a.gp++;
  h.gf += g.hs;
  h.ga += g.as;
  a.gf += g.as;
  a.ga += g.hs;
  const [win, lose] = g.hs > g.as ? [h, a] : [a, h];
  win.w++;
  win.pts += 2;
  if (g.type === 'REG') lose.l++;
  else {
    lose.otl++;
    lose.pts++;
  }
}

export function standings(s: Season, filter: (t: Team) => boolean) {
  return TEAMS.filter(filter)
    .map((t) => ({ team: t, rec: s.records[t.abbr] }))
    .sort((x, y) => y.rec.pts - x.rec.pts || y.rec.w - x.rec.w || y.rec.gf - y.rec.ga - (x.rec.gf - x.rec.ga) || x.team.abbr.localeCompare(y.team.abbr));
}

export function userGame(s: Season): { home: string; away: string } | null {
  if (s.phase === 'regular') {
    const g = s.schedule[s.day]?.find((x) => x.home === s.team || x.away === s.team);
    return g ? { home: g.home, away: g.away } : null;
  }
  if (s.phase === 'playoffs') {
    const ser = userSeries(s);
    if (!ser) return null;
    return homeAway(ser);
  }
  return null;
}

export function userSeries(s: Season): Series | null {
  return s.series.find((x) => (x.hi === s.team || x.lo === s.team) && !seriesDone(s, x)) || null;
}

export function seriesDone(s: Season, x: Series) {
  const need = Math.ceil(s.seriesLen / 2);
  return x.winsHi >= need || x.winsLo >= need;
}

export function seriesWinner(s: Season, x: Series) {
  const need = Math.ceil(s.seriesLen / 2);
  return x.winsHi >= need ? x.hi : x.winsLo >= need ? x.lo : null;
}

function homeAway(x: Series) {
  const pattern = [true, true, false, false, true, false, true];
  const hiHome = pattern[(x.winsHi + x.winsLo) % 7];
  return hiHome ? { home: x.hi, away: x.lo } : { home: x.lo, away: x.hi };
}

function rngFor(s: Season) {
  return new RNG(s.seed + s.day * 7919 + s.round * 104729 + s.series.reduce((n, x) => n + x.winsHi * 3 + x.winsLo, 0));
}

function label(g: { home: string; away: string; hs: number; as: number; type: EndType }) {
  const [w, l, ws, ls] = g.hs > g.as ? [g.home, g.away, g.hs, g.as] : [g.away, g.home, g.as, g.hs];
  return `${w} ${ws}-${ls} ${l}${g.type !== 'REG' ? ' ' + g.type : ''}`;
}

/** Plays one matchday (regular season) or one game of every open series (playoffs). */
export function advance(s: Season, user: Result | null) {
  const r = rngFor(s);
  if (s.phase === 'regular') {
    const day = s.schedule[s.day];
    const news: string[] = [];
    for (const g of day) {
      const mine = g.home === s.team || g.away === s.team;
      const res = mine && user ? user : simGame(teamByAbbr(g.home), teamByAbbr(g.away), r);
      g.hs = res.hs;
      g.as = res.as;
      g.type = res.type;
      g.played = true;
      applyResult(s.records, g);
      if (mine) news.unshift(label(g));
      else if (news.length < 4 && r.next() < 0.2) news.push(label(g));
    }
    s.news = news;
    s.day++;
    if (s.day >= s.length) startPlayoffs(s);
    return;
  }
  if (s.phase !== 'playoffs') return;
  const news: string[] = [];
  for (const x of s.series) {
    if (seriesDone(s, x)) continue;
    const { home, away } = homeAway(x);
    const mine = home === s.team || away === s.team;
    const res = mine && user ? user : simGame(teamByAbbr(home), teamByAbbr(away), r, false);
    const homeWon = res.hs > res.as;
    const hiWon = (home === x.hi) === homeWon;
    if (hiWon) x.winsHi++;
    else x.winsLo++;
    const line = `${label({ home, away, ...res })} (${seriesLine(s, x)})`;
    if (mine) news.unshift(line);
    else if (news.length < 4) news.push(line);
  }
  s.news = news;
  if (s.series.every((x) => seriesDone(s, x))) nextRound(s);
}

export function seriesLine(s: Season, x: Series) {
  if (x.winsHi === x.winsLo) return `TIED ${x.winsHi}-${x.winsLo}`;
  const lead = x.winsHi > x.winsLo ? x.hi : x.lo;
  const done = seriesDone(s, x);
  return `${lead} ${done ? 'WINS' : 'LEADS'} ${Math.max(x.winsHi, x.winsLo)}-${Math.min(x.winsHi, x.winsLo)}`;
}

/** NHL format: top 3 per division + 2 wild cards per conference. */
export function playoffSeeds(s: Season, conf: Conference) {
  const divs = conf === 'Eastern' ? ['Atlantic', 'Metropolitan'] : ['Central', 'Pacific'];
  const d1 = standings(s, (t) => t.division === divs[0]);
  const d2 = standings(s, (t) => t.division === divs[1]);
  const top = new Set([...d1.slice(0, 3), ...d2.slice(0, 3)].map((x) => x.team.abbr));
  const wild = standings(s, (t) => t.conference === conf && !top.has(t.abbr)).slice(0, 2);
  const better = cmp(d1[0], d2[0]) <= 0;
  const A = better ? d1 : d2;
  const B = better ? d2 : d1;
  return [
    [A[0].team.abbr, wild[1].team.abbr],
    [A[1].team.abbr, A[2].team.abbr],
    [B[0].team.abbr, wild[0].team.abbr],
    [B[1].team.abbr, B[2].team.abbr],
  ];
}

function cmp(x: { rec: Rec; team: Team }, y: { rec: Rec; team: Team }) {
  return y.rec.pts - x.rec.pts || y.rec.w - x.rec.w || y.rec.gf - y.rec.ga - (x.rec.gf - x.rec.ga);
}

function startPlayoffs(s: Season) {
  s.phase = 'playoffs';
  s.round = 1;
  s.series = [];
  for (const conf of ['Eastern', 'Western'] as Conference[]) {
    for (const [hi, lo] of playoffSeeds(s, conf)) s.series.push({ hi, lo, winsHi: 0, winsLo: 0, conf });
  }
  const inIt = s.series.some((x) => x.hi === s.team || x.lo === s.team);
  s.news = [inIt ? 'YOU MADE THE PLAYOFFS!' : 'MISSED THE PLAYOFFS'];
}

function better(s: Season, a: string, b: string) {
  const ra = s.records[a];
  const rb = s.records[b];
  return ra.pts > rb.pts || (ra.pts === rb.pts && ra.w >= rb.w) ? [a, b] : [b, a];
}

function nextRound(s: Season) {
  const winners = s.series.map((x) => seriesWinner(s, x)!);
  if (s.round === 4) {
    s.champion = winners[0];
    s.phase = 'done';
    s.news = [`${winners[0]} WIN THE PIXEL CUP!`];
    return;
  }
  const next: Series[] = [];
  if (s.round === 3) {
    const [hi, lo] = better(s, winners[0], winners[1]);
    next.push({ hi, lo, winsHi: 0, winsLo: 0, conf: 'Final' });
  } else {
    for (let i = 0; i < winners.length; i += 2) {
      const [hi, lo] = better(s, winners[i], winners[i + 1]);
      next.push({ hi, lo, winsHi: 0, winsLo: 0, conf: s.series[i].conf });
    }
  }
  s.round++;
  s.series = next;
  const alive = next.some((x) => x.hi === s.team || x.lo === s.team);
  const names = ['', 'FIRST ROUND', 'SECOND ROUND', 'CONFERENCE FINAL', 'PIXEL CUP FINAL'];
  s.news = [`${names[s.round]} BEGINS`, ...(alive ? [] : ['YOUR SEASON IS OVER'])];
}

export function isAlive(s: Season) {
  if (s.phase === 'regular') return true;
  if (s.phase === 'done') return false;
  return s.series.some((x) => (x.hi === s.team || x.lo === s.team) && !seriesDone(s, x));
}

export const ROUND_NAMES = ['', 'FIRST ROUND', 'SECOND ROUND', 'CONF. FINAL', 'CUP FINAL'];
