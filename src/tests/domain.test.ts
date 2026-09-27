import { describe, expect, it } from 'vitest';
import { createDeviceId, estimateDevice, rankDevicesByUsage, summarizeScenario, validateDevice } from '../domain';
import type { EnergyScenario } from '../types';

describe('energy domain', () => {
  it('calculates kWh and cost from watts, hours, days and price', () => {
    const result = estimateDevice({ id: 'a', name: '空调', watts: 1000, dailyHours: 2 }, 30, 0.5);
    expect(result).toEqual({ dailyKwh: 2, monthlyKwh: 60, monthlyCost: 30 });
  });

  it('keeps device shares explainable and sums to 100%', () => {
    const scenario: EnergyScenario = { id: 's', name: 'test', pricePerKwh: 1, daysPerMonth: 30, createdAt: '', devices: [
      { id: 'a', name: 'a', watts: 100, dailyHours: 1 }, { id: 'b', name: 'b', watts: 300, dailyHours: 1 },
    ] };
    const summary = summarizeScenario(scenario);
    expect(summary.total.monthlyKwh).toBe(12);
    expect(summary.devices.map((device) => device.share)).toEqual([0.25, 0.75]);
  });

  it('rejects negative power and more than 24 hours', () => {
    expect(validateDevice({ name: 'x', watts: -1, dailyHours: 1 })).toBe('功率不能为负数');
    expect(validateDevice({ name: 'x', watts: 1, dailyHours: 24.1 })).toBe('每日使用时间不能超过 24 小时');
  });

  it('ranks devices by usage descending and breaks ties deterministically by id', () => {
    const devices = [
      { id: 'd-low', monthlyKwh: 3 },
      { id: 'd-high', monthlyKwh: 30 },
      { id: 'd-mid', monthlyKwh: 30 },
      { id: 'd-a', monthlyKwh: 30 },
    ];
    const ranked = rankDevicesByUsage(devices).map((device) => device.id);
    expect(ranked).toEqual(['d-a', 'd-high', 'd-mid', 'd-low']);
    // 多次调用结果一致，且不修改入参顺序
    expect(rankDevicesByUsage(devices).map((device) => device.id)).toEqual(ranked);
    expect(devices.map((device) => device.id)).toEqual(['d-low', 'd-high', 'd-mid', 'd-a']);
  });

  it('creates unique device ids even within the same millisecond', () => {
    const ids = new Set(Array.from({ length: 5 }, () => createDeviceId(() => 1000)));
    expect(ids.size).toBe(5);
  });
});
