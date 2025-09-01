/* ---------- almacenamiento ---------- */
const KEYS = {
    incomes:   "pfm.incomes",
    expenses:  "pfm.expenses",
    transfers: "pfm.transfers",
    draft:     "pfm.import.draft"
};

const readJSON = (k, fb = []) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } };
const writeJSON = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const getDraft = () => readJSON(KEYS.draft, []);
const setDraft = (v) => writeJSON(KEYS.draft, v);

/* ---------- helpers de transacción ---------- */
function addIncome(tx){
    const list = readJSON(KEYS.incomes, []);
    list.push({ date: tx.date, desc: tx.desc, amount: Number(tx.amount)||0, category: tx.category||"" });
    writeJSON(KEYS.incomes, list);
}
function addExpense(tx){
    const list = readJSON(KEYS.expenses, []);
    // si viene con kind:'transfer', lo preservamos para NO sumarlo en gastos
    list.push({
        date: tx.date,
        desc: tx.desc,
        amount: Number(tx.amount)||0,
        category: tx.category || (tx.kind === "transfer" ? "Transferencia" : ""),
        kind: tx.kind === "transfer" ? "transfer" : undefined
    });
    writeJSON(KEYS.expenses, list);
}
function addTransferLog(tx){
    const list = readJSON(KEYS.transfers, []);
    list.push({ date: tx.date, desc: tx.desc, amount: Number(tx.amount)||0, category: tx.category || "Transferencia" });
    writeJSON(KEYS.transfers, list);
}
function bumpSignal(){ localStorage.setItem("pfm.lastUpdate", String(Date.now())); }

/* ---------- heurística de categoría ---------- */
function guessCategory(kind, desc = ""){
    const d = desc.toLowerCase();
    if (kind === "transfer") return "Transferencia";
    if (kind === "income"){
        if (d.includes("nómina") || d.includes("nomina") || d.includes("payroll")) return "Nómina";
        if (d.includes("refund") || d.includes("reembolso")) return "Reembolso";
        if (d.includes("transfer")) return "Transferencia";
        return "Ingreso";
    } else {
        if (d.includes("super") || d.includes("grocery") || d.includes("market")) return "Comida";
        if (d.includes("uber") || d.includes("lyft") || d.includes("gasolina") || d.includes("gas")) return "Transporte";
        if (d.includes("netflix") || d.includes("spotify") || d.includes("icloud")) return "Suscripciones";
        if (d.includes("fee") || d.includes("cargo")) return "Cargos";
        return "Gasto";
    }
}

/* ---------- DOM ---------- */
const els = {
    file:           document.getElementById("file"),
    parseBtn:       document.getElementById("parseBtn"),
    draftRows:      document.getElementById("draftRows"),
    acceptAll:      document.getElementById("acceptAll"),
    clearDraft:     document.getElementById("clearDraft"),
    deleteSelected: document.getElementById("deleteSelected")
};
const dbg = {
    info:      document.getElementById("dbgInfo"),
    text:      document.getElementById("dbgText"),
    download:  document.getElementById("downloadTxt")
};
function renderYear(){ const y=document.getElementById("year"); if(y) y.textContent=new Date().getFullYear(); }

/* ---------- render borrador ---------- */
function renderDraft(){
    const list = getDraft();
    els.draftRows.innerHTML = list.map((t,i) => {
        const esc = s => String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;");
        const opts = `
      <option value="expense"${t.kind==="expense"?" selected":""}>Gasto</option>
      <option value="income"${t.kind==="income"?" selected":""}>Ingreso</option>
      <option value="transfer"${t.kind==="transfer"?" selected":""}>Transferencia</option>`;
        return `
      <tr data-i="${i}">
        <td style="width:36px;"><input type="checkbox" class="sel" /></td>
        <td><input class="input" value="${esc(t.date||"")}" /></td>
        <td><input class="input" value="${esc(t.desc||"")}" /></td>
        <td><select class="select kindSel">${opts}</select></td>
        <td><input class="input" value="${esc(t.category || (t.kind==="transfer"?"Transferencia":""))}" /></td>
        <td><input class="input" value="${esc(t.amount)}" /></td>
        <td class="row-actions"><button class="btn btn-danger" data-del="${i}">🗑️</button></td>
      </tr>`;
    }).join("");

    // listeners por fila
    els.draftRows.querySelectorAll("tr").forEach(tr=>{
        const idx = +tr.getAttribute("data-i");
        const update = ()=>{
            const tds = tr.querySelectorAll("td");
            const date = tds[1].querySelector("input").value.trim();
            const desc = tds[2].querySelector("input").value.trim();
            const kind = tds[3].querySelector("select").value;
            const catIn= tds[4].querySelector("input").value.trim();
            const category = catIn || guessCategory(kind, desc);
            const amount = tds[5].querySelector("input").value.trim();
            const d = getDraft();
            d[idx] = { date, desc, kind, category, amount };
            setDraft(d);
            if(kind==="transfer" && !catIn) tds[4].querySelector("input").value = "Transferencia";
        };
        tr.querySelectorAll("input,select").forEach(inp=>inp.addEventListener("change", update));
        const del = tr.querySelector("[data-del]");
        if(del) del.addEventListener("click", ()=>{
            const d = getDraft(); d.splice(idx,1); setDraft(d); renderDraft();
        });
    });
}

