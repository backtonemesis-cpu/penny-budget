import { useState, useMemo, useReducer, useCallback, useRef, useEffect } from "react";

const fontStyle = `@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap'); *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; } html, body { background: #0e1117 !important; } ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: #2a2d3a; border-radius: 4px; } @keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } } .card { animation: fadeUp 0.38s ease both; } input:focus, select:focus { outline: 1px solid #5b8cff !important; } input, select { font-size: 16px !important; } input[type="date"] { width:100% !important; box-sizing:border-box !important; -webkit-appearance:none !important; appearance:none !important; color-scheme:dark; }`;

const MONTH_THEMES = [
{ bg:"#0e1117", surface:"#161b27", elevated:"#1c2233", border:"#252d42", accent:"#60a5fa", name:"❄️ Winter", header:"linear-gradient(135deg, #0c1a3a 0%, #0e2147 50%, #1a1035 100%)" },
{ bg:"#0e1117", surface:"#161b27", elevated:"#1c2233", border:"#252d42", accent:"#a78bfa", name:"❄️ Winter", header:"linear-gradient(135deg, #160d35 0%, #1e0f45 50%, #0f1230 100%)" },
{ bg:"#0e1117", surface:"#161b27", elevated:"#1c2233", border:"#252d42", accent:"#4ade80", name:"🌱 Spring", header:"linear-gradient(135deg, #052210 0%, #073d18 50%, #0a2818 100%)" },
{ bg:"#0e1117", surface:"#161b27", elevated:"#1c2233", border:"#252d42", accent:"#f472b6", name:"🌸 Spring", header:"linear-gradient(135deg, #2d0a1e 0%, #3d0f28 50%, #200a1a 100%)" },
{ bg:"#0e1117", surface:"#161b27", elevated:"#1c2233", border:"#252d42", accent:"#34d399", name:"🌿 Spring", header:"linear-gradient(135deg, #042d1a 0%, #064a28 50%, #073520 100%)" },
{ bg:"#0e1117", surface:"#161b27", elevated:"#1c2233", border:"#252d42", accent:"#fbbf24", name:"☀️ Summer", header:"linear-gradient(135deg, #2a1a00 0%, #3d2800 50%, #281500 100%)" },
{ bg:"#0e1117", surface:"#161b27", elevated:"#1c2233", border:"#252d42", accent:"#f97316", name:"🌞 Summer", header:"linear-gradient(135deg, #2d1000 0%, #451800 50%, #2a0e00 100%)" },
{ bg:"#0e1117", surface:"#161b27", elevated:"#1c2233", border:"#252d42", accent:"#fb7185", name:"🌊 Summer", header:"linear-gradient(135deg, #2d0a10 0%, #420e18 50%, #280810 100%)" },
{ bg:"#0e1117", surface:"#161b27", elevated:"#1c2233", border:"#252d42", accent:"#fb923c", name:"🍂 Autumn", header:"linear-gradient(135deg, #2d1200 0%, #441c00 50%, #2a1000 100%)" },
{ bg:"#0e1117", surface:"#161b27", elevated:"#1c2233", border:"#252d42", accent:"#ea580c", name:"🎃 Autumn", header:"linear-gradient(135deg, #280a00 0%, #3d1000 50%, #220800 100%)" },
{ bg:"#0e1117", surface:"#161b27", elevated:"#1c2233", border:"#252d42", accent:"#d97706", name:"🍁 Autumn", header:"linear-gradient(135deg, #221200 0%, #351a00 50%, #1e1000 100%)" },
{ bg:"#0e1117", surface:"#161b27", elevated:"#1c2233", border:"#252d42", accent:"#818cf8", name:"🎄 Winter", header:"linear-gradient(135deg, #0d0d2e 0%, #15103d 50%, #0a0a25 100%)" },
];

const getTheme = (month) => MONTH_THEMES[month] || MONTH_THEMES[0];

const C = {
bg:"#0e1117", surface:"#161b27", elevated:"#1c2233", border:"#252d42",
text:"#e8eaf0", muted:"#6b7494", accent:"#5b8cff",
green:"#4ecb8d", amber:"#f0b429", red:"#f06060",
};

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const SHORT_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const BASE_CATS = [
{ id:"rent",          label:"Rent / Mortgage",    icon:"🏠", color:"#7b9cff", group:"Housing",       fixed:true },
{ id:"council_tax",   label:"Council Tax",        icon:"🏛️", color:"#c084fc", group:"Bills",         fixed:true },
{ id:"electricity",   label:"Electricity",        icon:"⚡", color:"#f0b429", group:"Bills",         fixed:true },
{ id:"gas",           label:"Gas",                icon:"🔥", color:"#f08c30", group:"Bills",         fixed:true },
{ id:"water",         label:"Water",              icon:"💧", color:"#60c4f0", group:"Bills",         fixed:true },
{ id:"internet",      label:"Internet",           icon:"🌐", color:"#7b9cff", group:"Bills",         fixed:true },
{ id:"phone_bill",    label:"Phone Bill",         icon:"📞", color:"#a78bfa", group:"Bills",         fixed:true },
{ id:"service_charge", label:"Service Charge", icon:"🏢", color:"#94a3b8", group:"Bills", fixed:true, bill:true },
{ id:"ground_rent",    label:"Ground Rent",     icon:"🏗", color:"#94a3b8", group:"Bills", fixed:true, bill:true },
{ id:"tv_licence",     label:"TV Licence",      icon:"📺", color:"#60c4f0", group:"Bills", fixed:true, bill:true },
{ id:"insurance",      label:"Insurance",       icon:"🛡", color:"#34d399", group:"Bills", fixed:true, bill:true },
{ id:"groceries",     label:"Groceries",          icon:"🛒", color:"#4ecb8d", group:"Groceries",     fixed:true },
{ id:"coffee_shop",   label:"Coffee Shop",        icon:"☕", color:"#c4874a", group:"Eating Out",    fixed:true },
{ id:"eating_out",    label:"Restaurants / Pubs", icon:"🍽️", color:"#f06060", group:"Eating Out",    fixed:true },
{ id:"takeaway",      label:"Takeaway / Delivery",icon:"🥡", color:"#ff8c42", group:"Eating Out",    fixed:true },
{ id:"fuel",          label:"Fuel / Petrol",      icon:"⛽", color:"#e63946", group:"Transport",     fixed:true },
{ id:"transport",     label:"Transport (Other)",  icon:"🚆", color:"#f0b429", group:"Transport",     fixed:true },
{ id:"clothing",      label:"Clothing",           icon:"👕", color:"#a78bfa", group:"Shopping",      fixed:true },
{ id:"charity_shop",  label:"Charity Shop",       icon:"💝", color:"#f472b6", group:"Shopping",      fixed:true },
{ id:"gifts",         label:"Gifts",              icon:"🎁", color:"#f472b6", group:"Shopping",      fixed:true },
{ id:"health",        label:"Health & NHS",       icon:"❤️", color:"#ff8fa3", group:"Health",        fixed:true },
{ id:"gym",           label:"Gym / Fitness",      icon:"🏋️", color:"#34d399", group:"Health",        fixed:true },
{ id:"subscriptions", label:"Subscriptions",      icon:"📱", color:"#60c4f0", group:"Subscriptions", fixed:true, bill:true },
{ id:"holidays",      label:"Holidays / Travel",  icon:"✈️", color:"#fb923c", group:"Other",         fixed:true },
{ id:"other",         label:"Other",              icon:"📦", color:"#94a3b8", group:"Other",         fixed:true },
];

const CAT_GROUPS = ["Housing","Bills","Groceries","Eating Out","Transport","Shopping","Health","Subscriptions","Other"];

const SEED_SOURCES = [];
const SEED_TXN = {};
const INITIAL_BUDGETS = {};

const INITIAL_STATE = {
txnsByMonth: SEED_TXN,
sources: SEED_SOURCES,
customCats: [],
deletedBuiltins: [],
hiddenCats: [],
budgets: INITIAL_BUDGETS,
savingsGoal: 25000,
savingsBal: 11400,
savingsContrib: 500,
};

function appReducer(state, action) {
switch (action.type) {
case "**RESTORE**": return action.snapshot;
case "ADD_TXN": {
const prev = state.txnsByMonth[action.monthKey] || [];
const next = [action.txn, ...prev].sort((a,b)=>b.date.localeCompare(a.date));
return { ...state, txnsByMonth: { ...state.txnsByMonth, [action.monthKey]: next }, savingsBal: action.txn.category==="savings" ? state.savingsBal+action.txn.amount : state.savingsBal };
}
case "DELETE_TXN": {
const existing = state.txnsByMonth[action.monthKey]||[];
const removed  = existing.find(t=>t.id===action.id);
const next     = existing.filter(t=>t.id!==action.id);
const newBal   = removed?.category==="savings" ? state.savingsBal - removed.amount : state.savingsBal;
return { ...state, txnsByMonth: { ...state.txnsByMonth, [action.monthKey]: next }, savingsBal: newBal };
}
case "UPDATE_SOURCE_AMT": return { ...state, sources: state.sources.map(s=>s.id===action.id?{...s,amount:action.amount}:s) };
case "REMOVE_SOURCE":     return { ...state, sources: state.sources.filter(s=>s.id!==action.id) };
case "ADD_SOURCE":        return { ...state, sources: [...state.sources, action.source] };
case "ADD_CUSTOM_CAT":    return { ...state, customCats: [...state.customCats, action.cat] };
case "REMOVE_CUSTOM_CAT": return { ...state, customCats: state.customCats.filter(c=>c.id!==action.id) };
case "DELETE_BUILTIN_CAT": return { ...state, deletedBuiltins:[...state.deletedBuiltins,action.id], hiddenCats:state.hiddenCats.filter(id=>id!==action.id) };
case "TOGGLE_HIDE_CAT":   return { ...state, hiddenCats: state.hiddenCats.includes(action.id) ? state.hiddenCats.filter(id=>id!==action.id) : [...state.hiddenCats,action.id] };
case "SHOW_ALL_CATS":     return { ...state, hiddenCats: [] };
case "HIDE_ALL_CATS":     return { ...state, hiddenCats: action.allIds };
case "SET_BUDGET":        return { ...state, budgets: { ...state.budgets, [action.id]: action.value } };
case "SET_SAVINGS_GOAL":   return { ...state, savingsGoal: action.value };
case "SET_SAVINGS_CONTRIB": return { ...state, savingsContrib: action.value };
case "SET_SAVINGS_BAL":   return { ...state, savingsBal: action.value };
default: return state;
}
}

function useUndoReducer(reducer, initialState) {
const [state, rawDispatch] = useReducer(reducer, initialState);
const [snapshots, setSnapshots] = useState([]);
const dispatch = useCallback((action, currentState) => {
if (currentState !== undefined) setSnapshots(prev => [...prev.slice(-19), currentState]);
rawDispatch(action);
}, [rawDispatch]);
const undo = useCallback(() => {
if (snapshots.length === 0) return;
rawDispatch({ type: "**RESTORE**", snapshot: snapshots[snapshots.length - 1] });
setSnapshots(prev => prev.slice(0, -1));
}, [snapshots, rawDispatch]);
return { state, dispatch, undo, canUndo: snapshots.length > 0 };
}

const fmt = n => "£" + Math.abs(n).toLocaleString("en-GB",{minimumFractionDigits:2,maximumFractionDigits:2});
function mkKey(y,m){ return y+"-"+String(m+1).padStart(2,"0"); }
const groupBy = (arr, key) => arr.reduce((acc,c)=>{ (acc[c[key]]=(acc[c[key]]||[])).push(c); return acc; }, {});

