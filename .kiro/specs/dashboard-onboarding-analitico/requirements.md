# Requirements Document

## Introduction

Este documento formaliza los requisitos para el **Dashboard Onboarding Analítico Individual**, una aplicación web autónoma de un solo usuario que guía al usuario a través de un proceso estructurado de carga, validación, análisis y visualización de datos de su área (ventas, cobranzas, mantenimiento, clientes, etc.). La aplicación aplica la metodología PRISM para auditoría de datos, sugiere KPIs y gráficos, permite vincularlos a objetivos estratégicos (PEI/POA), e integra modelos de IA para asistencia analítica. Genera un documento descargable (.md) estructurado como Balanced Scorecard.

La aplicación es genérica, reutilizable, sin referencias institucionales. Los datos del usuario permanecen locales y no se comparten con terceros.

### Decisiones Arquitectónicas (ISO 42010)

- **Arquitectura**: Aplicación modular con separación frontend/backend ligera. El frontend es HTML/CSS/JS empaquetable como archivo único para distribución. El backend es un servidor local ligero (Node.js o Python) para manejo de archivos y llamadas a IA.
- **Stakeholders**: Usuario individual (analista, jefe de área, profesional).
- **Concerns principales**: Privacidad de datos, facilidad de uso, portabilidad, extensibilidad de proveedores de IA.
- **Viewpoints**: Vista funcional (flujo de usuario), vista de información (ciclo de vida del dato), vista de despliegue (local-first).

## Glossary

- **Sistema**: La aplicación Dashboard Onboarding Analítico Individual en su totalidad.
- **Módulo_Carga**: Componente responsable de la importación y lectura de archivos Excel/CSV.
- **Módulo_Detección**: Componente que analiza la estructura del archivo cargado (hojas, columnas, tipos de datos).
- **Motor_PRISM**: Componente que aplica la metodología PRISM para validación y auditoría de calidad de datos.
- **Catálogo_Visualización**: Componente que presenta sugerencias de gráficos y KPIs basados en los tipos de datos detectados.
- **Módulo_Objetivos**: Componente que permite vincular KPIs a objetivos estratégicos PEI/POA del usuario.
- **Motor_IA**: Componente que gestiona la integración con proveedores de inteligencia artificial (OpenAI, Gemini, Claude, Ollama).
- **Generador_Documento**: Componente que produce el documento .md descargable tipo Balanced Scorecard.
- **Módulo_Seguridad**: Componente transversal de sanitización, validación y protección de datos.
- **Usuario**: Persona individual que utiliza la aplicación para analizar datos de su área.
- **Archivo_Fuente**: Archivo Excel (.xlsx, .xls) o CSV (.csv) que el usuario carga en la aplicación.
- **Sesión**: Instancia de trabajo del usuario desde la carga de datos hasta la generación del documento.
- **PEI**: Plan Estratégico Institucional.
- **POA**: Plan Operativo Anual.
- **PRISM**: Metodología de validación de datos (Precisión, Relevancia, Integridad, Suficiencia, Mantenibilidad).
- **KPI**: Indicador Clave de Desempeño (Key Performance Indicator).
- **BSC**: Balanced Scorecard (Cuadro de Mando Integral).

## Requirements

### Requirement 1: Carga de Archivos

**User Story:** Como usuario, quiero cargar archivos Excel o CSV con datos de mi área, para que el sistema pueda analizarlos y sugerirme visualizaciones relevantes.

#### Acceptance Criteria

