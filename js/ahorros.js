const KEYS = {
    incomes:   "pfm.transactions.income",
    expenses:  "pfm.transactions.expense",
    balSave:   "pfm.balance.savings",
    balSafe:   "pfm.balance.safeTotal",
};
const TOTAL_KEYS = { income: "pfm.total.income", expense: "pfm.total.expense" };
const CFG_KEY  = "pfm.ahorros.config";
const LAST_KEY = "pfm.ahorros.lastComputed";

const els = {
    months:    document.getElementById("months"),
    savePct:   document.getElementById("savePct"),
    rent:      document.getElementById("rent"),
    food:      document.getElementById("food"),
    cell:      document.getElementById("cell"),
    dateStart: document.getElementById("dateStart"),
    dateEnd:   document.getElementById("dateEnd"),

    recalc:    document.getElementById("recalcBtn"),
    apply:     document.getElementById("applyBtn"),
    saveCfg:   document.getElementById("saveCfg"),

    subName:   document.getElementById("subName"),
    subAmt:    document.getElementById("subAmt"),
    addSub:    document.getElementById("addSub"),
    subsList:  document.getElementById("subsList"),

    rIncome:   document.getElementById("resIncomeApplied"),
    rFixedM:   document.getElementById("resFixedMonthly"),
    rFixedS:   document.getElementById("resFixedSemester"),
    rSaveNow:  document.getElementById("resSavingsNow"),
    rSafeTot:  document.getElementById("resSafeTotal"),
    rSafeMon:  document.getElementById("resSafePerMonth"),
};

const readJSON  = (k, fb)=>{ try{ const v = localStorage.getItem(k); return v?JSON.parse(v):fb; }catch{ return fb; } };
const writeJSON = (k,v)=> localStorage.setItem(k, JSON.stringify(v));
const money     = (n)=> (Number(n)||0).toLocaleString("es-PR",{style:"currency",currency:"USD"});
const fmt       = money;
const parseDate = (s)=> s ? new Date(s+"T00:00:00") : null;
function inRange(tx, a, b){
    if(!tx?.date) return true;
    const d = new Date(tx.date+"T00:00:00");
    if(a && d < a) return false;
    if(b && d > b) return false;
    return true;
}
function isTransfer(tx){
    const k = String(tx?.kind||"").toLowerCase();
    const c = String(tx?.category||"").toLowerCase();
    const d = String(tx?.desc||tx?.description||"").toLowerCase();
    return k === "transfer" || c === "transferencia" || /(^|\s)(transf|transfer|athm)(\s|$)/.test(d);
}

/* ---------- Config ---------- */
function getCfg(){
    return readJSON(CFG_KEY, {
        months: 6, savePct: 10, rent:0, food:0, cell:0, dateStart:"", dateEnd:"", subs:[]
    });
}
function setCfg(cfg){ writeJSON(CFG_KEY, cfg); }
function renderSubs(){
    const cfg = getCfg();
    els.subsList.innerHTML = (cfg.subs||[]).map((s,i)=>`
    <span class="cat-chip" data-i="${i}" title="Quitar">
      ${s.name}<span class="x">×</span>
      <span class="money" style="margin-left:8px;">${fmt(s.amount)}</span>
    </span>`).join("");
    els.subsList.querySelectorAll(".cat-chip").forEach(tag=>{
        tag.addEventListener("click", ()=>{
            const i = Number(tag.getAttribute("data-i"));
            const c = getCfg(); c.subs.splice(i,1); setCfg(c); renderSubs(); recalc();
        });
    });
}
function loadInputs(){
    const c = getCfg();
    els.months.value = c.months ?? 6;
    els.savePct.value = c.savePct ?? 10;
    els.rent.value = c.rent ?? 0;
    els.food.value = c.food ?? 0;
    els.cell.value = c.cell ?? 0;
    els.dateStart.value = c.dateStart || "";
    els.dateEnd.value   = c.dateEnd   || "";
    renderSubs();
}
function currentInputs(){
    const months = Number(els.months.value||6);
    const savePct = Number(els.savePct.value||10);
    const rent = Number(els.rent.value||0);
    const food = Number(els.food.value||0);
    const cell = Number(els.cell.value||0);
    const dateStart = els.dateStart.value;
    const dateEnd   = els.dateEnd.value;
    const cfg = getCfg();
    return { months, savePct, rent, food, cell, dateStart, dateEnd, subs: cfg.subs||[] };
}

