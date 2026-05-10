const keys = {
  transactions: "autospend-transactions-v2",
  settings: "autospend-settings-v2",
  queue: "autospend-queue-v2",
  chat: "autospend-chat-v2"
};

const incomeCategories = ["Salary", "Freelance", "Investment", "Gift", "Refund", "Other income"];
const expenseCategories = ["Food", "Transport", "Rent", "Shopping", "Bills", "Health", "Education", "Entertainment", "Travel", "Subscription", "Other expense"];
const paymentMethods = ["Cash", "UPI", "Debit card", "Credit card", "Bank transfer", "Wallet"];
const sourceTypes = ["manual", "cash_text", "cash_voice", "receipt_upload", "drive_screenshot", "drive_receipt"];
const chartColors = ["#157a6e", "#c94f4f", "#2767b1", "#bb7a10", "#7161a7", "#1f8f55", "#ca6f1e", "#5b677a", "#b23a6f", "#0f766e"];

const state = {
  transactions: [],
  queue: [],
  chat: [],
  settings: {
    budget: 25000,
    currency: "INR",
    profileName: "",
    profileEmail: "",
    localAuthenticated: false,
    googleConnected: false,
    driveConnected: false,
    driveFolderName: "Expense Screenshots",
    driveFolderId: "",
    backendUrl: "http://127.0.0.1:8787",
    aiBackendConnected: false,
    confidenceThreshold: 0.85,
    useServerSync: true,
    serverDataSavedAt: 0
  }
};

const $ = (id) => document.getElementById(id);
const els = {
  tabs: document.querySelectorAll(".tab-button"),
  views: document.querySelectorAll(".view"),
  transactionForm: $("transactionForm"),
  editingId: $("editingId"),
  formTitle: $("formTitle"),
  cancelEditBtn: $("cancelEditBtn"),
  categoryInput: $("categoryInput"),
  amountInput: $("amountInput"),
  dateInput: $("dateInput"),
  merchantInput: $("merchantInput"),
  methodInput: $("methodInput"),
  sourceInput: $("sourceInput"),
  noteInput: $("noteInput"),
  duplicateWarning: $("duplicateWarning"),
  totalIncome: $("totalIncome"),
  totalExpense: $("totalExpense"),
  balanceAmount: $("balanceAmount"),
  budgetUsed: $("budgetUsed"),
  reviewMetric: $("reviewMetric"),
  driveMetric: $("driveMetric"),
  savingsRate: $("savingsRate"),
  categoryChart: $("categoryChart"),
  monthlyChart: $("monthlyChart"),
  categoryLegend: $("categoryLegend"),
  categoryChartTotal: $("categoryChartTotal"),
  dashboardRecentList: $("dashboardRecentList"),
  dashboardInsightsList: $("dashboardInsightsList"),
  transactionTable: $("transactionTable"),
  transactionCount: $("transactionCount"),
  searchInput: $("searchInput"),
  typeFilter: $("typeFilter"),
  categoryFilter: $("categoryFilter"),
  monthFilter: $("monthFilter"),
  sourceFilter: $("sourceFilter"),
  statusFilter: $("statusFilter"),
  quickEntryForm: $("quickEntryForm"),
  quickEntryText: $("quickEntryText"),
  uploadForm: $("uploadForm"),
  uploadInput: $("uploadInput"),
  uploadText: $("uploadText"),
  driveStatus: $("driveStatus"),
  driveFolderInput: $("driveFolderInput"),
  connectDriveBtn: $("connectDriveBtn"),
  scanDriveBtn: $("scanDriveBtn"),
  disconnectDriveBtn: $("disconnectDriveBtn"),
  queueCount: $("queueCount"),
  queueList: $("queueList"),
  reviewCount: $("reviewCount"),
  reviewList: $("reviewList"),
  reportMonth: $("reportMonth"),
  monthReport: $("monthReport"),
  reportTotal: $("reportTotal"),
  breakdownList: $("breakdownList"),
  insightTotal: $("insightTotal"),
  insightGrid: $("insightGrid"),
  chatLog: $("chatLog"),
  assistantForm: $("assistantForm"),
  assistantInput: $("assistantInput"),
  profileStatus: $("profileStatus"),
  profileNameInput: $("profileNameInput"),
  profileEmailInput: $("profileEmailInput"),
  budgetInput: $("budgetInput"),
  currencyInput: $("currencyInput"),
  backendUrlInput: $("backendUrlInput"),
  checkBackendBtn: $("checkBackendBtn"),
  confidenceInput: $("confidenceInput"),
  serverSyncInput: $("serverSyncInput"),
  googleLoginBtn: $("googleLoginBtn"),
  googleLogoutBtn: $("googleLogoutBtn"),
  saveSettingsBtn: $("saveSettingsBtn"),
  loadSampleBtn: $("loadSampleBtn"),
  clearDataBtn: $("clearDataBtn"),
  exportCsvBtn: $("exportCsvBtn"),
  exportJsonBtn: $("exportJsonBtn"),
  printBtn: $("printBtn"),
  toast: $("toast"),
  localAuthForm: $("localAuthForm"),
  authTitle: $("authTitle"),
  authSubtitle: $("authSubtitle"),
  authSubmitBtn: $("authSubmitBtn"),
  switchAuthMode: $("switchAuthMode"),
  sidebarProfileName: $("sidebarProfileName"),
  sidebarProfileEmail: $("sidebarProfileEmail"),
  sidebarCollapseBtn: $("sidebarCollapseBtn"),
  sidebarLogoutBtn: $("sidebarLogoutBtn")
};

function todayIso() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function currentMonth() {
  return todayIso().slice(0, 7);
}

function id(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

let serverPushTimer;

function persist(options = {}) {
  const localOnly = options.localOnly === true;
  try {
    localStorage.setItem(keys.transactions, JSON.stringify(state.transactions));
    localStorage.setItem(keys.settings, JSON.stringify(state.settings));
    localStorage.setItem(keys.queue, JSON.stringify(state.queue));
    localStorage.setItem(keys.chat, JSON.stringify(state.chat));
  } catch (err) {
    console.warn("localStorage unavailable or full", err);
    if (!localOnly) toast("Could not save in the browser (storage may be full). Server copy may still update.");
  }
  if (!localOnly) scheduleServerPush();
}

function scheduleServerPush() {
  if (state.settings.useServerSync === false) return;
  clearTimeout(serverPushTimer);
  serverPushTimer = setTimeout(pushServerData, 450);
}

async function pushServerData() {
  if (state.settings.useServerSync === false) return;
  try {
    const response = await fetch(`${backendBaseUrl()}/api/data`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transactions: state.transactions,
        queue: state.queue,
        chat: state.chat,
        settings: state.settings
      })
    });
    if (!response.ok) return;
    const data = await response.json();
    if (data.savedAt != null) state.settings.serverDataSavedAt = Number(data.savedAt);
    persist({ localOnly: true });
  } catch (err) {
    console.warn("Server sync failed", err);
  }
}

function backendOrigin() {
  try {
    return new URL(backendBaseUrl()).origin;
  } catch {
    return "";
  }
}

async function pullServerData() {
  if (state.settings.useServerSync === false) return;
  try {
    const response = await fetch(`${backendBaseUrl()}/api/data`);
    if (!response.ok) return;
    const data = await response.json();
    const serverCount = Array.isArray(data.transactions) ? data.transactions.length : 0;
    const localCount = state.transactions.length;
    const serverTs = Number(data.savedAt) || 0;
    if (serverCount === 0 && localCount > 0) {
      await pushServerData();
      return;
    }
    if (serverCount === 0) return;
    const localTs = Number(state.settings.serverDataSavedAt) || 0;
    if (serverTs >= localTs || localCount === 0) applyServerSnapshot(data);
  } catch (err) {
    console.warn("Server data pull skipped", err);
  }
}

function applyServerSnapshot(data) {
  state.transactions = Array.isArray(data.transactions) ? data.transactions.map(asTx) : [];
  state.queue = Array.isArray(data.queue) ? data.queue : [];
  if (Array.isArray(data.chat) && data.chat.length) state.chat = data.chat;
  if (data.settings && typeof data.settings === "object") {
    state.settings = { ...state.settings, ...data.settings };
  }
  if (data.savedAt != null) state.settings.serverDataSavedAt = Number(data.savedAt);
  persist({ localOnly: true });
}