1. WHEN el usuario selecciona un archivo mediante el selector de archivos o arrastra un archivo al área de carga, THE Módulo_Carga SHALL leer el archivo y almacenarlo en memoria local del navegador, procesando un máximo de 100,000 filas.
2. THE Módulo_Carga SHALL aceptar archivos en formatos .xlsx, .xls y .csv exclusivamente.
3. IF el usuario carga un archivo con formato no soportado, THEN THE Módulo_Carga SHALL mostrar un mensaje de error indicando los formatos válidos (.xlsx, .xls, .csv) y descartar el archivo sin almacenarlo. La validación de formato tiene prioridad sobre cualquier otra verificación: un archivo con formato no soportado se rechaza sin intentar verificar tamaño ni parsear contenido.
4. IF el archivo excede 50 MB de tamaño, THEN THE Módulo_Carga SHALL rechazar el archivo inmediatamente sin almacenarlo en memoria, sin procesarlo parcialmente y sin mostrar información del archivo.
5. WHILE el archivo está siendo procesado, THE Módulo_Carga SHALL mostrar un indicador de progreso visible al usuario.
6. WHEN la carga finaliza exitosamente, THE Módulo_Carga SHALL presentar un resumen con nombre del archivo, tamaño, número de hojas (si Excel) y número de filas detectadas.
7. IF el archivo tiene un formato soportado pero su contenido no puede ser leído o parseado (archivo corrupto o ilegible), THEN THE Módulo_Carga SHALL mostrar un mensaje de error indicando que el archivo no pudo ser procesado y descartar el archivo sin almacenarlo.
8. IF el archivo es válido pero contiene 0 filas de datos (solo encabezados o vacío), THEN THE Módulo_Carga SHALL mostrar un mensaje de advertencia indicando que el archivo no contiene datos y no proceder con el análisis.
9. IF el archivo contiene más de 100,000 filas, THEN THE Módulo_Carga SHALL mostrar un mensaje indicando que se procesarán únicamente las primeras 100,000 filas, y el estado de procesamiento SHALL permanecer activo hasta que la operación de truncado finalice.

### Requirement 2: Detección de Estructura de Datos

**User Story:** Como usuario, quiero que el sistema detecte automáticamente la estructura de mis datos (hojas, columnas, tipos), para no tener que configurar manualmente cada campo.

#### Acceptance Criteria

1. WHEN un archivo es cargado exitosamente, THE Módulo_Detección SHALL analizar todas las hojas del archivo (hasta un máximo de 50 hojas) e identificar nombres de columnas, tipos de datos (numérico, texto, fecha, booleano) y cantidad de registros por hoja, completando el análisis en no más de 30 segundos.
2. WHEN el análisis de estructura finaliza, THE Módulo_Detección SHALL presentar al usuario una tabla resumen por cada hoja que incluya: nombre de la hoja, nombre de cada columna, tipo de dato detectado, cantidad de registros y porcentaje de valores vacíos por columna.
3. WHEN el Módulo_Detección identifica columnas con más del 30% de valores vacíos, THE Módulo_Detección SHALL marcar dichas columnas con un indicador de advertencia distinguible visualmente del estado normal (por ejemplo, ícono o color diferenciado) junto a un texto que indique el porcentaje de valores vacíos.
4. WHILE la tabla resumen de estructura está visible, THE Módulo_Detección SHALL permitir al usuario seleccionar cualquier columna y reasignar su tipo de dato eligiendo entre los tipos disponibles (numérico, texto, fecha, booleano), aplicando el cambio de tipo de forma inmediata en la tabla resumen sin requerir recarga del archivo.
5. IF el archivo no contiene al menos una hoja con una fila de encabezados seguida de al menos una fila de datos, THEN THE Módulo_Detección SHALL informar al usuario mediante un mensaje de error indicando que no se detectó estructura tabular válida y sugerir que verifique que el archivo contenga datos organizados en columnas con encabezados. Esta validación aplica también cuando los encabezados están ausentes independientemente de la presencia de filas de datos.
6. IF el archivo contiene más de 50 hojas, THEN THE Módulo_Detección SHALL analizar las primeras 50 hojas e informar al usuario que las hojas restantes no fueron procesadas.

### Requirement 3: Validación y Auditoría PRISM

**User Story:** Como usuario, quiero que el sistema audite la calidad de mis datos antes de sugerir análisis, para asegurarme de que las visualizaciones se basen en información confiable.

#### Acceptance Criteria

