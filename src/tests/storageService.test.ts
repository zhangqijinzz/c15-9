// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { exampleScenario } from '../domain';
import { LocalEnergyRepository } from '../repository';
import { readDocument, writeDocument } from '../services/storageService';

describe('local persistence recovery', () => {
  beforeEach(() => localStorage.clear());

  it('falls back to a valid example when saved JSON is damaged', () => {
    localStorage.setItem('energy-lens.document.v1', JSON.stringify({ version: 1, scenarios: [null], activeScenarioId: 'missing' }));
    const recovered = new LocalEnergyRepository().load();
    expect(recovered.activeScenarioId).toBe(exampleScenario.id);
    expect(recovered.scenarios[0].devices.length).toBeGreaterThan(0);
  });

  it('keeps scenario and device order identical across a save/load round trip', () => {
    const document = {
      version: 1 as const,
      activeScenarioId: exampleScenario.id,
      scenarios: [{
        ...exampleScenario,
        devices: [
          { id: 'device-lamp', name: '书桌台灯', watts: 12, dailyHours: 5 },
          { id: 'device-aircon', name: '客厅空调', watts: 1200, dailyHours: 6 },
          { id: 'device-fridge', name: '冰箱', watts: 150, dailyHours: 10 },
        ],
      }],
    };
    writeDocument(document);
    const loaded = readDocument();
    expect(loaded!.scenarios.map((scenario) => scenario.id)).toEqual([exampleScenario.id]);
    expect(loaded!.scenarios[0].devices.map((device) => device.id)).toEqual([
      'device-lamp', 'device-aircon', 'device-fridge',
    ]);
  });
});
