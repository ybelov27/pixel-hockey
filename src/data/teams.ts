export type Conference = 'Eastern' | 'Western';
export type Division = 'Atlantic' | 'Metropolitan' | 'Central' | 'Pacific';

export interface Team {
  abbr: string;
  city: string;
  name: string;
  conference: Conference;
  division: Division;
  primary: string;
  secondary: string;
  accent: string;
  off: number;
  def: number;
  goa: number;
}

// All 32 NHL clubs (2025-26 alignment). Colors approximate each club's identity;
// ratings are fictional game-balance values.
export const TEAMS: Team[] = [
  // Eastern - Atlantic
  { abbr: 'BOS', city: 'Boston', name: 'Bruins', conference: 'Eastern', division: 'Atlantic', primary: '#FFB81C', secondary: '#000000', accent: '#FFFFFF', off: 80, def: 84, goa: 86 },
  { abbr: 'BUF', city: 'Buffalo', name: 'Sabres', conference: 'Eastern', division: 'Atlantic', primary: '#003087', secondary: '#FFB81C', accent: '#FFFFFF', off: 79, def: 76, goa: 78 },
  { abbr: 'DET', city: 'Detroit', name: 'Red Wings', conference: 'Eastern', division: 'Atlantic', primary: '#CE1126', secondary: '#FFFFFF', accent: '#FFFFFF', off: 80, def: 77, goa: 79 },
  { abbr: 'FLA', city: 'Florida', name: 'Panthers', conference: 'Eastern', division: 'Atlantic', primary: '#C8102E', secondary: '#041E42', accent: '#B9975B', off: 88, def: 87, goa: 85 },
  { abbr: 'MTL', city: 'Montreal', name: 'Canadiens', conference: 'Eastern', division: 'Atlantic', primary: '#AF1E2D', secondary: '#192168', accent: '#FFFFFF', off: 82, def: 77, goa: 80 },
  { abbr: 'OTT', city: 'Ottawa', name: 'Senators', conference: 'Eastern', division: 'Atlantic', primary: '#C52032', secondary: '#000000', accent: '#C2912C', off: 81, def: 79, goa: 81 },
  { abbr: 'TBL', city: 'Tampa Bay', name: 'Lightning', conference: 'Eastern', division: 'Atlantic', primary: '#002868', secondary: '#FFFFFF', accent: '#FFFFFF', off: 87, def: 82, goa: 88 },
  { abbr: 'TOR', city: 'Toronto', name: 'Maple Leafs', conference: 'Eastern', division: 'Atlantic', primary: '#00205B', secondary: '#FFFFFF', accent: '#FFFFFF', off: 88, def: 80, goa: 81 },
  // Eastern - Metropolitan
  { abbr: 'CAR', city: 'Carolina', name: 'Hurricanes', conference: 'Eastern', division: 'Metropolitan', primary: '#CE1126', secondary: '#000000', accent: '#A2AAAD', off: 85, def: 89, goa: 82 },
  { abbr: 'CBJ', city: 'Columbus', name: 'Blue Jackets', conference: 'Eastern', division: 'Metropolitan', primary: '#002654', secondary: '#CE1126', accent: '#FFFFFF', off: 80, def: 76, goa: 78 },
  { abbr: 'NJD', city: 'New Jersey', name: 'Devils', conference: 'Eastern', division: 'Metropolitan', primary: '#CE1126', secondary: '#000000', accent: '#FFFFFF', off: 85, def: 82, goa: 82 },
  { abbr: 'NYI', city: 'New York', name: 'Islanders', conference: 'Eastern', division: 'Metropolitan', primary: '#00539B', secondary: '#F47D30', accent: '#FFFFFF', off: 77, def: 80, goa: 84 },
  { abbr: 'NYR', city: 'New York', name: 'Rangers', conference: 'Eastern', division: 'Metropolitan', primary: '#0038A8', secondary: '#CE1126', accent: '#FFFFFF', off: 83, def: 78, goa: 89 },
  { abbr: 'PHI', city: 'Philadelphia', name: 'Flyers', conference: 'Eastern', division: 'Metropolitan', primary: '#F74902', secondary: '#000000', accent: '#FFFFFF', off: 79, def: 78, goa: 77 },
  { abbr: 'PIT', city: 'Pittsburgh', name: 'Penguins', conference: 'Eastern', division: 'Metropolitan', primary: '#000000', secondary: '#FCB514', accent: '#FCB514', off: 81, def: 75, goa: 77 },
  { abbr: 'WSH', city: 'Washington', name: 'Capitals', conference: 'Eastern', division: 'Metropolitan', primary: '#C8102E', secondary: '#041E42', accent: '#FFFFFF', off: 85, def: 83, goa: 83 },
  // Western - Central
  { abbr: 'CHI', city: 'Chicago', name: 'Blackhawks', conference: 'Western', division: 'Central', primary: '#CF0A2C', secondary: '#000000', accent: '#FFFFFF', off: 76, def: 72, goa: 76 },
  { abbr: 'COL', city: 'Colorado', name: 'Avalanche', conference: 'Western', division: 'Central', primary: '#6F263D', secondary: '#236192', accent: '#A2AAAD', off: 90, def: 84, goa: 82 },
  { abbr: 'DAL', city: 'Dallas', name: 'Stars', conference: 'Western', division: 'Central', primary: '#006847', secondary: '#8F8F8C', accent: '#FFFFFF', off: 86, def: 86, goa: 86 },
  { abbr: 'MIN', city: 'Minnesota', name: 'Wild', conference: 'Western', division: 'Central', primary: '#154734', secondary: '#A6192E', accent: '#EAAA00', off: 83, def: 83, goa: 81 },
  { abbr: 'NSH', city: 'Nashville', name: 'Predators', conference: 'Western', division: 'Central', primary: '#FFB81C', secondary: '#041E42', accent: '#041E42', off: 78, def: 77, goa: 84 },
  { abbr: 'STL', city: 'St. Louis', name: 'Blues', conference: 'Western', division: 'Central', primary: '#002F87', secondary: '#FCB514', accent: '#FFFFFF', off: 79, def: 79, goa: 82 },
  { abbr: 'UTA', city: 'Utah', name: 'Mammoth', conference: 'Western', division: 'Central', primary: '#71AFE5', secondary: '#090909', accent: '#090909', off: 82, def: 80, goa: 80 },
  { abbr: 'WPG', city: 'Winnipeg', name: 'Jets', conference: 'Western', division: 'Central', primary: '#041E42', secondary: '#004C97', accent: '#FFFFFF', off: 85, def: 84, goa: 92 },
  // Western - Pacific
  { abbr: 'ANA', city: 'Anaheim', name: 'Ducks', conference: 'Western', division: 'Pacific', primary: '#F47A38', secondary: '#000000', accent: '#FFFFFF', off: 79, def: 76, goa: 80 },
  { abbr: 'CGY', city: 'Calgary', name: 'Flames', conference: 'Western', division: 'Pacific', primary: '#C8102E', secondary: '#F1BE48', accent: '#FFFFFF', off: 77, def: 79, goa: 82 },
  { abbr: 'EDM', city: 'Edmonton', name: 'Oilers', conference: 'Western', division: 'Pacific', primary: '#041E42', secondary: '#FF4C00', accent: '#FF4C00', off: 92, def: 81, goa: 79 },
  { abbr: 'LAK', city: 'Los Angeles', name: 'Kings', conference: 'Western', division: 'Pacific', primary: '#111111', secondary: '#A2AAAD', accent: '#FFFFFF', off: 81, def: 86, goa: 82 },
  { abbr: 'SEA', city: 'Seattle', name: 'Kraken', conference: 'Western', division: 'Pacific', primary: '#001628', secondary: '#99D9D9', accent: '#99D9D9', off: 78, def: 77, goa: 78 },
  { abbr: 'SJS', city: 'San Jose', name: 'Sharks', conference: 'Western', division: 'Pacific', primary: '#006D75', secondary: '#EA7200', accent: '#FFFFFF', off: 76, def: 71, goa: 75 },
  { abbr: 'VAN', city: 'Vancouver', name: 'Canucks', conference: 'Western', division: 'Pacific', primary: '#00205B', secondary: '#00843D', accent: '#FFFFFF', off: 80, def: 80, goa: 85 },
  { abbr: 'VGK', city: 'Vegas', name: 'Golden Knights', conference: 'Western', division: 'Pacific', primary: '#B4975A', secondary: '#333F42', accent: '#FFFFFF', off: 86, def: 85, goa: 83 },
];

export const DIVISIONS: Division[] = ['Atlantic', 'Metropolitan', 'Central', 'Pacific'];

export function teamByAbbr(abbr: string): Team {
  return TEAMS.find((t) => t.abbr === abbr) || TEAMS[0];
}

export function overall(t: Team) {
  return Math.round((t.off + t.def + t.goa) / 3);
}
