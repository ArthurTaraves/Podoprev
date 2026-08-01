import type { YesNo } from '../../types';

interface Props {
  label: string;
  value: YesNo;
  onChange: (value: YesNo) => void;
}

export function YesNoToggle({ label, value, onChange }: Props) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="yesno-group">
        <button
          type="button"
          className={`yesno-btn ${value === 'sim' ? 'selected-yes' : ''}`}
          onClick={() => onChange(value === 'sim' ? null : 'sim')}
        >
          Sim
        </button>
        <button
          type="button"
          className={`yesno-btn ${value === 'nao' ? 'selected-no' : ''}`}
          onClick={() => onChange(value === 'nao' ? null : 'nao')}
        >
          Não
        </button>
      </div>
    </div>
  );
}
