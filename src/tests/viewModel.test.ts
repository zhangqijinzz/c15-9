import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exampleScenario } from '../domain';
import type { EnergyDocument } from '../types';
import { EnergyLensViewModel } from '../viewModel';
import type { EnergyRepository } from '../repository';

function makeRepository(): EnergyRepository & { data: EnergyDocument; save: ReturnType<typeof vi.fn> } {
  const data: EnergyDocument = { version: 1, scenarios: [structuredClone(exampleScenario)], activeScenarioId: exampleScenario.id };
  return { data, load: () => data, save: vi.fn((next: EnergyDocument) => { data.scenarios = next.scenarios; data.activeScenarioId = next.activeScenarioId; }) };
}

describe('EnergyLensViewModel', () => {
  let repository: ReturnType<typeof makeRepository>;
  let vm: EnergyLensViewModel;
  beforeEach(() => { repository = makeRepository(); vm = new EnergyLensViewModel(repository); vm.initialize(); });

  it('initializes, persists edits, and recalculates results', () => {
    expect(vm.getState().status).toBe('ready');
    const before = vm.activeSummary?.total.monthlyKwh;
    vm.updateDevice('device-aircon', { dailyHours: 2 });
    expect(vm.activeSummary?.total.monthlyKwh).toBeLessThan(before ?? Infinity);
    expect(repository.save).toHaveBeenCalled();
  });

  it('keeps invalid values out of the document and exposes an error notice', () => {
    vm.updateDevice('device-aircon', { watts: -50 });
    expect(vm.getState().status).toBe('error');
    expect(vm.getState().notice?.text).toBe('功率不能为负数');
    expect(vm.activeScenario?.devices[0].watts).toBe(1200);
  });

  it('duplicates a scenario and can recover a saved document', () => {
    vm.duplicateActive();
    expect(vm.getState().document?.scenarios).toHaveLength(2);
    const recovered = new EnergyLensViewModel(repository);
    recovered.initialize();
    expect(recovered.getState().document?.scenarios).toHaveLength(2);
  });

  it('surfaces persistence failure as a recoverable error', () => {
    repository.save.mockImplementation(() => { throw new Error('quota'); });
    vm.addDevice();
    expect(vm.getState().status).toBe('error');
    expect(vm.getState().notice?.text).toContain('保存失败');
  });

  it('keeps a stable device order while edits change the usage ranking', () => {
    const orderAt = () => vm.activeScenario?.devices.map((device) => device.id);
    const initial = orderAt();
    // 把台灯功率改到远超空调：足以让结果图表重排，但编辑列表顺序不动
    vm.updateDevice('device-lamp', { watts: 9000 });
    expect(orderAt()).toEqual(initial);
    vm.updateDevice('device-aircon', { watts: 1 });
    expect(orderAt()).toEqual(initial);
  });

  it('appends new devices at the end with unique ids', () => {
    const before = vm.activeScenario?.devices.map((device) => device.id) ?? [];
    vm.addDevice();
    vm.addDevice();
    const after = vm.activeScenario?.devices ?? [];
    expect(after).toHaveLength(before.length + 2);
    expect(after.slice(0, before.length).map((device) => device.id)).toEqual(before);
    expect(new Set(after.map((device) => device.id)).size).toBe(after.length);
  });

  it('removes a device in place without reordering the rest', () => {
    const before = vm.activeScenario?.devices.map((device) => device.id) ?? [];
    vm.removeDevice('device-fridge');
    expect(vm.activeScenario?.devices.map((device) => device.id)).toEqual(before.filter((id) => id !== 'device-fridge'));
  });
});
