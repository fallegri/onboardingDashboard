/**
 * @module ui/components
 * @description Barrel export for all UI components.
 * Each component is a render function that accepts a container and props.
 */

export { renderFileUpload } from './file-upload';
export type { FileUploadProps } from './file-upload';

export { renderStructureTable } from './structure-table';
export type { StructureTableProps } from './structure-table';

export { renderPrismPanel } from './prism-panel';
export type { PrismPanelProps } from './prism-panel';

export { renderChartGallery } from './chart-gallery';
export type { ChartGalleryProps } from './chart-gallery';

export { renderObjectivesForm } from './objectives-form';
export type { ObjectivesFormProps, ObjectiveFormData } from './objectives-form';

export { renderDocumentPreview } from './document-preview';
export type { DocumentPreviewProps } from './document-preview';

export { renderProgressIndicator } from './progress-indicator';
export type { ProgressIndicatorProps } from './progress-indicator';

export { renderThemeToggle, applyTheme, getStoredTheme } from './theme-toggle';
export type { ThemeToggleProps } from './theme-toggle';

export { renderErrorMessage, mapErrorToUserMessage } from './error-message';
export type { ErrorMessageProps } from './error-message';

export { renderConnectivityIndicator, isOnline, cleanup as cleanupConnectivity } from './connectivity-indicator';
export type { ConnectivityIndicatorProps } from './connectivity-indicator';

export { showToast, dismissToast, dismissAllToasts } from './notification-toast';
export type { ToastOptions, ToastSeverity } from './notification-toast';

export { showConfirmDialog } from './confirm-dialog';
export type { ConfirmDialogOptions } from './confirm-dialog';