1. WHEN la detección de estructura finaliza, THE Motor_PRISM SHALL evaluar los datos en cinco dimensiones: Precisión, Relevancia, Integridad, Suficiencia y Mantenibilidad, produciendo resultados deterministas e idempotentes para un mismo conjunto de datos.
2. WHEN la evaluación de dimensiones PRISM finaliza, THE Motor_PRISM SHALL generar un puntaje entero de calidad de 0 a 100 para cada dimensión PRISM evaluada.
3. WHEN los puntajes de las cinco dimensiones están calculados, THE Motor_PRISM SHALL presentar al usuario un panel de resultados que incluya el puntaje de cada dimensión y las observaciones asociadas, antes de proceder a sugerencias de visualización. IF todas las dimensiones obtienen un puntaje de 0, THEN THE Motor_PRISM SHALL bloquear la generación de sugerencias de visualización e indicar al usuario que los datos no son aptos para análisis.
4. WHEN una dimensión PRISM obtiene un puntaje menor o igual a 60, THE Motor_PRISM SHALL listar en el panel de resultados hasta 10 columnas o registros específicos que contribuyen a la baja puntuación de esa dimensión.
5. IF al menos una dimensión PRISM obtiene un puntaje menor o igual a 60, THEN THE Motor_PRISM SHALL presentar al usuario simultáneamente ambas opciones: continuar con el análisis y regresar a la vista de datos para corregirlos antes de re-ejecutar la auditoría.
6. IF los datos tienen un puntaje de Integridad menor a 30, THEN THE Motor_PRISM SHALL mostrar una advertencia visualmente diferenciada y posicionada en la parte superior del panel de resultados, indicando que los resultados posteriores pueden ser poco confiables.
7. IF el usuario selecciona la opción de corregir los datos, THEN THE Motor_PRISM SHALL redirigir al usuario a la vista de datos sin generar sugerencias de visualización, preservando los resultados de la última auditoría para referencia.

### Requirement 4: Catálogo de Visualizaciones y KPIs Sugeridos

**User Story:** Como usuario, quiero recibir sugerencias de gráficos y KPIs apropiados para mis datos, para no tener que saber de antemano qué tipo de visualización es adecuada.

#### Acceptance Criteria

1. WHEN el usuario acepta continuar tras la auditoría PRISM, THE Catálogo_Visualización SHALL analizar los tipos de datos de cada columna y sugerir al menos 3 tipos de gráficos (entre barras, líneas, torta, dispersión y tablas dinámicas) seleccionados según la correspondencia entre el tipo de dato detectado (numérico continuo, categórico, temporal) y el tipo de gráfico compatible.
2. WHEN el análisis de columnas detecta al menos una columna numérica o temporal, THE Catálogo_Visualización SHALL presentar entre 3 y 10 sugerencias de KPIs calculados a partir de operaciones agregadas (suma, promedio, conteo, tasa de cambio, valores mínimo/máximo) sobre las columnas numéricas y temporales detectadas.
3. IF el análisis de columnas no detecta columnas numéricas ni temporales suficientes para generar KPIs, THEN THE Catálogo_Visualización SHALL informar al usuario mediante un mensaje indicando que los datos no contienen columnas numéricas o temporales y ofrecer la opción de agregar visualizaciones manualmente.
4. WHEN el usuario selecciona una sugerencia del catálogo, THE Catálogo_Visualización SHALL generar en no más de 5 segundos una vista previa del gráfico o KPI con los datos reales del usuario, permitiendo las interacciones de zoom, filtrado por rango y tooltip al posicionar el cursor sobre los puntos de datos.
5. THE Catálogo_Visualización SHALL permitir al usuario personalizar cada visualización modificando colores, etiquetas de hasta 100 caracteres, y rango de datos mediante selección de fecha o valor mínimo/máximo.
6. THE Catálogo_Visualización SHALL permitir al usuario agregar hasta 20 visualizaciones propias no incluidas en las sugerencias, seleccionando tipo de gráfico y asignando columnas de datos manualmente.

### Requirement 5: Vinculación a Objetivos Estratégicos

**User Story:** Como usuario, quiero vincular mis KPIs a mis objetivos estratégicos PEI/POA, para alinear mi análisis de datos con la planificación organizacional.

#### Acceptance Criteria

1. THE Módulo_Objetivos SHALL proporcionar un formulario donde el usuario pueda ingresar sus objetivos estratégicos con los campos: nombre (máximo 150 caracteres), descripción (máximo 500 caracteres) y perspectiva BSC (selección única entre: Financiera, Clientes, Procesos Internos, Aprendizaje y Crecimiento), permitiendo registrar hasta 20 objetivos estratégicos.
2. IF el usuario tiene al menos un KPI seleccionado y al menos un objetivo estratégico definido, THEN THE Módulo_Objetivos SHALL permitir vincular cada KPI a uno o más objetivos estratégicos, hasta un máximo de 5 objetivos por KPI.
3. THE Módulo_Objetivos SHALL agrupar visualmente los objetivos y sus KPIs vinculados por cada una de las cuatro perspectivas del Balanced Scorecard: Financiera, Clientes, Procesos Internos, Aprendizaje y Crecimiento.
4. WHEN el usuario solicita generar el documento final, IF existe al menos un objetivo estratégico sin KPI vinculado, THEN THE Módulo_Objetivos SHALL permitir la generación mostrando una advertencia que indique cuáles objetivos carecen de KPI vinculado, e incluir esta información en el documento generado.
5. IF el usuario no define objetivos estratégicos, THEN THE Módulo_Objetivos SHALL permitir generar el documento con KPIs sin vinculación, incluyendo una sección visible en el documento que indique que no se definieron objetivos estratégicos y los KPIs no están alineados a perspectivas BSC.
6. WHEN el usuario selecciona una vinculación existente entre un KPI y un objetivo, THE Módulo_Objetivos SHALL permitir eliminar dicha vinculación.
7. WHEN el usuario ha registrado 20 objetivos estratégicos, THE Módulo_Objetivos SHALL deshabilitar el formulario de creación de nuevos objetivos e indicar que se alcanzó el límite máximo.

