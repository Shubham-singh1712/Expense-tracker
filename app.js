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
    googleConnected: false,
    driveConnected: false,
    driveFolderName: "Expense Screenshots",
    driveFolderId: "",
    backendUrl: "http://127.0.0.1:8787",
    aiBackendConnected: false,
    confidenceThreshold: 0.85
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
  googleLoginBtn: $("googleLoginBtn"),
  saveSettingsBtn: $("saveSettingsBtn"),
  loadSampleBtn: $("loadSampleBtn"),
  clearDataBtn: $("clearDataBtn"),
  exportCsvBtn: $("exportCsvBtn"),
  exportJsonBtn: $("exportJsonBtn"),
  printBtn: $("printBtn"),
  toast: $("toast")
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

function persist() {
  localStorage.setItem(keys.transactions, JSON.stringify(state.transactions));
  localStorage.setItem(keys.settings, JSON.stringify(state.settings));
  localStorage.setItem(keys.queue, JSON.stringify(state.queue));
  localStorage.setItem(keys.chat, JSON.stringify(state.chat));
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
  persist();
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
}

function drawEmpty(ctx, width, height, text) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#f7f9fb";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#667085";
  ctx.font = "700 18px Segoe UI, Arial";
  ctx.textAlign = "center";
  ctx.fillText(text, width / 2, height / 2);
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
  const centerX = 180;
  const centerY = canvas.height / 2;
  const radius = 105;
  let startAngle = -Math.PI / 2;
  data.forEach(([category, value], index) => {
    const slice = (value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, startAngle, startAngle + slice);
    ctx.closePath();
    ctx.fillStyle = chartColors[index % chartColors.length];
    ctx.fill();
    startAngle += slice;
    const percent = Math.round((value / total) * 100);
    const item = document.createElement("div");
    item.className = "legend-item";
    item.innerHTML = `<span class="legend-left"><span class="swatch" style="background:${chartColors[index % chartColors.length]}"></span><strong>${escapeHtml(category)}</strong></span><span>${money(value)} | ${percent}%</span>`;
    els.categoryLegend.append(item);
  });
  ctx.beginPath();
  ctx.arc(centerX, centerY, 58, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.fillStyle = "#172026";
  ctx.font = "800 16px Segoe UI, Arial";
  ctx.textAlign = "center";
  ctx.fillText("Expense", centerX, centerY - 6);
  ctx.fillStyle = "#667085";
  ctx.font = "700 13px Segoe UI, Arial";
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
  const maxValue = Math.max(...data.map((item) => Math.max(item.income, item.expense)), 1);
  const width = canvas.width;
  const height = canvas.height;
  const padding = { top: 28, right: 22, bottom: 48, left: 64 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const groupWidth = chartWidth / data.length;
  const barWidth = Math.min(34, groupWidth / 4);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "#d9e1e8";
  ctx.font = "700 12px Segoe UI, Arial";
  ctx.fillStyle = "#667085";
  ctx.textAlign = "right";
  for (let i = 0; i <= 4; i += 1) {
    const y = padding.top + (chartHeight / 4) * i;
    const value = maxValue - (maxValue / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
    ctx.fillText(shortMoney(value), padding.left - 10, y + 4);
  }
  data.forEach((item, index) => {
    const x = padding.left + index * groupWidth + groupWidth / 2;
    const incomeHeight = (item.income / maxValue) * chartHeight;
    const expenseHeight = (item.expense / maxValue) * chartHeight;
    ctx.fillStyle = "#1f8f55";
    ctx.fillRect(x - barWidth - 3, padding.top + chartHeight - incomeHeight, barWidth, incomeHeight);
    ctx.fillStyle = "#c94f4f";
    ctx.fillRect(x + 3, padding.top + chartHeight - expenseHeight, barWidth, expenseHeight);
    ctx.fillStyle = "#667085";
    ctx.textAlign = "center";
    ctx.fillText(labelMonth(item.month), x, height - 22);
  });
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
  els.driveStatus.textContent = state.settings.driveConnected ? `Connected: ${state.settings.driveFolderName}` : "Not connected";
  els.driveStatus.classList.toggle("connected", state.settings.driveConnected);
  els.queueCount.textContent = `${state.queue.length} ${state.queue.length === 1 ? "file" : "files"}`;
  els.queueList.innerHTML = state.queue.length ? "" : `<div class="empty-state compact-empty">No queued files.</div>`;
  state.queue.slice().reverse().forEach((item) => {
    const node = document.createElement("div");
    node.className = "queue-item";
    node.innerHTML = `<strong>${escapeHtml(item.name)}</strong><span>${label(item.status)} | ${label(item.sourceType)}</span>`;
    els.queueList.append(node);
  });
}

function renderReview() {
  const items = state.transactions.filter((tx) => tx.status === "needs_review" || tx.status === "duplicate").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  els.reviewCount.textContent = `${items.length} ${items.length === 1 ? "item" : "items"}`;
  els.reviewList.innerHTML = items.length ? "" : `<div class="empty-state">No pending review items.</div>`;
  items.forEach((tx) => {
    const dupes = duplicatesFor(tx).filter((candidate) => candidate.id !== tx.id && candidate.status === "saved");
    const card = document.createElement("article");
    card.className = "review-card";
    card.innerHTML = `
      <div class="review-main">
        <div>
          <span class="status-pill ${tx.status}">${label(tx.status)}</span>
          <h3>${escapeHtml(tx.merchant)} | ${money(tx.amount)}</h3>
          <p>${formatDate(tx.date)} | ${escapeHtml(tx.category)} | ${escapeHtml(tx.method)} | ${label(tx.sourceType)}</p>
          <p>Confidence ${Math.round(tx.confidence * 100)}%${dupes.length ? ` | Possible duplicate: ${escapeHtml(dupes[0].merchant)} ${money(dupes[0].amount)}` : ""}</p>
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
    item.innerHTML = `<span class="breakdown-left"><span class="swatch" style="background:${chartColors[index % chartColors.length]}"></span><strong>${escapeHtml(category)}</strong></span><span class="progress-track"><span class="progress-bar" style="width:${percent}%"></span></span><span>${money(value)} | ${percent}%</span>`;
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
  els.googleLoginBtn.textContent = state.settings.googleConnected ? "Disconnect Google" : "Connect Google";
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
  return asTx({
    id: els.editingId.value || id("tx"),
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
}

function saveTransaction(event) {
  event.preventDefault();
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

function normalizeBackendTx(raw, sourceType, fallbackNote) {
  const txType = raw?.type === "income" ? "income" : "expense";
  const validCategories = categories(txType);
  const category = validCategories.includes(raw?.category) ? raw.category : validCategories[validCategories.length - 1];
  const method = paymentMethods.includes(raw?.method) ? raw.method : "Cash";
  const confidence = Number.isFinite(Number(raw?.confidence)) ? Number(raw.confidence) : 0.75;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw?.date || "") ? raw.date : todayIso();
  return asTx({
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

async function parseSmartText(text, sourceType) {
  try {
    const data = await backendPost("/api/parse-text", {
      text,
      currency: state.settings.currency,
      today: todayIso()
    });
    return normalizeBackendTx(data.transaction, sourceType, text);
  } catch (error) {
    console.warn("AI text parser unavailable; using local parser.", error);
    return parseEntry(text, sourceType);
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function parseSmartImage(file, textHint) {
  try {
    if (file.type.startsWith("image/")) {
      const data = await backendPost("/api/parse-image", {
        filename: file.name,
        mimeType: file.type,
        dataUrl: await fileToDataUrl(file),
        textHint,
        currency: state.settings.currency,
        today: todayIso()
      });
      return normalizeBackendTx(data.transaction, "receipt_upload", textHint || file.name);
    }
    const data = await backendPost("/api/parse-text", {
      text: `Filename: ${file.name}\nVisible text hint: ${textHint}`,
      currency: state.settings.currency,
      today: todayIso()
    });
    return normalizeBackendTx(data.transaction, "receipt_upload", textHint || file.name);
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

async function handleUpload(event) {
  event.preventDefault();
  const file = els.uploadInput.files[0];
  if (!file) return toast("Choose a file first.");
  const rawText = els.uploadText.value.trim();
  const queueItem = { id: id("file"), name: file.name, sourceType: file.type === "application/pdf" ? "drive_receipt" : "receipt_upload", status: "processing", createdAt: new Date().toISOString() };
  state.queue.push(queueItem);
  const tx = await parseSmartImage(file, rawText);
  tx.sourceFileId = queueItem.id;
  tx.confidence = Math.min(tx.confidence, rawText ? 0.9 : 0.78);
  tx.status = "needs_review";
  createReview(tx, queueItem);
  els.uploadForm.reset();
  persist();
  renderAll();
  toast("Upload added to review.");
}

function connectDrive() {
  state.settings.driveConnected = true;
  state.settings.driveFolderName = els.driveFolderInput.value.trim() || "Expense Screenshots";
  state.settings.driveFolderId = state.settings.driveFolderId || id("drive-folder");
  persist();
  renderAll();
  toast("Drive folder connected locally.");
}

function disconnectDrive() {
  state.settings.driveConnected = false;
  persist();
  renderAll();
  toast("Drive disconnected.");
}

async function scanDrive() {
  if (!state.settings.driveConnected) return toast("Connect Drive first.");
  const examples = ["GPay Swiggy INR 420 food today UPI", "Amazon receipt INR 1299 shopping today card", "Airtel bill INR 799 today debit card"];
  for (const [index, text] of examples.entries()) {
    const queueItem = { id: id("drv"), name: `${state.settings.driveFolderName}-${index + 1}.png`, sourceType: "drive_screenshot", status: "processing", createdAt: new Date().toISOString() };
    state.queue.push(queueItem);
    const tx = await parseSmartText(text, "drive_screenshot");
    tx.sourceFileId = queueItem.id;
    tx.confidence = index === 0 ? 0.91 : 0.82;
    tx.status = tx.confidence >= state.settings.confidenceThreshold ? "saved" : "needs_review";
    createReview(tx, queueItem);
  }
  persist();
  renderAll();
  toast("Drive scan processed demo files.");
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
  }
  persist();
  renderAll();
}

async function askAssistant(event) {
  event.preventDefault();
  const question = els.assistantInput.value.trim();
  if (!question) return;
  state.chat.push({ from: "user", text: question });
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
  persist();
  renderAll();
  toast("Settings saved.");
}

function toggleGoogle() {
  state.settings.googleConnected = !state.settings.googleConnected;
  if (state.settings.googleConnected && !state.settings.profileEmail) state.settings.profileEmail = "local.user@example.com";
  persist();
  setupControls();
  renderAll();
  toast(state.settings.googleConnected ? "Google account connected locally." : "Google account disconnected.");
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
  els.cancelEditBtn.addEventListener("click", resetForm);
  els.quickEntryForm.addEventListener("submit", handleQuickEntry);
  els.uploadForm.addEventListener("submit", handleUpload);
  els.connectDriveBtn.addEventListener("click", connectDrive);
  els.disconnectDriveBtn.addEventListener("click", disconnectDrive);
  els.scanDriveBtn.addEventListener("click", scanDrive);
  els.assistantForm.addEventListener("submit", askAssistant);
  els.saveSettingsBtn.addEventListener("click", saveSettings);
  els.checkBackendBtn.addEventListener("click", checkBackend);
  els.googleLoginBtn.addEventListener("click", toggleGoogle);
  els.loadSampleBtn.addEventListener("click", loadSampleData);
  els.clearDataBtn.addEventListener("click", clearData);
  els.exportCsvBtn.addEventListener("click", exportCsv);
  els.exportJsonBtn.addEventListener("click", exportJson);
  els.printBtn.addEventListener("click", () => window.print());
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

loadState();
setupControls();
wireEvents();
renderAll();
