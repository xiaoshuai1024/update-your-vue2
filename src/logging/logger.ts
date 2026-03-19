export type LogLevel = "silent" | "info" | "verbose";

export interface Logger {
  info(message: string): void;
  verbose(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export function createLogger(level: LogLevel): Logger {
  const isVerbose = level === "verbose";
  const isSilent = level === "silent";

  return {
    info(message) {
      if (isSilent) return;
      process.stdout.write(`${message}\n`);
    },
    verbose(message) {
      if (isSilent || !isVerbose) return;
      process.stdout.write(`${message}\n`);
    },
    warn(message) {
      if (isSilent) return;
      process.stderr.write(`WARN: ${message}\n`);
    },
    error(message) {
      if (isSilent) return;
      process.stderr.write(`ERROR: ${message}\n`);
    }
  };
}