### Requirement 6: Integración con Modelos de IA

**User Story:** Como usuario, quiero que el sistema utilice modelos de IA para asistirme en la interpretación de mis datos, para obtener insights que no detectaría manualmente.

#### Acceptance Criteria

1. THE Motor_IA SHALL soportar integración con OpenAI, Google Gemini, Anthropic Claude y modelos locales vía Ollama, permitiendo al usuario configurar la API key y el modelo específico para cada proveedor.
2. WHEN el usuario configura una API key para un proveedor, THE Motor_IA SHALL enviar una solicitud de prueba al proveedor con un timeout máximo de 10 segundos y confirmar la configuración únicamente si se recibe una respuesta válida.
3. THE Motor_IA SHALL enviar al proveedor de IA únicamente metadatos del dataset (nombres de columnas, tipos de datos, número de filas) y resúmenes estadísticos (medias, medianas, distribuciones, correlaciones), sin incluir valores individuales de registros del usuario.
4. WHEN el usuario solicita asistencia de IA, THE Motor_IA SHALL presentar la respuesta del modelo en un panel dedicado con formato estructurado que incluya separación de párrafos, listas y resaltado de términos clave.
5. IF la llamada al proveedor de IA falla por timeout (30 segundos sin respuesta) o error de red, THEN THE Motor_IA SHALL reintentar la solicitud una vez tras 2 segundos de espera y, si persiste el fallo, mostrar al usuario un mensaje que indique el tipo de error y el proveedor afectado.
6. WHERE el usuario configura un modelo local vía Ollama, THE Motor_IA SHALL ejecutar todas las funciones de asistencia de IA (generación de insights, resúmenes y respuestas a consultas) sin requerir conexión a internet.
7. WHEN el usuario selecciona un proveedor activo diferente, THE Motor_IA SHALL cambiar al nuevo proveedor preservando el historial de consultas y respuestas previas de la sesión actual.
8. IF la API key configurada es rechazada por el proveedor (error de autenticación), THEN THE Motor_IA SHALL informar al usuario que la clave es inválida e indicar el proveedor afectado, sin almacenar la clave rechazada como configuración activa.
9. WHEN el navegador no tiene conexión a internet, THE Motor_IA SHALL deshabilitar los proveedores cloud (OpenAI, Gemini, Claude) en la interfaz y mostrar únicamente Ollama como opción disponible. IF tampoco hay proveedor local disponible, THE Motor_IA SHALL bloquear cualquier intento de transmisión de datos a servicios externos.

### Requirement 7: Generación de Documento Descargable (Cuadro de Mando Integral)

**User Story:** Como usuario, quiero generar un documento Markdown descargable con toda la información analizada y estructurada como Cuadro de Mando Integral (CMI/BSC), para tener un entregable profesional con la estructura completa de objetivos, KPIs, fórmulas, condiciones y análisis de datos.

#### Acceptance Criteria

