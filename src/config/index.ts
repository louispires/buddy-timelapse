import { readFileSync } from "fs";
import { AppConfig } from "../types/config";

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

function validateConfig(config: any): AppConfig {
  if (!config) {
    throw new ConfigError("Configuration is empty");
  }

  // Validate prusaLink section
  if (!config.prusaLink) {
    throw new ConfigError("Missing prusaLink configuration section");
  }
  const prusaLink = config.prusaLink;
  if (!prusaLink.host || typeof prusaLink.host !== "string") {
    throw new ConfigError("Invalid or missing prusaLink.host");
  }
  if (
    !prusaLink.port ||
    typeof prusaLink.port !== "number" ||
    prusaLink.port <= 0
  ) {
    throw new ConfigError("Invalid or missing prusaLink.port");
  }
  if (!prusaLink.username || typeof prusaLink.username !== "string") {
    throw new ConfigError("Invalid or missing prusaLink.username");
  }
  if (!prusaLink.password || typeof prusaLink.password !== "string") {
    throw new ConfigError("Invalid or missing prusaLink.password");
  }

  // Validate timelapse section
  if (!config.timelapse) {
    throw new ConfigError("Missing timelapse configuration section");
  }
  const timelapse = config.timelapse;
  if (!timelapse.rtspUrl || typeof timelapse.rtspUrl !== "string") {
    throw new ConfigError("Invalid or missing timelapse.rtspUrl");
  }
  if (
    !timelapse.captureInterval ||
    typeof timelapse.captureInterval !== "number" ||
    timelapse.captureInterval <= 0
  ) {
    throw new ConfigError("Invalid or missing timelapse.captureInterval");
  }
  if (
    !timelapse.outputFramerate ||
    typeof timelapse.outputFramerate !== "number" ||
    timelapse.outputFramerate <= 0
  ) {
    throw new ConfigError("Invalid or missing timelapse.outputFramerate");
  }
  if (
    !timelapse.outputDirectory ||
    typeof timelapse.outputDirectory !== "string"
  ) {
    throw new ConfigError("Invalid or missing timelapse.outputDirectory");
  }
  if (!timelapse.tempDirectory || typeof timelapse.tempDirectory !== "string") {
    throw new ConfigError("Invalid or missing timelapse.tempDirectory");
  }

  // Validate notification section
  if (!config.notification) {
    throw new ConfigError("Missing notification configuration section");
  }
  const notification = config.notification;
  if (!notification.command || typeof notification.command !== "string") {
    throw new ConfigError("Invalid or missing notification.command");
  }

  // Validate pollInterval
  if (
    !config.pollInterval ||
    typeof config.pollInterval !== "number" ||
    config.pollInterval <= 0
  ) {
    throw new ConfigError("Invalid or missing pollInterval");
  }

  return config as AppConfig;
}

export function loadConfig(configPath: string): AppConfig {
  try {
    const configData = readFileSync(configPath, "utf-8");
    const config = JSON.parse(configData);
    return validateConfig(config);
  } catch (error) {
    if (error instanceof ConfigError) {
      throw error;
    }
    if (error instanceof SyntaxError) {
      throw new ConfigError(`Invalid JSON in config file: ${error.message}`);
    }
    throw new ConfigError(
      `Failed to load config file '${configPath}': ${(error as Error).message}`
    );
  }
}
