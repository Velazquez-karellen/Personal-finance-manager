export const BAL={ savings:"pfm.balance.savings", safe:"pfm.balance.safe" };
export function setBalances({savings,safe}){ if(typeof savings==="number") localStorage.setItem(BAL.savings, String(savings)); if(typeof safe==="number") localStorage.setItem(BAL.safe, String(safe)); }
export function getBalances(){ return { savings: Number(localStorage.getItem(BAL.savings)||0), safe: Number(localStorage.getItem(BAL.safe)||0)}; }

/* ----------  Helpers extra para importación/reportes ---------- */
export function parseAmount(s){
  if (typeof s === "number") return s;
  if (!s) return 0;
  // acepta: $1,234.56  ó  -$123.45  ó  1,234.56-  ó  (123.45)
  const negParen = /\(([^)]+)\)/.exec(s);
  if (negParen) return -parseAmount(negParen[1]);
  const negEnd = /-$/.test(s);
  const cleaned = String(s).replace(/[^\d.,-]/g,"").replace(/,$/,"");
  let n = Number(cleaned.replace(/,/g,""));
  if (negEnd) n = -n;
  return isNaN(n) ? 0 : n;
}

const GUESS = {
  expense: [
    {k:/super|wal.?mart|marqueta|grocer|food|restaurant|eats|ubereats|doordash/i, c:"Comida"},
    {k:/shell|total|texaco|gas|fuel|petro/i, c:"Transporte"},
    {k:/netflix|spotify|apple|icloud|prime|disney|hulu|youtube/i, c:"Suscripciones"},
    {k:/claro|t.?mobile|att|verizon|cell|móvil|telefono/i, c:"Celular"},
    {k:/uber|lyft|taxi|parking/i, c:"Transporte"},
    {k:/pharmacy|farmacia|walgreens|cvs/i, c:"Salud"},
    {k:/rent|hosped|apartment|room|alquiler/i, c:"Hospedaje"},
  ],
  income: [
    {k:/payroll|n[oó]mina|salary|deposit|direct|pago|paycheck/i, c:"Nómina"},
    {k:/scholar|beca|grant|stipend|pell/i, c:"Beca"},
    {k:/refund|reembolso|cashback|ajuste/i, c:"Reembolso"},
    {k:/zelle|ath|transfer|venmo|paypal/i, c:"Transferencia"},
  ]
};

export function guessCategory(kind, desc, fallback="Otros"){
  const bankText = String(desc||"");
  const table = kind==="income" ? GUESS.income : GUESS.expense;
  for (const rule of table){
    if (rule.k.test(bankText)) return rule.c;
  }
  const list = getCategories(kind);
  return list.includes(fallback) ? fallback : (list[0] || fallback);
}

export function sumByCategory(kind){
  const key = kind === "income" ? KEYS.incomes : KEYS.expenses;
  const list = readJSON(key, []);
  const totals = {};
  for(const t of list){
    const c = t.category || "Sin categoría";
    totals[c] = (totals[c]||0) + (Number(t.amount)||0);
  }
  return totals; // {cat: total}
}

export function removeCategory(kind, name){
  const key = kind === "income" ? KEYS.incomeCats : KEYS.expenseCats;
  const list = readJSON(key, []);
  const idx = list.indexOf(String(name));
  if (idx > -1){ list.splice(idx,1); writeJSON(key, list); }
  return list;
}
