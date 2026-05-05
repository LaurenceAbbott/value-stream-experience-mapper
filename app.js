const STORAGE_KEY = "valueStreamExperienceMapper.v2";

const dom = {
  navTabs: document.querySelectorAll(".nav-tab"),
  views: document.querySelectorAll(".view"),
  viewTitle: document.getElementById("viewTitle"),
  searchInput: document.getElementById("searchInput"),
  journeyBoard: document.getElementById("journeyBoard"),
  signalsList: document.getElementById("signalsList"),
  standardsList: document.getElementById("standardsList"),
  jsonOutput: document.getElementById("jsonOutput"),
  totalSteps: document.getElementById("totalSteps"),
  valueStreamCount: document.getElementById("valueStreamCount"),
  unknownOwnerCount: document.getElementById("unknownOwnerCount"),
  riskCount: document.getElementById("riskCount"),
  openStepModalBtn: document.getElementById("openStepModalBtn"),
  addJourneyBtn: document.getElementById("addJourneyBtn"),
  stepModal: document.getElementById("stepModal"),
  stepForm: document.getElementById("stepForm"),
  modalTitle: document.getElementById("modalTitle"),
  closeModalBtn: document.getElementById("closeModalBtn"),
  cancelBtn: document.getElementById("cancelBtn"),
  seedDataBtn: document.getElementById("seedDataBtn"),
  exportBtn: document.getElementById("exportBtn"),
  downloadBtn: document.getElementById("downloadBtn"),
  clearAllBtn: document.getElementById("clearAllBtn"),
  generateStandardsBtn: document.getElementById("generateStandardsBtn"),
  fields: {
    stepId: document.getElementById("stepId"),
    journeyName: document.getElementById("journeyName"),
    stepName: document.getElementById("stepName"),
    customerAction: document.getElementById("customerAction"),
    valueStream: document.getElementById("valueStream"),
    owner: document.getElementById("owner"),
    pattern: document.getElementById("pattern"),
    emotion: document.getElementById("emotion"),
    riskLevel: document.getElementById("riskLevel"),
    notes: document.getElementById("notes"),
    evidence: document.getElementById("evidence")
  }
};

let steps = loadSteps();
let draggedStepId = null;

function loadSteps() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error("Unable to load saved steps", error);
    return [];
  }
}

