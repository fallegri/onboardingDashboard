import { describe, it, expect, beforeEach } from 'vitest';
import {
  moduloObjetivos,
  createObjective,
  linkKPI,
  unlinkKPI,
  getObjectivesByPerspective,
  getUnlinkedObjectives,
  resetState,
} from '../../../src/modules/objetivos/modulo-objetivos';
import type { BSCPerspective } from '../../../src/types/common';

// ─── Helper Factories ────────────────────────────────────────────────────────

function createValidObjectiveData(overrides: Partial<{
  name: string;
  description: string;
  perspective: BSCPerspective;
}> = {}): { name: string; description: string; perspective: BSCPerspective } {
  return {
    name: overrides.name ?? 'Increase revenue by 10%',
    description: overrides.description ?? 'Strategic objective to boost annual revenue',
    perspective: overrides.perspective ?? 'financial' as BSCPerspective,
  };
}

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  resetState();
});

// ─── createObjective Tests ───────────────────────────────────────────────────

describe('createObjective', () => {
  it('should create an objective with valid data', () => {
    const data = createValidObjectiveData();
    const result = createObjective(data);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe(data.name);
      expect(result.value.description).toBe(data.description);
      expect(result.value.perspective).toBe(data.perspective);
      expect(result.value.linkedKPIIds).toEqual([]);
      expect(result.value.id).toBeTruthy();
    }
  });

  it('should generate unique IDs for each objective', () => {
    const result1 = createObjective(createValidObjectiveData());
    const result2 = createObjective(createValidObjectiveData({ name: 'Second objective' }));

    expect(result1.ok).toBe(true);
    expect(result2.ok).toBe(true);
    if (result1.ok && result2.ok) {
      expect(result1.value.id).not.toBe(result2.value.id);
    }
  });

  it('should allow creating up to 20 objectives', () => {
    for (let i = 0; i < 20; i++) {
      const result = createObjective(createValidObjectiveData({ name: `Objective ${i + 1}` }));
      expect(result.ok).toBe(true);
    }
  });

  it('should reject creation when 20 objectives exist', () => {
    for (let i = 0; i < 20; i++) {
      createObjective(createValidObjectiveData({ name: `Objective ${i + 1}` }));
    }

    const result = createObjective(createValidObjectiveData({ name: 'Objective 21' }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('MAX_OBJECTIVES_REACHED');
      expect(result.error.module).toBe('objetivos');
    }
  });

  it('should reject name longer than 150 characters', () => {
    const longName = 'a'.repeat(151);
    const result = createObjective(createValidObjectiveData({ name: longName }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_NAME_LENGTH');
    }
  });

  it('should accept name of exactly 150 characters', () => {
    const exactName = 'a'.repeat(150);
    const result = createObjective(createValidObjectiveData({ name: exactName }));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe(exactName);
    }
  });

  it('should reject empty name', () => {
    const result = createObjective(createValidObjectiveData({ name: '' }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_NAME_LENGTH');
    }
  });

  it('should reject description longer than 500 characters', () => {
    const longDesc = 'b'.repeat(501);
    const result = createObjective(createValidObjectiveData({ description: longDesc }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_DESCRIPTION_LENGTH');
    }
  });

  it('should accept description of exactly 500 characters', () => {
    const exactDesc = 'b'.repeat(500);
    const result = createObjective(createValidObjectiveData({ description: exactDesc }));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.description).toBe(exactDesc);
    }
  });

  it('should accept empty description', () => {
    const result = createObjective(createValidObjectiveData({ description: '' }));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.description).toBe('');
    }
  });

  it('should accept all four BSC perspectives', () => {
    const perspectives: BSCPerspective[] = [
      'financial', 'customers', 'internal_processes', 'learning_growth',
    ];

    for (const perspective of perspectives) {
      const result = createObjective(createValidObjectiveData({
        name: `Obj ${perspective}`,
        perspective,
      }));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.perspective).toBe(perspective);
      }
    }
  });
});

// ─── linkKPI Tests ───────────────────────────────────────────────────────────

