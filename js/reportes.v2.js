(function () {
    /* ---------- Claves ---------- */
    const K = {
        incomesNew:  "pfm.incomes",
        expensesNew: "pfm.expenses",
        incomesOld:  "pfm.transactions.income",
        expensesOld: "pfm.transactions.expense",
        balSave:     "pfm.balance.savings",
        last:        "pfm.ahorros.lastComputed",
        cfg:         "pfm.ahorros.config",
    };
    const TOTAL = { income: "pfm.total.income", expense: "pfm.total.expense" };

    /* ---------- Utils ---------- */
    const $ = (id) => document.getElementById(id);
    const fmt = (n) => `$${Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;
    const readJSON = (k, fb)=>{ try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } };
    const parseDate = (s)=> s ? new Date(`${s}T00:00:00`) : null;
    const inRange = (tx, a, b)=>{
        const d = tx?.date ? new Date(`${tx.date}T00:00:00`) : null;
        if (a && d && d < a) return false;
        if (b && d && d > b) return false;
        return true;
    };
    const isTransfer = (tx)=>{
        const k = String(tx?.kind||"").toLowerCase();
        const c = String(tx?.category||"").toLowerCase();
        const d = String(tx?.desc||tx?.description||"").toLowerCase();
        return k==="transfer" || c==="transferencia" || /(^|\s)(transf|transfer|athm)(\s|$)/.test(d);
    };

    // Une “Food/Comida”, “Transporte/Transport”, etc.
    function normCat(raw, kind){
        const s = String(raw||"").trim().toLowerCase();
        const map = {
            "comida":"Comida","food":"Comida",
            "transporte":"Transporte","transport":"Transporte","gasolina":"Transporte","gas":"Transporte",
            "suscripciones":"Suscripciones","subscriptions":"Suscripciones","subscription":"Suscripciones",
            "cargos":"Cargos","fee":"Cargos","fees":"Cargos","cargo":"Cargos",
            "nómina":"Nómina","nomina":"Nómina","payroll":"Nómina","salary":"Nómina",
            "transferencia":"Transferencia","transfer":"Transferencia",
            "reembolso":"Reembolso","refund":"Reembolso",
            "ingreso":"Ingreso","gasto":"Gasto"
        };
        if (map[s]) return map[s];

        // heurística por descripción si no hay categoría
        if (!s) {
            if (kind==="income")  return "Ingreso";
            if (kind==="expense") return "Gasto";
        }
        // Capitaliza por defecto
        return raw ? raw.charAt(0).toUpperCase()+raw.slice(1) : (kind==="income"?"Ingreso":"Gasto");
    }

    function getMergedIncomes(){  // merge claves nuevas + viejas
        return []
            .concat(readJSON(K.incomesNew, []), readJSON(K.incomesOld, []))
            .filter(Boolean);
    }
    function getMergedExpenses(){
        return []
            .concat(readJSON(K.expensesNew, []), readJSON(K.expensesOld, []))
            .filter(Boolean);
    }

    /* ---------- Cálculo ---------- */
    function calcTotals(){
        const a = parseDate($("fromDate")?.value);
        const b = parseDate($("toDate")?.value);
        const useGlobal = !a && !b;

        let incomes  = getMergedIncomes();
        let expenses = getMergedExpenses();

        if (useGlobal){
            // KPIs desde totales publicados (lo que ves en las tarjetas de Ingresos/Gastos)
            var totalIncome  = Number(localStorage.getItem(TOTAL.income)  || 0);
            var totalExpense = Number(localStorage.getItem(TOTAL.expense) || 0);
            // Para tablas: usa todo el histórico
            incomes  = incomes.filter(t => !isTransfer(t));
            expenses = expenses.filter(t => !isTransfer(t));
        } else {
            // Filtra por rango
            incomes  = incomes.filter(t => inRange(t,a,b) && !isTransfer(t));
            expenses = expenses.filter(t => inRange(t,a,b) && !isTransfer(t));
            var totalIncome  = incomes.reduce((s,t)=> s + (+t.amount || 0), 0);
            var totalExpense = expenses.reduce((s,t)=> s + (+t.amount || 0), 0);
        }

        // Agrupar por categoría normalizada
        const incomeByCat  = {};
        const expenseByCat = {};
        incomes.forEach(t => {
            const c = normCat(t.category, "income");
            incomeByCat[c]  = (incomeByCat[c]  || 0) + (+t.amount || 0);
        });
        expenses.forEach(t => {
            const c = normCat(t.category, "expense");
            expenseByCat[c] = (expenseByCat[c] || 0) + (+t.amount || 0);
        });

        // Ahorro: aplicado (si existe) o estimado por % del config
        const applied = Number(localStorage.getItem(K.balSave) || 0);
        const last = readJSON(K.last, null);
        const cfg  = readJSON(K.cfg,  null);
        let savings = applied || (last?.savingsNow || 0);
        if (!savings && cfg?.savePct) savings = totalIncome * (cfg.savePct/100);

        const net = totalIncome - totalExpense;

        return { incomes, expenses, incomeByCat, expenseByCat, totalIncome, totalExpense, net, savings };
    }

    /* ---------- Render ---------- */
    function renderPreview(){
        const d = calcTotals();

        // KPIs
        const cards = [
            {label:"Total ingresos",             val:d.totalIncome},
            {label:"Total gastos",               val:d.totalExpense},
            {label:"Ahorro (aplicado/estimado)", val:d.savings},
            {label:"Balance neto",               val:d.net},
        ];
        const cwrap = $("cards"); cwrap.innerHTML = "";
        cards.forEach(k=>{
            const el = document.createElement("div");
            el.className = "kpi";
            el.innerHTML = `<div class="label">${k.label}</div><div class="value">${fmt(k.val)}</div>`;
            cwrap.appendChild(el);
        });

        // Tablas por categoría
        function fillCat(tbodyId, obj){
            const tb = $(tbodyId);
            const keys = Object.keys(obj).sort((a,b)=> obj[b]-obj[a]);
            tb.innerHTML = keys.length
                ? keys.map(k=> `<tr><td>${k}</td><td class="money">${fmt(obj[k])}</td></tr>`).join("")
                : `<tr><td>(Sin datos)</td><td class="money">$0.00</td></tr>`;
        }
        fillCat("tIncome",  d.incomeByCat);
        fillCat("tExpense", d.expenseByCat);

        // Detalle (si existen contenedores)
        function fillDetail(tbodyId, arr){
            const tb = $(tbodyId);
            if (!tb) return;
            if (!arr.length) {
                tb.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#9aa3b2">(Sin datos)</td></tr>`;
                return;
            }
            tb.innerHTML = arr
                .sort((a,b)=> (a.date||"").localeCompare(b.date||"")) // de más viejo a más nuevo
                .map(t=> `<tr>
          <td>${t.date||""}</td>
          <td>${t.desc||t.description||""}</td>
          <td>${normCat(t.category, t.kind||"")}</td>
          <td class="money">${fmt(+t.amount||0)}</td>
        </tr>`).join("");
        }
        fillDetail("tIncomeDet",  d.incomes);
        fillDetail("tExpenseDet", d.expenses);

        // Encabezado de impresión
        const title = $("title")?.value || "Reporte financiero";
        const from  = $("fromDate")?.value || "—";
        const to    = $("toDate")?.value   || "—";
        const phTitle = $("ph-title"), phRange = $("ph-range");
        if (phTitle) phTitle.textContent = title;
        if (phRange) phRange.textContent = `Rango: ${from} a ${to}`;
    }

    /* ---------- Init & eventos ---------- */
    function init(){
        const y  = $("year");      if (y)  y.textContent  = new Date().getFullYear();
        const yp = $("yearPrint"); if (yp) yp.textContent = new Date().getFullYear();

        renderPreview();

        $("preview")?.addEventListener("click", renderPreview);
        ["fromDate","toDate","title"].forEach(id=>{
            $(id)?.addEventListener("change", renderPreview);
            $(id)?.addEventListener("input",  renderPreview);
        });

        // Si cambian datos en otras páginas
        window.addEventListener("storage", (e)=>{
            const watched = [
                K.incomesNew, K.expensesNew, K.incomesOld, K.expensesOld,
                K.balSave, TOTAL.income, TOTAL.expense, "pfm.lastUpdate"
            ];
            if (watched.includes(e.key)) renderPreview();
        });
    }

    if (document.readyState !== "loading") init();
    else window.addEventListener("DOMContentLoaded", init);
})();
