/**
 * @module objectives-form
 * @description Strategic objectives CRUD form with KPI linking and BSC perspective grouping.
 * Validates: Requirements 10.1, 10.2
 */

import type { BSCPerspective } from '../../types/common';
import type { StrategicObjective, KPISuggestion } from '../../types/session';

/** Props for the objectives form component */
export interface ObjectivesFormProps {
  /** Existing strategic objectives */
  objectives: StrategicObjective[];
  /** Available KPIs for linking */
  availableKPIs: KPISuggestion[];
  /** Callback to create a new objective */
  onCreate: (data: ObjectiveFormData) => void;
  /** Callback to delete an objective */
  onDelete: (objectiveId: string) => void;
  /** Callback to link a KPI to an objective */
  onLinkKPI: (objectiveId: string, kpiId: string) => void;
  /** Callback to unlink a KPI from an objective */
  onUnlinkKPI: (objectiveId: string, kpiId: string) => void;
  /** Max objectives allowed (default 20) */
  maxObjectives?: number;
}

/** Data submitted when creating an objective */
export interface ObjectiveFormData {
  name: string;
  description: string;
  perspective: BSCPerspective;
}

/** BSC perspective labels */
const PERSPECTIVE_LABELS: Record<BSCPerspective, string> = {
  financial: 'Financiera',
  customers: 'Clientes',
  internal_processes: 'Procesos Internos',
  learning_growth: 'Aprendizaje y Crecimiento',
};

/** All BSC perspectives */
const PERSPECTIVES: BSCPerspective[] = ['financial', 'customers', 'internal_processes', 'learning_growth'];

/**
 * Renders the objectives form and list into the given container.
 * @param container - Target DOM element
 * @param props - Objectives data and callbacks
 */
export function renderObjectivesForm(
  container: HTMLElement,
  props: ObjectivesFormProps
): void {
  container.innerHTML = '';

  const section = document.createElement('section');
  section.className = 'objectives-form';
  section.setAttribute('aria-label', 'Gestión de objetivos estratégicos');

  const heading = document.createElement('h2');
  heading.textContent = 'Objetivos Estratégicos';
  section.appendChild(heading);

  const form = createObjectiveForm(props);
  section.appendChild(form);

  const grouped = createGroupedList(props);
  section.appendChild(grouped);

  container.appendChild(section);
}

/** Creates the new objective input form */
function createObjectiveForm(props: ObjectivesFormProps): HTMLFormElement {
  const maxObj = props.maxObjectives ?? 20;
  const atLimit = props.objectives.length >= maxObj;

  const form = document.createElement('form');
  form.className = 'objectives-form__create';
  form.setAttribute('aria-label', 'Crear nuevo objetivo');

  form.appendChild(createTextField('obj-name', 'Nombre del objetivo', 150, true));
  form.appendChild(createTextField('obj-desc', 'Descripción', 500, false));
  form.appendChild(createPerspectiveSelect());

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.className = 'btn btn-primary';
  submitBtn.textContent = 'Crear objetivo';
  submitBtn.disabled = atLimit;
  if (atLimit) submitBtn.title = `Máximo de ${maxObj} objetivos alcanzado`;

  form.appendChild(submitBtn);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    props.onCreate({
      name: (formData.get('obj-name') as string) ?? '',
      description: (formData.get('obj-desc') as string) ?? '',
      perspective: (formData.get('obj-perspective') as BSCPerspective) ?? 'financial',
    });
    form.reset();
  });

  return form;
}

/** Creates a labeled text input field */
function createTextField(name: string, labelText: string, maxLength: number, required: boolean): HTMLElement {
  const group = document.createElement('div');
  group.className = 'objectives-form__field';

  const label = document.createElement('label');
  label.htmlFor = name;
  label.textContent = labelText;

  const input = document.createElement('input');
  input.type = 'text';
  input.id = name;
  input.name = name;
  input.maxLength = maxLength;
  input.required = required;
  input.className = 'objectives-form__input';
  input.setAttribute('aria-required', String(required));

  group.appendChild(label);
  group.appendChild(input);
  return group;
}

