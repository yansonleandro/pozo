// Estado de la aplicación
let state = {
    players: []
};

// Configuración inicial
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    render();
    setupGlobalListeners();
});

// Setup Listeners
function setupGlobalListeners() {
    setupEnterKey('new-member-name', addMember);
    setupEnterKey('transaction-amount', executeTransaction);

    const chargeBtn = document.getElementById('global-charge-btn');
    if (chargeBtn) chargeBtn.onclick = () => openGlobalAction('charge');
}

function setupEnterKey(id, action) {
    const el = document.getElementById(id);
    if(el) {
        el.addEventListener('keypress', (e) => {
            if(e.key === 'Enter') action();
        });
    }
}

// State Management
function loadState() {
    try {
        const saved = localStorage.getItem('gaming-pool-state');
        if (saved) {
            const loaded = JSON.parse(saved);
            state.players = loaded.players || [];
        }
    } catch (e) {
        console.error('Error loading state:', e);
        state = { players: [] };
    }
}

function saveState() {
    localStorage.setItem('gaming-pool-state', JSON.stringify({ players: state.players }));
    render();
}

function resetApp() {
    openModal({
        title: '¿Reiniciar Todo?',
        desc: 'Se borrarán todos los jugadores y el historial. No se puede deshacer.',
        confirmText: 'Sí, Borrar Todo',
        type: 'reset_confirm',
        data: {}
    });
}

function getPoolBalance() {
    const sum = state.players.reduce((acc, p) => acc + p.balance, 0);
    return sum === 0 ? 0 : -sum;
}

// ---- Lógica de Negocio Core ----

function addMember() {
    const nameInput = document.getElementById('new-member-name');
    const name = nameInput.value.trim();
    
    if (!name) return showToast('Nombre requerido', 'error');
    if (state.players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
        return showToast('El jugador ya existe', 'error');
    }

    const newPlayer = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        name: name,
        balance: 0 
    };
    
    state.players.push(newPlayer);
    showToast('Jugador agregado', 'success');

    nameInput.value = '';
    saveState();
}

function removeMember(id) {
    if(confirm('¿Eliminar jugador?')) {
        state.players = state.players.filter(p => p.id !== id);
        saveState();
        showToast('Jugador eliminado', 'success');
    }
}

function performTransaction(fromId, toId, amount) {
    amount = parseFloat(amount);
    if(isNaN(amount) || amount <= 0) return false;
    
    if (fromId !== 'POOL') {
        const p = state.players.find(x => x.id === fromId);
        if(p) p.balance -= amount;
    }

    if (toId !== 'POOL') {
        const p = state.players.find(x => x.id === toId);
        if(p) p.balance += amount;
    }

    return true;
}

// 3. UI Actions
let currentTransactionConfig = null;

function openQuickTransaction(playerId, type) {
    const player = state.players.find(p => p.id === playerId);
    if (!player) return;

    const isPay = type === 'PAY';
    
    openModal({
        title: isPay ? `Pagar (-)` : `Cobrar (+)`,
        desc: isPay 
            ? `Tu saldo bajará. Elige a quién pagas desde ${player.name}:` 
            : `Tu saldo subirá. Elige de quién cobras para ${player.name}:`,
        confirmText: isPay ? 'Pagar' : 'Cobrar',
        type: 'transaction_detailed',
        data: { 
            playerId, 
            direction: type 
        }
    });
}

function openGlobalAction(type) {
    if(type !== 'charge') return;
    
    openModal({
        title: 'Todos pagan al Pozo',
        desc: 'Se restará el monto a CADA jugador y crecerá el pozo.',
        confirmText: 'Ejecutar',
        type: 'global',
        data: { actionType: type }
    });
}

// Modal Handler
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const modalDesc = document.getElementById('modal-desc');
const amountInput = document.getElementById('transaction-amount');
const dynamicControls = document.getElementById('dynamic-controls');
const confirmBtn = document.querySelector('#modal .primary-btn');

