# Dashboard Onboarding Analítico Individual

Aplicación web local-first que guía al usuario a través de un proceso estructurado de análisis de datos utilizando la metodología PRISM. Permite cargar archivos Excel/CSV, detectar estructura, auditar calidad de datos, sugerir KPIs y visualizaciones, vincular a objetivos estratégicos (PEI/POA) y generar un documento Markdown descargable estructurado como Cuadro de Mando Integral (Balanced Scorecard).

## Características principales

- Carga y validación de archivos Excel (.xlsx, .xls) y CSV
- Detección automática de estructura de datos (tipos, columnas, hojas)
- Auditoría de calidad con metodología PRISM (Precisión, Relevancia, Integridad, Suficiencia, Mantenibilidad)
- Catálogo de visualizaciones y KPIs sugeridos automáticamente
- Vinculación de KPIs a objetivos estratégicos PEI/POA
- Integración con modelos de IA (OpenAI, Gemini, Claude, Ollama local)
- Generación de documento BSC descargable en Markdown
- Funciona completamente offline (local-first)
- Empaquetable como archivo HTML único autónomo

## Requisitos previos

| Requisito | Versión mínima |
|-----------|---------------|
| Node.js   | ≥ 18.0        |
| npm       | ≥ 9.0         |
| Navegador | Chrome, Firefox, Safari o Edge (últimas 2 versiones) |

### Requisitos opcionales

| Requisito | Para qué se usa |
|-----------|----------------|
| Ollama    | Modelos de IA locales (sin conexión a internet) |

## Inicio rápido

### 1. Clonar o descargar el proyecto

```bash
git clone <url-del-repositorio>
cd onboardingPlayer
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Ejecutar en modo desarrollo

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`.

### 4. Compilar para producción

```bash
npm run build
```

Los archivos compilados se generan en la carpeta `dist/`.

### 5. Generar archivo HTML único

```bash
npm run build:single
```

Genera un archivo HTML autónomo en `dist/index.html` con todo el CSS y JavaScript inlined. Este archivo puede abrirse directamente en cualquier navegador sin necesidad de un servidor web.

### 6. Previsualizar la compilación

```bash
npm run preview
```

## Instrucciones por sistema operativo

### Windows

```powershell
# 1. Instalar Node.js desde https://nodejs.org/ (LTS recomendado)
# 2. Abrir PowerShell o CMD

# Verificar instalación
node --version
npm --version

# Clonar e instalar
git clone <url-del-repositorio>
cd onboardingPlayer
npm install

# Desarrollo
npm run dev

# Compilar archivo HTML único
npm run build:single

# El archivo generado está en dist\index.html
# Abrir directamente con doble clic o:
start dist\index.html
```

### macOS

```bash
# 1. Instalar Node.js con Homebrew (recomendado)
brew install node

# O descargar desde https://nodejs.org/

# Verificar instalación
node --version
npm --version

# Clonar e instalar
git clone <url-del-repositorio>
cd onboardingPlayer
npm install

# Desarrollo
npm run dev

# Compilar archivo HTML único
npm run build:single

# Abrir el archivo generado
open dist/index.html
```

### Linux (Ubuntu/Debian)

```bash
# 1. Instalar Node.js (usando NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verificar instalación
node --version
npm --version

# Clonar e instalar
git clone <url-del-repositorio>
cd onboardingPlayer
npm install

# Desarrollo
npm run dev

# Compilar archivo HTML único
npm run build:single

# Abrir el archivo generado
xdg-open dist/index.html
```

## Configuración de Ollama (IA local)

Ollama permite ejecutar modelos de inteligencia artificial de forma local, sin necesidad de conexión a internet ni envío de datos a servicios externos.

### Instalar Ollama

#### Windows

