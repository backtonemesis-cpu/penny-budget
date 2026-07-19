import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  MONTHS,
  SHORT_MONTHS,
  annualSummary,
  createId,
  dueStatus,
  formatMoney,
  migrateState,
  mkKey,
  monthSummary,
  positiveNumber,
} from "./finance.js";

const C = {
  bg: "#0e1117", surface: "#161b27", elevated: "#1c2233", border: "#252d42",
  text: "#e8eaf0", muted: "#7d86a6", accent: "#60a5fa", green: "#4ecb8d",
  amber: "#f0b429", red: "#f06060", purple: "#a78bfa",
};

const BASE_CATS = [
  { id: "rent", label: "Rent / Mortgage", icon: "🏠", group: "Housing", bill: true },
  { id: "council_tax", label: "Council Tax", icon: "🏛️", group: "Bills", bill: true },
  { id: "electricity", label: "Electricity", icon: "⚡", group: "Bills", bill: true },
  { id: "gas", label: "Gas", icon: "🔥", group: "Bills", bill: true },
  { id: "water", label: "Water", icon: "💧", group: "Bills", bill: true },
  { id: "internet", label: "Broadband / Internet", icon: "🌐", group: "Bills", bill: true },
  { id: "phone_bill", label: "Phone", icon: "📞", group: "Bills", bill: true },
  { id: "child_maintenance", label: "Child Maintenance", icon: "👨‍👦", group: "Bills", bill: true },
  { id: "service_charge", label: "Service Charge", icon: "🏢", group: "Bills", bill: true },
  { id: "ground_rent", label: "Ground Rent", icon: "🏗️", group: "Bills", bill: true },
  { id: "tv_licence", label: "TV Licence", icon: "📺", group: "Bills", bill: true },
  { id: "insurance", label: "Insurance", icon: "🛡️", group: "Bills", bill: true },
  { id: "subscriptions", label: "Subscriptions", icon: "📱", group: "Bills", bill: true },
  { id: "bank_fees", label: "Bank Fees", icon: "🏦", group: "Bills", bill: true },
  { id: "groceries", label: "Groceries", icon: "🛒", group: "Everyday" },
  { id: "coffee_shop", label: "Coffee Shop", icon: "☕", group: "Eating Out" },
  { id: "eating_out", label: "Restaurants / Pubs", icon: "🍽️", group: "Eating Out" },
  { id: "takeaway", label: "Takeaway", icon: "🥡", group: "Eating Out" },
  { id: "fuel", label: "Fuel", icon: "⛽", group: "Transport" },
  { id: "transport", label: "Transport", icon: "🚆", group: "Transport" },
  { id: "clothing", label: "Clothing", icon: "👕", group: "Shopping" },
  { id: "gifts", label: "Gifts", icon: "🎁", group: "Shopping" },
  { id: "health", label: "Health", icon: "❤️", group: "Health" },
  { id: "holidays", label: "Holidays / Travel", icon: "✈️", group: "Other" },
  { id: "other", label: "Other", icon: "📦", group: "Other" },
].map((cat) => ({ ...cat, fixed: true }));

const initialState = migrateState({}, new Date());

function reducer(state, action) {
  switch (action.type) {
    case "RESTORE": return action.state;
    case "ADD_TXN": {
      const rows = state.txnsByMonth[action.monthKey] || [];
      return { ...state, txnsByMonth: { ...state.txnsByMonth, [action.monthKey]: [action.txn, ...rows].sort((a, b) => b.date.localeCompare(a.date)) } };
    }
    case "DELETE_TXN": return {
      ...state,
      txnsByMonth: { ...state.txnsByMonth, [action.monthKey]: (state.txnsByMonth[action.monthKey] || []).filter((txn) => txn.id !== action.id) },
    };
    case "SET_INCOME": return { ...state, incomeByMonth: { ...state.incomeByMonth, [action.monthKey]: action.sources } };
    case "ADD_CAT": return { ...state, customCats: [...state.customCats, action.cat] };
    case "REMOVE_CAT": {
      const { [action.id]: _budget, ...budgets } = state.budgets;
      const { [action.id]: _due, ...dueDays } = state.dueDays;
      return { ...state, customCats: state.customCats.filter((cat) => cat.id !== action.id), hiddenCats: state.hiddenCats.filter((id) => id !== action.id), budgets, dueDays };
    }
    case "TOGGLE_HIDE": return { ...state, hiddenCats: state.hiddenCats.includes(action.id) ? state.hiddenCats.filter((id) => id !== action.id) : [...state.hiddenCats, action.id] };
    case "SET_BUDGET": return { ...state, budgets: { ...state.budgets, [action.id]: positiveNumber(action.value) } };
    case "SET_DUE_DAY": return { ...state, dueDays: { ...state.dueDays, [action.id]: Math.min(Math.max(Number(action.day) || 1, 1), 31) } };
    case "SET_SAVINGS": return { ...state, [action.field]: positiveNumber(action.value) };
    default: return state;
  }
}

