import type { BSCPerspective } from '../../types/common';
import type { StrategicObjective, KPILink } from '../../types/session';
import type { ObjectiveError, LinkError } from '../../types/errors';
import type { Result } from '../../types/result';
import { ok, err } from '../../types/result';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Maximum number of strategic objectives allowed */
const MAX_OBJECTIVES = 20;

/** Maximum number of objectives a single KPI can be linked to */
const MAX_OBJECTIVES_PER_KPI = 5;

/** Maximum length for objective name */
const MAX_NAME_LENGTH = 150;

/** Maximum length for objective description */
const MAX_DESCRIPTION_LENGTH = 500;

// ─── Interface ───────────────────────────────────────────────────────────────

/**
 * @description Interface for the strategic objectives module.
 * Manages BSC objectives, KPI linking, and perspective grouping.
 */
export interface IModuloObjetivos {
  createObjective(data: Omit<StrategicObjective, 'id' | 'linkedKPIIds'>): Result<StrategicObjective, ObjectiveError>;
  linkKPI(kpiId: string, objectiveId: string): Result<KPILink, LinkError>;
  unlinkKPI(kpiId: string, objectiveId: string): Result<void, LinkError>;
  getObjectivesByPerspective(): Map<BSCPerspective, StrategicObjective[]>;
  getUnlinkedObjectives(): StrategicObjective[];
  readonly MAX_OBJECTIVES: 20;
  readonly MAX_OBJECTIVES_PER_KPI: 5;
}

// ─── Module State ────────────────────────────────────────────────────────────

/** Internal counter for generating unique IDs */
let idCounter = 0;

/** In-memory store for strategic objectives */
let objectives: StrategicObjective[] = [];

/** In-memory store for KPI-Objective links */
let links: KPILink[] = [];

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * @description Generates a unique identifier for a new objective.
 * @returns A unique string ID
 */
function generateId(): string {
  idCounter++;
  return `obj_${idCounter}_${Date.now()}`;
}

/**
 * @description Creates an ObjectiveError with the given code and message.
 * @param code - The error code
 * @param message - The error message
 * @returns An ObjectiveError object
 */
function createObjectiveError(
  code: ObjectiveError['code'],
  message: string,
): ObjectiveError {
  return {
    code,
    message,
    timestamp: new Date().toISOString(),
    module: 'objetivos',
  };
}

/**
 * @description Creates a LinkError with the given code and message.
 * @param code - The error code
 * @param message - The error message
 * @returns A LinkError object
 */
function createLinkError(
  code: LinkError['code'],
  message: string,
): LinkError {
  return {
    code,
    message,
    timestamp: new Date().toISOString(),
    module: 'objetivos',
  };
}

/**
 * @description Counts how many objectives a KPI is currently linked to.
 * @param kpiId - The KPI identifier to count links for
 * @returns The number of objectives linked to this KPI
 */
function countLinksForKPI(kpiId: string): number {
  return links.filter((link) => link.kpiId === kpiId).length;
}

// ─── Core Logic ──────────────────────────────────────────────────────────────

/**
 * @description Creates a new strategic objective with validation.
 * Enforces max 20 objectives, name length (150 chars), and description length (500 chars).
 * @param data - Objective data without id and linkedKPIIds
 * @returns Result containing the created objective or an ObjectiveError
 */
export function createObjective(
  data: Omit<StrategicObjective, 'id' | 'linkedKPIIds'>,
): Result<StrategicObjective, ObjectiveError> {
  if (objectives.length >= MAX_OBJECTIVES) {
    return err(createObjectiveError(
      'MAX_OBJECTIVES_REACHED',
      `Se alcanzó el límite máximo de ${MAX_OBJECTIVES} objetivos estratégicos.`,
    ));
  }

  if (!data.name || data.name.length > MAX_NAME_LENGTH) {
    return err(createObjectiveError(
      'INVALID_NAME_LENGTH',
      `El nombre debe tener entre 1 y ${MAX_NAME_LENGTH} caracteres.`,
    ));
  }

  if (data.description.length > MAX_DESCRIPTION_LENGTH) {
    return err(createObjectiveError(
      'INVALID_DESCRIPTION_LENGTH',
      `La descripción no debe exceder ${MAX_DESCRIPTION_LENGTH} caracteres.`,
    ));
  }

  const objective: StrategicObjective = {
    id: generateId(),
    name: data.name,
    description: data.description,
    perspective: data.perspective,
    linkedKPIIds: [],
  };

  objectives.push(objective);
  return ok(objective);
}

