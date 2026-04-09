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

const auditLogState = {
  installed: false,
  batches: [],
  currentBatch: null,
  listeners: [],
};

function notifyAuditLogState() {
  auditLogState.listeners.forEach((listener) => listener(auditLogState));
}

function subscribeAuditLog(listener) {
  auditLogState.listeners.push(listener);
  return () => {
    auditLogState.listeners = auditLogState.listeners.filter(
      (item) => item !== listener
    );
  };
}

function formatTimestamp(date) {
  if (!date) return "—";
  return new Date(date).toLocaleString([], {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function normalizeHeaders(headers) {
  if (!headers) return {};
  const normalized = {};
  try {
    const headerList = new Headers(headers);
    headerList.forEach((value, key) => {
      normalized[key] = value;
    });
  } catch (error) {
    return {};
  }
  return normalized;
}

function formatHeaders(headers) {
  if (!headers) return "";
  if (typeof headers === "string") return headers.trim();
  return Object.entries(headers)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
}

function formatPayload(payload) {
  if (payload === undefined || payload === null) return "";
  if (typeof payload === "string") return payload;
  if (payload instanceof URLSearchParams) return payload.toString();
  if (payload instanceof FormData) {
    const entries = [];
    payload.forEach((value, key) => {
      entries.push(`${key}: ${value}`);
    });
    return entries.join("\n");
  }
  try {
    return JSON.stringify(payload, null, 2);
  } catch (error) {
    return String(payload);
  }
}

function normalizeHeaderMap(headers) {
  if (!headers) return {};
  if (typeof headers === "string") {
    return headers
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .reduce((acc, line) => {
        const splitIndex = line.indexOf(":");
        if (splitIndex > 0) {
          const key = line.slice(0, splitIndex).trim();
          const value = line.slice(splitIndex + 1).trim();
          acc[key] = value;
        }
        return acc;
      }, {});
  }
  return { ...headers };
}

function buildCurlCommand(entry) {
  const parts = ["curl", "-X", entry.method || "GET"];
  const headers = normalizeHeaderMap(entry.requestHeaders);
  Object.entries(headers).forEach(([key, value]) => {
    parts.push("-H", `${key}: ${value}`);
  });
  if (entry.requestBody) {
    const bodyText =
      typeof entry.requestBody === "string"
        ? entry.requestBody
        : formatPayload(entry.requestBody);
    if (bodyText) {
      parts.push("--data-raw", bodyText);
    }
  }
  parts.push(entry.url);
  return parts
    .map((part) => {
      if (/[\s"'\\]/.test(part)) {
        return `'${String(part).replace(/'/g, `'\\''`)}'`;
      }
      return String(part);
    })
    .join(" ");
}

function copyTextToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise((resolve, reject) => {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand("copy");
      resolve();
    } catch (error) {
      reject(error);
    } finally {
      document.body.removeChild(textarea);
    }
  });
}

function describeBinaryResponse(buffer, contentType) {
  const bytes = buffer ? buffer.byteLength : 0;
  return `[Binary response ${bytes} bytes${
    contentType ? `, content-type: ${contentType}` : ""
  }]`;
}

function attachResponseBodyCapture(response, entry) {
  const updateIfEmpty = (value) => {
    if (
      entry.responseBody === null ||
      entry.responseBody === undefined ||
      entry.responseBody === "" ||
      entry.responseBody === "[No response body]" ||
      entry.responseBody === "[Response body could not be read]"
    ) {
      entry.responseBody = value;
      notifyAuditLogState();
    }
  };

  const wrapMethod = (methodName, formatter) => {
    const original = response[methodName];
    if (typeof original !== "function") return;
    response[methodName] = (...args) =>
      original
        .apply(response, args)
        .then((result) => {
          updateIfEmpty(formatter(result));
          return result;
        })
        .catch((error) => {
          updateIfEmpty("[Response body could not be read]");
          throw error;
        });
  };

  wrapMethod("text", (result) => result || "[No response body]");
  wrapMethod("json", (result) => {
    if (result === null || result === undefined) return "[No response body]";
    try {
      return JSON.stringify(result, null, 2);
    } catch (error) {
      return String(result);
    }
  });
  wrapMethod("arrayBuffer", (result) => {
    if (!result || !result.byteLength) return "[No response body]";
    try {
      const decoded = new TextDecoder().decode(result);
      return decoded || describeBinaryResponse(result, "");
    } catch (error) {
      return describeBinaryResponse(result, "");
    }
  });
  wrapMethod("blob", (result) => {
    if (!result || !result.size) return "[No response body]";
    return `[Binary response ${result.size} bytes]`;
  });
}

function readResponseBody(response) {
  const contentType = response.headers.get("content-type") || "";
  const isOpaque =
    response.type === "opaque" || response.type === "opaqueredirect";

  if (isOpaque) {
    return Promise.resolve(`[${response.type} response body unavailable]`);
  }

  const cloned = response.clone();
  return cloned
    .text()
    .then((body) => {
      if (body) {
        return body;
      }
      return "[No response body]";
    })
    .catch(() =>
      response
        .clone()
        .arrayBuffer()
        .then((buffer) => {
          if (!buffer || buffer.byteLength === 0) {
            return "[No response body]";
          }
          try {
            const decoded = new TextDecoder().decode(buffer);
            if (decoded) {
              return decoded;
            }
            return describeBinaryResponse(buffer, contentType);
          } catch (error) {
            return describeBinaryResponse(buffer, contentType);
          }
        })
        .catch(() => "[Response body could not be read]")
    );
}

function readXhrBody(xhr) {
  try {
    const responseType = xhr.responseType || "text";
    if (responseType === "" || responseType === "text") {
      return Promise.resolve(xhr.responseText || "[No response body]");
    }
    if (responseType === "json") {
      if (xhr.response === null || xhr.response === undefined) {
        return Promise.resolve("[No response body]");
      }
      return Promise.resolve(JSON.stringify(xhr.response, null, 2));
    }
    if (responseType === "arraybuffer") {
      const buffer = xhr.response;
      if (!buffer || !buffer.byteLength) {
        return Promise.resolve("[No response body]");
      }
      try {
        const decoded = new TextDecoder().decode(buffer);
        return Promise.resolve(decoded || "[No response body]");
      } catch (error) {
        return Promise.resolve(describeBinaryResponse(buffer, ""));
      }
    }
    if (responseType === "blob") {
      const blob = xhr.response;
      if (!blob || !blob.size) {
        return Promise.resolve("[No response body]");
      }
      return blob
        .text()
        .then((text) => text || "[No response body]")
        .catch(() => `[Binary response ${blob.size} bytes]`);
    }
  } catch (error) {
    return Promise.resolve("[Response body could not be read]");
  }
  return Promise.resolve("[Response body could not be read]");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function highlightJson(prettyJson) {
  const escaped = escapeHtml(prettyJson);
  return escaped.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let className = "json-number";
      if (match.startsWith('"')) {
        className = match.endsWith(":") ? "json-key" : "json-string";
      } else if (match === "true" || match === "false") {
        className = "json-boolean";
      } else if (match === "null") {
        className = "json-null";
      }
      return `<span class="${className}">${match}</span>`;
    }
  );
}

function setPreContent(preElement, rawContent) {
  if (!preElement) return;
  if (!rawContent) {
    preElement.textContent = "";
    return;
  }
  const content = String(rawContent);
  try {
    const parsed = JSON.parse(content);
    const pretty = JSON.stringify(parsed, null, 2);
    preElement.innerHTML = highlightJson(pretty);
  } catch (error) {
    preElement.textContent = content;
  }
}

function startAuditBatch() {
  const batch = {
    id: auditLogState.batches.length + 1,
    startedAt: new Date(),
    entries: [],
  };
  auditLogState.batches.push(batch);
  auditLogState.currentBatch = batch;
  notifyAuditLogState();
  return batch;
}

function addAuditEntry(entry) {
  if (!auditLogState.currentBatch) return;
  auditLogState.currentBatch.entries.push(entry);
  notifyAuditLogState();
}

function buildFetchEntry(input, init) {
  const request = input instanceof Request ? input : null;
  const url = request ? request.url : String(input);
  const method =
    (init && init.method) || (request && request.method) || "GET";
  const requestHeaders = normalizeHeaders(
    (init && init.headers) || (request && request.headers)
  );
  const requestBody = formatPayload(init && init.body);
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    method,
    url,
    requestHeaders,
    requestBody,
    requestTimestamp: new Date(),
    responseTimestamp: null,
    responseStatus: null,
    responseStatusText: null,
    responseHeaders: null,
    responseBody: null,
    errorMessage: null,
  };
}

function installAuditRequestLogger() {
  if (auditLogState.installed) return;
  auditLogState.installed = true;

  if (typeof window.fetch === "function") {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const entry = buildFetchEntry(input, init);
      addAuditEntry(entry);
      try {
        const response = await originalFetch(input, init);
        entry.responseTimestamp = new Date();
        entry.responseStatus = response.status;
        entry.responseStatusText = response.statusText;
        entry.responseHeaders = normalizeHeaders(response.headers);
        notifyAuditLogState();
        attachResponseBodyCapture(response, entry);
        readResponseBody(response)
          .then((body) => {
            entry.responseBody = body;
            notifyAuditLogState();
          })
          .catch(() => {
            entry.responseBody = "[Response body could not be read]";
            notifyAuditLogState();
          });
        return response;
      } catch (error) {
        entry.responseTimestamp = new Date();
        entry.errorMessage = error ? error.message : "Fetch failed";
        notifyAuditLogState();
        throw error;
      }
    };
  }

  if (typeof XMLHttpRequest === "function") {
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

    XMLHttpRequest.prototype.open = function open(method, url, ...rest) {
      this.__auditEntry = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        method: method || "GET",
        url,
        requestHeaders: {},
        requestBody: null,
        requestTimestamp: new Date(),
        responseTimestamp: null,
        responseStatus: null,
        responseStatusText: null,
        responseHeaders: null,
        responseBody: null,
        errorMessage: null,
      };
      return originalOpen.call(this, method, url, ...rest);
    };

    XMLHttpRequest.prototype.setRequestHeader = function setRequestHeader(
      header,
      value
    ) {
      if (this.__auditEntry) {
        this.__auditEntry.requestHeaders[header] = value;
      }
      return originalSetRequestHeader.call(this, header, value);
    };

    XMLHttpRequest.prototype.send = function send(body) {
      if (this.__auditEntry) {
        this.__auditEntry.requestBody = formatPayload(body);
        addAuditEntry(this.__auditEntry);
        this.addEventListener("loadend", () => {
          this.__auditEntry.responseTimestamp = new Date();
          this.__auditEntry.responseStatus = this.status;
          this.__auditEntry.responseStatusText = this.statusText;
          this.__auditEntry.responseHeaders = this.getAllResponseHeaders();
          readXhrBody(this)
            .then((bodyText) => {
              this.__auditEntry.responseBody = bodyText;
              notifyAuditLogState();
            })
            .catch(() => {
              this.__auditEntry.responseBody =
                "[Response body could not be read]";
              notifyAuditLogState();
            });
        });
      }
      return originalSend.call(this, body);
    };
  }
}

function renderAuditLog(targetElement) {
  const logBody = targetElement || byId("audit-log-body");
  if (!logBody) return;
  logBody.innerHTML = "";

  if (!auditLogState.batches.length) {
    const empty = document.createElement("p");
    empty.textContent = "No requests logged yet.";
    logBody.appendChild(empty);
    return;
  }

  const batches = [...auditLogState.batches].reverse();
  batches.forEach((batch) => {
    const group = document.createElement("details");
    group.className = "audit-log-group";
    group.open = false;

    const summary = document.createElement("summary");
    summary.className = "audit-log-group-summary";
    const requestCount = batch.entries.length;
    summary.textContent = `Load #${batch.id} · Started at: ${formatTimestamp(
      batch.startedAt
    )} · ${requestCount} request${requestCount === 1 ? "" : "s"}`;
    group.appendChild(summary);

    const groupBody = document.createElement("div");
    groupBody.className = "audit-log-group-body";

    if (!batch.entries.length) {
      const empty = document.createElement("div");
      empty.className = "audit-log-meta";
      empty.textContent = "No requests captured yet.";
      groupBody.appendChild(empty);
    }

    batch.entries.forEach((entry) => {
      const entryCard = document.createElement("details");
      entryCard.className = "audit-log-entry";

      const summary = document.createElement("summary");
      summary.className = "audit-log-summary";
      summary.textContent = `${entry.method} ${entry.url}`;
      entryCard.appendChild(summary);

      const requestMetaRow = document.createElement("div");
      requestMetaRow.className = "audit-log-row";
      const requestMeta = document.createElement("div");
      requestMeta.className = "audit-log-meta";
      requestMeta.textContent = `Request time: ${formatTimestamp(
        entry.requestTimestamp
      )}`;
      requestMetaRow.appendChild(requestMeta);

      const copyButton = document.createElement("button");
      copyButton.type = "button";
      copyButton.className = "copy-button";
      copyButton.textContent = "Copy cURL";
      copyButton.addEventListener("click", () => {
        const curlText = buildCurlCommand(entry);
        copyTextToClipboard(curlText)
          .then(() => {
            copyButton.textContent = "Copied";
            setTimeout(() => {
              copyButton.textContent = "Copy cURL";
            }, 1500);
          })
          .catch(() => {
            copyButton.textContent = "Copy failed";
            setTimeout(() => {
              copyButton.textContent = "Copy cURL";
            }, 1500);
          });
      });
      requestMetaRow.appendChild(copyButton);
      entryCard.appendChild(requestMetaRow);

      const requestDetails = document.createElement("pre");
      const requestHeaders = formatHeaders(entry.requestHeaders);
      const requestBody = formatPayload(entry.requestBody);
      const requestContent = [
        requestHeaders ? `Headers:\n${requestHeaders}` : "",
        requestBody ? `Body:\n${requestBody}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
      if (!requestContent) {
        requestDetails.textContent = "No request details.";
      } else {
        setPreContent(requestDetails, requestContent);
      }
      entryCard.appendChild(requestDetails);

      const responseMeta = document.createElement("div");
      responseMeta.className = "audit-log-meta";
      const statusCode =
        typeof entry.responseStatus === "number" ? entry.responseStatus : null;
      const statusBadge = document.createElement("span");
      statusBadge.className = "status-label";
      if (statusCode !== null) {
        if (statusCode >= 200 && statusCode < 300) {
          statusBadge.classList.add("status-label--success");
        } else if (statusCode >= 400 && statusCode < 600) {
          statusBadge.classList.add("status-label--error");
        }
      }
      const responseLabel = entry.errorMessage
        ? `Error: ${entry.errorMessage}`
        : `Response: ${entry.responseStatus || "Pending"} ${
            entry.responseStatusText || ""
          }`.trim();
      statusBadge.textContent = responseLabel;
      responseMeta.appendChild(statusBadge);
      const receivedText = document.createElement("span");
      receivedText.textContent = ` · Received: ${formatTimestamp(
        entry.responseTimestamp
      )}`;
      responseMeta.appendChild(receivedText);
      entryCard.appendChild(responseMeta);

      const responseDetails = document.createElement("pre");
      const responseHeaders = formatHeaders(entry.responseHeaders);
      const responseBody = entry.responseBody
        ? String(entry.responseBody)
        : "";
      const responseContent = [
        responseHeaders ? `Headers:\n${responseHeaders}` : "",
        responseBody ? `Body:\n${responseBody}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
      if (!responseContent) {
        responseDetails.textContent = "No response details.";
      } else {
        setPreContent(responseDetails, responseContent);
      }
      entryCard.appendChild(responseDetails);

      groupBody.appendChild(entryCard);
    });

    group.appendChild(groupBody);
    logBody.appendChild(group);
  });
}

function setupRequestLogModal({ buttonId, modalId, bodyId }) {
  const logButton = byId(buttonId);
  const modal = byId(modalId);
  const logBody = byId(bodyId);

  if (!logButton || !modal || !logBody) return;

  subscribeAuditLog(() => {
    renderAuditLog(logBody);
  });

  const closeModal = () => {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  };

  const openModal = () => {
    renderAuditLog(logBody);
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  };

  logButton.addEventListener("click", openModal);

  modal.addEventListener("click", (event) => {
    if (event.target === modal || event.target.closest("[data-modal-close]")) {
      closeModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal.classList.contains("is-open")) {
      closeModal();
    }
  });
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

  installAuditRequestLogger();
  setupRequestLogModal({
    buttonId: "audit-log-button",
    modalId: "audit-log-modal",
    bodyId: "audit-log-body",
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    startAuditBatch();

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

  installAuditRequestLogger();
  setupRequestLogModal({
    buttonId: "vaccination-log-button",
    modalId: "vaccination-log-modal",
    bodyId: "vaccination-log-body",
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    startAuditBatch();

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
