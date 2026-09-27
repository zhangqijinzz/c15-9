import type { EnergyDevice, EnergyEstimate, EnergyScenario, ScenarioSummary } from './types';

export const MAX_DAILY_HOURS = 24;

export const exampleScenario: EnergyScenario = {
  id: 'scenario-home',
  name: '夏日居家方案',
  pricePerKwh: 0.62,
  daysPerMonth: 30,
  createdAt: '2026-01-01T00:00:00.000Z',
  devices: [
    { id: 'device-aircon', name: '客厅空调', watts: 1200, dailyHours: 6 },
    { id: 'device-fridge', name: '冰箱', watts: 150, dailyHours: 10 },
    { id: 'device-lamp', name: '书桌台灯', watts: 12, dailyHours: 5 },
  ],
};

export function estimateDevice(device: EnergyDevice, daysPerMonth: number, pricePerKwh: number): EnergyEstimate {
  const dailyKwh = (device.watts * device.dailyHours) / 1000;
  const monthlyKwh = dailyKwh * daysPerMonth;
  return { dailyKwh, monthlyKwh, monthlyCost: monthlyKwh * pricePerKwh };
}

export function summarizeScenario(scenario: EnergyScenario): ScenarioSummary {
  const devices = scenario.devices.map((device) => ({
    ...device,
    ...estimateDevice(device, scenario.daysPerMonth, scenario.pricePerKwh),
    share: 0,
  }));
  const total = devices.reduce(
    (sum, device) => ({
      dailyKwh: sum.dailyKwh + device.dailyKwh,
      monthlyKwh: sum.monthlyKwh + device.monthlyKwh,
      monthlyCost: sum.monthlyCost + device.monthlyCost,
    }),
    { dailyKwh: 0, monthlyKwh: 0, monthlyCost: 0 },
  );
  return {
    total,
    devices: devices.map((device) => ({ ...device, share: total.monthlyKwh ? device.monthlyKwh / total.monthlyKwh : 0 })),
  };
}

// 结果区专用：按月度用电量从大到小排列。
// 用电量相同时用 id 兜底，保证任意两次排序结果完全一致（新增/删除/切换方案/重开都不会“这次一个样下次另一个样”）。
// 注意：编辑区的设备列表永远使用文档里的存储顺序，绝不调用此排序，避免编辑中行跳动、焦点丢失。
export function rankDevicesByUsage<T extends { id: string; monthlyKwh: number }>(devices: readonly T[]): T[] {
  return devices.slice().sort((a, b) => (b.monthlyKwh - a.monthlyKwh) || idTieBreak(a.id, b.id));
}

function idTieBreak(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

let scenarioSequence = 0;

export function createScenarioId(now: () => number = () => Date.now()): string {
  scenarioSequence = (scenarioSequence + 1) % Number.MAX_SAFE_INTEGER;
  return `scenario-${now()}-${scenarioSequence.toString(36)}`;
}

let deviceSequence = 0;

// 设备 id 同时带时间戳与进程内自增序号，即使同一毫秒连续新增也不会重复，列表 key 始终稳定。
export function createDeviceId(now: () => number = () => Date.now()): string {
  deviceSequence = (deviceSequence + 1) % Number.MAX_SAFE_INTEGER;
  return `device-${now()}-${deviceSequence.toString(36)}`;
}

export function validateDevice(device: Pick<EnergyDevice, 'name' | 'watts' | 'dailyHours'>): string | null {
  if (!device.name.trim()) return '请填写设备名称';
  if (!Number.isFinite(device.watts) || device.watts < 0) return '功率不能为负数';
  if (!Number.isFinite(device.dailyHours) || device.dailyHours < 0) return '使用时间不能为负数';
  if (device.dailyHours > MAX_DAILY_HOURS) return '每日使用时间不能超过 24 小时';
  return null;
}

export function validateScenarioSettings(pricePerKwh: number, daysPerMonth: number): string | null {
  if (!Number.isFinite(pricePerKwh) || pricePerKwh < 0) return '电价不能为负数';
  if (!Number.isFinite(daysPerMonth) || daysPerMonth < 1 || daysPerMonth > 31) return '计费天数需在 1–31 天之间';
  return null;
}

export function formatNumber(value: number, digits = 2): string {
  return value.toLocaleString('zh-CN', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function cloneScenario(source: EnergyScenario, id: string, name: string): EnergyScenario {
  return { ...source, id, name, createdAt: new Date().toISOString(), devices: source.devices.map((device) => ({ ...device, id: `${id}-${device.id}` })) };
}
