const STORAGE_KEY = "vse_mapper_v2";

let entries = loadEntries();
let currentView = "boardView";

const $ = (id) => document.getElementById(id);
const els = {
  board: $("board"),
  visualMap: $("visualMap"),
  compareTable: $("compareTable"),
  standardsList: $("standardsList"),
  dataOutput: $("dataOutput"),
  journeyFilter: $("journeyFilter"),
  contextFilter: $("contextFilter"),
  riskFilter: $("riskFilter"),
  searchInput: $("searchInput"),
  modalOverlay: $("modalOverlay"),
  modalTitle: $("modalTitle"),
  form: $("stepForm"),
  totalSteps: $("totalSteps"),
  journeyCount: $("journeyCount"),
  contextCount: $("contextCount"),
  riskCount: $("riskCount"),
  unknownOwnerCount: $("unknownOwnerCount")
};

const formFields = [
  "editingId", "journeyName", "contextName", "stepOrder", "stepName", "customerAction",
  "valueStream", "owner", "pattern", "emotion", "riskLevel", "notes", "evidence"
];

document.addEventListener("DOMContentLoaded", () => {
  wireEvents();
  render();
});

function wireEvents() {
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });

  $("addStepBtn").addEventListener("click", () => openModal());
  $("closeModalBtn").addEventListener("click", closeModal);
  $("cancelBtn").addEventListener("click", closeModal);
  els.modalOverlay.addEventListener("click", (event) => {
    if (event.target === els.modalOverlay) closeModal();
  });

  els.form.addEventListener("submit", saveStep);
  els.searchInput.addEventListener("input", render);
  els.journeyFilter.addEventListener("change", render);
  els.contextFilter.addEventListener("change", render);
  els.riskFilter.addEventListener("change", render);

  $("clearAllBtn").addEventListener("click", clearAll);
  $("loadExampleBtn").addEventListener("click", loadExampleData);
  $("exportBtn").addEventListener("click", copyJson);
  $("downloadBtn").addEventListener("click", downloadJson);
  $("importInput").addEventListener("change", importJson);
  $("generateStandardsBtn").addEventListener("click", renderStandards);
}

function loadEntries() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}

function persist() { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); }

function switchView(viewId) {
  currentView = viewId;
  document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === viewId));
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.view === viewId));
  render();
}

function openModal(entry = null) {
  els.form.reset();
  $("editingId").value = "";
  els.modalTitle.textContent = entry ? "Edit journey step" : "Add journey step";

  if (entry) {
    formFields.forEach(field => {
      if ($(field) && field !== "editingId") $(field).value = entry[field] ?? "";
    });
    $("editingId").value = entry.id;
  } else {
    $("riskLevel").value = "Low";
    $("emotion").value = "Neutral";
    const selectedJourney = els.journeyFilter.value;
    const selectedContext = els.contextFilter.value;
    if (selectedJourney !== "all") $("journeyName").value = selectedJourney;
    if (selectedContext !== "all") $("contextName").value = selectedContext;
    $("stepOrder").value = getNextOrder($("journeyName").value, $("contextName").value);
  }

  els.modalOverlay.hidden = false;
    els.modalOverlay.classList.add("is-open");
  $("journeyName").focus();
}

function closeModal() {
  els.modalOverlay.hidden = true;
  els.modalOverlay.classList.remove("is-open");
}

function saveStep(event) {
  event.preventDefault();
  const id = $("editingId").value || createId();
  const entry = {
    id,
    journeyName: $("journeyName").value.trim(),
    contextName: $("contextName").value.trim(),
    stepOrder: Number($("stepOrder").value || 999),
    stepName: $("stepName").value.trim(),
    customerAction: $("customerAction").value.trim(),
    valueStream: $("valueStream").value.trim(),
    owner: $("owner").value.trim(),
    pattern: $("pattern").value.trim(),
    emotion: $("emotion").value,
    riskLevel: $("riskLevel").value,
    notes: $("notes").value.trim(),
    evidence: $("evidence").value.trim(),
    updatedAt: new Date().toISOString(),
    createdAt: entries.find(e => e.id === id)?.createdAt || new Date().toISOString()
  };

  const existingIndex = entries.findIndex(e => e.id === id);
  if (existingIndex >= 0) entries[existingIndex] = entry;
  else entries.push(entry);

  sortEntries();
  persist();
  closeModal();
  render();
}

