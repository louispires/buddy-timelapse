# Coding Standards

This document outlines the coding standards and conventions used in the Prusa Timelapse project.

## TypeScript Configuration

### Compiler Options

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

**Key Settings**:

- **Strict Mode**: All TypeScript strict checks enabled
- **ES2020**: Modern JavaScript features supported
- **Declaration Files**: Generated for library usage
- **Source Maps**: Enabled for debugging

## Code Style Guidelines

### Language Features

#### Variables and Constants

```typescript
// Use const for immutable values
const CONFIG_PATH = "./config.json";
const TIMEOUT_MS = 10000;

// Use let for mutable variables (avoid var)
let currentState: PrinterState = "IDLE";
let retryCount = 0;

// Avoid any type - use proper typing
// ❌ Bad
const result: any = apiCall();

// ✅ Good
const result: StatusResponse = await apiCall();
```

#### Functions and Methods

```typescript
// Use async/await over Promises for readability
// ❌ Bad
function getStatus(): Promise<StatusResponse> {
  return fetchStatus().then((response) => response);
}

// ✅ Good
async function getStatus(): Promise<StatusResponse> {
  const response = await fetchStatus();
  return response;
}

// Use arrow functions for callbacks and short functions
// ✅ Good
const statusHandler = (status: StatusResponse) => {
  console.log(`Printer state: ${status.printer.state}`);
};

// Use named functions for complex operations
// ✅ Good
async function handlePrintStart(jobId: number): Promise<void> {
  console.log(`Starting timelapse for job ${jobId}`);
  await this.capture.startCapture();
}
```

#### Error Handling

```typescript
// Custom error classes for specific error types
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public responseBody?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Use try/catch with specific error types
try {
  const status = await apiClient.getStatus();
  // Process status
} catch (error) {
  if (error instanceof ApiError) {
    console.error(`API Error: ${error.message}`);
  } else {
    console.error(`Unexpected error: ${(error as Error).message}`);
  }
}
```

#### Type Definitions

```typescript
// Use interfaces for object shapes
interface PrusaLinkConfig {
  host: string;
  port: number;
  username: string;
  password: string;
}

// Use type unions for enums
type PrinterState =
  | "IDLE"
  | "BUSY"
  | "PRINTING"
  | "PAUSED"
  | "FINISHED"
  | "STOPPED"
  | "ERROR"
  | "ATTENTION"
  | "READY";

// Use generics for reusable types
interface Result<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

### Naming Conventions

#### Files and Directories

```
src/
├── types/          # Type definitions
├── config/         # Configuration handling
├── api/           # External API clients
├── timelapse/     # Timelapse functionality
├── monitor/       # Monitoring services
└── index.ts       # Main entry point
```

#### Variables and Functions

```typescript
// camelCase for variables, functions, methods
const apiClient = new PrusaLinkClient(config);
async function loadConfig(path: string): Promise<AppConfig>

// PascalCase for classes, interfaces, types
class PrintMonitor {}
interface StatusResponse {}
type PrinterState = "IDLE" | "PRINTING";

// UPPER_SNAKE_CASE for constants
const DEFAULT_POLL_INTERVAL = 10;
const CONFIG_FILE_NAME = "config.json";

// Private members prefixed with underscore (TypeScript convention)
private _isMonitoring = false;
```

#### Files

```typescript
// kebab-case for file names
// index.ts, api-client.ts, config-loader.ts

// Use index.ts for main module files
// src/config/index.ts exports the config loading functions
```

### Code Organization

#### Import/Export Patterns

```typescript
// Group imports by type, then alphabetically
import { spawn } from "child_process";
import { readFileSync } from "fs";
import { resolve } from "path";

import { ApiError, PrusaLinkClient } from "../api/client";
import { TimelapseCapture } from "../timelapse";
import { AppConfig } from "../types/config";

// Use named exports over default exports
export { loadConfig, ConfigError };
export class PrusaLinkClient {}

// Import types from dedicated type files
import type { StatusResponse } from "../types/api";
```

#### Class Organization

```typescript
export class PrintMonitor {
  // Public properties first
  public isMonitoring = false;