describe('linkKPI', () => {
  it('should link a KPI to an existing objective', () => {
    const objResult = createObjective(createValidObjectiveData());
    expect(objResult.ok).toBe(true);
    if (!objResult.ok) return;

    const linkResult = linkKPI('kpi_001', objResult.value.id);

    expect(linkResult.ok).toBe(true);
    if (linkResult.ok) {
      expect(linkResult.value.kpiId).toBe('kpi_001');
      expect(linkResult.value.objectiveId).toBe(objResult.value.id);
    }
  });

  it('should update the objective linkedKPIIds after linking', () => {
    const objResult = createObjective(createValidObjectiveData());
    expect(objResult.ok).toBe(true);
    if (!objResult.ok) return;

    linkKPI('kpi_001', objResult.value.id);

    const byPerspective = getObjectivesByPerspective();
    const financialObjs = byPerspective.get('financial')!;
    expect(financialObjs[0]!.linkedKPIIds).toContain('kpi_001');
  });

  it('should allow linking up to 5 objectives per KPI', () => {
    const objectiveIds: string[] = [];
    for (let i = 0; i < 5; i++) {
      const result = createObjective(createValidObjectiveData({ name: `Obj ${i}` }));
      if (result.ok) objectiveIds.push(result.value.id);
    }

    for (const objId of objectiveIds) {
      const linkResult = linkKPI('kpi_shared', objId);
      expect(linkResult.ok).toBe(true);
    }
  });

  it('should reject linking a KPI to more than 5 objectives', () => {
    const objectiveIds: string[] = [];
    for (let i = 0; i < 6; i++) {
      const result = createObjective(createValidObjectiveData({ name: `Obj ${i}` }));
      if (result.ok) objectiveIds.push(result.value.id);
    }

    for (let i = 0; i < 5; i++) {
      linkKPI('kpi_limited', objectiveIds[i]!);
    }

    const result = linkKPI('kpi_limited', objectiveIds[5]!);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('MAX_LINKS_PER_KPI');
    }
  });

  it('should reject linking to a non-existent objective', () => {
    const result = linkKPI('kpi_001', 'non_existent_id');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('OBJECTIVE_NOT_FOUND');
    }
  });

  it('should reject duplicate link', () => {
    const objResult = createObjective(createValidObjectiveData());
    if (!objResult.ok) return;

    linkKPI('kpi_001', objResult.value.id);
    const duplicateResult = linkKPI('kpi_001', objResult.value.id);

    expect(duplicateResult.ok).toBe(false);
    if (!duplicateResult.ok) {
      expect(duplicateResult.error.code).toBe('DUPLICATE_LINK');
    }
  });

  it('should allow different KPIs to link to the same objective', () => {
    const objResult = createObjective(createValidObjectiveData());
    if (!objResult.ok) return;

    const link1 = linkKPI('kpi_001', objResult.value.id);
    const link2 = linkKPI('kpi_002', objResult.value.id);

    expect(link1.ok).toBe(true);
    expect(link2.ok).toBe(true);
  });
});

// ─── unlinkKPI Tests ─────────────────────────────────────────────────────────

describe('unlinkKPI', () => {
  it('should remove an existing link', () => {
    const objResult = createObjective(createValidObjectiveData());
    if (!objResult.ok) return;

    linkKPI('kpi_001', objResult.value.id);
    const unlinkResult = unlinkKPI('kpi_001', objResult.value.id);

    expect(unlinkResult.ok).toBe(true);
  });

  it('should update the objective linkedKPIIds after unlinking', () => {
    const objResult = createObjective(createValidObjectiveData());
    if (!objResult.ok) return;

    linkKPI('kpi_001', objResult.value.id);
    unlinkKPI('kpi_001', objResult.value.id);

    const byPerspective = getObjectivesByPerspective();
    const financialObjs = byPerspective.get('financial')!;
    expect(financialObjs[0]!.linkedKPIIds).not.toContain('kpi_001');
  });

  it('should return error when link does not exist', () => {
    const objResult = createObjective(createValidObjectiveData());
    if (!objResult.ok) return;

    const result = unlinkKPI('kpi_999', objResult.value.id);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('LINK_NOT_FOUND');
    }
  });

  it('should allow relinking after unlinking', () => {
    const objResult = createObjective(createValidObjectiveData());
    if (!objResult.ok) return;

    linkKPI('kpi_001', objResult.value.id);
    unlinkKPI('kpi_001', objResult.value.id);
    const relinkResult = linkKPI('kpi_001', objResult.value.id);

    expect(relinkResult.ok).toBe(true);
  });

  it('should free up the KPI link count after unlinking', () => {
    const objectiveIds: string[] = [];
    for (let i = 0; i < 6; i++) {
      const result = createObjective(createValidObjectiveData({ name: `Obj ${i}` }));
      if (result.ok) objectiveIds.push(result.value.id);
    }

    // Link to 5 objectives
    for (let i = 0; i < 5; i++) {
      linkKPI('kpi_full', objectiveIds[i]!);
    }

    // Unlink one
    unlinkKPI('kpi_full', objectiveIds[0]!);

    // Should now be able to link to a 6th (new 5th) objective
    const result = linkKPI('kpi_full', objectiveIds[5]!);
    expect(result.ok).toBe(true);
  });
});