1. WHEN el usuario solicita generar el documento, THE Generador_Documento SHALL producir un archivo .md estructurado con las siguientes secciones obligatorias: Introducción, Definición de Objetivos Estratégicos, Identificación de Dimensiones del CMI, Identificación de KPIs, KPIs necesarios para el CMI, Obtención de Datos y Creación de Gráficos, y Análisis Cuantitativo/Cualitativo.
2. THE Generador_Documento SHALL estructurar la sección de Dimensiones incluyendo únicamente las perspectivas del Balanced Scorecard (Cliente, Procesos Internos, Financiera, Aprendizaje y Crecimiento) para las cuales exista al menos un KPI identificado en el análisis de datos del usuario.
3. THE Generador_Documento SHALL generar para cada KPI una ficha técnica que incluya: Nomenclatura (código abreviado), Nombre completo, Objetivo asociado, Fórmula de cálculo, y Condiciones de evaluación con tres niveles numéricos (Óptimo, Aceptable, Rechazado) expresados como umbrales cuantitativos derivados del análisis de datos.
4. THE Generador_Documento SHALL incluir en la sección de Objetivos Estratégicos al menos una acción por objetivo, donde cada acción describe una actividad observable derivada del análisis de datos y la asistencia de IA.
5. THE Generador_Documento SHALL generar una tabla de análisis que vincule cada KPI con su tipo de análisis (cuantitativo/cualitativo) y la herramienta utilizada para su medición.
6. THE Generador_Documento SHALL incluir la sección de Obtención de Datos mostrando: nombre y dimensiones (filas x columnas) de cada dataset utilizado, lista de transformaciones aplicadas con descripción de entrada y salida, y cada gráfico generado acompañado de un párrafo de interpretación.
7. THE Generador_Documento SHALL incluir metadatos del análisis: fecha de generación en formato ISO 8601 (AAAA-MM-DD), nombre del archivo fuente, puntajes PRISM y proveedor de IA utilizado.
8. THE Generador_Documento SHALL permitir regenerar el documento con datos actualizados preservando las personalizaciones previas del usuario, definidas como: títulos de sección editados manualmente, textos de interpretación modificados y objetivos estratégicos reordenados o renombrados por el usuario.
9. WHEN el documento es generado, THE Generador_Documento SHALL ofrecer la descarga del archivo al dispositivo local del usuario en no más de 3 segundos tras la finalización de la generación.
10. THE Generador_Documento SHALL completar la generación del documento en un tiempo máximo de 30 segundos para cualquier tamaño de dataset soportado.
11. THE Generador_Documento SHALL garantizar la propiedad de round-trip: parsear el documento .md producido y regenerarlo SHALL producir un documento estructuralmente idéntico, definido como igualdad en secciones, orden de secciones, contenido de fichas técnicas de KPI y tablas de análisis.
12. IF los datos del usuario no contienen información suficiente para generar al menos un KPI en alguna perspectiva del BSC, THEN THE Generador_Documento SHALL generar el documento incluyendo únicamente las perspectivas con KPIs válidos e indicar en la sección de Dimensiones cuáles perspectivas fueron omitidas y la razón de su exclusión.

### Requirement 8: Persistencia de Sesión

**User Story:** Como usuario, quiero que mi progreso se guarde localmente, para poder retomar mi análisis sin tener que repetir todos los pasos.

#### Acceptance Criteria

1. THE Sistema SHALL almacenar el estado de la sesión en localStorage del navegador en formato JSON, incluyendo: datos cargados, configuraciones de visualización, KPIs seleccionados, objetivos definidos y marca de tiempo de la última modificación.
2. WHEN transcurren 30 segundos desde el último cambio realizado por el usuario, THE Sistema SHALL guardar automáticamente el estado actual de la sesión en localStorage.
3. WHEN el usuario cierra y reabre la aplicación dentro de los 30 días siguientes a la última sesión guardada, THE Sistema SHALL ofrecer la opción de restaurar la sesión anterior o iniciar una nueva mediante un diálogo con dos botones visibles.
4. IF la sesión almacenada tiene una antigüedad superior a 30 días, THEN THE Sistema SHALL descartarla automáticamente y comenzar una sesión nueva sin ofrecer restauración. IF la operación de descarte falla, THEN THE Sistema SHALL permitir iniciar una nueva sesión igualmente.
5. THE Sistema SHALL limitar el almacenamiento local a un máximo de 100 MB para evitar saturar el almacenamiento del navegador.
6. WHEN el almacenamiento local supera el 80% del límite de 100 MB, THE Sistema SHALL mostrar una notificación en pantalla indicando el porcentaje de uso y sugiriendo exportar o eliminar sesiones antiguas.
7. IF una operación de escritura en localStorage falla por falta de espacio o restricción del navegador, THEN THE Sistema SHALL mostrar un mensaje de error indicando que no se pudo guardar la sesión y sugerir liberar espacio o exportar datos.
8. WHEN el usuario selecciona la opción "Limpiar datos", THE Sistema SHALL solicitar confirmación explícita mediante un diálogo que requiera acción afirmativa antes de proceder con la eliminación de todos los datos almacenados localmente.