  // Private properties
  private config: AppConfig;
  private apiClient: PrusaLinkClient;

  // Constructor
  constructor(config: AppConfig) {
    this.config = config;
    this.apiClient = new PrusaLinkClient(config.prusaLink);
  }

  // Public methods
  public async startMonitoring(): Promise<void> {
    // Implementation
  }

  // Private methods
  private async checkStatus(): Promise<void> {
    // Implementation
  }
}
```

### Documentation Standards

#### JSDoc Comments

````typescript
/**
 * Loads and validates application configuration from a JSON file.
 *
 * @param configPath - Path to the configuration file
 * @returns Parsed and validated configuration object
 * @throws {ConfigError} When configuration is invalid or file cannot be read
 *
 * @example
 * ```typescript
 * const config = loadConfig('./config.json');
 * console.log(config.prusaLink.host);
 * ```
 */
export function loadConfig(configPath: string): AppConfig {
  // Implementation
}
````

#### Inline Comments

```typescript
// Use comments for complex logic
// Calculate output filename with timestamp and job ID
const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
const jobSuffix = jobId ? `_job${jobId}` : "";
const filename = `timelapse_${timestamp}${jobSuffix}.mp4`;
```

### Testing Standards

#### Test File Organization

```
src/
├── config/
│   ├── index.ts
│   └── index.test.ts    # Unit tests for config module
```

#### Test Structure

```typescript
describe("loadConfig", () => {
  it("should load valid configuration", () => {
    const configPath = "./config.test.json";
    const config = loadConfig(configPath);

    expect(config.prusaLink.host).toBe("192.168.1.100");
    expect(config.prusaLink.port).toBe(80);
  });

  it("should throw ConfigError for invalid JSON", () => {
    const configPath = "./invalid.json";

    expect(() => loadConfig(configPath)).toThrow(ConfigError);
  });
});
```

### Error Handling Patterns

#### Custom Error Classes

```typescript
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public responseBody?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}
```

#### Error Propagation

```typescript
// Let errors bubble up to appropriate handlers
async function getStatus(): Promise<StatusResponse> {
  try {
    const response = await this.apiClient.getStatus();
    return response;
  } catch (error) {
    // Log the error but re-throw for higher-level handling
    console.error(`Failed to get status: ${(error as Error).message}`);
    throw error;
  }
}
```

### Performance Considerations

#### Resource Management

```typescript
// Always clean up resources
export class TimelapseCapture {
  private captureProcess: ChildProcess | null = null;

  async stopCapture(): Promise<void> {
    if (this.captureProcess) {
      this.captureProcess.kill("SIGTERM");

      // Wait for graceful shutdown
      await new Promise<void>((resolve) => {
        this.captureProcess!.on("exit", () => {
          this.captureProcess = null;
          resolve();
        });

        // Force kill after timeout
        setTimeout(() => {
          if (this.captureProcess) {
            this.captureProcess.kill("SIGKILL");
            this.captureProcess = null;
          }
          resolve();
        }, 5000);
      });
    }
  }
}
```

#### Memory Management

```typescript
// Clear large objects when done
private clearTempDirectory(): void {
  try {
    const files = readdirSync(this.tempDir);
    for (const file of files) {
      if (file.startsWith("img_") && file.endsWith(".jpg")) {
        unlinkSync(join(this.tempDir, file));
      }
    }
  } catch (error) {
    // Directory might not exist, ignore
  }
}
```

## Development Workflow

### Pre-commit Hooks

- Run TypeScript compiler before commits
- Execute linting and formatting checks
- Run unit tests

### Code Review Checklist

- [ ] TypeScript strict mode compliance
- [ ] Proper error handling implementation
- [ ] Resource cleanup verification
- [ ] Configuration validation coverage
- [ ] Documentation updates
- [ ] Test coverage for new functionality

### Dependency Management

```json
{
  "scripts": {
    "build": "tsc",
    "dev": "tsc && node dist/index.js",
    "test": "jest",
    "lint": "eslint src/**/*.ts",
    "format": "prettier --write src/**/*.ts"
  }
}
```
