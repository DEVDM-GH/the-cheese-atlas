// Data integrity checks for cheese records. Zero dependencies.
// Usage: npm run check
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_FILES = [
  "data-part1.js",
  "data-part2.js",
  "data-part3.js",
  "data-part4.js",
  "data-part5.js",
  "data-part6.js"
];

const FAMILIES = new Set([
  "fresh",
  "soft-ripened",
  "washed-rind",
  "semi-soft",
  "semi-hard",
  "hard",
  "blue",
  "pasta-filata",
  "whey-other"
]);

const REGIONS = new Set([
  "Europe",
  "Americas",
  "Middle East & Africa",
  "Asia & Caucasus"
]);

const REQUIRED = [
  "id",
  "name",
  "family",
  "region",
  "mildStinky",
  "softHard",
  "isBizarreLore",
  "schemaVersion"
];

// Appendix A — approved Story Wheel pool. Keep in sync with the plan.
const BIZARRE_LORE_IDS = [
  "american-cheese", "appenzeller", "brie-de-meaux", "brunost", "cabrales",
  "casu-marzu", "chechil", "cheddar", "chevre", "comte",
  "cotija", "cream-cheese", "domiati", "double-gloucester", "edam",
  "emmental", "epoisses", "feta", "gorgonzola", "gouda",
  "gruyere", "halloumi", "humboldt-fog", "idiazabal", "jarlsberg",
  "limburger", "morbier", "munster", "neufchatel", "oscypek",
  "parmigiano-reggiano", "pecorino-romano", "reblochon", "roquefort", "stilton",
  "stinking-bishop", "taleggio", "vacherin-mont-dor", "vieux-boulogne", "wensleydale"
];

const errors = [];

function fail(msg) {
  errors.push(msg);
}

function loadCheeses() {
  const window = { CHEESES: [] };
  for (const name of DATA_FILES) {
    const text = fs.readFileSync(path.join(ROOT, name), "utf8");
    new Function("window", text)(window);
  }
  return window.CHEESES;
}

function isInt1to10(n) {
  return Number.isInteger(n) && n >= 1 && n <= 10;
}

const cheeses = loadCheeses();
const matrix = JSON.parse(
  fs.readFileSync(path.join(ROOT, "docs/TCA2/MATRIX-TABLE.json"), "utf8")
);
const scoreById = new Map(matrix.cheeses.map((c) => [c.id, c]));

if (cheeses.length !== 72) {
  fail(`record count is ${cheeses.length}, expected 72`);
}

const seenIds = new Map();
for (let i = 0; i < cheeses.length; i++) {
  const c = cheeses[i];
  const where = c && c.id ? c.id : `index ${i}`;

  for (const key of REQUIRED) {
    if (c[key] === undefined || c[key] === null) {
      fail(`${where}: missing required field "${key}"`);
    }
  }

  if (c.id != null) {
    if (seenIds.has(c.id)) {
      fail(`duplicate id "${c.id}" (also at ${seenIds.get(c.id)})`);
    } else {
      seenIds.set(c.id, where);
    }
  }

  if (c.family != null && !FAMILIES.has(c.family)) {
    fail(`${where}: unknown family "${c.family}"`);
  }
  if (c.region != null && !REGIONS.has(c.region)) {
    fail(`${where}: unknown region "${c.region}"`);
  }

  if (c.mildStinky !== undefined && c.mildStinky !== null && !isInt1to10(c.mildStinky)) {
    fail(`${where}: mildStinky must be an integer 1–10, got ${JSON.stringify(c.mildStinky)}`);
  }
  if (c.softHard !== undefined && c.softHard !== null && !isInt1to10(c.softHard)) {
    fail(`${where}: softHard must be an integer 1–10, got ${JSON.stringify(c.softHard)}`);
  }

  if (c.isBizarreLore !== undefined && c.isBizarreLore !== null && typeof c.isBizarreLore !== "boolean") {
    fail(`${where}: isBizarreLore must be a boolean, got ${JSON.stringify(c.isBizarreLore)}`);
  }

  if (c.schemaVersion !== undefined && c.schemaVersion !== null && c.schemaVersion !== 2) {
    fail(`${where}: schemaVersion must be 2, got ${JSON.stringify(c.schemaVersion)}`);
  }

  const expected = scoreById.get(c.id);
  if (!expected) {
    fail(`${where}: id not present in MATRIX-TABLE.json`);
  } else if (c.mildStinky !== expected.mildStinky || c.softHard !== expected.softHard) {
    fail(
      `${where}: scores disagree with MATRIX-TABLE.json ` +
        `(got mildStinky=${c.mildStinky}, softHard=${c.softHard}; ` +
        `expected mildStinky=${expected.mildStinky}, softHard=${expected.softHard})`
    );
  }
}

for (const id of scoreById.keys()) {
  if (!seenIds.has(id)) {
    fail(`MATRIX-TABLE.json id "${id}" has no matching record in data files`);
  }
}

const expectedLore = new Set(BIZARRE_LORE_IDS);
const actualLore = new Set(
  cheeses.filter((c) => c.isBizarreLore === true).map((c) => c.id)
);
const unexpectedLore = [...actualLore].filter((id) => !expectedLore.has(id)).sort();
const missingLore = [...expectedLore].filter((id) => !actualLore.has(id)).sort();
if (unexpectedLore.length || missingLore.length) {
  if (unexpectedLore.length) {
    fail(`isBizarreLore unexpected ids: ${unexpectedLore.join(", ")}`);
  }
  if (missingLore.length) {
    fail(`isBizarreLore missing ids: ${missingLore.join(", ")}`);
  }
}

if (errors.length) {
  console.error(`check-data: ${errors.length} error(s)`);
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}

console.log(
  `check-data: OK — ${cheeses.length} records, scores match MATRIX-TABLE.json, ` +
    `isBizarreLore pool is exactly the ${BIZARRE_LORE_IDS.length} approved ids`
);
