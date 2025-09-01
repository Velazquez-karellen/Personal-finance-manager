(function (W){
  var KEYS = {
    incomes:            "pfm.transactions.income",
    expenses:           "pfm.transactions.expense",
    balSavings:         "pfm.balance.savings",
    balSafe:            "pfm.balance.safe",
    lastComputed:       "pfm.ahorros.lastComputed",
    monthlyBase:        "pfm.monthly.base",
    monthlyLastClosed:  "pfm.monthly.lastClosed"
  };

  function n(v){ v = Number(v); return isFinite(v) ? v : 0; }
  function getNum(k){ return n(localStorage.getItem(k)); }
  function setNum(k,v){ localStorage.setItem(k, String(n(v))); }
  function fmt(v){ return n(v).toLocaleString("es-PR",{style:"currency",currency:"USD"}); }

  function monthKey(d){ return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0"); }
  function parseAnyDate(s){
    if(!s) return null;
    if(/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s+"T00:00:00");
    if(/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)){ var p=s.split("/"); return new Date(+p[2], +p[0]-1, +p[1]); }
    var d = new Date(s); return isNaN(+d) ? null : d;
  }

  function list(key){ try{ return JSON.parse(localStorage.getItem(key)||"[]"); }catch(_){ return []; } }
  function sumExpensesForMonth(key){
    var ex = list(KEYS.expenses), sum = 0;
    for(var i=0;i<ex.length;i++){
      var d = parseAnyDate(ex[i].date);
      if(!d) continue;
      if(monthKey(d)===key) sum += n(ex[i].amount);
    }
    return sum;
  }

  // Asegura una base mensual.
  function ensureBase(){
    var base = n(localStorage.getItem(KEYS.monthlyBase));
    if(base>0) return base;

    // Intento 1: lastComputed.perMonth (si existe)
    var last=null; try{ last = JSON.parse(localStorage.getItem(KEYS.lastComputed)||"null"); }catch(_){}
    if(last && n(last.perMonth)>0){ base = n(last.perMonth); setNum(KEYS.monthlyBase, base); return base; }

    // Intento 2: lastComputed.safeTotal / months
    if(last && (n(last.safeTotal)>0 || n(last.safeNow)>0)){
      var months = n(last.months)||6;
      var safe   = n(last.safeTotal||last.safeNow);
      base = safe / Math.max(1, months);
      setNum(KEYS.monthlyBase, base);
      return base;
    }

    // Si no hay forma de derivarla, queda 0 hasta que la fije Ahorros → "Aplicar al Dashboard".
    return 0;
  }

  // Rollover del mes anterior → se ejecuta al entrar al Dashboard
  function rolloverIfNeeded(){
    var base = ensureBase();
    if(base<=0) return { transferred:0 };

    var now      = new Date();
    var prevKey  = monthKey(new Date(now.getFullYear(), now.getMonth()-1, 1));
    var lastDone = localStorage.getItem(KEYS.monthlyLastClosed)||"";

    if(lastDone === prevKey) return { transferred:0 }; // ya cerrado

    // Cierro únicamente el mes anterior
    var spentPrev = sumExpensesForMonth(prevKey);
    var leftover  = Math.max(0, base - spentPrev);

    if(leftover>0){
      var sav = getNum(KEYS.balSavings);
      var safe= getNum(KEYS.balSafe);
      var transfer = Math.min(leftover, safe); // no dejes BP en negativo
      setNum(KEYS.balSavings, sav + transfer);
      setNum(KEYS.balSafe,    Math.max(0, safe - transfer));
    }

    localStorage.setItem(KEYS.monthlyLastClosed, prevKey);
    return { transferred:leftover };
  }

  function availableThisMonth(){
    var base = ensureBase();
    var currentKey = monthKey(new Date());
    var spent      = sumExpensesForMonth(currentKey);
    var avail      = Math.max(0, base - spent);
    return { base:base, spent:spent, available:avail };
  }

  // API pública
  W.PFMMonthly = {
    fmt: fmt,
    KEYS: KEYS,
    setBase: function(v){ setNum(KEYS.monthlyBase, v); },
    rolloverIfNeeded: rolloverIfNeeded,
    availableThisMonth: availableThisMonth
  };
})(window);