function createId() {
  return window.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function getNextOrder(journey, context) {
  const list = entries.filter(e => (!journey || e.journeyName === journey) && (!context || e.contextName === context));
  return list.length ? Math.max(...list.map(e => Number(e.stepOrder) || 0)) + 1 : 1;
}

function sortEntries() {
  entries.sort((a,b) =>
    a.journeyName.localeCompare(b.journeyName) ||
    a.contextName.localeCompare(b.contextName) ||
    (Number(a.stepOrder) || 999) - (Number(b.stepOrder) || 999)
  );
}

function getFilteredEntries() {
  const q = els.searchInput.value.trim().toLowerCase();
  const journey = els.journeyFilter.value;
  const context = els.contextFilter.value;
  const risk = els.riskFilter.value;

  return entries.filter(e => {
    const text = Object.values(e).join(" ").toLowerCase();
    return (!q || text.includes(q)) &&
      (journey === "all" || e.journeyName === journey) &&
      (context === "all" || e.contextName === context) &&
      (risk === "all" || e.riskLevel === risk);
  });
}

function render() {
  sortEntries();
  renderFilters();
  const list = getFilteredEntries();
  renderMetrics(list);
  renderBoard(list);
  renderVisualMap(list);
  renderCompare(list);
  renderStandards(list);
  els.dataOutput.textContent = JSON.stringify(entries, null, 2);
}

function renderFilters() {
  fillSelect(els.journeyFilter, unique(entries.map(e => e.journeyName)), "All journeys");
  fillSelect(els.contextFilter, unique(entries.map(e => e.contextName)), "All contexts / apps");
}

function fillSelect(select, values, label) {
  const current = select.value || "all";
  select.innerHTML = `<option value="all">${escapeHtml(label)}</option>` + values.map(v => `<option value="${escapeAttr(v)}">${escapeHtml(v)}</option>`).join("");
  select.value = [...values, "all"].includes(current) ? current : "all";
}

function unique(values) { return [...new Set(values.filter(Boolean))].sort((a,b) => a.localeCompare(b)); }

function renderMetrics(list) {
  els.totalSteps.textContent = list.length;
  els.journeyCount.textContent = unique(list.map(e => e.journeyName)).length;
  els.contextCount.textContent = unique(list.map(e => e.contextName)).length;
  els.riskCount.textContent = list.filter(e => e.riskLevel === "High").length;
  els.unknownOwnerCount.textContent = list.filter(hasOwnerGap).length;
}

function renderBoard(list) {
  if (!list.length) { els.board.innerHTML = `<div class="empty">No journey steps yet. Add a step or load example data.</div>`; return; }
  const grouped = groupBy(list, e => `${e.journeyName}|||${e.contextName}`);
  els.board.innerHTML = Object.entries(grouped).map(([key, group]) => {
    const [journey, context] = key.split("|||");
    return `<article class="group">
      <div class="group-header">
        <div><h3>${escapeHtml(journey)}</h3><div class="group-meta"><span class="pill">${escapeHtml(context)}</span><span class="pill grey">${group.length} steps</span></div></div>
      </div>
      <div class="steps-grid">${group.map(renderStepCard).join("")}</div>
    </article>`;
  }).join("");
  wireCardButtons();
}

function renderStepCard(e) {
  const riskClass = e.riskLevel.toLowerCase();
  const ownerPill = hasOwnerGap(e) ? `<span class="pill amber">Owner TBC</span>` : `<span class="pill green">${escapeHtml(e.owner)}</span>`;
  return `<article class="step-card ${riskClass}">
    <span class="pill grey">Step ${escapeHtml(e.stepOrder)}</span>
    <h4>${escapeHtml(e.stepName)}</h4>
    <div class="group-meta">
      <span class="pill">${escapeHtml(e.valueStream || "Value stream TBC")}</span>
      ${ownerPill}
      <span class="pill ${e.riskLevel === "High" ? "red" : e.riskLevel === "Medium" ? "amber" : "green"}">${escapeHtml(e.riskLevel)} risk</span>
    </div>
    <p class="card-note"><strong>Customer:</strong> ${escapeHtml(e.customerAction || "Not captured")}</p>
    <p class="card-note"><strong>Pattern:</strong> ${escapeHtml(e.pattern || "Not captured")}</p>
    <p class="card-note">${escapeHtml(e.notes || "No notes yet")}</p>
    <div class="step-actions">
      <button class="secondary" data-edit="${e.id}">Edit</button>
      <button class="danger" data-delete="${e.id}">Delete</button>
    </div>
  </article>`;
}

function renderVisualMap(list) {
  if (!list.length) { els.visualMap.innerHTML = `<div class="empty">No map to visualise yet.</div>`; return; }
  const grouped = groupBy(list, e => e.journeyName);
  els.visualMap.innerHTML = Object.entries(grouped).map(([journey, group]) => {
    const phases = [...group].sort((a, b) => (Number(a.stepOrder) || 999) - (Number(b.stepOrder) || 999));
    const feelingPoints = phases.map((e, index) => {
      const mood = getMoodMeta(e.emotion);
      const left = phases.length === 1 ? 50 : (index / (phases.length - 1)) * 100;
       return `<span class="feeling-node" style="left:${left}%; top:${mood.level}%" title="${escapeAttr(e.contextName)} · ${escapeAttr(e.stepName)}">${mood.icon}</span>`;
    }).join("");

    return `<article class="journey-map">
      <header class="journey-map-header"><h3>${escapeHtml(journey)}</h3><span class="pill grey">${getHierarchySummary(phases)}</span></header>
      <div class="journey-grid" style="--phase-count:${Math.max(phases.length, 1)}">
        <div class="row-label">Step</div>
        ${phases.map(e => `<div class="phase-cell"><strong>${escapeHtml(e.stepName)}</strong><small>${escapeHtml(e.journeyName)}</small></div>`).join("")}

        <div class="row-label">Action</div>
        ${phases.map(e => `<div class="grid-cell"><span class="sticky-note">${escapeHtml(e.customerAction || "Action TBC")}</span></div>`).join("")}

        <div class="row-label">Touchpoints</div>
        ${phases.map(e => `<div class="grid-cell touchpoint-cell"><span class="pill">${escapeHtml(e.contextName || "App TBC")}</span><small>${escapeHtml(e.pattern || "Pattern / screen TBC")}</small></div>`).join("")}

        <div class="row-label">Feelings</div>
        <div class="feelings-track" style="grid-column:2 / span ${Math.max(phases.length, 1)}"><div class="feeling-line"></div>${feelingPoints}</div>

        <div class="row-label">Pain points</div>
        ${phases.map(e => `<div class="grid-cell">${escapeHtml(e.riskLevel === "Low" ? "Low friction" : (e.notes || "Risk or blocker not captured"))}</div>`).join("")}

        <div class="row-label">Opportunities</div>
        ${phases.map(e => `<div class="grid-cell">${escapeHtml(e.evidence || "Opportunity notes to be added")}</div>`).join("")}
      </div>
    </article>`;
  }).join("");
}

function getMoodMeta(emotion = "Neutral") {
  const map = {
    Positive: { icon: "😍", level: 20 },
    Neutral: { icon: "🙂", level: 50 },
    Frustrated: { icon: "😕", level: 75 },
    Confused: { icon: "😵", level: 85 },
    Anxious: { icon: "😰", level: 92 }
  };
  return map[emotion] || map.Neutral;
}

function getHierarchySummary(phases) {
  const valueStreams = unique(phases.map(e => e.valueStream)).length;
  const apps = unique(phases.map(e => e.contextName)).length;
  const journeys = unique(phases.map(e => e.journeyName)).length;
  const steps = phases.length;
  return `${valueStreams} value stream${valueStreams === 1 ? "" : "s"} · ${apps} app${apps === 1 ? "" : "s"} · ${journeys} journey${journeys === 1 ? "" : "s"} · ${steps} step${steps === 1 ? "" : "s"}`;
}

function renderCompare(list) {
  const selectedJourney = els.journeyFilter.value;
  const compareList = selectedJourney === "all" && list.length ? list.filter(e => e.journeyName === list[0].journeyName) : list;
  if (!compareList.length) { els.compareTable.innerHTML = `<div class="empty">Choose or add a journey to compare across apps.</div>`; return; }
  const contexts = unique(compareList.map(e => e.contextName));
  const steps = unique(compareList.map(e => String(e.stepOrder).padStart(3,"0") + "|||" + e.stepName));
  els.compareTable.innerHTML = `<table><thead><tr><th>Step</th>${contexts.map(c => `<th>${escapeHtml(c)}</th>`).join("")}</tr></thead><tbody>
    ${steps.map(stepKey => {
      const [order, stepName] = stepKey.split("|||");
      return `<tr><td><strong>${Number(order)}. ${escapeHtml(stepName)}</strong></td>${contexts.map(context => {
        const e = compareList.find(x => x.contextName === context && x.stepName === stepName);
        return `<td>${e ? `<strong>${escapeHtml(e.pattern || "Pattern TBC")}</strong><br><span class="pill ${e.riskLevel === "High" ? "red" : e.riskLevel === "Medium" ? "amber" : "green"}">${escapeHtml(e.riskLevel)}</span><p>${escapeHtml(e.notes || "")}</p>` : `<span class="pill grey">Missing / not mapped</span>`}</td>`;
      }).join("")}</tr>`;
    }).join("")}</tbody></table>`;
}

function renderStandards(sourceList = null) {
  const list = Array.isArray(sourceList) ? sourceList : getFilteredEntries();
  const suggestions = generateStandardSuggestions(list);
  if (!suggestions.length) { els.standardsList.innerHTML = `<div class="empty">No standards suggested yet. Add notes with words like inconsistent, duplicate, confusing, manual, TBC or handoff.</div>`; return; }
  els.standardsList.innerHTML = suggestions.map(s => `<article class="standard-card">
    <span class="pill ${s.severity === "High" ? "red" : "amber"}">${escapeHtml(s.severity)} priority</span>
    <h3>${escapeHtml(s.title)}</h3>
    <p><strong>Signal:</strong> ${escapeHtml(s.signal)}</p>
    <p><strong>Suggested standard:</strong> ${escapeHtml(s.standard)}</p>
    <p><strong>Evidence:</strong> ${escapeHtml(s.count)} related step(s)</p>
  </article>`).join("");
}

function generateStandardSuggestions(list) {
  const rules = [
    { key: "owner", terms: ["tbc", "unknown", "unclear"], title: "Clarify ownership for journey steps", signal: "One or more steps have unclear ownership.", standard: "Every journey step must have a named squad or accountable owner before it progresses into delivery.", severity: "High" },
    { key: "forms", terms: ["form", "validation", "field", "error"], title: "Create a unified form standard", signal: "Form behaviour or validation appears across multiple journey steps.", standard: "All forms should use a shared pattern for labels, field order, validation, error messaging and save/continue behaviour.", severity: "High" },
    { key: "terminology", terms: ["terminology", "wording", "language", "label"], title: "Standardise terminology across products", signal: "Different language may be used for the same customer concept.", standard: "Create a shared terminology guide for high-frequency customer and policy concepts across all apps.", severity: "Medium" },
    { key: "duplicate", terms: ["duplicate", "duplicated", "same problem", "rebuild"], title: "Reduce duplicated UX patterns", signal: "Teams may be solving the same experience problem separately.", standard: "Before designing a new pattern, teams should check the design system and cross-stream pattern library for an existing solution.", severity: "Medium" },
    { key: "handoff", terms: ["handoff", "handover", "context lost", "break", "broken", "jarring"], title: "Improve cross-stream handoffs", signal: "The customer experience may break when ownership moves between streams.", standard: "Cross-stream handoffs should preserve customer context, terminology and visual continuity between systems.", severity: "High" }
  ];

  return rules.map(rule => {
    const matches = list.filter(e => rule.terms.some(t => `${e.owner} ${e.notes} ${e.evidence} ${e.pattern}`.toLowerCase().includes(t)));
    return matches.length ? { ...rule, count: matches.length } : null;
  }).filter(Boolean);
}

function wireCardButtons() {
  document.querySelectorAll("[data-edit]").forEach(btn => btn.addEventListener("click", () => {
    const entry = entries.find(e => e.id === btn.dataset.edit);
    if (entry) openModal(entry);
  }));
  document.querySelectorAll("[data-delete]").forEach(btn => btn.addEventListener("click", () => {
    if (!confirm("Delete this journey step?")) return;
    entries = entries.filter(e => e.id !== btn.dataset.delete);
    persist();
    render();
  }));
}

function hasOwnerGap(e) {
  const owner = (e.owner || "").toLowerCase();
  return !owner || owner.includes("tbc") || owner.includes("unknown") || owner.includes("unclear");
}

function groupBy(list, getKey) {
  return list.reduce((acc, item) => {
    const key = getKey(item);
    acc[key] = acc[key] || [];
    acc[key].push(item);
    return acc;
  }, {});
}

function clearAll() {
  if (!confirm("Clear all saved data from this browser?")) return;
  entries = [];
  persist();
  render();
}

function copyJson() {
  navigator.clipboard.writeText(JSON.stringify(entries, null, 2)).then(() => alert("JSON copied to clipboard."));
}

function downloadJson() {
  const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "value-stream-experience-map.json";
  a.click();
  URL.revokeObjectURL(url);
}

function importJson(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!Array.isArray(imported)) throw new Error("JSON must be an array");
      entries = imported;
      persist();
      render();
    } catch (error) { alert("Could not import JSON: " + error.message); }
  };
  reader.readAsText(file);
}

