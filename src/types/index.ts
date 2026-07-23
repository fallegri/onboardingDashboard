/**
 * @description Central barrel export for all shared types and interfaces.
 * Import from '@types' path alias or 'src/types' for access to all domain types.
 */

export type { Result, Ok, Err } from './result';
export { ok, err, map, flatMap, isOk, isErr, unwrap, unwrapOr } from './result';

export type {
  DataType,
  BSCPerspective,
  PRISMDimension,
  ChartType,
  AggregationType,
  FlowStep,
  Theme
} from './common';

export type {
  BaseError,
  FileLoadError,
  FileValidationError,
  SecurityError,
  IAConfigError,
  IAQueryError,
  StorageError,
  DetectionError,
  PRISMError,
  DocumentError,
  ParseError,
  ObjectiveError,
  LinkError,
  VisualizationError,
  IntegrityError,
  AppError
} from './errors';

export type {
  FileLoadResult,
  SheetData,
  ColumnInfo,
  SheetStructure,
  DetectionResult,
  ProblemDetail,
  DimensionScore,
  PRISMResult,
  ChartSuggestion,
  KPISuggestion,
  VisualizationConfig,
  Visualization,
  StrategicObjective,
  KPILink,
  IAProviderConfig,
  StatsSummary,
  DatasetMetadata,
  IAResponse,
  ThresholdConditions,
  KPITechnicalSheet,
  DocumentMetadata,
  BSCDocument,
  BSCDimensionSection,
  BSCObjectivesSection,
  DataSectionContent,
  DatasetInfo,
  TransformationEntry,
  ChartEntry,
  AnalysisEntry,
  UserCustomizations,
  EncryptedPayload,
  LogEntry,
  LogFilter,
  SessionState
} from './session';
