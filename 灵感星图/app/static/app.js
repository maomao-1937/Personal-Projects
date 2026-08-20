const state = {
  token: sessionStorage.getItem("incubator_token") || "",
  sourceType: "text",
  materials: [],
  hypotheses: [],
  activeHypothesis: null,
  activeMaterialId: null,
  selectedSeedMaterialId: null,
};

const elements = {
  accessDialog: document.querySelector("#accessDialog"),
  accessForm: document.querySelector("#accessForm"),
  accessToken: document.querySelector("#accessToken"),
  connectionButton: document.querySelector("#connectionButton"),
  connectionLabel: document.querySelector("#connectionLabel"),
  materialDialog: document.querySelector("#materialDialog"),
  materialEditForm: document.querySelector("#materialEditForm"),
  editMaterialTitle: document.querySelector("#editMaterialTitle"),
  editMaterialContent: document.querySelector("#editMaterialContent"),
  materialAnalysis: document.querySelector("#materialAnalysis"),
  organizedMaterialContent: document.querySelector("#organizedMaterialContent"),
  analysisModelBadge: document.querySelector("#analysisModelBadge"),
  materialInlineStatus: document.querySelector("#materialInlineStatus"),
  reanalyzeMaterialButton: document.querySelector("#reanalyzeMaterialButton"),
  materialForm: document.querySelector("#materialForm"),
  materialTitle: document.querySelector("#materialTitle"),
  materialContent: document.querySelector("#materialContent"),
  materialUrl: document.querySelector("#materialUrl"),
  textSourceFields: document.querySelector("#textSourceFields"),
  urlSourceFields: document.querySelector("#urlSourceFields"),
  materialGrid: document.querySelector("#materialGrid"),
  materialCount: document.querySelector("#materialCount"),
  problemStat: document.querySelector("#problemStat"),
  mechanismStat: document.querySelector("#mechanismStat"),
  insightStat: document.querySelector("#insightStat"),
  signalValue: document.querySelector("#signalValue"),
  signalNote: document.querySelector("#signalNote"),
  incubationForm: document.querySelector("#incubationForm"),
  projectSeedPicker: document.querySelector("#projectSeedPicker"),
  projectSeedButton: document.querySelector("#projectSeedButton"),
  projectSeedLabel: document.querySelector("#projectSeedLabel"),
  projectSeedList: document.querySelector("#projectSeedList"),
  projectSeedHint: document.querySelector("#projectSeedHint"),
  generateHypothesisButton: document.querySelector("#generateHypothesisButton"),
  availableDays: document.querySelector("#availableDays"),
  projectBudget: document.querySelector("#projectBudget"),
  hypothesisStage: document.querySelector("#hypothesisStage"),
  historyList: document.querySelector("#historyList"),
  refreshButton: document.querySelector("#refreshButton"),
  loadDemoButton: document.querySelector("#loadDemoButton"),
  toast: document.querySelector("#toast"),
};

const roleLabels = {
  problem: "问题",
  mechanism: "机制",
  insight: "洞察",
  constraint: "约束",
};

const feedbackLabels = {
  worth_doing: "值得做",
  too_generic: "太普通",
  weak_connection: "关联牵强",
  too_large: "规模太大",
  not_interested: "不感兴趣",
};

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) return "刚刚";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

let toastTimer;
function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("visible"), 3200);
}

function updateConnection(connected) {
  elements.connectionButton.classList.toggle("connected", connected);
  elements.connectionLabel.textContent = connected ? "星库已连接" : "星库登录";
}

function openAccessDialog() {
  elements.accessToken.value = state.token;
  if (!elements.accessDialog.open) elements.accessDialog.showModal();
  window.setTimeout(() => elements.accessToken.focus(), 50);
}

