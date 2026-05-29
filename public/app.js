const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();

const state = {
  dashboard: null,
  selectedCollectionIds: [],
  session: [],
  currentIndex: 0,
  sessionXp: 0,
  reviewed: 0,
  mastered: 0,
  attempts: 0,
  revealed: false,
  currentCollectionId: null
};

const initData = tg?.initData || "";
const pageParams = new URLSearchParams(location.search);
const devTelegramId = pageParams.get("telegramId");
let publicConfig = {
  botUsername: "LexiGoo_bot",
  botLink: "https://t.me/LexiGoo_bot"
};

const els = {
  streakBox: document.querySelector("#streakBox span:last-child"),
  xpLabel: document.querySelector("#xpLabel"),
  levelLabel: document.querySelector("#levelLabel"),
  xpMeter: document.querySelector("#xpMeter"),
  trackerDueCount: document.querySelector("#trackerDueCount"),
  trackerDueLabel: document.querySelector("#trackerDueLabel"),
  trackerSummary: document.querySelector("#trackerSummary"),
  trackerMastered: document.querySelector("#trackerMastered"),
  trackerLearning: document.querySelector("#trackerLearning"),
  trackerRetention: document.querySelector("#trackerRetention"),
  statsDue: document.querySelector("#statsDue"),
  statsMastered: document.querySelector("#statsMastered"),
  statsLearning: document.querySelector("#statsLearning"),
  statsRetention: document.querySelector("#statsRetention"),
  statsXpLabel: document.querySelector("#statsXpLabel"),
  statsLevelLabel: document.querySelector("#statsLevelLabel"),
  statsXpMeter: document.querySelector("#statsXpMeter"),
  statsCollectionSummary: document.querySelector("#statsCollectionSummary"),
  allCollectionsSwitch: document.querySelector("#allCollectionsSwitch"),
  collectionList: document.querySelector("#collectionList"),
  groupsList: document.querySelector("#groupsList"),
  wordsTitle: document.querySelector("#wordsTitle"),
  wordsList: document.querySelector("#wordsList"),
  backToCollectionsBtn: document.querySelector("#backToCollectionsBtn"),
  startSessionBtn: document.querySelector("#startSessionBtn"),
  newGroupForm: document.querySelector("#newGroupForm"),
  groupNameInput: document.querySelector("#groupNameInput"),
  sessionTitle: document.querySelector("#sessionTitle"),
  sessionXp: document.querySelector("#sessionXp"),
  sessionMeter: document.querySelector("#sessionMeter"),
  cardLevel: document.querySelector("#cardLevel"),
  cardState: document.querySelector("#cardState"),
  cardWord: document.querySelector("#cardWord"),
  cardPronunciation: document.querySelector("#cardPronunciation"),
  answerPanel: document.querySelector("#answerPanel"),
  cardDefinition: document.querySelector("#cardDefinition"),
  cardExample: document.querySelector("#cardExample"),
  cardUzbek: document.querySelector("#cardUzbek"),
  cardSynonyms: document.querySelector("#cardSynonyms"),
  showAnswerBtn: document.querySelector("#showAnswerBtn"),
  gradeGrid: document.querySelector("#gradeGrid"),
  completeXp: document.querySelector("#completeXp"),
  completeTitle: document.querySelector("#completeTitle"),
  reviewedCount: document.querySelector("#reviewedCount"),
  masteredCount: document.querySelector("#masteredCount"),
  completeMeter: document.querySelector("#completeMeter"),
  anotherGroupBtn: document.querySelector("#anotherGroupBtn"),
  navButtons: document.querySelectorAll(".nav-btn")
};

els.backToCollectionsBtn.addEventListener("click", () => showView("groupsView"));

els.navButtons.forEach((button) => {
  button.addEventListener("click", () => showView(button.dataset.targetView));
});

els.allCollectionsSwitch.addEventListener("click", () => {
  state.selectedCollectionIds = state.dashboard.collections.map((item) => item.id);
  renderDashboard();
});

els.startSessionBtn.addEventListener("click", () => {
  if (state.selectedCollectionIds.length) startSession(state.selectedCollectionIds);
});

els.anotherGroupBtn.addEventListener("click", () => showView("homeView"));

