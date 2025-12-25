export type Logger = {
  warn: (msg: string) => void;
};

let currentLogger: Logger = {
  warn: (msg: string) => console.warn(msg),
};

export function setLogger(logger: Logger) {
  currentLogger = logger;
}

export function getLogger(): Logger {
  return currentLogger;
}

