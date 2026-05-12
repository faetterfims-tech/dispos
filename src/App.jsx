import { useState, useEffect, useMemo } from 'react';
import CalendarView from './components/CalendarView';
import TaskModal    from './components/TaskModal';
import NewTaskForm  from './components/NewTaskForm';
import { buildSampleTasks, formatShort } from './utils';
import './App.css';

const STORAGE_KEY = 'dispos_tasks';
const NEXT_ID_KEY = 'dispos_next_id';

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : buildSampleTasks();
  } catch {
    return buildSampleTasks();
  }
}

function loadNextId(tasks) {
  try {
    const stored = localStorage.getItem(NEXT_ID_KEY);
    if (stored) return parseInt(stored, 10);
  } catch { /* ignore */ }
  return Math.max(0, ...tasks.map(t => t.id)) + 1;
}

function Toast({ msg, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="toast">
      <span className="toast-icon">✓</span>
      {msg}
    </div>
  );
}

export default function App() {
  const [tab,      setTab]      = useState(0);
  const [tasks,    setTasks]    = useState(loadTasks);
  const [nextId,   setNextId]   = useState(() => loadNextId(loadTasks()));
  const [selected, setSelected] = useState(null);
  const [toast,    setToast]    = useState(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem(NEXT_ID_KEY, String(nextId));
  }, [nextId]);

  const counts = useMemo(() => ({
    total:    tasks.length,
    planlagt: tasks.filter(t => t.status === 'Planlagt').length,
    aktiv:    tasks.filter(t => t.status === 'Aktiv').length,
    faerdig:  tasks.filter(t => t.status === 'Færdig').length,
  }), [tasks]);

  const handleCreate = formData => {
    const task = { ...formData, id: nextId, status: 'Planlagt', created_at: new Date().toISOString() };
    setTasks(ts => [...ts, task]);
    setNextId(id => id + 1);
    setTab(0);
    setToast(`Opgave oprettet — Chauffør ${formData.driver} · ${formatShort(formData.date)}`);
  };

  const handleStatusChange = (taskId, newStatus) => {
    setTasks(ts => ts.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    setSelected(s => s && s.id === taskId ? { ...s, status: newStatus } : s);
  };

  const todayLabel = new Date().toLocaleDateString('da-DK', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <h1>dispos<span className="header-dot">.dk</span></h1>
          <p>{todayLabel}</p>
        </div>
        <div className="header-stats">
          <div className="stat">
            <div className="stat-num">{counts.total}</div>
            <div className="stat-label">Opgaver</div>
          </div>
          <div className="stat">
            <div className="stat-num" style={{ color: '#93c5fd' }}>{counts.planlagt}</div>
            <div className="stat-label">Planlagt</div>
          </div>
          <div className="stat">
            <div className="stat-num" style={{ color: '#86efac' }}>{counts.aktiv}</div>
            <div className="stat-label">Aktiv</div>
          </div>
          <div className="stat">
            <div className="stat-num" style={{ color: '#cbd5e1' }}>{counts.faerdig}</div>
            <div className="stat-label">Færdig</div>
          </div>
        </div>
      </header>

      <nav className="tabs">
        {['Kalender', 'Ny Opgave'].map((name, i) => (
          <button
            key={name}
            className={`tab${tab === i ? ' active' : ''}`}
            onClick={() => setTab(i)}
          >
            {name}
            {i === 0 && <span className="tab-badge">{counts.total}</span>}
          </button>
        ))}
      </nav>

      {tab === 0 && <CalendarView tasks={tasks} onTaskClick={setSelected} />}
      {tab === 1 && <NewTaskForm  onCreate={handleCreate} />}

      {selected && (
        <TaskModal
          task={selected}
          onClose={() => setSelected(null)}
          onStatusChange={handleStatusChange}
        />
      )}

      {toast && <Toast msg={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
