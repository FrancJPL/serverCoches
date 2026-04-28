const API_URL = window.location.origin;

let allTimes = [];

// ─── Init ───────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    loadAllTimes();
    setInterval(loadAllTimes, 30000);

    document.getElementById('searchInput').addEventListener('input', applyFilters);
    document.getElementById('filterMap').addEventListener('change', applyFilters);
    document.getElementById('filterCar').addEventListener('change', applyFilters);

    checkSession();
});

// ─── Authentication ──────────────────────────────────────────────────────────

let currentMode = 'login';

function openModal() {
    document.getElementById('authModal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('authModal').style.display = 'none';
    document.getElementById('authMessage').textContent = '';
}

function switchTab(mode) {
    currentMode = mode;
    const btns = document.querySelectorAll('.tab-btn');
    btns[0].classList.toggle('active', mode === 'login');
    btns[1].classList.toggle('active', mode === 'register');
    document.getElementById('submitBtn').textContent = mode === 'login' ? 'Entrar' : 'Registrarse';
}

async function handleAuth(event) {
    event.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const msgEl = document.getElementById('authMessage');

    const endpoint = currentMode === 'login' ? '/login' : '/register';

    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            msgEl.className = 'auth-message success';
            msgEl.textContent = data.message;
            
            if (currentMode === 'login') {
                localStorage.setItem('driverName', data.username);
                setTimeout(() => {
                    closeModal();
                    updateUserUI(data.username);
                }, 1000);
            } else {
                // Switch to login after registration
                setTimeout(() => switchTab('login'), 1500);
            }
        } else {
            msgEl.className = 'auth-message error';
            msgEl.textContent = data.error || 'Error en la operación';
        }
    } catch (error) {
        msgEl.className = 'auth-message error';
        msgEl.textContent = 'Error de conexión con el servidor';
    }
}

function checkSession() {
    const name = localStorage.getItem('driverName');
    if (name) updateUserUI(name);
}

function updateUserUI(name) {
    const userSection = document.getElementById('userSection');
    userSection.innerHTML = `
        <div class="user-info">
            <span>🏁 ${name}</span>
            <button class="btn-logout" onclick="logout()">Salir</button>
        </div>
    `;
}

async function logout() {
    const username = localStorage.getItem('driverName');
    try {
        await fetch(`${API_URL}/logout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
    } catch (e) {}

    localStorage.removeItem('driverName');
    location.reload();
}

// ─── Data fetching ───────────────────────────────────────────────────────────

async function loadAllTimes() {
    try {
        showState('loading', 'Cargando tiempos...');
        const response = await fetch(`${API_URL}/times`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        allTimes = await response.json();
        populateFilterOptions();
        applyFilters();
    } catch (error) {
        console.error('Error fetching times:', error);
        showState('error', 'No se puede conectar con el servidor. Comprueba que esté en marcha.');
    }
}

// ─── Filters ─────────────────────────────────────────────────────────────────

function applyFilters() {
    const search = document.getElementById('searchInput').value.trim().toLowerCase();
    const mapVal = document.getElementById('filterMap').value;
    const carVal = document.getElementById('filterCar').value;

    let filtered = allTimes.filter(t => {
        const matchName = !search || (t.nombre && t.nombre.toLowerCase().includes(search));
        const matchMap = !mapVal || t.mapa === mapVal;
        const matchCar = !carVal || t.coche === carVal;
        return matchName && matchMap && matchCar;
    });

    renderTable(filtered);
    updateStats(filtered);
    renderFilterTags({ search, mapVal, carVal });
}

function resetFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('filterMap').value = '';
    document.getElementById('filterCar').value = '';
    applyFilters();
}

// ─── Populate selects with unique values ─────────────────────────────────────

function populateFilterOptions() {
    const maps = [...new Set(allTimes.map(t => t.mapa).filter(Boolean))].sort();
    const cars = [...new Set(allTimes.map(t => t.coche).filter(Boolean))].sort();

    const mapSelect = document.getElementById('filterMap');
    const carSelect = document.getElementById('filterCar');

    const current = { map: mapSelect.value, car: carSelect.value };

    mapSelect.innerHTML = '<option value="">Todos los mapas</option>';
    maps.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m; opt.textContent = m;
        if (m === current.map) opt.selected = true;
        mapSelect.appendChild(opt);
    });

    carSelect.innerHTML = '<option value="">Todos los coches</option>';
    cars.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c; opt.textContent = c;
        if (c === current.car) opt.selected = true;
        carSelect.appendChild(opt);
    });
}

// ─── Rendering ───────────────────────────────────────────────────────────────

function renderTable(times) {
    const tbody = document.getElementById('tableBody');

    if (!times || times.length === 0) {
        showState('empty', 'No hay tiempos que coincidan con los filtros aplicados.');
        return;
    }

    const rows = times.map((t, index) => {
        const posLabel = index === 0 ? '1'
            : index === 1 ? '2'
                : index === 2 ? '3'
                    : String(index + 1);

        return `
      <tr>
        <td>${posLabel}</td>
        <td>${escapeHtml(t.nombre)}</td>
        <td>${escapeHtml(t.mejor_vuelta)}</td>
        <td>${escapeHtml(t.tiempo_total)}</td>
        <td>${escapeHtml(t.coche)}</td>
        <td>${escapeHtml(t.mapa)}</td>
        <td>${formatDate(t.fecha_guardado)}</td>
      </tr>
    `;
    });

    tbody.innerHTML = rows.join('');
}

function showState(type, message) {
    const tbody = document.getElementById('tableBody');
    const cls = type === 'loading' ? 'state-row loading' : 'state-row';
    tbody.innerHTML = `<tr class="${cls}"><td colspan="7">${escapeHtml(message)}</td></tr>`;
}

function updateStats(times) {
    const el = document.getElementById('stats');
    if (times && times.length > 0) {
        el.innerHTML = `Total: <strong>${times.length}</strong> resultado${times.length !== 1 ? 's' : ''}`;
    } else {
        el.innerHTML = 'Sin resultados';
    }
}

function renderFilterTags({ search, mapVal, carVal }) {
    const bar = document.getElementById('filterBar');
    bar.innerHTML = '';

    if (search) {
        bar.appendChild(makeTag(`Nombre: "${search}"`, () => {
            document.getElementById('searchInput').value = '';
            applyFilters();
        }));
    }
    if (mapVal) {
        bar.appendChild(makeTag(`Mapa: ${mapVal}`, () => {
            document.getElementById('filterMap').value = '';
            applyFilters();
        }));
    }
    if (carVal) {
        bar.appendChild(makeTag(`Coche: ${carVal}`, () => {
            document.getElementById('filterCar').value = '';
            applyFilters();
        }));
    }
}

function makeTag(label, onRemove) {
    const tag = document.createElement('span');
    tag.className = 'filter-tag';
    tag.innerHTML = `${escapeHtml(label)} <button title="Quitar filtro">&times;</button>`;
    tag.querySelector('button').addEventListener('click', onRemove);
    return tag;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateString) {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleString('es-ES', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function escapeHtml(text) {
    if (text == null) return '—';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}