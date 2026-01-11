import { spawn } from "child_process";
import { resolve } from "path";
import { ApiError, PrusaLinkClient } from "../api/client";
import { assembleVideo, TimelapseCapture } from "../timelapse";
import { PrinterState } from "../types/api";
import { AppConfig } from "../types/config";

export class MonitorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MonitorError";
  }
}

export class PrintMonitor {
  private config: AppConfig;
  private apiClient: PrusaLinkClient;
  private timelapseCapture: TimelapseCapture;
  private currentPrintId: number | null = null;
  private isMonitoring = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private lastPrinterState: PrinterState | null = null;

  constructor(config: AppConfig) {
    this.config = config;
    this.apiClient = new PrusaLinkClient(config.prusaLink);
    this.timelapseCapture = new TimelapseCapture(config.timelapse);
  }

  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      throw new MonitorError("Monitoring already started");
    }

    console.log("Starting print monitoring...");
    this.isMonitoring = true;

    // Initial status check
    await this.checkStatus();

    // Start periodic monitoring
    this.monitoringInterval = setInterval(() => {
      this.checkStatus().catch((error) => {
        console.error(`Error during status check: ${error.message}`);
      });
    }, this.config.pollInterval * 1000);
  }

  async stopMonitoring(): Promise<void> {
    if (!this.isMonitoring) {
      return;
    }

    console.log("Stopping print monitoring...");
    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    // Stop any ongoing capture
    if (this.timelapseCapture.isCurrentlyCapturing()) {
      await this.stopTimelapseCapture();
    }
  }

  private async checkStatus(): Promise<void> {
    try {
      const status = await this.apiClient.getStatus();
      const currentState = status.printer.state;
      const currentJobId = status.job?.id || null;

      console.log(`Printer state: ${currentState}, Job ID: ${currentJobId}`);

      // Check for state transitions
      const previousState = this.lastPrinterState;

      // Print started
      if (
        previousState !== "PRINTING" &&
        currentState === "PRINTING" &&
        currentJobId !== null
      ) {
        await this.handlePrintStarted(currentJobId);
      }
      // Print finished/stopped
      else if (
        previousState === "PRINTING" &&
        (currentState === "FINISHED" ||
          currentState === "STOPPED" ||
          currentState === "ERROR")
      ) {
        await this.handlePrintFinished(currentJobId);
      }

      this.lastPrinterState = currentState;
      this.currentPrintId = currentJobId;
    } catch (error) {
      if (error instanceof ApiError) {
        console.error(`API Error: ${error.message}`);
      } else {
        console.error(`Unexpected error: ${(error as Error).message}`);
      }
      // Continue monitoring despite errors
    }
  }

  private async handlePrintStarted(jobId: number): Promise<void> {
    console.log(`Print started (Job ID: ${jobId})`);

    // Reject if already capturing (shouldn't happen, but safety check)
    if (this.timelapseCapture.isCurrentlyCapturing()) {
      console.warn(
        "Timelapse capture already in progress, rejecting new print"
      );
      return;
    }

    try {
      await this.timelapseCapture.startCapture();
      console.log("Timelapse capture started");
    } catch (error) {
      console.error(
        `Failed to start timelapse capture: ${(error as Error).message}`
      );
    }
  }

  private async handlePrintFinished(jobId: number | null): Promise<void> {
    console.log(`Print finished (Job ID: ${jobId})`);

    if (!this.timelapseCapture.isCurrentlyCapturing()) {
      console.log("No active timelapse capture to stop");
      return;
    }

    try {
      // Stop capture
      await this.stopTimelapseCapture();

      // Assemble video
      const outputPath = this.generateOutputPath(jobId);
      await assembleVideo(this.config.timelapse, outputPath);

      // Send notification
      await this.sendNotification(outputPath);

      console.log(`Timelapse completed: ${outputPath}`);
    } catch (error) {
      console.error(
        `Error during timelapse completion: ${(error as Error).message}`
      );
    }
  }

  private async stopTimelapseCapture(): Promise<void> {
    try {
      await this.timelapseCapture.stopCapture();
      console.log("Timelapse capture stopped");
    } catch (error) {
      console.error(
        `Error stopping timelapse capture: ${(error as Error).message}`
      );
      throw error;
    }
  }

  private generateOutputPath(jobId: number | null): string {
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, -5);
    const jobSuffix = jobId ? `_job${jobId}` : "";
    const filename = `timelapse_${timestamp}${jobSuffix}.mp4`;
    return resolve(this.config.timelapse.outputDirectory, filename);
  }

  private async sendNotification(outputPath: string): Promise<void> {
    try {
      // Execute the configured notification command
      const command = this.config.notification.command
        .replace("{outputPath}", outputPath)
        .replace("{outputDir}", this.config.timelapse.outputDirectory);

      console.log(`Executing notification command: ${command}`);

      await new Promise<void>((resolve, reject) => {
        const child = spawn(command, { shell: true, stdio: "inherit" });

        child.on("error", (error) => {
          reject(
            new MonitorError(`Notification command failed: ${error.message}`)
          );
        });

        child.on("exit", (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(
              new MonitorError(`Notification command exited with code ${code}`)
            );
          }
        });
      });

      console.log("Notification sent successfully");
    } catch (error) {
      console.error(`Failed to send notification: ${(error as Error).message}`);
      // Don't throw - notification failure shouldn't stop the process
    }
  }

  isCurrentlyMonitoring(): boolean {
    return this.isMonitoring;
  }

  getCurrentPrintId(): number | null {
    return this.currentPrintId;
  }

  isCapturing(): boolean {
    return this.timelapseCapture.isCurrentlyCapturing();
  }
}