1. Descargar el instalador desde [https://ollama.com/download/windows](https://ollama.com/download/windows)
2. Ejecutar el instalador y seguir las instrucciones
3. Ollama se inicia automáticamente como servicio

#### macOS

```bash
# Opción 1: Descargar desde https://ollama.com/download/mac
# Opción 2: Instalar con Homebrew
brew install ollama
```

#### Linux

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

### Iniciar el servicio de Ollama

#### Windows

Ollama se ejecuta automáticamente como servicio tras la instalación. Si necesita iniciarlo manualmente:

```powershell
ollama serve
```

#### macOS

```bash
# Si se instaló con Homebrew:
brew services start ollama

# O manualmente:
ollama serve
```

#### Linux

```bash
# Con systemd:
sudo systemctl start ollama

# O manualmente:
ollama serve
```

### Descargar un modelo

```bash
# Modelo recomendado para análisis de datos (ligero)
ollama pull llama3.2

# Modelos alternativos
ollama pull mistral
ollama pull phi3
```

### Verificar conectividad

La aplicación se conecta a Ollama en `http://localhost:11434`. Para verificar que el servicio está activo:

```bash
curl http://localhost:11434
```

Debe responder: `Ollama is running`

También puede verificar los modelos disponibles:

```bash
curl http://localhost:11434/api/tags
```

### Configuración en la aplicación

1. Abrir el Dashboard Onboarding Analítico
2. En la sección de configuración de IA, seleccionar **Ollama** como proveedor
3. La URL base por defecto es `http://localhost:11434`
4. Seleccionar el modelo descargado de la lista disponible
5. La aplicación verificará la conectividad automáticamente

## Guía de uso

La aplicación guía al usuario a través de un flujo paso a paso (wizard):

1. **Carga de datos** — Seleccionar o arrastrar archivo Excel/CSV (máximo 50 MB, 100,000 filas)
2. **Detección de estructura** — Revisión automática de columnas, tipos de datos y hojas
3. **Auditoría PRISM** — Evaluación de calidad en 5 dimensiones con puntajes de 0-100
4. **Visualizaciones y KPIs** — Sugerencias automáticas de gráficos e indicadores clave
5. **Objetivos estratégicos** — Vinculación de KPIs a objetivos PEI/POA por perspectiva BSC
6. **Generación de documento** — Descarga de archivo Markdown con estructura de Cuadro de Mando Integral

El progreso se guarda automáticamente cada 30 segundos. Al reabrir la aplicación (dentro de 30 días) se ofrece restaurar la sesión anterior.

## Testing

```bash
# Ejecutar todas las pruebas
npm test

# Ejecutar pruebas en modo watch
npm run test:watch

# Ejecutar pruebas con reporte de cobertura
npm run test:coverage
```

La suite incluye pruebas unitarias y pruebas basadas en propiedades (fast-check) que validan correctitud universal de los módulos core.

## Linting

```bash
npm run lint
```

ESLint configurado con `eslint:recommended` + `@typescript-eslint/recommended`. Se requiere cero errores y cero warnings.

## Stack tecnológico

| Componente | Tecnología |
|------------|-----------|
| Lenguaje | TypeScript 5.x (strict mode) |
| Bundler | Vite 6.x |
| Build HTML único | vite-plugin-singlefile |
| Testing | Vitest 2.x |
| Property-based testing | fast-check 3.x |
| Parseo Excel | SheetJS (xlsx) |
| Criptografía | Web Crypto API (AES-256-GCM) |
| Almacenamiento | localStorage |
| IA local | Ollama |
| IA cloud | OpenAI, Google Gemini, Anthropic Claude |
| Linting | ESLint + @typescript-eslint |

## Estructura del proyecto

```
src/
├── app/              # Orquestador de flujo y contenedor DI
├── infrastructure/   # Servicios transversales (storage, logging)
├── modules/
│   ├── carga/        # Módulo de carga de archivos
│   ├── deteccion/    # Detección de estructura de datos
│   ├── prism/        # Motor de auditoría PRISM
│   ├── visualizacion/# Catálogo de visualizaciones y KPIs
│   ├── objetivos/    # Vinculación a objetivos estratégicos
│   ├── ia/           # Motor de IA y proveedores
│   ├── documento/    # Generador de documento BSC
│   └── seguridad/    # Módulo de seguridad transversal
├── types/            # Tipos e interfaces compartidas
└── ui/               # Componentes de presentación
tests/                # Pruebas unitarias y de integración
dist/                 # Archivos compilados (generado)
```

## Licencia

Proyecto académico de uso privado.
