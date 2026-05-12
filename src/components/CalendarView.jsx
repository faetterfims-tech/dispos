import { useMemo } from 'react';
import { DRIVERS, STATUS_STYLE, getNext14Days, toDateStr, truncate, isWeekend } from '../utils';

const DAYS_DA   = ['Søn', 'Man', 'Tirs', 'Ons', 'Tors', 'Fre', 'Lør'];
const MONTHS_DA = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

function TaskCard({ task, onClick }) {
  const s = STATUS_STYLE[task.status];
  const from = task.from_address.split(',')[0];
  const to   = task.to_address.split(',')[0];
  return (
    <div
      className="task-card"
      onClick={() => onClick(task)}
      style={{ background: s.bg, borderLeftColor: s.border, color: s.text }}
    >
      <div className="task-route">{truncate(from, 12)} → {truncate(to, 12)}</div>
      <div className="task-contact">{truncate(task.contact, 20)}</div>
      <div className="task-status-tag" style={{ color: s.border }}>{task.status}</div>
    </div>
  );
}

export default function CalendarView({ tasks, onTaskClick }) {
  const days      = useMemo(() => getNext14Days(), []);
  const todayStr  = toDateStr(new Date());
  const colTemplate = `140px repeat(14, minmax(110px, 1fr))`;

  const taskMap = useMemo(() => {
    const m = {};
    tasks.forEach(t => {
      const k = `${t.driver}-${t.date}`;
      if (!m[k]) m[k] = [];
      m[k].push(t);
    });
    return m;
  }, [tasks]);

  return (
    <div className="calendar-wrapper">
      <div className="calendar-grid">
        {/* Header row */}
        <div className="grid-header-row" style={{ gridTemplateColumns: colTemplate }}>
          <div className="grid-header-cell">Chauffør</div>
          {days.map(d => {
            const isT = toDateStr(d) === todayStr;
            return (
              <div key={d.toISOString()} className={`grid-header-cell${isT ? ' is-today' : ''}`}>
                <div className="day-name">{DAYS_DA[d.getDay()]}</div>
                <div className="day-num">{d.getDate()}</div>
                <div className="day-month">{MONTHS_DA[d.getMonth()]}</div>
              </div>
            );
          })}
        </div>

        {/* Driver rows */}
        {DRIVERS.map(drv => (
          <div key={drv} className="grid-driver-row" style={{ gridTemplateColumns: colTemplate }}>
            <div className="driver-label-cell">
              <span className="driver-chip">Chauffør {drv}</span>
            </div>
            {days.map(d => {
              const dateStr  = toDateStr(d);
              const isT      = dateStr === todayStr;
              const isWE     = isWeekend(d);
              const cellTasks = taskMap[`${drv}-${dateStr}`] || [];
              return (
                <div
                  key={dateStr}
                  className={`day-cell${isT ? ' is-today' : ''}${isWE && !isT ? ' is-weekend' : ''}`}
                >
                  {cellTasks.map(t => (
                    <TaskCard key={t.id} task={t} onClick={onTaskClick} />
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