### Requirement 9: Seguridad y Protección de Datos

**User Story:** Como usuario, quiero que mis datos y claves de API estén protegidos, para evitar fugas de información o accesos no autorizados.

#### Acceptance Criteria

1. THE Módulo_Seguridad SHALL sanitizar toda entrada del usuario antes de procesarla para prevenir inyección de código XSS, aplicando escape de caracteres HTML y eliminación de etiquetas de script en todos los campos de texto.
2. THE Módulo_Seguridad SHALL implementar Content Security Policy (CSP) headers que restrinjan la ejecución de scripts únicamente al propio origen de la aplicación y bloqueen inline scripts y eval().
3. THE Módulo_Seguridad SHALL almacenar las API keys cifradas en localStorage utilizando AES-256-GCM con una clave derivada del entorno local, y SHALL enmascarar las API keys en la interfaz de usuario mostrando únicamente los últimos 4 caracteres.
4. IF los datos cifrados en localStorage fallan la verificación de integridad al ser leídos, THEN THE Módulo_Seguridad SHALL descartar los datos corruptos, solicitar al usuario que reingrese sus API keys, y registrar el evento en el log de la aplicación. El registro y la solicitud al usuario pueden completarse de forma independiente si alguna de las operaciones falla.
5. THE Módulo_Seguridad SHALL validar los archivos cargados verificando que el tamaño no exceda 50 MB, que la extensión corresponda a los tipos permitidos (.xlsx, .xls, .csv), y que el tipo MIME del contenido coincida con la extensión declarada.
6. THE Módulo_Seguridad SHALL asegurar que ningún dato del usuario se transmita a servidores externos excepto el contenido enviado explícitamente al proveedor de IA configurado por el usuario a través de las llamadas API iniciadas por el propio usuario.
7. IF se detecta un intento de inyección de scripts en campos de entrada, THEN THE Módulo_Seguridad SHALL bloquear la operación, mostrar al usuario un mensaje indicando que la entrada contiene contenido no permitido, y registrar el evento en el log de la aplicación.
8. IF un archivo cargado no supera la validación de tipo MIME, extensión o tamaño, THEN THE Módulo_Seguridad SHALL rechazar el archivo, indicar al usuario el motivo específico del rechazo, y no procesar ningún contenido del archivo.

### Requirement 10: Interfaz de Usuario y Experiencia (UX/UI)

**User Story:** Como usuario, quiero una interfaz intuitiva, accesible y responsiva, para poder usar la aplicación cómodamente desde cualquier dispositivo.

#### Acceptance Criteria

1. THE Sistema SHALL renderizar sin errores de layout, sin elementos superpuestos y con todas las funcionalidades operativas en navegadores Chrome, Firefox, Safari y Edge en sus dos últimas versiones estables.
2. THE Sistema SHALL adaptar su diseño a resoluciones desde 320px hasta 2560px de ancho sin generar desplazamiento horizontal involuntario y manteniendo todos los elementos interactivos visibles y operables.
3. THE Sistema SHALL cumplir con WCAG 2.1 nivel AA en contraste de colores, navegación por teclado y etiquetas ARIA.
4. THE Sistema SHALL presentar un flujo de onboarding paso a paso con un indicador de progreso persistente visible sin necesidad de desplazamiento que muestre la etapa actual y el total de etapas.
5. IF ocurre un error en cualquier etapa del flujo, THEN THE Sistema SHALL mostrar un mensaje en lenguaje no técnico que indique qué ocurrió y qué acción puede tomar el usuario para continuar, y SHALL preservar los datos ingresados por el usuario en la etapa actual.
6. THE Sistema SHALL completar la transición entre etapas del flujo en un tiempo máximo de 500 milisegundos.
7. THE Sistema SHALL soportar modo oscuro y modo claro con un selector visible en todas las páginas, operable mediante teclado y ratón.

### Requirement 11: Arquitectura y Calidad de Código

**User Story:** Como desarrollador, quiero que el código siga principios SOLID y Clean Code, para facilitar el mantenimiento y extensibilidad de la aplicación.

#### Acceptance Criteria