els.showAnswerBtn.addEventListener("click", revealAnswer);

els.gradeGrid.querySelectorAll("button").forEach((button) => {
  button.addEventListener("click", () => gradeCurrentCard(button.dataset.grade));
});

els.newGroupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = els.groupNameInput.value.trim();
  if (!name) return;
  await api("/api/collections", {
    method: "POST",
    body: JSON.stringify({ name })
  });
  els.groupNameInput.value = "";
  await loadDashboard();
  showView("groupsView");
});

try {
  publicConfig = await api("/api/public-config", { auth: false });
} catch {
  // The fallback above is enough for the external-open screen.
}

if (!initData && !devTelegramId) {
  showOpenInTelegram();
} else {
  try {
    await loadDashboard();
    if (pageParams.get("view") === "groups") {
      showView("groupsView");
    }
  } catch (error) {
    showAppError(error);
  }
}

async function loadDashboard() {
  state.dashboard = await api("/api/me");
  if (!state.selectedCollectionIds.length) {
    const dueCollections = state.dashboard.collections.filter((item) => item.due > 0);
    const initial = dueCollections.length ? dueCollections : state.dashboard.collections;
    state.selectedCollectionIds = initial.map((item) => item.id);
  } else {
    const availableIds = new Set(state.dashboard.collections.map((item) => item.id));
    state.selectedCollectionIds = state.selectedCollectionIds.filter((id) => availableIds.has(id));
    if (!state.selectedCollectionIds.length && state.dashboard.collections[0]) {
      state.selectedCollectionIds = [state.dashboard.collections[0].id];
    }
  }
  renderDashboard();
}

function showAppError(error) {
  document.querySelector("#homeView").innerHTML = `
    <div class="error-state">
      <h2>Could not open LexiGO</h2>
      <p>${escapeHtml(error.message || "Something went wrong.")}</p>
      <a class="primary-btn open-telegram-btn" href="${escapeAttr(publicConfig.botLink)}">
        ${icon("send")}
        <span>Open in Telegram</span>
      </a>
    </div>
  `;
  showView("homeView");
}

function showOpenInTelegram() {
  document.querySelector("#app").classList.add("external-only");
  document.querySelector("#homeView").innerHTML = `
    <section class="telegram-open-card">
      <div class="telegram-open-icon">${icon("send")}</div>
      <p class="brand-label">Lexi Go</p>
      <h1>Open inside Telegram</h1>
      <p>LexiGO works as a Telegram mini app. Open the bot and launch practice from there.</p>
      <a class="primary-btn open-telegram-btn" href="${escapeAttr(publicConfig.botLink)}">
        ${icon("send")}
        <span>Open @${escapeHtml(publicConfig.botUsername)}</span>
      </a>
    </section>
  `;
  showView("homeView");
}

function renderDashboard() {
  const user = state.dashboard.user;
  const xpIntoLevel = user.xp % 1000;
  const streak = user.streak?.current || 0;
  els.streakBox.textContent = streak > 0 ? `${streak} day streak` : "New learner";
  els.xpLabel.textContent = `${xpIntoLevel} / 1000 XP`;
  els.levelLabel.textContent = `Level ${user.level}`;
  els.xpMeter.style.width = `${Math.min(100, xpIntoLevel / 10)}%`;
  renderAllSwitch();
  renderOverallTracker();
  renderStats();

  els.collectionList.innerHTML = state.dashboard.collections.map(collectionRow).join("");
  els.groupsList.innerHTML = state.dashboard.collections.map(collectionRow).join("");
  bindCollectionList(els.collectionList);
  bindCollectionList(els.groupsList);
}

function renderAllSwitch() {
  const active = areAllCollectionsActive();
  els.allCollectionsSwitch.classList.toggle("active", active);
  els.allCollectionsSwitch.setAttribute("aria-pressed", active ? "true" : "false");
}