function saveSteps() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(steps));
  render();
}

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : `step-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalise(value) {
  return String(value || "").trim();
}

function getFilteredSteps() {
  const query = dom.searchInput.value.trim().toLowerCase();
  if (!query) return steps;

  return steps.filter(step => JSON.stringify(step).toLowerCase().includes(query));
}

function getGroupedSteps(list) {
  return list.reduce((groups, step) => {
    const key = step.journeyName || "Untitled journey";
    if (!groups[key]) groups[key] = [];
    groups[key].push(step);
    return groups;
  }, {});
}

function isOwnerGap(step) {
  const owner = normalise(step.owner).toLowerCase();
  return !owner || owner.includes("tbc") || owner.includes("unknown") || owner.includes("unclear");
}

function isExperienceRisk(step) {
  const text = `${step.notes} ${step.evidence} ${step.riskLevel}`.toLowerCase();
  const riskTerms = ["inconsistent", "duplicate", "duplicated", "handoff", "handover", "manual", "confusing", "unclear", "broken", "break", "gap", "risk", "blocked", "frustrated", "high"];
  return step.riskLevel === "High" || riskTerms.some(term => text.includes(term));
}

function riskClass(step) {
  if (step.riskLevel === "High") return "red";
  if (step.riskLevel === "Medium") return "amber";
  return "green";
}

function render() {
  const filtered = getFilteredSteps();
  renderSummary(filtered);
  renderJourneyBoard(filtered);
  renderSignals(filtered);
  renderStandards(filtered);
  renderJson();
}

function renderSummary(list) {
  const streams = new Set(list.map(step => normalise(step.valueStream).toLowerCase()).filter(Boolean));
  dom.totalSteps.textContent = list.length;
  dom.valueStreamCount.textContent = streams.size;
  dom.unknownOwnerCount.textContent = list.filter(isOwnerGap).length;
  dom.riskCount.textContent = list.filter(isExperienceRisk).length;
}

function renderJourneyBoard(list) {
  if (!list.length) {
    dom.journeyBoard.innerHTML = `<div class="empty-state"><h3>No journey steps yet</h3><p>Add your first step, or load the example data to see how this works.</p></div>`;
    return;
  }

  const groups = getGroupedSteps(list);
  dom.journeyBoard.innerHTML = Object.entries(groups).map(([journey, groupSteps]) => `
    <section class="journey-group" data-journey="${escapeHtml(journey)}">
      <div class="journey-group-header">
        <div>
          <h3>${escapeHtml(journey)}</h3>
          <span>${groupSteps.length} step${groupSteps.length === 1 ? "" : "s"}</span>
        </div>
      </div>
      ${groupSteps.map(step => renderStepRow(step)).join("")}
    </section>
  `).join("");

  bindStepButtons();
  bindDragAndDrop();
}

function renderStepRow(step) {
  return `
    <article class="step-row" draggable="true" data-step-id="${escapeHtml(step.id)}">
      <div class="step-cell">
        <span class="step-label">Step</span>
        <div class="step-value">${escapeHtml(step.stepName || "Untitled step")}</div>
      </div>
      <div class="step-cell">
        <span class="step-label">Customer action</span>
        <div class="step-value">${escapeHtml(step.customerAction || "Not captured")}</div>
      </div>
      <div class="step-cell">
        <span class="step-label">Value stream</span>
        <div class="step-value">${escapeHtml(step.valueStream || "TBC")}</div>
      </div>
      <div class="step-cell">
        <span class="step-label">Owner</span>
        <div class="pills">
          <span class="pill ${isOwnerGap(step) ? "amber" : "green"}">${escapeHtml(step.owner || "Owner TBC")}</span>
        </div>
      </div>
      <div class="step-cell">
        <span class="step-label">Signals</span>
        <div class="pills">
          <span class="pill">${escapeHtml(step.pattern || "Pattern TBC")}</span>
          <span class="pill ${riskClass(step)}">${escapeHtml(step.riskLevel || "Low")} risk</span>
          <span class="pill">${escapeHtml(step.emotion || "Neutral")}</span>
        </div>
      </div>
      <div class="step-actions">
        <button class="small-btn" data-edit="${escapeHtml(step.id)}">Edit</button>
        <button class="small-btn delete" data-delete="${escapeHtml(step.id)}">Delete</button>
      </div>
    </article>
  `;
}

function renderSignals(list) {
  const signals = [];
  const ownerGaps = list.filter(isOwnerGap);
  const risks = list.filter(isExperienceRisk);
  const streamCounts = countBy(list, "valueStream");
  const patternCounts = countBy(list, "pattern");

  if (ownerGaps.length) {
    signals.push({
      title: `${ownerGaps.length} ownership gap${ownerGaps.length === 1 ? "" : "s"}`,
      text: "Some journey steps do not have a clear owner. These are good candidates for value stream alignment conversations."
    });
  }

  if (risks.length) {
    signals.push({
      title: `${risks.length} experience risk${risks.length === 1 ? "" : "s"}`,
      text: "Risk language appears in notes/evidence, or risk level has been marked as high. Review these first."
    });
  }

  Object.entries(streamCounts).forEach(([stream, count]) => {
    if (stream && count >= 3) {
      signals.push({ title: `${stream} owns ${count} steps`, text: "This value stream appears heavily involved in the mapped journey." });
    }
  });

  Object.entries(patternCounts).forEach(([pattern, count]) => {
    if (pattern && count >= 2) {
      signals.push({ title: `Repeated pattern: ${pattern}`, text: "A repeated pattern is a good candidate for a shared design standard." });
    }
  });

  dom.signalsList.innerHTML = signals.length
    ? signals.map(signal => `<article class="signal-card"><h4>${escapeHtml(signal.title)}</h4><p>${escapeHtml(signal.text)}</p></article>`).join("")
    : `<div class="empty-state"><h3>No signals yet</h3><p>Add more steps, notes and owners to generate useful signals.</p></div>`;
}

function renderStandards(list) {
  const standards = generateStandards(list);
  dom.standardsList.innerHTML = standards.length
    ? standards.map(standard => `<article class="standard-card"><h4>${escapeHtml(standard.title)}</h4><p>${escapeHtml(standard.text)}</p></article>`).join("")
    : `<div class="empty-state"><h3>No standards generated yet</h3><p>Add repeated patterns or click Generate standards after mapping a journey.</p></div>`;
}

function renderJson() {
  dom.jsonOutput.value = JSON.stringify(steps, null, 2);
}

function countBy(list, key) {
  return list.reduce((acc, item) => {
    const value = normalise(item[key]);
    if (!value) return acc;
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function generateStandards(list) {
  const standards = [];
  const repeatedPatterns = Object.entries(countBy(list, "pattern")).filter(([, count]) => count >= 2);

  repeatedPatterns.forEach(([pattern]) => {
    standards.push({
      title: `${pattern} standard`,
      text: `Create one shared approach for ${pattern.toLowerCase()} across value streams so teams do not solve the same experience problem differently.`
    });
  });

  if (list.some(isOwnerGap)) {
    standards.push({
      title: "Ownership clarity standard",
      text: "Every journey step should have a named value stream owner before work moves into delivery. If ownership is shared, the decision owner must still be clear."
    });
  }

  if (list.some(step => step.notes.toLowerCase().includes("terminology") || step.notes.toLowerCase().includes("wording"))) {
    standards.push({
      title: "Terminology standard",
      text: "Use consistent customer-facing language across streams, especially where customers move between quote, policy admin and portal experiences."
    });
  }

  if (list.some(step => step.notes.toLowerCase().includes("handoff") || step.notes.toLowerCase().includes("handover"))) {
    standards.push({
      title: "Handoff standard",
      text: "When a journey crosses value streams, customer context should be preserved and the transition should feel like one continuous experience."
    });
  }

  return standards;
}

function bindStepButtons() {
  document.querySelectorAll("[data-edit]").forEach(button => {
    button.addEventListener("click", () => openModal(button.dataset.edit));
  });

  document.querySelectorAll("[data-delete]").forEach(button => {
    button.addEventListener("click", () => {
      if (!confirm("Delete this journey step?")) return;
      steps = steps.filter(step => step.id !== button.dataset.delete);
      saveSteps();
    });
  });
}

function bindDragAndDrop() {
  document.querySelectorAll(".step-row").forEach(row => {
    row.addEventListener("dragstart", () => {
      draggedStepId = row.dataset.stepId;
      row.classList.add("is-dragging");
    });

    row.addEventListener("dragend", () => {
      row.classList.remove("is-dragging");
      draggedStepId = null;
    });

    row.addEventListener("dragover", event => event.preventDefault());

    row.addEventListener("drop", event => {
      event.preventDefault();
      const targetId = row.dataset.stepId;
      if (!draggedStepId || draggedStepId === targetId) return;
      reorderSteps(draggedStepId, targetId);
    });
  });
}

function reorderSteps(fromId, toId) {
  const fromIndex = steps.findIndex(step => step.id === fromId);
  const toIndex = steps.findIndex(step => step.id === toId);
  if (fromIndex < 0 || toIndex < 0) return;
  const [moved] = steps.splice(fromIndex, 1);
  steps.splice(toIndex, 0, moved);
  saveSteps();
}

function openModal(stepId = null) {
  dom.stepForm.reset();
  dom.fields.stepId.value = "";

  if (stepId) {
    const step = steps.find(item => item.id === stepId);
    if (!step) return;
    dom.modalTitle.textContent = "Edit journey step";
    Object.entries(dom.fields).forEach(([key, field]) => {
      field.value = step[key] || "";
    });
  } else {
    dom.modalTitle.textContent = "Add journey step";
    dom.fields.riskLevel.value = "Low";
    dom.fields.emotion.value = "Neutral";
  }

  dom.stepModal.showModal();
}

function closeModal() {
  dom.stepModal.close();
}

function saveStepFromForm() {
  const formData = Object.fromEntries(Object.entries(dom.fields).map(([key, field]) => [key, normalise(field.value)]));

  if (!formData.journeyName && !formData.stepName && !formData.customerAction) {
    alert("Add at least a journey, step name, or customer action.");
    return;
  }

  const existingIndex = steps.findIndex(step => step.id === formData.stepId);
  const nextStep = {
    id: formData.stepId || uuid(),
    journeyName: formData.journeyName || "Untitled journey",
    stepName: formData.stepName || "Untitled step",
    customerAction: formData.customerAction,
    valueStream: formData.valueStream,
    owner: formData.owner,
    pattern: formData.pattern,
    emotion: formData.emotion || "Neutral",
    riskLevel: formData.riskLevel || "Low",
    notes: formData.notes,
    evidence: formData.evidence,
    updatedAt: new Date().toISOString()
  };

  if (existingIndex >= 0) {
    steps[existingIndex] = nextStep;
  } else {
    steps.push(nextStep);
  }

  saveSteps();
  closeModal();
}

function seedData() {
  if (steps.length && !confirm("This will add example data to your existing map. Continue?")) return;
  const example = [
    {
      journeyName: "Quote to Buy",
      stepName: "Start quote",
      customerAction: "Customer begins a quote journey from the portal",
      valueStream: "Digital Experience",
      owner: "Portal Squad",
      pattern: "Start page",
      emotion: "Positive",
      riskLevel: "Low",
      notes: "Clear entry point, but terminology differs from policy admin screens.",
      evidence: "Observed in current portal prototype."
    },
    {
      journeyName: "Quote to Buy",
      stepName: "Enter risk details",
      customerAction: "Customer completes risk and personal details",
      valueStream: "Quote and Buy",
      owner: "TBC",
      pattern: "Form pattern",
      emotion: "Confused",
      riskLevel: "Medium",
      notes: "Long forms, inconsistent validation and unclear field help.",
      evidence: "Support feedback mentions confusion around required fields."
    },
    {
      journeyName: "Quote to Buy",
      stepName: "Review price",
      customerAction: "Customer compares price and cover options",
      valueStream: "Pricing",
      owner: "Pricing Squad",
      pattern: "Pricing card",
      emotion: "Neutral",
      riskLevel: "Medium",
      notes: "Pricing display uses different layout and labels compared with renewal screens.",
      evidence: "Similar pricing cards exist in multiple products."
    },
    {
      journeyName: "Quote to Buy",
      stepName: "Receive documents",
      customerAction: "Customer receives policy confirmation and documents",
      valueStream: "Policy Admin",
      owner: "Policy Squad",
      pattern: "Document list",
      emotion: "Frustrated",
      riskLevel: "High",
      notes: "Handoff feels broken. Customer context is lost and the UI feels like a different product.",
      evidence: "Known handoff issue between quote and policy admin."
    }
  ].map(item => ({ id: uuid(), updatedAt: new Date().toISOString(), ...item }));

  steps = [...steps, ...example];
  saveSteps();
}

function copyJson() {
  const json = JSON.stringify(steps, null, 2);
  navigator.clipboard.writeText(json).then(() => alert("JSON copied to clipboard."));
}

function downloadJson() {
  const blob = new Blob([JSON.stringify(steps, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "value-stream-experience-map.json";
  link.click();
  URL.revokeObjectURL(url);
}

function switchView(viewId) {
  dom.views.forEach(view => view.classList.toggle("is-active", view.id === viewId));
  dom.navTabs.forEach(tab => tab.classList.toggle("is-active", tab.dataset.view === viewId));
  const activeTab = [...dom.navTabs].find(tab => tab.dataset.view === viewId);
  dom.viewTitle.textContent = activeTab ? activeTab.textContent : "Journey map";
}

dom.navTabs.forEach(tab => tab.addEventListener("click", () => switchView(tab.dataset.view)));
dom.openStepModalBtn.addEventListener("click", () => openModal());
dom.addJourneyBtn.addEventListener("click", () => openModal());
dom.closeModalBtn.addEventListener("click", closeModal);
dom.cancelBtn.addEventListener("click", closeModal);
dom.stepForm.addEventListener("submit", event => {
  event.preventDefault();
  saveStepFromForm();
});
dom.searchInput.addEventListener("input", render);
dom.seedDataBtn.addEventListener("click", seedData);
dom.exportBtn.addEventListener("click", copyJson);
dom.downloadBtn.addEventListener("click", downloadJson);
dom.generateStandardsBtn.addEventListener("click", () => switchView("standardsView"));
dom.clearAllBtn.addEventListener("click", () => {
  if (!confirm("Clear all saved data from this browser?")) return;
  steps = [];
  saveSteps();
});

render();
