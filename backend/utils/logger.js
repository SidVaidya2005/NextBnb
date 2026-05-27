// TODO: replace console with a real logger (pino, winston) once observability lands.
const logger = {
  info: (...args) => console.log(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
};

module.exports = logger;
