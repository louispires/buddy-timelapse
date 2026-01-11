# API Specifications

This document details the external API integrations used by the Prusa Timelapse service.

## PrusaLink API Integration

### Overview

The service integrates with PrusaLink API v1.0.0 to monitor printer status and detect print events.

**Source**: https://raw.githubusercontent.com/prusa3d/Prusa-Link-Web/master/spec/openapi.yaml

### Authentication

- **Type**: API Key Authentication
- **Header**: `X-Api-Key: <api_key>`
- **Note**: Obtain API key from PrusaLink web interface
- **Credentials**: Configured via `prusaLink.apiKey`

### Endpoints Used

#### GET /api/v1/status

**Purpose**: Retrieve current printer status and job information

**Response Schema**:

```typescript
interface StatusResponse {
  printer: {
    state:
      | "IDLE"
      | "BUSY"
      | "PRINTING"
      | "PAUSED"
      | "FINISHED"
      | "STOPPED"
      | "ERROR"
      | "ATTENTION"
      | "READY";
    temp_nozzle?: number;
    target_nozzle?: number;
    temp_bed?: number;
    target_bed?: number;
    // ... additional optional fields
  };
  job?: {
    id?: number;
    progress?: number;
    time_remaining?: number;
    time_printing?: number;
  };
  transfer?: {
    id: number;
    time_transferring: number;
    progress?: number;
    data_transferred?: number;
  };
}
```

**Usage**:

- Polled every `pollInterval` seconds (default: 10)
- Monitors `printer.state` for transitions
- Triggers timelapse capture when state changes to "PRINTING"
- Stops capture when state changes from "PRINTING" to terminal states

### State Machine

The service implements a state machine based on PrusaLink printer states:

```
Any State ────▶ PRINTING ────▶ Any Non-PRINTING State
```

**Valid Printer States**:

- `IDLE` - Printer is idle
- `BUSY` - Printer is busy with non-print operations
- `PRINTING` - Print job is active
- `PAUSED` - Print job is paused
- `FINISHED` - Print job completed successfully
- `STOPPED` - Print job was stopped by user
- `ERROR` - Print job failed with error
- `ATTENTION` - Printer requires attention
- `READY` - Printer is ready for new job

**Transitions**:

- **PRINTING start**: Initialize timelapse capture (any non-PRINTING → PRINTING)
- **PRINTING end**: Stop capture and assemble video (PRINTING → any non-PRINTING)

### Error Handling

**HTTP Errors**:

- `401 Unauthorized`: Invalid or missing API key
- `404 Not Found`: API endpoint not available
- `500 Internal Server Error`: PrusaLink service issues

**Network Errors**:

- Connection timeouts (10s timeout configured)
- DNS resolution failures
- Network connectivity issues

**Recovery Strategy**:

- Continue monitoring despite individual request failures
- Log errors but don't stop service
- Implement exponential backoff for persistent failures (future enhancement)

## ffmpeg Integration

### Overview

ffmpeg is used for RTSP stream capture and video assembly operations.

### Commands Used

#### RTSP Capture

```bash
ffmpeg -rtsp_transport tcp \
       -i {rtspUrl} \
       -vf fps=1/{captureInterval} \
       -y {tempDir}/img_%05d.jpg
```

**Parameters**:

- `rtsp_transport tcp`: Force TCP transport for RTSP
- `-i {rtspUrl}`: Input RTSP stream URL
- `-vf fps=1/{captureInterval}`: Video filter to capture 1 frame every N seconds
- `-y`: Overwrite existing files
- `{tempDir}/img_%05d.jpg`: Output pattern for captured frames

#### Video Assembly

```bash
ffmpeg -framerate {outputFramerate} \
       -i {tempDir}/img_%05d.jpg \
       -c:v libx264 \
       -pix_fmt yuv420p \
       -y {outputPath}
```

**Parameters**:

- `-framerate {outputFramerate}`: Input framerate (typically 30 fps)
- `-i {inputPattern}`: Input image sequence pattern
- `-c:v libx264`: H.264 video codec
- `-pix_fmt yuv420p`: Pixel format compatible with most players
- `-y`: Overwrite output file

### Process Management

**Spawn Strategy**:

- Capture process runs continuously during print
- Assembly process runs once per completed timelapse
- Processes are monitored for errors and exit codes

**Cleanup**:

- SIGTERM sent for graceful shutdown
- SIGKILL as fallback after 5 seconds
- Temporary files cleaned between captures

### Error Scenarios

**Capture Failures**:

- RTSP stream unavailable
- Camera connection lost
- Insufficient permissions
- Storage space exhausted

**Assembly Failures**:

- No captured frames available
- ffmpeg codec issues
- Output directory permissions
- Disk space insufficient

## Notification System

### Command Execution

The service executes configurable shell commands for notifications:

**Template Variables**:

- `{outputPath}`: Full path to completed video file
- `{outputDir}`: Output directory path

**Examples**:

```bash
# Simple echo notification
echo "Timelapse completed: {outputPath}"

# Slack webhook
curl -X POST -H 'Content-Type: application/json' \
     -d '{"text":"Timelapse completed: {outputPath}"}' \
     https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK

# Email notification (requires mail command)
echo "Timelapse video ready: {outputPath}" | mail -s "Print Complete" user@example.com
```

### Process Execution

- Commands run via Node.js `spawn` with shell execution
- Exit codes monitored for success/failure
- stdout/stderr captured for debugging
- Timeout handling (inherited from parent process)

## Future API Enhancements

### Planned Integrations

- **Digest Authentication**: More secure auth method for PrusaLink
- **Webhook Notifications**: Push-based notifications instead of polling
- **PrusaConnect API**: Cloud-based monitoring and notifications
- **Multiple Camera Support**: Concurrent capture from multiple RTSP streams

### API Version Compatibility

- Current implementation targets PrusaLink v1.0.0
- Monitor API changes in future firmware updates
- Implement version detection and adaptation

### Rate Limiting

- Current polling interval: configurable (default 10s)
- Consider API rate limits in production deployments
- Implement intelligent backoff strategies