/* ---------- lectura PDF (pdf.js + OCR fallback) ---------- */
async function readPdfTextViaPdfjs(file){
    const buf = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: buf, useSystemFonts:true, isEvalSupported:false }).promise;
    let text = "";
    for(let p=1;p<=pdf.numPages;p++){
        const page = await pdf.getPage(p);
        const content = await page.getTextContent({ normalizeWhitespace:true, disableCombineTextItems:false });
        text += "\n" + content.items.map(i=>i.str).join(" ");
    }
    return text;
}
async function readPdfTextViaOCR(file){
    const buf = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
    let full = "";
    for(let p=1;p<=pdf.numPages;p++){
        const page = await pdf.getPage(p);
        const viewport = page.getViewport({ scale:2 });
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = viewport.width; canvas.height = viewport.height;
        await page.render({ canvasContext: ctx, viewport }).promise;
        const dataURL = canvas.toDataURL("image/png");
        const { data:{ text } } = await Tesseract.recognize(dataURL, "spa+eng");
        full += "\n" + text;
    }
    return full;
}

/* ---------- parseo (Popular) ---------- */
function normalize(raw){
    let t = raw.replace(/\s+/g," ");
    t = t.replace(/[–—]/g,"-");
    t = t.replace(/(\d{2}[-\/]\d{2})(?=\s)/g, "\n$1");
    t = t.replace(/(\d{4}-\d{2}-\d{2})(?=\s)/g, "\n$1");
    return t;
}
const DATE_START = /(^|\s)(\d{4}-\d{2}-\d{2}|\d{2}[-\/]\d{2})(?=\s)/i;
const MONEY = /-?\(?\d{1,3}(?:\.\d{3}|,\d{3})*(?:[.,]\d{2})\)?-?/;

function sliceSection(txt, fromLabel, toLabel){
    const T = txt.toUpperCase();
    const i = T.indexOf(fromLabel);
    if(i<0) return "";
    const j = toLabel ? T.indexOf(toLabel, i+fromLabel.length) : -1;
    return j>i ? txt.slice(i,j) : txt.slice(i);
}
function parseAmount(s){
    const str = String(s||"").trim();
    const paren = /\(([^)]+)\)/.exec(str);
    if (paren) return -parseAmount(paren[1]);
    const negEnd = /-$/.test(str);
    let num = str.replace(/[^\d.,-]/g,"");
    if(/,/.test(num) && /\./.test(num)) num = num.replace(/\./g,"").replace(/,/g,".");
    else num = num.replace(/,/g,"");
    let n = Number(num);
    if(negEnd) n = -n;
    return isNaN(n) ? 0 : n;
}
function collectRowsFromSection(sectionText, defKind){
    const lines = sectionText.split(/\n/).map(s=>s.trim()).filter(Boolean);
    const rows = [];
    for(let i=0;i<lines.length;i++){
        const L = lines[i];
        const dm = L.match(DATE_START);
        if(!dm) continue;

        const baseDesc = L.replace(DATE_START,"").trim();
        const next = lines[i+1] || "";

        const amtHere = L.match(MONEY), amtNext = next.match(MONEY);
        let amountStr, desc = baseDesc;
        if (amtHere && (!amtNext || amtHere.index < amtNext.index)){
            amountStr = amtHere[0];
            desc = L.replace(MONEY,"").replace(DATE_START,"").trim();
        } else if (amtNext){
            amountStr = amtNext[0];
            desc += " " + next.replace(MONEY,"").trim();
            i++;
        } else continue;

        const amount = Math.abs(parseAmount(amountStr));
        if(!amount) continue;

        let date = (dm[2]||"").replace(/\//g,"-");
        if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){
            const y = new Date().getFullYear();
            if(/^\d{2}-\d{2}$/.test(date)){ const [mm,dd] = date.split("-"); date = `${y}-${mm}-${dd}`; }
        }

        let kind = defKind;               // por sección
        if (/\btran(f|s)\b|\btransfer\b|\bathm\b/i.test(desc)) kind = "transfer";

        const category = guessCategory(kind, desc);
        rows.push({ date, desc, amount: amount.toFixed(2), kind, category });
    }
    return rows;
}
function parseBankPopular(raw){
    const txt = normalize(raw);
    const draft = [];
    const cred = sliceSection(txt, "CRÉDITOS REGULARES Y ELECTRÓNICOS", "DÉBITOS REGULARES Y ELECTRÓNICOS");
    const deb  = sliceSection(txt, "DÉBITOS REGULARES Y ELECTRÓNICOS", "CARGOS");
    const carg = sliceSection(txt, "CARGOS", "BALANCE");
    if (cred) draft.push(...collectRowsFromSection(cred, "income"));
    if (deb)  draft.push(...collectRowsFromSection(deb,  "expense"));
    if (carg) draft.push(...collectRowsFromSection(carg, "expense"));
    if (!draft.length) draft.push(...collectRowsFromSection(txt, "expense"));
    return draft;
}