function renderOverallTracker() {
  const collections = getActiveCollections();
  const totalDue = collections.reduce((sum, item) => sum + item.due, 0);
  const totalWords = collections.reduce((sum, item) => sum + item.total, 0);
  const mastered = collections.reduce((sum, item) => sum + item.mastered, 0);
  const learning = Math.max(0, totalWords - mastered);
  const activeCollections = collections.filter((item) => item.total > 0).length;
  const retention = totalWords ? Math.round((mastered / totalWords) * 100) : 0;

  els.trackerDueCount.textContent = String(totalDue);
  els.trackerDueLabel.textContent = totalDue === 1 ? "word ready for session" : "words ready for session";
  els.trackerSummary.textContent = `${totalDue} reviews from ${activeCollections} active collection${activeCollections === 1 ? "" : "s"}.`;
  els.trackerMastered.textContent = String(mastered);
  els.trackerLearning.textContent = String(learning);
  els.trackerRetention.textContent = `${retention}%`;
}

function renderStats() {
  const user = state.dashboard.user;
  const collections = state.dashboard.collections;
  const totalDue = collections.reduce((sum, item) => sum + item.due, 0);
  const totalWords = collections.reduce((sum, item) => sum + item.total, 0);
  const mastered = collections.reduce((sum, item) => sum + item.mastered, 0);
  const learning = Math.max(0, totalWords - mastered);
  const retention = totalWords ? Math.round((mastered / totalWords) * 100) : 0;
  const xpIntoLevel = user.xp % 1000;

  els.statsDue.textContent = String(totalDue);
  els.statsMastered.textContent = String(mastered);
  els.statsLearning.textContent = String(learning);
  els.statsRetention.textContent = `${retention}%`;
  els.statsXpLabel.textContent = `${xpIntoLevel} / 1000 XP`;
  els.statsLevelLabel.textContent = `Level ${user.level}`;
  els.statsXpMeter.style.width = `${Math.min(100, xpIntoLevel / 10)}%`;
  els.statsCollectionSummary.textContent = `${totalWords} word${totalWords === 1 ? "" : "s"} across ${collections.length} collection${collections.length === 1 ? "" : "s"}.`;
}

function getActiveCollections() {
  return state.dashboard.collections.filter((item) => state.selectedCollectionIds.includes(item.id));
}

function areAllCollectionsActive() {
  return state.dashboard.collections.length > 0 &&
    state.selectedCollectionIds.length === state.dashboard.collections.length;
}

function toggleCollection(collectionId) {
  const isActive = state.selectedCollectionIds.includes(collectionId);
  if (isActive && state.selectedCollectionIds.length === 1) return;

  state.selectedCollectionIds = isActive
    ? state.selectedCollectionIds.filter((id) => id !== collectionId)
    : [...state.selectedCollectionIds, collectionId];

  renderDashboard();
}

function collectionRow(collection) {
  const progress = collection.total ? Math.round((collection.mastered / collection.total) * 100) : 0;
  const selected = state.selectedCollectionIds.includes(collection.id);
  const status = collection.due > 0 ? `${collection.due} due` : "all done";
  const activeText = selected ? "On" : "Off";
  const isDefault = collection.isDefault || collection.name === "My Vocabulary";
  const deleteAction = isDefault
    ? ""
    : `
          <button
            class="icon-btn danger-btn"
            type="button"
            aria-label="Delete ${escapeAttr(collection.name)}"
            title="Delete collection"
            data-delete-collection-id="${collection.id}"
          >
            ${icon("trash")}
          </button>
    `;
  const preview = collection.preview
    ? `
      <div class="due-preview">
        ${icon("book")}
        <span>
          <strong>${escapeHtml(collection.preview.word)}</strong>
          <em>${escapeHtml(collection.preview.pronunciation || collection.preview.level || "")}</em>
        </span>
      </div>
    `
    : `
      <div class="due-preview muted-preview">
        ${icon("book")}
        <span>
          <strong>No due card</strong>
          <em>ready when new words arrive</em>
        </span>
      </div>
    `;
  return `
    <div class="collection-row ${selected ? "selected" : ""}" data-collection-id="${collection.id}">
      <div class="collection-head">
        <h3>${escapeHtml(collection.name)}</h3>
        <div class="collection-actions">
          <button
            class="card-switch ${selected ? "active" : ""}"
            type="button"
            aria-pressed="${selected ? "true" : "false"}"
            data-toggle-collection-id="${collection.id}"
          >
            <span>${activeText}</span>
            <i></i>
          </button>
          ${deleteAction}
        </div>
      </div>
      <small class="collection-status">${status}</small>
      <p class="due-line">${collection.due > 0 ? `${collection.due} word${collection.due === 1 ? "" : "s"} ready to review` : `${collection.mastered}/${collection.total} mastered`}</p>
      <div class="meter"><span style="width:${progress}%"></span></div>
      ${preview}
    </div>
  `;
}

