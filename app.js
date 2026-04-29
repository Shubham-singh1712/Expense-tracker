const storageKey = "expense-tracker-transactions-v1";
const settingsKey = "expense-tracker-settings-v1";

const incomeCategories = ["Salary", "Freelance", "Investment", "Gift", "Other income"];
const expenseCategories = ["Food", "Transport", "Rent", "Shopping", "Bills", "Health", "Education", "Entertainment", "Other expense"];
const chartColors = ["#157a6e", "#c94f4f", "#2767b1", "#bb7a10", "#7161a7", "#1f8f55", "#ca6f1e", "#5b677a", "#b23a6f"];

const state = {
  transactions: [],
  settings: {
    budget: 25000,
    currency: "INR"
  }
};

const els = {
  tabs: document.querySelectorAll(".tab-button"),
  views: document.querySelectorAll(".view"),
  transactionForm: document.getElementById("transactionForm"),
  editingId: document.getElementById("editingId"),
  formTitle: document.getElementById("formTitle"),
  cancelEditBtn: document.getElementById("cancelEditBtn"),
  categoryInput: document.getElementById("categoryInput"),
  amountInput: document.getElementById("amountInput"),
  dateInput: document.getElementById("dateInput"),
  methodInput: document.getElementById("methodInput"),
  noteInput: document.getElementById("noteInput"),
  totalIncome: document.getElementById("totalIncome"),
  totalExpense: document.getElementById("totalExpense"),
  balanceAmount: document.getElementById("balanceAmount"),
  budgetUsed: document.getElementById("budgetUsed"),
  savingsRate: document.getElementById("savingsRate"),
  categoryChart: document.getElementById("categoryChart"),
  monthlyChart: document.getElementById("monthlyChart"),
  categoryLegend: document.getElementById("categoryLegend"),
  categoryChartTotal: document.getElementById("categoryChartTotal"),
  transactionTable: document.getElementById("transactionTable"),
  transactionCount: document.getElementById("transactionCount"),
  searchInput: document.getElementById("searchInput"),
  typeFilter: document.getElementById("typeFilter"),
  categoryFilter: document.getElementById("categoryFilter"),
  monthFilter: document.getElementById("monthFilter"),
  reportMonth: document.getElementById("reportMonth"),
  monthReport: document.getElementById("monthReport"),
  reportTotal: document.getElementById("reportTotal"),
  breakdownList: document.getElementById("breakdownList"),
  budgetInput: document.getElementById("budgetInput"),
  currencyInput: document.getElementById("currencyInput"),
  saveSettingsBtn: document.getElementById("saveSettingsBtn"),
  loadSampleBtn: document.getElementById("loadSampleBtn"),
  clearDataBtn: document.getElementById("clearDataBtn"),
  exportCsvBtn: document.getElementById("exportCsvBtn"),
  printBtn: document.getElementById("printBtn"),
  toast: document.getElementById("toast")
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonth() {
  return todayIso().slice(0, 7);
}

function createId() {
  return `tx-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function money(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: state.settings.currency,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2
  }).format(amount);
}

function parseStoredJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function persist() {
  localStorage.setItem(storageKey, JSON.stringify(state.transactions));
  localStorage.setItem(settingsKey, JSON.stringify(state.settings));
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    els.toast.classList.remove("visible");
  }, 2200);
}

function startOfMonth(offset = 0) {
  const date = new Date();
  date.setMonth(date.getMonth() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function sampleTransactions() {
  const thisMonth = startOfMonth(0);
  const lastMonth = startOfMonth(-1);
  const twoMonthsAgo = startOfMonth(-2);

  return [
    { type: "income", category: "Salary", amount: 52000, date: `${thisMonth}-01`, method: "Bank transfer", note: "Monthly salary" },
    { type: "expense", category: "Rent", amount: 14000, date: `${thisMonth}-02`, method: "Bank transfer", note: "Room rent" },
    { type: "expense", category: "Food", amount: 3200, date: `${thisMonth}-05`, method: "UPI", note: "Groceries" },
    { type: "expense", category: "Transport", amount: 1800, date: `${thisMonth}-08`, method: "UPI", note: "Metro and cab" },
    { type: "expense", category: "Bills", amount: 2400, date: `${thisMonth}-10`, method: "Debit card", note: "Electricity and mobile" },
    { type: "income", category: "Freelance", amount: 9000, date: `${thisMonth}-12`, method: "Bank transfer", note: "Website changes" },
    { type: "expense", category: "Shopping", amount: 4200, date: `${thisMonth}-15`, method: "Credit card", note: "Clothes" },
    { type: "income", category: "Salary", amount: 52000, date: `${lastMonth}-01`, method: "Bank transfer", note: "Monthly salary" },
    { type: "expense", category: "Rent", amount: 14000, date: `${lastMonth}-02`, method: "Bank transfer", note: "Room rent" },
    { type: "expense", category: "Food", amount: 7400, date: `${lastMonth}-09`, method: "UPI", note: "Food and groceries" },
    { type: "expense", category: "Entertainment", amount: 2200, date: `${lastMonth}-18`, method: "Debit card", note: "Movies" },
    { type: "income", category: "Salary", amount: 51000, date: `${twoMonthsAgo}-01`, method: "Bank transfer", note: "Monthly salary" },
    { type: "expense", category: "Rent", amount: 14000, date: `${twoMonthsAgo}-02`, method: "Bank transfer", note: "Room rent" },
    { type: "expense", category: "Education", amount: 5200, date: `${twoMonthsAgo}-14`, method: "UPI", note: "Course fee" }
  ].map((transaction) => ({ ...transaction, id: createId() }));
}

function loadState() {
  state.settings = {
    ...state.settings,
    ...parseStoredJson(settingsKey, {})
  };

  const storedTransactions = parseStoredJson(storageKey, null);
  state.transactions = Array.isArray(storedTransactions) ? storedTransactions : sampleTransactions();
  persist();
}

function categoriesForType(type) {
  return type === "income" ? incomeCategories : expenseCategories;
}

function selectedType() {
  return document.querySelector('input[name="type"]:checked').value;
}

function fillCategorySelect(select, categories, includeAll = false) {
  select.innerHTML = "";
  if (includeAll) {
    select.append(new Option("All", "all"));
  }
  categories.forEach((category) => {
    select.append(new Option(category, category));
  });
}

function updateCategoryInput() {
  const type = selectedType();
  const previousValue = els.categoryInput.value;
  fillCategorySelect(els.categoryInput, categoriesForType(type));
  if (categoriesForType(type).includes(previousValue)) {
    els.categoryInput.value = previousValue;
  }
}

function setupFilters() {
  fillCategorySelect(els.categoryFilter, [...incomeCategories, ...expenseCategories], true);
  els.monthFilter.value = currentMonth();
  els.reportMonth.value = currentMonth();
  els.dateInput.value = todayIso();
  els.budgetInput.value = state.settings.budget;
  els.currencyInput.value = state.settings.currency;
  updateCategoryInput();
}

function totalsFor(transactions) {
  return transactions.reduce(
    (totals, transaction) => {
      totals[transaction.type] += Number(transaction.amount);
      return totals;
    },
    { income: 0, expense: 0 }
  );
}

function thisMonthTransactions() {
  const month = currentMonth();
  return state.transactions.filter((transaction) => transaction.date.startsWith(month));
}

function filteredTransactions() {
  const query = els.searchInput.value.trim().toLowerCase();
  const type = els.typeFilter.value;
  const category = els.categoryFilter.value;
  const month = els.monthFilter.value;

  return state.transactions
    .filter((transaction) => type === "all" || transaction.type === type)
    .filter((transaction) => category === "all" || transaction.category === category)
    .filter((transaction) => !month || transaction.date.startsWith(month))
    .filter((transaction) => {
      if (!query) return true;
      return [transaction.category, transaction.note, transaction.method, transaction.type]
        .join(" ")
        .toLowerCase()
        .includes(query);
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

function expenseByCategory(transactions) {
  return transactions
    .filter((transaction) => transaction.type === "expense")
    .reduce((groups, transaction) => {
      groups[transaction.category] = (groups[transaction.category] || 0) + Number(transaction.amount);
      return groups;
    }, {});
}

function monthlyGroups() {
  const months = [];
  for (let offset = -5; offset <= 0; offset += 1) {
    months.push(startOfMonth(offset));
  }

  return months.map((month) => {
    const transactions = state.transactions.filter((transaction) => transaction.date.startsWith(month));
    const totals = totalsFor(transactions);
    return { month, ...totals };
  });
}

function drawEmptyChart(ctx, width, height, label) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#edf2f7";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#667085";
  ctx.font = "700 18px Segoe UI, Arial";
  ctx.textAlign = "center";
  ctx.fillText(label, width / 2, height / 2);
}

function drawCategoryChart() {
  const canvas = els.categoryChart;
  const ctx = canvas.getContext("2d");
  const data = Object.entries(expenseByCategory(thisMonthTransactions())).sort((a, b) => b[1] - a[1]);
  const total = data.reduce((sum, [, value]) => sum + value, 0);

  els.categoryChartTotal.textContent = money(total);
  els.categoryLegend.innerHTML = "";

  if (!total) {
    drawEmptyChart(ctx, canvas.width, canvas.height, "No expenses this month");
    return;
  }

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

  data.forEach(([category, value], index) => {
      const percent = Math.round((value / total) * 100);
      const item = document.createElement("div");
      item.className = "legend-item";
      item.innerHTML = `
        <span class="legend-left">
          <span class="swatch" style="background:${chartColors[index % chartColors.length]}"></span>
          <strong>${category}</strong>
        </span>
        <span>${money(value)} | ${percent}%</span>
      `;
      els.categoryLegend.append(item);
    });
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
  ctx.lineWidth = 1;
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

  ctx.fillStyle = "#1f8f55";
  ctx.fillRect(width - 176, 12, 12, 12);
  ctx.fillStyle = "#667085";
  ctx.textAlign = "left";
  ctx.fillText("Income", width - 158, 23);
  ctx.fillStyle = "#c94f4f";
  ctx.fillRect(width - 96, 12, 12, 12);
  ctx.fillStyle = "#667085";
  ctx.fillText("Expense", width - 78, 23);
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

function renderSummary() {
  const allTotals = totalsFor(state.transactions);
  const monthTotals = totalsFor(thisMonthTransactions());
  const balance = allTotals.income - allTotals.expense;
  const budgetPercent = state.settings.budget > 0 ? Math.round((monthTotals.expense / state.settings.budget) * 100) : 0;
  const savingsPercent = monthTotals.income > 0 ? Math.round(((monthTotals.income - monthTotals.expense) / monthTotals.income) * 100) : 0;

  els.totalIncome.textContent = money(allTotals.income);
  els.totalExpense.textContent = money(allTotals.expense);
  els.balanceAmount.textContent = money(balance);
  els.budgetUsed.textContent = `${budgetPercent}%`;
  els.savingsRate.textContent = `${Math.max(savingsPercent, 0)}% saved`;
}

function renderTransactions() {
  const transactions = filteredTransactions();
  els.transactionCount.textContent = `${transactions.length} ${transactions.length === 1 ? "record" : "records"}`;
  els.transactionTable.innerHTML = "";

  if (!transactions.length) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="7" class="empty-state">No transactions match the current filters.</td>`;
    els.transactionTable.append(row);
    return;
  }

  transactions.forEach((transaction) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${formatDate(transaction.date)}</td>
      <td><span class="type-pill ${transaction.type}">${capitalize(transaction.type)}</span></td>
      <td>${escapeHtml(transaction.category)}</td>
      <td>${escapeHtml(transaction.method)}</td>
      <td>${escapeHtml(transaction.note || "-")}</td>
      <td class="amount ${transaction.type}-text">${transaction.type === "income" ? "+" : "-"}${money(transaction.amount)}</td>
      <td>
        <div class="row-actions">
          <button class="action-button" type="button" title="Edit transaction" aria-label="Edit transaction" data-action="edit" data-id="${transaction.id}">ED</button>
          <button class="action-button" type="button" title="Delete transaction" aria-label="Delete transaction" data-action="delete" data-id="${transaction.id}">DEL</button>
        </div>
      </td>
    `;
    els.transactionTable.append(row);
  });
}

function renderReports() {
  const month = els.reportMonth.value || currentMonth();
  const transactions = state.transactions.filter((transaction) => transaction.date.startsWith(month));
  const totals = totalsFor(transactions);
  const balance = totals.income - totals.expense;
  const expenseGroups = Object.entries(expenseByCategory(transactions)).sort((a, b) => b[1] - a[1]);
  const largestExpense = expenseGroups[0];

  els.monthReport.innerHTML = "";
  [
    ["Income", money(totals.income)],
    ["Expense", money(totals.expense)],
    ["Balance", money(balance)],
    ["Largest category", largestExpense ? `${largestExpense[0]} (${money(largestExpense[1])})` : "None"]
  ].forEach(([label, value]) => {
    const item = document.createElement("div");
    item.className = "report-item";
    item.innerHTML = `<strong>${label}</strong><span>${value}</span>`;
    els.monthReport.append(item);
  });

  els.reportTotal.textContent = money(totals.expense);
  els.breakdownList.innerHTML = "";

  if (!expenseGroups.length) {
    els.breakdownList.innerHTML = `<div class="empty-state">No expenses found for this month.</div>`;
    return;
  }

  expenseGroups.forEach(([category, value], index) => {
    const percent = totals.expense ? Math.round((value / totals.expense) * 100) : 0;
    const item = document.createElement("div");
    item.className = "breakdown-item";
    item.innerHTML = `
      <span class="breakdown-left">
        <span class="swatch" style="background:${chartColors[index % chartColors.length]}"></span>
        <strong>${category}</strong>
      </span>
      <span class="progress-track" aria-hidden="true">
        <span class="progress-bar" style="width:${percent}%"></span>
      </span>
      <span>${money(value)} | ${percent}%</span>
    `;
    els.breakdownList.append(item);
  });
}

function renderAll() {
  renderSummary();
  renderTransactions();
  renderReports();
  drawCategoryChart();
  drawMonthlyChart();
}

function formatDate(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function resetForm() {
  els.transactionForm.reset();
  els.editingId.value = "";
  els.formTitle.textContent = "Add transaction";
  els.cancelEditBtn.classList.add("hidden");
  els.dateInput.value = todayIso();
  document.querySelector('input[name="type"][value="expense"]').checked = true;
  updateCategoryInput();
}

function saveTransaction(event) {
  event.preventDefault();

  const amount = Number(els.amountInput.value);
  if (!Number.isFinite(amount) || amount <= 0) {
    showToast("Enter a valid amount.");
    return;
  }

  const transaction = {
    id: els.editingId.value || createId(),
    type: selectedType(),
    category: els.categoryInput.value,
    amount,
    date: els.dateInput.value,
    method: els.methodInput.value,
    note: els.noteInput.value.trim()
  };

  const existingIndex = state.transactions.findIndex((item) => item.id === transaction.id);
  if (existingIndex >= 0) {
    state.transactions[existingIndex] = transaction;
    showToast("Transaction updated.");
  } else {
    state.transactions.push(transaction);
    showToast("Transaction saved.");
  }

  persist();
  resetForm();
  renderAll();
}

function editTransaction(id) {
  const transaction = state.transactions.find((item) => item.id === id);
  if (!transaction) return;

  els.editingId.value = transaction.id;
  document.querySelector(`input[name="type"][value="${transaction.type}"]`).checked = true;
  updateCategoryInput();
  els.categoryInput.value = transaction.category;
  els.amountInput.value = transaction.amount;
  els.dateInput.value = transaction.date;
  els.methodInput.value = transaction.method;
  els.noteInput.value = transaction.note;
  els.formTitle.textContent = "Edit transaction";
  els.cancelEditBtn.classList.remove("hidden");

  switchView("overview");
  els.amountInput.focus();
}

function deleteTransaction(id) {
  const transaction = state.transactions.find((item) => item.id === id);
  if (!transaction) return;

  const confirmed = window.confirm(`Delete ${transaction.category} transaction of ${money(transaction.amount)}?`);
  if (!confirmed) return;

  state.transactions = state.transactions.filter((item) => item.id !== id);
  persist();
  renderAll();
  showToast("Transaction deleted.");
}

function switchView(viewName) {
  els.tabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.view === viewName);
  });
  els.views.forEach((view) => {
    view.classList.toggle("active", view.id === `${viewName}View`);
  });
}

function saveSettings() {
  const budget = Number(els.budgetInput.value);
  state.settings.budget = Number.isFinite(budget) && budget >= 0 ? budget : 0;
  state.settings.currency = els.currencyInput.value;
  persist();
  renderAll();
  showToast("Settings saved.");
}

function loadSampleData() {
  state.transactions = sampleTransactions();
  persist();
  resetForm();
  renderAll();
  showToast("Sample data loaded.");
}

function clearData() {
  const confirmed = window.confirm("Clear all transactions from this browser?");
  if (!confirmed) return;

  state.transactions = [];
  persist();
  resetForm();
  renderAll();
  showToast("All transactions cleared.");
}

function exportCsv() {
  const transactions = filteredTransactions();
  const header = ["Date", "Type", "Category", "Method", "Note", "Amount"];
  const rows = transactions.map((transaction) => [
    transaction.date,
    transaction.type,
    transaction.category,
    transaction.method,
    transaction.note,
    transaction.amount
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `expense-report-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("CSV exported.");
}

function wireEvents() {
  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => switchView(tab.dataset.view));
  });

  document.querySelectorAll('input[name="type"]').forEach((input) => {
    input.addEventListener("change", updateCategoryInput);
  });

  els.transactionForm.addEventListener("submit", saveTransaction);
  els.cancelEditBtn.addEventListener("click", resetForm);
  els.saveSettingsBtn.addEventListener("click", saveSettings);
  els.loadSampleBtn.addEventListener("click", loadSampleData);
  els.clearDataBtn.addEventListener("click", clearData);
  els.exportCsvBtn.addEventListener("click", exportCsv);
  els.printBtn.addEventListener("click", () => window.print());
  els.reportMonth.addEventListener("change", renderReports);

  [els.searchInput, els.typeFilter, els.categoryFilter, els.monthFilter].forEach((input) => {
    input.addEventListener("input", renderTransactions);
    input.addEventListener("change", renderTransactions);
  });

  els.transactionTable.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    if (button.dataset.action === "edit") {
      editTransaction(button.dataset.id);
    }
    if (button.dataset.action === "delete") {
      deleteTransaction(button.dataset.id);
    }
  });
}

loadState();
setupFilters();
wireEvents();
renderAll();
