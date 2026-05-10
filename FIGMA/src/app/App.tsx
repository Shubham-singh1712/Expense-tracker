import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Bot,
  Brain,
  Calendar,
  Check,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Cloud,
  CreditCard,
  FileText,
  Folder,
  HardDrive,
  History,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  Shield,
  Sparkles,
  Trash2,
  Upload,
  User,
  Wallet,
  XCircle,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type View = "dashboard" | "add" | "review" | "drive" | "reports" | "history" | "assistant" | "settings";
type TransactionStatus = "saved" | "needs_review" | "duplicate" | "rejected";

type Transaction = {
  id: string;
  type: "income" | "expense";
  amount: number;
  currency: string;
  date: string;
  merchant: string;
  category: string;
  method: string;
  note?: string;
  confidence?: number;
  status?: TransactionStatus;
  sourceType?: string;
  driveFileId?: string;
  aiAnalysis?: {
    category?: string;
    total?: number;
    insights?: string;
    suggestions?: string[];
  };
};

type QueueItem = {
  id: string;
  name: string;
  sourceType: string;
  status: string;
  createdAt: string;
};

type ChatMessage = {
  id: string;
  from: "user" | "assistant";
  text: string;
};

type SettingsState = {
  budget: number;
  currency: string;
  profileName: string;
  profileEmail: string;
  localAuthenticated: boolean;
  googleConnected: boolean;
  driveConnected: boolean;
  driveFolderName: string;
  backendUrl: string;
  aiBackendConnected: boolean;
  confidenceThreshold: number;
  useServerSync: boolean;
  serverDataSavedAt: number;
};

type Snapshot = {
  transactions: Transaction[];
  queue: QueueItem[];
  chat: ChatMessage[];
  settings: Partial<SettingsState>;
  savedAt?: number | null;
};

const defaultSettings: SettingsState = {
  budget: 25000,
  currency: "INR",
  profileName: "",
  profileEmail: "",
  localAuthenticated: false,
  googleConnected: false,
  driveConnected: false,
  driveFolderName: "Expense Screenshots",
  backendUrl: "http://127.0.0.1:8787",
  aiBackendConnected: false,
  confidenceThreshold: 0.85,
  useServerSync: true,
  serverDataSavedAt: 0,
};

const emptyAssistant: ChatMessage = {
  id: "assistant-welcome",
  from: "assistant",
  text: "Hi, I am ready to analyze your saved spending, review queue, and Drive imports.",
};

const categories = [
  "Food",
  "Transport",
  "Rent",
  "Shopping",
  "Bills",
  "Health",
  "Education",
  "Entertainment",
  "Travel",
  "Subscription",
  "Other expense",
];

const methods = ["Cash", "UPI", "Debit card", "Credit card", "Bank transfer", "Wallet"];
const chartColors = ["#5eead4", "#93c5fd", "#c4b5fd", "#f9a8d4", "#fcd34d", "#86efac", "#fca5a5", "#67e8f9"];

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function backendBase() {
  if (window.location.port === "8787") return window.location.origin;
  return defaultSettings.backendUrl;
}

