import { writeFileSync } from "node:fs";
import { makeMidi } from "../src/score.js";
writeFileSync(
  new URL("../public/wandering-light.mid", import.meta.url),
  makeMidi(),
);