/* ---------- Cálculo ---------- */
function calc(){
    const { months, savePct, rent, food, cell, dateStart, dateEnd, subs } = currentInputs();
    const a = parseDate(dateStart), b = parseDate(dateEnd);
    const useGlobal = !a && !b;

    let incomeSem = 0;
    let expenseSem = 0;

    if (useGlobal){
        incomeSem  = Number(localStorage.getItem(TOTAL_KEYS.income)  || 0);
        expenseSem = Number(localStorage.getItem(TOTAL_KEYS.expense) || 0);
    } else {
        const incomes  = (readJSON(KEYS.incomes, [])  || []).filter(t => inRange(t,a,b) && !isTransfer(t));
        const expenses = (readJSON(KEYS.expenses, []) || []).filter(t => inRange(t,a,b) && !isTransfer(t));
        const sum = (list)=> list.reduce((acc,t)=> acc + (+t.amount||0), 0);
        incomeSem  = sum(incomes);
        expenseSem = sum(expenses);
    }

    const fixedMonthly = (rent||0)+(food||0)+(cell||0) + (subs||[]).reduce((x,s)=> x+(+s.amount||0), 0);
    const fixedSem     = fixedMonthly * (months||1);
    const savingsNow   = incomeSem * ((savePct||0)/100);
    const net          = incomeSem - expenseSem;
    const safeTotalBP  = Math.max(net - savingsNow - fixedSem, 0);
    const safePerMonth = months>0 ? safeTotalBP / months : safeTotalBP;

    return { months, savePct, incomeSem, expenseSem, fixedMonthly, fixedSem, savingsNow, safeTotalBP, safePerMonth, dateStart, dateEnd };
}

function paint(r){
    els.rIncome.textContent  = fmt(r.incomeSem);
    els.rFixedM.textContent  = fmt(r.fixedMonthly);
    els.rFixedS.textContent  = fmt(r.fixedSem);
    els.rSaveNow.textContent = fmt(r.savingsNow);
    els.rSafeTot.textContent = fmt(r.safeTotalBP);
    els.rSafeMon.textContent = fmt(r.safePerMonth);
}

/* ---------- Persistencia / Acciones ---------- */
function recalc(){
    const r = calc();
    paint(r);

    writeJSON(LAST_KEY, { savingsNow:r.savingsNow, safeTotal:r.safeTotalBP, safePerMonth:r.safePerMonth, updatedAt:Date.now() });

    const cfg = getCfg();
    cfg.months=r.months; cfg.savePct=r.savePct; cfg.rent=Number(els.rent.value||0);
    cfg.food=Number(els.food.value||0); cfg.cell=Number(els.cell.value||0);
    cfg.dateStart=r.dateStart; cfg.dateEnd=r.dateEnd;
    setCfg(cfg);
}

function saveConfig(){
    const r = currentInputs();
    setCfg(r);
    alert("Configuración de ahorros guardada ✅");
}

function applyToDashboard(){
    const last = readJSON(LAST_KEY, null);
    if(!last){ alert("Primero recalcula para obtener los montos."); return; }
    // Publica el ahorro aplicado para que Dashboard lo reste
    localStorage.setItem(KEYS.balSave, String(last.savingsNow));
    // (Opcional) publicar el "seguro para gastar" total
    localStorage.setItem(KEYS.balSafe, String(last.safeTotal));
    // Señal de actualización
    localStorage.setItem("pfm.lastUpdate", String(Date.now()));
    alert("Aplicado al Dashboard ✅");
}

function addSub(){
    const name = (els.subName.value||"").trim();
    const amount = Number(els.subAmt.value||0);
    if(!name || !amount){ alert("Completa nombre y monto mensual."); return; }
    const cfg = getCfg(); (cfg.subs ||= []).push({ name, amount }); setCfg(cfg);
    els.subName.value=""; els.subAmt.value="";
    renderSubs(); recalc();
}

/* ---------- Init ---------- */
function init(){
    const y = document.getElementById("year"); if(y) y.textContent = new Date().getFullYear();
    loadInputs(); recalc();
    els.recalc.addEventListener("click", recalc);
    els.saveCfg.addEventListener("click", saveConfig);
    els.apply.addEventListener("click", applyToDashboard);
    els.addSub.addEventListener("click", addSub);
}
if (document.readyState !== "loading") init();
else window.addEventListener("DOMContentLoaded", init);
