# Architecture Overview

This document provides a high-level overview of the Prusa Timelapse system architecture, design patterns, and component interactions.

## System Overview

The Prusa Timelapse service is a TypeScript CLI application that automatically monitors Prusa 3D printers and creates timelapse videos of print jobs. The system integrates with PrusaLink API for printer monitoring and uses ffmpeg for video processing.

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   PrusaLink     │    │  RTSP Camera    │    │   File System   │
│      API        │    │    Stream       │    │                 │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    Prusa Timelapse Service                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│  │  Monitor    │  │ Timelapse  │  │   Config    │           │
│  │   Service   │◄─┤   Engine   │  │ Management  │           │
│  └─────────────┘  └─────────────┘  └─────────────┘           │
│         │                      │                      │      │
│         └──────────────────────┼──────────────────────┘      │
│                                ▼                             │
│                     ┌─────────────┐                          │
│                     │   CLI       │                          │
│                     │ Interface   │                          │
│                     └─────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. CLI Interface (`src/index.ts`)

**Responsibilities**:

- Command-line argument parsing
- Application lifecycle management
- Graceful shutdown handling
- Status reporting

**Key Features**:

- Single configuration file parameter
- SIGINT/SIGTERM signal handling
- Periodic status logging
- Error boundary for uncaught exceptions

### 2. Configuration Management (`src/config/`)

**Responsibilities**:

- JSON configuration file loading
- Schema validation
- Type-safe configuration objects
- Error reporting for invalid configs

**Configuration Sections**:

- **PrusaLink**: API connection settings
- **Timelapse**: Video capture and output settings
- **Notification**: Command execution for completion alerts
- **Monitoring**: Polling intervals and behavior

### 3. API Client (`src/api/`)

**Responsibilities**:

- HTTP communication with PrusaLink API
- Authentication handling
- Response parsing and typing
- Error handling and retry logic

**Key Endpoints**:

- `GET /api/v1/status`: Printer state and job information

### 4. Timelapse Engine (`src/timelapse/`)

**Responsibilities**:

- RTSP stream capture management
- Video assembly from image sequences
- Process lifecycle management
- Temporary file cleanup

**Components**:

- **TimelapseCapture**: Manages ffmpeg capture process
- **assembleVideo**: Converts images to MP4 video

### 5. Monitor Service (`src/monitor/`)

**Responsibilities**:

- Periodic API polling
- State machine management
- Event-driven timelapse triggering
- Notification execution

**State Machine**:

```
IDLE/BUSY/READY → PRINTING → FINISHED/STOPPED/ERROR
```

## Data Flow

### Normal Operation Flow

1. **Startup**:

   ```
   CLI → Config Loading → Monitor Initialization → API Client Setup
   ```

2. **Monitoring Loop**:

   ```
   Monitor → API Client → Status Response → State Evaluation
   ```

3. **Print Detection**:

   ```
   State Change (IDLE→PRINTING) → Timelapse Start → ffmpeg Capture
   ```

4. **Print Completion**:
   ```
   State Change (PRINTING→FINISHED) → Timelapse Stop → Video Assembly → Notification
   ```

### Error Handling Flow

```
Any Component → Error Caught → Logged → Service Continues (if recoverable)
                                       ↓
Graceful Shutdown ← Fatal Error ← Error Propagation
```

## Design Patterns

### Observer Pattern

The monitoring service observes printer state changes and triggers appropriate actions.

```typescript
class PrintMonitor {
  private lastPrinterState: PrinterState | null = null;

  private async checkStatus(): Promise<void> {
    const status = await this.apiClient.getStatus();
    const currentState = status.printer.state;

    // Observe state transitions
    if (this.lastPrinterState !== "PRINTING" && currentState === "PRINTING") {
      await this.handlePrintStarted(status.job?.id);
    }

    this.lastPrinterState = currentState;
  }
}
```

### Factory Pattern

Components are instantiated with configuration, allowing for flexible setup.

