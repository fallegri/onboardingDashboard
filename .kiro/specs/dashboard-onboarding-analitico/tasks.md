# Implementation Plan: Dashboard Onboarding Analítico

## Overview

Implementación modular en TypeScript de una aplicación web local-first que guía al usuario a través de un flujo de análisis de datos con metodología PRISM, sugerencias de KPIs/visualizaciones, vinculación a objetivos BSC y generación de documento Markdown descargable. Se utiliza Vitest + fast-check para pruebas unitarias y basadas en propiedades, con un objetivo de cobertura ≥80% en módulos core.

## Tasks

- [x] 1. Configuración del proyecto e infraestructura base
  - [x] 1.1 Inicializar proyecto TypeScript con Vite, Vitest y ESLint
    - Crear `package.json` con dependencias: `typescript`, `vite`, `vitest`, `fast-check`, `eslint`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`
    - Configurar `tsconfig.json` con `strict: true`
    - Configurar `vite.config.ts` con build de archivo HTML único (inlined CSS/JS)
    - Configurar `vitest.config.ts` con cobertura (istanbul/v8)
    - Configurar `.eslintrc` con `eslint:recommended` + `@typescript-eslint/recommended`, cero errores/warnings
    - Crear estructura de directorios: `src/modules/`, `src/infrastructure/`, `src/ui/`, `src/types/`, `tests/`
    - _Requisitos: 11.6, 14.1, 14.6_

  - [x] 1.2 Definir tipos compartidos e interfaces base del sistema
    - Crear `src/types/result.ts` con tipo `Result<T, E>` y helpers (`ok()`, `err()`, `map()`, `flatMap()`)
    - Crear `src/types/common.ts` con tipos enumerados: `DataType`, `BSCPerspective`, `PRISMDimension`, `ChartType`
    - Crear `src/types/errors.ts` con jerarquía de errores tipados: `FileLoadError`, `FileValidationError`, `SecurityError`, `IAConfigError`, `IAQueryError`, `StorageError`, etc.
    - Crear `src/types/session.ts` con interfaz `SessionState` completa según diseño
    - _Requisitos: 11.1, 11.2, 11.4_

  - [x] 1.3 Implementar servicios de infraestructura (LogService y StorageManager)
    - Crear `src/infrastructure/log-service.ts` implementando `ILogService`: `logError()`, `logSecurityEvent()`, `getLogs()`
    - Cada entrada de log debe incluir timestamp ISO, módulo, stack trace
    - Crear `src/infrastructure/storage-manager.ts` implementando `IStorageManager`: `saveSession()`, `loadSession()`, `getUsagePercent()`, `clearAll()`, `isSessionExpired()`
    - Implementar lógica de expiración a 30 días y umbral de advertencia al 80% de 100 MB
    - _Requisitos: 8.1, 8.2, 8.4, 8.5, 8.6, 8.7, 13.2_

  - [ ]* 1.4 Escribir prueba de propiedad para LogService
    - **Propiedad 20: Completitud de Entradas de Log**
    - Generar errores aleatorios en módulos variados y verificar que cada entrada contiene timestamp ISO, nombre de módulo no vacío, y stack trace no vacío
    - **Valida: Requisito 13.2**

  - [ ]* 1.5 Escribir prueba de propiedad para StorageManager (round-trip de sesión)
    - **Propiedad 5: Round-trip del Estado de Sesión**
    - Generar `SessionState` arbitrarios, serializar a JSON, almacenar en localStorage mock, leer de vuelta y verificar igualdad profunda
    - **Valida: Requisito 8.1**

- [x] 2. Módulo de Seguridad
  - [x] 2.1 Implementar Módulo_Seguridad
    - Crear `src/modules/seguridad/modulo-seguridad.ts` implementando `IModuloSeguridad`
    - Implementar `sanitizeInput()`: escapar caracteres HTML, eliminar etiquetas `<script>`, neutralizar event handlers
    - Implementar `detectInjection()`: detectar patrones `<script>`, event handlers (`onclick`, `onerror`), `javascript:` URIs
    - Implementar `encrypt()` y `decrypt()` con AES-256-GCM usando Web Crypto API (SubtleCrypto)
    - Implementar `validateFileUpload()`: triple validación (tamaño ≤ 50 MB, extensión en `.xlsx/.xls/.csv`, MIME type coincide)
    - Implementar `getCSPHeaders()`: restringir scripts al propio origen, bloquear inline scripts y eval()
    - _Requisitos: 9.1, 9.2, 9.3, 9.4, 9.5, 9.7, 9.8_

  - [ ]* 2.2 Escribir prueba de propiedad para sanitización XSS
    - **Propiedad 8: Sanitización XSS Segura**
    - Generar cadenas con patrones de inyección y texto seguro, verificar que la salida no contiene `<script>`, event handlers, ni entidades HTML ejecutables, y que texto alfanumérico se preserva intacto
    - **Valida: Requisito 9.1**

  - [ ]* 2.3 Escribir prueba de propiedad para detección de inyección
    - **Propiedad 9: Detección de Inyección de Scripts**
    - Generar cadenas maliciosas (tags script, event handlers, `javascript:` URIs) → `true`. Cadenas alfanuméricas/espacios/puntuación → `false`
    - **Valida: Requisito 9.7**

  - [ ]* 2.4 Escribir prueba de propiedad para cifrado round-trip
    - **Propiedad 6: Round-trip de Cifrado de API Keys**
    - Generar cadenas aleatorias, cifrar con AES-256-GCM, descifrar y verificar igualdad con la original
    - **Valida: Requisito 9.3**

  - [ ]* 2.5 Escribir prueba de propiedad para integridad de datos cifrados corruptos
    - **Propiedad 7: Detección de Integridad en Datos Cifrados Corruptos**
    - Generar payloads cifrados válidos, corromper al menos un byte del ciphertext o tag, verificar que descifrado falla con error de integridad
    - **Valida: Requisito 9.4**

  - [ ]* 2.6 Escribir prueba de propiedad para validación triple de archivos
    - **Propiedad 10: Validación Triple de Archivos**
    - Generar archivos con combinaciones de tamaño/extensión/MIME válidas e inválidas, verificar que acepta solo cuando las tres condiciones se cumplen
    - **Valida: Requisito 9.5**

- [x] 3. Checkpoint - Verificar infraestructura base
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.

- [x] 4. Módulo de Carga de Archivos
  - [x] 4.1 Implementar Módulo_Carga
    - Crear `src/modules/carga/modulo-carga.ts` implementando `IModuloCarga`
    - Implementar `validateFile()`: delegar validación de seguridad a `IModuloSeguridad.validateFileUpload()`
    - Implementar `loadFile()`: parsear archivos Excel (usando librería SheetJS/xlsx) y CSV
    - Manejar progreso mediante callback `onProgress`
    - Truncar a 100,000 filas si excede, marcando `wasTruncated = true`
    - Rechazar archivos vacíos (0 filas de datos) con mensaje de advertencia
    - Retornar `FileLoadResult` con nombre, tamaño, hojas, filas
    - _Requisitos: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9_

  - [ ]* 4.2 Escribir prueba de propiedad para correctitud de carga
    - **Propiedad 12: Correctitud de Carga de Archivos**
    - Generar archivos válidos (.xlsx, .xls, .csv) de hasta 50 MB, verificar que `FileLoadResult` contiene `fileName` igual al nombre original, `fileSize` correcto, `sheetCount` correcto, `totalRows ≤ 100,000`. Para archivos con formato no soportado, verificar que retorna error sin almacenar datos
    - **Valida: Requisitos 1.1, 1.2, 1.6, 1.9**

- [x] 5. Módulo de Detección de Estructura
  - [x] 5.1 Implementar Módulo_Detección
    - Crear `src/modules/deteccion/modulo-deteccion.ts` implementando `IModuloDeteccion`
    - Implementar `analyzeStructure()`: analizar hasta 50 hojas, identificar columnas, tipos, registros, % vacíos
    - Implementar `inferType()`: clasificar valores como numérico, texto, fecha, booleano usando muestreo de hasta 1000 valores por columna con regla de mayoría (>60%)
    - Implementar `reassignColumnType()`: permitir reasignación inmediata de tipo
    - Marcar `hasWarning = true` cuando `emptyPercentage > 30`
    - Validar que al menos una hoja tenga estructura tabular (encabezados + datos)
    - Respetar timeout de 30 segundos
    - _Requisitos: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ]* 5.2 Escribir prueba de propiedad para detección de estructura válida
    - **Propiedad 3: Detección Produce Estructura Válida**
    - Generar archivos con hojas/columnas/tipos variados, verificar que `DetectionResult` tiene al menos una hoja con al menos una columna tipada, nombre no vacío y conteo de registros ≥ 1
    - **Valida: Requisitos 2.1, 2.2, 12.2**

  - [ ]* 5.3 Escribir prueba de propiedad para umbral de advertencia
    - **Propiedad 4: Umbral de Advertencia en Columnas**
    - Generar columnas con porcentajes de vacíos aleatorios (0-100), verificar que `hasWarning === true` si y solo si `emptyPercentage > 30`
    - **Valida: Requisito 2.3**

- [x] 6. Motor PRISM
  - [x] 6.1 Implementar Motor_PRISM
    - Crear `src/modules/prism/motor-prism.ts` implementando `IMotorPRISM`
    - Implementar `evaluate()`: evaluar 5 dimensiones (Precisión, Relevancia, Integridad, Suficiencia, Mantenibilidad) como funciones puras, deterministas e idempotentes
    - Precisión: `100 - (inconsistencias/total × 100)`
    - Relevancia: `(columnas_útiles / total_columnas) × 100`
    - Integridad: `(valores_presentes / total_celdas) × 100`
    - Suficiencia: `min(registros/umbral × 100, 100)`
    - Mantenibilidad: heurísticas de naming + formato
    - Generar lista de hasta 10 problemas por dimensión con score < 60
    - Implementar flags: `isBlockingQuality` (todas = 0), `hasLowIntegrity` (< 30), `hasWarningDimensions` (alguna < 60)
    - Implementar `recalculateDimension()` para re-evaluación parcial
    - _Requisitos: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [ ]* 6.2 Escribir prueba de propiedad para invariantes PRISM
    - **Propiedad 2: Invariantes del Motor PRISM (Idempotencia + Rango)**
    - Generar datasets tabulares aleatorios con tipos mixtos, evaluar dos veces consecutivas y verificar puntajes idénticos. Verificar que cada puntaje es entero en [0, 100]
    - **Valida: Requisitos 3.1, 3.2, 12.3**

- [x] 7. Checkpoint - Verificar módulos core de procesamiento de datos
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.

- [x] 8. Catálogo de Visualización
  - [x] 8.1 Implementar Catálogo_Visualización
    - Crear `src/modules/visualizacion/catalogo-visualizacion.ts` implementando `ICatalogoVisualizacion`
    - Implementar `suggestCharts()`: analizar tipos de columnas y sugerir ≥ 3 tipos de gráficos (barras, líneas, torta, dispersión, tablas dinámicas) según correspondencia tipo-gráfico
    - Implementar `suggestKPIs()`: generar 3-10 sugerencias de KPIs con operaciones agregadas (sum, average, count, rate, min, max)
    - Implementar `generatePreview()`: renderizar vista previa con datos reales (max 5 seg) con zoom, filtrado y tooltip
    - Implementar `addCustomVisualization()`: hasta 20 visualizaciones custom, con validación de título (max 100 chars)
    - Configuración de colores, etiquetas y rangos de datos
    - _Requisitos: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [ ]* 8.2 Escribir prueba de propiedad para cotas de sugerencias
    - **Propiedad 15: Cotas de Sugerencias de Visualización**
    - Generar `DetectionResult` con al menos una columna numérica o temporal, verificar ≥ 3 sugerencias de gráficos. Para KPIs con columnas numéricas/temporales, verificar entre 3 y 10 sugerencias
    - **Valida: Requisitos 4.1, 4.2**

- [x] 9. Módulo de Objetivos Estratégicos
  - [x] 9.1 Implementar Módulo_Objetivos
    - Crear `src/modules/objetivos/modulo-objetivos.ts` implementando `IModuloObjetivos`
    - Implementar `createObjective()`: crear hasta 20 objetivos con nombre (max 150 chars), descripción (max 500 chars), perspectiva BSC
    - Implementar `linkKPI()`: vincular KPI a objetivo (max 5 objetivos por KPI)
    - Implementar `unlinkKPI()`: eliminar vinculación existente
    - Implementar `getObjectivesByPerspective()`: agrupar por las 4 perspectivas BSC
    - Implementar `getUnlinkedObjectives()`: retornar objetivos sin KPIs para advertencias
    - Deshabilitar creación al alcanzar 20 objetivos
    - _Requisitos: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [ ]* 9.2 Escribir prueba de propiedad para round-trip de vinculación
    - **Propiedad 13: Round-trip de Vinculación KPI-Objetivo**
    - Generar pares KPI-Objetivo aleatorios, vincular y luego desvincular, verificar que el estado retorna al previo exacto
    - **Valida: Requisitos 5.2, 5.6**

  - [ ]* 9.3 Escribir prueba de propiedad para límites del módulo
    - **Propiedad 14: Límites del Módulo de Objetivos**
    - Generar secuencias de creación de longitud variable, verificar que acepta hasta 20 objetivos y rechaza el 21+. Verificar que acepta hasta 5 vinculaciones por KPI y rechaza la 6+
    - **Valida: Requisitos 5.1, 5.2, 5.7**

  - [ ]* 9.4 Escribir prueba de propiedad para agrupación por perspectiva
    - **Propiedad 16: Agrupación de Objetivos por Perspectiva BSC**
    - Generar conjuntos de objetivos con perspectivas aleatorias, verificar que cada objetivo aparece exactamente una vez bajo su perspectiva correcta
    - **Valida: Requisito 5.3**

- [x] 10. Checkpoint - Verificar módulos de visualización y objetivos
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.

- [x] 11. Motor de IA
  - [x] 11.1 Implementar Motor_IA e interfaz de proveedores
    - Crear `src/modules/ia/motor-ia.ts` implementando `IMotorIA`
    - Crear `src/modules/ia/providers/ia-provider.interface.ts` con `IIAProvider`
    - Crear `src/modules/ia/providers/openai-provider.ts`
    - Crear `src/modules/ia/providers/gemini-provider.ts`
    - Crear `src/modules/ia/providers/claude-provider.ts`
    - Crear `src/modules/ia/providers/ollama-provider.ts`
    - Implementar `configureProvider()`: validación con timeout de 10 seg, cifrado de API key vía Módulo_Seguridad
    - Implementar `query()`: enviar solo metadatos (nombres columnas, tipos, filas, estadísticas), timeout 30 seg + 1 reintento tras 2 seg
    - Implementar `switchProvider()`: cambiar proveedor activo preservando historial
    - Implementar `checkOllamaAvailability()`: verificar localhost:11434 con timeout 5 seg
    - Implementar `getAvailableProviders()`: filtrar según conectividad (deshabilitar cloud si offline)
    - Rechazar API keys inválidas sin almacenarlas
    - _Requisitos: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9_

  - [ ]* 11.2 Escribir prueba de propiedad para payload de solo metadatos
    - **Propiedad 11: Payload de IA Contiene Solo Metadatos**
    - Generar datasets con datos y queries, interceptar el payload enviado al proveedor mock y verificar que contiene solo metadatos (nombres columnas, tipos, filas, estadísticas) y no valores individuales de registros
    - **Valida: Requisito 6.3**

  - [ ]* 11.3 Escribir prueba de propiedad para preservación de historial
    - **Propiedad 17: Cambio de Proveedor Preserva Historial**
    - Generar secuencias de consultas seguidas de cambio de proveedor, verificar que el historial previo permanece intacto y accesible
    - **Valida: Requisito 6.7**

- [x] 12. Generador de Documento BSC
  - [x] 12.1 Implementar Generador_Documento
    - Crear `src/modules/documento/generador-documento.ts` implementando `IGeneradorDocumento`
    - Implementar `generate()`: producir Markdown con secciones obligatorias (Introducción, Objetivos Estratégicos, Dimensiones del CMI, Identificación de KPIs, KPIs necesarios para el CMI, Obtención de Datos, Análisis Cuantitativo/Cualitativo)
    - Generar fichas técnicas por KPI: código, nombre, objetivo, fórmula, condiciones (Óptimo, Aceptable, Rechazado)
    - Incluir solo perspectivas BSC con al menos un KPI válido
    - Incluir metadatos: fecha ISO 8601, archivo fuente, puntajes PRISM, proveedor IA
    - Implementar `parse()`: parsear Markdown a `BSCDocument` para round-trip
    - Implementar `serialize()`: serializar `BSCDocument` a Markdown
    - Implementar `regenerate()`: preservar personalizaciones del usuario (títulos editados, textos de interpretación, objetivos reordenados)
    - Tiempo máximo 30 seg, descarga en ≤ 3 seg
    - _Requisitos: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11, 7.12_

  - [ ]* 12.2 Escribir prueba de propiedad para round-trip del documento
    - **Propiedad 1: Round-trip del Generador de Documento**
    - Generar contextos de generación arbitrarios (KPIs, objetivos, datos PRISM, metadatos), generar documento → parsear → re-serializar y verificar igualdad estructural (secciones, orden, fichas técnicas, tablas) excluyendo metadatos variables
    - **Valida: Requisitos 7.11, 12.4**

  - [ ]* 12.3 Escribir prueba de propiedad para completitud estructural
    - **Propiedad 18: Completitud Estructural del Documento Generado**
    - Generar contextos válidos con al menos un KPI, verificar que el documento contiene todas las secciones obligatorias y cada KPI tiene ficha técnica completa
    - **Valida: Requisitos 7.1, 7.3, 7.5, 7.6, 7.7**

  - [ ]* 12.4 Escribir prueba de propiedad para filtrado de perspectivas BSC
    - **Propiedad 19: Filtrado de Perspectivas BSC en Documento**
    - Generar KPIs con perspectivas variadas, verificar que el documento incluye solo perspectivas con KPIs válidos y omite las vacías con razón indicada
    - **Valida: Requisitos 7.2, 7.12**

- [x] 13. Checkpoint - Verificar módulos de IA y generación de documentos
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.

- [x] 14. Capa de Presentación y Orquestación
  - [x] 14.1 Implementar orquestador de flujo y gestión de estado
    - Crear `src/app/flow-orchestrator.ts`: gestionar transiciones entre etapas (carga → detección → PRISM → visualización → objetivos → documento)
    - Implementar patrón Observer/Store para estado centralizado
    - Implementar auto-guardado cada 30 segundos vía `StorageManager`
    - Implementar detección de sesión previa al cargar la app (≤ 3 seg)
    - Implementar diálogo de restaurar/nueva sesión
    - Transiciones entre etapas en ≤ 500 ms
    - _Requisitos: 8.2, 8.3, 10.4, 10.6, 13.3, 13.6_

  - [x] 14.2 Implementar componentes UI principales
    - Crear `src/ui/components/`: file-upload, structure-table, prism-panel, chart-gallery, objectives-form, document-preview
    - Implementar indicador de progreso persistente (etapa actual / total)
    - Implementar drag-and-drop para carga de archivos
    - Implementar modo oscuro/claro con selector visible (operable por teclado y ratón)
    - Implementar mensajes de error en lenguaje no técnico preservando datos ingresados
    - Diseño responsivo 320px - 2560px sin scroll horizontal
    - Cumplir WCAG 2.1 AA: contraste, navegación teclado, etiquetas ARIA
    - _Requisitos: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

  - [x] 14.3 Implementar degradación elegante y manejo de errores UI
    - Implementar indicador de conexión (online/offline)
    - Deshabilitar proveedores cloud cuando offline
    - Notificar funcionalidades no disponibles en ≤ 5 seg
    - Permitir flujo completo sin IA
    - Notificación de fallo de auto-guardado en ≤ 5 seg
    - Mostrar diálogo de confirmación para "Limpiar datos"
    - _Requisitos: 13.1, 13.4, 13.5, 13.6, 13.7, 8.8_

- [x] 15. Integración completa y wiring
  - [x] 15.1 Conectar todos los módulos con inyección de dependencias
    - Crear `src/app/container.ts`: registro de dependencias y factory
    - Instanciar todos los módulos con sus dependencias inyectadas
    - Conectar Módulo_Seguridad como transversal (usado por Carga, IA, Storage)
    - Conectar LogService como transversal (usado por todos los módulos)
    - Verificar que ningún módulo accede a internos de otro (solo interfaces públicas)
    - _Requisitos: 11.1, 11.2, 11.3, 11.7_

  - [x] 15.2 Configurar build de archivo HTML único y README
    - Configurar Vite para producir archivo HTML autónomo ≤ 15 MB (CSS + JS inlined)
    - Crear `README.md` con instrucciones de despliegue para Windows, macOS, Linux
    - Incluir instrucciones de configuración de Ollama
    - Documentar requisitos previos y pasos de ejecución
    - _Requisitos: 14.5, 14.6_

  - [ ]* 15.3 Escribir tests de integración del flujo completo
    - Cargar archivo de ejemplo (≥ 100 filas, 5 columnas, tipos mixtos)
    - Ejecutar detección de estructura
    - Ejecutar auditoría PRISM
    - Generar documento
    - Verificar que el documento contiene las secciones obligatorias del Requisito 7
    - Suite completa en ≤ 60 segundos
    - _Requisitos: 12.5, 12.6_

- [x] 16. Checkpoint final - Verificar integración completa
  - Asegurar que todos los tests pasan (unit, property, integration), ESLint con cero errores/warnings, cobertura ≥ 80% en Motor_PRISM, Módulo_Detección y Generador_Documento. Preguntar al usuario si surgen dudas.

## Notes

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada tarea referencia requisitos específicos para trazabilidad
- Los checkpoints aseguran validación incremental
- Las pruebas basadas en propiedades validan correctitud universal (20 propiedades formales)
- Las pruebas unitarias complementan con ejemplos específicos y edge cases
- El framework de testing es Vitest + fast-check como se especifica en el diseño
- ESLint estricto con zero tolerance es obligatorio en cada checkpoint

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3", "2.1"] },
    { "id": 3, "tasks": ["1.4", "1.5", "2.2", "2.3", "2.4", "2.5", "2.6"] },
    { "id": 4, "tasks": ["4.1", "5.1"] },
    { "id": 5, "tasks": ["4.2", "5.2", "5.3", "6.1"] },
    { "id": 6, "tasks": ["6.2", "8.1", "9.1"] },
    { "id": 7, "tasks": ["8.2", "9.2", "9.3", "9.4", "11.1"] },
    { "id": 8, "tasks": ["11.2", "11.3", "12.1"] },
    { "id": 9, "tasks": ["12.2", "12.3", "12.4"] },
    { "id": 10, "tasks": ["14.1", "14.2"] },
    { "id": 11, "tasks": ["14.3", "15.1"] },
    { "id": 12, "tasks": ["15.2", "15.3"] }
  ]
}
```
