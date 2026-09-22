const connect = require("connect");
const serveStatic = require("serve-static");
const fs = require("fs");
const path = require("path");
const https = require("https");

const PACKAGE_NAME = "@smals-belgium-shared/vitalink-webcomponents";
const PORT = 3001;

function readInstalledVersion() {
  const packageJsonPath = path.join(
    __dirname,
    "node_modules",
    "@smals-belgium-shared",
    "vitalink-webcomponents",
    "package.json"
  );
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  return packageJson.version;
}

function readComponentVersions() {
  const root = path.join(
    __dirname,
    "node_modules",
    "@smals-belgium-shared",
    "vitalink-webcomponents"
  );
  const components = [
    "VitalinkCarePlanTable",
    "VitalinkAuditTrailTable",
    "VitalinkVaccinationTable",
  ];

  const versions = {};
  for (const name of components) {
    const componentDir = path.join(root, name);
    if (!fs.existsSync(componentDir)) continue;
    const folders = fs
      .readdirSync(componentDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    versions[name] = folders[folders.length - 1] || null;
  }
  return versions;
}

function fetchLatestVersion() {
  return new Promise((resolve, reject) => {
    const url = `https://registry.npmjs.org/${PACKAGE_NAME}`;
    https
      .get(url, { headers: { Accept: "application/json" } }, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`npm registry returned ${response.statusCode}`));
          response.resume();
          return;
        }

        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          try {
            const data = JSON.parse(body);
            resolve(data["dist-tags"]?.latest || null);
          } catch (error) {
            reject(error);
          }
        });
      })
      .on("error", reject);
  });
}

function compareSemver(a, b) {
  const parse = (value) =>
    String(value)
      .split(".")
      .map((part) => Number.parseInt(part, 10) || 0);
  const left = parse(a);
  const right = parse(b);
  const length = Math.max(left.length, right.length);

  for (let i = 0; i < length; i += 1) {
    const diff = (left[i] || 0) - (right[i] || 0);
    if (diff > 0) return 1;
    if (diff < 0) return -1;
  }
  return 0;
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(body);
}

function versionCheckMiddleware(req, res, next) {
  if (req.url !== "/api/package-version" && req.url !== "/api/package-version/") {
    next();
    return;
  }

  let installedVersion;
  try {
    installedVersion = readInstalledVersion();
  } catch (error) {
    sendJson(res, 500, {
      packageName: PACKAGE_NAME,
      error: `Could not read installed package version: ${error.message}`,
    });
    return;
  }

  const componentVersions = readComponentVersions();

  fetchLatestVersion()
    .then((latestVersion) => {
      const updateAvailable =
        !!latestVersion && compareSemver(latestVersion, installedVersion) > 0;

      sendJson(res, 200, {
        packageName: PACKAGE_NAME,
        installedVersion,
        latestVersion,
        updateAvailable,
        componentVersions,
        npmUrl: `https://www.npmjs.com/package/${PACKAGE_NAME}`,
        checkedAt: new Date().toISOString(),
      });
    })
    .catch((error) => {
      sendJson(res, 502, {
        packageName: PACKAGE_NAME,
        installedVersion,
        componentVersions,
        updateAvailable: false,
        error: `Could not reach npm registry: ${error.message}`,
        checkedAt: new Date().toISOString(),
      });
    });
}

connect()
  .use(versionCheckMiddleware)
  .use(serveStatic(__dirname, { index: ["index.html", "index.htm"] }))
  .listen(PORT, () => console.log(`Server running on port ${PORT}`));