1. THE Sistema SHALL organizar su código en módulos con responsabilidad única, correspondientes a los componentes definidos en el Glosario (Módulo_Carga, Módulo_Detección, Motor_PRISM, Catálogo_Visualización, Módulo_Objetivos, Motor_IA, Generador_Documento, Módulo_Seguridad), donde cada módulo gestione exclusivamente la preocupación funcional descrita en su definición del Glosario.
2. THE Sistema SHALL definir interfaces TypeScript o JSDoc @typedef para la comunicación entre módulos, de modo que reemplazar la implementación de un módulo por otra que cumpla la misma interfaz no requiera modificar el código fuente de los demás módulos.
3. THE Sistema SHALL utilizar inyección de dependencias para el Motor_IA mediante una interfaz de proveedor común, de modo que agregar un nuevo proveedor de IA requiera únicamente crear un nuevo archivo que implemente dicha interfaz, sin modificar el código fuente de módulos existentes.
4. THE Sistema SHALL mantener funciones con un máximo de 30 líneas de código ejecutable, utilizar camelCase para variables y funciones, PascalCase para clases, y nombres en inglés de al menos 3 caracteres (excepto contadores de bucle de una letra y abreviaciones definidas en el Glosario).
5. THE Sistema SHALL incluir documentación JSDoc en todas las funciones y clases públicas, conteniendo como mínimo las etiquetas @param con tipo y descripción para cada parámetro, @returns con tipo y descripción del valor retornado, y @description con un resumen de la función.
6. THE Sistema SHALL pasar análisis estático de código con ESLint configurado con eslint:recommended y plugin @typescript-eslint/recommended como base mínima, con cero errores y cero advertencias en el resultado.
7. IF un módulo importa funcionalidad de otro módulo, THEN THE Sistema SHALL realizar dicha importación exclusivamente a través de la interfaz pública definida del módulo consumido, sin acceder a funciones o variables internas no exportadas.
8. WHEN se añade un nuevo proveedor al Motor_IA, THE Sistema SHALL verificar mediante las pruebas existentes que todos los módulos consumidores del Motor_IA continúan funcionando sin modificaciones a su código fuente.

### Requirement 12: Testing y Aseguramiento de Calidad

**User Story:** Como desarrollador, quiero contar con una suite de pruebas automatizadas, para asegurar que los cambios futuros no rompan funcionalidad existente.

#### Acceptance Criteria

1. THE Sistema SHALL contar con pruebas unitarias que cubran al menos el 80% de las líneas de código de los módulos Motor_PRISM, Módulo_Detección y Generador_Documento, medido mediante el reporte de cobertura del framework de testing configurado.
2. THE Sistema SHALL incluir pruebas basadas en propiedades para el Módulo_Detección que verifiquen que para todo Archivo_Fuente válido (formatos .xlsx, .xls y .csv con datos tabulares de hasta 50 MB), la detección produce una estructura con al menos una columna tipada, ejecutando un mínimo de 100 casos generados por ejecución.
3. THE Sistema SHALL incluir pruebas basadas en propiedades para el Motor_PRISM que verifiquen que los puntajes generados siempre están en el rango entero de 0 a 100 inclusive y que evaluar los mismos datos dos veces consecutivas produce puntajes idénticos, ejecutando un mínimo de 100 casos generados por ejecución.
4. THE Sistema SHALL incluir una prueba de round-trip para el Generador_Documento que verifique que parsear un documento generado y regenerarlo produce un documento con estructura de secciones idéntica y contenido textual equivalente, excluyendo de la comparación los metadatos variables como fecha de generación.
5. WHEN se ejecuta la suite de pruebas completa en un entorno con las dependencias del proyecto instaladas, THE Sistema SHALL completar todas las pruebas en un tiempo máximo de 60 segundos. IF alguna prueba excede el tiempo límite, THE Sistema SHALL reportar las pruebas que fallaron individualmente además del timeout general.
6. THE Sistema SHALL incluir pruebas de integración que verifiquen el flujo completo desde carga de un archivo de ejemplo con al menos 100 filas y 5 columnas de tipos mixtos (numérico, texto, fecha), pasando por detección de estructura, auditoría PRISM y generación de documento, verificando que el documento resultante contiene las secciones obligatorias definidas en el Requisito 7.
7. IF alguna prueba unitaria, de propiedades o de integración falla, THEN THE Sistema SHALL reportar el nombre de la prueba fallida, el módulo afectado y la diferencia entre resultado esperado y resultado obtenido.

