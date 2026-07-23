export { motorIA, registerProvider, resetState, buildMetadataPayload, getQueryHistory, getActiveProviderId } from './motor-ia';
export type { IMotorIA } from './motor-ia';
export type { IIAProvider } from './providers/ia-provider.interface';
export { openaiProvider } from './providers/openai-provider';
export { geminiProvider } from './providers/gemini-provider';
export { claudeProvider } from './providers/claude-provider';
export { ollamaProvider, checkAvailability } from './providers/ollama-provider';
