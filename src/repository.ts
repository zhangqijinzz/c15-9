import { exampleScenario } from './domain';
import { readDocument, writeDocument } from './services/storageService';
import type { EnergyDocument, EnergyScenario } from './types';

export interface EnergyRepository {
  load(): EnergyDocument;
  save(document: EnergyDocument): void;
}

export class LocalEnergyRepository implements EnergyRepository {
  load(): EnergyDocument {
    const saved = readDocument();
    if (!saved || saved.scenarios.length === 0) {
      return { version: 1, scenarios: [exampleScenario], activeScenarioId: exampleScenario.id };
    }
    // 设备顺序以存档数组为准（唯一 id 去重，保留首次出现的位置），
    // 这样重新打开时编辑列表与上次保存时完全一致，不依赖任何隐式排序。
    const scenarios = saved.scenarios.map((scenario) => ({ ...scenario, devices: dedupeById(scenario.devices) }));
    const document: EnergyDocument = { ...saved, scenarios };
    const activeExists = scenarios.some((scenario) => scenario.id === document.activeScenarioId);
    return activeExists ? document : { ...document, activeScenarioId: scenarios[0].id };
  }

  save(document: EnergyDocument): void {
    writeDocument(document);
  }
}

function dedupeById<T extends { id: string }>(items: readonly T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
  }
  return result;
}

export function findScenario(document: EnergyDocument, id: string): EnergyScenario | undefined {
  return document.scenarios.find((scenario) => scenario.id === id);
}
