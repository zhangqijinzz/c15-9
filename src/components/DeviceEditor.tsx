import { useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { MAX_DAILY_HOURS } from '../domain';
import type { EnergyDevice } from '../types';

interface DeviceEditorProps {
  device: EnergyDevice;
  onChange: (patch: Partial<EnergyDevice>) => void;
  onRemove: () => void;
}

type NumberField = 'watts' | 'dailyHours';

interface NumberDraftProps {
  value: number;
  field: NumberField;
  max?: number;
  onCommit: (value: number) => void;
}

function parseDraft(raw: string, max: number | undefined): number | null {
  if (raw === '') return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0 || (max !== undefined && parsed > max)) return null;
  return parsed;
}

// 数字字段在聚焦期间由本地草稿接管：键入过程中外部文档的更新不回写输入框，
// 行不会被重排、焦点与光标也不会丢。合法值实时提交（结果区照常实时刷新），
// 清空或非法的中间态留在本地，失焦/回车时归一提交；Esc 放弃本次编辑。
function NumberDraft({ value, field, max, onCommit }: NumberDraftProps) {
  const [draft, setDraft] = useState<string | null>(null);

  const editing = draft !== null;
  const shown = editing ? draft : String(value);
  const invalid = editing && draft !== '' && parseDraft(draft, max) === null;

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    setDraft(raw);
    if (raw === '') return; // 清空是过渡态，等失焦再落为 0，避免“0 + 下一个数字 = 01”这类回写
    const parsed = parseDraft(raw, max);
    if (parsed !== null && parsed !== value) onCommit(parsed);
  };

  const finish = () => {
    const parsed = draft !== null ? parseDraft(draft, max) : null;
    setDraft(null);
    if (parsed !== null && parsed !== value) onCommit(parsed);
    // 清空或非法输入：归一回文档当前有效值（空输入按 0 处理，保证模型里始终是确定数字）
    if (draft === '') onCommit(0);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.currentTarget.blur();
    } else if (event.key === 'Escape') {
      setDraft(null);
      event.currentTarget.blur();
    }
  };

  return (
    <input
      type="number"
      inputMode="decimal"
      min={0}
      max={max}
      step={field === 'watts' ? 10 : 0.5}
      value={shown}
      aria-invalid={invalid || undefined}
      data-invalid={invalid || undefined}
      onChange={onChange}
      onBlur={finish}
      onKeyDown={onKeyDown}
    />
  );
}

export function DeviceEditor({ device, onChange, onRemove }: DeviceEditorProps) {
  // 名称使用本地草稿：编辑期间不被外部状态重渲染打断，失焦/回车时提交一次。
  // 组件以 device.id 为 key 挂载，切换方案等导致设备实例变化时草稿会自然重置。
  const [nameDraft, setNameDraft] = useState(device.name);
  const commitName = () => {
    const next = nameDraft.trim();
    if (next && next !== device.name) onChange({ name: next });
    else setNameDraft(device.name);
  };

  return (
    <div className="device-row">
      <div className="device-icon">{(nameDraft || device.name).slice(0, 1) || '·'}</div>
      <label className="field device-name">
        <span>设备名称</span>
        <input
          value={nameDraft}
          onChange={(event) => setNameDraft(event.target.value)}
          onBlur={commitName}
          onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
        />
      </label>
      <label className="field">
        <span>功率 <em>W</em></span>
        <NumberDraft value={device.watts} field="watts" onCommit={(watts) => onChange({ watts })} />
      </label>
      <label className="field">
        <span>每日使用 <em>小时</em></span>
        <NumberDraft value={device.dailyHours} field="dailyHours" max={MAX_DAILY_HOURS} onCommit={(dailyHours) => onChange({ dailyHours })} />
      </label>
      <button className="icon-button" onClick={onRemove} aria-label={`移除${device.name}`}>×</button>
    </div>
  );
}