### Requirement 13: Manejo de Errores y Degradación Elegante

**User Story:** Como usuario, quiero que la aplicación maneje errores de forma elegante, para no perder mi trabajo ni quedarme sin retroalimentación ante fallos.

#### Acceptance Criteria

1. IF una funcionalidad no esencial falla (sugerencia de IA, análisis automático u otra capacidad dependiente de servicios externos), THEN THE Sistema SHALL continuar operando las funcionalidades principales (carga de archivos, validación PRISM, generación de gráficos, exportación de documentos) y mostrar al usuario una notificación visible en pantalla dentro de los 5 segundos siguientes indicando qué capacidad específica no está disponible.
2. IF ocurre un error inesperado en cualquier módulo, THEN THE Sistema SHALL registrar el error con timestamp, nombre del módulo afectado y stack trace en un log local que el usuario pueda consultar desde la interfaz de la aplicación.
3. THE Sistema SHALL guardar automáticamente el estado de la sesión (datos cargados, configuraciones de análisis, resultados generados y progreso del flujo actual) cada 30 segundos, garantizando que la pérdida máxima de datos ante un fallo no supere 30 segundos de trabajo.
4. WHEN el navegador pierde conexión a internet, THE Sistema SHALL continuar operando todas las funcionalidades que no requieran conexión externa (carga de archivos, validación PRISM, generación de gráficos, exportación de documentos) y mostrar un indicador persistente en la interfaz que identifique cada funcionalidad no disponible por falta de conexión.
5. IF el motor de IA no está disponible, THEN THE Sistema SHALL permitir al usuario completar todo el flujo de análisis manualmente sin asistencia de IA.
6. WHEN el usuario reabre la aplicación y existe una sesión guardada previamente, THE Sistema SHALL detectar la existencia de dicha sesión y ofrecer al usuario la opción de restaurar el estado guardado o iniciar una sesión nueva, dentro de los 3 segundos posteriores a la carga de la aplicación. IF no existe sesión guardada, THEN THE Sistema SHALL iniciar directamente una sesión nueva sin mostrar diálogo de restauración.
7. IF el guardado automático de sesión falla, THEN THE Sistema SHALL notificar al usuario dentro de los 5 segundos siguientes con un mensaje indicando que el guardado automático no está funcionando y que debe guardar su trabajo manualmente.

### Requirement 14: Portabilidad y Distribución

**User Story:** Como usuario, quiero poder ejecutar la aplicación sin instalaciones complejas, para empezar a usarla rápidamente en cualquier entorno.

#### Acceptance Criteria

1. THE Sistema SHALL ser distribuible como un conjunto de archivos (HTML, CSS, JS y opcionalmente un servidor backend) que no requiera instalación de software adicional más allá de un navegador compatible (Chrome, Firefox, Safari o Edge en sus dos últimas versiones estables).
2. THE Sistema SHALL funcionar offline para todas las funcionalidades excepto las llamadas a proveedores de IA remotos.
3. WHERE el usuario ejecuta un servidor local para Ollama, THE Sistema SHALL detectar la disponibilidad del servicio en localhost puerto 11434 con un timeout de 5 segundos, y mostrar un indicador visible del estado de conexión (disponible o no disponible). El sistema también podrá aceptar configuración manual del estado de Ollama sin intentar detección automática.
4. IF la detección del servicio Ollama en localhost falla (conexión intentada pero sin respuesta), el timeout expira, o el servicio reporta no estar disponible, THEN THE Sistema SHALL informar al usuario que el servicio local no está disponible y permitir continuar sin funcionalidades de IA. IF ningún proveedor de IA (local ni cloud) está disponible, THEN THE Sistema SHALL notificar que el análisis asistido por IA no estará disponible y el usuario continuará el flujo sin asistencia de IA.
5. THE Sistema SHALL documentar los pasos de despliegue en un archivo README.md con instrucciones específicas para Windows, macOS y Linux, incluyendo al menos: requisitos previos, pasos para ejecutar la aplicación, y pasos para configurar Ollama (si aplica).
6. WHERE el usuario ejecuta el script de build de archivo único, THE Sistema SHALL producir un archivo HTML autónomo que incluya todo el CSS y JavaScript inlined, con un tamaño máximo de 15 MB, y que sea funcional al abrirse directamente en un navegador sin servidor web.