const css = `
*{box-sizing:border-box}html,body,#root{margin:0;min-height:100%;background:${C.bg}}body{font-family:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif;color:${C.text}}button,input,select{font:inherit}button{cursor:pointer}.app{min-height:100vh;background:${C.bg};padding-bottom:78px}.header{position:sticky;top:0;z-index:20;background:rgba(14,17,23,.96);backdrop-filter:blur(12px);border-bottom:1px solid ${C.border};padding:12px 14px}.header-row{max-width:760px;margin:auto;display:flex;align-items:center;gap:10px}.brand{font-family:Georgia,serif;font-style:italic;font-size:23px;min-width:72px}.month{flex:1;display:flex;justify-content:center}.month select{background:${C.elevated};color:${C.text};border:1px solid ${C.border};border-radius:20px;padding:7px 12px}.icon-btn,.primary,.ghost,.danger{border-radius:10px;padding:9px 12px;border:1px solid ${C.border};color:${C.text};background:${C.elevated}}.primary{background:${C.accent};border-color:${C.accent};font-weight:700}.ghost{background:transparent}.danger{color:${C.red};background:${C.red}18;border-color:${C.red}55}.content{max-width:760px;margin:auto;padding:14px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.card{background:${C.surface};border:1px solid ${C.border};border-radius:14px;padding:14px;margin-bottom:12px}.stat{min-height:105px}.label{font-size:10px;color:${C.muted};text-transform:uppercase;letter-spacing:.08em}.value{font-family:Georgia,serif;font-style:italic;font-size:23px;margin-top:8px}.sub{font-size:11px;color:${C.muted};margin-top:6px}.section-title{font-family:Georgia,serif;font-style:italic;font-size:19px;margin-bottom:12px}.row{display:flex;align-items:center;gap:9px;padding:10px 0;border-bottom:1px solid ${C.border}88}.row:last-child{border-bottom:0}.grow{flex:1;min-width:0}.ellipsis{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.muted{color:${C.muted};font-size:12px}.money{font-family:Georgia,serif;font-style:italic;white-space:nowrap}.green{color:${C.green}}.amber{color:${C.amber}}.red{color:${C.red}}.field{display:flex;flex-direction:column;gap:5px;margin-bottom:10px}.field label{font-size:10px;color:${C.muted};text-transform:uppercase;letter-spacing:.07em}.field input,.field select{width:100%;background:${C.elevated};border:1px solid ${C.border};border-radius:10px;color:${C.text};padding:11px 12px}.form-grid{display:grid;grid-template-columns:2fr 1fr;gap:9px}.tabs{display:flex;background:${C.elevated};border:1px solid ${C.border};border-radius:12px;padding:4px;margin-bottom:12px}.tabs button{flex:1;border:0;border-radius:9px;padding:9px;background:transparent;color:${C.muted}}.tabs button.active{background:${C.surface};color:${C.text};font-weight:700}.nav{position:fixed;left:0;right:0;bottom:0;z-index:25;background:${C.surface};border-top:1px solid ${C.border};display:flex;padding-bottom:env(safe-area-inset-bottom)}.nav button{flex:1;background:transparent;border:0;color:${C.muted};padding:11px 3px;font-size:11px}.nav button.active{color:${C.accent};border-top:2px solid ${C.accent}}.modal{position:fixed;inset:0;z-index:50;background:${C.bg};overflow:auto}.modal-inner{max-width:620px;margin:auto;padding:18px}.modal-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px}.pill{font-size:10px;padding:3px 8px;border-radius:20px}.empty{text-align:center;color:${C.muted};padding:46px 18px}.bar{height:5px;background:${C.border};border-radius:99px;overflow:hidden;margin-top:7px}.bar>div{height:100%;background:${C.accent}}.actions{display:flex;gap:8px}.actions>*{flex:1}.notice{font-size:12px;color:${C.amber};background:${C.amber}12;border:1px solid ${C.amber}44;border-radius:10px;padding:10px;margin-bottom:12px}@media(min-width:700px){.grid{grid-template-columns:repeat(3,minmax(0,1fr))}.nav{left:50%;transform:translateX(-50%);max-width:760px;border-left:1px solid ${C.border};border-right:1px solid ${C.border}}`;

