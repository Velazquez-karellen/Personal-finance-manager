import { KEYS, readJSON, money } from "./common.js";

/* ---------- Utilidades de fechas (ventana semestral Jan–Jul o Jul–Jan) ---------- */
const WINDOW_SIZE = 7; // 7 etiquetas (p.ej., Jul→Jan)
function getSemesterWindow(now = new Date()) {
    const y = now.getFullYear();
    const m = now.getMonth(); // 0..11
    const startMonth = m >= 6 ? 6 : 0; // 6 = Jul, 0 = Jan
    const startYear  = y;
    const labels = [];
    const months = []; // objetos {y, m}

    for (let i = 0; i < WINDOW_SIZE; i++) {
        const date = new Date(startYear, startMonth + i, 1);
        const label = date.toLocaleString("en-US", { month: "long", year: "numeric" });
        labels.push(label);
        months.push({ y: date.getFullYear(), m: date.getMonth() });
    }
    return { labels, months };
}

/* ----------  Lectura segura de claves ---------- */
const INCOME_KEY  = (typeof KEYS !== "undefined" && KEYS.incomes)  ? KEYS.incomes  : "pfm.incomes";
const EXPENSE_KEY = (typeof KEYS !== "undefined" && KEYS.expenses) ? KEYS.expenses : "pfm.expenses";
const SAVING_KEY  = (typeof KEYS !== "undefined" && KEYS.savings)  ? KEYS.savings  : "pfm.savings";
const ALLOC_KEY   = "pfm.allocMonths"; // meses para A (por defecto 6)

/* ---------- Helpers ---------- */
function sum(list, fn = x => x) {
    return (list || []).reduce((acc, item) => acc + Number(fn(item) || 0), 0);
}
function monthIndexOf(dateStr, monthsWindow) {
    if (!dateStr) return -1;
    const d = new Date(dateStr);
    const yy = d.getFullYear();
    const mm = d.getMonth();
    return monthsWindow.findIndex(({ y, m }) => y === yy && m === mm);
}

/* ---------- Cálculos base ---------- */
function getAllData() {
    const incomes  = readJSON(INCOME_KEY, []);
    const expenses = readJSON(EXPENSE_KEY, []);
    const savings  = readJSON(SAVING_KEY, []);
    return { incomes, expenses, savings };
}

function calcCards({ incomes, expenses, savings }) {
    const totalIncome  = sum(incomes,  t => t.amount);
    const totalExpense = sum(expenses, t => t.amount);
    const totalSaving  = sum(savings,  t => t.amount);

    const bank = totalIncome - totalExpense - totalSaving;
    const monthsForA = Math.max(1, Number(localStorage.getItem(ALLOC_KEY) || 6));
    const A = bank > 0 ? bank / monthsForA : 0;

    return { totalSaving, bank, A, monthsForA };
}

function calcMonthlySeries({ incomes, expenses, savings }, monthsWindow) {
    const incomeByMonth  = Array(WINDOW_SIZE).fill(0);
    const expenseByMonth = Array(WINDOW_SIZE).fill(0);
    const savingByMonth  = Array(WINDOW_SIZE).fill(0);

    (incomes || []).forEach(t => {
        const idx = monthIndexOf(t.date, monthsWindow);
        if (idx >= 0) incomeByMonth[idx] += Number(t.amount || 0);
    });
    (expenses || []).forEach(t => {
        const idx = monthIndexOf(t.date, monthsWindow);
        if (idx >= 0) expenseByMonth[idx] += Number(t.amount || 0);
    });
    (savings || []).forEach(t => {
        const idx = monthIndexOf(t.date, monthsWindow);
        if (idx >= 0) savingByMonth[idx] += Number(t.amount || 0);
    });

    return { incomeByMonth, expenseByMonth, savingByMonth };
}

/* ---------- Render de Cards ---------- */
function renderCards() {
    const els = {
        savings: document.getElementById("savingsAmount"),
        bank:    document.getElementById("safeToSpendAmount"),
        alloc:   document.getElementById("allocAmount"),
        btn:     document.getElementById("allocBtn"),
    };

    const data = getAllData();
    const { totalSaving, bank, A, monthsForA } = calcCards(data);

    if (els.savings) els.savings.textContent = money(totalSaving);
    if (els.bank)    els.bank.textContent    = money(bank);
    if (els.alloc)   els.alloc.textContent   = money(A);

    const explain = document.querySelector('[data-alloc-explain]');
    if (explain) explain.textContent = `A = Banco ÷ ${monthsForA} meses`;

    if (els.btn && !els.btn._bound) {
        els.btn._bound = true;
        els.btn.addEventListener("click", () => {
            const current = String(monthsForA);
            const next = prompt("¿Cuántos meses quieres usar para la asignación (A)?", current);
            if (next && Number(next) > 0) {
                localStorage.setItem(ALLOC_KEY, String(Math.floor(Number(next))));
                renderCards();
            }
        });
    }
}

/* ---------- Gráfica (Chart.js) ---------- */
let chart;
function renderChart() {
    const ctx = document.getElementById("igChart");
    if (!ctx) return;

    const { labels, months } = getSemesterWindow(new Date());
    const data = getAllData();
    const series = calcMonthlySeries(data, months);

    const cfg = {
        type: "line",
        data: {
            labels,
            datasets: [
                { label: "Ingresos", data: series.incomeByMonth, borderWidth: 2, tension: 0.25 },
                { label: "Gastos",   data: series.expenseByMonth, borderWidth: 2, tension: 0.25 },
                { label: "Ahorros",  data: series.savingByMonth,  borderWidth: 2, tension: 0.25 },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: "top" },
                tooltip: {
                    callbacks: {
                        label: (item) => `${item.dataset.label}: ${money(item.raw || 0)}`
                    }
                }
            },
            scales: {
                y: {
                    ticks: {
                        callback: (v) => `$${Number(v).toLocaleString()}`
                    }
                }
            }
        }
    };

    if (chart) {
        chart.data.labels = labels;
        chart.data.datasets[0].data = series.incomeByMonth;
        chart.data.datasets[1].data = series.expenseByMonth;
        chart.data.datasets[2].data = series.savingByMonth;
        chart.update();
    } else {
        chart = new Chart(ctx, cfg);
    }
}

/* ---------- Init y refrescos ---------- */
function init() {
    const y = document.getElementById("year");
    if (y) y.textContent = new Date().getFullYear();

    renderCards();
    renderChart();
}

window.addEventListener("storage", (e) => {
    if ([INCOME_KEY, EXPENSE_KEY, SAVING_KEY, ALLOC_KEY, "pfm.lastUpdate"].includes(e.key)) {
        renderCards();
        renderChart();
    }
});

window.addEventListener("DOMContentLoaded", init);
