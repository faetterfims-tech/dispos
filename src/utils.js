export const DRIVERS = [1, 2, 3, 4, 5, 6];
export const STATUSES = ['Planlagt', 'Aktiv', 'Færdig'];

export const STATUS_STYLE = {
  Planlagt: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af', dot: '#3b82f6' },
  Aktiv:    { bg: '#dcfce7', border: '#22c55e', text: '#15803d', dot: '#22c55e' },
  Færdig:   { bg: '#f3f4f6', border: '#9ca3af', text: '#6b7280', dot: '#9ca3af' },
};

const DAYS_DA   = ['Søn', 'Man', 'Tirs', 'Ons', 'Tors', 'Fre', 'Lør'];
const MONTHS_DA = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

export function toDateStr(d) {
  return d.toISOString().split('T')[0];
}

export function formatShort(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${DAYS_DA[d.getDay()]} ${d.getDate()}. ${MONTHS_DA[d.getMonth()]}`;
}

export function getNext14Days() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });
}

export function truncate(str, n) {
  if (!str) return '';
  return str.length > n ? str.slice(0, n) + '…' : str;
}

export function isWeekend(date) {
  const d = date.getDay();
  return d === 0 || d === 6;
}

export function buildSampleTasks() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = offset => {
    const x = new Date(today);
    x.setDate(today.getDate() + offset);
    return toDateStr(x);
  };
  return [
    { id: 1, from_address: 'Østergade 12, København K', to_address: 'Vesterbrogade 45, Frederiksberg', date: d(0), note: 'Fragile gods', contact: 'Lars Nielsen', description: 'Transport af kontormøbler fra lager til nyt kontor.', driver: 1, status: 'Aktiv', created_at: new Date().toISOString() },
    { id: 2, from_address: 'Nørrebrogade 8, København N', to_address: 'Amagerbrogade 22, København S', date: d(0), note: '', contact: 'Sofie Hansen', description: 'Levering af kontorrekvisitter og printerpapir.', driver: 3, status: 'Planlagt', created_at: new Date().toISOString() },
    { id: 3, from_address: 'Lyngby Storcenter, Lyngby', to_address: 'Ballerup Centret, Ballerup', date: d(2), note: 'Ring 30 min. inden', contact: 'Mette Sørensen', description: 'Afhentning og levering af elektronik (3 paller).', driver: 2, status: 'Planlagt', created_at: new Date().toISOString() },
    { id: 4, from_address: 'Roskildevej 78, Roskilde', to_address: 'Hillerødgade 5, Hillerød', date: d(3), note: 'Tung last', contact: 'Jonas Pedersen', description: 'Maskindele til serviceeftersyn.', driver: 5, status: 'Planlagt', created_at: new Date().toISOString() },
    { id: 5, from_address: 'Havnegade 4, Aarhus C', to_address: 'Silkeborgvej 200, Aarhus V', date: d(1), note: '', contact: 'Emma Christensen', description: 'Møbellevering — samlet ordre.', driver: 4, status: 'Aktiv', created_at: new Date().toISOString() },
    { id: 6, from_address: 'Strandvejen 100, Hellerup', to_address: 'Valby Langgade 30, Valby', date: d(5), note: '', contact: 'Peter Madsen', description: '', driver: 6, status: 'Planlagt', created_at: new Date().toISOString() },
    { id: 7, from_address: 'Jernbanevej 1, Glostrup', to_address: 'Taastrup Hovedgade 80, Taastrup', date: d(0), note: 'Morgenleverering', contact: 'Anne Lund', description: 'Daglig fragt af dagligvarer.', driver: 2, status: 'Færdig', created_at: new Date().toISOString() },
  ];
}