async function api(path, options = {}) {
  if (!state.token) {
    openAccessDialog();
    throw new Error("请先连接私人星库");
  }
  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${state.token}`);
  if (options.body) headers.set("Content-Type", "application/json");

  const response = await fetch(path, { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (response.status === 401) {
    sessionStorage.removeItem("incubator_token");
    state.token = "";
    updateConnection(false);
    openAccessDialog();
  }
  if (!response.ok) {
    throw new Error(payload.detail || `请求失败（${response.status}）`);
  }
  return payload;
}

function inferredMechanism(item) {
  const text = [item.summary, item.raw_text, ...(item.mechanisms || []), ...(item.insights || [])].join(" ");
  return (item.mechanisms || []).length > 0 || ["滑动", "语音", "自动", "分工", "清单", "打卡", "协作", "流程", "推荐"].some((word) => text.includes(word));
}

function setBusy(form, busy, label) {
  const button = form.querySelector('button[type="submit"]');
  if (!button) return;
  if (!button.dataset.originalLabel) button.dataset.originalLabel = button.innerHTML;
  button.disabled = busy;
  button.innerHTML = busy ? label : button.dataset.originalLabel;
}

function readyMaterials() {
  return state.materials.filter((item) => item.processing_status === "ready");
}

function materialTitle(item) {
  const displayText = item.organized_text || item.summary || item.raw_text || "";
  return item.title || displayText.slice(0, 34) || "未命名素材";
}

function closeSeedPicker() {
  elements.projectSeedList.hidden = true;
  elements.projectSeedButton.setAttribute("aria-expanded", "false");
}

function renderSeedPicker() {
  const available = readyMaterials();
  if (!available.some((item) => item.id === state.selectedSeedMaterialId)) {
    state.selectedSeedMaterialId = null;
  }

  const selected = available.find((item) => item.id === state.selectedSeedMaterialId);
  elements.projectSeedLabel.textContent = selected
    ? materialTitle(selected)
    : available.length
      ? "从素材星库选择"
      : "素材星库还是空的";

  elements.projectSeedList.innerHTML = available.length
    ? available
      .slice()
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .map((item) => {
        const isSelected = item.id === state.selectedSeedMaterialId;
        const type = roleLabels[item.material_type] || item.material_type || "素材";
        const summary = item.summary || item.organized_text || item.raw_text || "暂无摘要";
        return `
          <button
            class="seed-option${isSelected ? " selected" : ""}"
            type="button"
            role="option"
            aria-selected="${isSelected}"
            data-seed-material-id="${escapeHtml(item.id)}"
          >
            <span class="seed-option-type">${escapeHtml(type)}</span>
            <strong>${escapeHtml(materialTitle(item))}</strong>
            <small>${escapeHtml(summary)}</small>
          </button>`;
      })
      .join("")
    : '<div class="seed-picker-empty">先去素材星库存入至少两条素材。</div>';

  if (!available.length) {
    elements.projectSeedHint.textContent = "先保存素材，再回来生成方案";
  } else if (available.length < 2) {
    elements.projectSeedHint.textContent = "还需要至少一条可用素材";
  } else if (selected) {
    elements.projectSeedHint.textContent = "以此为核心，自动关联整个素材星库";
  } else {
    elements.projectSeedHint.textContent = "先选择一条核心素材";
  }
  elements.generateHypothesisButton.disabled = available.length < 2 || !selected;
}

function renderMaterials() {
  elements.materialCount.textContent = state.materials.length;
  const problemCount = state.materials.filter((item) => item.problems?.length).length;
  const mechanismCount = state.materials.filter(inferredMechanism).length;
  const insightCount = state.materials.filter((item) => item.insights?.length).length;
  elements.problemStat.textContent = problemCount;
  elements.mechanismStat.textContent = mechanismCount;
  elements.insightStat.textContent = insightCount;

  const scenarioCount = state.materials.filter((item) => item.actors?.length || /家庭|用户|场景|人群|露营/.test(`${item.summary} ${item.raw_text}`)).length;
  const viable = mechanismCount > 0 && (problemCount > 0 || scenarioCount > 0);
  elements.signalValue.textContent = viable ? "可以连线" : "等待素材";
  elements.signalNote.textContent = viable
    ? "问题与机制信号已经出现，可以尝试生成一个方案假设。"
    : "保存一个具体用户场景和一个可借用机制，就能开始验证方向。";
  renderSeedPicker();

  if (!state.materials.length) {
    elements.materialGrid.innerHTML = `
      <div class="empty-materials">
        <div><div class="empty-glyph">✦</div>星库还是空的。把第一个真实问题存进来吧。</div>
      </div>`;
    return;
  }

  elements.materialGrid.innerHTML = state.materials
    .slice()
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map((item) => {
      const type = roleLabels[item.material_type] || item.material_type || "素材";
      const displayText = item.organized_text || item.summary;
      const title = item.title || displayText.slice(0, 34);
      const topics = (item.topics || []).slice(0, 4);
      return `
        <button class="material-card glass-card" type="button" data-material-id="${escapeHtml(item.id)}">
          <div class="material-meta">
            <span class="material-type">${escapeHtml(type)}</span>
            <time datetime="${escapeHtml(item.created_at)}">${formatDate(item.created_at)}</time>
          </div>
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(displayText)}</p>
          <div class="topic-list">${topics.map((topic) => `<span>${escapeHtml(topic)}</span>`).join("")}</div>
          <span class="open-hint">打开查看与修改 →</span>
        </button>`;
    })
    .join("");
}

function sourceTitle(materialId) {
  const material = state.materials.find((item) => item.id === materialId);
  return material?.title || material?.summary || "已引用素材";
}

function renderHypothesis(hypothesis) {
  state.activeHypothesis = hypothesis;
  if (!hypothesis) return;

  if (hypothesis.status === "no_viable_direction") {
    elements.hypothesisStage.innerHTML = `
      <article class="no-direction glass-card">
        <div>
          <div class="empty-glyph">✦</div>
          <span class="section-index">NO RELIABLE SIGNAL</span>
          <h3>这次不强行生成</h3>
          <p>${escapeHtml(hypothesis.reason)}</p>
        </div>
      </article>`;
    return;
  }

  const sources = (hypothesis.source_contributions || [])
    .map(
      (source) => `
        <div class="source-item">
          <span class="source-role">${escapeHtml(roleLabels[source.role] || source.role)} · ${escapeHtml(sourceTitle(source.material_id))}</span>
          <p>${escapeHtml(source.contribution)}</p>
        </div>`,
    )
    .join("");
  const scope = (hypothesis.mvp_scope || [])
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
  const feedback = Object.entries(feedbackLabels)
    .map(([value, label]) => `<button class="feedback-chip" type="button" data-feedback="${value}">${label}</button>`)
    .join("");

  elements.hypothesisStage.innerHTML = `
    <article class="hypothesis-card glass-card">
      <header class="hypothesis-header">
        <div>
          <span class="section-index">PROJECT HYPOTHESIS · WAITING FOR VALIDATION</span>
          <h3>${escapeHtml(hypothesis.title)}</h3>
          <p class="one-liner">${escapeHtml(hypothesis.one_liner)}</p>
        </div>
        <span class="estimate-badge">${escapeHtml(hypothesis.time_estimate)}</span>
      </header>
      <div class="hypothesis-layout">
        <div>
          <div class="detail-block">
            <h4>服务谁 / 解决什么</h4>
            <p>${escapeHtml(hypothesis.target_user)} · ${escapeHtml(hypothesis.problem)}</p>
          </div>
          <div class="detail-block">
            <h4>最小版本</h4>
            <ul class="scope-list">${scope}</ul>
          </div>
          <div class="detail-block first-action">
            <h4>第一个验证动作</h4>
            <p>${escapeHtml(hypothesis.first_validation_action)}</p>
          </div>
        </div>
        <aside class="source-panel">
          <h4>为什么这些素材能组合</h4>
          <p>${escapeHtml(hypothesis.relationship_explanation)}</p>
          <div>${sources}</div>
        </aside>
      </div>
      <div class="feedback-bar">
        <span>这个方向怎么样？</span>
        ${feedback}
      </div>
    </article>`;
}

function renderHistory() {
  if (!state.hypotheses.length) {
    elements.historyList.innerHTML = '<div class="empty-materials">还没有观测记录。</div>';
    return;
  }
  elements.historyList.innerHTML = state.hypotheses
    .slice()
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 6)
    .map(
      (item) => `
        <button class="history-item" type="button" data-hypothesis-id="${escapeHtml(item.id)}">
          <strong>${escapeHtml(item.title || "暂未发现可靠方向")}</strong>
          <time datetime="${escapeHtml(item.created_at)}">${formatDate(item.created_at)}</time>
        </button>`,
    )
    .join("");
}

function renderMaterialAnalysis(material) {
  const rows = [
    ["类型", roleLabels[material.material_type] || material.material_type || "未分类"],
    ["摘要", material.summary || "暂无"],
    ["用户", (material.actors || []).join("、") || "暂无"],
    ["问题", (material.problems || []).join("、") || "暂无"],
    ["机制", (material.mechanisms || []).join("、") || "暂无"],
    ["主题", (material.topics || []).join("、") || "暂无"],
  ];
  elements.materialAnalysis.innerHTML = rows.map(([label, value]) => `
    <div><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span></div>`).join("");
  elements.organizedMaterialContent.textContent = material.organized_text || "这条素材还没有整理结果。";
  const isAi = material.model_name === "built-in-ai";
  elements.analysisModelBadge.textContent = isAi ? "内置 AI 整理" : "本地整理";
  elements.analysisModelBadge.classList.toggle("ai", isAi);
}

function setMaterialStatus(message, type = "info") {
  elements.materialInlineStatus.textContent = message;
  elements.materialInlineStatus.className = `material-inline-status ${type}`;
}

function openMaterialDialog(material) {
  state.activeMaterialId = material.id;
  elements.editMaterialTitle.value = material.title || "";
  elements.editMaterialContent.value = material.raw_text || "";
  renderMaterialAnalysis(material);
  setMaterialStatus(
    material.model_name === "built-in-ai"
      ? "内置 AI 已就绪。保存或重新分析后，整理结果会在上方刷新。"
      : "AI 服务尚未配置成功，当前仅能使用本地整理。",
    material.model_name === "built-in-ai" ? "info" : "warning",
  );
  if (!elements.materialDialog.open) elements.materialDialog.showModal();
}

async function refreshWorkspace({ quiet = false } = {}) {
  try {
    const [materials, hypotheses] = await Promise.all([api("/materials"), api("/hypotheses")]);
    state.materials = materials;
    state.hypotheses = hypotheses;
    renderMaterials();
    renderHistory();
    if (!state.activeHypothesis && hypotheses.length) {
      const sorted = hypotheses.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      renderHypothesis(sorted.find((item) => item.status === "ready") || sorted[0]);
    }
    updateConnection(true);
    if (!quiet) showToast("星图已经更新");
  } catch (error) {
    if (!quiet) showToast(error.message);
  }
}

document.querySelectorAll(".segment").forEach((button) => {
  button.addEventListener("click", () => {
    state.sourceType = button.dataset.source;
    document.querySelectorAll(".segment").forEach((item) => item.classList.toggle("active", item === button));
    elements.textSourceFields.hidden = state.sourceType !== "text";
    elements.urlSourceFields.hidden = state.sourceType !== "url";
  });
});

elements.connectionButton.addEventListener("click", openAccessDialog);

document.querySelectorAll("[data-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => document.querySelector(`#${button.dataset.closeDialog}`).close());
});

