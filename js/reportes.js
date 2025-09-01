/* ---------- Claves ---------- */
const KEYS = {
    incomes:  "pfm.transactions.income",
    expenses: "pfm.transactions.expense",
    balSave:  "pfm.balance.savings",
    last:     "pfm.ahorros.lastComputed",
    cfg:      "pfm.ahorros.config",
};
const TOTAL_KEYS = { income: "pfm.total.income", expense: "pfm.total.expense" };

/* ---------- Utils ---------- */
const $   = (id) => document.getElementById(id);
const fmt = (n) => (Number(n)||0).toLocaleString("es-PR",{style:"currency",currency:"USD"});
function readJSON(k, fb){ try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } }
function parseDate(s){ return s ? new Date(s+"T00:00:00") : null; }
function inRange(tx, a, b){
    const d = tx?.date ? new Date(tx.date+"T00:00:00") : null;
    if (a && d && d < a) return false;
    if (b && d && d > b) return false;
    return true;
}
function isTransfer(tx){
    const k = String(tx?.kind||"").toLowerCase();
    const c = String(tx?.category||"").toLowerCase();
    const d = String(tx?.desc||tx?.description||"").toLowerCase();
    return k === "transfer" || c === "transferencia" || /(^|\s)(transf|transfer|athm)(\s|$)/.test(d);
}

/* ---------- Cálculo base ---------- */
function calcTotals(){
    const a = parseDate($("fromDate")?.value);
    const b = parseDate($("toDate")?.value);
    const useGlobal = !a && !b;

    let incomes = [];
    let expenses = [];
    let totalIncome = 0;
    let totalExpense = 0;

    if (useGlobal){
        // KPIs desde las tarjetas de Ingresos/Gastos
        totalIncome  = Number(localStorage.getItem(TOTAL_KEYS.income)  || 0);
        totalExpense = Number(localStorage.getItem(TOTAL_KEYS.expense) || 0);
        // Para tablas: mostramos el desglose de TODO lo que exista (sin transfers)
        incomes  = (readJSON(KEYS.incomes, [])  || []).filter(t => !isTransfer(t));
        expenses = (readJSON(KEYS.expenses, []) || []).filter(t => !isTransfer(t));
    } else {
        // Rango aplicado
        incomes  = (readJSON(KEYS.incomes, [])  || []).filter(t => inRange(t,a,b) && !isTransfer(t));
        expenses = (readJSON(KEYS.expenses, []) || []).filter(t => inRange(t,a,b) && !isTransfer(t));
        totalIncome  = incomes.reduce((s,t)=> s + (+t.amount || 0), 0);
        totalExpense = expenses.reduce((s,t)=> s + (+t.amount || 0), 0);
    }

    // Tablas
    const incomeByCat  = {};
    const expenseByCat = {};
    incomes.forEach(t => { const c = t.category || "Sin categoría"; incomeByCat[c]  = (incomeByCat[c]  || 0) + (+t.amount || 0); });
    expenses.forEach(t => { const c = t.category || "Sin categoría"; expenseByCat[c] = (expenseByCat[c] || 0) + (+t.amount || 0); });

    const net = totalIncome - totalExpense;

    // Ahorro mostrado
    const last = readJSON(KEYS.last, null);
    const applied = Number(localStorage.getItem(KEYS.balSave) || 0);
    const cfg = readJSON(KEYS.cfg, null);
    let savings = applied || (last?.savingsNow || 0);
    if (!savings && cfg?.savePct) savings = totalIncome * (cfg.savePct/100);

    return { incomeByCat, expenseByCat, totalIncome, totalExpense, net, savings };
}

/* ---------- Render en pantalla ---------- */
function renderPreview(){
    const d = calcTotals();

    // KPIs
    const cards = [
        {label:"Total ingresos",               val:d.totalIncome},
        {label:"Total gastos",                 val:d.totalExpense},
        {label:"Ahorro (aplicado/estimado)",   val:d.savings},
        {label:"Balance neto",                 val:d.net}
    ];
    const cwrap = $("cards"); cwrap.innerHTML = "";
    cards.forEach(k=>{
        const el = document.createElement("div");
        el.className = "kpi";
        el.innerHTML = `<div class="label">${k.label}</div><div class="value">${fmt(k.val)}</div>`;
        cwrap.appendChild(el);
    });

    // Tablas
    function fill(tbodyId, obj){
        const tb = $(tbodyId);
        const keys = Object.keys(obj).sort((a,b)=> obj[b]-obj[a]);
        tb.innerHTML = keys.length
            ? keys.map(k=> `<tr><td>${k}</td><td class="money">${fmt(obj[k])}</td></tr>`).join("")
            : `<tr><td>(Sin datos)</td><td class="money">$0.00</td></tr>`;
    }
    fill("tIncome", d.incomeByCat);
    fill("tExpense", d.expenseByCat);

    // Encabezado de impresión
    const title = $("title")?.value || "Reporte financiero";
    const from  = $("fromDate")?.value || "—";
    const to    = $("toDate")?.value || "—";
    const phTitle = $("ph-title"), phRange = $("ph-range");
    if (phTitle) phTitle.textContent = title;
    if (phRange) phRange.textContent = "Rango: " + from + " a " + to;
}

/* ---------- Eventos ---------- */
window.addEventListener("DOMContentLoaded", () => {
    const y = document.getElementById("year"); if (y) y.textContent = new Date().getFullYear();
    const yp = document.getElementById("yearPrint"); if (yp) yp.textContent = new Date().getFullYear();

    renderPreview();                    // arranque
    $("preview")?.addEventListener("click", renderPreview);
});
