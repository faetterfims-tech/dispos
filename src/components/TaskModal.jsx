import { STATUS_STYLE, STATUSES, formatShort } from '../utils';

export default function TaskModal({ task, onClose, onStatusChange }) {
  const s      = STATUS_STYLE[task.status];
  const others = STATUSES.filter(st => st !== task.status);

  const handleOverlayClick = e => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="overlay" onClick={handleOverlayClick}>
      <div className="modal">
        <div className="modal-top">
          <div className="modal-title">Chauffør {task.driver} — Opgave #{task.id}</div>
          <button className="modal-close" onClick={onClose} aria-label="Luk">×</button>
        </div>

        <div className="status-pill" style={{ background: s.bg, borderColor: s.border, color: s.text }}>
          <span className="status-dot" style={{ background: s.dot }} />
          {task.status}
        </div>

        <div className="details">
          <div className="route-box">
            <div className="route-arrow">
              <div className="route-from">
                <div className="d-label">Afhentning</div>
                <div className="d-value">{task.from_address}</div>
              </div>
              <div className="arrow-icon">→</div>
              <div className="route-to">
                <div className="d-label">Levering</div>
                <div className="d-value">{task.to_address}</div>
              </div>
            </div>
          </div>

          <div className="detail">
            <div className="d-label">Dato</div>
            <div className="d-value">{formatShort(task.date)}</div>
          </div>
          <div className="detail">
            <div className="d-label">Kontaktperson</div>
            <div className="d-value">{task.contact}</div>
          </div>

          {task.note && (
            <div className="detail full">
              <div className="d-label">Grejnote</div>
              <div className="d-value">{task.note}</div>
            </div>
          )}
          {task.description && (
            <div className="detail full">
              <div className="d-label">Beskrivelse</div>
              <div className="d-value">{task.description}</div>
            </div>
          )}
        </div>

        {others.length > 0 && (
          <>
            <hr className="modal-divider" />
            <div className="status-actions-label">SKIFT STATUS</div>
            <div className="status-actions">
              {others.map(st => {
                const ss = STATUS_STYLE[st];
                return (
                  <button
                    key={st}
                    className="btn-status"
                    style={{ borderColor: ss.border, color: ss.text }}
                    onClick={() => onStatusChange(task.id, st)}
                  >
                    {st}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