elements.accessForm.addEventListener("submit", async (event) => {
  if (event.submitter?.value !== "default") return;
  event.preventDefault();
  const token = elements.accessToken.value.trim();
  if (!token) {
    showToast("请输入访问令牌");
    return;
  }
  state.token = token;
  sessionStorage.setItem("incubator_token", token);
  elements.accessDialog.close();
  await refreshWorkspace({ quiet: true });
});

elements.materialForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const body = {
    source_type: state.sourceType,
    title: elements.materialTitle.value.trim() || null,
  };
  if (state.sourceType === "text") {
    body.content = elements.materialContent.value.trim();
    if (!body.content) return showToast("先写下一条素材内容");
  } else {
    body.source_url = elements.materialUrl.value.trim();
    if (!body.source_url) return showToast("先填入网页地址");
  }
  setBusy(elements.materialForm, true, "正在解析星体…");
  try {
    const material = await api("/materials", { method: "POST", body: JSON.stringify(body) });
    state.materials.push(material);
    renderMaterials();
    elements.materialTitle.value = "";
    elements.materialContent.value = "";
    elements.materialUrl.value = "";
    showToast("素材已存入星库");
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(elements.materialForm, false, "");
  }
});

elements.materialGrid.addEventListener("click", (event) => {
  const card = event.target.closest("[data-material-id]");
  if (!card) return;
  const material = state.materials.find((item) => item.id === card.dataset.materialId);
  if (material) openMaterialDialog(material);
});

