// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { exampleScenario } from '../domain';
import { LocalEnergyRepository } from '../repository';

describe('local persistence recovery', () => {
  beforeEach(() => localStorage.clear());

  it('falls back to a valid example when saved JSON is damaged', () => {
    localStorage.setItem('energy-lens.document.v1', JSON.stringify({ version: 1, scenarios: [null], activeScenarioId: 'missing' }));
    const recovered = new LocalEnergyRepository().load();
    expect(recovered.activeScenarioId).toBe(exampleScenario.id);
    expect(recovered.scenarios[0].devices.length).toBeGreaterThan(0);
  });

  it('keeps the saved device order verbatim when reopening', () => {
    const reordered = {
      version: 1 as const,
      activeScenarioId: exampleScenario.id,
      scenarios: [{
        ...structuredClone(exampleScenario),
        devices: [...exampleScenario.devices].reverse(),
      }],
    };
    localStorage.setItem('energy-lens.document.v1', JSON.stringify(reordered));
    const recovered = new LocalEnergyRepository().load();
    expect(recovered.scenarios[0].devices.map((device) => device.id))
      .toEqual([...exampleScenario.devices].reverse().map((device) => device.id));
  });

  it('deduplicates devices sharing an id while keeping first-seen order', () => {
    const [a, b, c] = exampleScenario.devices;
    const document = {
      version: 1 as const,
      activeScenarioId: exampleScenario.id,
      scenarios: [{
        ...structuredClone(exampleScenario),
        devices: [b, a, b, c],
      }],
    };
    localStorage.setItem('energy-lens.document.v1', JSON.stringify(document));
    const recovered = new LocalEnergyRepository().load();
    expect(recovered.scenarios[0].devices.map((device) => device.id)).toEqual([b.id, a.id, c.id]);
  });
});
