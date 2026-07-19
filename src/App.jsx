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
  bg: "#0e1117",
  surface: "#161b27",
  elevated: "#1c2233",
  border: "#252d42",
  text: "#e8eaf0",
  muted: "#7d86a6",
  accent: "#60a5fa",
  green: "#4ecb8d",
  amber: "#f0b429",
  red: "#f06060",
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
    case "RESTORE":
      return action.state;
    case "ADD_TXN": {
      const rows = state.txnsByMonth[action.monthKey] || [];
      return {
        ...state,
        txnsByMonth: {
          ...state.txnsByMonth,
          [action.monthKey]: [action.txn, ...rows].sort((a, b) => b.date.localeCompare(a.date)),
        },
      };
    }
    case "DELETE_TXN":
      return {
        ...state,
        txnsByMonth: {
          ...state.txnsByMonth,
          [action.monthKey]: (state.txnsByMonth[action.monthKey] || []).filter((txn) => txn.id !== action.id),
        },
      };
    case "SET_INCOME":
      return { ...state, incomeByMonth: { ...state.incomeByMonth, [action.monthKey]: action.sources } };
    case "ADD_CAT":
      return { ...state, customCats: [...state.customCats, action.cat] };
    case "REMOVE_CAT": {
      const { [action.id]: _budget, ...budgets } = state.budgets;
      const { [action.id]: _due, ...dueDays } = state.dueDays;
      return {
        ...state,
        customCats: state.customCats.filter((cat) => cat.id !== action.id),
        hiddenCats: state.hiddenCats.filter((id) => id !== action.id),
        budgets,
        dueDays,
      };
    }
    case "TOGGLE_HIDE":
      return {
        ...state,
        hiddenCats: state.hiddenCats.includes(action.id)
          ? state.hiddenCats.filter((id) => id !== action.id)
          : [...state.hiddenCats, action.id],
      };
    case "SET_BUDGET":
      return { ...state, budgets: { ...state.budgets, [action.id]: positiveNumber(action.value) } };
    case "SET_DUE_DAY": {
      const dueDays = { ...state.dueDays };
      if (action.day === "" || action.day === null || action.day === undefined) {
        delete dueDays[action.id];
      } else {
        dueDays[action.id] = Math.min(Math.max(Number(action.day) || 1, 1), 31);
      }
      return { ...state, dueDays };
    }
    case "SET_SAVINGS":
      return { ...state, [action.field]: positiveNumber(action.value) };
    default:
      return state;
  }
}