elements.materialEditForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const content = elements.editMaterialContent.value.trim();
  if (!content) return showToast("素材内容不能为空");
  setBusy(elements.materialEditForm, true, "正在保存并分析…");
  setMaterialStatus("内置 AI 正在整理这条想法…", "loading");
  try {
    const material = await api(`/materials/${state.activeMaterialId}/update`, {
      method: "POST",
      body: JSON.stringify({ title: elements.editMaterialTitle.value.trim() || null, content }),
    });
    state.materials = state.materials.map((item) => item.id === material.id ? material : item);
    renderMaterials();
    renderMaterialAnalysis(material);
    setMaterialStatus(
      material.model_name === "built-in-ai"
        ? "保存完成，内置 AI 已生成新的整理结果。"
        : "保存完成，本次使用了本地整理。",
      material.model_name === "built-in-ai" ? "success" : "warning",
    );
  } catch (error) {
    setMaterialStatus(`分析失败：${error.message}`, "error");
    showToast(error.message);
  } finally {
    setBusy(elements.materialEditForm, false, "");
  }
});

elements.reanalyzeMaterialButton.addEventListener("click", async () => {
  elements.reanalyzeMaterialButton.disabled = true;
  setMaterialStatus("内置 AI 正在重新理解并整理这条想法…", "loading");
  try {
    const material = await api(`/materials/${state.activeMaterialId}/reanalyze`, { method: "POST" });
    state.materials = state.materials.map((item) => item.id === material.id ? material : item);
    renderMaterials();
    renderMaterialAnalysis(material);
    setMaterialStatus(
      material.model_name === "built-in-ai"
        ? "重新分析完成，内置 AI 整理结果已更新。"
        : "重新分析完成，本地整理结果已更新。",
      material.model_name === "built-in-ai" ? "success" : "warning",
    );
  } catch (error) {
    setMaterialStatus(`重新分析失败：${error.message}`, "error");
    showToast(error.message);
  } finally {
    elements.reanalyzeMaterialButton.disabled = false;
  }
});

