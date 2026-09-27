import { describe, expect, it } from 'vitest';
import { createId, estimateDevice, rankDevicesByUsage, summarizeScenario, validateDevice } from '../domain';
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

  it('ranks devices by monthly kWh descending, breaking ties by id', () => {
    const devices = [
      { id: 'b', name: 'b', watts: 100, dailyHours: 1, monthlyKwh: 10 },
      { id: 'c', name: 'c', watts: 500, dailyHours: 1, monthlyKwh: 50 },
      { id: 'a', name: 'a', watts: 100, dailyHours: 1, monthlyKwh: 10 },
    ];
    expect(rankDevicesByUsage(devices).map((device) => device.id)).toEqual(['c', 'a', 'b']);
  });

  it('does not mutate the source array when ranking', () => {
    const devices = [
      { id: 'x', name: 'x', watts: 10, dailyHours: 1, monthlyKwh: 1 },
      { id: 'y', name: 'y', watts: 90, dailyHours: 1, monthlyKwh: 9 },
    ];
    rankDevicesByUsage(devices);
    expect(devices.map((device) => device.id)).toEqual(['x', 'y']);
  });

  it('ranking is total and independent of input order', () => {
    const forward = [
      { id: 'a', monthlyKwh: 5 },
      { id: 'b', monthlyKwh: 5 },
      { id: 'c', monthlyKwh: 20 },
    ];
    const backward = forward.slice().reverse();
    expect(rankDevicesByUsage(forward).map((device) => device.id))
      .toEqual(rankDevicesByUsage(backward).map((device) => device.id));
  });

  it('creates unique ids even when generated back to back', () => {
    const ids = new Set(Array.from({ length: 50 }, () => createId('device')));
    expect(ids.size).toBe(50);
  });
});