const css = `
*{box-sizing:border-box;min-width:0}
html,body,#root{margin:0;width:100%;max-width:100%;min-height:100%;overflow-x:hidden;background:${C.bg}}
body{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:${C.text};overscroll-behavior-x:none}
button,input,select{font:inherit;max-width:100%}
button{cursor:pointer;-webkit-tap-highlight-color:transparent}
.app{width:100%;max-width:100vw;min-height:100vh;overflow-x:hidden;background:${C.bg};padding-bottom:calc(70px + env(safe-area-inset-bottom))}
.header{position:sticky;top:0;z-index:20;width:100%;background:rgba(14,17,23,.96);backdrop-filter:blur(12px);border-bottom:1px solid ${C.border};padding:10px 12px}
.header-row{width:100%;max-width:760px;margin:0 auto;display:grid;grid-template-columns:64px minmax(0,1fr) 42px 62px;align-items:center;gap:7px}
.brand{font-family:Georgia,serif;font-style:italic;font-size:22px;line-height:1;white-space:nowrap;overflow:hidden}
.month{width:100%;min-width:0}
.month-input{display:block;width:100%;min-width:0;height:42px;-webkit-appearance:none;appearance:none;background:${C.elevated};color:${C.text};border:1px solid ${C.border};border-radius:21px;padding:7px 10px;text-align:center;font-weight:650;color-scheme:dark}
.icon-btn,.primary,.ghost,.danger{min-height:42px;border-radius:11px;padding:8px 10px;border:1px solid ${C.border};color:${C.text};background:${C.elevated}}
.icon-btn{width:42px;padding:0;display:grid;place-items:center}
.add-btn{width:62px;padding:8px 5px;white-space:nowrap}
.primary{background:${C.accent};border-color:${C.accent};font-weight:750}
.ghost{background:transparent}
.danger{color:${C.red};background:${C.red}18;border-color:${C.red}55}
.content{width:100%;max-width:760px;margin:0 auto;padding:12px;overflow-x:hidden}
.grid{width:100%;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.card{width:100%;max-width:100%;overflow:hidden;background:${C.surface};border:1px solid ${C.border};border-radius:16px;padding:14px;margin-bottom:12px}
.stat{min-height:116px;display:flex;flex-direction:column;justify-content:flex-start}
.label{font-size:10px;line-height:1.35;color:${C.muted};text-transform:uppercase;letter-spacing:.08em;overflow-wrap:anywhere}
.value{font-family:Georgia,serif;font-style:italic;font-size:clamp(22px,6.6vw,28px);line-height:1.08;margin-top:9px;overflow-wrap:anywhere}
.sub{font-size:11px;line-height:1.35;color:${C.muted};margin-top:auto;padding-top:8px;overflow-wrap:anywhere}
.section-title{font-family:Georgia,serif;font-style:italic;font-size:22px;line-height:1.15;margin-bottom:14px;overflow-wrap:anywhere}
.row{width:100%;display:flex;align-items:center;gap:9px;padding:10px 0;border-bottom:1px solid ${C.border}88}
.row:last-child{border-bottom:0}
.grow{flex:1;min-width:0}
.ellipsis{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.muted{color:${C.muted};font-size:12px;line-height:1.35}
.neutral{color:${C.muted}}
.money{font-family:Georgia,serif;font-style:italic;white-space:nowrap}
.green{color:${C.green}}
.amber{color:${C.amber}}
.red{color:${C.red}}
.field{display:flex;flex-direction:column;gap:5px;margin-bottom:10px;min-width:0}
.field label,.mini-label{font-size:10px;color:${C.muted};text-transform:uppercase;letter-spacing:.07em}
.field input,.field select,.number-input{width:100%;min-width:0;background:${C.elevated};border:1px solid ${C.border};border-radius:10px;color:${C.text};padding:11px 12px}
.form-grid{width:100%;display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:9px}
.tabs{width:100%;display:flex;background:${C.elevated};border:1px solid ${C.border};border-radius:13px;padding:4px;margin-bottom:12px}
.tabs button{flex:1;border:0;border-radius:9px;padding:10px 8px;background:transparent;color:${C.muted};font-weight:600}
.tabs button.active{background:${C.surface};color:${C.text};font-weight:750}
.search-actions{width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:9px}
.search-actions .field{margin:0}
.nav{position:fixed;left:0;right:0;bottom:0;z-index:25;width:100%;max-width:760px;margin:0 auto;overflow:hidden;background:${C.surface};border-top:1px solid ${C.border};display:grid;grid-template-columns:repeat(5,minmax(0,1fr));padding-bottom:env(safe-area-inset-bottom)}
.nav button{min-width:0;background:transparent;border:0;color:${C.muted};padding:12px 2px 10px;font-size:10.5px;white-space:nowrap;overflow:hidden;text-overflow:clip}
.nav button.active{color:${C.accent};box-shadow:inset 0 2px 0 ${C.accent}}
.modal{position:fixed;inset:0;z-index:50;width:100%;max-width:100vw;background:${C.bg};overflow-x:hidden;overflow-y:auto}
.modal-inner{width:100%;max-width:620px;margin:0 auto;padding:16px}
.modal-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px}
.empty{text-align:center;color:${C.muted};padding:42px 14px;line-height:1.45}
.bar{height:5px;background:${C.border};border-radius:99px;overflow:hidden;margin-top:7px}
.bar>div{height:100%;background:${C.accent}}
.actions{width:100%;display:flex;gap:8px;min-width:0}
.actions>*{flex:1;min-width:0}
.notice{font-size:12px;line-height:1.45;color:${C.amber};background:${C.amber}12;border:1px solid ${C.amber}44;border-radius:10px;padding:10px;margin-bottom:12px}
.bill-list{padding-top:4px}
.bill-row{width:100%;display:grid;grid-template-columns:34px minmax(0,1fr) auto;align-items:center;gap:10px;padding:13px 0;border-bottom:1px solid ${C.border}88}
.bill-row:last-child{border-bottom:0}
.bill-icon{font-size:22px;text-align:center}
.bill-name{font-size:15px;font-weight:650;line-height:1.25;overflow-wrap:anywhere}
.bill-status{margin-top:3px;font-size:11px;font-weight:650;line-height:1.2}
.bill-controls{display:grid;grid-template-columns:48px 68px;align-items:end;justify-content:end;gap:7px}
.due-control{display:flex;flex-direction:column;gap:3px}
.due-input{width:48px;height:40px;text-align:center;background:${C.elevated};color:${C.text};border:1px solid ${C.border};border-radius:9px;padding:6px}
.bill-amount{min-width:68px;text-align:right;font-size:16px;align-self:center}
.paid-btn{grid-column:1/-1;min-height:34px;padding:5px 8px}
.budget-row{display:grid;grid-template-columns:28px minmax(0,1fr) auto;align-items:center;gap:8px;padding:9px 0}
.budget-control{width:88px}
.savings-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.savings-grid .field:last-child{grid-column:1/-1;max-width:50%}
.forecast-value{text-align:right;white-space:normal}
.year-row{opacity:1}
.year-row.no-data{opacity:.67}
@media(max-width:430px){
  .header{padding:9px 10px}
  .header-row{grid-template-columns:58px minmax(0,1fr) 40px 56px;gap:6px}
  .brand{font-size:20px}
  .month-input{height:40px;padding:6px 7px;font-size:15px}
  .icon-btn{width:40px;min-height:40px}
  .add-btn{width:56px;min-height:40px;font-size:13px}
  .content{padding:10px}
  .card{padding:13px;border-radius:15px}
  .stat{min-height:112px}
  .section-title{font-size:21px}
  .bill-row{grid-template-columns:30px minmax(0,1fr) auto;gap:8px}
  .bill-controls{grid-template-columns:44px 62px;gap:6px}
  .due-input{width:44px}
  .bill-amount{min-width:62px;font-size:15px}
}
@media(max-width:370px){
  .header-row{grid-template-columns:50px minmax(0,1fr) 38px 50px;gap:5px}
  .brand{font-size:18px}
  .icon-btn{width:38px}
  .add-btn{width:50px;font-size:0}
  .add-btn::after{content:"+";font-size:22px}
  .grid{gap:8px}
  .card{padding:11px}
  .stat{min-height:108px}
  .search-actions{grid-template-columns:1fr}
  .search-actions button{width:100%}
  .bill-row{grid-template-columns:28px minmax(0,1fr)}
  .bill-controls{grid-column:2;justify-self:stretch;grid-template-columns:48px minmax(68px,1fr)}
  .bill-amount{text-align:right}
  .savings-grid{grid-template-columns:1fr}
  .savings-grid .field:last-child{grid-column:auto;max-width:none}
}
@media(max-width:420px){
  .form-grid{grid-template-columns:1fr}
}
@media(min-width:700px){
  .grid{grid-template-columns:repeat(3,minmax(0,1fr))}
  .nav{border-left:1px solid ${C.border};border-right:1px solid ${C.border}}
  .savings-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
  .savings-grid .field:last-child{grid-column:auto;max-width:none}
}
`;

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
    } catch {
      setMessage("Saved data could not be read. A fresh session was opened.");
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem("penny_state", JSON.stringify(state));
  }, [state, ready]);

  const monthKey = mkKey(year, month);
  const summary = useMemo(() => monthSummary(state, monthKey), [state, monthKey]);
  const annual = useMemo(() => annualSummary(state, year), [state, year]);
  const allCats = useMemo(() => [...BASE_CATS, ...state.customCats], [state.customCats]);
  const catMap = useMemo(() => Object.fromEntries(allCats.map((cat) => [cat.id, cat])), [allCats]);
  const visibleCats = allCats.filter((cat) => !state.hiddenCats.includes(cat.id));
  const billCats = allCats.filter((cat) => cat.bill);
  const spentByCat = useMemo(() => {
    const totals = {};
    summary.transactions
      .filter((txn) => txn.type === "expense")
      .forEach((txn) => {
        totals[txn.category] = (totals[txn.category] || 0) + txn.amount;
      });
    return totals;
  }, [summary.transactions]);

  const setMonthValue = (value) => {
    const [selectedYear, selectedMonth] = value.split("-").map(Number);
    setYear(selectedYear);
    setMonth(selectedMonth - 1);
  };

  const openBudget = () => {
    setView("Bills");
    setBillsTab("budgets");
  };

  const addTransaction = (payload) => {
    const amount = positiveNumber(payload.amount);
    if (!amount || !payload.category || !payload.date) return;
    dispatch({
      type: "ADD_TXN",
      monthKey,
      txn: {
        id: createId("txn"),
        type: payload.type,
        amount,
        category: payload.category,
        date: payload.date,
        desc: payload.desc.trim() || catMap[payload.category]?.label || "Transaction",
      },
    });
    setModal(null);
  };

  const categoryInUse = (id) =>
    Object.values(state.txnsByMonth).some((rows) => rows.some((txn) => txn.category === id));

  const exportBackup = () => {
    const blob = new Blob(
      [JSON.stringify({ exportedAt: new Date().toISOString(), app: "Penny", state }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `penny-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importBackup = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      dispatch({ type: "RESTORE", state: migrateState(parsed.state || parsed, new Date()) });
      setMessage("Backup imported successfully.");
      setModal(null);
    } catch {
      setMessage("That backup file could not be imported.");
    }
    event.target.value = "";
  };

  return (
    <div className="app">
      <style>{css}</style>
      <header className="header">
        <div className="header-row">
          <div className="brand">Penny</div>
          <div className="month">
            <input
              className="month-input"
              aria-label="Selected month"
              type="month"
              value={monthKey}
              min="2020-01"
              max="2035-12"
              onChange={(event) => setMonthValue(event.target.value)}
            />
          </div>
          <button className="icon-btn" aria-label="Backup and restore" onClick={() => setModal("backup")}>☁︎</button>
          <button className="primary add-btn" onClick={() => setModal("add")}>+ Add</button>
        </div>
      </header>

      <main className="content">
        {message && <div className="notice" onClick={() => setMessage("")}>{message}</div>}
        {view === "Overview" && (
          <Overview
            summary={summary}
            annual={annual}
            budgets={state.budgets}
            spentByCat={spentByCat}
            catMap={catMap}
            month={month}
            year={year}
            onTransactions={() => setView("Transactions")}
            onIncome={() => setModal("income")}
            onBudget={openBudget}
          />
        )}
        {view === "Transactions" && (
          <Transactions
            transactions={summary.transactions}
            catMap={catMap}
            onManage={() => setModal("categories")}
            onDelete={(id) => dispatch({ type: "DELETE_TXN", monthKey, id })}
          />
        )}
        {view === "Bills" && (
          <Bills
            state={state}
            dispatch={dispatch}
            monthKey={monthKey}
            year={year}
            month={month}
            allCats={allCats}
            billCats={billCats}
            spentByCat={spentByCat}
            transactions={summary.transactions}
            tab={billsTab}
            setTab={setBillsTab}
            addTransaction={addTransaction}
          />
        )}
        {view === "Savings" && <Savings state={state} dispatch={dispatch} annual={annual} />}
        {view === "Year" && (
          <Year
            annual={annual}
            year={year}
            catMap={catMap}
            onSelectMonth={(selectedMonth) => {
              setMonth(selectedMonth);
              setView("Overview");
            }}
          />
        )}
      </main>

      <nav className="nav">
        {["Overview", "Transactions", "Bills", "Savings", "Year"].map((item) => (
          <button key={item} className={view === item ? "active" : ""} onClick={() => setView(item)}>{item}</button>
        ))}
      </nav>

      {modal === "add" && (
        <TransactionModal monthKey={monthKey} categories={visibleCats} onClose={() => setModal(null)} onSave={addTransaction} />
      )}
      {modal === "income" && (
        <IncomeModal
          sources={summary.incomeSources}
          onClose={() => setModal(null)}
          onSave={(sources) => {
            dispatch({ type: "SET_INCOME", monthKey, sources });
            setModal(null);
          }}
        />
      )}
      {modal === "backup" && (
        <SimpleModal title="Backup and restore" onClose={() => setModal(null)}>
          <div className="notice">Penny remains separate from your Excel tracker. These controls only back up this app.</div>
          <div className="actions">
            <button className="primary" onClick={exportBackup}>Export backup</button>
            <button className="ghost" onClick={() => fileRef.current?.click()}>Import backup</button>
          </div>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={importBackup} />
        </SimpleModal>
      )}
      {modal === "categories" && (
        <CategoryModal
          categories={allCats}
          state={state}
          dispatch={dispatch}
          categoryInUse={categoryInUse}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

function Overview({ summary, annual, budgets, spentByCat, catMap, month, year, onTransactions, onIncome, onBudget }) {
  const top = Object.entries(spentByCat).sort((a, b) => b[1] - a[1]);
  const totalBudget = Object.values(budgets).reduce((sum, value) => sum + (Number(value) || 0), 0);

  return (
    <>
      <div className="grid">
        <Stat label="Income" value={formatMoney(summary.income)} color={C.green} sub="This month" onClick={onIncome} />
        <Stat label="Gross spending" value={formatMoney(summary.expenses)} color={C.amber} sub="Before refunds" onClick={onTransactions} />
        <Stat label="Refunds / credits" value={formatMoney(summary.refunds)} color={C.green} sub="Returned money" onClick={onTransactions} />
        <Stat label="Available" value={formatMoney(summary.available)} color={summary.available >= 0 ? C.green : C.red} sub="Income + refunds − spending" />
        <Stat label={`${year} available`} value={formatMoney(annual.available)} color={annual.available >= 0 ? C.green : C.red} sub={`${annual.withData.length} months recorded`} />
        <Stat label="Budgets" value={totalBudget ? formatMoney(totalBudget) : "Set up"} color={C.accent} sub="Open budget controls" onClick={onBudget} />
      </div>
      <div className="card">
        <div className="section-title">Spending — {MONTHS[month]} {year}</div>
        {top.length ? (
          top.map(([id, amount]) => (
            <div className="row" key={id}>
              <span>{catMap[id]?.icon || "📦"}</span>
              <div className="grow ellipsis">{catMap[id]?.label || id}</div>
              <div className="money">{formatMoney(amount)}</div>
            </div>
          ))
        ) : (
          <div className="empty">No spending recorded for this month.</div>
        )}
      </div>
    </>
  );
}

function Stat({ label, value, sub, color, onClick }) {
  return (
    <div className="card stat" onClick={onClick} style={{ cursor: onClick ? "pointer" : "default" }}>
      <div className="label">{label}</div>
      <div className="value" style={{ color }}>{value}</div>
      <div className="sub">{sub}</div>
    </div>
  );
}

function Transactions({ transactions, catMap, onDelete, onManage }) {
  const [search, setSearch] = useState("");
  const filtered = transactions.filter((txn) =>
    `${txn.desc} ${catMap[txn.category]?.label || ""}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
      <div className="card">
        <div className="search-actions">
          <div className="field">
            <label>Search</label>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Merchant or category" />
          </div>
          <button className="ghost" onClick={onManage}>Categories</button>
        </div>
      </div>
      <div className="card">
        <div className="section-title">Transactions</div>
        {filtered.length ? (
          filtered.map((txn) => (
            <div className="row" key={txn.id}>
              <span>{txn.type === "refund" ? "↩️" : catMap[txn.category]?.icon || "📦"}</span>
              <div className="grow">
                <div className="ellipsis">{txn.desc}</div>
                <div className="muted">{txn.date} · {catMap[txn.category]?.label || txn.category}</div>
              </div>
              <div className={`money ${txn.type === "refund" ? "green" : ""}`}>
                {txn.type === "refund" ? formatMoney(txn.amount, { plus: true }) : formatMoney(-txn.amount)}
              </div>
              <button className="danger" aria-label={`Delete ${txn.desc}`} onClick={() => onDelete(txn.id)}>×</button>
            </div>
          ))
        ) : (
          <div className="empty">No matching transactions.</div>
        )}
      </div>
    </>
  );
}

function Bills({ state, dispatch, monthKey, year, month, allCats, billCats, spentByCat, transactions, tab, setTab, addTransaction }) {
  const logged = new Set(transactions.filter((txn) => txn.type === "expense").map((txn) => txn.category));
  const pending = billCats.filter((cat) => (state.budgets[cat.id] || 0) > 0 && !logged.has(cat.id));

  const logBill = (cat) => {
    const dueDay = state.dueDays[cat.id] || 1;
    addTransaction({
      type: "expense",
      amount: state.budgets[cat.id],
      category: cat.id,
      date: `${monthKey}-${String(Math.min(dueDay, new Date(year, month + 1, 0).getDate())).padStart(2, "0")}`,
      desc: cat.label,
    });
  };

  return (
    <>
      <div className="tabs">
        <button className={tab === "bills" ? "active" : ""} onClick={() => setTab("bills")}>Bills</button>
        <button className={tab === "budgets" ? "active" : ""} onClick={() => setTab("budgets")}>Budgets</button>
      </div>
      {tab === "bills" ? (
        <div className="card bill-list">
          <div className="section-title">Monthly bills</div>
          {billCats.map((cat) => {
            const budget = state.budgets[cat.id] || 0;
            const configured = budget > 0;
            const paid = logged.has(cat.id);
            const dueDay = state.dueDays[cat.id] || "";
            const status = configured
              ? dueStatus(year, month, dueDay || 1, paid)
              : { label: "Not configured", tone: "neutral" };

            return (
              <div className="bill-row" key={cat.id}>
                <div className="bill-icon">{cat.icon}</div>
                <div>
                  <div className="bill-name">{cat.label}</div>
                  <div className={`bill-status ${status.tone}`}>{status.label}</div>
                </div>
                <div className="bill-controls">
                  <label className="due-control">
                    <span className="mini-label">Due</span>
                    <input
                      className="due-input"
                      aria-label={`${cat.label} due day`}
                      type="number"
                      inputMode="numeric"
                      min="1"
                      max="31"
                      value={dueDay}
                      placeholder="—"
                      onChange={(event) => dispatch({ type: "SET_DUE_DAY", id: cat.id, day: event.target.value })}
                    />
                  </label>
                  <div className="bill-amount money">{configured ? formatMoney(budget) : "—"}</div>
                  {configured && !paid && (
                    <button className="primary paid-btn" onClick={() => logBill(cat)}>Mark paid</button>
                  )}
                </div>
              </div>
            );
          })}
          {pending.length > 1 && (
            <button className="primary" style={{ width: "100%", marginTop: 12 }} onClick={() => pending.forEach(logBill)}>
              Mark all {pending.length} pending bills paid
            </button>
          )}
        </div>
      ) : (
        <BudgetList categories={allCats} budgets={state.budgets} spentByCat={spentByCat} dispatch={dispatch} />
      )}
    </>
  );
}

function BudgetList({ categories, budgets, spentByCat, dispatch }) {
  return (
    <div className="card">
      <div className="section-title">Monthly budgets</div>
      {categories.map((cat) => {
        const budget = budgets[cat.id] || 0;
        const spent = spentByCat[cat.id] || 0;
        const pct = budget ? Math.min((spent / budget) * 100, 100) : 0;
        return (
          <div key={cat.id} style={{ marginBottom: 13 }}>
            <div className="budget-row">
              <span>{cat.icon}</span>
              <div className="grow ellipsis">{cat.label}</div>
              <input
                className="number-input budget-control"
                aria-label={`${cat.label} budget`}
                type="number"
                min="0"
                step="0.01"
                value={budget || ""}
                placeholder="£0"
                onChange={(event) => dispatch({ type: "SET_BUDGET", id: cat.id, value: event.target.value })}
              />
            </div>
            <div className="muted">Spent {formatMoney(spent)}{budget ? ` of ${formatMoney(budget)}` : " · no budget set"}</div>
            {budget > 0 && (
              <div className="bar"><div style={{ width: `${pct}%`, background: spent > budget ? C.red : C.green }} /></div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Savings({ state, dispatch, annual }) {
  const goalSet = state.savingsGoal > 0;
  const remaining = goalSet ? Math.max(state.savingsGoal - state.savingsBal, 0) : 0;
  const months = goalSet && remaining > 0 && state.savingsContrib > 0
    ? Math.ceil(remaining / state.savingsContrib)
    : null;
  const forecast = !goalSet
    ? { text: "Set a savings goal", tone: "neutral" }
    : remaining === 0
      ? { text: "Goal reached", tone: "green" }
      : months
        ? { text: `${months} months`, tone: "green" }
        : { text: "Set contribution", tone: "amber" };

  return (
    <>
      <div className="card">
        <div className="section-title">Savings goal</div>
        <div className="savings-grid">
          <NumberField label="Goal" value={state.savingsGoal} onChange={(value) => dispatch({ type: "SET_SAVINGS", field: "savingsGoal", value })} />
          <NumberField label="Saved" value={state.savingsBal} onChange={(value) => dispatch({ type: "SET_SAVINGS", field: "savingsBal", value })} />
          <NumberField label="Monthly" value={state.savingsContrib} onChange={(value) => dispatch({ type: "SET_SAVINGS", field: "savingsContrib", value })} />
        </div>
        <div className="row">
          <div className="grow">Remaining</div>
          <div className="money">{goalSet ? formatMoney(remaining) : "—"}</div>
        </div>
        <div className="row">
          <div className="grow">Forecast</div>
          <div className={`money forecast-value ${forecast.tone}`}>{forecast.text}</div>
        </div>
      </div>
      <div className="card">
        <div className="section-title">Recorded annual surplus</div>
        <div className={`value ${annual.available >= 0 ? "green" : "red"}`}>{formatMoney(annual.available)}</div>
        <div className="sub">Calculated from recorded app income, refunds and spending. It does not automatically change the saved balance.</div>
      </div>
    </>
  );
}

function NumberField({ label, value, onChange }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input
        type="number"
        inputMode="decimal"
        min="0"
        step="0.01"
        value={value || ""}
        placeholder="0.00"
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function Year({ annual, year, catMap, onSelectMonth }) {
  const catTotals = {};
  annual.months.forEach((item) =>
    item.transactions
      .filter((txn) => txn.type === "expense")
      .forEach((txn) => {
        catTotals[txn.category] = (catTotals[txn.category] || 0) + txn.amount;
      }),
  );

  return (
    <>
      <div className="grid">
        <Stat label={`${year} income`} value={formatMoney(annual.income)} color={C.green} sub={`${annual.withData.length} months`} />
        <Stat label={`${year} spending`} value={formatMoney(annual.expenses)} color={C.amber} sub="Gross spending" />
        <Stat label={`${year} refunds`} value={formatMoney(annual.refunds)} color={C.green} sub="Credits returned" />
        <Stat label={`${year} available`} value={formatMoney(annual.available)} color={annual.available >= 0 ? C.green : C.red} sub="Income + refunds − spending" />
      </div>
      <div className="card">
        <div className="section-title">Month by month</div>
        {annual.months.map((item) => (
          <div
            className={`row year-row ${item.hasData ? "" : "no-data"}`}
            key={item.key}
            onClick={() => onSelectMonth(item.month)}
            style={{ cursor: "pointer" }}
          >
            <div style={{ width: 34, fontWeight: 650 }}>{SHORT_MONTHS[item.month]}</div>
            <div className="grow muted">
              {item.hasData ? `${formatMoney(item.income)} in · ${formatMoney(item.expenses)} out` : "No data"}
            </div>
            <div className={`money ${item.hasData ? (item.available >= 0 ? "green" : "red") : "neutral"}`}>
              {item.hasData ? formatMoney(item.available, { plus: true }) : "—"}
            </div>
          </div>
        ))}
      </div>
      <div className="card">
        <div className="section-title">Spending by category</div>
        {Object.entries(catTotals).length ? (
          Object.entries(catTotals)
            .sort((a, b) => b[1] - a[1])
            .map(([id, total]) => (
              <div className="row" key={id}>
                <span>{catMap[id]?.icon || "📦"}</span>
                <div className="grow">{catMap[id]?.label || id}</div>
                <div className="money">{formatMoney(total)}</div>
              </div>
            ))
        ) : (
          <div className="empty">No spending categories recorded for {year}.</div>
        )}
      </div>
    </>
  );
}

function TransactionModal({ monthKey, categories, onClose, onSave }) {
  const [type, setType] = useState("expense");
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(
    monthKey === new Date().toISOString().slice(0, 7)
      ? new Date().toISOString().slice(0, 10)
      : `${monthKey}-01`,
  );

  return (
    <SimpleModal title="Add transaction" onClose={onClose}>
      <div className="tabs">
        <button className={type === "expense" ? "active" : ""} onClick={() => setType("expense")}>Expense</button>
        <button className={type === "refund" ? "active" : ""} onClick={() => setType("refund")}>Refund / credit</button>
      </div>
      <div className="form-grid">
        <div className="field">
          <label>Description</label>
          <input value={desc} onChange={(event) => setDesc(event.target.value)} placeholder="Merchant or note" />
        </div>
        <div className="field">
          <label>Amount</label>
          <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" />
        </div>
      </div>
      <div className="field">
        <label>Category</label>
        <select value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="">Select category</option>
          {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.icon} {cat.label}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Date</label>
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </div>
      <div className="actions">
        <button className="ghost" onClick={onClose}>Cancel</button>
        <button className="primary" onClick={() => onSave({ type, desc, amount, category, date })}>Save</button>
      </div>
    </SimpleModal>
  );
}

function IncomeModal({ sources, onClose, onSave }) {
  const [rows, setRows] = useState(sources.map((source) => ({ ...source })));
  const add = () => setRows([...rows, { id: createId("income"), label: "", amount: "" }]);

  return (
    <SimpleModal title="Monthly income" onClose={onClose}>
      <div className="notice">Income entered here belongs only to the selected month. Editing it will not rewrite earlier months.</div>
      {rows.map((row, index) => (
        <div className="form-grid" key={row.id}>
          <div className="field">
            <label>Source</label>
            <input
              value={row.label}
              onChange={(event) => setRows(rows.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))}
            />
          </div>
          <div className="field">
            <label>Amount</label>
            <input
              inputMode="decimal"
              value={row.amount}
              onChange={(event) => setRows(rows.map((item, itemIndex) => itemIndex === index ? { ...item, amount: event.target.value } : item))}
            />
          </div>
          <button className="danger" style={{ marginBottom: 10 }} onClick={() => setRows(rows.filter((_, itemIndex) => itemIndex !== index))}>Remove</button>
        </div>
      ))}
      <button className="ghost" style={{ width: "100%", marginBottom: 12 }} onClick={add}>+ Add income source</button>
      <div className="actions">
        <button className="ghost" onClick={onClose}>Cancel</button>
        <button
          className="primary"
          onClick={() => onSave(
            rows
              .filter((row) => row.label.trim() && positiveNumber(row.amount))
              .map((row) => ({
                ...row,
                label: row.label.trim(),
                amount: positiveNumber(row.amount),
                icon: row.icon || "💼",
                color: row.color || C.green,
              })),
          )}
        >
          Save month
        </button>
      </div>
    </SimpleModal>
  );
}

function CategoryModal({ categories, state, dispatch, categoryInUse, onClose }) {
  const [name, setName] = useState("");
  const add = () => {
    if (!name.trim()) return;
    dispatch({
      type: "ADD_CAT",
      cat: { id: createId("cat"), label: name.trim(), icon: "🏷️", group: "Other", fixed: false },
    });
    setName("");
  };

  return (
    <SimpleModal title="Categories" onClose={onClose}>
      <div className="actions" style={{ marginBottom: 12 }}>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="New category"
          style={{ flex: 1, background: C.elevated, color: C.text, border: `1px solid ${C.border}`, borderRadius: 10, padding: 11 }}
        />
        <button className="primary" style={{ flex: "0 0 auto" }} onClick={add}>Add</button>
      </div>
      {categories.map((cat) => {
        const custom = !cat.fixed;
        const inUse = categoryInUse(cat.id);
        return (
          <div className="row" key={cat.id}>
            <span>{cat.icon}</span>
            <div className="grow">{cat.label}</div>
            <button className="ghost" onClick={() => dispatch({ type: "TOGGLE_HIDE", id: cat.id })}>
              {state.hiddenCats.includes(cat.id) ? "Show" : "Hide"}
            </button>
            {custom && (
              <button
                className="danger"
                disabled={inUse}
                title={inUse ? "Category is used by transactions" : "Delete category"}
                onClick={() => !inUse && dispatch({ type: "REMOVE_CAT", id: cat.id })}
              >
                {inUse ? "In use" : "Delete"}
              </button>
            )}
          </div>
        );
      })}
    </SimpleModal>
  );
}

function SimpleModal({ title, onClose, children }) {
  return (
    <div className="modal">
      <div className="modal-inner">
        <div className="modal-head">
          <div className="section-title" style={{ margin: 0 }}>{title}</div>
          <button className="ghost" onClick={onClose}>Done</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default App;