function openModal({title, desc, confirmText, type, data}) {
    modalTitle.innerText = title;
    modalDesc.innerText = desc;
    if(confirmBtn) confirmBtn.innerText = confirmText || 'Confirmar';
    amountInput.value = '';
    
    currentTransactionConfig = { type, data };

    // Toggle Amount Input Visibility
    if (type === 'reset_confirm') {
        amountInput.style.display = 'none';
    } else {
        amountInput.style.display = 'block';
    }

    if(dynamicControls) {
        dynamicControls.innerHTML = ''; 

        if (type === 'transaction_detailed') {
            const isPay = data.direction === 'PAY';
            
            const label = document.createElement('label');
            label.innerText = isPay ? 'Destino del pago:' : 'Origen del cobro:';
            label.className = 'input-label';
            dynamicControls.appendChild(label);

            const select = document.createElement('select');
            select.id = 'target-selector';
            select.className = 'glass-input';
            
            const poolOption = document.createElement('option');
            poolOption.value = 'POOL';
            poolOption.innerText = 'Pozo Común';
            select.appendChild(poolOption);

            state.players.forEach(p => {
                if (p.id !== data.playerId) {
                    const opt = document.createElement('option');
                    opt.value = p.id;
                    opt.innerText = p.name;
                    select.appendChild(opt);
                }
            });

            dynamicControls.appendChild(select);
        }
    }

    modal.classList.remove('hidden');
    // Solo enfocar si el input está visible
    if(type !== 'reset_confirm') setTimeout(() => amountInput.focus(), 100);
}

function closeModal() {
    modal.classList.add('hidden');
    currentTransactionConfig = null;
}

function executeTransaction() {
    if (!currentTransactionConfig) return;

    const { type, data } = currentTransactionConfig;

    // Handle Reset Special Case
    if (type === 'reset_confirm') {
        state.players = [];
        saveState();
        showToast('Aplicación reiniciada', 'success');
        closeModal();
        return;
    }

    const amount = parseFloat(amountInput.value);
    if (!amount || amount <= 0) {
        showToast('Monto inválido', 'error');
        return;
    }

    if (type === 'global' && data.actionType === 'charge') {
        let count = 0;
        state.players.forEach(p => {
            performTransaction(p.id, 'POOL', amount);
            count++;
        });
        showToast(`Se cobró $${amount} a ${count} jugadores`, 'success');
    }

    if (type === 'transaction_detailed') {
        const mainPlayerId = data.playerId;
        const targetId = document.getElementById('target-selector').value;
        const direction = data.direction; 
        
        let from, to;
        let msg = '';

        if (direction === 'PAY') {
            from = mainPlayerId;
            to = targetId;
            msg = targetId === 'POOL' ? 'Pago al Pozo registrado' : 'Transferencia enviada';
        } else {
            from = targetId;
            to = mainPlayerId;
            msg = targetId === 'POOL' ? 'Cobro del Pozo registrado' : 'Transferencia recibida';
        }

        // Validación: El pozo no puede quedar negativo
        if (from === 'POOL') {
            const currentPool = getPoolBalance();
            if (amount > currentPool) {
                showToast(`El pozo solo tiene $${currentPool}`, 'error');
                return; // Bloquear transacción
            }
        }

        performTransaction(from, to, amount);
        showToast(msg, 'success');
    }

    saveState();
    closeModal();
}

function formatCurrency(num) {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(num);
}

function render() {
    const poolBalance = getPoolBalance();
    const poolEl = document.getElementById('pool-amount');
    if(poolEl) poolEl.innerText = poolBalance.toLocaleString();

    // Headers Count Removed
    
    const grid = document.getElementById('members-grid');
    if(!grid) return;
    grid.innerHTML = '';
    
    state.players.forEach(p => {
        const card = document.createElement('div');
        card.className = 'member-card compact-card';
        
        let balanceClass = 'neutral';
        if (p.balance > 0) balanceClass = 'positive';
        if (p.balance < 0) balanceClass = 'negative';

        card.innerHTML = `
            <div class="card-row header-row">
                <span class="member-name small-name">${p.name}</span>
                <i class='bx bx-trash delete-btn' onclick="removeMember('${p.id}')"></i>
            </div>
            
            <div class="card-row balance-row">
                <div class="member-balance small-balance ${balanceClass}">
                    ${p.balance > 0 ? '+' : ''}${p.balance.toLocaleString()}
                </div>
            </div>

            <div class="card-row actions-row">
                <button class="btn glass-btn icon-only danger" onclick="openQuickTransaction('${p.id}', 'PAY')">
                    <i class='bx bx-minus'></i>
                </button>
                <button class="btn glass-btn icon-only success" onclick="openQuickTransaction('${p.id}', 'RECEIVE')">
                    <i class='bx bx-plus'></i>
                </button>
            </div>
        `;
        grid.appendChild(card);
    });
}

function showToast(msg, type='success') {
    const container = document.getElementById('toast-container');
    if(!container) return;
    
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<i class='bx ${type==='success'?'bx-check':'bx-error'}'></i> ${msg}`;
    container.appendChild(t);
    setTimeout(() => {
        t.style.opacity = '0'; 
        t.style.transform = 'translateY(100%)';
        setTimeout(()=>t.remove(), 300);
    }, 3000);
}