function bindCollectionList(container) {
  container.querySelectorAll("[data-collection-id]").forEach((row) => {
    row.addEventListener("click", () => openWords(row.dataset.collectionId));
  });

  container.querySelectorAll("[data-toggle-collection-id]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleCollection(button.dataset.toggleCollectionId);
    });
  });

  container.querySelectorAll("[data-delete-collection-id]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteCollection(button.dataset.deleteCollectionId);
    });
  });
}

async function openWords(collectionId) {
  const collection = state.dashboard.collections.find((item) => item.id === collectionId);
  state.currentCollectionId = collectionId;
  els.wordsTitle.textContent = collection?.name || "Words";
  els.wordsList.innerHTML = `<div class="empty-state">Loading words...</div>`;
  showView("wordsView");

  const items = await api(`/api/collections/${collectionId}/words`);
  els.wordsList.innerHTML = items.length
    ? items.map(wordRow).join("")
    : `<div class="empty-state">No words in this collection yet.</div>`;
  bindWordList(collectionId);
}

function wordRow(item) {
  const word = item.word || {};
  const dueText = item.state === "mastered"
    ? "mastered"
    : `due ${formatDue(item.dueAt)}`;

  return `
    <article class="word-row" data-word-item-id="${item.id}">
      <div>
        <h3>${escapeHtml(word.word || "")}</h3>
        <p>${escapeHtml(word.definition || "")}</p>
      </div>
      <div class="word-actions">
        <span>${escapeHtml(dueText)}</span>
        <button
          class="icon-btn danger-btn"
          type="button"
          aria-label="Remove ${escapeAttr(word.word || "word")}"
          title="Remove word"
          data-delete-word-id="${item.id}"
        >
          ${icon("trash")}
        </button>
      </div>
    </article>
  `;
}

function bindWordList(collectionId) {
  els.wordsList.querySelectorAll("[data-delete-word-id]").forEach((button) => {
    button.addEventListener("click", () => deleteWord(collectionId, button.dataset.deleteWordId));
  });
}

async function deleteCollection(collectionId) {
  const collection = state.dashboard.collections.find((item) => item.id === collectionId);
  if (collection?.isDefault || collection?.name === "My Vocabulary") {
    tg?.showAlert?.("My Vocabulary is the default collection and cannot be deleted.");
    return;
  }
  const ok = await confirmAction(`Delete "${collection?.name || "this collection"}" and all words inside it?`);
  if (!ok) return;

  await api(`/api/collections/${collectionId}`, { method: "DELETE" });
  state.selectedCollectionIds = state.selectedCollectionIds.filter((id) => id !== collectionId);
  await loadDashboard();
  if (!state.dashboard.collections.length) {
    showView("homeView");
  }
}

async function deleteWord(collectionId, itemId) {
  const ok = await confirmAction("Remove this word from the collection?");
  if (!ok) return;

  await api(`/api/collections/${collectionId}/words/${itemId}`, { method: "DELETE" });
  await loadDashboard();
  if (state.currentCollectionId === collectionId) {
    await openWords(collectionId);
  }
}

function confirmAction(message) {
  if (typeof tg?.showConfirm === "function") {
    return new Promise((resolve) => tg.showConfirm(message, resolve));
  }
  return Promise.resolve(window.confirm(message));
}

function formatDue(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "soon";
  const diff = date.getTime() - Date.now();
  if (diff <= 0) return "now";
  const minutes = Math.ceil(diff / 60000);
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `in ${hours}h`;
  return `in ${Math.ceil(hours / 24)}d`;
}

async function startSession(collectionIds) {
  const ids = collectionIds.join(",");
  const data = await api(`/api/session?collectionIds=${encodeURIComponent(ids)}`);
  state.session = data.items.map((item) => ({ ...item, retries: 0 }));
  state.currentIndex = 0;
  state.sessionXp = 0;
  state.reviewed = 0;
  state.mastered = 0;
  state.attempts = 0;
  state.revealed = false;

  if (!state.session.length) {
    tg?.showAlert?.("This collection has no due cards right now.");
    return;
  }

  els.sessionTitle.textContent = `${data.collection.name} · 1/${state.session.length}`;
  showView("practiceView");
  renderCard();
}

