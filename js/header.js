const NAV_ITEMS = [
  { href: "./dashboard.html", label: "Dashboard" },
  { href: "./ingresos.html",  label: "Ingresos"  },
  { href: "./gastos.html",    label: "Gastos"    },
  { href: "./ahorros.html",   label: "Ahorros"   },
  { href: "./importar.html",  label: "Importar PDF" },
  { href: "./reportes.html",  label: "Reportes"  },
];

function currentFile(){
  const p = window.location.pathname;
  // soporta rutas tipo /carpeta/archivo.html
  const f = p.substring(p.lastIndexOf("/") + 1) || "dashboard.html";
  return f.toLowerCase();
}

function buildHeader(){
  const cur = currentFile();

  const links = NAV_ITEMS.map(({href,label})=>{
    const isActive = cur === href.replace("./","").toLowerCase();
    return `<a class="nav-link ${isActive ? "active" : ""}" href="${href}">${label}</a>`;
  }).join("");

  const headerHTML = `
    <header class="app-header">
      <div class="brand">Personal Finance Manager</div>
      <nav class="nav">
        ${links}
      </nav>
    </header>
  `;
  return headerHTML;
}

function mountHeader(){
  const html = buildHeader();
  const existing = document.querySelector(".app-header");
  if (existing){
    existing.outerHTML = html; // reemplaza el header previo
  }else{
    const wrap = document.createElement("div");
    wrap.innerHTML = html;
    document.body.insertBefore(wrap.firstElementChild, document.body.firstChild);
  }
}

window.addEventListener("DOMContentLoaded", mountHeader);
