import { useState } from 'react';
import { DRIVERS, toDateStr } from '../utils';

const EMPTY = { from_address: '', to_address: '', date: '', note: '', contact: '', description: '', driver: '1' };

export default function NewTaskForm({ onCreate }) {
  const todayStr = toDateStr(new Date());
  const [form, setForm]     = useState({ ...EMPTY, date: todayStr });
  const [errors, setErrors] = useState({});

  const set = field => e => setForm(f => ({ ...f, [field]: e.target.value }));

  const validate = () => {
    const e = {};
    if (!form.from_address.trim()) e.from_address = 'Afhentningsadresse er påkrævet';
    if (!form.to_address.trim())   e.to_address   = 'Leveringsadresse er påkrævet';
    if (!form.date)                e.date         = 'Dato er påkrævet';
    if (!form.contact.trim())      e.contact      = 'Kontaktperson er påkrævet';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = e => {
    e.preventDefault();
    if (!validate()) return;
    onCreate({ ...form, driver: parseInt(form.driver) });
    setForm({ ...EMPTY, date: todayStr });
    setErrors({});
  };

  return (
    <div className="form-wrapper">
      <div className="form-card">
        <div className="form-title">Opret ny transportopgave</div>
        <form onSubmit={submit}>
          <div className="form-grid">

            <div className="fg full">
              <label>Afhentningsadresse <span className="req">*</span></label>
              <input
                type="text"
                placeholder="f.eks. Østergade 12, København K"
                value={form.from_address}
                onChange={set('from_address')}
                className={errors.from_address ? 'err' : ''}
              />
              {errors.from_address && <span className="err-msg">{errors.from_address}</span>}
            </div>

            <div className="fg full">
              <label>Leveringsadresse <span className="req">*</span></label>
              <input
                type="text"
                placeholder="f.eks. Vesterbrogade 45, Frederiksberg"
                value={form.to_address}
                onChange={set('to_address')}
                className={errors.to_address ? 'err' : ''}
              />
              {errors.to_address && <span className="err-msg">{errors.to_address}</span>}
            </div>

            <div className="fg">
              <label>Dato <span className="req">*</span></label>
              <input
                type="date"
                value={form.date}
                min={todayStr}
                onChange={set('date')}
                className={errors.date ? 'err' : ''}
              />
              {errors.date && <span className="err-msg">{errors.date}</span>}
            </div>

            <div className="fg">
              <label>Chauffør</label>
              <select value={form.driver} onChange={set('driver')}>
                {DRIVERS.map(d => <option key={d} value={d}>Chauffør {d}</option>)}
              </select>
            </div>

            <div className="fg">
              <label>Kontaktperson <span className="req">*</span></label>
              <input
                type="text"
                placeholder="Navn på kontaktperson"
                value={form.contact}
                onChange={set('contact')}
                className={errors.contact ? 'err' : ''}
              />
              {errors.contact && <span className="err-msg">{errors.contact}</span>}
            </div>

            <div className="fg">
              <label>Grejnote</label>
              <input
                type="text"
                placeholder="f.eks. Fragile, løft med truck"
                value={form.note}
                onChange={set('note')}
              />
            </div>

            <div className="fg full">
              <label>Beskrivelse</label>
              <textarea
                placeholder="Yderligere oplysninger om opgaven..."
                value={form.description}
                onChange={set('description')}
              />
            </div>

            <div className="fg full">
              <button type="submit" className="btn-submit">+ Opret opgave</button>
            </div>

          </div>
        </form>
      </div>
    </div>
  );
}