/** Creates the perspective dropdown */
function createPerspectiveSelect(): HTMLElement {
  const group = document.createElement('div');
  group.className = 'objectives-form__field';

  const label = document.createElement('label');
  label.htmlFor = 'obj-perspective';
  label.textContent = 'Perspectiva BSC';

  const select = document.createElement('select');
  select.id = 'obj-perspective';
  select.name = 'obj-perspective';
  select.className = 'objectives-form__select';
  select.setAttribute('aria-label', 'Seleccionar perspectiva del Balanced Scorecard');

  PERSPECTIVES.forEach((p) => {
    const option = document.createElement('option');
    option.value = p;
    option.textContent = PERSPECTIVE_LABELS[p];
    select.appendChild(option);
  });

  group.appendChild(label);
  group.appendChild(select);
  return group;
}

/** Creates objectives grouped by BSC perspective */
function createGroupedList(props: ObjectivesFormProps): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'objectives-form__grouped';

  PERSPECTIVES.forEach((perspective) => {
    const objectives = props.objectives.filter((o) => o.perspective === perspective);
    if (objectives.length === 0) return;

    const group = document.createElement('div');
    group.className = 'objectives-form__group';

    const groupHeading = document.createElement('h3');
    groupHeading.textContent = PERSPECTIVE_LABELS[perspective];
    group.appendChild(groupHeading);

    const list = document.createElement('ul');
    list.setAttribute('role', 'list');

    objectives.forEach((obj) => {
      const item = createObjectiveItem(obj, props);
      list.appendChild(item);
    });

    group.appendChild(list);
    wrapper.appendChild(group);
  });

  return wrapper;
}

/** Creates a single objective list item with KPI links and delete */
function createObjectiveItem(
  obj: StrategicObjective,
  props: ObjectivesFormProps
): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'objectives-form__item';

  const header = document.createElement('div');
  header.className = 'objectives-form__item-header';

  const name = document.createElement('strong');
  name.textContent = obj.name;

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'btn btn-secondary objectives-form__delete';
  deleteBtn.textContent = 'Eliminar';
  deleteBtn.setAttribute('aria-label', `Eliminar objetivo: ${obj.name}`);
  deleteBtn.addEventListener('click', () => props.onDelete(obj.id));

  header.appendChild(name);
  header.appendChild(deleteBtn);
  li.appendChild(header);

  if (obj.description) {
    const desc = document.createElement('p');
    desc.className = 'objectives-form__item-desc';
    desc.textContent = obj.description;
    li.appendChild(desc);
  }

  const kpiSection = createKPILinkSection(obj, props);
  li.appendChild(kpiSection);

  return li;
}

/** Creates the KPI linking section for an objective */
function createKPILinkSection(
  obj: StrategicObjective,
  props: ObjectivesFormProps
): HTMLElement {
  const section = document.createElement('div');
  section.className = 'objectives-form__kpi-links';

  const label = document.createElement('span');
  label.className = 'objectives-form__kpi-label';
  label.textContent = 'KPIs vinculados:';
  section.appendChild(label);

  obj.linkedKPIIds.forEach((kpiId) => {
    const kpi = props.availableKPIs.find((k) => k.id === kpiId);
    if (!kpi) return;

    const tag = document.createElement('span');
    tag.className = 'objectives-form__kpi-tag';
    tag.textContent = kpi.name;

    const unlinkBtn = document.createElement('button');
    unlinkBtn.type = 'button';
    unlinkBtn.className = 'objectives-form__unlink-btn';
    unlinkBtn.textContent = '×';
    unlinkBtn.setAttribute('aria-label', `Desvincular KPI ${kpi.name} del objetivo ${obj.name}`);
    unlinkBtn.addEventListener('click', () => props.onUnlinkKPI(obj.id, kpiId));

    tag.appendChild(unlinkBtn);
    section.appendChild(tag);
  });

  const unlinkedKPIs = props.availableKPIs.filter(
    (k) => !obj.linkedKPIIds.includes(k.id)
  );

  if (unlinkedKPIs.length > 0) {
    const addSelect = document.createElement('select');
    addSelect.className = 'objectives-form__add-kpi';
    addSelect.setAttribute('aria-label', `Vincular KPI al objetivo ${obj.name}`);

    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = '+ Vincular KPI';
    addSelect.appendChild(defaultOpt);

    unlinkedKPIs.forEach((kpi) => {
      const opt = document.createElement('option');
      opt.value = kpi.id;
      opt.textContent = kpi.name;
      addSelect.appendChild(opt);
    });

    addSelect.addEventListener('change', () => {
      if (addSelect.value) {
        props.onLinkKPI(obj.id, addSelect.value);
      }
    });

    section.appendChild(addSelect);
  }

  return section;
}
