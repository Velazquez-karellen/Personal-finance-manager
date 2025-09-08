# Personal Finance Manager (PFM)

PFM es una app 100% estática que corre en el navegador y guarda tus datos **en `localStorage`** (no hay servidor).  
Demo (GitHub Pages): https://velazquez-karellen.github.io/Personal-finance-manager/

## Estructura
- `index.html` → redirige a `dashboard.html` (necesario para GitHub Pages).
- `dashboard.html`, `ingresos.html`, `gastos.html`, `ahorros.html`, `importar.html`, `reportes.html`
- `css/` estilos
- `js/` lógica de cada página

> Importante: todas las rutas a CSS/JS deben ser **relativas** (sin `/` inicial) para que funcionen tanto localmente como en GitHub Pages.

## Ejecutar local
No hay build. Basta con abrir los HTML en el navegador (idealmente con un servidorcito estático).
- Opción rápida (VS Code): extensión “Live Server”.
- Opción simple (Python 3): `python -m http.server` y abrir `http://localhost:8000/dashboard.html`.

## Deploy en GitHub Pages
1. En **Settings → Pages**: Source = “Deploy from a branch”, Branch = `main`, Folder = `/root`.
2. Asegúrate de tener `index.html` en la raíz (este repo redirige a `dashboard.html`).
3. Verifica el último deploy en la pestaña **Actions** del repo y visita la URL de Pages.

## Datos y privacidad
- Todo se guarda en el navegador del usuario usando `localStorage`.
- Claves usadas (parcial):
    - `pfm.transactions.income`, `pfm.transactions.expense`
    - `pfm.total.income`, `pfm.total.expense` (sumas publicadas para el Dashboard/Reportes)
    - `pfm.balance.savings` (ahorro aplicado desde **Ahorros**)
    - `pfm.lastUpdate` (marca de refresco cruzado entre pestañas)

## Troubleshooting
- **Veo 404 en GitHub Pages**: asegúrate de tener `index.html` en la raíz.
- **No cargan CSS/JS**: revisa que las rutas sean relativas (p. ej. `css/style.css`, `js/header.js`).
- **Módulos ES con error**: confirma que los `import` usan rutas válidas y relativas.
- **No aparecen mis datos**: recuerda que todo vive en el `localStorage` del dominio; si cambias de navegador o limpias storage, empezarás en blanco.


## Instalar como App (PWA)
PFM es una PWA.  
- **Android/Chrome/Edge/Brave**: Menú → “Instalar app” (o usa el botón “Instalar” que aparece).
- **iOS/Safari**: Compartir → “Añadir a pantalla de inicio”.

### Técnico
- `manifest.webmanifest` define nombre, iconos y `start_url`.
- `sw.js` precachea HTML/CSS/JS/íconos y usa cache dinámico para recursos externos (pdf.js/tesseract).
- `offline.html` se muestra si no hay conexión.
- `js/pwa.js` registra el SW y gestiona el prompt de instalación.

> Para forzar actualización de la app tras cambios estáticos, incrementa `VERSION` en `sw.js` y vuelve a desplegar.