function money(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: state.settings.currency,
    maximumFractionDigits: Number(amount) % 1 === 0 ? 0 : 2
  }).format(Number(amount) || 0);
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("visible");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => els.toast.classList.remove("visible"), 2400);
}

function monthStart(offset = 0) {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function asTx(input) {
  return {
    id: input.id || id("tx"),
    type: input.type || "expense",
    amount: Number(input.amount) || 0,
    currency: input.currency || state.settings.currency,
    date: input.date || todayIso(),
    merchant: input.merchant || "Unknown",
    category: input.category || "Other expense",
    method: input.method || "Cash",
    note: input.note || "",
    sourceType: input.sourceType || "manual",
    sourceFileId: input.sourceFileId || "",
    confidence: Number.isFinite(Number(input.confidence)) ? Number(input.confidence) : 1,
    status: input.status || "saved",
    createdAt: input.createdAt || new Date().toISOString()
  };
}

function sampleTransactions() {
  const thisMonth = monthStart(0);
  const lastMonth = monthStart(-1);
  const twoMonthsAgo = monthStart(-2);
  return [
    { type: "income", category: "Salary", amount: 52000, date: `${thisMonth}-01`, method: "Bank transfer", merchant: "Employer", note: "Monthly salary" },
    { type: "expense", category: "Rent", amount: 14000, date: `${thisMonth}-02`, method: "Bank transfer", merchant: "Landlord", note: "Room rent" },
    { type: "expense", category: "Food", amount: 420, date: `${thisMonth}-05`, method: "UPI", merchant: "Swiggy", note: "Dinner", sourceType: "drive_screenshot", sourceFileId: "drv-swiggy-420" },
    { type: "expense", category: "Transport", amount: 780, date: `${thisMonth}-08`, method: "UPI", merchant: "Uber", note: "Airport ride", sourceType: "cash_text" },
    { type: "expense", category: "Bills", amount: 2400, date: `${thisMonth}-10`, method: "Debit card", merchant: "Airtel", note: "Mobile and fiber", sourceType: "receipt_upload" },
    { type: "income", category: "Freelance", amount: 9000, date: `${thisMonth}-12`, method: "Bank transfer", merchant: "Client", note: "Website changes" },
    { type: "expense", category: "Shopping", amount: 4200, date: `${thisMonth}-15`, method: "Credit card", merchant: "Myntra", note: "Clothes", sourceType: "drive_receipt" },
    { type: "income", category: "Salary", amount: 52000, date: `${lastMonth}-01`, method: "Bank transfer", merchant: "Employer", note: "Monthly salary" },
    { type: "expense", category: "Rent", amount: 14000, date: `${lastMonth}-02`, method: "Bank transfer", merchant: "Landlord", note: "Room rent" },
    { type: "expense", category: "Food", amount: 7400, date: `${lastMonth}-09`, method: "UPI", merchant: "Groceries", note: "Food and groceries" },
    { type: "expense", category: "Entertainment", amount: 2200, date: `${lastMonth}-18`, method: "Debit card", merchant: "PVR", note: "Movies" },
    { type: "income", category: "Salary", amount: 51000, date: `${twoMonthsAgo}-01`, method: "Bank transfer", merchant: "Employer", note: "Monthly salary" },
    { type: "expense", category: "Education", amount: 5200, date: `${twoMonthsAgo}-14`, method: "UPI", merchant: "Course platform", note: "Course fee" }
  ].map(asTx);
}

function loadState() {
  state.settings = { ...state.settings, ...read(keys.settings, {}) };
  const storedTransactions = read(keys.transactions, null);
  state.transactions = Array.isArray(storedTransactions) ? storedTransactions.map(asTx) : sampleTransactions();
  state.queue = read(keys.queue, []);
  state.chat = read(keys.chat, []);
  if (!state.chat.length) {
    state.chat = [{ from: "assistant", text: "Ask me about budget, top spending, merchants, reports, or savings." }];
  }
  persist({ localOnly: true });
}

function selectedType() {
  return document.querySelector('input[name="type"]:checked').value;
}

function categories(type) {
  return type === "income" ? incomeCategories : expenseCategories;
}

function label(value) {
  return String(value).replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function fillSelect(select, values, includeAll = false) {
  select.innerHTML = "";
  if (includeAll) select.append(new Option("All", "all"));
  values.forEach((value) => select.append(new Option(label(value), value)));
}

function updateCategoryInput() {
  const previous = els.categoryInput.value;
  const next = categories(selectedType());
  fillSelect(els.categoryInput, next);
  if (next.includes(previous)) els.categoryInput.value = previous;
}

function setupControls() {
  fillSelect(els.methodInput, paymentMethods);
  fillSelect(els.sourceInput, sourceTypes);
  fillSelect(els.categoryFilter, [...incomeCategories, ...expenseCategories], true);
  fillSelect(els.sourceFilter, sourceTypes, true);
  els.dateInput.value = todayIso();
  els.monthFilter.value = currentMonth();
  els.reportMonth.value = currentMonth();
  els.budgetInput.value = state.settings.budget;
  els.currencyInput.value = state.settings.currency;
  els.profileNameInput.value = state.settings.profileName;
  els.profileEmailInput.value = state.settings.profileEmail;
  els.confidenceInput.value = state.settings.confidenceThreshold;
  els.driveFolderInput.value = state.settings.driveFolderName;
  els.backendUrlInput.value = state.settings.backendUrl || "http://127.0.0.1:8787";
  if (els.serverSyncInput) els.serverSyncInput.checked = state.settings.useServerSync !== false;
  updateCategoryInput();
}

function saved(transactions) {
  return transactions.filter((tx) => tx.status === "saved");
}

function totalsFor(transactions) {
  return saved(transactions).reduce((totals, tx) => {
    totals[tx.type] += Number(tx.amount);
    return totals;
  }, { income: 0, expense: 0 });
}

function monthTransactions(month = currentMonth()) {
  return saved(state.transactions).filter((tx) => tx.date.startsWith(month));
}

function filteredTransactions() {
  const query = els.searchInput.value.trim().toLowerCase();
  return state.transactions
    .filter((tx) => els.typeFilter.value === "all" || tx.type === els.typeFilter.value)
    .filter((tx) => els.categoryFilter.value === "all" || tx.category === els.categoryFilter.value)
    .filter((tx) => els.sourceFilter.value === "all" || tx.sourceType === els.sourceFilter.value)
    .filter((tx) => els.statusFilter.value === "all" || tx.status === els.statusFilter.value)
    .filter((tx) => !els.monthFilter.value || tx.date.startsWith(els.monthFilter.value))
    .filter((tx) => !query || [tx.merchant, tx.category, tx.note, tx.method, tx.sourceType, tx.status].join(" ").toLowerCase().includes(query))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

function expenseByCategory(transactions) {
  return transactions.filter((tx) => tx.type === "expense").reduce((groups, tx) => {
    groups[tx.category] = (groups[tx.category] || 0) + Number(tx.amount);
    return groups;
  }, {});
}

function groupSum(transactions, key) {
  return transactions.reduce((groups, tx) => {
    const value = tx[key] || "Unknown";
    groups[value] = (groups[value] || 0) + Number(tx.amount);
    return groups;
  }, {});
}

function renderSummary() {
  const allTotals = totalsFor(state.transactions);
  const currentTotals = totalsFor(monthTransactions());
  const budgetPercent = state.settings.budget > 0 ? Math.round((currentTotals.expense / state.settings.budget) * 100) : 0;
  const savingsPercent = currentTotals.income > 0 ? Math.round(((currentTotals.income - currentTotals.expense) / currentTotals.income) * 100) : 0;
  const pending = state.transactions.filter((tx) => tx.status === "needs_review" || tx.status === "duplicate").length;
  els.totalIncome.textContent = money(allTotals.income);
  els.totalExpense.textContent = money(allTotals.expense);
  els.balanceAmount.textContent = money(allTotals.income - allTotals.expense);
  els.budgetUsed.textContent = `${budgetPercent}%`;
  els.reviewMetric.textContent = String(pending);
  els.driveMetric.textContent = state.settings.driveConnected ? "On" : "Off";
  els.savingsRate.textContent = `${Math.max(savingsPercent, 0)}% saved`;

  const dashName = document.getElementById("dashProfileName");
  if (dashName) dashName.textContent = state.settings.profileName || "User";
  
  if (els.sidebarProfileName) els.sidebarProfileName.textContent = state.settings.profileName || "User";
  if (els.sidebarProfileEmail) els.sidebarProfileEmail.textContent = state.settings.profileEmail || "user@example.com";

  const dashTotalExpense = document.getElementById("dashTotalExpense");
  if (dashTotalExpense) dashTotalExpense.textContent = money(currentTotals.expense);

  const dashDailyAvg = document.getElementById("dashDailyAvg");
  if (dashDailyAvg) {
    const dayOfMonth = Math.max(1, new Date().getDate());
    dashDailyAvg.textContent = money(currentTotals.expense / dayOfMonth);
  }

  const dashTopCat = document.getElementById("dashTopCat");
  const dashTopCatDesc = document.getElementById("dashTopCatDesc");
  if (dashTopCat && dashTopCatDesc) {
    const cats = Object.entries(expenseByCategory(monthTransactions())).sort((a, b) => b[1] - a[1]);
    if (cats.length > 0) {
      dashTopCat.textContent = cats[0][0];
      const percent = Math.round((cats[0][1] / (currentTotals.expense || 1)) * 100);
      dashTopCatDesc.textContent = `${money(cats[0][1])} - ${percent}% of total`;
    } else {
      dashTopCat.textContent = "None";
      dashTopCatDesc.textContent = "$0 - 0% of total";
    }
  }

  const dashAiScore = document.getElementById("dashAiScore");
  if (dashAiScore) {
    const score = Math.max(0, 100 - budgetPercent);
    dashAiScore.textContent = `${score}/100`;
  }
  
  const sidebarReviewBadge = document.getElementById("sidebarReviewBadge");
  if (sidebarReviewBadge) {
    sidebarReviewBadge.textContent = String(pending);
    sidebarReviewBadge.style.display = pending > 0 ? "inline-block" : "none";
  }
  renderDashboardExtras(currentTotals, pending);
}

function renderDashboardExtras(currentTotals, pending) {
  if (els.dashboardRecentList) {
    const recent = state.transactions
      .filter((tx) => tx.status !== "rejected")
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5);
    els.dashboardRecentList.innerHTML = recent.length ? "" : `<div class="empty-state compact-empty">No transactions yet.</div>`;
    recent.forEach((tx) => {
      const row = document.createElement("div");
      row.className = "dashboard-activity-item";
      row.innerHTML = `
        <span class="activity-icon ${tx.type}">${tx.type === "income" ? "+" : "-"}</span>
        <span class="activity-main"><strong>${escapeHtml(tx.merchant)}</strong><small>${formatDate(tx.date)} · ${label(tx.sourceType)}</small></span>
        <span class="activity-amount ${tx.type}-text">${tx.type === "income" ? "+" : "-"}${money(tx.amount)}</span>`;
      els.dashboardRecentList.append(row);
    });
  }
  if (els.dashboardInsightsList) {
    const cats = Object.entries(expenseByCategory(monthTransactions())).sort((a, b) => b[1] - a[1]);
    const top = cats[0];
    const budgetUsed = state.settings.budget > 0 ? Math.round((currentTotals.expense / state.settings.budget) * 100) : 0;
    const insights = [
      top ? ["trend", `${top[0]} leads spending`, `${money(top[1])} this month across ${top[0].toLowerCase()}.`] : ["trend", "No category signal yet", "Add expenses to unlock category trends."],
      pending ? ["review", `${pending} item${pending === 1 ? "" : "s"} need review`, "Approve AI-detected transactions to keep reports accurate."] : ["review", "Review queue is clear", "All parsed transactions are currently handled."],
      state.settings.budget > 0 ? ["budget", `Budget ${budgetUsed <= 100 ? "on watch" : "exceeded"}`, `${budgetUsed}% of ${money(state.settings.budget)} used this month.`] : ["budget", "Set a monthly budget", "Add a budget in Settings for better forecasting."],
    ];
    els.dashboardInsightsList.innerHTML = "";
    insights.forEach(([tone, title, text]) => {
      const item = document.createElement("div");
      item.className = `dashboard-insight ${tone}`;
      item.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(text)}</span>`;
      els.dashboardInsightsList.append(item);
    });
  }
}

function drawEmpty(ctx, width, height, text) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#090917";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#8d9aaa";
  ctx.font = "700 16px Inter, Segoe UI, Arial";
  ctx.textAlign = "center";
  ctx.fillText(text, width / 2, height / 2);
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawCategoryChart() {
  const canvas = els.categoryChart;
  const ctx = canvas.getContext("2d");
  const data = Object.entries(expenseByCategory(monthTransactions())).sort((a, b) => b[1] - a[1]);
  const total = data.reduce((sum, [, value]) => sum + value, 0);
  els.categoryChartTotal.textContent = money(total);
  els.categoryLegend.innerHTML = "";
  if (!total) return drawEmpty(ctx, canvas.width, canvas.height, "No expenses this month");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bg.addColorStop(0, "#0d0d1c");
  bg.addColorStop(1, "#070713");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = Math.min(canvas.width, canvas.height) * 0.28;
  let startAngle = -Math.PI / 2;
  data.forEach(([category, value], index) => {
    const slice = (value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, startAngle, startAngle + slice);
    ctx.strokeStyle = chartColors[index % chartColors.length];
    ctx.lineWidth = 22;
    ctx.lineCap = "round";
    ctx.stroke();
    startAngle += slice;
    const percent = Math.round((value / total) * 100);
    const item = document.createElement("div");
    item.className = "legend-item";
    item.innerHTML = `<span class="legend-left"><span class="swatch" style="background:${chartColors[index % chartColors.length]}"></span><strong>${escapeHtml(category)}</strong></span><span>${money(value)} <small>${percent}%</small></span>`;
    els.categoryLegend.append(item);
  });
  ctx.beginPath();
  ctx.arc(centerX, centerY, Math.max(radius - 22, 30), 0, Math.PI * 2);
  ctx.fillStyle = "#090917";
  ctx.fill();
  ctx.fillStyle = "#f0f0fa";
  ctx.font = "800 14px Inter, Segoe UI, Arial";
  ctx.textAlign = "center";
  ctx.fillText("Expense", centerX, centerY - 6);
  ctx.fillStyle = "#8d9aaa";
  ctx.font = "700 12px JetBrains Mono, Consolas, monospace";
  ctx.fillText(money(total), centerX, centerY + 17);
}

function monthlyGroups() {
  const months = [];
  for (let offset = -5; offset <= 0; offset += 1) months.push(monthStart(offset));
  return months.map((month) => ({ month, ...totalsFor(state.transactions.filter((tx) => tx.date.startsWith(month))) }));
}

function drawMonthlyChart() {
  const canvas = els.monthlyChart;
  const ctx = canvas.getContext("2d");
  const data = monthlyGroups();
  const budget = Number(state.settings.budget) || 0;
  const maxValue = Math.max(...data.map((item) => Math.max(item.income, item.expense)), budget, 1);
  const width = canvas.width;
  const height = canvas.height;
  const padding = { top: 34, right: 34, bottom: 46, left: 68 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  ctx.clearRect(0, 0, width, height);
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, "#0d0d1c");
  bg.addColorStop(1, "#070713");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
  ctx.font = "700 12px JetBrains Mono, Consolas, monospace";
  ctx.lineWidth = 1;
  ctx.textAlign = "right";
  for (let i = 0; i <= 4; i += 1) {
    const y = padding.top + (chartHeight / 4) * i;
    const value = maxValue - (maxValue / 4) * i;
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.setLineDash([5, 7]);
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#8d9aaa";
    ctx.fillText(shortMoney(value), padding.left - 10, y + 4);
  }
  const xFor = (index) => padding.left + (chartWidth / Math.max(data.length - 1, 1)) * index;
  const yFor = (value) => padding.top + chartHeight - (value / maxValue) * chartHeight;
  if (budget > 0) {
    const y = yFor(budget);
    ctx.strokeStyle = "rgba(196,181,253,0.72)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  const expensePoints = data.map((item, index) => [xFor(index), yFor(item.expense)]);
  const incomePoints = data.map((item, index) => [xFor(index), yFor(item.income)]);
  const area = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
  area.addColorStop(0, "rgba(94,234,212,0.28)");
  area.addColorStop(1, "rgba(94,234,212,0)");
  ctx.beginPath();
  expensePoints.forEach(([x, y], index) => {
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.lineTo(width - padding.right, height - padding.bottom);
  ctx.lineTo(padding.left, height - padding.bottom);
  ctx.closePath();
  ctx.fillStyle = area;
  ctx.fill();
  [
    { points: incomePoints, color: "rgba(52,211,153,0.86)", width: 2 },
    { points: expensePoints, color: "#5eead4", width: 3 },
  ].forEach(({ points, color, width: lineWidth }) => {
    ctx.beginPath();
    points.forEach(([x, y], index) => {
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  });
  expensePoints.forEach(([x, y]) => {
    ctx.fillStyle = "#070713";
    ctx.strokeStyle = "#5eead4";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
  data.forEach((item, index) => {
    ctx.fillStyle = "#8d9aaa";
    ctx.textAlign = "center";
    ctx.fillText(labelMonth(item.month), xFor(index), height - 20);
  });
  ctx.textAlign = "right";
  ctx.font = "700 12px Inter, Segoe UI, Arial";
  ctx.fillStyle = "#5eead4";
  ctx.fillText("Expense", width - padding.right - 74, padding.top - 12);
  ctx.fillStyle = "rgba(196,181,253,0.85)";
  ctx.fillText("Budget", width - padding.right, padding.top - 12);
}

function renderTransactions() {
  const transactions = filteredTransactions();
  els.transactionCount.textContent = `${transactions.length} ${transactions.length === 1 ? "record" : "records"}`;
  els.transactionTable.innerHTML = "";
  if (!transactions.length) {
    els.transactionTable.innerHTML = `<tr><td colspan="9" class="empty-state">No transactions match the current filters.</td></tr>`;
    return;
  }
  transactions.forEach((tx) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${formatDate(tx.date)}</td>
      <td>${escapeHtml(tx.merchant)}</td>
      <td><span class="type-pill ${tx.type}">${capitalize(tx.type)}</span></td>
      <td>${escapeHtml(tx.category)}</td>
      <td>${escapeHtml(tx.method)}</td>
      <td>${label(tx.sourceType)}</td>
      <td><span class="status-pill ${tx.status}">${label(tx.status)}</span></td>
      <td class="amount ${tx.type}-text">${tx.type === "income" ? "+" : "-"}${money(tx.amount)}</td>
      <td><div class="row-actions"><button class="action-button" type="button" title="Edit" data-action="edit" data-id="${tx.id}">ED</button><button class="action-button" type="button" title="Delete" data-action="delete" data-id="${tx.id}">DEL</button></div></td>`;
    els.transactionTable.append(row);
  });
}

function renderQueue() {
  const text = document.getElementById("driveStatusText");
  if (state.settings.driveConnected) {
    els.connectDriveBtn.style.display = "none";
    els.disconnectDriveBtn.style.display = "inline-flex";
    els.scanDriveBtn.disabled = false;
    els.driveStatus.style.display = "inline-flex";
    if (text) text.textContent = `Connected · ${state.settings.profileEmail || 'Active'}`;
  } else {
    els.connectDriveBtn.style.display = "inline-flex";
    els.disconnectDriveBtn.style.display = "none";
    els.scanDriveBtn.disabled = true;
    els.driveStatus.style.display = "none";
    if (text) text.textContent = "Not connected";
  }

  els.queueCount.textContent = `${state.queue.length} ${state.queue.length === 1 ? "file" : "files"} found`;
  els.queueList.innerHTML = state.queue.length ? "" : `<div class="empty-state compact-empty" style="background: transparent; border: 1px dashed var(--glass-border);">No queued files.</div>`;
  state.queue.slice().reverse().forEach((item) => {
    const node = document.createElement("div");
    node.className = "queue-item";
    node.style = "display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--glass-border);";
    node.innerHTML = `<div style="display: flex; gap: 12px; align-items: center;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--text-muted);"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg> <strong style="font-weight: 500;">${escapeHtml(item.name)}</strong></div>
    <div style="font-size: 0.85rem; color: var(--text-muted); display: flex; gap: 12px; align-items: center;">${new Date(item.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} <span class="status-pill ${item.status}">${label(item.status)}</span></div>`;
    els.queueList.append(node);
  });
}

function renderReview() {
  const items = state.transactions.filter((tx) => tx.status === "needs_review" || tx.status === "duplicate").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  els.reviewCount.textContent = `${items.length} ${items.length === 1 ? "item" : "items"}`;
  els.reviewList.innerHTML = items.length ? "" : `<div class="empty-state">No pending review items.</div>`;
  items.forEach((tx) => {
    const dupes = duplicatesFor(tx).filter((candidate) => candidate.id !== tx.id && candidate.status === "saved");
    const ai = tx.aiAnalysis;
    const aiHtml =
      ai && (ai.insights || (ai.suggestions && ai.suggestions.length))
        ? `<div class="review-ai"><p class="review-ai-head">AI insights</p><p class="review-ai-text">${escapeHtml(ai.insights || "")}</p>${
            ai.suggestions?.length
              ? `<ul class="review-ai-list">${ai.suggestions.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>`
              : ""
          }</div>`
        : "";
    const card = document.createElement("article");
    card.className = "review-card";
    card.innerHTML = `
      <div class="review-main">
        <div>
          <span class="status-pill ${tx.status}">${label(tx.status)}</span>
          <h3>${escapeHtml(tx.merchant)} | ${money(tx.amount)}</h3>
          <p>${formatDate(tx.date)} | ${escapeHtml(tx.category)} | ${escapeHtml(tx.method)} | ${label(tx.sourceType)}</p>
          <p>Confidence ${Math.round(tx.confidence * 100)}%${dupes.length ? ` | Possible duplicate: ${escapeHtml(dupes[0].merchant)} ${money(dupes[0].amount)}` : ""}</p>
          ${aiHtml}
        </div>
        <div class="review-actions">
          <button class="secondary-button" data-review="approve" data-id="${tx.id}" type="button">Approve</button>
          <button class="ghost-button" data-review="edit" data-id="${tx.id}" type="button">Edit</button>
          <button class="ghost-button" data-review="keep" data-id="${tx.id}" type="button">Keep both</button>
          <button class="danger-button" data-review="reject" data-id="${tx.id}" type="button">Reject</button>
        </div>
      </div>`;
    els.reviewList.append(card);
  });
}

function renderReports() {
  const month = els.reportMonth.value || currentMonth();
  const transactions = monthTransactions(month);
  const totals = totalsFor(transactions);
  const groups = Object.entries(expenseByCategory(transactions)).sort((a, b) => b[1] - a[1]);
  els.monthReport.innerHTML = "";
  [["Income", money(totals.income)], ["Expense", money(totals.expense)], ["Balance", money(totals.income - totals.expense)], ["Largest category", groups[0] ? `${groups[0][0]} (${money(groups[0][1])})` : "None"]].forEach(([name, value]) => {
    const item = document.createElement("div");
    item.className = "report-item";
    item.innerHTML = `<strong>${name}</strong><span>${value}</span>`;
    els.monthReport.append(item);
  });
  els.reportTotal.textContent = money(totals.expense);
  els.breakdownList.innerHTML = groups.length ? "" : `<div class="empty-state compact-empty">No expenses found for this month.</div>`;
  groups.forEach(([category, value], index) => {
    const percent = totals.expense ? Math.round((value / totals.expense) * 100) : 0;
    const item = document.createElement("div");
    item.className = "breakdown-item";
    item.innerHTML = `<span class="breakdown-left"><span class="swatch" style="background:${chartColors[index % chartColors.length]}"></span><strong>${escapeHtml(category)}</strong></span><span class="progress-track"><span class="progress-bar" style="width:${percent}%"></span></span><span class="breakdown-value"><strong>${money(value)}</strong><small>${percent}%</small></span>`;
    els.breakdownList.append(item);
  });
  renderInsights(transactions);
}

function renderInsights(transactions) {
  const expenses = transactions.filter((tx) => tx.type === "expense");
  const blocks = [
    ["Top merchants", Object.entries(groupSum(expenses, "merchant")).sort((a, b) => b[1] - a[1]).slice(0, 5)],
    ["Source types", Object.entries(groupSum(expenses, "sourceType")).sort((a, b) => b[1] - a[1]).map(([k, v]) => [label(k), v])],
    ["Payment modes", Object.entries(groupSum(expenses, "method")).sort((a, b) => b[1] - a[1])]
  ];
  els.insightTotal.textContent = `${transactions.length} records`;
  els.insightGrid.innerHTML = "";
  blocks.forEach(([title, rows]) => {
    const panel = document.createElement("div");
    panel.className = "mini-report";
    panel.innerHTML = `<h3>${title}</h3>${rows.length ? rows.map(([k, v]) => `<div><span>${escapeHtml(k)}</span><strong>${money(v)}</strong></div>`).join("") : "<p>No data</p>"}`;
    els.insightGrid.append(panel);
  });
}

function renderChat() {
  els.chatLog.innerHTML = "";
  state.chat.slice(-12).forEach((message) => {
    const node = document.createElement("div");
    node.className = `chat-message ${message.from}`;
    node.textContent = message.text;
    els.chatLog.append(node);
  });
  els.chatLog.scrollTop = els.chatLog.scrollHeight;
}

function renderSettings() {
  const profile = state.settings.googleConnected ? "Google connected" : "Local profile";
  els.profileStatus.textContent = state.settings.aiBackendConnected ? `${profile} | AI ready` : profile;
  if (els.googleLoginBtn) els.googleLoginBtn.textContent = state.settings.googleConnected ? "Sign out of Google" : "Sign in with Google";
  if (els.googleLogoutBtn) els.googleLogoutBtn.textContent = "Sign out of Google";
}

function renderAll() {
  renderSummary();
  renderTransactions();
  renderQueue();
  renderReview();
  renderReports();
  renderChat();
  renderSettings();
  drawCategoryChart();
  drawMonthlyChart();
  updateAppVisibility();
}

function updateAppVisibility() {
  const appContent = document.getElementById("appContent");
  const loginScreen = document.getElementById("loginScreen");
  if (!appContent || !loginScreen) return;
  
  if (state.settings.googleConnected || state.settings.localAuthenticated) {
    appContent.classList.remove("hidden");
    loginScreen.classList.add("hidden");
  } else {
    appContent.classList.add("hidden");
    loginScreen.classList.remove("hidden");
  }
}

let isSignUp = false;
function toggleAuthMode(e) {
  e.preventDefault();
  isSignUp = !isSignUp;
  if (isSignUp) {
    els.authTitle.textContent = "Create an account";
    els.authSubtitle.textContent = "Sign up to start tracking your expenses";
    els.authSubmitBtn.textContent = "Sign up";
    els.switchAuthMode.textContent = "Sign in";
    els.switchAuthMode.parentElement.firstChild.textContent = "Already have an account? ";
  } else {
    els.authTitle.textContent = "Welcome back";
    els.authSubtitle.textContent = "Sign in to your financial intelligence dashboard";
    els.authSubmitBtn.textContent = "Sign in";
    els.switchAuthMode.textContent = "Sign up free";
    els.switchAuthMode.parentElement.firstChild.textContent = "Don't have an account? ";
  }
}

function handleLocalAuth(e) {
  e.preventDefault();
  state.settings.localAuthenticated = true;
  persist();
  updateAppVisibility();
  toast(isSignUp ? "Account created successfully." : "Signed in successfully.");
  switchView("overview");
}

function upsert(tx) {
  const index = state.transactions.findIndex((item) => item.id === tx.id);
  if (index >= 0) state.transactions[index] = tx;
  else state.transactions.push(tx);
  persist();
}

function resetForm() {
  els.transactionForm.reset();
  els.editingId.value = "";
  els.formTitle.textContent = "Add transaction";
  els.cancelEditBtn.classList.add("hidden");
  els.dateInput.value = todayIso();
  document.querySelector('input[name="type"][value="expense"]').checked = true;
  updateCategoryInput();
  els.sourceInput.value = "manual";
  els.methodInput.value = "Cash";
  els.duplicateWarning.classList.add("hidden");
}

function formTransaction() {
  let preserveAi = null;
  const editId = els.editingId.value;
  if (editId) {
    const existing = state.transactions.find((t) => t.id === editId);
    if (existing?.aiAnalysis) preserveAi = existing.aiAnalysis;
  }
  const tx = asTx({
    id: editId || id("tx"),
    type: selectedType(),
    amount: Number(els.amountInput.value),
    date: els.dateInput.value,
    merchant: els.merchantInput.value.trim() || "Unknown",
    category: els.categoryInput.value,
    method: els.methodInput.value,
    sourceType: els.sourceInput.value,
    note: els.noteInput.value.trim(),
    confidence: 1,
    status: "saved"
  });
  if (preserveAi) tx.aiAnalysis = preserveAi;
  return tx;
}

async function saveTransaction(event) {
  event.preventDefault();
  const wasEditing = Boolean(els.editingId.value);
  const tx = formTransaction();
  if (!Number.isFinite(tx.amount) || tx.amount <= 0) return toast("Enter a valid amount.");
  if (!els.editingId.value && duplicatesFor(tx).some((item) => item.status === "saved")) {
    tx.status = "duplicate";
    tx.confidence = 0.74;
    toast("Possible duplicate sent to review.");
  } else {
    toast(els.editingId.value ? "Transaction updated." : "Transaction saved.");
  }
  upsert(tx);
  resetForm();
  renderAll();
  if (wasEditing) await notifyLedgerCorrection(tx);
}

function editTransaction(txId) {
  const tx = state.transactions.find((item) => item.id === txId);
  if (!tx) return;
  els.editingId.value = tx.id;
  document.querySelector(`input[name="type"][value="${tx.type}"]`).checked = true;
  updateCategoryInput();
  els.amountInput.value = tx.amount;
  els.dateInput.value = tx.date;
  els.merchantInput.value = tx.merchant;
  els.categoryInput.value = tx.category;
  els.methodInput.value = tx.method;
  els.sourceInput.value = tx.sourceType;
  els.noteInput.value = tx.note;
  els.formTitle.textContent = "Edit transaction";
  els.cancelEditBtn.classList.remove("hidden");
  switchView("overview");
  els.amountInput.focus();
}

function deleteTransaction(txId) {
  const tx = state.transactions.find((item) => item.id === txId);
  if (!tx || !window.confirm(`Delete ${tx.merchant} transaction of ${money(tx.amount)}?`)) return;
  state.transactions = state.transactions.filter((item) => item.id !== txId);
  persist();
  renderAll();
  toast("Transaction deleted.");
}

function duplicatesFor(tx) {
  const merchant = normalize(tx.merchant);
  return state.transactions.filter((item) => {
    if (item.id === tx.id || item.status === "ignored") return false;
    const sameFile = tx.sourceFileId && item.sourceFileId === tx.sourceFileId;
    const sameCore = Math.abs(Number(item.amount) - Number(tx.amount)) <= 1 && item.date === tx.date && normalize(item.merchant) === merchant;
    return sameFile || sameCore;
  });
}

function parseEntry(text, sourceType = "cash_text") {
  const clean = text.trim();
  const lower = clean.toLowerCase();
  const amountMatch = clean.match(/(?:inr|rs\.?)?\s*([0-9]+(?:\.[0-9]{1,2})?)/i);
  const type = lower.includes("salary") || lower.includes("received") || lower.includes("income") || lower.includes("refund") ? "income" : "expense";
  const category = inferCategory(lower, type);
  const merchant = inferMerchant(clean, category, type);
  const method = paymentMethods.find((item) => lower.includes(item.toLowerCase().split(" ")[0])) || (lower.includes("gpay") || lower.includes("paytm") || lower.includes("phonepe") ? "UPI" : "Cash");
  const confidence = amountMatch ? (merchant === "Unknown" ? 0.78 : 0.9) : 0.52;
  return asTx({
    type,
    amount: amountMatch ? Number(amountMatch[1]) : 0,
    date: inferDate(lower),
    merchant,
    category,
    method,
    sourceType,
    note: clean,
    confidence,
    status: confidence >= state.settings.confidenceThreshold ? "saved" : "needs_review"
  });
}

function inferCategory(lower, type) {
  if (type === "income") {
    if (lower.includes("salary")) return "Salary";
    if (lower.includes("freelance") || lower.includes("client")) return "Freelance";
    if (lower.includes("refund")) return "Refund";
    return "Other income";
  }
  const checks = [
    ["Food", ["food", "swiggy", "zomato", "restaurant", "lunch", "dinner", "grocery"]],
    ["Transport", ["uber", "ola", "metro", "cab", "fuel", "bus", "train"]],
    ["Rent", ["rent", "landlord"]],
    ["Shopping", ["amazon", "flipkart", "myntra", "shopping", "clothes"]],
    ["Bills", ["bill", "electricity", "airtel", "jio", "internet", "mobile"]],
    ["Health", ["doctor", "medicine", "pharmacy", "hospital"]],
    ["Education", ["course", "book", "tuition"]],
    ["Entertainment", ["movie", "pvr", "netflix", "spotify"]],
    ["Travel", ["hotel", "flight", "airport"]],
    ["Subscription", ["subscription", "saas", "prime"]]
  ];
  const match = checks.find(([, words]) => words.some((word) => lower.includes(word)));
  return match ? match[0] : "Other expense";
}

function inferMerchant(text, category, type) {
  const known = ["Swiggy", "Zomato", "Uber", "Ola", "Amazon", "Flipkart", "Myntra", "Airtel", "Jio", "PVR", "Netflix", "Spotify", "Paytm", "GPay", "PhonePe"];
  const found = known.find((name) => text.toLowerCase().includes(name.toLowerCase()));
  if (found) return found;
  const toMatch = text.match(/\bto\s+([A-Za-z][A-Za-z0-9 &.-]{2,30})/i);
  if (toMatch) return toMatch[1].replace(/\s+(by|for|on|using).*$/i, "").trim();
  if (type === "income") return category === "Salary" ? "Employer" : "Income source";
  return "Unknown";
}

function inferDate(lower) {
  if (lower.includes("yesterday")) {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }
  const iso = lower.match(/(20\d{2})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  return todayIso();
}

function backendBaseUrl() {
  return (state.settings.backendUrl || "http://127.0.0.1:8787").replace(/\/+$/, "");
}

async function backendGet(path) {
  const response = await fetch(`${backendBaseUrl()}${path}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Backend returned ${response.status}`);
  }
  return data;
}

async function backendPost(path, payload) {
  const response = await fetch(`${backendBaseUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `AI backend returned ${response.status}`);
  }
  return data;
}

async function checkBackend() {
  try {
    const response = await fetch(`${backendBaseUrl()}/api/health`);
    const data = await response.json();
    state.settings.aiBackendConnected = Boolean(data.ok && data.keyConfigured);
    persist();
    renderSettings();
    toast(data.keyConfigured ? `AI backend ready: ${data.model}` : "AI backend is running, but the API key is missing.");
  } catch (error) {
    state.settings.aiBackendConnected = false;
    persist();
    renderSettings();
    toast("AI backend is not running.");
  }
}

async function refreshDriveStatus() {
  try {
    const status = await backendGet("/api/drive/status");
    state.settings.driveConnected = Boolean(status.connected);
    if (status.folderName) state.settings.driveFolderName = status.folderName;
    persist();
    renderAll();
    return status;
  } catch {
    state.settings.driveConnected = false;
    renderAll();
    return null;
  }
}

async function refreshAuthStatus() {
  try {
    const status = await backendGet("/api/auth/status");
    state.settings.googleConnected = Boolean(status.authenticated);
    if (status.profile) {
      state.settings.profileName = status.profile.name || state.settings.profileName;
      state.settings.profileEmail = status.profile.email || state.settings.profileEmail;
    }
    persist();
    renderAll();
    return status;
  } catch {
    state.settings.googleConnected = false;
    renderAll();
    return null;
  }
}

function normalizeBackendTx(raw, sourceType, fallbackNote) {
  const txType = raw?.type === "income" ? "income" : "expense";
  const validCategories = categories(txType);
  const category = validCategories.includes(raw?.category) ? raw.category : validCategories[validCategories.length - 1];
  const method = paymentMethods.includes(raw?.method) ? raw.method : "Cash";
  const confidence = Number.isFinite(Number(raw?.confidence)) ? Number(raw.confidence) : 0.75;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw?.date || "") ? raw.date : todayIso();
  return asTx({
    id: raw?.id,
    type: txType,
    amount: Number(raw?.amount) || 0,
    currency: raw?.currency || state.settings.currency,
    date,
    merchant: raw?.merchant || "Unknown",
    category,
    method,
    note: raw?.note || fallbackNote,
    sourceType,
    confidence,
    status: confidence >= state.settings.confidenceThreshold ? "saved" : "needs_review"
  });
}

/** Normalizes the strict `{ category, total, insights, suggestions[] }` analysis envelope from `/api/parse-*`. */
function normalizeAnalysis(envelope) {
  if (!envelope || typeof envelope !== "object") return null;
  const suggestions = Array.isArray(envelope.suggestions)
    ? envelope.suggestions.map((s) => String(s).trim()).filter(Boolean).slice(0, 8)
    : [];
  return {
    category: String(envelope.category || ""),
    total: String(envelope.total || ""),
    insights: String(envelope.insights || ""),
    suggestions
  };
}

function attachAiAnalysis(tx, envelope) {
  const a = normalizeAnalysis(envelope);
  if (a) tx.aiAnalysis = a;
  return tx;
}

async function notifyLedgerCorrection(tx) {
  if (!tx?.id) return;
  try {
    await backendPost("/api/transaction/correct", {
      id: tx.id,
      transaction: tx,
      analysis: tx.aiAnalysis || {}
    });
  } catch (err) {
    console.warn("Ledger correction sync skipped.", err);
  }
}

async function parseSmartText(text, sourceType) {
  try {
    const data = await backendPost("/api/parse-text", {
      text,
      currency: state.settings.currency,
      today: todayIso()
    });
    return attachAiAnalysis(normalizeBackendTx(data.transaction, sourceType, text), data.analysis);
  } catch (error) {
    console.warn("AI text parser unavailable; using local parser.", error);
    return parseEntry(text, sourceType);
  }
}

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function fileToDataUrlMaybeCompress(file) {
  if (!file.type.startsWith("image/") || file.size < 1_400_000) {
    return fileToDataUrl(file);
  }
  try {
    const bitmap = await createImageBitmap(file);
    const maxW = 2048;
    let w = bitmap.width;
    let h = bitmap.height;
    if (w > maxW) {
      h = Math.round((h * maxW) / w);
      w = maxW;
    }
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return fileToDataUrl(file);
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    return canvas.toDataURL("image/jpeg", 0.88);
  } catch {
    return fileToDataUrl(file);
  }
}

async function parseSmartImage(file, textHint) {
  try {
    const mimeType = file.type || "";
    if (mimeType === "application/pdf") {
      const dataUrl = await fileToDataUrl(file);
      const data = await backendPost("/api/parse-image", {
        filename: file.name,
        mimeType,
        dataUrl,
        textHint,
        currency: state.settings.currency,
        today: todayIso()
      });
      return attachAiAnalysis(normalizeBackendTx(data.transaction, "receipt_upload", textHint || file.name), data.analysis);
    }
    if (mimeType.startsWith("image/")) {
      const dataUrl = await fileToDataUrlMaybeCompress(file);
      const data = await backendPost("/api/parse-image", {
        filename: file.name,
        mimeType,
        dataUrl,
        textHint,
        currency: state.settings.currency,
        today: todayIso()
      });
      return attachAiAnalysis(normalizeBackendTx(data.transaction, "receipt_upload", textHint || file.name), data.analysis);
    }
    const data = await backendPost("/api/parse-text", {
      text: `Filename: ${file.name}\nVisible text hint: ${textHint}`,
      currency: state.settings.currency,
      today: todayIso()
    });
    return attachAiAnalysis(normalizeBackendTx(data.transaction, "receipt_upload", textHint || file.name), data.analysis);
  } catch (error) {
    console.warn("AI image parser unavailable; using local parser.", error);
    return parseEntry(textHint || file.name.replace(/[_.-]/g, " "), "receipt_upload");
  }
}

function createReview(tx, queueItem) {
  if (duplicatesFor(tx).some((candidate) => candidate.status === "saved")) tx.status = "duplicate";
  if (tx.status === "saved" && tx.sourceType !== "cash_text") tx.status = "needs_review";
  if (queueItem) {
    queueItem.status = tx.status;
    queueItem.transactionId = tx.id;
  }
  upsert(tx);
}

async function handleQuickEntry(event) {
  event.preventDefault();
  const text = els.quickEntryText.value.trim();
  if (!text) return toast("Add entry text first.");
  const tx = await parseSmartText(text, "cash_text");
  createReview(tx);
  els.quickEntryText.value = "";
  renderAll();
  toast(tx.status === "saved" ? "Text entry saved." : "Text entry sent to review.");
}

async function handleUpload(e) {
  e.preventDefault();
  const files = els.uploadInput.files;
  if (!files || files.length === 0) return;
  const textHint = els.uploadText.value.trim();
  
  els.uploadForm.querySelector('button[type="submit"]').disabled = true;
  let added = 0;
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const parsed = await processUploadFile(file, textHint);
      if (parsed) {
        state.transactions.unshift(parsed);
        added++;
      }
    } catch (err) {
      console.error(err);
    }
  }
  
  persist();
  resetForm();
  renderAll();
  switchView("review");
  toast(`${added} item(s) pushed to AI Review.`);
}

async function processUploadFile(file, textHint) {
  if (file.size > MAX_UPLOAD_BYTES) {
    return toast("File is too large (max 12 MB). Try a smaller photo or export a JPEG.");
  }
  const submitBtn = els.uploadForm.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.dataset.originalText = submitBtn.textContent;
    submitBtn.textContent = "Uploading...";
  }
  try {
    const queueItem = { id: id("file"), name: file.name, sourceType: file.type === "application/pdf" ? "drive_receipt" : "receipt_upload", status: "processing", createdAt: new Date().toISOString() };
    state.queue.push(queueItem);
    const tx = await parseSmartImage(file, textHint);
    tx.sourceFileId = queueItem.id;
    tx.confidence = Math.min(tx.confidence, textHint ? 0.9 : 0.78);
    tx.status = "needs_review";
    createReview(tx, queueItem);
    return tx;
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = submitBtn.dataset.originalText;
    }
  }
}

async function connectDrive() {
  state.settings.driveFolderName = els.driveFolderInput.value.trim() || state.settings.driveFolderName;
  persist();
  try {
    const data = await backendGet("/api/drive/auth-url");
    const popup = window.open(data.authUrl, "_blank", "width=600,height=700");
    if (!popup) return toast("Allow popups to connect Google Drive.");
    toast("Drive authorization opened. Complete sign-in in the new window.");
  } catch (error) {
    toast(error.message || "Unable to start Google Drive authorization.");
  }
}

async function disconnectDrive() {
  try {
    await backendGet("/api/drive/disconnect");
  } catch {
    // ignore errors; still disconnect locally
  }
  state.settings.driveConnected = false;
  persist();
  renderAll();
  toast("Drive disconnected.");
}

async function scanDrive() {
  const folderName = els.driveFolderInput.value.trim() || state.settings.driveFolderName;
  
  if (state.settings.driveConnected) {
    els.scanDriveBtn.disabled = true;
    const originalText = els.scanDriveBtn.textContent;
    els.scanDriveBtn.textContent = "Scanning...";
    try {
      const data = await backendPost("/api/drive/scan", {
        folderName,
        currency: state.settings.currency,
        today: todayIso()
      });
      const files = Array.isArray(data.files) ? data.files : [];
      files.forEach((item) => {
        const queueItem = {
          id: id("drv"),
          name: item.name,
          sourceType: "drive_screenshot",
          status: "processing",
          createdAt: new Date().toISOString(),
          driveFileId: item.fileId
        };
        state.queue.push(queueItem);
        const tx = attachAiAnalysis(normalizeBackendTx(item.transaction, "drive_screenshot", item.name), item.analysis);
        tx.sourceFileId = queueItem.id;
        tx.driveFileId = item.fileId;
        createReview(tx, queueItem);
      });
      persist();
      renderAll();
      toast(files.length ? `Imported ${files.length} file(s) from Drive.` : "No new Drive files found.");
    } catch (error) {
      toast(error.message || "Drive scan failed.");
    } finally {
      els.scanDriveBtn.disabled = false;
      els.scanDriveBtn.textContent = originalText;
    }
    return;
  }
  toast("Connect Drive first.");
}

function reviewAction(action, txId) {
  const tx = state.transactions.find((item) => item.id === txId);
  if (!tx) return;
  if (action === "edit") return editTransaction(txId);
  if (action === "reject") {
    tx.status = "ignored";
    toast("Review item ignored.");
  } else {
    tx.status = "saved";
    tx.confidence = Math.max(tx.confidence, 0.9);
    toast(action === "keep" ? "Kept as a separate transaction." : "Review item approved.");
    notifyLedgerCorrection(tx);
  }
  persist();
  renderAll();
}

async function askAssistant(event) {
  event.preventDefault();
  const question = els.assistantInput.value.trim();
  if (!question) return;
  state.chat.push({ from: "user", text: question });
  
  els.assistantInput.disabled = true;
  const submitBtn = els.assistantForm.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.dataset.originalText = submitBtn.textContent;
    submitBtn.textContent = "...";
  }

  let reply = "";
  try {
    const data = await backendPost("/api/assistant", {
      question,
      transactions: saved(state.transactions),
      settings: {
        budget: state.settings.budget,
        currency: state.settings.currency
      }
    });
    reply = data.answer || answer(question);
  } catch (error) {
    console.warn("AI assistant unavailable; using local assistant.", error);
    reply = answer(question);
  } finally {
    els.assistantInput.disabled = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = submitBtn.dataset.originalText;
    }
  }
  
  state.chat.push({ from: "assistant", text: reply });
  els.assistantInput.value = "";
  persist();
  renderChat();
}

function answer(question) {
  const q = question.toLowerCase();
  const transactions = monthTransactions();
  const totals = totalsFor(transactions);
  const expenses = transactions.filter((tx) => tx.type === "expense");
  const categories = Object.entries(expenseByCategory(transactions)).sort((a, b) => b[1] - a[1]);
  const merchants = Object.entries(groupSum(expenses, "merchant")).sort((a, b) => b[1] - a[1]);
  const budgetLeft = state.settings.budget - totals.expense;
  if (q.includes("budget")) return budgetLeft >= 0 ? `You have ${money(budgetLeft)} left from this month's budget.` : `You are ${money(Math.abs(budgetLeft))} over this month's budget.`;
  if (q.includes("top") || q.includes("category")) return categories[0] ? `Your top category this month is ${categories[0][0]} at ${money(categories[0][1])}.` : "No expense categories for this month yet.";
  if (q.includes("merchant") || q.includes("where")) return merchants[0] ? `Your top merchant this month is ${merchants[0][0]} at ${money(merchants[0][1])}.` : "No merchant spending for this month yet.";
  if (q.includes("saving") || q.includes("save")) {
    const savings = totals.income - totals.expense;
    const rate = totals.income ? Math.round((savings / totals.income) * 100) : 0;
    return `This month you saved ${money(savings)} (${Math.max(rate, 0)}% of income).`;
  }
  if (q.includes("duplicate") || q.includes("review")) {
    const pending = state.transactions.filter((tx) => tx.status === "needs_review" || tx.status === "duplicate").length;
    return `${pending} item${pending === 1 ? "" : "s"} need review.`;
  }
  return `This month: income ${money(totals.income)}, expense ${money(totals.expense)}, balance ${money(totals.income - totals.expense)}.`;
}

function saveSettings() {
  const budget = Number(els.budgetInput.value);
  const threshold = Number(els.confidenceInput.value);
  state.settings.profileName = els.profileNameInput.value.trim();
  state.settings.profileEmail = els.profileEmailInput.value.trim();
  state.settings.budget = Number.isFinite(budget) && budget >= 0 ? budget : 0;
  state.settings.currency = els.currencyInput.value;
  state.settings.confidenceThreshold = Number.isFinite(threshold) ? Math.min(1, Math.max(0, threshold)) : 0.85;
  state.settings.backendUrl = els.backendUrlInput.value.trim() || "http://127.0.0.1:8787";
  if (els.serverSyncInput) state.settings.useServerSync = els.serverSyncInput.checked;
  persist();
  renderAll();
  toast("Settings saved.");
}

function toggleGoogle() {
  if (state.settings.googleConnected) {
    // Logout
    backendGet("/api/auth/logout").then(() => {
      state.settings.googleConnected = false;
      persist();
      renderAll();
      toast("Google account disconnected.");
    }).catch(() => {
      toast("Logout failed.");
    });
  } else {
    // Login
    backendGet("/api/auth/login-url").then((data) => {
      const popup = window.open(data.loginUrl, "_blank", "width=600,height=700");
      if (!popup) return toast("Allow popups to sign in with Google.");
      toast("Google sign-in opened. Complete authentication in the new window.");
    }).catch((error) => {
      toast(error.message || "Unable to start Google sign-in.");
    });
  }
}

function loadSampleData() {
  state.transactions = sampleTransactions();
  state.queue = [];
  persist();
  resetForm();
  renderAll();
  toast("Sample data loaded.");
}

function clearData() {
  if (!window.confirm("Clear all AutoSpend data from this browser?")) return;
  state.transactions = [];
  state.queue = [];
  state.chat = [{ from: "assistant", text: "Your local data is clear. Add transactions or scan Drive to begin." }];
  persist();
  resetForm();
  renderAll();
  toast("All local data cleared.");
}

function exportCsv() {
  const header = ["Date", "Type", "Merchant", "Category", "Method", "Source", "Status", "Confidence", "Note", "Amount"];
  const rows = filteredTransactions().map((tx) => [tx.date, tx.type, tx.merchant, tx.category, tx.method, tx.sourceType, tx.status, tx.confidence, tx.note, tx.amount]);
  download(`autospend-report-${todayIso()}.csv`, [header, ...rows].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n"), "text/csv;charset=utf-8");
  toast("CSV exported.");
}

function exportJson() {
  download(`autospend-backup-${todayIso()}.json`, JSON.stringify({ settings: state.settings, transactions: state.transactions, queue: state.queue }, null, 2), "application/json;charset=utf-8");
  toast("JSON exported.");
}

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function switchView(viewName) {
  els.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.view === viewName));
  els.views.forEach((view) => view.classList.toggle("active", view.id === `${viewName}View`));
}

function wireEvents() {
  els.tabs.forEach((tab) => tab.addEventListener("click", () => switchView(tab.dataset.view)));
  document.querySelectorAll('input[name="type"]').forEach((input) => input.addEventListener("change", updateCategoryInput));
  els.transactionForm.addEventListener("submit", saveTransaction);
  window.addEventListener("message", (event) => {
    const origin = backendOrigin();
    if (origin && event.origin !== origin) return;
    if (event?.data?.type !== "autospend-drive-auth" && event?.data?.type !== "autospend-user-auth") return;
    if (event.data.status === "success") {
      if (event.data.type === "autospend-drive-auth") {
        toast("Google Drive authorization completed.");
        refreshDriveStatus().then(renderAll);
      } else {
        toast("Google sign-in completed.");
        refreshAuthStatus().then(renderAll).then(() => switchView("overview"));
      }
    } else {
      toast(event.data.message || "Authorization failed.");
    }
  });
  els.cancelEditBtn.addEventListener("click", resetForm);
  els.quickEntryForm.addEventListener("submit", handleQuickEntry);
  els.uploadForm.addEventListener("submit", handleUpload);
  els.connectDriveBtn.addEventListener("click", connectDrive);
  els.disconnectDriveBtn.addEventListener("click", disconnectDrive);
  els.scanDriveBtn.addEventListener("click", scanDrive);
  els.assistantForm.addEventListener("submit", askAssistant);
  els.saveSettingsBtn.addEventListener("click", saveSettings);
  els.checkBackendBtn.addEventListener("click", checkBackend);
  if (els.googleLoginBtn) els.googleLoginBtn.addEventListener("click", toggleGoogle);
  if (els.googleLogoutBtn) els.googleLogoutBtn.addEventListener("click", () => {
    if (state.settings.googleConnected) {
      toggleGoogle();
    } else {
      state.settings.localAuthenticated = false;
      persist();
      renderAll();
      toast("Signed out successfully.");
    }
  });
  if (els.localAuthForm) els.localAuthForm.addEventListener("submit", handleLocalAuth);
  if (els.switchAuthMode) els.switchAuthMode.addEventListener("click", toggleAuthMode);
  els.loadSampleBtn.addEventListener("click", loadSampleData);
  els.clearDataBtn.addEventListener("click", clearData);
  els.exportCsvBtn.addEventListener("click", exportCsv);
  els.exportJsonBtn.addEventListener("click", exportJson);
  if (els.sidebarCollapseBtn) {
    els.sidebarCollapseBtn.addEventListener("click", () => {
      document.body.classList.toggle("sidebar-collapsed");
    });
  }
  if (els.sidebarLogoutBtn) {
    els.sidebarLogoutBtn.addEventListener("click", () => {
      if (state.settings.googleConnected) {
        toggleGoogle();
      } else {
        state.settings.localAuthenticated = false;
        persist();
        renderAll();
        toast("Signed out successfully.");
      }
    });
  }
  els.reportMonth.addEventListener("change", renderReports);
  [els.searchInput, els.typeFilter, els.categoryFilter, els.monthFilter, els.sourceFilter, els.statusFilter].forEach((input) => {
    input.addEventListener("input", renderTransactions);
    input.addEventListener("change", renderTransactions);
  });
  els.transactionTable.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    if (button.dataset.action === "edit") editTransaction(button.dataset.id);
    if (button.dataset.action === "delete") deleteTransaction(button.dataset.id);
  });
  els.reviewList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-review]");
    if (button) reviewAction(button.dataset.review, button.dataset.id);
  });
}

function formatDate(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function shortMoney(amount) {
  if (amount >= 100000) return `${Math.round(amount / 100000)}L`;
  if (amount >= 1000) return `${Math.round(amount / 1000)}K`;
  return String(Math.round(amount));
}

function labelMonth(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year, monthNumber - 1).toLocaleDateString("en-IN", { month: "short" });
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function normalize(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function handleLocalAuth(e) {
  e.preventDefault();
  const email = document.getElementById("authEmail").value;
  const password = document.getElementById("authPassword").value;
  if (!email || !password) return toast("Please enter both email and password.");
  
  state.settings.localAuthenticated = true;
  state.settings.profileEmail = email;
  state.settings.profileName = email.split("@")[0];
  persist();
  renderAll();
  switchView("overview");
  toast("Signed in successfully.");
}

function toggleAuthMode(e) {
  e.preventDefault();
  const isSignUp = els.authSubmitBtn.textContent === "Sign in";
  els.authTitle.textContent = isSignUp ? "Create an account" : "Welcome back";
  els.authSubtitle.textContent = isSignUp ? "Sign up to start your financial intelligence dashboard" : "Sign in to your financial intelligence dashboard";
  els.authSubmitBtn.textContent = isSignUp ? "Sign up" : "Sign in";
  els.switchAuthMode.textContent = isSignUp ? "Sign in instead" : "Sign up free";
  els.switchAuthMode.parentElement.firstChild.textContent = isSignUp ? "Already have an account? " : "Don't have an account? ";
}

async function initializeApp() {
  loadState();
  setupControls();
  wireEvents();
  await Promise.all([pullServerData(), refreshDriveStatus(), refreshAuthStatus()]);
  setupControls();
  renderAll();
  switchView("overview");
}

initializeApp();