/* ---------- debug y acciones ---------- */
function updateDebug(text){
    if (dbg.text) dbg.text.value = text.slice(0,8000);
    if (dbg.info) dbg.info.textContent = `Extraído: ${text.length} caracteres`;
    if (dbg.download){
        dbg.download.onclick = ()=>{
            const blob = new Blob([text], { type:"text/plain" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a"); a.href=url; a.download="statement.txt"; a.click();
            URL.revokeObjectURL(url);
        };
    }
}

function acceptAll(){
    const list = getDraft();
    if(!list.length) return alert("No hay items en el draft.");
    let iN=0, eN=0, tN=0;
    for(const t of list){
        const tx = { date: t.date, desc: t.desc, amount: Number(t.amount)||0, category: t.category };
        if (t.kind === "income"){ addIncome(tx); iN++; }
        else if (t.kind === "expense"){ addExpense(tx); eN++; }
        else {
            addExpense({ ...tx, kind:"transfer" });
            addTransferLog(tx);
            tN++;
        }
    }
    setDraft([]);
    renderDraft();
    bumpSignal();
    alert(`Listo ✅ Ingresos: ${iN} | Gastos: ${eN} | Transferencias: ${tN} (no suman al total).`);
}

function clearDraft(){ setDraft([]); renderDraft(); }
function deleteSelected(){
    const rows = [...els.draftRows.querySelectorAll("tr")];
    const d = getDraft(); const remove = [];
    rows.forEach((tr, i)=>{ const cb = tr.querySelector(".sel"); if(cb && cb.checked) remove.push(i); });
    if(!remove.length) return alert("Marca al menos una fila.");
    remove.sort((a,b)=>b-a).forEach(i=>d.splice(i,1));
    setDraft(d); renderDraft();
}

async function handleParse(){
    const f = els.file.files?.[0];
    if(!f) return alert("Elige un PDF primero.");
    try{
        let text = await readPdfTextViaPdfjs(f);
        if (!text || text.replace(/\s/g,"").length < 50){
            if (dbg.info) dbg.info.textContent = "No hay texto embebido. Usando OCR (puede tardar)…";
            text = await readPdfTextViaOCR(f);
        }
        updateDebug(text);
        const parsed = parseBankPopular(text);
        setDraft(getDraft().concat(parsed));
        renderDraft();
        if(!parsed.length) alert("Leí el PDF pero no reconocí transacciones. Descarga el .txt (Debug) y lo afinamos.");
    }catch(e){
        console.error(e);
        alert("No pude leer el PDF. Abre la consola (F12) y copia el error para ajustarlo.");
    }
}

/* ---------- init ---------- */
function init(){
    renderYear(); renderDraft();
    els.parseBtn.addEventListener("click", handleParse);
    els.acceptAll.addEventListener("click", acceptAll);
    els.clearDraft.addEventListener("click", clearDraft);
    els.deleteSelected.addEventListener("click", deleteSelected);
}
if(document.readyState!=="loading") init();
else window.addEventListener("DOMContentLoaded", init);