function renderCard() {
  const card = state.session[state.currentIndex];
  const progress = (state.currentIndex / state.session.length) * 100;
  state.revealed = false;

  els.sessionMeter.style.width = `${progress}%`;
  els.sessionXp.textContent = `+${state.sessionXp} XP`;
  els.sessionTitle.textContent = `${state.currentIndex + 1}/${state.session.length}`;
  els.cardLevel.textContent = card.level || "B1";
  els.cardState.textContent = card.state || "learning";
  els.cardWord.textContent = card.word;
  els.cardPronunciation.textContent = card.pronunciation || "";
  els.cardDefinition.textContent = card.definition || "";
  els.cardExample.textContent = card.example ? `Example: ${card.example}` : "";
  els.cardUzbek.textContent = card.uzbekMeaning ? `Uzbek: ${card.uzbekMeaning}` : "";
  els.cardSynonyms.textContent = card.synonyms?.length ? `Synonyms: ${card.synonyms.join(", ")}` : "";
  els.answerPanel.hidden = true;
  els.showAnswerBtn.hidden = false;
  els.gradeGrid.hidden = true;
}

function revealAnswer() {
  state.revealed = true;
  els.answerPanel.hidden = false;
  els.showAnswerBtn.hidden = true;
  els.gradeGrid.hidden = false;
}

async function gradeCurrentCard(grade) {
  if (!state.revealed) return;

  const card = state.session[state.currentIndex];
  setGradeButtonsDisabled(true);

  try {
    const result = await api("/api/grade", {
      method: "POST",
      body: JSON.stringify({ itemId: card.id, grade })
    });

    state.sessionXp += result.xp;
    state.attempts += 1;
    state.mastered += result.mastered ? 1 : 0;

    if (result.repeatNow) {
      repeatCurrentCard(card);
    } else {
      state.reviewed += 1;
      state.currentIndex += 1;
    }

    if (state.currentIndex >= state.session.length) {
      await finishSession();
    } else {
      renderCard();
    }
  } finally {
    setGradeButtonsDisabled(false);
  }
}

function repeatCurrentCard(card) {
  state.session.splice(state.currentIndex, 1);
  const repeatedCard = { ...card, retries: card.retries + 1, state: "learning" };
  const insertAt = state.session.length > state.currentIndex
    ? Math.min(state.currentIndex + 2, state.session.length)
    : state.session.length;
  state.session.splice(insertAt, 0, repeatedCard);
  if (state.currentIndex >= state.session.length) {
    state.currentIndex = 0;
  }
}

function setGradeButtonsDisabled(disabled) {
  els.gradeGrid.querySelectorAll("button").forEach((button) => {
    button.disabled = disabled;
  });
}

async function finishSession() {
  await loadDashboard();
  els.completeXp.textContent = `+${state.sessionXp} XP`;
  els.completeTitle.textContent = "Session complete";
  els.reviewedCount.textContent = String(state.reviewed);
  els.masteredCount.textContent = String(state.mastered);
  els.completeMeter.style.width = `${Math.round((state.reviewed / state.session.length) * 100)}%`;
  showView("completeView");
}

async function api(path, options = {}) {
  const headers = {
    ...options.headers
  };

  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  if (options.auth === false) {
    // Public endpoint.
  } else if (initData) {
    headers["x-telegram-init-data"] = initData;
  } else if (devTelegramId) {
    headers["x-dev-telegram-id"] = devTelegramId;
  }

  const response = await fetch(path, { ...options, headers });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Request failed");
  }
  return response.json();
}

function showView(id) {
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view.id === id));
  updateNavigation(id);
}

function updateNavigation(viewId) {
  const activeKey = {
    homeView: "home",
    groupsView: "groups",
    wordsView: "groups",
    statsView: "stats",
    completeView: "stats"
  }[viewId];

  els.navButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.navKey === activeKey);
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttr(value) {
  return escapeHtml(value)
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function icon(name) {
  return `<svg class="icon" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
}