// ─── getObjectivesByPerspective Tests ────────────────────────────────────────

describe('getObjectivesByPerspective', () => {
  it('should return all 4 perspectives even when empty', () => {
    const result = getObjectivesByPerspective();

    expect(result.size).toBe(4);
    expect(result.has('financial')).toBe(true);
    expect(result.has('customers')).toBe(true);
    expect(result.has('internal_processes')).toBe(true);
    expect(result.has('learning_growth')).toBe(true);
  });

  it('should group objectives by their perspective', () => {
    createObjective(createValidObjectiveData({ name: 'Fin 1', perspective: 'financial' }));
    createObjective(createValidObjectiveData({ name: 'Fin 2', perspective: 'financial' }));
    createObjective(createValidObjectiveData({ name: 'Cust 1', perspective: 'customers' }));
    createObjective(createValidObjectiveData({ name: 'Proc 1', perspective: 'internal_processes' }));

    const result = getObjectivesByPerspective();

    expect(result.get('financial')!.length).toBe(2);
    expect(result.get('customers')!.length).toBe(1);
    expect(result.get('internal_processes')!.length).toBe(1);
    expect(result.get('learning_growth')!.length).toBe(0);
  });

  it('should return empty arrays for perspectives with no objectives', () => {
    const result = getObjectivesByPerspective();

    for (const [, objs] of result) {
      expect(objs).toEqual([]);
    }
  });
});

// ─── getUnlinkedObjectives Tests ─────────────────────────────────────────────

describe('getUnlinkedObjectives', () => {
  it('should return all objectives when none are linked', () => {
    createObjective(createValidObjectiveData({ name: 'Obj 1' }));
    createObjective(createValidObjectiveData({ name: 'Obj 2' }));

    const unlinked = getUnlinkedObjectives();
    expect(unlinked.length).toBe(2);
  });

  it('should exclude objectives that have linked KPIs', () => {
    const obj1 = createObjective(createValidObjectiveData({ name: 'Linked' }));
    createObjective(createValidObjectiveData({ name: 'Unlinked' }));

    if (obj1.ok) {
      linkKPI('kpi_001', obj1.value.id);
    }

    const unlinked = getUnlinkedObjectives();
    expect(unlinked.length).toBe(1);
    expect(unlinked[0]!.name).toBe('Unlinked');
  });

  it('should return empty array when all objectives are linked', () => {
    const obj1 = createObjective(createValidObjectiveData({ name: 'Obj 1' }));
    const obj2 = createObjective(createValidObjectiveData({ name: 'Obj 2' }));

    if (obj1.ok) linkKPI('kpi_001', obj1.value.id);
    if (obj2.ok) linkKPI('kpi_002', obj2.value.id);

    const unlinked = getUnlinkedObjectives();
    expect(unlinked.length).toBe(0);
  });

  it('should return empty array when no objectives exist', () => {
    const unlinked = getUnlinkedObjectives();
    expect(unlinked.length).toBe(0);
  });

  it('should include objective again after unlinking its only KPI', () => {
    const objResult = createObjective(createValidObjectiveData());
    if (!objResult.ok) return;

    linkKPI('kpi_001', objResult.value.id);
    expect(getUnlinkedObjectives().length).toBe(0);

    unlinkKPI('kpi_001', objResult.value.id);
    expect(getUnlinkedObjectives().length).toBe(1);
  });
});

// ─── Module Object Tests ─────────────────────────────────────────────────────

describe('moduloObjetivos module object', () => {
  it('should expose MAX_OBJECTIVES as 20', () => {
    expect(moduloObjetivos.MAX_OBJECTIVES).toBe(20);
  });

  it('should expose MAX_OBJECTIVES_PER_KPI as 5', () => {
    expect(moduloObjetivos.MAX_OBJECTIVES_PER_KPI).toBe(5);
  });

  it('should expose all interface methods', () => {
    expect(typeof moduloObjetivos.createObjective).toBe('function');
    expect(typeof moduloObjetivos.linkKPI).toBe('function');
    expect(typeof moduloObjetivos.unlinkKPI).toBe('function');
    expect(typeof moduloObjetivos.getObjectivesByPerspective).toBe('function');
    expect(typeof moduloObjetivos.getUnlinkedObjectives).toBe('function');
  });
});
