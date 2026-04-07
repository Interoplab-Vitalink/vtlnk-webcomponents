const SERVER_URL = "https://apps-acpt.vitalink-services.be/vault/api/r4";
const IDENTIFIER_PREFIX =
  "https://www.ehealth.fgov.be/standards/fhir/core/NamingSystem/ssin|urn:be:fgov:ehealth:pseudo:v1:";

function byId(id) {
  return document.getElementById(id);
}

function readValue(id) {
  const element = byId(id);
  return element ? element.value.trim() : "";
}

function buildPatientIdentifier(pseudonym) {
  return IDENTIFIER_PREFIX + pseudonym;
}

function setOptionalAttribute(element, attributeName, value) {
  if (value) {
    element.setAttribute(attributeName, value);
  } else {
    element.removeAttribute(attributeName);
  }
}

function setupCarePlanPage({ formId, tableId }) {
  const form = byId(formId);
  const table = byId(tableId);
  if (!form || !table) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const authToken = readValue("auth-token");
    const pseudonym = readValue("patient-pseudonym");
    const securityLabel = readValue("security-label");

    table.setAttribute("server", SERVER_URL);
    table.setAttribute("auth-token", authToken);
    table.setAttribute("patient-identifier", buildPatientIdentifier(pseudonym));
    setOptionalAttribute(table, "security-label", securityLabel);
  });
}

function setupAuditPage({ formId, containerId }) {
  const form = byId(formId);
  const container = byId(containerId);
  if (!form || !container) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const authToken = readValue("auth-token");
    const pseudonym = readValue("patient-pseudonym");
    const patientSsin = readValue("patient-ssin");
    const securityLabel = readValue("security-label");

    const existingTable = container.querySelector("vitalink-audit-trail-table");
    if (existingTable) {
      existingTable.remove();
    }

    const table = document.createElement("vitalink-audit-trail-table");
    table.setAttribute("server", SERVER_URL);
    table.setAttribute("auth-token", authToken);
    table.setAttribute("patient-identifier", buildPatientIdentifier(pseudonym));
    table.setAttribute("patient-ssin", patientSsin);
    setOptionalAttribute(table, "security-label", securityLabel);

    container.appendChild(table);
  });
}

function setupVaccinationPage({ formId, containerId }) {
  const form = byId(formId);
  const container = byId(containerId);
  if (!form || !container) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const authToken = readValue("auth-token");
    const pseudonym = readValue("patient-pseudonym");
    const patientSsin = readValue("patient-ssin");
    const patientFullName = readValue("patient-full-name");
    const view = readValue("view");
    const securityLabel = readValue("security-label");

    const existingTable = container.querySelector("vitalink-vaccination-table");
    if (existingTable) {
      existingTable.remove();
    }

    const table = document.createElement("vitalink-vaccination-table");
    table.setAttribute("server", SERVER_URL);
    table.setAttribute("auth-token", authToken);
    table.setAttribute("patient-identifier", buildPatientIdentifier(pseudonym));
    table.setAttribute("patient-ssin", patientSsin);
    table.setAttribute("patient-full-name", patientFullName);
    setOptionalAttribute(table, "view", view);
    setOptionalAttribute(table, "security-label", securityLabel);

    container.appendChild(table);
  });
}