async function apiGet(path: string) {
  const response = await fetch(`${backendBase()}${path}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function apiPost(path: string, body: unknown) {
  const response = await fetch(`${backendBase()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

function normalizeTx(raw: Partial<Transaction>, sourceType = "manual"): Transaction {
  const confidence = Number(raw.confidence ?? 1);
  return {
    id: raw.id || id("tx"),
    type: raw.type === "income" ? "income" : "expense",
    amount: Math.abs(Number(raw.amount || 0)),
    currency: String(raw.currency || defaultSettings.currency).toUpperCase(),
    date: raw.date || todayIso(),
    merchant: raw.merchant?.trim() || "Unknown",
    category: raw.category || "Other expense",
    method: raw.method || "Cash",
    note: raw.note || "",
    confidence,
    status: raw.status || (confidence >= defaultSettings.confidenceThreshold ? "saved" : "needs_review"),
    sourceType: raw.sourceType || sourceType,
    driveFileId: raw.driveFileId,
    aiAnalysis: raw.aiAnalysis,
  };
}

function money(value: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function monthKey(date: string) {
  return (date || todayIso()).slice(0, 7);
}

function sourceLabel(source?: string) {
  return (source || "manual").replace(/_/g, " ");
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function ScreenShell({ title, sub, children, action }: { title: string; sub: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="mx-auto flex w-full max-w-[1380px] flex-col gap-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
            <Sparkles size={12} />
            Live backend
          </p>
          <h1 className="screen-title text-foreground">{title}</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{sub}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function MetricCard({ label, value, sub, Icon, tone = "cyan" }: { label: string; value: string; sub: string; Icon: React.ElementType; tone?: "cyan" | "violet" | "emerald" | "rose" }) {
  const toneClass = {
    cyan: "from-cyan-400/18 to-blue-400/8 text-cyan-200",
    violet: "from-violet-400/18 to-fuchsia-400/8 text-violet-200",
    emerald: "from-emerald-400/18 to-teal-400/8 text-emerald-200",
    rose: "from-rose-400/18 to-orange-400/8 text-rose-200",
  }[tone];
  return (
    <div className="premium-card min-h-[132px] p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
        <span className={cx("grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br", toneClass)}>
          <Icon size={17} />
        </span>
      </div>
      <div className="mt-5">
        <p className="metric-value">{value}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
}

function EmptyState({ title, text, Icon = FileText }: { title: string; text: string; Icon?: React.ElementType }) {
  return (
    <div className="premium-card grid min-h-[220px] place-items-center p-8 text-center">
      <div>
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-cyan-200">
          <Icon size={22} />
        </div>
        <p className="font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

function AuthScreen({ onLocal, onGoogle, loading, error }: { onLocal: () => void; onGoogle: () => void; loading: boolean; error: string }) {
  return (
    <main className="auth-surface min-h-screen overflow-hidden bg-background text-foreground">
      <div className="mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 lg:grid-cols-[1.08fr_0.92fr]">
        <section className="relative hidden flex-col justify-between overflow-hidden px-10 py-9 lg:flex">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(94,234,212,0.22),transparent_32%),radial-gradient(circle_at_82%_14%,rgba(196,181,253,0.18),transparent_34%)]" />
          <div className="relative flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-300 text-slate-950 shadow-[0_0_40px_rgba(94,234,212,0.35)]">
              <Zap size={19} />
            </div>
            <span className="text-lg font-bold">AutoSpend AI</span>
          </div>
          <div className="relative max-w-xl pb-14">
            <p className="mb-5 inline-flex rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
              Private local-first finance intelligence
            </p>
            <h1 className="hero-title">Your spending, finally in focus.</h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-slate-300">
              A premium dashboard for bills, receipts, Drive imports, AI review, and spending decisions, powered by your existing local backend.
            </p>
          </div>
        </section>

        <section className="flex min-h-screen items-center justify-center px-5 py-8">
          <div className="premium-card w-full max-w-md p-5 sm:p-7">
            <div className="mb-7 flex items-center gap-3 lg:hidden">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-300 text-slate-950">
                <Zap size={18} />
              </div>
              <span className="font-bold">AutoSpend AI</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">Welcome back</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Continue with Google OAuth or enter the local workspace. Keys and tokens remain inside the backend.
              </p>
            </div>
            {error && (
              <div className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                {error}
              </div>
            )}
            <div className="mt-6 grid gap-3">
              <button onClick={onGoogle} disabled={loading} className="primary-button h-12">
                {loading ? <Loader2 size={17} className="animate-spin" /> : <Cloud size={17} />}
                Continue with Google
              </button>
              <button onClick={onLocal} className="secondary-button h-12">
                <Shield size={17} />
                Use local profile
              </button>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-2 text-center text-xs text-muted-foreground">
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">OAuth safe</div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">SQLite sync</div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">AI ready</div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function DashboardScreen({ transactions, settings }: { transactions: Transaction[]; settings: SettingsState }) {
  const saved = transactions.filter((tx) => tx.status !== "rejected");
  const currentMonth = todayIso().slice(0, 7);
  const monthExpenses = saved.filter((tx) => tx.type === "expense" && monthKey(tx.date) === currentMonth);
  const income = saved.filter((tx) => tx.type === "income").reduce((sum, tx) => sum + tx.amount, 0);
  const expense = saved.filter((tx) => tx.type === "expense").reduce((sum, tx) => sum + tx.amount, 0);
  const monthSpend = monthExpenses.reduce((sum, tx) => sum + tx.amount, 0);
  const pending = transactions.filter((tx) => tx.status === "needs_review" || tx.status === "duplicate").length;
  const categoryData = getCategoryData(monthExpenses);
  const monthlyData = getMonthlyData(saved, settings.budget);
  const recent = saved.slice(0, 6);

  return (
    <ScreenShell title="Dashboard" sub="Your live financial overview from the existing AutoSpend backend.">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Monthly spend" value={money(monthSpend, settings.currency)} sub={`${Math.round((monthSpend / Math.max(settings.budget, 1)) * 100)}% of budget used`} Icon={CircleDollarSign} tone="cyan" />
        <MetricCard label="Budget" value={money(settings.budget, settings.currency)} sub={`${money(Math.max(settings.budget - monthSpend, 0), settings.currency)} remaining`} Icon={Activity} tone="violet" />
        <MetricCard label="Balance" value={money(income - expense, settings.currency)} sub={`${money(income, settings.currency)} income tracked`} Icon={Wallet} tone="emerald" />
        <MetricCard label="AI review" value={String(pending)} sub="items waiting for approval" Icon={Brain} tone={pending ? "rose" : "emerald"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="premium-card p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="panel-title">Spending rhythm</h3>
              <p className="text-xs text-muted-foreground">Last six months vs. monthly budget</p>
            </div>
            <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-muted-foreground">{settings.currency}</span>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="spendGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#5eead4" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#5eead4" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "#8d93a8", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#8d93a8", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip currency={settings.currency} />} />
                <Area type="monotone" dataKey="budget" stroke="rgba(196,181,253,0.55)" strokeDasharray="5 5" fill="transparent" />
                <Area type="monotone" dataKey="amount" stroke="#5eead4" strokeWidth={2.4} fill="url(#spendGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="premium-card p-4 sm:p-5">
          <h3 className="panel-title">Category mix</h3>
          <p className="text-xs text-muted-foreground">Current month expenses</p>
          {categoryData.length ? (
            <>
              <div className="h-[195px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryData} dataKey="value" innerRadius={48} outerRadius={76} paddingAngle={4}>
                      {categoryData.map((entry, index) => (
                        <Cell key={entry.name} fill={entry.color || chartColors[index % chartColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip currency={settings.currency} />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {categoryData.slice(0, 5).map((cat) => (
                  <div key={cat.name} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: cat.color }} />
                      <span className="truncate">{cat.name}</span>
                    </span>
                    <span className="font-semibold text-foreground">{money(cat.value, settings.currency)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState title="No category data" text="Add or import expenses to populate this chart." Icon={BarChart3} />
          )}
        </div>
      </div>

      <div className="premium-card p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="panel-title">Recent transactions</h3>
          <span className="text-xs text-muted-foreground">{saved.length} total</span>
        </div>
        <TransactionList transactions={recent} currency={settings.currency} compact />
      </div>
    </ScreenShell>
  );
}

function AddExpenseScreen({ settings, onAdd, onParsed }: { settings: SettingsState; onAdd: (tx: Transaction) => void; onParsed: (tx: Transaction, queue?: QueueItem) => void }) {
  const [tab, setTab] = useState<"manual" | "text" | "upload">("manual");
  const [saving, setSaving] = useState(false);
  const [text, setText] = useState("");
  const [form, setForm] = useState({
    merchant: "",
    amount: "",
    category: "Food",
    method: "UPI",
    date: todayIso(),
    note: "",
  });

  async function submitManual(event: React.FormEvent) {
    event.preventDefault();
    const tx = normalizeTx({
      ...form,
      amount: Number(form.amount),
      currency: settings.currency,
      confidence: 1,
      status: "saved",
      sourceType: "manual",
    });
    onAdd(tx);
    setForm({ merchant: "", amount: "", category: "Food", method: "UPI", date: todayIso(), note: "" });
  }

  async function parseText(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    try {
      const data = await apiPost("/api/parse-text", { text, currency: settings.currency, today: todayIso() });
      onParsed(normalizeTx({ ...data.transaction, aiAnalysis: data.analysis }, "cash_text"));
      setText("");
    } finally {
      setSaving(false);
    }
  }

  async function parseUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setSaving(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const data = await apiPost("/api/parse-image", {
        filename: file.name,
        mimeType: file.type,
        dataUrl,
        currency: settings.currency,
        today: todayIso(),
      });
      const queue: QueueItem = { id: id("file"), name: file.name, sourceType: "receipt_upload", status: "parsed", createdAt: new Date().toISOString() };
      onParsed(normalizeTx({ ...data.transaction, status: "needs_review", aiAnalysis: data.analysis }, "receipt_upload"), queue);
    } finally {
      setSaving(false);
      event.target.value = "";
    }
  }

  return (
    <ScreenShell title="Add expense" sub="Manual entries save immediately. AI parsed text and receipts go through review when confidence needs attention.">
      <div className="max-w-3xl">
        <div className="mb-5 inline-grid grid-cols-3 rounded-2xl border border-white/10 bg-white/[0.04] p-1">
          {(["manual", "text", "upload"] as const).map((item) => (
            <button key={item} onClick={() => setTab(item)} className={cx("rounded-xl px-4 py-2 text-sm font-semibold capitalize transition", tab === item ? "bg-cyan-300 text-slate-950" : "text-muted-foreground hover:text-foreground")}>
              {item}
            </button>
          ))}
        </div>

        {tab === "manual" && (
          <form onSubmit={submitManual} className="premium-card grid gap-4 p-4 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Merchant">
                <input value={form.merchant} onChange={(e) => setForm((p) => ({ ...p, merchant: e.target.value }))} required placeholder="Lunch, rent, Amazon" className="field" />
              </Field>
              <Field label={`Amount (${settings.currency})`}>
                <input value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} required type="number" min="0" step="0.01" placeholder="0.00" className="field font-mono" />
              </Field>
              <Field label="Category">
                <select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} className="field">
                  {categories.map((cat) => <option key={cat}>{cat}</option>)}
                </select>
              </Field>
              <Field label="Payment method">
                <select value={form.method} onChange={(e) => setForm((p) => ({ ...p, method: e.target.value }))} className="field">
                  {methods.map((method) => <option key={method}>{method}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Date">
              <input value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} type="date" className="field" />
            </Field>
            <Field label="Note">
              <textarea value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} rows={3} placeholder="Optional details" className="field resize-none" />
            </Field>
            <button className="primary-button h-12 justify-center">
              <Plus size={17} />
              Save transaction
            </button>
          </form>
        )}

        {tab === "text" && (
          <form onSubmit={parseText} className="premium-card grid gap-4 p-4 sm:p-6">
            <Field label="Natural language entry">
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} placeholder="Paid 420 for lunch at Swiggy by UPI yesterday" className="field resize-none" />
            </Field>
            <button disabled={saving || !text.trim()} className="primary-button h-12 justify-center disabled:opacity-50">
              {saving ? <Loader2 size={17} className="animate-spin" /> : <Brain size={17} />}
              Parse with AI
            </button>
          </form>
        )}

        {tab === "upload" && (
          <div className="premium-card p-5 sm:p-8">
            <label className="flex min-h-[260px] cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-cyan-200/25 bg-cyan-200/[0.03] px-5 text-center transition hover:border-cyan-200/45 hover:bg-cyan-200/[0.06]">
              <input type="file" className="hidden" accept="image/*,application/pdf" onChange={parseUpload} />
              <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-cyan-300 text-slate-950">
                {saving ? <Loader2 size={23} className="animate-spin" /> : <Upload size={23} />}
              </div>
              <p className="font-semibold text-foreground">Drop or browse a receipt</p>
              <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">The file is sent only to your local backend, which handles the AI parser and keeps keys private.</p>
            </label>
          </div>
        )}
      </div>
    </ScreenShell>
  );
}

function ReviewScreen({ transactions, settings, onUpdate }: { transactions: Transaction[]; settings: SettingsState; onUpdate: (transactions: Transaction[]) => void }) {
  const review = transactions.filter((tx) => tx.status === "needs_review" || tx.status === "duplicate");

  function act(tx: Transaction, status: TransactionStatus) {
    const next = transactions.map((item) => item.id === tx.id ? { ...item, status } : item);
    onUpdate(next);
    if (status === "saved") {
      apiPost("/api/transaction/correct", { id: tx.id, transaction: { ...tx, status }, analysis: tx.aiAnalysis }).catch(() => {});
    }
  }

  return (
    <ScreenShell title="AI review" sub="Approve, keep, or reject AI-detected transactions before they become part of your ledger.">
      {review.length ? (
        <div className="grid gap-3">
          {review.map((tx) => (
            <div key={tx.id} className="premium-card p-4 sm:p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-base font-bold text-foreground">{tx.merchant}</h3>
                    <ConfidenceBadge score={Math.round((tx.confidence || 0) * 100)} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{tx.date} | {tx.category} | {sourceLabel(tx.sourceType)}</p>
                  {tx.aiAnalysis?.insights && <p className="mt-3 max-w-3xl text-sm leading-6 text-cyan-100/80">{tx.aiAnalysis.insights}</p>}
                </div>
                <div className="flex flex-col gap-3 md:items-end">
                  <p className="metric-small">{money(tx.amount, settings.currency)}</p>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => act(tx, "saved")} className="success-button"><Check size={14} />Approve</button>
                    <button onClick={() => act(tx, "saved")} className="secondary-button h-9 px-3"><Plus size={14} />Keep</button>
                    <button onClick={() => act(tx, "rejected")} className="danger-button"><XCircle size={14} />Reject</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="Review queue is clear" text="Parsed receipts, Drive imports, and low-confidence entries will appear here." Icon={CheckCircle} />
      )}
    </ScreenShell>
  );
}

function DriveScreen({ settings, onSettings, onParsed }: { settings: SettingsState; onSettings: (settings: SettingsState) => void; onParsed: (tx: Transaction, queue?: QueueItem) => void }) {
  const [folder, setFolder] = useState(settings.driveFolderName);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function refresh() {
    const data = await apiGet("/api/drive/status");
    onSettings({ ...settings, driveConnected: Boolean(data.connected), driveFolderName: data.folderName || folder });
  }

  async function connect() {
    setBusy(true);
    try {
      const data = await apiGet("/api/drive/auth-url");
      window.open(data.authUrl, "autospend-drive-auth", "width=520,height=720");
      setMessage("Finish Google authorization in the popup.");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      await apiGet("/api/drive/disconnect");
      onSettings({ ...settings, driveConnected: false });
      setMessage("Drive disconnected.");
    } finally {
      setBusy(false);
    }
  }

  async function scan() {
    setBusy(true);
    setMessage("");
    try {
      const data = await apiPost("/api/drive/scan", { folderName: folder, currency: settings.currency, today: todayIso() });
      const files = Array.isArray(data.files) ? data.files : [];
      files.forEach((file: any) => {
        const queue: QueueItem = { id: id("drive"), name: file.name || "Drive file", sourceType: "drive_screenshot", status: "parsed", createdAt: new Date().toISOString() };
        onParsed(normalizeTx({ ...file.transaction, status: "needs_review", sourceType: "drive_screenshot", driveFileId: file.fileId, aiAnalysis: file.analysis }, "drive_screenshot"), queue);
      });
      setMessage(files.length ? `Imported ${files.length} file(s) for review.` : "No new files found.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "autospend-drive-auth") refresh().catch(() => {});
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  });

  return (
    <ScreenShell title="Drive sync" sub="Connect Google Drive through the existing backend OAuth flow and import receipts into AI review.">
      <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <div className={cx("premium-card p-5", settings.driveConnected && "border-emerald-300/20")}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-slate-950">
                <HardDrive size={22} />
              </div>
              <div>
                <h3 className="panel-title">Google Drive</h3>
                <p className={cx("text-sm", settings.driveConnected ? "text-emerald-300" : "text-muted-foreground")}>{settings.driveConnected ? "Connected" : "Not connected"}</p>
              </div>
            </div>
            <span className={cx("rounded-full px-3 py-1 text-xs font-semibold", settings.driveConnected ? "bg-emerald-400/12 text-emerald-200" : "bg-white/[0.05] text-muted-foreground")}>
              {settings.driveConnected ? "Active" : "Idle"}
            </span>
          </div>

          <div className="mt-6 grid gap-3">
            <Field label="Folder name">
              <input value={folder} onChange={(e) => setFolder(e.target.value)} className="field" />
            </Field>
            <div className="flex flex-wrap gap-2">
              {!settings.driveConnected ? (
                <button onClick={connect} disabled={busy} className="primary-button h-11">{busy ? <Loader2 size={16} className="animate-spin" /> : <Cloud size={16} />}Connect Drive</button>
              ) : (
                <>
                  <button onClick={scan} disabled={busy} className="primary-button h-11">{busy ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}Scan now</button>
                  <button onClick={disconnect} disabled={busy} className="secondary-button h-11"><LogOut size={16} />Disconnect</button>
                </>
              )}
            </div>
            {message && <p className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-muted-foreground">{message}</p>}
          </div>
        </div>

        <div className="premium-card p-5">
          <h3 className="panel-title">OAuth safety boundary</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              ["Secrets", "Stay in .env only"],
              ["Callback", "/oauth2callback"],
              ["Tokens", "Backend JSON files"],
            ].map(([title, body]) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <p className="font-semibold text-foreground">{title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ScreenShell>
  );
}

function ReportsScreen({ transactions, settings }: { transactions: Transaction[]; settings: SettingsState }) {
  const saved = transactions.filter((tx) => tx.status !== "rejected");
  const categoryData = getCategoryData(saved.filter((tx) => tx.type === "expense"));
  const monthlyData = getMonthlyData(saved, settings.budget);
  const totalExpense = saved.filter((tx) => tx.type === "expense").reduce((sum, tx) => sum + tx.amount, 0);

  return (
    <ScreenShell title="Reports" sub="Backend data, shaped into category, monthly, and budget signals.">
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="premium-card p-5">
          <h3 className="panel-title">Category breakdown</h3>
          <div className="mt-5 space-y-3">
            {categoryData.map((cat) => (
              <div key={cat.name}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-muted-foreground">{cat.name}</span>
                  <span className="font-semibold">{money(cat.value, settings.currency)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
                  <div className="h-full rounded-full" style={{ width: `${Math.min((cat.value / Math.max(totalExpense, 1)) * 100, 100)}%`, background: cat.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="premium-card p-5">
          <h3 className="panel-title">Monthly trend</h3>
          <div className="mt-5 h-[290px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "#8d93a8", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#8d93a8", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip currency={settings.currency} />} />
                <Area type="monotone" dataKey="amount" stroke="#c4b5fd" fill="rgba(196,181,253,0.12)" strokeWidth={2.4} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </ScreenShell>
  );
}

function HistoryScreen({ transactions, settings }: { transactions: Transaction[]; settings: SettingsState }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const filtered = transactions.filter((tx) => {
    const matchesSearch = `${tx.merchant} ${tx.category} ${tx.method}`.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "all" || tx.status === filter || tx.sourceType === filter;
    return matchesSearch && matchesFilter && tx.status !== "rejected";
  });

  return (
    <ScreenShell title="History" sub="Search every transaction synced through the backend snapshot.">
      <div className="premium-card p-4 sm:p-5">
        <div className="mb-4 grid gap-3 md:grid-cols-[1fr_190px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search merchant, category, method" className="field pl-10" />
          </div>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="field">
            <option value="all">All records</option>
            <option value="saved">Saved</option>
            <option value="needs_review">Needs review</option>
            <option value="manual">Manual</option>
            <option value="receipt_upload">Uploads</option>
            <option value="drive_screenshot">Drive</option>
          </select>
        </div>
        <TransactionList transactions={filtered} currency={settings.currency} />
      </div>
    </ScreenShell>
  );
}

function AssistantScreen({ transactions, chat, settings, onChat }: { transactions: Transaction[]; chat: ChatMessage[]; settings: SettingsState; onChat: (chat: ChatMessage[]) => void }) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const messages = chat.length ? chat : [emptyAssistant];

  async function send(text = input) {
    if (!text.trim()) return;
    const userMessage: ChatMessage = { id: id("user"), from: "user", text };
    const next = [...messages, userMessage];
    onChat(next);
    setInput("");
    setBusy(true);
    try {
      const data = await apiPost("/api/assistant", { question: text, transactions, settings });
      onChat([...next, { id: id("assistant"), from: "assistant", text: data.answer || "I could not generate an answer." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScreenShell title="AI assistant" sub="Ask against your saved local transactions. The backend handles the LLM call.">
      <div className="premium-card flex h-[calc(100vh-220px)] min-h-[560px] max-w-4xl flex-col p-4">
        <div className="flex-1 space-y-4 overflow-y-auto pr-1">
          {messages.map((msg) => (
            <div key={msg.id} className={cx("flex gap-3", msg.from === "user" && "flex-row-reverse")}>
              <div className={cx("grid h-8 w-8 flex-shrink-0 place-items-center rounded-2xl", msg.from === "assistant" ? "bg-cyan-300 text-slate-950" : "bg-white/[0.06] text-muted-foreground")}>
                {msg.from === "assistant" ? <Bot size={15} /> : <User size={15} />}
              </div>
              <div className={cx("max-w-[82%] rounded-3xl px-4 py-3 text-sm leading-6", msg.from === "assistant" ? "border border-white/10 bg-white/[0.04] text-foreground" : "bg-cyan-300 text-slate-950")}>
                {msg.text}
              </div>
            </div>
          ))}
          {busy && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="animate-spin" size={15} />Thinking through your ledger...</div>}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {["Where did I spend most?", "Find subscriptions", "What needs review?", "How can I save more?"].map((item) => (
            <button key={item} onClick={() => send(item)} className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground">{item}</button>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-3xl border border-white/10 bg-white/[0.04] p-2">
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Ask anything about your spending..." className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none" />
          <button onClick={() => send()} disabled={!input.trim() || busy} className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-300 text-slate-950 disabled:opacity-40">
            <Send size={16} />
          </button>
        </div>
      </div>
    </ScreenShell>
  );
}

function SettingsScreen({ settings, onSettings, health, onHealth }: { settings: SettingsState; onSettings: (settings: SettingsState) => void; health: any; onHealth: () => void }) {
  return (
    <ScreenShell title="Settings" sub="UI preferences and backend status. Secrets remain in backend environment files.">
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="premium-card grid gap-4 p-5">
          <Field label="Profile name">
            <input value={settings.profileName} onChange={(e) => onSettings({ ...settings, profileName: e.target.value })} className="field" />
          </Field>
          <Field label="Profile email">
            <input value={settings.profileEmail} onChange={(e) => onSettings({ ...settings, profileEmail: e.target.value })} className="field" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Currency">
              <input value={settings.currency} onChange={(e) => onSettings({ ...settings, currency: e.target.value.toUpperCase() })} className="field" />
            </Field>
            <Field label="Monthly budget">
              <input value={settings.budget} onChange={(e) => onSettings({ ...settings, budget: Number(e.target.value) })} type="number" className="field" />
            </Field>
          </div>
        </div>
        <div className="premium-card p-5">
          <div className="flex items-center justify-between">
            <h3 className="panel-title">Backend health</h3>
            <button onClick={onHealth} className="secondary-button h-9 px-3"><RefreshCw size={14} />Check</button>
          </div>
          <div className="mt-4 grid gap-3">
            {[
              ["Status", health?.ok ? "Online" : "Unknown"],
              ["Provider", health?.provider || "Not checked"],
              ["Model", health?.model || "-"],
              ["Database", health?.database || "autospend.db"],
              ["API key", health?.keyConfigured ? "Configured" : "Not reported"],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-semibold text-foreground">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ScreenShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function ConfidenceBadge({ score }: { score: number }) {
  const color = score >= 90 ? "text-emerald-200 bg-emerald-400/10 border-emerald-300/20" : score >= 75 ? "text-amber-100 bg-amber-400/10 border-amber-300/20" : "text-rose-100 bg-rose-400/10 border-rose-300/20";
  return <span className={cx("rounded-full border px-2.5 py-1 text-[11px] font-semibold", color)}>{score}%</span>;
}

function TransactionList({ transactions, currency, compact = false }: { transactions: Transaction[]; currency: string; compact?: boolean }) {
  if (!transactions.length) return <EmptyState title="No transactions yet" text="Add one manually, parse a receipt, or scan Drive." Icon={CreditCard} />;
  return (
    <div className="overflow-hidden rounded-2xl border border-white/8">
      {transactions.map((tx) => (
        <div key={tx.id} className={cx("grid items-center gap-3 border-b border-white/8 bg-white/[0.02] px-3 last:border-b-0 md:grid-cols-[1fr_150px_130px_120px]", compact ? "py-3" : "py-4")}>
          <div className="min-w-0">
            <p className="truncate font-semibold text-foreground">{tx.merchant}</p>
            <p className="mt-1 truncate text-xs text-muted-foreground">{tx.date} | {sourceLabel(tx.sourceType)} | {tx.method}</p>
          </div>
          <span className="w-fit rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-muted-foreground">{tx.category}</span>
          <span className={cx("text-sm font-semibold capitalize", tx.status === "needs_review" ? "text-amber-200" : tx.status === "duplicate" ? "text-rose-200" : "text-emerald-200")}>{tx.status || "saved"}</span>
          <span className="font-mono text-sm font-bold text-foreground md:text-right">{tx.type === "income" ? "+" : "-"}{money(tx.amount, currency)}</span>
        </div>
      ))}
    </div>
  );
}

function ChartTooltip({ active, payload, label, currency }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl border border-white/10 bg-[#080c16]/95 px-3 py-2 text-xs shadow-2xl">
      {label && <p className="mb-1 text-muted-foreground">{label}</p>}
      {payload.map((item: any) => (
        <p key={item.name || item.dataKey} className="font-mono font-semibold" style={{ color: item.color || item.payload?.color || "#5eead4" }}>
          {item.name || item.dataKey}: {money(Number(item.value), currency)}
        </p>
      ))}
    </div>
  );
}

function getCategoryData(transactions: Transaction[]) {
  const map = new Map<string, number>();
  transactions.forEach((tx) => map.set(tx.category, (map.get(tx.category) || 0) + tx.amount));
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], index) => ({ name, value, color: chartColors[index % chartColors.length] }));
}

function getMonthlyData(transactions: Transaction[], budget = defaultSettings.budget) {
  const months: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months.map((key) => ({
    month: new Date(`${key}-01T00:00:00`).toLocaleDateString("en", { month: "short" }),
    amount: transactions.filter((tx) => tx.type === "expense" && monthKey(tx.date) === key).reduce((sum, tx) => sum + tx.amount, 0),
    budget,
  }));
}

const navItems = [
  { id: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { id: "add", label: "Add", Icon: Plus },
  { id: "review", label: "Review", Icon: Brain },
  { id: "drive", label: "Drive", Icon: HardDrive },
  { id: "reports", label: "Reports", Icon: BarChart3 },
  { id: "history", label: "History", Icon: History },
  { id: "assistant", label: "Assistant", Icon: MessageSquare },
  { id: "settings", label: "Settings", Icon: Settings },
] as const;

function Sidebar({ view, setView, collapsed, setCollapsed, pending, settings, onLogout }: { view: View; setView: (view: View) => void; collapsed: boolean; setCollapsed: (value: boolean) => void; pending: number; settings: SettingsState; onLogout: () => void }) {
  return (
    <aside className={cx("hidden h-screen flex-col border-r border-white/8 bg-sidebar/95 transition-all duration-300 lg:flex", collapsed ? "w-[76px]" : "w-[250px]")}>
      <div className="flex h-16 items-center gap-3 border-b border-white/8 px-4">
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-300 text-slate-950 shadow-[0_0_32px_rgba(94,234,212,0.25)]">
          <Zap size={18} />
        </div>
        {!collapsed && <div><p className="font-bold leading-none">AutoSpend AI</p><p className="mt-1 text-[11px] text-muted-foreground">Premium console</p></div>}
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map(({ id: itemId, label, Icon }) => (
          <button key={itemId} onClick={() => setView(itemId)} className={cx("group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition", view === itemId ? "bg-cyan-300 text-slate-950" : "text-muted-foreground hover:bg-white/[0.05] hover:text-foreground")}>
            <Icon size={17} />
            {!collapsed && <span className="flex-1 text-left">{label}</span>}
            {!collapsed && itemId === "review" && pending > 0 && <span className="rounded-full bg-slate-950/15 px-2 py-0.5 text-[11px]">{pending}</span>}
          </button>
        ))}
      </nav>
      <div className="border-t border-white/8 p-3">
        {!collapsed && (
          <div className="mb-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
            <p className="truncate text-sm font-semibold">{settings.profileName || "Local profile"}</p>
            <p className="truncate text-xs text-muted-foreground">{settings.profileEmail || (settings.googleConnected ? "Google connected" : "Backend protected")}</p>
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={() => setCollapsed(!collapsed)} className="secondary-icon">{collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}</button>
          <button onClick={onLogout} className="secondary-icon"><LogOut size={16} /></button>
        </div>
      </div>
    </aside>
  );
}

function MobileNav({ view, setView, pending }: { view: View; setView: (view: View) => void; pending: number }) {
  const primary = navItems.slice(0, 5);
  return (
    <nav className="fixed inset-x-3 bottom-3 z-30 grid grid-cols-5 rounded-3xl border border-white/10 bg-[#07101c]/95 p-2 shadow-2xl backdrop-blur-xl lg:hidden">
      {primary.map(({ id: itemId, label, Icon }) => (
        <button key={itemId} onClick={() => setView(itemId)} className={cx("relative grid place-items-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-semibold", view === itemId ? "bg-cyan-300 text-slate-950" : "text-muted-foreground")}>
          <Icon size={17} />
          <span className="truncate">{label}</span>
          {itemId === "review" && pending > 0 && <span className="absolute right-2 top-1 h-2 w-2 rounded-full bg-rose-400" />}
        </button>
      ))}
    </nav>
  );
}

export default function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [chat, setChat] = useState<ChatMessage[]>([emptyAssistant]);
  const [settings, setSettings] = useState<SettingsState>(defaultSettings);
  const [view, setView] = useState<View>("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [health, setHealth] = useState<any>(null);

  const authed = settings.localAuthenticated || settings.googleConnected;
  const pending = transactions.filter((tx) => tx.status === "needs_review" || tx.status === "duplicate").length;

  async function syncSnapshot(nextTransactions = transactions, nextQueue = queue, nextChat = chat, nextSettings = settings) {
    const data = await apiPost("/api/data", { transactions: nextTransactions, queue: nextQueue, chat: nextChat, settings: nextSettings });
    if (data.savedAt != null) setSettings((current) => ({ ...current, serverDataSavedAt: Number(data.savedAt) }));
  }

  function updateTransactions(next: Transaction[]) {
    setTransactions(next);
    syncSnapshot(next).catch(() => {});
  }

  function addTx(tx: Transaction) {
    updateTransactions([tx, ...transactions]);
  }

  function addParsed(tx: Transaction, queueItem?: QueueItem) {
    const reviewTx = { ...tx, status: tx.status === "saved" && tx.sourceType !== "cash_text" ? "needs_review" as TransactionStatus : tx.status };
    const nextQueue = queueItem ? [queueItem, ...queue] : queue;
    setQueue(nextQueue);
    setTransactions([reviewTx, ...transactions]);
    syncSnapshot([reviewTx, ...transactions], nextQueue).catch(() => {});
    setView("review");
  }

  function updateSettings(next: SettingsState) {
    setSettings(next);
    syncSnapshot(transactions, queue, chat, next).catch(() => {});
  }

  function updateChat(next: ChatMessage[]) {
    setChat(next);
    syncSnapshot(transactions, queue, next).catch(() => {});
  }

  async function refreshHealth() {
    const data = await apiGet("/api/health");
    setHealth(data);
    setSettings((current) => ({ ...current, aiBackendConnected: Boolean(data.ok) }));
  }

  async function refreshAuth() {
    const data = await apiGet("/api/auth/status");
    setSettings((current) => ({
      ...current,
      googleConnected: Boolean(data.authenticated),
      profileName: data.profile?.name || current.profileName,
      profileEmail: data.profile?.email || current.profileEmail,
    }));
  }

  async function refreshDrive() {
    const data = await apiGet("/api/drive/status");
    setSettings((current) => ({
      ...current,
      driveConnected: Boolean(data.connected),
      driveFolderName: data.folderName || current.driveFolderName,
    }));
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const snapshot = await apiGet("/api/data");
      const snap = snapshot as Snapshot;
      setTransactions(Array.isArray(snap.transactions) ? snap.transactions.map((tx) => normalizeTx(tx, tx.sourceType)) : []);
      setQueue(Array.isArray(snap.queue) ? snap.queue : []);
      setChat(Array.isArray(snap.chat) && snap.chat.length ? snap.chat : [emptyAssistant]);
      setSettings((current) => ({ ...current, ...(snap.settings || {}), serverDataSavedAt: Number(snap.savedAt || current.serverDataSavedAt) }));
      await Promise.all([
        refreshAuth().catch(() => {}),
        refreshDrive().catch(() => {}),
        refreshHealth().catch(() => {}),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reach backend");
    } finally {
      setLoading(false);
    }
  }

  async function googleLogin() {
    setError("");
    try {
      const data = await apiGet("/api/auth/login-url");
      window.open(data.loginUrl, "autospend-user-auth", "width=520,height=720");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start Google sign-in");
    }
  }

  async function logout() {
    if (settings.googleConnected) await apiGet("/api/auth/logout").catch(() => {});
    updateSettings({ ...settings, googleConnected: false, localAuthenticated: false });
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "autospend-user-auth") refreshAuth().catch(() => {});
      if (event.data?.type === "autospend-drive-auth") refreshDrive().catch(() => {});
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const page = useMemo(() => {
    switch (view) {
      case "dashboard":
        return <DashboardScreen transactions={transactions} settings={settings} />;
      case "add":
        return <AddExpenseScreen settings={settings} onAdd={addTx} onParsed={addParsed} />;
      case "review":
        return <ReviewScreen transactions={transactions} settings={settings} onUpdate={updateTransactions} />;
      case "drive":
        return <DriveScreen settings={settings} onSettings={updateSettings} onParsed={addParsed} />;
      case "reports":
        return <ReportsScreen transactions={transactions} settings={settings} />;
      case "history":
        return <HistoryScreen transactions={transactions} settings={settings} />;
      case "assistant":
        return <AssistantScreen transactions={transactions} chat={chat} settings={settings} onChat={updateChat} />;
      case "settings":
        return <SettingsScreen settings={settings} onSettings={updateSettings} health={health} onHealth={refreshHealth} />;
      default:
        return null;
    }
  }, [view, transactions, settings, chat, queue, health]);

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-background text-foreground">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 animate-spin text-cyan-200" size={28} />
          <p className="font-semibold">Connecting to AutoSpend backend</p>
        </div>
      </main>
    );
  }

  if (!authed) {
    return <AuthScreen onLocal={() => updateSettings({ ...settings, localAuthenticated: true })} onGoogle={googleLogin} loading={loading} error={error} />;
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar view={view} setView={setView} collapsed={collapsed} setCollapsed={setCollapsed} pending={pending} settings={settings} onLogout={logout} />
      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-white/8 bg-background/82 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button className="secondary-icon lg:hidden" onClick={() => setView("settings")}><Menu size={16} /></button>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">AutoSpend AI</p>
              <p className="text-sm font-bold text-foreground">{settings.googleConnected ? "Google connected" : "Local workspace"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {error && <span className="hidden items-center gap-2 rounded-full border border-rose-300/20 bg-rose-400/10 px-3 py-1 text-xs text-rose-100 sm:inline-flex"><AlertTriangle size={13} />{error}</span>}
            <button onClick={refreshHealth} className="secondary-icon"><Bell size={16} /></button>
            <button onClick={() => setView("settings")} className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-300 font-bold text-slate-950">
              {(settings.profileName || settings.profileEmail || "A").slice(0, 1).toUpperCase()}
            </button>
          </div>
        </header>
        <div className="px-4 py-5 pb-28 sm:px-6 lg:px-8 lg:pb-8">
          {page}
        </div>
      </main>
      <MobileNav view={view} setView={setView} pending={pending} />
    </div>
  );
}