/**
 * @description Links a KPI to an existing objective.
 * Enforces max 5 objectives per KPI and validates existence.
 * @param kpiId - The KPI identifier to link
 * @param objectiveId - The objective identifier to link to
 * @returns Result containing the KPILink or a LinkError
 */
export function linkKPI(
  kpiId: string,
  objectiveId: string,
): Result<KPILink, LinkError> {
  const objective = objectives.find((obj) => obj.id === objectiveId);
  if (!objective) {
    return err(createLinkError(
      'OBJECTIVE_NOT_FOUND',
      `No se encontró el objetivo con ID: ${objectiveId}.`,
    ));
  }

  if (countLinksForKPI(kpiId) >= MAX_OBJECTIVES_PER_KPI) {
    return err(createLinkError(
      'MAX_LINKS_PER_KPI',
      `El KPI ya está vinculado a ${MAX_OBJECTIVES_PER_KPI} objetivos (límite máximo).`,
    ));
  }

  const duplicateLink = links.find(
    (link) => link.kpiId === kpiId && link.objectiveId === objectiveId,
  );
  if (duplicateLink) {
    return err(createLinkError(
      'DUPLICATE_LINK',
      `El KPI ya está vinculado a este objetivo.`,
    ));
  }

  const newLink: KPILink = { kpiId, objectiveId };
  links.push(newLink);

  // Update the objective's linkedKPIIds
  const mutableObjective = objective as { linkedKPIIds: string[] };
  mutableObjective.linkedKPIIds = [...objective.linkedKPIIds, kpiId];

  return ok(newLink);
}

/**
 * @description Removes a link between a KPI and an objective.
 * @param kpiId - The KPI identifier to unlink
 * @param objectiveId - The objective identifier to unlink from
 * @returns Result void on success or a LinkError
 */
export function unlinkKPI(
  kpiId: string,
  objectiveId: string,
): Result<void, LinkError> {
  const linkIndex = links.findIndex(
    (link) => link.kpiId === kpiId && link.objectiveId === objectiveId,
  );

  if (linkIndex === -1) {
    return err(createLinkError(
      'LINK_NOT_FOUND',
      `No se encontró vinculación entre el KPI y el objetivo.`,
    ));
  }

  links.splice(linkIndex, 1);

  // Update the objective's linkedKPIIds
  const objective = objectives.find((obj) => obj.id === objectiveId);
  if (objective) {
    const mutableObjective = objective as { linkedKPIIds: string[] };
    mutableObjective.linkedKPIIds = objective.linkedKPIIds.filter(
      (id) => id !== kpiId,
    );
  }

  return ok(undefined);
}

/**
 * @description Groups all objectives by their BSC perspective.
 * Returns a Map with all 4 perspectives, each containing its objectives.
 * @returns Map of BSCPerspective to array of StrategicObjective
 */
export function getObjectivesByPerspective(): Map<BSCPerspective, StrategicObjective[]> {
  const perspectiveMap = new Map<BSCPerspective, StrategicObjective[]>([
    ['financial', []],
    ['customers', []],
    ['internal_processes', []],
    ['learning_growth', []],
  ]);

  for (const objective of objectives) {
    const group = perspectiveMap.get(objective.perspective)!;
    group.push(objective);
  }

  return perspectiveMap;
}

/**
 * @description Returns objectives that have no KPIs linked to them.
 * Useful for generating warnings before document generation.
 * @returns Array of objectives with empty linkedKPIIds
 */
export function getUnlinkedObjectives(): StrategicObjective[] {
  return objectives.filter((obj) => obj.linkedKPIIds.length === 0);
}

/**
 * @description Resets the module internal state. Used for testing.
 */
export function resetState(): void {
  objectives = [];
  links = [];
  idCounter = 0;
}

// ─── Module Object Export ────────────────────────────────────────────────────

/**
 * @description The objectives module implementing IModuloObjetivos.
 * Manages strategic objective creation, KPI linking,
 * perspective grouping, and unlinked objective detection.
 */
export const moduloObjetivos: IModuloObjetivos = {
  createObjective,
  linkKPI,
  unlinkKPI,
  getObjectivesByPerspective,
  getUnlinkedObjectives,
  MAX_OBJECTIVES: 20,
  MAX_OBJECTIVES_PER_KPI: 5,
};