function loadExampleData() {
  entries = [
    { id:createId(), journeyName:"Login", contextName:"Broker Portal", stepOrder:1, stepName:"Open login", customerAction:"User opens the portal login page", valueStream:"Digital Experience", owner:"Portal Squad", pattern:"Login page", emotion:"Neutral", riskLevel:"Medium", notes:"Login entry point uses different terminology from Mobius.", evidence:"Observed in current portal prototype.", createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() },
    { id:createId(), journeyName:"Login", contextName:"Mobius", stepOrder:1, stepName:"Open login", customerAction:"User opens Mobius login", valueStream:"Core Platform", owner:"TBC", pattern:"Legacy login", emotion:"Confused", riskLevel:"High", notes:"Owner unclear and experience feels jarring compared with portal.", evidence:"Known cross-product inconsistency.", createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() },
    { id:createId(), journeyName:"Quote to Buy", contextName:"Customer Portal", stepOrder:1, stepName:"Start quote", customerAction:"Customer begins quote journey", valueStream:"Digital Experience", owner:"Portal Squad", pattern:"Start page", emotion:"Positive", riskLevel:"Low", notes:"Clear entry point.", evidence:"Prototype review.", createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() },
    { id:createId(), journeyName:"Quote to Buy", contextName:"Customer Portal", stepOrder:2, stepName:"Enter risk details", customerAction:"Customer enters cover and risk information", valueStream:"Pricing", owner:"Pricing Squad", pattern:"Form pattern", emotion:"Neutral", riskLevel:"High", notes:"Form validation differs from policy admin screens; possible duplicate pattern.", evidence:"Prototype comparison.", createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() },
    { id:createId(), journeyName:"Quote to Buy", contextName:"Broker Portal", stepOrder:2, stepName:"Enter risk details", customerAction:"Broker enters customer risk information", valueStream:"Pricing", owner:"Broker Platform Squad", pattern:"Different form pattern", emotion:"Frustrated", riskLevel:"Medium", notes:"Same problem solved differently. Terminology differs.", evidence:"Broker journey review.", createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() }
  ];
  persist();
  render();
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
function escapeAttr(value) { return escapeHtml(value); }