elements.projectSeedButton.addEventListener("click", () => {
  const willOpen = elements.projectSeedList.hidden;
  elements.projectSeedList.hidden = !willOpen;
  elements.projectSeedButton.setAttribute("aria-expanded", String(willOpen));
});

elements.projectSeedList.addEventListener("click", (event) => {
  const option = event.target.closest("[data-seed-material-id]");
  if (!option) return;
  state.selectedSeedMaterialId = option.dataset.seedMaterialId;
  renderSeedPicker();
  closeSeedPicker();
  elements.projectSeedButton.focus();
});

document.addEventListener("click", (event) => {
  if (!elements.projectSeedPicker.contains(event.target)) closeSeedPicker();
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || elements.projectSeedList.hidden) return;
  closeSeedPicker();
  elements.projectSeedButton.focus();
});

elements.incubationForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.selectedSeedMaterialId) return showToast("先选择一条核心素材");
  setBusy(elements.incubationForm, true, "正在寻找可靠连线…");
  try {
    const hypothesis = await api("/incubations", {
      method: "POST",
      body: JSON.stringify({
        seed_material_id: state.selectedSeedMaterialId,
        constraints: {
          available_days: Number(elements.availableDays.value),
          budget: elements.projectBudget.value,
        },
      }),
    });
    state.hypotheses.push(hypothesis);
    renderHypothesis(hypothesis);
    renderHistory();
    elements.hypothesisStage.scrollIntoView({ behavior: "smooth", block: "center" });
    showToast(hypothesis.status === "ready" ? "新的方案假设已经形成" : hypothesis.reason);
  } catch (error) {
    if (error.message.includes("核心素材")) {
      state.selectedSeedMaterialId = null;
      await refreshWorkspace({ quiet: true });
    }
    showToast(error.message);
  } finally {
    setBusy(elements.incubationForm, false, "");
    renderSeedPicker();
  }
});

elements.hypothesisStage.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-feedback]");
  if (!button || !state.activeHypothesis) return;
  try {
    await api(`/hypotheses/${state.activeHypothesis.id}/feedback`, {
      method: "POST",
      body: JSON.stringify({ category: button.dataset.feedback }),
    });
    elements.hypothesisStage.querySelectorAll(".feedback-chip").forEach((item) => item.classList.remove("sent"));
    button.classList.add("sent");
    showToast("反馈已记录，下一次推荐会更了解你");
  } catch (error) {
    showToast(error.message);
  }
});

elements.historyList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-hypothesis-id]");
  if (!button) return;
  const hypothesis = state.hypotheses.find((item) => item.id === button.dataset.hypothesisId);
  if (hypothesis) {
    renderHypothesis(hypothesis);
    elements.hypothesisStage.scrollIntoView({ behavior: "smooth", block: "center" });
  }
});

elements.refreshButton.addEventListener("click", () => refreshWorkspace());

elements.loadDemoButton.addEventListener("click", async () => {
  const examples = [
    "收藏的文章越来越多，但我从来不回看。",
    "短视频左右滑动的交互可以很轻松地完成筛选。",
    "间隔重复能帮助人记住真正重要的知识。",
  ];
  try {
    elements.loadDemoButton.disabled = true;
    for (const content of examples) {
      const material = await api("/materials", {
        method: "POST",
        body: JSON.stringify({ source_type: "text", content }),
      });
      state.materials.push(material);
    }
    renderMaterials();
    document.querySelector("#materials").scrollIntoView({ behavior: "smooth" });
    showToast("三条示例素材已存入星库");
  } catch (error) {
    showToast(error.message);
  } finally {
    elements.loadDemoButton.disabled = false;
  }
});

renderMaterials();
renderHistory();
updateConnection(Boolean(state.token));
if (state.token) {
  refreshWorkspace({ quiet: true });
} else {
  window.setTimeout(openAccessDialog, 500);
}
