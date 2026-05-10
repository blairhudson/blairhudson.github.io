import type { Program } from "../types";

const environment = [
  "USER=blair",
  "HOME=/Home/blair",
  "SHELL=/bin/sh",
  "PATH=/bin:/Applications",
  "TERM=xterm-256color",
  "OPENAI_API_KEY=sk-proj-xQ3J9mL2vN8pR5tY7uI0oP4aS6dF1gH3jK9lZ2xC5vB8nM1qW4eR7tY0uI3oP6aS9dF2gH5jK8lZ1xC4vB7nM0qW3eR6tY9uI2oP5aS8dF1gH4jK7lZ0",
  "BLAIROS_MODE=local"
];

export const env: Program = {
  name: "env",
  help: "usage: env",
  run: () => ({ lines: environment })
};
