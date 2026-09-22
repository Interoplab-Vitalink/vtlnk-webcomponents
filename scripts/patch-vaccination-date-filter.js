const fs = require("fs");
const path = require("path");

const mainJsPath = path.join(
  __dirname,
  "..",
  "node_modules",
  "@smals-belgium-shared",
  "vitalink-webcomponents",
  "VitalinkVaccinationTable",
  "0.0.11",
  "main.js"
);

const replacements = [
  {
    from: 'ne.fromJSDate(l.completeDate).diff(f?.from).toMillis()>=0&&ne.fromJSDate(l.completeDate).diff(f?.to).toMillis()<=0',
    to: 'ne.fromJSDate(l.completeDate).diff(f?.from.startOf("day")).toMillis()>=0&&ne.fromJSDate(l.completeDate).diff(f?.to.endOf("day")).toMillis()<=0',
  },
  {
    from: 'this.dateFilterRange={from:ne.now().minus({years:10}),to:ne.now()}',
    to: 'this.dateFilterRange={from:ne.now().minus({years:10}).startOf("day"),to:ne.now().endOf("day")}',
  },
];

if (!fs.existsSync(mainJsPath)) {
  console.warn(`[patch-vaccination-date-filter] Skipped: ${mainJsPath} not found`);
  process.exit(0);
}

let source = fs.readFileSync(mainJsPath, "utf8");
let changed = false;

for (const { from, to } of replacements) {
  if (source.includes(to)) {
    continue;
  }
  if (!source.includes(from)) {
    console.error(`[patch-vaccination-date-filter] Expected snippet not found:\n${from}`);
    process.exit(1);
  }
  source = source.replace(from, to);
  changed = true;
}

if (changed) {
  fs.writeFileSync(mainJsPath, source);
  console.log("[patch-vaccination-date-filter] Applied occurrence date end-of-day filter patch");
} else {
  console.log("[patch-vaccination-date-filter] Patch already applied");
}
