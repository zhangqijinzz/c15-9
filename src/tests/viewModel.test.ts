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

  it('never reorders devices in the editor while parameters change', () => {
    // 初始顺序：aircon(216 kWh) > fridge(45) > lamp(1.8)
    const before = vm.activeScenario!.devices.map((device) => device.id);
    expect(before).toEqual(['device-aircon', 'device-fridge', 'device-lamp']);
    // 台灯功率大幅提高，按用电量它本应排到最前面
    vm.updateDevice('device-lamp', { watts: 5000, dailyHours: 24 });
    const after = vm.activeScenario!.devices.map((device) => device.id);
    expect(after).toEqual(['device-aircon', 'device-fridge', 'device-lamp']);
    // 但结果区排名（按用电量降序）确实变化了
    const ranked = vm.activeSummary!.devices.slice().sort((a, b) => b.monthlyKwh - a.monthlyKwh);
    expect(ranked[0].id).toBe('device-lamp');
  });

  it('appends new devices at the end and keeps their ids unique', () => {
    vm.addDevice();
    vm.addDevice();
    const ids = vm.activeScenario!.devices.map((device) => device.id);
    expect(ids).toHaveLength(5);
    expect(new Set(ids).size).toBe(5);
    expect(ids.slice(0, 3)).toEqual(['device-aircon', 'device-fridge', 'device-lamp']);
  });

  it('removes a device in place without disturbing the remaining order', () => {
    vm.removeDevice('device-fridge');
    expect(vm.activeScenario!.devices.map((device) => device.id)).toEqual(['device-aircon', 'device-lamp']);
  });

  it('keeps editing the same device in the same position across successive edits', () => {
    vm.updateDevice('device-aircon', { watts: 1 });
    vm.updateDevice('device-aircon', { dailyHours: 0.5 });
    const aircon = vm.activeScenario!.devices.find((device) => device.id === 'device-aircon');
    expect(aircon).toMatchObject({ watts: 1, dailyHours: 0.5 });
    expect(vm.activeScenario!.devices.findIndex((device) => device.id === 'device-aircon')).toBe(0);
  });

  it('appends duplicated scenarios at the end and switches to the copy', () => {
    vm.duplicateActive();
    const document = vm.getState().document!;
    expect(document.scenarios).toHaveLength(2);
    expect(document.activeScenarioId).toBe(document.scenarios[1].id);
    // 副本内设备顺序与源方案一致
    expect(document.scenarios[1].devices.map((device) => device.name))
      .toEqual(document.scenarios[0].devices.map((device) => device.name));
  });

  it('only changes the active id when switching scenarios', () => {
    vm.duplicateActive();
    const orderBefore = vm.getState().document!.scenarios.map((scenario) => scenario.id);
    vm.selectScenario(orderBefore[0]);
    const document = vm.getState().document!;
    expect(document.activeScenarioId).toBe(orderBefore[0]);
    expect(document.scenarios.map((scenario) => scenario.id)).toEqual(orderBefore);
  });

  it('restores the exact device order after reopening from storage', () => {
    vm.addDevice();
    vm.updateDevice('device-lamp', { watts: 8000 });
    vm.removeDevice('device-fridge');
    const savedOrder = vm.activeScenario!.devices.map((device) => device.id);
    const savedScenarioOrder = vm.getState().document!.scenarios.map((scenario) => scenario.id);

    const reopened = new EnergyLensViewModel(repository);
    reopened.initialize();
    expect(reopened.activeScenario!.devices.map((device) => device.id)).toEqual(savedOrder);
    expect(reopened.getState().document!.scenarios.map((scenario) => scenario.id)).toEqual(savedScenarioOrder);
  });
});