```typescript
class PrintMonitor {
  constructor(config: AppConfig) {
    this.config = config;
    this.apiClient = new PrusaLinkClient(config.prusaLink);
    this.timelapseCapture = new TimelapseCapture(config.timelapse);
  }
}
```

### Error Boundary Pattern

Errors are caught at appropriate levels and handled gracefully.

```typescript
// Service level error handling
private async checkStatus(): Promise<void> {
  try {
    const status = await this.apiClient.getStatus();
    // Process status
  } catch (error) {
    console.error(`Status check failed: ${(error as Error).message}`);
    // Continue monitoring despite errors
  }
}
```

### Process Abstraction

ffmpeg processes are wrapped in classes with clean interfaces.

```typescript
class TimelapseCapture {
  async startCapture(): Promise<void> {
    // Abstract away ffmpeg process management
  }

  async stopCapture(): Promise<void> {
    // Clean process termination
  }
}
```

## Component Relationships

### Dependency Injection

```
CLI Interface
    ↓
PrintMonitor
    ├── PrusaLinkClient (API access)
    ├── TimelapseCapture (video processing)
    └── AppConfig (configuration)
```

### Data Flow

```
Config File → loadConfig() → AppConfig
                              ↓
                    PrintMonitor Constructor
                              ↓
                API Client + Timelapse Engine
                              ↓
                    Status Polling Loop
                              ↓
              State Changes → Actions
```

## Concurrency Model

### Single-Threaded Design

- Node.js runs on single thread
- No complex concurrency issues
- Sequential processing of API responses

### Process Management

- ffmpeg processes run as child processes
- Monitored for lifecycle events
- Graceful termination with fallbacks

### State Synchronization

- Single state machine instance
- Atomic state transitions
- No race conditions in monitoring loop

## Performance Characteristics

### Memory Usage

- Minimal baseline memory footprint
- Temporary file cleanup prevents accumulation
- Streaming processing for large video files

### CPU Usage

- Low polling overhead (configurable intervals)
- ffmpeg processes handle heavy computation
- Event-driven architecture minimizes idle processing

### Network Usage

- Small API polling requests
- RTSP streaming during capture only
- Configurable polling frequency

## Scalability Considerations

### Current Limitations

- Single printer monitoring
- Synchronous processing
- File system storage only

### Future Extensions

- Multiple printer support
- Database storage
- Cloud storage integration
- Distributed processing

## Security Model

### Authentication

- HTTP Basic Authentication (initial)
- Digest Authentication (planned enhancement)
- Credentials stored in configuration files

### Network Security

- Local network communication assumed
- No encryption in current implementation
- Firewall considerations for RTSP streams

### File System Security

- Output directory permissions
- Temporary file cleanup
- No sensitive data storage

## Deployment Architecture

### Standalone Service

```
┌─────────────────┐
│   CLI Service   │
│                 │
│  ┌────────────┐ │
│  │   Config   │ │
│  │    File    │ │
│  └────────────┘ │
└─────────────────┘
        │
        ▼
┌─────────────────┐
│  ffmpeg & Node  │
│  Dependencies   │
└─────────────────┘
```

### Integration Points

- PrusaLink API (network)
- RTSP Camera Stream (network)
- File System (local)
- Notification Commands (shell)

## Monitoring and Observability

### Logging

- Console-based logging
- Structured error messages
- Periodic status reports
- Debug information for troubleshooting

### Health Checks

- API connectivity verification
- Process health monitoring
- Configuration validation
- Resource usage tracking

### Error Recovery

- Automatic retry for transient failures
- Graceful degradation
- Service continuity despite errors
- Manual intervention points

## Future Architecture Evolution

### Planned Improvements

- **Microservices**: Separate monitoring and processing
- **Web Interface**: REST API for external control
- **Database**: Persistent storage for metadata
- **Containerization**: Docker deployment support

### API Extensions

- **Webhook Support**: Push-based notifications
- **Batch Processing**: Multiple video processing
- **Cloud Integration**: Remote storage and processing

This architecture provides a solid foundation for automated timelapse creation while maintaining simplicity and reliability.
