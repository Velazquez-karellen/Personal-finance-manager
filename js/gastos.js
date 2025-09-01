/* ---------- storage & formato ---------- */
const KEYS = {
    expenses: "pfm.expenses",
    expenseCats: "pfm.expenseCats",
};
const PUB_KEYS = {
    totalExpense: "pfm.total.expense",
    lastUpdate: "pfm.lastUpdate",
    sortPref: "pfm.expense.sort",
};

const readJSON = (k, fb = []) => {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; }
    catch { return fb; }
};
const writeJSON = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const money = (n) =>
    `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const $ = (id) => document.getElementById(id);

/* ---------- util fecha para ordenar robusto ---------- */
function parseDateStr(s) {
    if (!s) return new Date(0);
    const t = String(s).trim();
    // yyyy-mm-dd
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return new Date(`${t}T00:00:00`);
    // mm/dd/yyyy
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(t)) {
        const [mm, dd, yy] = t.split("/");
        return new Date(`${yy}-${mm}-${dd}T00:00:00`);
    }
    const d = new Date(t);
    return isNaN(+d) ? new Date(0) : d;
}

/* ---------- categorías ---------- */
function ensureDefaults() {
    let cur;
    try { cur = JSON.parse(localStorage.getItem(KEYS.expenseCats)); } catch { cur = null; }
    if (!Array.isArray(cur) || cur.length === 0) {
        writeJSON(KEYS.expenseCats, ["Comida","Transporte","Suscripciones","Transferencia"]);
    }
}
function getCategories() {
    return [...new Set((readJSON(KEYS.expenseCats, []) || []).filter(Boolean))];
}
function upsertCategory(name) {
    const arr = getCategories();
    if (!arr.includes(name)) { arr.push(name); writeJSON(KEYS.expenseCats, arr); }
}
function removeCategory(name) {
    writeJSON(KEYS.expenseCats, getCategories().filter((x) => x !== name));
}

/* ---------- transacciones ---------- */
function allExpenses() { return readJSON(KEYS.expenses, []); }
function isTransfer(tx) {
    const kind = String(tx?.kind || "").toLowerCase();
    const cat = String(tx?.category || "").toLowerCase();
    const desc = String(tx?.desc || tx?.description || "").toLowerCase();
    return kind === "transfer" || cat === "transferencia" || /transf|transfer|athm/.test(desc);
}
function addExpense(tx) {
    const list = allExpenses();
    const markTransfer = String(tx.category || "").toLowerCase() === "transferencia" ? "transfer" : undefined;
    list.push({ date: tx.date, desc: tx.desc, amount: Number(tx.amount) || 0, category: tx.category, kind: markTransfer });
    writeJSON(KEYS.expenses, list);
    bumpUpdate();
}
function removeExpense(idx) {
    const list = allExpenses();
    if (idx >= 0 && idx < list.length) { list.splice(idx, 1); writeJSON(KEYS.expenses, list); }
    bumpUpdate();
}
function bumpUpdate() { localStorage.setItem(PUB_KEYS.lastUpdate, String(Date.now())); }

/* ---------- render ---------- */
function renderYear() { const y = $("year"); if (y) y.textContent = new Date().getFullYear(); }

function renderCategories() {
    const cats = getCategories();
    $("category").innerHTML =
        '<option value="">— Selecciona —</option>' + cats.map((c) => `<option value="${c}">${c}</option>`).join("");
    $("catList").innerHTML = cats
        .map((c) => `<span class="cat-chip" data-cat="${c}" title="Click para borrar">${c}<span class="x">×</span></span>`)
        .join("");
    $("catList").querySelectorAll(".cat-chip").forEach((chip) => {
        chip.addEventListener("click", () => {
            const name = chip.getAttribute("data-cat");
            if (confirm(`¿Eliminar la categoría "${name}"? (No afecta transacciones existentes)`)) {
                removeCategory(name); renderCategories();
            }
        });
    });
}

/* ---------- preferencia de orden (default: desc) ---------- */
function getSortOrder() { return localStorage.getItem(PUB_KEYS.sortPref) || "desc"; }
function setSortOrder(v) { localStorage.setItem(PUB_KEYS.sortPref, v === "asc" ? "asc" : "desc"); }

function renderRows() {
    const order = getSortOrder();
    const list = allExpenses().slice().sort((a, b) => {
        const da = +parseDateStr(a.date); const db = +parseDateStr(b.date);
        return order === "asc" ? da - db : db - da;
    });

    $("rows").innerHTML = list.map((t, i) => {
        const tr = isTransfer(t);
        const tag = tr ? `<span class="badge" style="opacity:.75;margin-left:6px;">Transf</span>` : "";
        return `
      <tr>
        <td>${t.date || ""}</td>
        <td>${t.desc || ""}</td>
        <td><span class="badge">${t.category || ""}</span>${tag}</td>
        <td class="money">${money(t.amount)}</td>
        <td class="row-actions"><button class="btn btn-danger" data-del="${i}">Borrar</button></td>
      </tr>`;
    }).join("");

    $("rows").querySelectorAll("[data-del]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            const idx = Number(e.currentTarget.getAttribute("data-del"));
            // ojo: índice es contra la lista ordenada; recalculamos contra el arreglo real
            const real = allExpenses();
            const ordered = real.slice().sort((a, b) => (getSortOrder()==="asc" ? +parseDateStr(a.date)-+parseDateStr(b.date) : +parseDateStr(b.date)-+parseDateStr(a.date)));
            const toDelete = ordered[idx];
            const realIndex = real.findIndex(r => r === toDelete);
            removeExpense(realIndex);
            renderRows(); renderTotal();
        });
    });

    const btn = $("sortBtn");
    if (btn) btn.textContent = order === "desc" ? "Fecha ↓ reciente" : "Fecha ↑ antiguo";
}

function renderTotal() {
    const total = allExpenses().reduce((acc, t) => (isTransfer(t) ? acc : acc + (Number(t.amount) || 0)), 0);
    const el = $("expenseTotal"); if (el) el.textContent = money(total);
    localStorage.setItem(PUB_KEYS.totalExpense, String(total));
    bumpUpdate(); // refrescar dashboard/otras pestañas
}

/* ---------- acciones ---------- */
function addExpenseClick() {
    const date = $("date").value;
    const desc = ($("desc").value || "").trim();
    const amount = Number($("amount").value);
    const category = $("category").value;
    if (!date || !desc || !category || !amount || amount <= 0) {
        alert("Completa fecha, descripción, categoría y una cantidad > 0."); return;
    }
    addExpense({ date, desc, amount, category });
    $("desc").value = ""; $("amount").value = "";
    renderRows(); renderTotal();
}
function addCategoryClick() {
    const name = ($("newCat").value || "").trim();
    if (!name) return;
    upsertCategory(name);
    $("newCat").value = ""; renderCategories();
}
function toggleSort() {
    const now = getSortOrder();
    setSortOrder(now === "desc" ? "asc" : "desc");
    renderRows();
}

/* ---------- init ---------- */
function init() {
    renderYear(); ensureDefaults(); renderCategories(); renderRows(); renderTotal();
    $("addBtn").addEventListener("click", addExpenseClick);
    $("addCatBtn").addEventListener("click", addCategoryClick);
    const sortBtn = $("sortBtn"); if (sortBtn) sortBtn.addEventListener("click", toggleSort);
}
if (document.readyState !== "loading") init();
else window.addEventListener("DOMContentLoaded", init);