function App() {
  const now = new Date();
  const [state, dispatch] = useReducer(reducer, initialState);
  const [ready, setReady] = useState(false);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [view, setView] = useState("Overview");
  const [billsTab, setBillsTab] = useState("bills");
  const [modal, setModal] = useState(null);
  const [message, setMessage] = useState("");
  const fileRef = useRef(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("penny_state") || "null");
      if (saved) dispatch({ type: "RESTORE", state: migrateState(saved, new Date()) });
    } catch { setMessage("Saved data could not be read. A fresh session was opened."); }
    setReady(true);
  }, []);
  useEffect(() => { if (ready) localStorage.setItem("penny_state", JSON.stringify(state)); }, [state, ready]);

  const monthKey = mkKey(year, month);
  const summary = useMemo(() => monthSummary(state, monthKey), [state, monthKey]);
  const annual = useMemo(() => annualSummary(state, year), [state, year]);
  const allCats = useMemo(() => [...BASE_CATS, ...state.customCats], [state.customCats]);
  const catMap = useMemo(() => Object.fromEntries(allCats.map((cat) => [cat.id, cat])), [allCats]);
  const visibleCats = allCats.filter((cat) => !state.hiddenCats.includes(cat.id));
  const billCats = allCats.filter((cat) => cat.bill);
  const spentByCat = useMemo(() => {
    const totals = {};
    summary.transactions.filter((txn) => txn.type === "expense").forEach((txn) => { totals[txn.category] = (totals[txn.category] || 0) + txn.amount; });
    return totals;
  }, [summary.transactions]);

  const setMonthValue = (value) => { const [y, m] = value.split("-").map(Number); setYear(y); setMonth(m - 1); };
  const openBudget = () => { setView("Bills"); setBillsTab("budgets"); };
  const addTransaction = (payload) => {
    const amount = positiveNumber(payload.amount);
    if (!amount || !payload.category || !payload.date) return;
    dispatch({ type: "ADD_TXN", monthKey, txn: { id: createId("txn"), type: payload.type, amount, category: payload.category, date: payload.date, desc: payload.desc.trim() || catMap[payload.category]?.label || "Transaction" } });
    setModal(null);
  };
  const categoryInUse = (id) => Object.values(state.txnsByMonth).some((rows) => rows.some((txn) => txn.category === id));

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), app: "Penny", state }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `penny-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(url);
  };
  const importBackup = async (event) => {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      dispatch({ type: "RESTORE", state: migrateState(parsed.state || parsed, new Date()) });
      setMessage("Backup imported successfully."); setModal(null);
    } catch { setMessage("That backup file could not be imported."); }
    event.target.value = "";
  };

  return <div className="app">
    <style>{css}</style>
    <header className="header"><div className="header-row">
      <div className="brand">Penny</div>
      <div className="month"><input aria-label="Selected month" type="month" value={monthKey} min="2020-01" max="2035-12" onChange={(e) => setMonthValue(e.target.value)} style={{ background: C.elevated, color: C.text, border: `1px solid ${C.border}`, borderRadius: 20, padding: "7px 12px" }}/></div>
      <button className="icon-btn" onClick={() => setModal("backup")}>☁︎</button>
      <button className="primary" onClick={() => setModal("add")}>+ Add</button>
    </div></header>

    <main className="content">
      {message && <div className="notice" onClick={() => setMessage("")}>{message}</div>}
      {view === "Overview" && <Overview summary={summary} annual={annual} budgets={state.budgets} spentByCat={spentByCat} catMap={catMap} month={month} year={year} onTransactions={() => setView("Transactions")} onIncome={() => setModal("income")} onBudget={openBudget}/>} 
      {view === "Transactions" && <Transactions transactions={summary.transactions} catMap={catMap} onManage={() => setModal("categories")} onDelete={(id) => dispatch({ type: "DELETE_TXN", monthKey, id })}/>} 
      {view === "Bills" && <Bills state={state} dispatch={dispatch} monthKey={monthKey} year={year} month={month} allCats={allCats} billCats={billCats} spentByCat={spentByCat} transactions={summary.transactions} tab={billsTab} setTab={setBillsTab} addTransaction={addTransaction}/>} 
      {view === "Savings" && <Savings state={state} dispatch={dispatch} annual={annual}/>} 
      {view === "Year" && <Year annual={annual} state={state} year={year} catMap={catMap} onSelectMonth={(m) => { setMonth(m); setView("Overview"); }}/>} 
    </main>

    <nav className="nav">{["Overview","Transactions","Bills","Savings","Year"].map((item) => <button key={item} className={view === item ? "active" : ""} onClick={() => setView(item)}>{item}</button>)}</nav>

    {modal === "add" && <TransactionModal monthKey={monthKey} categories={visibleCats} onClose={() => setModal(null)} onSave={addTransaction}/>} 
    {modal === "income" && <IncomeModal sources={summary.incomeSources} onClose={() => setModal(null)} onSave={(sources) => { dispatch({ type: "SET_INCOME", monthKey, sources }); setModal(null); }}/>} 
    {modal === "backup" && <SimpleModal title="Backup and restore" onClose={() => setModal(null)}><div className="notice">Penny remains separate from your Excel tracker. These controls only back up this app.</div><div className="actions"><button className="primary" onClick={exportBackup}>Export backup</button><button className="ghost" onClick={() => fileRef.current?.click()}>Import backup</button></div><input ref={fileRef} type="file" accept="application/json" hidden onChange={importBackup}/></SimpleModal>}
    {modal === "categories" && <CategoryModal categories={allCats} state={state} dispatch={dispatch} categoryInUse={categoryInUse} onClose={() => setModal(null)}/>} 
  </div>;
}

function Overview({ summary, annual, budgets, spentByCat, catMap, month, year, onTransactions, onIncome, onBudget }) {
  const top = Object.entries(spentByCat).sort((a, b) => b[1] - a[1]);
  const totalBudget = Object.values(budgets).reduce((sum, value) => sum + (Number(value) || 0), 0);
  return <>
    <div className="grid">
      <Stat label="Income" value={formatMoney(summary.income)} color={C.green} sub="This month" onClick={onIncome}/>
      <Stat label="Gross spending" value={formatMoney(summary.expenses)} color={C.amber} sub="Before refunds" onClick={onTransactions}/>
      <Stat label="Refunds / credits" value={formatMoney(summary.refunds)} color={C.green} sub="Returned money" onClick={onTransactions}/>
      <Stat label="Available" value={formatMoney(summary.available)} color={summary.available >= 0 ? C.green : C.red} sub="Income + refunds − spending"/>
      <Stat label={`${year} available`} value={formatMoney(annual.available)} color={annual.available >= 0 ? C.green : C.red} sub={`${annual.withData.length} months recorded`}/>
      <Stat label="Budgets" value={totalBudget ? formatMoney(totalBudget) : "Set up"} color={C.accent} sub="Open budget controls" onClick={onBudget}/>
    </div>
    <div className="card"><div className="section-title">Spending — {MONTHS[month]} {year}</div>{top.length ? top.map(([id, amount]) => <div className="row" key={id}><span>{catMap[id]?.icon || "📦"}</span><div className="grow ellipsis">{catMap[id]?.label || id}</div><div className="money">{formatMoney(amount)}</div></div>) : <div className="empty">No spending recorded for this month.</div>}</div>
  </>;
}

function Stat({ label, value, sub, color, onClick }) { return <div className="card stat" onClick={onClick} style={{ cursor: onClick ? "pointer" : "default" }}><div className="label">{label}</div><div className="value" style={{ color }}>{value}</div><div className="sub">{sub}</div></div>; }

function Transactions({ transactions, catMap, onDelete, onManage }) {
  const [search, setSearch] = useState("");
  const filtered = transactions.filter((txn) => `${txn.desc} ${catMap[txn.category]?.label || ""}`.toLowerCase().includes(search.toLowerCase()));
  return <><div className="card"><div className="actions"><div className="field" style={{ flex: 1, margin: 0 }}><label>Search</label><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Merchant or category"/></div><button className="ghost" style={{ flex: "0 0 auto", alignSelf: "end" }} onClick={onManage}>Categories</button></div></div><div className="card"><div className="section-title">Transactions</div>{filtered.length ? filtered.map((txn) => <div className="row" key={txn.id}><span>{txn.type === "refund" ? "↩️" : catMap[txn.category]?.icon || "📦"}</span><div className="grow"><div className="ellipsis">{txn.desc}</div><div className="muted">{txn.date} · {catMap[txn.category]?.label || txn.category}</div></div><div className={`money ${txn.type === "refund" ? "green" : ""}`}>{txn.type === "refund" ? formatMoney(txn.amount, { plus: true }) : formatMoney(-txn.amount)}</div><button className="danger" onClick={() => onDelete(txn.id)}>×</button></div>) : <div className="empty">No matching transactions.</div>}</div></>;
}

function Bills({ state, dispatch, monthKey, year, month, allCats, billCats, spentByCat, transactions, tab, setTab, addTransaction }) {
  const logged = new Set(transactions.filter((txn) => txn.type === "expense").map((txn) => txn.category));
  const pending = billCats.filter((cat) => (state.budgets[cat.id] || 0) > 0 && !logged.has(cat.id));
  const logBill = (cat) => addTransaction({ type: "expense", amount: state.budgets[cat.id], category: cat.id, date: `${monthKey}-${String(Math.min(state.dueDays[cat.id] || 1, new Date(year, month + 1, 0).getDate())).padStart(2, "0")}`, desc: cat.label });
  return <>
    <div className="tabs"><button className={tab === "bills" ? "active" : ""} onClick={() => setTab("bills")}>Bills</button><button className={tab === "budgets" ? "active" : ""} onClick={() => setTab("budgets")}>Budgets</button></div>
    {tab === "bills" ? <div className="card"><div className="section-title">Monthly bills</div>{billCats.map((cat) => {
      const budget = state.budgets[cat.id] || 0; const paid = logged.has(cat.id); const status = dueStatus(year, month, state.dueDays[cat.id] || 1, paid);
      return <div className="row" key={cat.id}><span>{cat.icon}</span><div className="grow"><div>{cat.label}</div><div className={`muted ${status.tone}`}>{status.label}</div></div><input aria-label={`${cat.label} due day`} type="number" min="1" max="31" value={state.dueDays[cat.id] || 1} onChange={(e) => dispatch({ type: "SET_DUE_DAY", id: cat.id, day: e.target.value })} style={{ width: 54, background: C.elevated, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: 7 }}/><div className="money">{formatMoney(budget)}</div>{budget > 0 && !paid && <button className="primary" onClick={() => logBill(cat)}>Paid</button>}</div>;
    })}{pending.length > 1 && <button className="primary" style={{ width: "100%", marginTop: 12 }} onClick={() => pending.forEach(logBill)}>Log all {pending.length} pending bills</button>}</div> : <BudgetList categories={allCats} budgets={state.budgets} spentByCat={spentByCat} dispatch={dispatch}/>} 
  </>;
}

function BudgetList({ categories, budgets, spentByCat, dispatch }) { return <div className="card"><div className="section-title">Monthly budgets</div>{categories.map((cat) => { const budget = budgets[cat.id] || 0; const spent = spentByCat[cat.id] || 0; const pct = budget ? Math.min(spent / budget * 100, 100) : 0; return <div key={cat.id} style={{ marginBottom: 13 }}><div className="row" style={{ borderBottom: 0, paddingBottom: 4 }}><span>{cat.icon}</span><div className="grow ellipsis">{cat.label}</div><span className="muted">{formatMoney(spent)} /</span><input type="number" min="0" step="0.01" value={budget || ""} placeholder="0" onChange={(e) => dispatch({ type: "SET_BUDGET", id: cat.id, value: e.target.value })} style={{ width: 90, background: C.elevated, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: 7 }}/></div>{budget > 0 && <div className="bar"><div style={{ width: `${pct}%`, background: spent > budget ? C.red : C.green }}/></div>}</div>; })}</div>; }

function Savings({ state, dispatch, annual }) {
  const remaining = Math.max(state.savingsGoal - state.savingsBal, 0); const months = state.savingsContrib > 0 ? Math.ceil(remaining / state.savingsContrib) : null;
  return <><div className="card"><div className="section-title">Savings goal</div><div className="grid"><NumberField label="Goal" value={state.savingsGoal} onChange={(value) => dispatch({ type: "SET_SAVINGS", field: "savingsGoal", value })}/><NumberField label="Saved" value={state.savingsBal} onChange={(value) => dispatch({ type: "SET_SAVINGS", field: "savingsBal", value })}/><NumberField label="Monthly" value={state.savingsContrib} onChange={(value) => dispatch({ type: "SET_SAVINGS", field: "savingsContrib", value })}/></div><div className="row"><div className="grow">Remaining</div><div className="money">{formatMoney(remaining)}</div></div><div className="row"><div className="grow">Forecast</div><div className="money green">{remaining === 0 ? "Goal reached" : months ? `${months} months` : "Set contribution"}</div></div></div><div className="card"><div className="section-title">Recorded annual surplus</div><div className={`value ${annual.available >= 0 ? "green" : "red"}`}>{formatMoney(annual.available)}</div><div className="sub">This is calculated from recorded app income, refunds and spending. It does not automatically change the saved balance.</div></div></>;
}

function NumberField({ label, value, onChange }) { return <div className="field"><label>{label}</label><input type="number" min="0" step="0.01" value={value} onChange={(e) => onChange(e.target.value)}/></div>; }

function Year({ annual, state, year, catMap, onSelectMonth }) {
  const catTotals = {}; annual.months.forEach((item) => item.transactions.filter((txn) => txn.type === "expense").forEach((txn) => { catTotals[txn.category] = (catTotals[txn.category] || 0) + txn.amount; }));
  return <><div className="grid"><Stat label={`${year} income`} value={formatMoney(annual.income)} color={C.green} sub={`${annual.withData.length} months`}/><Stat label={`${year} spending`} value={formatMoney(annual.expenses)} color={C.amber} sub="Gross spending"/><Stat label={`${year} refunds`} value={formatMoney(annual.refunds)} color={C.green} sub="Credits returned"/><Stat label={`${year} available`} value={formatMoney(annual.available)} color={annual.available >= 0 ? C.green : C.red} sub="Income + refunds − spending"/></div><div className="card"><div className="section-title">Month by month</div>{annual.months.map((item) => <div className="row" key={item.key} onClick={() => onSelectMonth(item.month)} style={{ cursor: "pointer", opacity: item.hasData ? 1 : .45 }}><div style={{ width: 34 }}>{SHORT_MONTHS[item.month]}</div><div className="grow muted">{item.hasData ? `${formatMoney(item.income)} in · ${formatMoney(item.expenses)} out` : "No data"}</div><div className={`money ${item.available >= 0 ? "green" : "red"}`}>{item.hasData ? formatMoney(item.available, { plus: true }) : "—"}</div></div>)}</div><div className="card"><div className="section-title">Spending by category</div>{Object.entries(catTotals).sort((a,b) => b[1] - a[1]).map(([id, total]) => <div className="row" key={id}><span>{catMap[id]?.icon || "📦"}</span><div className="grow">{catMap[id]?.label || id}</div><div className="money">{formatMoney(total)}</div></div>)}</div></>;
}

function TransactionModal({ monthKey, categories, onClose, onSave }) {
  const [type, setType] = useState("expense"); const [desc, setDesc] = useState(""); const [amount, setAmount] = useState(""); const [category, setCategory] = useState(""); const [date, setDate] = useState(monthKey === new Date().toISOString().slice(0,7) ? new Date().toISOString().slice(0,10) : `${monthKey}-01`);
  return <SimpleModal title="Add transaction" onClose={onClose}><div className="tabs"><button className={type === "expense" ? "active" : ""} onClick={() => setType("expense")}>Expense</button><button className={type === "refund" ? "active" : ""} onClick={() => setType("refund")}>Refund / credit</button></div><div className="form-grid"><div className="field"><label>Description</label><input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Merchant or note"/></div><div className="field"><label>Amount</label><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"/></div></div><div className="field"><label>Category</label><select value={category} onChange={(e) => setCategory(e.target.value)}><option value="">Select category</option>{categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.icon} {cat.label}</option>)}</select></div><div className="field"><label>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)}/></div><div className="actions"><button className="ghost" onClick={onClose}>Cancel</button><button className="primary" onClick={() => onSave({ type, desc, amount, category, date })}>Save</button></div></SimpleModal>;
}

function IncomeModal({ sources, onClose, onSave }) {
  const [rows, setRows] = useState(sources.map((source) => ({ ...source })));
  const add = () => setRows([...rows, { id: createId("income"), label: "", amount: 0 }]);
  return <SimpleModal title="Monthly income" onClose={onClose}><div className="notice">Income entered here belongs only to the selected month. Editing it will not rewrite earlier months.</div>{rows.map((row, index) => <div className="form-grid" key={row.id}><div className="field"><label>Source</label><input value={row.label} onChange={(e) => setRows(rows.map((item, i) => i === index ? { ...item, label: e.target.value } : item))}/></div><div className="field"><label>Amount</label><input inputMode="decimal" value={row.amount} onChange={(e) => setRows(rows.map((item, i) => i === index ? { ...item, amount: e.target.value } : item))}/></div><button className="danger" style={{ marginBottom: 10 }} onClick={() => setRows(rows.filter((_, i) => i !== index))}>Remove</button></div>)}<button className="ghost" style={{ width: "100%", marginBottom: 12 }} onClick={add}>+ Add income source</button><div className="actions"><button className="ghost" onClick={onClose}>Cancel</button><button className="primary" onClick={() => onSave(rows.filter((row) => row.label.trim() && positiveNumber(row.amount)).map((row) => ({ ...row, label: row.label.trim(), amount: positiveNumber(row.amount), icon: row.icon || "💼", color: row.color || C.green })))}>Save month</button></div></SimpleModal>;
}

function CategoryModal({ categories, state, dispatch, categoryInUse, onClose }) { const [name, setName] = useState(""); const add = () => { if (!name.trim()) return; dispatch({ type: "ADD_CAT", cat: { id: createId("cat"), label: name.trim(), icon: "🏷️", group: "Other", fixed: false } }); setName(""); }; return <SimpleModal title="Categories" onClose={onClose}><div className="actions" style={{ marginBottom: 12 }}><input value={name} onChange={(e) => setName(e.target.value)} placeholder="New category" style={{ flex: 1, background: C.elevated, color: C.text, border: `1px solid ${C.border}`, borderRadius: 10, padding: 11 }}/><button className="primary" style={{ flex: "0 0 auto" }} onClick={add}>Add</button></div>{categories.map((cat) => { const custom = !cat.fixed; const inUse = categoryInUse(cat.id); return <div className="row" key={cat.id}><span>{cat.icon}</span><div className="grow">{cat.label}</div><button className="ghost" onClick={() => dispatch({ type: "TOGGLE_HIDE", id: cat.id })}>{state.hiddenCats.includes(cat.id) ? "Show" : "Hide"}</button>{custom && <button className="danger" disabled={inUse} title={inUse ? "Category is used by transactions" : "Delete category"} onClick={() => !inUse && dispatch({ type: "REMOVE_CAT", id: cat.id })}>{inUse ? "In use" : "Delete"}</button>}</div>; })}</SimpleModal>; }

function SimpleModal({ title, onClose, children }) { return <div className="modal"><div className="modal-inner"><div className="modal-head"><div className="section-title" style={{ margin: 0 }}>{title}</div><button className="ghost" onClick={onClose}>Done</button></div>{children}</div></div>; }

export default App;
