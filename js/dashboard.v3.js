const TOTAL_KEYS = {
    income:  "pfm.total.income",
    expense: "pfm.total.expense",
};
const SAVINGS_KEY = "pfm.balance.savings";

/* ---------- Claves de listas para (solo) la serie azul por mes ---------- */
const LIST_KEYS = {
    incomes:  ["pfm.transactions.income", "pfm.incomes"],
    expenses: ["pfm.transactions.expense","pfm.expenses"],
};

const $ = id => document.getElementById(id);
const money = n => `$${Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const readJSON = (k, fb=[]) => { try{ const v=localStorage.getItem(k); return v?JSON.parse(v):fb; }catch{ return fb; } };

/* ---------- Ventana de 7 meses: Jul→Jan o Jan→Jul ---------- */
const WINDOW = 7;
function getWindow(now=new Date()){
    const y=now.getFullYear(), m=now.getMonth();
    const startM = (m>=6)?6:0; // Jul o Jan
    const labels=[], months=[];
    for(let i=0;i<WINDOW;i++){
        const d = new Date(y, startM+i, 1);
        labels.push(d.toLocaleString("en-US",{month:"long", year:"numeric"}));
        months.push({y:d.getFullYear(), m:d.getMonth()});
    }
    return {labels, months};
}
function monthIndexOf(dateStr, months){
    if(!dateStr) return -1;
    const d = new Date(dateStr); const yy=d.getFullYear(), mm=d.getMonth();
    return months.findIndex(x=>x.y===yy && x.m===mm);
}

/* ---------- Helpers listas ---------- */
function readFirstExisting(keys, fb=[]){
    for(const k of keys){ const val = readJSON(k, null); if(val!==null) return val; }
    return fb;
}

/* ---------- Tarjetas de arriba ---------- */
const ALLOC_KEY = "pfm.allocMonths";
function renderCards(){
    const coop = Number(localStorage.getItem(SAVINGS_KEY) || 0);
    const totalIncome  = Number(localStorage.getItem(TOTAL_KEYS.income)  || 0);
    const totalExpense = Number(localStorage.getItem(TOTAL_KEYS.expense) || 0);

    const bank = totalIncome - totalExpense - coop;
    const monthsForA = Math.max(1, Number(localStorage.getItem(ALLOC_KEY) || 6));
    const monthlyA = bank>0 ? bank/monthsForA : 0;

    const els = {
        savings: $("savingsAmount"),
        bank:    $("safeToSpendAmount"),
        monthly: $("monthlyAssignAmount"),
        explain: document.querySelector("[data-alloc-explain]"),
        cfgBtn:  $("configA"),
    };
    if(els.savings) els.savings.textContent = money(coop);
    if(els.bank)    els.bank.textContent    = money(bank);
    if(els.monthly) els.monthly.textContent = money(monthlyA);
    if(els.explain) els.explain.textContent = `A = Banco ÷ ${monthsForA} meses`;

    if(els.cfgBtn && !els.cfgBtn._bound){
        els.cfgBtn._bound = true;
        els.cfgBtn.addEventListener("click", ()=>{
            const cur = String(monthsForA);
            const next = prompt("¿Cuántos meses quieres usar para A?", cur);
            if(next && Number(next)>0){
                localStorage.setItem(ALLOC_KEY, String(Math.floor(Number(next))));
                renderCards();
            }
        });
    }
}

/* ---------- Serie del gráfico ---------- */
let chart;
function renderChart(){
    const canvas = $("igChart"); if(!canvas) return;
    const { labels, months } = getWindow(new Date());

    // Azul (ingresos) — por mes desde la lista de ingresos
    const incomes = readFirstExisting(LIST_KEYS.incomes, []);
    const inc = Array(WINDOW).fill(0);
    incomes
        .filter(t => (t?.kind || "").toLowerCase() !== "transfer")
        .forEach(t => {
            const idx = monthIndexOf(t.date, months);
            if(idx>=0) inc[idx] += Number(t.amount||0);
        });

    const totalExpense = Number(localStorage.getItem(TOTAL_KEYS.expense) || 0);
    const exp = Array(WINDOW).fill(totalExpense);

    const coop = Number(localStorage.getItem(SAVINGS_KEY) || 0);
    const sav  = Array(WINDOW).fill(coop);

    const cfg = {
        type: "line",
        data: {
            labels,
            datasets: [
                { label:"Ingresos", data:inc, borderWidth:2, tension:.25 },
                { label:"Gastos",   data:exp, borderWidth:2, tension:.25 },
                { label:"Ahorros",  data:sav, borderWidth:2, tension:.25 },
            ]
        },
        options:{
            responsive:true, maintainAspectRatio:false,
            plugins:{
                legend:{ position:"top" },
                tooltip:{ callbacks:{ label:(ctx)=>`${ctx.dataset.label}: ${money(ctx.parsed.y||0)}` } }
            },
            scales:{ y:{ ticks:{ callback:(v)=>`$${Number(v).toLocaleString()}` } } }
        }
    };

    if(chart){
        chart.data.labels = labels;
        chart.data.datasets[0].data = inc;
        chart.data.datasets[1].data = exp;
        chart.data.datasets[2].data = sav;
        chart.update();
    }else{
        const ctx = canvas.getContext("2d");
        chart = new Chart(ctx, cfg);
    }
}

/* ---------- Init + refresco ---------- */
function init(){
    const y=$("year"); if(y) y.textContent = new Date().getFullYear();
    renderCards();
    renderChart();
}

window.addEventListener("storage", (e)=>{
    if([TOTAL_KEYS.income, TOTAL_KEYS.expense, SAVINGS_KEY, ALLOC_KEY, "pfm.lastUpdate"].includes(e.key)){
        renderCards();
        renderChart();
    }
});

if(document.readyState!=="loading") init();
else window.addEventListener("DOMContentLoaded", init);