function IncomeBar({source, total}){
const pct = total>0 ? Math.min((source.amount/total)*100, 100) : 0;
return (
<div style={{marginBottom:15}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
<span style={{fontSize:14,display:"flex",gap:8,alignItems:"center",fontWeight:500}}>
<span style={{width:30,height:30,borderRadius:8,background:source.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,flexShrink:0}}>{source.icon}</span>
{source.label}
</span>
<div style={{textAlign:"right"}}>
<span style={{fontSize:16,fontWeight:600,color:source.color,fontFamily:"DM Serif Display",fontStyle:"italic"}}>{fmt(source.amount)}</span>
<span style={{fontSize:11,color:C.muted,marginLeft:6}}>{pct.toFixed(0)}%</span>
</div>
</div>
<div style={{height:6,borderRadius:99,background:C.border,overflow:"hidden"}}>
<div style={{height:"100%",borderRadius:99,width:pct+"%",background:source.color,transition:"width 0.8s ease"}}/>
</div>
</div>
);
}

function MonthPicker({year, month, onChange, accent}){
const [open, setOpen] = useState(false);
const [pickerYear, setPickerYear] = useState(year);
return (
<div style={{position:"relative"}}>
<button onClick={()=>{ setPickerYear(year); setOpen(o=>!o); }}
style={{width:120,display:"flex",alignItems:"center",justifyContent:"space-between",gap:4,background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:20,padding:"5px 12px",cursor:"pointer",color:"#fff",fontFamily:"DM Sans",backdropFilter:"blur(8px)"}}>
<span style={{fontFamily:"DM Serif Display",fontStyle:"italic",fontSize:13,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{SHORT_MONTHS[month]} {year}</span>
<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{flexShrink:0,opacity:0.7}}><path d="M6 9l6 6 6-6"/></svg>
</button>
{open && (
<div style={{position:"fixed",inset:0,zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 20px"}} onClick={()=>setOpen(false)}>
<div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(2px)"}}/>
<div onClick={e=>e.stopPropagation()} style={{position:"relative",background:C.surface,border:"1px solid "+C.border,borderRadius:18,padding:20,width:"100%",maxWidth:320,boxShadow:"0 16px 48px #00000099"}}>
<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
<button onClick={()=>setPickerYear(y=>y-1)} style={{background:"transparent",border:"1px solid "+C.border,color:C.muted,borderRadius:7,padding:"6px 16px",cursor:"pointer",fontSize:16}}>‹</button>
<span style={{fontFamily:"DM Serif Display",fontStyle:"italic",fontSize:20,color:C.text}}>{pickerYear}</span>
<button onClick={()=>setPickerYear(y=>y+1)} style={{background:"transparent",border:"1px solid "+C.border,color:C.muted,borderRadius:7,padding:"6px 16px",cursor:"pointer",fontSize:16}}>›</button>
</div>
<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
{SHORT_MONTHS.map((m,i) => {
const isCur = pickerYear===year && i===month;
return (
<button key={i} onClick={()=>{ onChange(pickerYear,i); setOpen(false); }}
style={{padding:"12px 4px",borderRadius:10,border:"none",cursor:"pointer",fontFamily:"DM Sans",fontSize:14,fontWeight:isCur?600:400,background:isCur?(accent||C.accent):C.elevated,color:isCur?"#fff":C.text}}>
{m}
</button>
);
})}
</div>
<button onClick={()=>setOpen(false)} style={{marginTop:14,width:"100%",padding:"10px",background:"transparent",border:"1px solid "+C.border,borderRadius:10,color:C.muted,fontFamily:"DM Sans",fontSize:13,cursor:"pointer"}}>Cancel</button>
</div>
</div>
)}
</div>
);
}

function BudgetInput({ catId, initialValue, color, onSave, S, C }) {
const [val, setVal] = useState(String(initialValue || 0));
const [focused, setFocused] = useState(false);
const prev = useRef(initialValue);
if (prev.current !== initialValue) { prev.current = initialValue; setVal(String(initialValue || 0)); }
return (
<input style={{...S.inp, flex:1, padding:"7px 10px", fontSize:13}}
type="text" inputMode="decimal" pattern="[0-9.]*"
autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
value={focused ? val : (val === "0" ? "" : val)} placeholder="0"
onFocus={() => { setFocused(true); setVal(""); }}
onChange={e => setVal(e.target.value)}
onBlur={() => { setFocused(false); const p = parseFloat(val)||0; setVal(String(p)); onSave(p); }}
/>
);
}

function ClearOnFocusInput({ initialValue, onSave, style, placeholder="0" }) {
const [val, setVal] = useState(String(initialValue || 0));
const [focused, setFocused] = useState(false);
const prev = useRef(initialValue);
if (prev.current !== initialValue) { prev.current = initialValue; setVal(String(initialValue || 0)); }
return (
<input style={style} type="text" inputMode="decimal"
autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
value={focused ? val : (val === "0" ? "" : val)} placeholder={placeholder}
onFocus={() => { setFocused(true); setVal(""); }}
onChange={e => setVal(e.target.value)}
onBlur={() => { setFocused(false); const p = parseFloat(val)||0; setVal(String(p)); onSave(p); }}
/>
);
}

function AddSourceForm({ onAdd, onCancel, S, C }) {
const [label, setLabel] = useState("");
const [amount, setAmount] = useState("");
const handle = () => { if (!label || !amount) return; onAdd({ id:"c_"+Date.now(), label, icon:"💼", color:"#5b8cff", amount:parseFloat(amount) }); };
return (
<div style={{background:C.bg,borderRadius:10,padding:14,border:"1px solid "+C.accent}}>
<div style={{marginBottom:10}}><label style={S.lbl}>Source name</label>
<input style={S.inp} placeholder="e.g. Salary, Freelance" value={label} onChange={e=>setLabel(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handle()}/>
</div>
<div style={{marginBottom:12}}><label style={S.lbl}>Monthly amount (£)</label>
<input style={S.inp} type="text" inputMode="decimal" placeholder="0.00" autoComplete="off" value={amount} onChange={e=>setAmount(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handle()}/>
</div>
<div style={{display:"flex",gap:8}}>
<button style={{...S.btn,flex:1}} onClick={handle}>Add</button>
<button style={{...S.ghost,flex:1,textAlign:"center"}} onClick={onCancel}>Cancel</button>
</div>
</div>
);
}

function CatPickerWithSearch({ catSelectGroups, category, onSelect, onClose, C, S }) {
const [search, setSearch] = useState("");
const q = search.toLowerCase().trim();
const filtered = q ? catSelectGroups.map(([grp,cats])=>[grp,cats.filter(c=>c.label.toLowerCase().includes(q))]).filter(([,cats])=>cats.length>0) : catSelectGroups;
return (
<div style={{background:C.bg,borderRadius:12,border:"1px solid "+C.accent,overflow:"hidden"}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 14px",borderBottom:"1px solid "+C.border}}>
<span style={{fontFamily:"DM Serif Display",fontStyle:"italic",fontSize:15,color:C.text}}>Select Category</span>
<button onClick={onClose} style={{background:"transparent",border:"none",color:C.muted,fontSize:20,cursor:"pointer",padding:"0 4px",lineHeight:1}}>×</button>
</div>
<div style={{padding:"10px 14px",borderBottom:"1px solid "+C.border,background:C.elevated}}>
<input style={{...S.inp,background:C.bg,fontSize:14,padding:"8px 12px"}} placeholder="Search categories…" value={search} onChange={e=>setSearch(e.target.value)} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}/>
</div>
<div style={{maxHeight:340,overflowY:"auto"}}>
{filtered.length===0 ? <div style={{padding:"20px 14px",textAlign:"center",fontSize:13,color:C.muted}}>No categories match "{search}"</div>
: filtered.map(([grp,cats])=>(
<div key={grp}>
{!q && <div style={{fontSize:10,color:C.muted,fontWeight:600,letterSpacing:"0.08em",padding:"8px 14px 4px",background:C.elevated,textTransform:"uppercase"}}>{grp}</div>}
{cats.map(c=>(
<button key={c.id} onClick={()=>onSelect(c.id)} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:C.bg,border:"none",borderBottom:"1px solid "+C.border+"44",cursor:"pointer"}}>
<span style={{fontSize:14,color:category===c.id?C.accent:C.text,fontFamily:"DM Sans",fontWeight:category===c.id?600:400,display:"flex",alignItems:"center",gap:8}}>
<span style={{fontSize:14,width:18,textAlign:"center",flexShrink:0}}>{c.icon}</span>{c.label}
</span>
{category===c.id && <span style={{color:C.accent,fontSize:14}}>✓</span>}
</button>
))}
</div>
))}
</div>
</div>
);
}

function AddCategoryForm({ onAdd, onCancel, S, C, CAT_GROUPS }) {
const [label, setLabel] = useState("");
const [group, setGroup] = useState("Other");
const [showGrpPick, setShowGrpPick] = useState(false);
const handle = () => { if (!label.trim()) return; onAdd({ label:label.trim(), group, icon:"🏷️" }); setLabel(""); setGroup("Other"); };
if (showGrpPick) return (
<div style={{background:C.bg,borderRadius:12,border:"1px solid "+C.accent,overflow:"hidden"}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 16px",borderBottom:"1px solid "+C.border}}>
<span style={{fontFamily:"DM Serif Display",fontStyle:"italic",fontSize:16,color:C.text}}>Select Group</span>
<button onClick={()=>setShowGrpPick(false)} style={{background:"transparent",border:"none",color:C.muted,fontSize:22,cursor:"pointer",padding:"0 4px",lineHeight:1}}>×</button>
</div>
<div style={{maxHeight:360,overflowY:"auto"}}>
{CAT_GROUPS.map(g=>(
<button key={g} onClick={()=>{setGroup(g);setShowGrpPick(false);}} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",background:C.bg,border:"none",borderBottom:"1px solid "+C.border+"55",cursor:"pointer"}}>
<span style={{fontSize:15,color:group===g?C.accent:C.text,fontFamily:"DM Sans",fontWeight:group===g?600:400}}>{g}</span>
{group===g && <span style={{color:C.accent,fontSize:16}}>✓</span>}
</button>
))}
</div>
</div>
);
return (
<div style={{background:C.bg,borderRadius:10,padding:12,border:"1px solid "+C.accent}}>
<div style={{marginBottom:8}}><label style={S.lbl}>Name</label>
<input style={S.inp} placeholder="e.g. Pet Care" value={label} onChange={e=>setLabel(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handle()}/>
</div>
<div style={{marginBottom:10}}><label style={S.lbl}>Group</label>
<button onClick={()=>setShowGrpPick(true)} style={{...S.inp,display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",textAlign:"left"}}>
<span style={{fontSize:13,color:C.text}}>{group}</span>
<span style={{color:C.muted,fontSize:12}}>▾</span>
</button>
</div>
<div style={{display:"flex",gap:8}}>
<button style={{...S.btn,flex:1}} onClick={handle}>Add</button>
<button style={{...S.ghost,flex:1,textAlign:"center"}} onClick={onCancel}>Cancel</button>
</div>
</div>
);
}

function ExpenseForm({ monthKey, selMonth, selYear, catSelectGroups, catMap, showCatManager, setShowCatManager, addCustomCat, addExpenseFn, S, C, MONTHS, CAT_GROUPS, CatManagerHeader, CatManagerRows }) {
const [desc, setDesc] = useState("");
const [amount, setAmount] = useState("");
const [category, setCategory] = useState("");
const [date, setDate] = useState(monthKey+"-01");
const [showAddCat, setShowAddCat] = useState(false);
const [showCatPicker, setShowCatPicker] = useState(false);
const prevMonthKey = useRef(monthKey);
if (prevMonthKey.current !== monthKey) { prevMonthKey.current = monthKey; setDate(monthKey+"-01"); setCategory(""); }
const handleSubmit = () => {
if (!amount || !category) return;
let d = date; if (d.slice(0,7)!==monthKey) d=monthKey+"-01";
addExpenseFn({ desc: desc||catMap[category]?.label||"Expense", amount:parseFloat(amount), category, date:d });
setDesc(""); setAmount(""); setCategory("");
};
if (showCatManager) return (
<div style={S.panel} className="card">
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
<div style={{fontFamily:"DM Serif Display",fontStyle:"italic",fontSize:15,color:C.text,flex:1}}>{showAddCat?"New Category":"Manage Categories"}</div>
{!showAddCat && <button onClick={()=>setShowCatManager(false)} style={{background:"transparent",border:"none",color:C.accent,fontSize:13,cursor:"pointer",fontFamily:"DM Sans",fontWeight:600,padding:"0 0 0 12px"}}>✓ Done</button>}
</div>
{showAddCat ? (
<AddCategoryForm onAdd={(cat)=>{ addCustomCat(cat); setShowAddCat(false); }} onCancel={()=>setShowAddCat(false)} S={S} C={C} CAT_GROUPS={CAT_GROUPS}/>
):(
<><CatManagerHeader/><button style={{...S.btn,width:"100%",marginBottom:10}} onClick={()=>setShowAddCat(true)}>+ Add New Category</button><CatManagerRows/></>
)}
</div>
);
return (
<div style={S.panel} className="card">
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
<div style={{fontFamily:"DM Serif Display",fontStyle:"italic",fontSize:15,color:C.text,flex:1}}>{MONTHS[selMonth]} {selYear} — Expenses</div>
<button onClick={()=>setShowCatManager(true)} style={{background:"transparent",border:"none",color:C.accent,fontSize:13,cursor:"pointer",fontFamily:"DM Sans",padding:"0 0 0 12px"}}>⚙ Manage</button>
</div>
<div style={{display:"flex",flexDirection:"column",gap:10}}>
<div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:10}}>
<div><label style={S.lbl}>Description</label>
<input style={S.inp} value={desc} placeholder="e.g. Weekly shop" onChange={e=>setDesc(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSubmit()}/>
</div>
<div><label style={S.lbl}>Amount (£)</label>
<input style={S.inp} type="text" inputMode="decimal" autoComplete="off" value={amount} placeholder="0.00" onChange={e=>setAmount(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSubmit()}/>
</div>
</div>
{showCatPicker ? (
<CatPickerWithSearch catSelectGroups={catSelectGroups} category={category} onSelect={(id)=>{setCategory(id);setShowCatPicker(false);}} onClose={()=>setShowCatPicker(false)} C={C} S={S}/>
):(
<>
<div><label style={{...S.lbl,marginBottom:5}}>Category</label>
<button onClick={()=>setShowCatPicker(true)} style={{...S.inp,display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",textAlign:"left",background:C.elevated,border:"1px solid "+C.border}}>
<span style={{fontSize:14,color:category&&catMap[category]?C.text:C.muted}}>{category&&catMap[category]?catMap[category].label:"Select a category…"}</span>
<span style={{color:C.muted,fontSize:12}}>▾</span>
</button>
</div>
<div><label style={S.lbl}>Date</label><input style={S.inp} type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
<button style={{...S.btn,width:"100%"}} onClick={handleSubmit}>+ Add Expense</button>
</>
)}
</div>
</div>
);
}

function BudgetsViewComponent({ allCats, hiddenSet, spentByCat, budgets, totalIncome, totalExpense, managingCats, setManagingCats, selMonth, selYear, onSaveBudget, S, C, CatManagerHeader, CatManagerRows }) {
return (
<>
<div style={S.panel} className="card">
<div style={{display:"flex",justifyContent:"flex-end",alignItems:"center",gap:8,marginBottom:14}}>
<button onClick={()=>setManagingCats(m=>!m)} style={{...S.ghost,fontSize:12,padding:"6px 10px",flexShrink:0,background:managingCats?C.accent+"22":"transparent",color:managingCats?C.accent:C.muted,border:"1px solid "+(managingCats?C.accent:C.border),display:"flex",alignItems:"center",gap:5}}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
{managingCats?"Done":"Manage"}
</button>
</div>
{managingCats && <div style={{height:0}}/>}
<div style={{display:"flex",flexDirection:"column"}}>
{allCats.filter(c=>!hiddenSet.has(c.id)).map((c,i,arr)=>{
const spent = spentByCat[c.id]||0;
const budget = budgets[c.id]||0;
const over = spent > budget && budget > 0;
const under = spent <= budget && budget > 0;
const unset = budget === 0;
const pct = budget > 0 ? Math.min((spent/budget)*100,100) : 0;
const diff = budget > 0 ? Math.abs(budget - spent) : 0;
return (
<div key={c.id} style={{padding:"11px 0",borderBottom:i<arr.length-1?"1px solid "+C.border+"55":"none"}}>
<div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
<span style={{fontSize:14,flexShrink:0,width:20,textAlign:"center"}}>{c.icon}</span>
<span style={{fontSize:12,color:C.text,flex:1,fontWeight:500,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.label}</span>
{!unset && (
<span style={{fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:20,background:over?C.red+"22":C.green+"22",color:over?C.red:C.green,flexShrink:0}}>
{over?"▲ £"+diff.toFixed(0)+" over":"▼ £"+diff.toFixed(0)+" left"}
</span>
)}
</div>
<div style={{display:"flex",alignItems:"center",gap:8}}>
<span style={{fontSize:11,color:C.muted,flexShrink:0}}>{fmt(spent)}</span>
<span style={{fontSize:11,color:C.border,flexShrink:0}}>/</span>
<BudgetInput catId={c.id} initialValue={budget} color={c.color} onSave={(v)=>onSaveBudget(c.id,v)} S={S} C={C}/>
</div>
{!unset && <div style={{height:3,borderRadius:99,background:C.border,overflow:"hidden",marginTop:7}}><div style={{height:"100%",borderRadius:99,width:pct+"%",background:over?C.red:C.green,transition:"width 0.5s ease"}}/></div>}
</div>
);
})}
</div>
</div>
<div style={S.panel} className="card">
<div style={S.title}>Budget Summary</div>
{[{label:"Total Income",value:fmt(totalIncome),color:C.green},{label:"Total Budgeted",value:fmt(Object.values(budgets).reduce((s,v)=>s+v,0)),color:C.accent},{label:"Total Spent",value:fmt(totalExpense),color:C.amber}].map(s=>(
<div key={s.label} style={{background:C.elevated,borderRadius:10,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
<div style={{fontSize:12,color:C.muted,textTransform:"uppercase",letterSpacing:"0.07em",fontFamily:"DM Sans"}}>{s.label}</div>
<div style={{fontFamily:"DM Serif Display",fontStyle:"italic",fontSize:20,color:s.color}}>{s.value}</div>
</div>
))}
</div>
</>
);
}

const VIEWS = ["Overview","Transactions","Bills","Savings","Year"];

function BottomSheet({ open, onClose, title, children }) {
if (!open) return null;
return (
<div style={{position:"fixed",inset:0,zIndex:200,display:"flex",flexDirection:"column",justifyContent:"flex-start"}} onClick={onClose}>
<div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(2px)"}}/>
<div onClick={e=>e.stopPropagation()} style={{position:"relative",background:C.surface,borderRadius:0,border:"1px solid "+C.border,boxShadow:"0 8px 40px #00000099",display:"flex",flexDirection:"column",minHeight:"100vh",width:"100%"}}>
<div style={{padding:"16px 20px 0",flexShrink:0}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
<span style={{fontFamily:"DM Serif Display",fontStyle:"italic",fontSize:20,color:C.text}}>{title}</span>
<button onClick={onClose} style={{background:C.elevated,border:"1px solid "+C.border,color:C.muted,borderRadius:8,fontSize:13,cursor:"pointer",padding:"5px 14px",fontFamily:"DM Sans"}}>Done</button>
</div>
</div>
<div style={{overflowY:"auto",padding:"0 20px 28px",flex:1}}>
{children}
</div>
<div style={{width:36,height:4,borderRadius:99,background:C.muted+"55",margin:"12px auto"}}/>
</div>
</div>
);
}

function ModalExpenseForm({ monthKey, selMonth, selYear, catSelectGroups, catMap, addExpenseFn, S, C, T, onCancel, submitRef, onCanSubmitChange }) {
const todayStr = new Date().toISOString().slice(0,10);
const defaultDate = todayStr.slice(0,7)===monthKey ? todayStr : monthKey+"-01";
const [desc, setDesc] = useState("");
const [amount, setAmount] = useState("");
const [category, setCategory] = useState("");
const [date, setDate] = useState(defaultDate);
const [showCatPicker, setShowCatPicker] = useState(false);
const [success, setSuccess] = useState(false);
const prevMonthKey = useRef(monthKey);
if (prevMonthKey.current !== monthKey) { prevMonthKey.current = monthKey; setDate(monthKey+"-01"); setCategory(""); }

const QUICK = [
  {label:"Groceries",cat:"groceries"},{label:"Coffee",cat:"coffee_shop"},
  {label:"Fuel",cat:"fuel"},{label:"Takeaway",cat:"takeaway"},
  {label:"Eating Out",cat:"eating_out"},{label:"Transport",cat:"transport"},
];

const handleSubmit = () => {
  if (!amount || !category) return;
  let d = date; if (d.slice(0,7)!==monthKey) d=monthKey+"-01";
  addExpenseFn({ desc: desc||catMap[category]?.label||"Expense", amount:parseFloat(amount), category, date:d });
  setSuccess(true);
  setTimeout(()=>{ setSuccess(false); setDesc(""); setAmount(""); setCategory(""); onCancel(); }, 1000);
};
if (submitRef) submitRef.current = handleSubmit;
useEffect(()=>{ if(onCanSubmitChange) onCanSubmitChange(!!(amount&&category)); },[amount,category,onCanSubmitChange]);

if (showCatPicker) return <CatPickerWithSearch catSelectGroups={catSelectGroups} category={category} onSelect={(id)=>{setCategory(id);setShowCatPicker(false);}} onClose={()=>setShowCatPicker(false)} C={C} S={S}/>;

if (success) return (
  <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"32px 0",gap:10}}>
    <div style={{width:52,height:52,borderRadius:99,background:C.green+"22",border:"2px solid "+C.green,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
    </div>
    <span style={{fontFamily:"DM Serif Display",fontStyle:"italic",fontSize:20,color:C.green}}>Added!</span>
  </div>
);

return (
<div style={{display:"flex",flexDirection:"column",gap:10}}>

<div>
<label style={S.lbl}>Quick add</label>
<div style={{display:"flex",flexWrap:"wrap",gap:6}}>
{QUICK.map(q=>(
<button key={q.cat} onClick={()=>{ setCategory(q.cat); if(!desc) setDesc(catMap[q.cat]?.label||q.label); }}
style={{padding:"5px 12px",borderRadius:20,border:"1px solid "+(category===q.cat?T.accent:C.border),background:category===q.cat?T.accent+"22":C.elevated,color:category===q.cat?T.accent:C.muted,fontFamily:"DM Sans",fontSize:12,cursor:"pointer",fontWeight:category===q.cat?600:400,transition:"all 0.15s"}}>
{q.label}
</button>
))}
</div>
</div>

<div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:8}}>
<div><label style={S.lbl}>Description</label>
<input style={{...S.inp,padding:"9px 12px"}} value={desc} placeholder="e.g. Weekly shop" onChange={e=>setDesc(e.target.value)}/>
</div>
<div><label style={S.lbl}>Amount (£)</label>
<input style={{...S.inp,padding:"9px 12px"}} type="text" inputMode="decimal" autoComplete="off" value={amount} placeholder="0.00" onChange={e=>setAmount(e.target.value)}/>
</div>
</div>

<div><label style={{...S.lbl,marginBottom:4}}>Category</label>
<button onClick={()=>setShowCatPicker(true)} style={{...S.inp,padding:"9px 12px",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",textAlign:"left"}}>
<span style={{fontSize:13,color:category&&catMap[category]?C.text:C.muted}}>{category&&catMap[category]?catMap[category].label:"Select a category…"}</span>
<span style={{color:C.muted,fontSize:11}}>▾</span>
</button>
</div>

<div><label style={S.lbl}>Date</label>
<input style={{...S.inp,padding:"9px 12px"}} type="date" value={date} onChange={e=>setDate(e.target.value)}/>
</div>
</div>
);
}

function ModalIncomeForm({ sources, addSource, updateAmt, removeSrc, confirmDelete, setConfirmDelete, S, C, T, onClose, onChanged }) {
const [label, setLabel] = useState("");
const [amount, setAmount] = useState("");
const [editingId, setEditingId] = useState(null);
const [editLabel, setEditLabel] = useState("");
const [editAmount, setEditAmount] = useState("");

const handleAdd = () => {
  if (!label || !amount) return;
  addSource({ id:"c_"+Date.now(), label, icon:"💼", color:"#5b8cff", amount:parseFloat(amount) });
  setLabel(""); setAmount("");
};

const startEdit = (s) => {
  setEditingId(s.id);
  setEditLabel(s.label);
  setEditAmount(String(s.amount));
  setConfirmDelete(null);
};

const saveEdit = (s) => {
  if (editLabel.trim()) {
    updateAmt(s.id, editAmount);
    if (editLabel !== s.label) {
      removeSrc(s.id);
      addSource({ id:s.id, label:editLabel.trim(), icon:s.icon||"💼", color:s.color||"#5b8cff", amount:parseFloat(editAmount)||s.amount });
    }
    if (onChanged) onChanged();
  }
  setEditingId(null);
};

return (
<div style={{display:"flex",flexDirection:"column",gap:12}}>

<div style={{background:C.elevated,borderRadius:10,padding:"10px 12px"}}>
<div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em",fontFamily:"DM Sans",marginBottom:8}}>New Source</div>
<div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:8,marginBottom:8}}>
<div><label style={S.lbl}>Name</label>
<input style={{...S.inp,padding:"8px 10px",fontSize:13}} placeholder="e.g. Salary" value={label} onChange={e=>setLabel(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleAdd()}/>
</div>
<div><label style={S.lbl}>Amount (£)</label>
<input style={{...S.inp,padding:"8px 10px",fontSize:13}} type="text" inputMode="decimal" placeholder="0.00" autoComplete="off" value={amount} onChange={e=>setAmount(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleAdd()}/>
</div>
</div>
<button style={{...S.btn,width:"100%",padding:"9px",fontSize:13,background:(!label||!amount)?"#3a3f52":C.green,cursor:(!label||!amount)?"not-allowed":"pointer"}} onClick={handleAdd}>+ Add</button>
</div>


{sources.length>0 && (
<div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:260,overflowY:"auto"}}>
<div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em",fontFamily:"DM Sans",marginBottom:2}}>Your Sources</div>
{sources.map(s=>(
<div key={s.id} style={{background:C.elevated,borderRadius:10,border:"1px solid "+(editingId===s.id?T.accent:C.border),padding:"10px 12px",transition:"border 0.2s"}}>
{editingId===s.id ? (
<div style={{display:"flex",flexDirection:"column",gap:8}}>
<div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:8}}>
<div><label style={S.lbl}>Name</label>
<input style={{...S.inp,padding:"7px 10px",fontSize:13}} value={editLabel} onChange={e=>setEditLabel(e.target.value)} autoFocus/>
</div>
<div><label style={S.lbl}>Amount (£)</label>
<input style={{...S.inp,padding:"7px 10px",fontSize:13}} type="text" inputMode="decimal" autoComplete="off" value={editAmount} onChange={e=>setEditAmount(e.target.value)}/>
</div>
</div>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
<button onClick={()=>setEditingId(null)} style={{...S.ghost,padding:"7px",textAlign:"center",fontSize:12}}>Cancel</button>
<button onClick={()=>saveEdit(s)} style={{...S.btn,padding:"7px",fontSize:12,background:T.accent}}>Save</button>
</div>
</div>
):(
<div style={{display:"flex",alignItems:"center",gap:8}}>
<div style={{flex:1,minWidth:0}}>
<div style={{fontSize:13,fontWeight:600,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.label}</div>
<div style={{fontSize:12,color:C.green,fontFamily:"DM Serif Display",fontStyle:"italic",marginTop:1}}>{fmt(s.amount)}<span style={{fontSize:10,color:C.muted,fontFamily:"DM Sans",marginLeft:4}}>/mo</span></div>
</div>
<button onClick={()=>startEdit(s)} style={{background:T.accent+"22",border:"1px solid "+T.accent+"44",color:T.accent,borderRadius:8,padding:"4px 10px",fontSize:11,cursor:"pointer",fontFamily:"DM Sans",fontWeight:500,flexShrink:0}}>Edit</button>
{confirmDelete===s.id ? (
<><button onClick={()=>removeSrc(s.id)} style={{background:C.red,border:"none",color:"#fff",borderRadius:8,padding:"4px 10px",fontSize:11,cursor:"pointer",fontFamily:"DM Sans",fontWeight:600}}>Delete</button>
<button onClick={()=>setConfirmDelete(null)} style={{background:C.elevated,border:"1px solid "+C.border,color:C.muted,borderRadius:8,padding:"4px 8px",fontSize:11,cursor:"pointer"}}>✕</button></>
):(
<button onClick={()=>setConfirmDelete(s.id)} style={{background:C.red+"18",border:"1px solid "+C.red+"44",color:C.red,borderRadius:8,padding:"4px 8px",fontSize:11,cursor:"pointer"}}>🗑</button>
)}
</div>
)}
</div>
))}
</div>
)}
</div>
);
}
function useSwipe(onLeft, onRight) {
  const startX = useRef(null);
  const onTouchStart = e => { startX.current = e.touches[0].clientX; };
  const onTouchEnd = e => {
    if (startX.current === null) return;
    const dx = e.changedTouches[0].clientX - startX.current;
    if (Math.abs(dx) > 60) { dx < 0 ? onLeft() : onRight(); }
    startX.current = null;
  };
  return { onTouchStart, onTouchEnd };
}

export default function App() {
const { state, dispatch, undo, canUndo } = useUndoReducer(appReducer, INITIAL_STATE);
const { txnsByMonth, sources, customCats, deletedBuiltins, hiddenCats, budgets, savingsGoal, savingsBal, savingsContrib } = state;
const [view, setView] = useState("Overview");
const [selYear, setSelYear] = useState(2025);
const [selMonth, setSelMonth] = useState(11);
const [filterCat, setFilterCat] = useState("all");
const [sortOrder, setSortOrder] = useState("newest");
const [confirmDelete, setConfirmDelete] = useState(null);
const [showAdd, setShowAdd] = useState(false);
const [showAddModal, setShowAddModal] = useState(false);
const [modalTxnType, setModalTxnType] = useState("expense");
const [expenseCanSubmit, setExpenseCanSubmit] = useState(false);
const [incomeChanged, setIncomeChanged] = useState(false);
const expenseSubmitRef = useRef(()=>{});
const [showCatManager, setShowCatManager] = useState(false);
const [showFilterPicker, setShowFilterPicker] = useState(false);
const [managingCats, setManagingCats] = useState(false);
const [txnSearch, setTxnSearch] = useState("");
const [toast, setToast] = useState(null);
const contentRef = useRef(null);
const toastTimer = useRef(null);
useEffect(() => {
  try { const saved = localStorage.getItem("penny_state"); if (saved) { const parsed = JSON.parse(saved); if (parsed?.txnsByMonth) dispatch({type:"**RESTORE**",snapshot:{...INITIAL_STATE,...parsed}}); } } catch(e){}
}, []);
useEffect(() => {
  try { localStorage.setItem("penny_state", JSON.stringify(state)); } catch(e){}
}, [state]);
const showToast = useCallback((msg, color=C.green) => {
  setToast({msg, color});
  if (toastTimer.current) clearTimeout(toastTimer.current);
  toastTimer.current = setTimeout(() => setToast(null), 2200);
}, []);

useEffect(() => { return () => { if (toastTimer.current) clearTimeout(toastTimer.current); }; }, []);

useEffect(() => { 
  if (contentRef.current) contentRef.current.scrollTop = 0;
  setShowCatManager(false);
  setShowFilterPicker(false);
  setManagingCats(false);
  setConfirmDelete(null);
  setTxnSearch("");
  setShowAddModal(false);
}, [view]);

const deletedSet = useMemo(()=>new Set(deletedBuiltins),[deletedBuiltins]);
const hiddenSet  = useMemo(()=>new Set(hiddenCats),[hiddenCats]);
const allCats    = useMemo(()=>[...BASE_CATS.filter(c=>!deletedSet.has(c.id)),...customCats],[customCats,deletedSet]);
const catMap     = useMemo(()=>Object.fromEntries(allCats.map(c=>[c.id,c])),[allCats]);
const monthKey   = mkKey(selYear, selMonth);
const txns       = useMemo(()=>txnsByMonth[monthKey]||[],[txnsByMonth,monthKey]);
const totalIncome  = useMemo(()=>sources.reduce((s,r)=>s+r.amount,0),[sources]);
const totalExpense = useMemo(()=>txns.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0),[txns]);
const balance    = totalIncome - totalExpense;
const spentByCat = useMemo(()=>{ const m={}; txns.filter(t=>t.type==="expense").forEach(t=>{m[t.category]=(m[t.category]||0)+t.amount;}); return m; },[txns]);
const filtered = useMemo(()=>{
  let base = filterCat==="all" ? txns : txns.filter(t=>t.category===filterCat);
  if (txnSearch.trim()) { const q=txnSearch.toLowerCase(); base=base.filter(t=>t.desc.toLowerCase().includes(q)||(catMap[t.category]?.label||"").toLowerCase().includes(q)); }
  return [...base].sort((a,b)=>sortOrder==="newest"?b.date.localeCompare(a.date):a.date.localeCompare(b.date));
},[txns,filterCat,sortOrder,txnSearch,catMap]);
const swipeMonth = useCallback((dir)=>{
  let m=selMonth+dir, y=selYear;
  if(m<0){m=11;y--;} if(m>11){m=0;y++;}
  changeMonth(y,m);
},[selMonth,selYear]);

const swipeHandlers = useSwipe(()=>swipeMonth(1), ()=>swipeMonth(-1));
const catSelectGroups = useMemo(()=>Object.entries(groupBy(allCats.filter(c=>!hiddenSet.has(c.id)),"group")),[allCats,hiddenSet]);
const allCatGroups    = useMemo(()=>Object.entries(groupBy(allCats,"group")),[allCats]);
const T = getTheme(selMonth);

const addExpenseFn = useCallback((payload)=>{ const amt=Math.abs(parseFloat(payload.amount)||0); if(!amt) return; const txn={...payload,amount:amt,id:Date.now(),type:"expense"}; dispatch({type:"ADD_TXN",monthKey,txn},state); showToast("Expense added — "+fmt(amt)); },[monthKey,state,dispatch,showToast]);
const deleteTxn    = useCallback((id)=>{ dispatch({type:"DELETE_TXN",monthKey,id},state); setConfirmDelete(null); showToast("Transaction deleted",C.red); },[monthKey,state,dispatch,showToast]);
const updateAmt    = useCallback((id,val)=>{ dispatch({type:"UPDATE_SOURCE_AMT",id,amount:parseFloat(val)||0},state); },[state,dispatch]);
const removeSrc    = useCallback((id)=>{ dispatch({type:"REMOVE_SOURCE",id},state); setConfirmDelete(null); showToast("Income source removed",C.amber); },[state,dispatch,showToast]);
const addSource = useCallback((src)=>{ if(!src) return; const amt=Math.abs(parseFloat(src.amount)||0); if(!amt) return; const s={...src,amount:amt}; dispatch({type:"ADD_SOURCE",source:s},state); showToast("Income source added — "+fmt(amt),C.green); },[state,dispatch,showToast]);
const addCustomCat = useCallback((payload)=>{ if(!payload?.label?.trim()) return; dispatch({type:"ADD_CUSTOM_CAT",cat:{...payload,id:"cc_"+Date.now(),color:"#94a3b8",fixed:false}},state); },[state,dispatch]);
const removeCustomCat  = useCallback((id)=>{ dispatch({type:"REMOVE_CUSTOM_CAT",id},state); },[state,dispatch]);
const deleteBuiltinCat = useCallback((id)=>{ dispatch({type:"DELETE_BUILTIN_CAT",id},state); setConfirmDelete(null); },[state,dispatch]);
const toggleHideCat    = useCallback((id)=>{ dispatch({type:"TOGGLE_HIDE_CAT",id},state); },[state,dispatch]);
const openAddModal = useCallback(()=>{ setModalTxnType("expense"); setExpenseCanSubmit(false); setIncomeChanged(false); setShowAddModal(true); },[]);
const changeMonth = (y,m) => { setSelYear(y); setSelMonth(m); setFilterCat("all"); setConfirmDelete(null); };

const S = {
panel:  {background:T.surface, border:"1px solid "+T.border, borderRadius:14, padding:"16px", marginBottom:12, minWidth:0, transition:"background 0.8s ease, border 0.8s ease"},
grid2:  {display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12, overflow:"hidden"},
title:  {fontFamily:"DM Serif Display", fontStyle:"italic", fontSize:18, color:C.text, marginBottom:14},
lbl:    {fontSize:11, color:C.muted, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:5, display:"block", fontFamily:"DM Sans"},
inp:    {background:C.elevated, border:"1px solid "+C.border, borderRadius:10, color:C.text, fontFamily:"DM Sans", fontSize:14, padding:"10px 12px", width:"100%", boxSizing:"border-box"},
btn:    {background:T.accent, color:"#fff", border:"none", borderRadius:10, fontFamily:"DM Sans", fontWeight:600, fontSize:14, padding:"11px 20px", cursor:"pointer", textAlign:"center"},
ghost:  {background:"transparent", border:"1px solid "+C.border, color:C.muted, borderRadius:10, fontFamily:"DM Sans", fontSize:13, padding:"9px 16px", cursor:"pointer", textAlign:"center"},
danger: {background:C.red+"22", border:"1px solid "+C.red+"44", color:C.red, borderRadius:8, fontFamily:"DM Sans", fontSize:12, padding:"6px 10px", cursor:"pointer"},
pill:   bg=>({display:"inline-block", background:bg+"22", color:bg, borderRadius:20, padding:"2px 8px", fontSize:11, fontWeight:500, fontFamily:"DM Sans"}),
divider:{borderTop:"1px solid "+C.border, marginTop:12, paddingTop:12},
};

const UndoBtn = ({style={}}) => (
<button onClick={undo} disabled={!canUndo} style={{background:canUndo?C.amber+"18":"transparent",border:"1px solid "+(canUndo?C.amber+"66":C.border+"44"),color:canUndo?C.amber:C.muted+"44",borderRadius:6,padding:"3px 10px",fontSize:11,cursor:canUndo?"pointer":"default",fontFamily:"DM Sans",opacity:canUndo?1:0.3,...style}}>↩ Undo</button>
);

const StatCard = ({label,value,sub,color,delay=0,onClick=null,linkLabel=null}) => {
const [tapped,setTapped] = useState(false);
const handleTap = () => { if(!onClick) return; setTapped(true); setTimeout(()=>setTapped(false),300); onClick(); };
return (
<div className="card" onClick={handleTap} style={{background:T.surface,border:"1px solid "+(tapped?(color||T.accent):T.border),borderRadius:14,padding:12,animationDelay:delay+"s",minWidth:0,overflow:"hidden",display:"flex",flexDirection:"column",cursor:onClick?"pointer":"default",transition:"border 0.2s"}}>
<div style={{fontSize:10,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:5,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",fontFamily:"DM Sans"}}>{label}</div>
<div style={{fontFamily:"DM Serif Display",fontSize:18,color:color||C.text,fontStyle:"italic",wordBreak:"break-word",lineHeight:1.15,overflow:"hidden",flex:1}}>{value}</div>
{sub && <div style={{fontSize:11,color:C.muted,marginTop:4,fontFamily:"DM Sans",lineHeight:1.3}}>{sub}</div>}
{linkLabel && <div style={{marginTop:8,fontSize:10,color:color||T.accent,fontFamily:"DM Sans",fontWeight:600,letterSpacing:"0.04em",display:"flex",alignItems:"center",gap:3}}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>{linkLabel}</div>}
</div>
);
};

const CatManagerRows = ({showDelete=true}) => (
<div style={{maxHeight:400,overflowY:"auto",display:"flex",flexDirection:"column",gap:4,marginBottom:12}}>
{allCats.map(c=>(
<div key={c.id} style={{display:"flex",alignItems:"center",gap:8,background:C.bg,borderRadius:10,padding:"8px 12px",opacity:hiddenSet.has(c.id)?0.4:1}}>
<span style={{fontSize:14,flexShrink:0,width:20,textAlign:"center"}}>{c.icon}</span>
<span style={{fontSize:13,color:C.text,flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontFamily:"DM Sans"}}>{c.label}</span>
<div style={{display:"flex",gap:6,flexShrink:0}}>
<button onClick={()=>toggleHideCat(c.id)} style={{background:hiddenSet.has(c.id)?C.green+"22":C.elevated,border:"1px solid "+(hiddenSet.has(c.id)?C.green+"55":C.border),color:hiddenSet.has(c.id)?C.green:C.muted,borderRadius:8,padding:"4px 10px",fontSize:11,cursor:"pointer",fontFamily:"DM Sans",fontWeight:500}}>
{hiddenSet.has(c.id)?"Show":"Hide"}
</button>
{showDelete && (confirmDelete===c.id ? (
<div style={{display:"flex",gap:4}}>
<button onClick={()=>c.fixed?deleteBuiltinCat(c.id):removeCustomCat(c.id)} style={{background:C.red,border:"none",color:"#fff",borderRadius:8,padding:"4px 10px",fontSize:11,cursor:"pointer",fontFamily:"DM Sans",fontWeight:600}}>Delete</button>
<button onClick={()=>setConfirmDelete(null)} style={{background:C.elevated,border:"1px solid "+C.border,color:C.muted,borderRadius:8,padding:"4px 10px",fontSize:11,cursor:"pointer",fontFamily:"DM Sans"}}>Cancel</button>
</div>
):(
<button onClick={()=>setConfirmDelete(c.id)} style={{background:C.red+"18",border:"1px solid "+C.red+"44",color:C.red,borderRadius:8,padding:"4px 10px",fontSize:11,cursor:"pointer",fontFamily:"DM Sans"}}>Remove</button>
))}
</div>
</div>
))}
</div>
);

const CatManagerHeader = () => (
<div style={{display:"flex",alignItems:"center",gap:6,marginBottom:12}}>
<button onClick={()=>dispatch({type:"SHOW_ALL_CATS"},state)} style={{flex:1,background:C.green+"18",border:"1px solid "+C.green+"44",color:C.green,borderRadius:8,padding:"8px 0",fontSize:12,cursor:"pointer",fontFamily:"DM Sans",fontWeight:500}}>Show All</button>
<button onClick={()=>dispatch({type:"HIDE_ALL_CATS",allIds:allCats.map(c=>c.id)},state)} style={{flex:1,background:C.elevated,border:"1px solid "+C.border,color:C.muted,borderRadius:8,padding:"8px 0",fontSize:12,cursor:"pointer",fontFamily:"DM Sans",fontWeight:500}}>Hide All</button>
<UndoBtn style={{flexShrink:0,padding:"8px 12px"}}/>
</div>
);
const [editingBudget,setEditingBudget] = useState(null);
const [editingVal,setEditingVal] = useState("");
const [editingDate,setEditingDate] = useState(null);
const [editingDateVal,setEditingDateVal] = useState("");
const [showAddBill,setShowAddBill] = useState(false);
const [billsSection,setBillsSection] = useState("bills");
const [newBillDay,setNewBillDay] = useState("1");
const [newBillType,setNewBillType] = useState("");
const [newBillName,setNewBillName] = useState("");
const [newBillAmt,setNewBillAmt] = useState("");
const [logDateOverride,setLogDateOverride] = useState({});

const OverviewView = () => {
const _prevKey = selMonth===0?(selYear-1)+"-12":mkKey(selYear,selMonth-1);
const _prevTxns = txnsByMonth[_prevKey]||[];
const _prevExpense = _prevTxns.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0);
const _diff = balance-(totalIncome-_prevExpense);
const _hasData = _prevTxns.length>0;
const totalSpentByCat = allCats.filter(c=>spentByCat[c.id]>0).sort((a,b)=>(spentByCat[b.id]||0)-(spentByCat[a.id]||0));
const maxCatSpend = totalSpentByCat[0] ? spentByCat[totalSpentByCat[0].id] : 1;
return (
<>

<div style={S.grid2}>
<StatCard label="Total Income"  value={fmt(totalIncome)}  sub="All sources"  color={C.green}  delay={0.05} linkLabel="Manage income" onClick={()=>{ setModalTxnType("income"); setIncomeChanged(false); setShowAddModal(true); }}/>
<StatCard label="vs Last Month" value={_hasData?(_diff>=0?"+":"")+fmt(_diff):"—"} sub={_hasData?(_diff>=0?"more":"less")+" left over":"No prior data"} color={!_hasData?C.muted:_diff>=0?C.green:C.red} delay={0.10} linkLabel="View year" onClick={()=>setView("Year")}/>
<StatCard label="Total Spent"   value={fmt(totalExpense)} sub="This month"   color={C.amber}  delay={0.15} linkLabel="Transactions" onClick={()=>setView("Transactions")}/>
<StatCard label="Remaining"     value={fmt(balance)}      sub="Left over"    color={balance>=0?C.green:C.red} delay={0.20} linkLabel="View budgets" onClick={()=>setView("Budgets")}/>
<StatCard label="Daily Avg" value={fmt((()=>{ const now=new Date(); const isCurrentMonth=(selYear===now.getFullYear()&&selMonth===now.getMonth()); const daysElapsed=isCurrentMonth?Math.max(now.getDate(),1):new Date(selYear,selMonth+1,0).getDate(); return Math.round(totalExpense/daysElapsed); })())} sub="Spent per day" color={C.accent} delay={0.25} linkLabel="Transactions" onClick={()=>setView("Transactions")}/>
<StatCard label="Budget Used"
value={(()=>{const b=Object.values(budgets).reduce((s,v)=>s+v,0);return b>0?Math.round((totalExpense/b)*100)+"%":"—";})()}
sub={(()=>{const b=Object.values(budgets).reduce((s,v)=>s+v,0);const pct=b>0?Math.round((totalExpense/b)*100):0;return pct>100?"Over by £"+(totalExpense-b).toFixed(0):pct>80?"Getting close":"On track";})()}
color={(()=>{const b=Object.values(budgets).reduce((s,v)=>s+v,0);const pct=b>0?(totalExpense/b)*100:0;return pct>100?C.red:pct>80?C.amber:C.green;})()}
delay={0.30} linkLabel="View budgets" onClick={()=>setView("Budgets")}/>
</div>


{sources.length>0 && (
<div style={{...S.panel,padding:"12px 16px"}} className="card">
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
<span style={{fontSize:12,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em",fontFamily:"DM Sans",fontWeight:600}}>Monthly Income</span>
<span style={{fontFamily:"DM Serif Display",fontStyle:"italic",fontSize:16,color:C.green}}>{fmt(totalIncome)}</span>
</div>
{sources.map((s,i)=>{
const pct=totalIncome>0?(s.amount/totalIncome)*100:0;
return (
<div key={s.id} style={{display:"flex",alignItems:"center",gap:10,marginBottom:i<sources.length-1?10:0}}>
<div style={{width:6,height:6,borderRadius:99,background:s.color,flexShrink:0}}/>
<span style={{fontSize:13,color:C.text,fontFamily:"DM Sans",flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.label}</span>
<span style={{fontSize:12,color:s.color,fontFamily:"DM Sans",fontWeight:500,flexShrink:0}}>{fmt(s.amount)}</span>
<span style={{fontSize:11,color:C.muted,fontFamily:"DM Sans",flexShrink:0,width:30,textAlign:"right"}}>{pct.toFixed(0)}%</span>
</div>
);
})}
</div>
)}


{txns.length===0 ? (
<div style={{textAlign:"center",padding:"60px 20px",color:C.muted}}>
<div style={{fontFamily:"DM Serif Display",fontStyle:"italic",fontSize:22,color:C.text,marginBottom:8}}>No data for {MONTHS[selMonth]} {selYear}</div>
<div style={{fontSize:13,fontFamily:"DM Sans",marginBottom:20,lineHeight:1.6}}>Add your first expense to get started.</div>
<button style={S.btn} onClick={()=>openAddModal()}>+ Add Expense</button>
</div>
):(
<div style={S.panel} className="card">
<div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:14}}>
<span style={{...S.title,marginBottom:0}}>Spending</span>
<span style={{fontSize:11,color:C.muted,fontFamily:"DM Sans",textTransform:"uppercase",letterSpacing:"0.06em"}}>{MONTHS[selMonth]}</span>
</div>
{totalSpentByCat.map((c,i)=>{
const spent = spentByCat[c.id]||0;
const bud = budgets[c.id]||0;
const over = bud>0 && spent>bud;
const barW = Math.min((spent/maxCatSpend)*100,100);
const pct = totalExpense>0?((spent/totalExpense)*100).toFixed(0):0;
return (
<div key={c.id} style={{marginBottom:i<totalSpentByCat.length-1?12:0}}>
<div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
<span style={{fontSize:14,flexShrink:0,width:20,textAlign:"center"}}>{c.icon}</span>
<span style={{fontSize:13,color:C.text,fontFamily:"DM Sans",flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.label}</span>
<span style={{fontSize:11,color:C.muted,fontFamily:"DM Sans",flexShrink:0}}>{pct}%</span>
<span style={{fontSize:13,fontFamily:"DM Serif Display",fontStyle:"italic",color:over?C.red:C.text,flexShrink:0,minWidth:60,textAlign:"right"}}>{fmt(spent)}</span>
</div>
<div style={{height:3,borderRadius:99,background:C.border,overflow:"hidden",marginLeft:14}}>
<div style={{height:"100%",borderRadius:99,width:barW+"%",background:over?C.red:c.color,transition:"width 0.6s ease"}}/>
</div>
{bud>0 && (
<div style={{display:"flex",justifyContent:"flex-end",marginTop:2,marginLeft:14}}>
<span style={{fontSize:10,color:over?C.red:C.muted,fontFamily:"DM Sans"}}>{over?"£"+(spent-bud).toFixed(0)+" over":"£"+(bud-spent).toFixed(0)+" left"} of {fmt(bud)}</span>
</div>
)}
</div>
);
})}
</div>
)}
</>
);
}

const TransactionsView = () => {
return (
<>
{showFilterPicker ? (
<div style={{background:C.surface,borderRadius:14,border:"1px solid "+C.border,marginBottom:12,overflow:"hidden"}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 16px",borderBottom:"1px solid "+C.border}}>
<span style={{fontFamily:"DM Serif Display",fontStyle:"italic",fontSize:17,color:C.text}}>Filter by Category</span>
<button onClick={()=>setShowFilterPicker(false)} style={{background:C.elevated,border:"1px solid "+C.border,color:C.muted,borderRadius:8,fontSize:13,cursor:"pointer",padding:"4px 12px",fontFamily:"DM Sans"}}>Close</button>
</div>
<div style={{maxHeight:400,overflowY:"auto"}}>
<button onClick={()=>{setFilterCat("all");setShowFilterPicker(false);}} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 16px",background:C.surface,border:"none",borderBottom:"1px solid "+C.border+"55",cursor:"pointer"}}>
<span style={{fontSize:14,color:filterCat==="all"?T.accent:C.text,fontFamily:"DM Sans",fontWeight:filterCat==="all"?600:400}}>All categories</span>
{filterCat==="all" && <span style={{color:T.accent,fontSize:13,fontFamily:"DM Sans",fontWeight:600}}>✓</span>}
</button>
{allCatGroups.map(([grp,cats])=>(
<div key={grp}>
<div style={{fontSize:10,color:C.muted,fontWeight:600,letterSpacing:"0.08em",padding:"10px 16px 5px",background:C.elevated,textTransform:"uppercase",fontFamily:"DM Sans"}}>{grp}</div>
{cats.map(c=>(
<button key={c.id} onClick={()=>{setFilterCat(c.id);setShowFilterPicker(false);}} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"11px 16px",background:C.surface,border:"none",borderBottom:"1px solid "+C.border+"44",cursor:"pointer"}}>
<span style={{fontSize:13,color:filterCat===c.id?T.accent:C.text,fontFamily:"DM Sans",fontWeight:filterCat===c.id?600:400,display:"flex",alignItems:"center",gap:8}}>
<span style={{fontSize:14,width:18,textAlign:"center",flexShrink:0}}>{c.icon}</span>{c.label}
</span>
{filterCat===c.id && <span style={{color:T.accent,fontSize:13,fontFamily:"DM Sans",fontWeight:600}}>✓</span>}
</button>
))}
</div>
))}
</div>
</div>
):(
<div style={{display:"flex",alignItems:"center",gap:6,marginBottom:12}}>
<button onClick={()=>setShowFilterPicker(true)} style={{...S.ghost,display:"flex",alignItems:"center",gap:6,flex:1,padding:"6px 10px",fontSize:13,overflow:"hidden",textAlign:"left"}}>
<span style={{color:filterCat==="all"?C.muted:C.text,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:6}}>
{filterCat!=="all" && catMap[filterCat]?.icon && <span style={{fontSize:13,flexShrink:0}}>{catMap[filterCat].icon}</span>}
{filterCat==="all"?"Category":(catMap[filterCat]?.label||"Category")}
</span>
<span style={{color:C.muted,fontSize:10,flexShrink:0}}>▾</span>
</button>
<button onClick={()=>setSortOrder(s=>s==="newest"?"oldest":"newest")} style={{...S.ghost,padding:"6px 10px",fontSize:12,whiteSpace:"nowrap",flexShrink:0}}>{sortOrder==="newest"?"↓":"↑"}</button>
<button onClick={()=>setShowCatManager(true)} style={{...S.ghost,padding:"6px 10px",flexShrink:0,display:"flex",alignItems:"center",color:C.muted,border:"1px solid "+C.border}}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
</button>
<span style={{fontSize:12,color:C.muted,flexShrink:0,fontFamily:"DM Sans"}}>{filtered.length}</span>
</div>
)}
<div style={S.panel} className="card">
{filtered.length===0 ? (
<div style={{color:C.muted,padding:"48px 20px",textAlign:"center"}}>
<div style={{fontFamily:"DM Serif Display",fontStyle:"italic",fontSize:20,color:C.text,marginBottom:8}}>No transactions yet</div>
<div style={{fontSize:13,fontFamily:"DM Sans",marginBottom:20,lineHeight:1.6}}>Tap <strong style={{color:T.accent}}>+ Add</strong> at the top to log an expense or income.</div>
</div>
) : filtered.map(t=>{
const c=catMap[t.category]||{label:t.category,color:C.muted,icon:"📦"};
return (
<div key={t.id}>
<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid "+C.border}}>
<div style={{display:"flex",alignItems:"center",gap:8,minWidth:0,flex:1}}>
<span style={{fontSize:14,flexShrink:0,width:20,textAlign:"center"}}>{c.icon||"📦"}</span>
<div style={{minWidth:0,flex:1}}>
<div style={{fontSize:13,fontWeight:500,color:C.text,fontFamily:"DM Sans",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{t.desc}</div>
<div style={{fontSize:11,color:C.muted,fontFamily:"DM Sans",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",marginTop:1}}>{t.date} · {c.label}</div>
</div>
</div>
<div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0,marginLeft:8}}>
<span style={{fontFamily:"DM Serif Display",fontStyle:"italic",fontSize:14,color:C.text,whiteSpace:"nowrap"}}>-{fmt(t.amount)}</span>
<button onClick={()=>setConfirmDelete(confirmDelete===t.id?null:t.id)} style={{background:"transparent",border:"none",color:C.muted,cursor:"pointer",fontSize:16,padding:"2px 4px",lineHeight:1,flexShrink:0}}>×</button>
</div>
</div>
{confirmDelete===t.id && (
<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:C.elevated,borderRadius:"0 0 10px 10px",border:"1px solid "+C.border,borderTop:"none"}}>
<span style={{fontSize:13,color:C.muted,fontFamily:"DM Sans"}}>Delete <strong style={{color:C.text,fontWeight:500}}>{t.desc}</strong>?</span>
<div style={{display:"flex",gap:8}}>
<button onClick={()=>deleteTxn(t.id)} style={{background:C.red,border:"none",color:"#fff",borderRadius:8,padding:"6px 16px",fontSize:13,cursor:"pointer",fontFamily:"DM Sans",fontWeight:600}}>Delete</button>
<button onClick={()=>setConfirmDelete(null)} style={{background:"transparent",border:"1px solid "+C.border,color:C.muted,borderRadius:8,padding:"6px 12px",fontSize:13,cursor:"pointer",fontFamily:"DM Sans"}}>Cancel</button>
</div>
</div>
)}
</div>
);
})}
</div>
</>
);
}

const SavingsView = () => {
const pct = savingsGoal>0?Math.min((savingsBal/savingsGoal)*100,100):0;
const remaining = Math.max(savingsGoal-savingsBal,0);
const fmtS = n=>"£"+Math.abs(Math.round(n)).toLocaleString("en-GB",{maximumFractionDigits:0});
const monthsNeeded = savingsContrib>0&&remaining>0?Math.ceil(remaining/savingsContrib):null;
const fy = monthsNeeded!=null?Math.floor(monthsNeeded/12):null;
const fm = monthsNeeded!=null?monthsNeeded%12:null;

const yearKeys = Array.from({length:12},(_,i)=>mkKey(selYear,i));
const monthlyData = yearKeys.map((key,i)=>{ const mTxns=txnsByMonth[key]||[]; const expense=mTxns.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0); return {month:SHORT_MONTHS[i],key,leftover:totalIncome-expense,hasData:mTxns.length>0}; });
return (
<>
<div style={S.panel} className="card">


<div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8}}>
<span style={{fontFamily:"DM Serif Display",fontStyle:"italic",fontSize:18,color:C.text}}>Savings Goal</span>
<span style={{fontFamily:"DM Serif Display",fontStyle:"italic",fontSize:18,color:C.green}}>{fmt(savingsBal)}</span>
</div>


<div style={{height:6,borderRadius:99,background:C.border,overflow:"hidden",marginBottom:5}}>
<div style={{height:"100%",borderRadius:99,width:pct+"%",background:C.green,transition:"width 0.8s ease"}}/>
</div>
<div style={{display:"flex",justifyContent:"space-between",marginBottom:14}}>
<span style={{fontSize:11,color:C.muted,fontFamily:"DM Sans"}}>{pct.toFixed(0)}% saved</span>
<span style={{fontSize:11,color:C.muted,fontFamily:"DM Sans"}}>{fmt(remaining)} to go</span>
</div>


<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
<div>
<label style={S.lbl}>Goal</label>
<ClearOnFocusInput style={{...S.inp,padding:"7px 10px",fontSize:13}} initialValue={savingsGoal} onSave={v=>dispatch({type:"SET_SAVINGS_GOAL",value:v},state)}/>
</div>
<div>
<label style={S.lbl}>Saved</label>
<ClearOnFocusInput style={{...S.inp,padding:"7px 10px",fontSize:13}} initialValue={savingsBal} onSave={v=>dispatch({type:"SET_SAVINGS_BAL",value:v},state)}/>
</div>
<div>
<label style={S.lbl}>Monthly</label>
<ClearOnFocusInput style={{...S.inp,padding:"7px 10px",fontSize:13}} initialValue={savingsContrib} onSave={v=>dispatch({type:"SET_SAVINGS_CONTRIB",value:v},state)}/>
</div>
</div>


<div style={{borderTop:"1px solid "+C.border,paddingTop:12}}>
{remaining<=0 ? (
<div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
<span style={{fontSize:12,color:C.muted,fontFamily:"DM Sans"}}>Forecast</span>
<span style={{fontFamily:"DM Serif Display",fontStyle:"italic",fontSize:16,color:C.green}}>Goal reached!</span>
</div>
) : savingsContrib<=0 ? (
<div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
<span style={{fontSize:12,color:C.muted,fontFamily:"DM Sans"}}>Forecast</span>
<span style={{fontSize:12,color:C.muted,fontFamily:"DM Sans"}}>Enter monthly contribution</span>
</div>
) : (
<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
<div>
<div style={{fontSize:11,color:C.muted,fontFamily:"DM Sans",marginBottom:2}}>Forecast</div>
<div style={{fontSize:12,color:C.muted,fontFamily:"DM Sans"}}>at {fmtS(savingsContrib)}/mo</div>
</div>
<div style={{textAlign:"right"}}>
<div style={{fontFamily:"DM Serif Display",fontStyle:"italic",fontSize:20,color:T.accent}}>
{fy>0&&fm>0?fy+"y "+fm+"mo":fy>0?fy+" yr"+(fy>1?"s":""):fm+" mo"}
</div>
<div style={{fontSize:11,color:C.muted,fontFamily:"DM Sans"}}>{fmt(remaining)} remaining</div>
</div>
</div>
)}
</div>

</div>
<div style={S.panel} className="card">
<div style={S.title}>Income vs Spending — {selYear}</div>
<div style={{display:"grid",gridTemplateColumns:"30px 1fr 1fr 1fr",gap:"3px 6px",marginBottom:6}}>
{["","Income","Spent","Left"].map(h=><div key={h} style={{fontSize:9,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em",paddingBottom:5,borderBottom:"1px solid "+C.border,textAlign:h?"right":"left"}}>{h}</div>)}
</div>
{monthlyData.map(m=>{ const mTxns=txnsByMonth[m.key]||[]; const expense=mTxns.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0); const isCur=m.key===monthKey; return (
<div key={m.month} style={{display:"grid",gridTemplateColumns:"30px 1fr 1fr 1fr",gap:"3px 6px",padding:"5px 2px",borderBottom:"1px solid "+C.border+"44",opacity:m.hasData?1:0.3,background:isCur?C.accent+"11":"transparent",borderRadius:isCur?4:0}}>
<div style={{fontSize:11,color:isCur?C.accent:C.muted,fontWeight:isCur?700:400}}>{m.month}</div>
<div style={{fontSize:11,color:C.green,textAlign:"right"}}>{m.hasData?fmtS(totalIncome):"—"}</div>
<div style={{fontSize:11,color:C.amber,textAlign:"right"}}>{m.hasData?fmtS(expense):"—"}</div>
<div style={{fontSize:11,fontWeight:600,textAlign:"right",color:!m.hasData?C.muted:m.leftover>=0?C.green:C.red}}>{m.hasData?(m.leftover>=0?"+":"")+fmtS(m.leftover):"—"}</div>
</div>
); })}
</div>
</>
);
}

const BudgetsView = () => {
return <BudgetsViewComponent allCats={allCats} hiddenSet={hiddenSet} spentByCat={spentByCat} budgets={budgets} totalIncome={totalIncome} totalExpense={totalExpense} managingCats={managingCats} setManagingCats={setManagingCats} selMonth={selMonth} selYear={selYear} onSaveBudget={(id,v)=>dispatch({type:"SET_BUDGET",id,value:v},state)} S={S} C={C} CatManagerHeader={CatManagerHeader} CatManagerRows={CatManagerRows}/>;
}


const BillsView = () => {
const billCats = allCats.filter(function(c){return c.bill;});
const billCatIds = new Set(billCats.map(function(c){return c.id;}));
const loggedBills = txns.filter(function(t){return billCatIds.has(t.category);});
const loggedIds = new Set(loggedBills.map(function(t){return t.category;}));
const totalBills = loggedBills.reduce(function(s,t){return s+t.amount;},0);
const totalBudgeted = billCats.reduce(function(s,c){return s+(budgets[c.id]||0);},0);
const missingBills = billCats.filter(function(c){return !loggedIds.has(c.id)&&budgets[c.id]>0;});
const handleAutoAdd = function(cat){
  const amount=budgets[cat.id]||0;
  const day=String(logDateOverride[cat.id]||1).padStart(2,"0");
  const daysInMonth=new Date(selYear,selMonth+1,0).getDate();
  const safeDay=String(Math.min(parseInt(day)||1,daysInMonth)).padStart(2,"0");
  addExpenseFn({desc:cat.label,amount,category:cat.id,date:monthKey+"-"+safeDay});
};
const handleAddAll = function(){
  missingBills.forEach(function(cat){
    const day=String(logDateOverride[cat.id]||1).padStart(2,"0");
    const daysInMonth=new Date(selYear,selMonth+1,0).getDate();
    const safeDay=String(Math.min(parseInt(day)||1,daysInMonth)).padStart(2,"0");
    addExpenseFn({desc:cat.label,amount:budgets[cat.id],category:cat.id,date:monthKey+"-"+safeDay});
  });
};
const addCustomBill = function(){
  var nameEl=document.getElementById("ab-name");
  var amtEl=document.getElementById("ab-amt");
  var dateEl=document.getElementById("ab-date");
  var name=(nameEl&&nameEl.value||"").trim();
  if(!name) return;
  var id="cb_"+Date.now();
  var billTypes={
    mortgage:{icon:"🏠",color:"#60a5fa"},rent:{icon:"🏠",color:"#60a5fa"},
    council:{icon:"🏛",color:"#94a3b8"},electricity:{icon:"⚡",color:"#fbbf24"},
    gas:{icon:"🔥",color:"#f97316"},water:{icon:"💧",color:"#38bdf8"},
    internet:{icon:"📶",color:"#818cf8"},phone:{icon:"📱",color:"#a78bfa"},
    insurance:{icon:"🛡",color:"#34d399"},subscription:{icon:"🎬",color:"#f472b6"},
    tv_licence:{icon:"📺",color:"#60c4f0"},gym:{icon:"🏋",color:"#fb7185"},
    service_charge:{icon:"🏢",color:"#94a3b8"},ground_rent:{icon:"📋",color:"#94a3b8"},
    transport:{icon:"🚂",color:"#34d399"},childcare:{icon:"👶",color:"#f472b6"},
    other:{icon:"📄",color:"#94a3b8"}
  };
  var t=billTypes[newBillType]||billTypes.other;
  var amt=Math.abs(parseFloat((amtEl&&amtEl.value)||"0")||0);
  var day=parseInt(((dateEl&&dateEl.value)||"").split("-")[2])||1;
  dispatch({type:"ADD_CUSTOM_CAT",cat:{id:id,label:name,icon:t.icon,color:t.color,group:"Bills",bill:true,fixed:false}},state);
  setTimeout(function(){dispatch({type:"SET_BUDGET",id:id,value:amt},state);},50);
  setTimeout(function(){setLogDateOverride(function(p){var n=Object.assign({},p);n[id]=day;return n;});},50);
  setNewBillType("");
  setShowAddBill(false);
};
return (
<>
<div style={{display:"flex",background:C.elevated,borderRadius:12,padding:4,marginBottom:12,border:"1px solid "+C.border}}>
<button onClick={function(){setBillsSection("bills");}} style={{flex:1,padding:"9px",borderRadius:9,border:"none",background:billsSection==="bills"?C.surface:"transparent",color:billsSection==="bills"?C.text:C.muted,fontFamily:"DM Sans",fontSize:14,fontWeight:billsSection==="bills"?600:400,cursor:"pointer"}}>Bills</button>
<button onClick={function(){setBillsSection("budgets");}} style={{flex:1,padding:"9px",borderRadius:9,border:"none",background:billsSection==="budgets"?C.surface:"transparent",color:billsSection==="budgets"?C.text:C.muted,fontFamily:"DM Sans",fontSize:14,fontWeight:billsSection==="budgets"?600:400,cursor:"pointer"}}>Budgets</button>
</div>
{showAddBill && (
<div style={{position:"fixed",inset:0,zIndex:300,background:C.bg,overflowY:"auto",display:"flex",flexDirection:"column"}}>
<div style={{padding:"16px 16px 32px",flex:1}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
<span style={{fontFamily:"DM Serif Display",fontStyle:"italic",fontSize:22,color:C.text}}>Add Bill</span>
<button onClick={function(){setShowAddBill(false);setNewBillType("");}} style={{background:C.elevated,border:"1px solid "+C.border,color:C.muted,borderRadius:10,padding:"8px 14px",fontSize:14,cursor:"pointer",fontFamily:"DM Sans"}}>Cancel</button>
</div>
<div style={{marginBottom:14}}>
<label style={{...S.lbl,fontSize:12,marginBottom:6,display:"block"}}>Bill name</label>
<input id="ab-name" style={{...S.inp,fontSize:15,padding:"12px 14px",width:"100%",boxSizing:"border-box",height:48}} placeholder="e.g. Mortgage"/>
</div>
<div style={{marginBottom:14}}>
<label style={{...S.lbl,fontSize:12,marginBottom:8,display:"block"}}>Bill type</label>
<div style={{position:"relative"}}>
<button type="button" onClick={function(){var d=document.getElementById("bill-type-dd");if(d)d.style.display=d.style.display==="block"?"none":"block";}} style={{...S.inp,width:"100%",height:48,padding:"12px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",border:"1px solid "+C.border,background:C.elevated,textAlign:"left",boxSizing:"border-box"}}>
<span style={{fontSize:15,color:newBillType?C.text:C.muted,fontFamily:"DM Sans"}}>{newBillType?newBillType.replace(/_/g," ").replace(/w/g,function(c){return c.toUpperCase();}):"Select type..."}</span>
<span style={{color:C.muted,fontSize:11,flexShrink:0}}>▾</span>
</button>
<div id="bill-type-dd" style={{position:"absolute",top:"100%",left:0,right:0,zIndex:50,background:C.surface,border:"1px solid "+C.border,borderRadius:12,marginTop:4,overflow:"hidden",boxShadow:"0 8px 24px #00000066",display:"none"}}>
<div style={{maxHeight:280,overflowY:"auto"}}>
{[{v:"mortgage",icon:"🏠",label:"Mortgage"},{v:"rent",icon:"🏠",label:"Rent"},{v:"council",icon:"🏛",label:"Council Tax"},{v:"electricity",icon:"⚡",label:"Electricity"},{v:"gas",icon:"🔥",label:"Gas"},{v:"water",icon:"💧",label:"Water"},{v:"internet",icon:"📶",label:"Broadband"},{v:"phone",icon:"📱",label:"Phone"},{v:"insurance",icon:"🛡",label:"Insurance"},{v:"subscription",icon:"🎬",label:"Subscription"},{v:"tv_licence",icon:"📺",label:"TV Licence"},{v:"gym",icon:"🏋",label:"Gym"},{v:"service_charge",icon:"🏢",label:"Service Charge"},{v:"ground_rent",icon:"📋",label:"Ground Rent"},{v:"transport",icon:"🚂",label:"Transport"},{v:"childcare",icon:"👶",label:"Childcare"},{v:"other",icon:"📄",label:"Other"}].map(function(opt,idx,arr){return (
<button key={opt.v} type="button" onClick={function(){setNewBillType(opt.v);var d=document.getElementById("bill-type-dd");if(d)d.style.display="none";}} style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"13px 16px",background:newBillType===opt.v?T.accent+"22":"transparent",border:"none",borderBottom:idx<arr.length-1?"1px solid "+C.border+"55":"none",cursor:"pointer",textAlign:"left",fontFamily:"DM Sans",fontSize:14,color:newBillType===opt.v?T.accent:C.text,fontWeight:newBillType===opt.v?600:400}}>
<span style={{fontSize:20,flexShrink:0,width:28,textAlign:"center"}}>{opt.icon}</span>
<span>{opt.label}</span>
{newBillType===opt.v && <span style={{marginLeft:"auto",color:T.accent}}>✓</span>}
</button>
);
})}
</div>
</div>
</div>
</div>
<div style={{marginBottom:14}}>
<label style={{...S.lbl,fontSize:12,marginBottom:6,display:"block"}}>Monthly amount (£)</label>
<input id="ab-amt" style={{...S.inp,fontSize:15,padding:"12px 14px",width:"100%",boxSizing:"border-box",height:48}} type="text" inputMode="decimal" placeholder="0.00"/>
</div>
<div style={{marginBottom:24}}>
<label style={{...S.lbl,fontSize:12,marginBottom:6,display:"block"}}>Direct debit date</label>
<div style={{position:"relative",height:48}}>
<input id="ab-date" style={{...S.inp,fontSize:15,padding:"12px 14px",width:"100%",boxSizing:"border-box",height:48,color:C.text}} type="date" onChange={function(e){var ph=document.getElementById("ab-date-ph");if(ph)ph.style.display=e.target.value?"none":"block";}}/>
<span id="ab-date-ph" style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",fontSize:15,color:C.muted,pointerEvents:"none",fontFamily:"DM Sans"}}>Select date...</span>
</div>
</div>
<button onClick={addCustomBill} style={{...S.btn,width:"100%",padding:"14px",fontSize:15,borderRadius:12,height:48,boxSizing:"border-box"}}>Add Bill</button>
</div>
</div>
)}
{billsSection==="bills" && (
<>
<div style={S.panel} className="card">
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
<div style={{...S.title,margin:0}}>Monthly Bills</div>
<button onClick={function(){setShowAddBill(true);}} style={{...S.ghost,padding:"5px 12px",fontSize:12,color:T.accent}}>+ Add</button>
</div>
<div style={{display:"flex",flexDirection:"column"}}>
{billCats.map(function(cat,i,arr){
var logged=loggedBills.filter(function(t){return t.category===cat.id;});
var loggedAmt=logged.reduce(function(s,t){return s+t.amount;},0);
var loggedTxn=logged[0];
var budgeted=budgets[cat.id]||0;
var isPaid=loggedIds.has(cat.id);
var isEditingDt=editingDate===cat.id;
var dayVal=logDateOverride[cat.id]||1;
var over=isPaid&&loggedAmt>budgeted&&budgeted>0;
var diff=budgeted>0?Math.abs(budgeted-loggedAmt):0;
var today=new Date();
var todayDay=today.getDate();
var daysUntil=dayVal-todayDay;
if(daysUntil<0){var dim=new Date(today.getFullYear(),today.getMonth()+2,0).getDate();daysUntil=dim-todayDay+dayVal;}
var dueLabel=daysUntil===0?"due today":daysUntil===1?"due tomorrow":"due in "+daysUntil+" days";
return (
<div key={cat.id} style={{padding:"11px 0",borderBottom:i<arr.length-1?"1px solid "+C.border+"55":"none"}}>
<div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
<span style={{fontSize:14,flexShrink:0,width:20,textAlign:"center"}}>{cat.icon}</span>
<span style={{fontSize:13,color:C.text,flex:1,fontWeight:500,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cat.label}</span>
<button onClick={function(){var el=document.getElementById("billmenu-"+cat.id);if(el)el.style.display=el.style.display==="none"?"block":"none";}} style={{background:"transparent",border:"none",color:C.muted,cursor:"pointer",fontSize:16,padding:"0 4px",lineHeight:1,flexShrink:0}}>···</button>
{budgeted>0 && (
<span style={{fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:20,background:isPaid?(over?C.red+"22":C.green+"22"):daysUntil<=3?C.red+"22":C.amber+"22",color:isPaid?(over?C.red:C.green):daysUntil<=3?C.red:C.amber,flexShrink:0}}>
{isPaid?(over?"£"+diff.toFixed(0)+" over":"£"+diff.toFixed(0)+" left"):dueLabel}
</span>
)}
</div>
<div id={"billmenu-"+cat.id} style={{display:"none",background:C.elevated,borderRadius:10,padding:"4px 0",marginBottom:6,border:"1px solid "+C.border}}>
<button onClick={function(){if(loggedTxn)deleteTxn(loggedTxn.id);var el=document.getElementById("billmenu-"+cat.id);if(el)el.style.display="none";}} style={{width:"100%",background:"transparent",border:"none",padding:"10px 16px",textAlign:"left",fontSize:13,color:C.amber,fontFamily:"DM Sans",cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>
<span>↩</span><span>Undo payment</span>
</button>
<button onClick={function(){
  if(loggedTxn)deleteTxn(loggedTxn.id);
  if(cat.fixed)dispatch({type:"DELETE_BUILTIN_CAT",id:cat.id},state);
  else dispatch({type:"REMOVE_CUSTOM_CAT",id:cat.id},state);
  var el=document.getElementById("billmenu-"+cat.id);if(el)el.style.display="none";
}} style={{width:"100%",background:"transparent",border:"none",padding:"10px 16px",textAlign:"left",fontSize:13,color:C.red,fontFamily:"DM Sans",cursor:"pointer",display:"flex",alignItems:"center",gap:10,borderTop:"1px solid "+C.border+"44"}}>
<span>🗑</span><span>Delete this bill</span>
</button>
</div>
<div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
<span style={{fontSize:11,color:C.muted,flexShrink:0}}>{isPaid?fmt(loggedAmt):"£0"}</span>
<span style={{fontSize:11,color:C.border,flexShrink:0}}>/</span>
<BudgetInput catId={cat.id} initialValue={budgeted} color={"#7b9cff"} onSave={function(v){dispatch({type:"SET_BUDGET",id:cat.id,value:v},state);}} S={S} C={C}/>
{isEditingDt ? (
<div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
<input autoFocus style={{...S.inp,width:130,padding:"5px 8px",fontSize:12}} type="date" value={editingDateVal} onChange={function(e){setEditingDateVal(e.target.value);}} onKeyDown={function(e){if(e.key==="Enter"){setLogDateOverride(function(p){var n=Object.assign({},p);n[cat.id]=parseInt((editingDateVal||"").split("-")[2])||1;return n;});setEditingDate(null);}if(e.key==="Escape")setEditingDate(null);}}/>
<button onClick={function(){setLogDateOverride(function(p){var n=Object.assign({},p);n[cat.id]=parseInt((editingDateVal||"").split("-")[2])||1;return n;});setEditingDate(null);}} style={{...S.btn,padding:"5px 10px",fontSize:12}}>Save</button>
</div>
) : isPaid ? (
<button onClick={function(){var el=document.getElementById("billmenu-"+cat.id);if(el)el.style.display=el.style.display==="none"?"block":"none";}} style={{...S.ghost,padding:"3px 7px",fontSize:11,color:C.muted,marginLeft:"auto",flexShrink:0}}>Undo</button>
) : budgeted>0 ? (
<button onClick={function(){handleAutoAdd(cat);}} style={{...S.btn,padding:"5px 10px",fontSize:11,background:"#7b9cff",marginLeft:"auto",flexShrink:0}}>Mark Paid</button>
) : (
<button onClick={function(){setEditingBudget(cat.id);setEditingVal("");}} style={{...S.ghost,padding:"5px 10px",fontSize:11,color:T.accent,marginLeft:"auto",flexShrink:0}}>Set</button>
)}
</div>
<div style={{display:"flex",alignItems:"center",gap:6,marginLeft:28,marginTop:2,marginBottom:budgeted>0?4:0}}>
<span style={{fontSize:10,color:C.muted,fontFamily:"DM Sans"}}>DD:</span>
<button onClick={function(){setEditingDate(cat.id);var mo=String(selMonth+1).padStart(2,"0");var dy=String(dayVal).padStart(2,"0");setEditingDateVal(selYear+"-"+mo+"-"+dy);}} style={{background:"transparent",border:"none",padding:0,cursor:"pointer",fontSize:10,color:"#7b9cff",fontFamily:"DM Sans",fontWeight:600}}>{"day "+dayVal}</button>
</div>
{budgeted>0 && (
<div style={{height:3,borderRadius:99,background:C.border,overflow:"hidden",marginLeft:28}}>
<div style={{height:"100%",borderRadius:99,width:isPaid?Math.min((loggedAmt/budgeted)*100,100)+"%":"0%",background:over?C.red:"#7b9cff",transition:"width 0.5s ease"}}/>
</div>
)}
</div>
);
})}
</div>
</div>
<div style={S.panel} className="card">
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
<div>
<div style={{fontFamily:"DM Serif Display",fontStyle:"italic",fontSize:22,color:C.text}}>{fmt(totalBills)}</div>
<div style={{fontSize:11,color:C.muted,fontFamily:"DM Sans",marginTop:2}}>logged of {fmt(totalBudgeted)} budgeted</div>
</div>
<div style={{textAlign:"right"}}>
<div style={{fontSize:12,color:missingBills.length>0?C.amber:C.green,fontFamily:"DM Sans",fontWeight:600}}>{missingBills.length>0?missingBills.length+" pending":"All logged"}</div>
<div style={{fontSize:11,color:C.muted,fontFamily:"DM Sans",marginTop:2}}>{MONTHS[selMonth]} {selYear}</div>
</div>
</div>
<div style={{height:4,borderRadius:99,background:C.border,overflow:"hidden",marginBottom:missingBills.length>0?12:0}}>
<div style={{height:"100%",borderRadius:99,width:totalBudgeted>0?Math.min((totalBills/totalBudgeted)*100,100)+"%":"0%",background:missingBills.length>0?C.amber:C.green,transition:"width 0.6s ease"}}/>
</div>
{missingBills.length>0 && <button onClick={handleAddAll} style={{...S.btn,width:"100%",padding:"10px",fontSize:13,background:C.amber}}>Log all {missingBills.length} pending bills</button>}
</div>
</>
)}
{billsSection==="budgets" && (
<BudgetsViewComponent allCats={allCats.filter(function(c){return !c.bill;})} hiddenSet={hiddenSet} spentByCat={spentByCat} budgets={budgets} totalIncome={totalIncome} totalExpense={totalExpense} managingCats={managingCats} setManagingCats={setManagingCats} selMonth={selMonth} selYear={selYear} onSaveBudget={function(id,v){dispatch({type:"SET_BUDGET",id:id,value:v},state);}} S={S} C={C} CatManagerHeader={CatManagerHeader} CatManagerRows={CatManagerRows}/>
)}
</>
);
}


const YearView = () => {
const yearKeys = Array.from({length:12},(_,i)=>mkKey(selYear,i));
const monthStats = yearKeys.map((key,i)=>{ const mTxns=txnsByMonth[key]||[]; const income=sources.reduce((s,r)=>s+r.amount,0); const expense=mTxns.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0); return {key,month:SHORT_MONTHS[i],income,expense,balance:income-expense,hasData:mTxns.length>0}; });
const withData = monthStats.filter(m=>m.hasData);
const annualIncome  = withData.length*sources.reduce((s,r)=>s+r.amount,0);
const annualExpense = withData.reduce((s,m)=>s+m.expense,0);
const annualBalance = annualIncome-annualExpense;
const catTotals = {}; yearKeys.forEach(key=>(txnsByMonth[key]||[]).filter(t=>t.type==="expense").forEach(t=>{catTotals[t.category]=(catTotals[t.category]||0)+t.amount;}));
const sortedCats = Object.entries(catTotals).sort((a,b)=>b[1]-a[1]);
const maxCatAmt = sortedCats[0]?.[1]||1;
const bestMonth = [...withData].sort((a,b)=>b.balance-a.balance)[0];
const worstMonth = [...withData].sort((a,b)=>a.balance-b.balance)[0];
const biggestMonth = [...withData].sort((a,b)=>b.expense-a.expense)[0];
const fmtW = n=>"£"+Math.abs(Math.round(n)).toLocaleString("en-GB",{maximumFractionDigits:0});
const remaining = Math.max(savingsGoal-savingsBal,0);
const monthsNeeded = savingsContrib>0&&remaining>0?Math.ceil(remaining/savingsContrib):null;
const fy = monthsNeeded!=null?Math.floor(monthsNeeded/12):null;
const fm = monthsNeeded!=null?monthsNeeded%12:null;
const timeStr = remaining<=0?"Goal reached!":savingsContrib<=0?"Set contribution":monthsNeeded===null?"No data yet":fy>0&&fm>0?fy+"y "+fm+"m":fy>0?fy+" year"+(fy>1?"s":""):fm===0?"<1mo":fm+" month"+(fm!==1?"s":"");
const forecastColor = remaining<=0?C.green:savingsContrib>0?C.accent:C.muted;
const forecastSub = remaining<=0?"You've reached your goal!":savingsContrib>0?fmtW(savingsContrib)+"/mo contribution":"Set contribution in Savings";
const cols = "30px 1fr 1fr 1fr";
return (
<>
<div style={S.grid2}>
{[
{label:selYear+" Income",  value:fmt(annualIncome),  color:C.green, sub:withData.length+" months"},
{label:selYear+" Spending",value:fmt(annualExpense), color:C.amber, sub:"All expenses"},
{label:selYear+" Balance", value:fmt(annualBalance), color:annualBalance>=0?C.green:C.red, sub:"Income − spend"},
{label:"Monthly Avg Spend",value:fmt(withData.length>0?Math.round(annualExpense/withData.length):0),color:C.amber,sub:"Per month"},
{label:"Avg Left Over",    value:fmt(withData.length>0?Math.round(annualBalance/withData.length):0),color:annualBalance>=0?C.green:C.red,sub:"Per month"},
{label:"Savings Forecast", value:timeStr, color:forecastColor, sub:forecastSub},
].map((s,i)=><StatCard key={s.label} {...s} delay={i*0.05}/>)}
</div>
<div style={S.panel} className="card">
<div style={S.title}>Income by Source — {selYear}</div>
{sources.map(src=>{ const annual=withData.length*src.amount; const pct=annualIncome>0?(annual/annualIncome)*100:0; return (
<div key={src.id} style={{marginBottom:14}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
<span style={{fontSize:13,display:"flex",gap:8,alignItems:"center"}}><span style={{width:28,height:28,borderRadius:7,background:src.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:src.color,flexShrink:0}}>{src.label.charAt(0)}</span>{src.label}</span>
<div style={{textAlign:"right"}}><span style={{fontFamily:"DM Serif Display",fontStyle:"italic",fontSize:15,color:src.color}}>{fmt(annual)}</span><span style={{fontSize:11,color:C.muted,marginLeft:6}}>{pct.toFixed(0)}%</span></div>
</div>
<div style={{height:5,borderRadius:99,background:C.border,overflow:"hidden"}}><div style={{height:"100%",borderRadius:99,width:pct+"%",background:src.color,transition:"width 0.7s ease"}}/></div>
<div style={{fontSize:10,color:C.muted,marginTop:3}}>{fmt(src.amount)}/mo x {withData.length} months</div>
</div>
); })}
<div style={{paddingTop:12,borderTop:"1px solid "+C.border,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
<span style={{fontSize:13,fontWeight:600}}>Total Annual Income</span>
<span style={{fontFamily:"DM Serif Display",fontStyle:"italic",fontSize:18,color:C.green}}>{fmt(annualIncome)}</span>
</div>
</div>
<div style={S.panel} className="card">
<div style={S.title}>Month by Month</div>
<div style={{display:"grid",gridTemplateColumns:cols,gap:"4px 6px",marginBottom:8}}>
{["","Income","Spent","Left"].map(h=><div key={h} style={{fontSize:9,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em",fontWeight:600,paddingBottom:6,borderBottom:"1px solid "+C.border,textAlign:h?"right":"left"}}>{h}</div>)}
</div>
{monthStats.map((m,i)=>(
<div key={m.month} onClick={()=>{changeMonth(selYear,i);setView("Overview");}} style={{display:"grid",gridTemplateColumns:cols,gap:"4px 6px",padding:"5px 2px",borderBottom:"1px solid "+C.border+"44",cursor:"pointer",opacity:m.hasData?1:0.4,background:m.key===monthKey?C.accent+"11":"transparent",borderRadius:m.key===monthKey?4:0}}>
<div style={{fontSize:11,fontWeight:m.key===monthKey?700:400,color:m.key===monthKey?C.accent:C.muted}}>{m.month}</div>
<div style={{fontSize:10,color:C.green,textAlign:"right"}}>{m.hasData?fmtW(m.income):"—"}</div>
<div style={{fontSize:10,color:C.amber,textAlign:"right"}}>{m.hasData?fmtW(m.expense):"—"}</div>
<div style={{fontSize:10,fontWeight:600,textAlign:"right",color:!m.hasData?C.muted:m.balance>=0?C.green:C.red}}>{m.hasData?(m.balance>=0?"+":"")+fmtW(m.balance):"—"}</div>
</div>
))}
<div style={{display:"grid",gridTemplateColumns:cols,gap:"4px 6px",padding:"8px 2px 0",marginTop:4,borderTop:"1px solid "+C.border}}>
<div style={{fontSize:11,fontWeight:700,color:C.text}}>Total</div>
<div style={{fontSize:10,fontWeight:700,color:C.green,textAlign:"right"}}>{fmtW(annualIncome)}</div>
<div style={{fontSize:10,fontWeight:700,color:C.amber,textAlign:"right"}}>{fmtW(annualExpense)}</div>
<div style={{fontSize:10,fontWeight:700,textAlign:"right",color:annualBalance>=0?C.green:C.red}}>{annualBalance>=0?"+":""}{fmtW(annualBalance)}</div>
</div>
</div>
{sortedCats.length>0 && (
<div style={S.panel} className="card">
<div style={S.title}>Where Your Money Goes — {selYear}</div>
{sortedCats.map(([catId,total])=>{ const c=catMap[catId]||{icon:"📦",label:catId,color:C.muted}; const pct=annualExpense>0?(total/annualExpense)*100:0; return (
<div key={catId} style={{marginBottom:14}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
<span style={{fontSize:13,display:"flex",gap:8,alignItems:"center",fontFamily:"DM Sans"}}>
<span style={{fontSize:14,width:18,textAlign:"center",flexShrink:0}}>{c.icon}</span>{c.label}
</span>
<div style={{textAlign:"right"}}><span style={{fontSize:13,fontWeight:600,color:c.color}}>{fmt(total)}</span><span style={{fontSize:11,color:C.muted,marginLeft:6}}>{pct.toFixed(0)}%</span></div>
</div>
<div style={{height:5,borderRadius:99,background:C.border,overflow:"hidden"}}><div style={{height:"100%",borderRadius:99,width:(total/maxCatAmt*100)+"%",background:c.color}}/></div>
</div>
); })}
</div>
)}
{withData.length>=2 && (()=>{
const items = [
bestMonth    && {label:"Most Saved",  month:bestMonth.month,    value:fmtW(bestMonth.balance),           valueSub:"left over",   color:C.green, bg:C.green},
worstMonth   && {label:"Least Saved", month:worstMonth.month,   value:fmtW(Math.abs(worstMonth.balance)), valueSub:worstMonth.balance<0?"overspent":"left over", color:worstMonth.balance<0?C.red:C.amber, bg:worstMonth.balance<0?C.red:C.amber},
biggestMonth && {label:"Most Spent",  month:biggestMonth.month, value:fmtW(biggestMonth.expense),         valueSub:"in expenses", color:C.red,   bg:C.red},
].filter(Boolean);
return (
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
{items.map(ins=>(
<div key={ins.label} style={{background:ins.bg+"18",border:"1px solid "+ins.bg+"44",borderRadius:12,padding:"12px 10px",display:"flex",flexDirection:"column",alignItems:"center",textAlign:"center"}}>
<div style={{fontSize:9,color:ins.color,textTransform:"uppercase",letterSpacing:"0.07em",fontFamily:"DM Sans",fontWeight:600,marginBottom:6,whiteSpace:"nowrap"}}>{ins.label}</div>
<div style={{fontFamily:"DM Serif Display",fontStyle:"italic",fontSize:18,color:ins.color,lineHeight:1,marginBottom:4}}>{ins.month}</div>
<div style={{fontSize:13,fontWeight:600,color:ins.color,fontFamily:"DM Sans"}}>{ins.value}</div>
<div style={{fontSize:10,color:ins.color,opacity:0.7,fontFamily:"DM Sans",whiteSpace:"nowrap"}}>{ins.valueSub}</div>
</div>
))}
</div>
);
})()}
</>
);
}

return (
<div style={{height:"100vh",background:T.bg,fontFamily:"DM Sans, sans-serif",color:C.text,display:"flex",flexDirection:"column",overflowX:"hidden",width:"100%",transition:"background 0.8s ease"}}>
<style>{fontStyle}</style>
<div style={{background:T.header,transition:"background 0.8s ease",height:52,display:"flex",alignItems:"center",padding:"0 14px",gap:0}}>


<div style={{width:80,flexShrink:0,display:"flex",alignItems:"center",gap:6}}>
<span style={{fontSize:17,fontFamily:"DM Serif Display",fontStyle:"italic",color:"#fff",letterSpacing:"-0.3px"}}>Penny</span>
<span style={{fontSize:7,color:T.accent,letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:"DM Sans",fontWeight:600,opacity:0.9,marginTop:1}}>{T.name.replace(/[^\w\s]/g,"").trim()}</span>
</div>


<div style={{flex:1,display:"flex",justifyContent:"center"}}>
{view!=="Year" ? (
<MonthPicker year={selYear} month={selMonth} onChange={changeMonth} accent={T.accent}/>
):(
<div style={{width:120,display:"flex",alignItems:"center",justifyContent:"space-between",background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:20,padding:"5px 10px",backdropFilter:"blur(8px)"}}>
<button onClick={()=>setSelYear(y=>Math.max(2020,y-1))} style={{background:"none",border:"none",color:"#fff",cursor:"pointer",padding:"0 2px",display:"flex",alignItems:"center",opacity:selYear<=2020?0.3:0.7}}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
</button>
<span style={{fontFamily:"DM Serif Display",fontStyle:"italic",fontSize:13,color:"#fff",whiteSpace:"nowrap",textAlign:"center",flex:1}}>{selYear}</span>
<button onClick={()=>setSelYear(y=>Math.min(2035,y+1))} style={{background:"none",border:"none",color:"#fff",cursor:"pointer",padding:"0 2px",display:"flex",alignItems:"center",opacity:selYear>=2035?0.3:0.7}}>
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
</button>
</div>
)}
</div>


<div style={{width:80,flexShrink:0,display:"flex",justifyContent:"flex-end"}}>
<button onClick={()=>openAddModal()}
style={{background:"rgba(255,255,255,0.15)",backdropFilter:"blur(8px)",color:"#fff",border:"1px solid rgba(255,255,255,0.2)",borderRadius:20,fontFamily:"DM Sans",fontWeight:600,fontSize:13,padding:"6px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:5,whiteSpace:"nowrap",transition:"background 0.2s"}}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
Add
</button>
</div>

</div>
<div ref={contentRef} {...swipeHandlers} style={{padding:"16px 16px 90px",flex:1,background:T.bg,overflowX:"hidden",overflowY:"auto",width:"100%",maxWidth:"100%",transition:"background 0.8s ease"}}>
{view==="Overview"     && <OverviewView/>}
{view==="Transactions" && <TransactionsView/>}
{view==="Bills"       && <BillsView/>}
{view==="Savings"      && <SavingsView/>}

{view==="Year"         && <YearView/>}
</div>


{toast && (
<div style={{position:"fixed",bottom:80,left:"50%",transform:"translateX(-50%)",zIndex:300,background:C.surface,border:"1px solid "+toast.color+"55",borderRadius:20,padding:"10px 20px",boxShadow:"0 4px 20px #00000066",display:"flex",alignItems:"center",gap:8,pointerEvents:"none",whiteSpace:"nowrap"}}>
<div style={{width:8,height:8,borderRadius:99,background:toast.color,flexShrink:0}}/>
<span style={{fontSize:13,color:C.text,fontFamily:"DM Sans"}}>{toast.msg}</span>
</div>
)}
<div style={{position:"fixed",bottom:0,left:0,right:0,background:T.surface,borderTop:"1px solid "+T.border,display:"flex",alignItems:"stretch",zIndex:50,transition:"background 0.8s ease",paddingBottom:"env(safe-area-inset-bottom, 0px)"}}>
{[
{v:"Overview", icon:(
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
  </svg>)},
{v:"Transactions", icon:(
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 16V4m0 0L3 8m4-4l4 4"/>
    <path d="M17 8v12m0 0l4-4m-4 4l-4-4"/>
  </svg>)},
{v:"Savings", icon:(
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 12V8a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h14a2 2 0 002-2v-2"/>
    <path d="M20 12a2 2 0 000-4h-2a2 2 0 000 4h2z"/>
    <path d="M6 10h.01M6 14h.01"/>
  </svg>)},
{v:"Bills", icon:(
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
    <path d="M14 2v6h6"/>
    <path d="M9 13h6M9 17h4"/>
  </svg>)},
{v:"Year", icon:(
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <path d="M16 2v4M8 2v4M3 10h18"/>
    <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>
  </svg>)},
].map(({v,icon})=>(
<button key={v} onClick={()=>setView(v)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,padding:"10px 2px 10px",border:"none",cursor:"pointer",background:"transparent",color:view===v?T.accent:C.muted,fontFamily:"DM Sans",transition:"color 0.2s",borderTop:view===v?"2px solid "+T.accent:"2px solid transparent"}}>
{icon}
<span style={{fontSize:10,fontWeight:view===v?600:400,letterSpacing:"0.02em",whiteSpace:"nowrap"}}>{v}</span>
</button>
))}
</div>

{showAddModal && (
<div style={{position:"fixed",inset:0,zIndex:200,display:"flex",flexDirection:"column",justifyContent:"flex-start"}} onClick={()=>setShowAddModal(false)}>
<div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(2px)"}}/>
<div onClick={e=>e.stopPropagation()} style={{position:"relative",background:C.surface,borderRadius:0,border:"1px solid "+C.border,boxShadow:"0 8px 40px #00000099",display:"flex",flexDirection:"column",minHeight:"100vh",width:"100%"}}>
<div style={{padding:"16px 20px 0",flexShrink:0}}>
<div style={{display:"flex",background:C.elevated,borderRadius:10,padding:3,marginBottom:14}}>
<button onClick={()=>setModalTxnType("expense")} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"9px",borderRadius:8,border:"none",cursor:"pointer",fontFamily:"DM Sans",fontWeight:600,fontSize:13,transition:"all 0.2s",background:modalTxnType==="expense"?T.accent:"transparent",color:modalTxnType==="expense"?"#fff":C.muted}}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 16V4m0 0L3 8m4-4l4 4"/><path d="M17 8v12m0 0l4-4m-4 4l-4-4"/></svg>
Expense
</button>
<button onClick={()=>setModalTxnType("income")} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"9px",borderRadius:8,border:"none",cursor:"pointer",fontFamily:"DM Sans",fontWeight:600,fontSize:13,transition:"all 0.2s",background:modalTxnType==="income"?C.green:"transparent",color:modalTxnType==="income"?"#fff":C.muted}}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 19h12"/><path d="M6 13h8"/><path d="M9 19V9a4 4 0 0 1 7-2.65"/></svg>
Income
</button>
</div>
</div>
<div style={{overflowY:"auto",padding:"0 20px 8px",flex:1}}>
{modalTxnType==="expense" ? (
<ModalExpenseForm monthKey={monthKey} selMonth={selMonth} selYear={selYear} catSelectGroups={catSelectGroups} catMap={catMap} addExpenseFn={(p)=>{addExpenseFn(p);}} S={S} C={C} T={T} onCancel={()=>setShowAddModal(false)} submitRef={expenseSubmitRef} onCanSubmitChange={setExpenseCanSubmit}/>
):(
<ModalIncomeForm sources={sources} addSource={(s)=>{addSource(s);setIncomeChanged(true);}} updateAmt={updateAmt} removeSrc={(id)=>{removeSrc(id);setIncomeChanged(true);}} confirmDelete={confirmDelete} setConfirmDelete={setConfirmDelete} S={S} C={C} T={T} onChanged={()=>setIncomeChanged(true)} onClose={()=>setShowAddModal(false)}/>
)}
</div>
{modalTxnType==="expense" && (
<div style={{position:"sticky",bottom:0,padding:"12px 20px 20px",flexShrink:0,borderTop:"1px solid "+C.border,background:C.surface,zIndex:1}}>
<div style={{display:"grid",gridTemplateColumns:"1fr 2fr",gap:8}}>
<button style={{...S.ghost,padding:"12px",textAlign:"center",fontSize:13}} onClick={()=>setShowAddModal(false)}>Cancel</button>
<button style={{...S.btn,padding:"12px",fontSize:13,background:expenseCanSubmit?T.accent:"#3a3f52",cursor:expenseCanSubmit?"pointer":"not-allowed"}}
onClick={()=>expenseSubmitRef.current&&expenseSubmitRef.current()}>Add Expense</button>
</div>
</div>
)}
{modalTxnType==="income" && (
<div style={{position:"sticky",bottom:0,padding:"12px 20px 20px",flexShrink:0,borderTop:"1px solid "+C.border,background:C.surface,zIndex:1}}>
<div style={{display:"grid",gridTemplateColumns:"1fr 2fr",gap:8}}>
<button style={{...S.ghost,padding:"12px",textAlign:"center",fontSize:13}} onClick={()=>setShowAddModal(false)}>Cancel</button>
<button style={{...S.btn,padding:"12px",fontSize:13,background:incomeChanged?T.accent:"#3a3f52",cursor:incomeChanged?"pointer":"default"}} onClick={()=>setShowAddModal(false)}>Done</button>
</div>
</div>
)}
</div>
</div>
)}


<BottomSheet open={showCatManager} onClose={()=>setShowCatManager(false)} title="Manage Categories">
<CatManagerHeader/><CatManagerRows/>
</BottomSheet>


<BottomSheet open={managingCats} onClose={()=>setManagingCats(false)} title="Budget Categories">
<CatManagerHeader/><CatManagerRows showDelete={false}/>
</BottomSheet>

</div>
);
}
