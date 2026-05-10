import type { Program } from "../types";

const fortunes = [
  "small teams ship big when feedback loops short",
  "local does not mean small",
  "if it feels like a toy, make the toy useful",
  "agents need sandboxes, not vibes",
  "the best architecture diagram is a working demo",
  "ship the boring path, hide the weird door",
  "every CLI deserves one joke it refuses to explain",
  "rare fortune: the duck has reviewed your PR and found it spiritually acceptable",
  "a window minimized is not lost, merely contemplating",
  "if the model says 'can't', ask if it has tried Bun yet"
];

export const fortune: Program = {
  name: "fortune",
  help: "usage: fortune",
  run: () => ({ lines: [fortunes[Math.floor(Math.random() * fortunes.length)]] })
};
