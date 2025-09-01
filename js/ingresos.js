const KEYS = {
    incomes:     "pfm.transactions.income",
    expenses:    "pfm.transactions.expense",
    incomeCats:  "pfm.categories.income"
};
const PUB_TOTAL_KEY = "pfm.total.income";

const $ = (id)=>document.getElementById(id);
const money = n => (Number(n)||0).toLocaleString("es-PR",{style:"currency",currency:"USD"});
const readJSON = (k, fb)=>{ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):fb; }catch{ return fb; } };
const writeJSON = (k,v)=> localStorage.setItem(k, JSON.stringify(v));

/* ---------- helpers categorías ---------- */
function getCategories(){
    return readJSON(KEYS.incomeCats, []);
}
function upsertCategory(name){
    const arr = getCategories();
    if(!arr.includes(name)) { arr.push(name); writeJSON(KEYS.incomeCats, arr); }
}
function removeCategory(name){
    const arr = getCategories().filter(c=>c!==name);
    writeJSON(KEYS.incomeCats, arr);
}

/* ---------- helpers transacciones ---------- */
function addTransaction(tx){
    const arr = readJSON(KEYS.incomes, []);
    arr.push(tx);
    writeJSON(KEYS.incomes, arr);
}
function removeTransaction(idx){
    const arr = readJSON(KEYS.incomes, []);
    if(idx>=0 && idx<arr.length){ arr.splice(idx,1); writeJSON(KEYS.incomes, arr); }
}

/* ---------- DOM refs ---------- */
const els = {
    date:     $("date"),
    desc:     $("desc"),
    amount:   $("amount"),
    category: $("category"),
    addBtn:   $("addBtn"),
    newCat:   $("newCat"),
    addCatBtn:$("addCatBtn"),
    catList:  $("catList"),
    rows:     $("rows"),
    total:    $("incomeTotal"),
};

/* ---------- render ---------- */
function renderYear(){ const y=$("year"); if(y) y.textContent=new Date().getFullYear(); }

function ensureDefaults(){
    if(!localStorage.getItem(KEYS.incomeCats)){
        writeJSON(KEYS.incomeCats, ["Nómina","Transferencia","Reembolso","work"]);
    }
}

function renderCategories(){
    const cats = getCategories();
    if(els.category){
        els.category.innerHTML = '<option value="">— Selecciona —</option>' +
            cats.map(c=>`<option value="${c}">${c}</option>`).join("");
    }
    if(els.catList){
        els.catList.innerHTML = cats.map(c =>
            `<span class="cat-chip" data-cat="${c}" title="Click para borrar">${c}<span class="x">×</span></span>`
        ).join("");
        els.catList.querySelectorAll(".cat-chip").forEach(chip=>{
            chip.addEventListener("click", ()=>{
                const name = chip.getAttribute("data-cat");
                if(confirm(`¿Eliminar la categoría "${name}"?`)){
                    removeCategory(name);
                    renderCategories();
                }
            });
        });
    }
}

function renderRows(){
    const list = readJSON(KEYS.incomes, []);
    els.rows.innerHTML = list.map((t,i)=>`
    <tr>
      <td>${t.date||""}</td>
      <td>${t.desc||""}</td>
      <td><span class="badge">${t.category||""}</span></td>
      <td class="money">${money(t.amount)}</td>
      <td class="row-actions"><button class="btn btn-danger" data-del="${i}">Borrar</button></td>
    </tr>`).join("");

    els.rows.querySelectorAll("[data-del]").forEach(btn=>{
        btn.addEventListener("click", (e)=>{
            const idx = +e.currentTarget.getAttribute("data-del");
            removeTransaction(idx);
            renderRows();
            renderTotal();
        });
    });
}

function renderTotal(){
    const list = readJSON(KEYS.incomes, []).filter(t => (t?.kind||"").toLowerCase()!=="transfer");
    const total = list.reduce((s,t)=> s+(+t.amount||0), 0);
    if(els.total) els.total.textContent = money(total);
    localStorage.setItem(PUB_TOTAL_KEY, String(total));
    localStorage.setItem("pfm.lastUpdate", String(Date.now())); // notifica a otras páginas
}

/* ---------- acciones ---------- */
function addIncome(){
    const date = els.date.value;
    const desc = (els.desc.value||"").trim();
    const amount = Number(els.amount.value);
    const category = els.category.value;

    if(!date || !desc || !category || !amount || amount<=0){
        alert("Completa fecha, descripción, categoría y una cantidad > 0.");
        return;
    }
    addTransaction({ date, desc, amount, category });
    els.desc.value=""; els.amount.value="";
    renderRows();
    renderTotal();
}

function addCategory(){
    const name = (els.newCat.value||"").trim();
    if(!name) return;
    upsertCategory(name);
    els.newCat.value="";
    renderCategories();
    els.newCat.focus();
}

/* ---------- init robusto ---------- */
function init(){
    // fecha por defecto hoy
    if(els.date && !els.date.value){
        els.date.value = new Date().toISOString().slice(0,10);
    }
    renderYear();
    ensureDefaults();
    renderCategories();
    renderRows();
    renderTotal();

    els.addBtn    && els.addBtn.addEventListener("click", addIncome);
    els.addCatBtn && els.addCatBtn.addEventListener("click", addCategory);
    els.newCat    && els.newCat.addEventListener("keydown",(e)=>{ if(e.key==="Enter"){ e.preventDefault(); addCategory(); }});
}

// corre aunque el módulo se cargue después del DOM
if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
