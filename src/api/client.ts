import { get } from "http";
import { URL } from "url";
import { StatusResponse } from "../types/api";
import { PrusaLinkConfig } from "../types/config";

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

export class PrusaLinkClient {
  private config: PrusaLinkConfig;
  private baseUrl: string;

  constructor(config: PrusaLinkConfig) {
    this.config = config;
    this.baseUrl = `http://${this.config.host}:${this.config.port}`;
  }

  async getStatus(): Promise<StatusResponse> {
    const url = new URL("/api/v1/status", this.baseUrl);

    return new Promise((resolve, reject) => {
      const auth = Buffer.from(
        `${this.config.username}:${this.config.password}`
      ).toString("base64");

      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: "GET",
        headers: {
          Authorization: `Basic ${auth}`,
          "User-Agent": "prusa-timelapse/1.0.0",
          Accept: "application/json",
        },
      };

      const req = get(options, (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          if (res.statusCode === 200) {
            try {
              const response = JSON.parse(data);
              resolve(response);
            } catch (error) {
              reject(
                new ApiError(
                  `Failed to parse JSON response: ${(error as Error).message}`,
                  res.statusCode,
                  data
                )
              );
            }
          } else if (res.statusCode === 401) {
            // If basic auth fails, the API might expect digest auth
            reject(
              new ApiError(
                "Authentication failed. PrusaLink may require digest authentication.",
                res.statusCode,
                data
              )
            );
          } else {
            reject(
              new ApiError(
                `HTTP ${res.statusCode}: ${res.statusMessage}`,
                res.statusCode,
                data
              )
            );
          }
        });
      });

      req.on("error", (error) => {
        reject(
          new ApiError(`Request failed: ${error.message}`, undefined, undefined)
        );
      });

      req.setTimeout(10000, () => {
        req.destroy();
        reject(new ApiError("Request timeout"));
      });
    });
  }
}
