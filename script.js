// Estado de la aplicación
let state = {
    players: [],
    history: []
};

// Configuración inicial
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    render(); // Render first to ensure elements exist
    setupGlobalListeners();
    updateUndoButton();
});

// Setup Listeners
function setupGlobalListeners() {
    setupEnterKey('new-member-name', addMember);
    setupEnterKey('transaction-amount', executeTransaction);

    const chargeBtn = document.getElementById('global-charge-btn');
    if (chargeBtn) chargeBtn.onclick = () => openGlobalAction('charge');
    
    // Inject Undo Button if not exists
    const controls = document.querySelector('.global-controls');
    if (controls && !document.getElementById('undo-btn')) {
        const undoBtn = document.createElement('button');
        undoBtn.id = 'undo-btn';
        undoBtn.className = 'btn glass-btn';
        undoBtn.title = 'Deshacer última acción';
        undoBtn.innerHTML = `<i class='bx bx-undo'></i>`;
        undoBtn.onclick = undoLastAction;
        controls.appendChild(undoBtn); // Add to end
    }
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
            state.history = loaded.history || [];
        }
    } catch (e) {
        console.error('Error loading state:', e);
        state = { players: [], history: [] };
    }
}

function saveState() {
    // Limit history stack to 50
    if (state.history.length > 50) state.history.shift();
    
    localStorage.setItem('gaming-pool-state', JSON.stringify({ 
        players: state.players,
        history: state.history 
    }));
    render();
    updateUndoButton();
}

function saveHistory() {
    // Deep copy current players state to history
    const snapshot = JSON.parse(JSON.stringify(state.players));
    state.history.push(snapshot);
}

function undoLastAction() {
    if (state.history.length === 0) {
        showToast('No hay acciones para deshacer', 'error');
        return;
    }

    const previousPlayers = state.history.pop();
    state.players = previousPlayers;
    saveState();
    showToast('Acción deshecha', 'success');
}

function updateUndoButton() {
    const btn = document.getElementById('undo-btn');
    if (btn) {
        if (state.history.length === 0) {
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
        } else {
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
        }
    }
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

    saveHistory();

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
    const p = state.players.find(x => x.id === id);
    if(p) {
        openModal({
            title: `¿Eliminar a ${p.name}?`,
            desc: 'Esta acción eliminará al jugador y no se podrá deshacer, salvo con "Deshacer".',
            confirmText: 'Sí, Eliminar',
            type: 'delete_confirm',
            data: { playerId: id }
        });
    }
}

function toggleMemberVisibility(id) {
    const p = state.players.find(x => x.id === id);
    if(p) {
        const action = p.isHidden ? 'Habilitar' : 'Excluir';
        openModal({
            title: `¿${action} a ${p.name}?`,
            desc: p.isHidden 
                ? 'El jugador volverá a participar en las acciones del pozo.' 
                : 'El jugador quedará fuera de "Todos al Pozo" y acciones rápidas.',
            confirmText: `Sí, ${action}`,
            type: 'toggle_visibility_confirm',
            data: { playerId: id }
        });
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
    const noInputTypes = ['reset_confirm', 'delete_confirm', 'toggle_visibility_confirm'];
    if (noInputTypes.includes(type)) {
        amountInput.style.display = 'none';
    } else {
        amountInput.style.display = 'block';
    }

    if(dynamicControls) {
        dynamicControls.innerHTML = ''; 

        if (type === 'transaction_detailed') {
            const isPay = data.direction === 'PAY';

            // Helper: Button to set amount to Pool Balance
            const poolBalance = getPoolBalance();
            if (poolBalance > 0) {
                const helperBtn = document.createElement('button');
                helperBtn.className = 'btn glass-btn small-btn full-width';
                helperBtn.style.marginBottom = '1rem';
                helperBtn.innerHTML = `<i class='bx bxs-bank'></i> Usar Total del Pozo ($${poolBalance.toLocaleString()})`;
                helperBtn.onclick = () => {
                   amountInput.value = poolBalance;
                   const targetSelector = document.getElementById('target-selector');
                   if(targetSelector) targetSelector.value = 'POOL';
                   amountInput.focus();
                };
                dynamicControls.appendChild(helperBtn);
            }

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
    if(!noInputTypes.includes(type)) setTimeout(() => amountInput.focus(), 100);
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
        saveHistory();
        state.players = [];
        saveState();
        showToast('Aplicación reiniciada', 'success');
        closeModal();
        return;
    }

    // Handle Delete Confirm
    if (type === 'delete_confirm') {
        saveHistory();
        state.players = state.players.filter(p => p.id !== data.playerId);
        saveState();
        showToast('Jugador eliminado', 'success');
        closeModal();
        return;
    }

    // Handle Toggle Visibility Confirm
    if (type === 'toggle_visibility_confirm') {
        saveHistory();
        const p = state.players.find(x => x.id === data.playerId);
        if(p) {
            p.isHidden = !p.isHidden;
            saveState();
            showToast(p.isHidden ? 'Jugador Excluido' : 'Jugador Habilitado', 'success');
        }
        closeModal();
        return;
    }

    const amount = parseFloat(amountInput.value);
    if (!amount || amount <= 0) {
        showToast('Monto inválido', 'error');
        return;
    }

    if (type === 'global' && data.actionType === 'charge') {
        saveHistory(); // Save before global transaction
        let count = 0;
        state.players.forEach(p => {
            if (!p.isHidden) {
                performTransaction(p.id, 'POOL', amount);
                count++;
            }
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
    updateGridExpansion(null); // Reset layout to default
    const poolBalance = getPoolBalance();
    const poolEl = document.getElementById('pool-amount');
    if(poolEl) poolEl.innerText = poolBalance.toLocaleString();

    const grid = document.getElementById('members-grid');
    if(!grid) return;
    grid.innerHTML = '';
    
    state.players.forEach(p => {
        const isHidden = p.isHidden;
        const card = document.createElement('div');
        // Add excluded-card class if hidden
        card.className = `member-card compact-card ${isHidden ? 'excluded-card' : ''}`;
        
        let balanceClass = 'neutral';
        if (p.balance > 0) balanceClass = 'positive';
        if (p.balance < 0) balanceClass = 'negative';

        const eyeIcon = isHidden ? 'bx-low-vision' : 'bx-show';
        const eyeTitle = isHidden ? 'Habilitar' : 'Ocultar/Excluir';

        card.innerHTML = `
            <div class="card-row header-row">
                <span class="member-name small-name">${p.name}</span>
                <div class="header-actions" style="display:flex; gap:0.5rem;">
                    <i class='bx ${eyeIcon} action-icon' onclick="toggleMemberVisibility('${p.id}')" title="${eyeTitle}" style="cursor:pointer; opacity:0.7;"></i>
                    <i class='bx bx-trash delete-btn' onclick="removeMember('${p.id}')"></i>
                </div>
            </div>
            
            <div class="card-row balance-row">
                <div class="member-balance small-balance ${balanceClass}">
                    ${p.balance > 0 ? '+' : ''}${p.balance.toLocaleString()}
                </div>
            </div>
            
            ${!isHidden ? `
            <div id="actions-${p.id}" class="card-row actions-row">
                <button class="btn glass-btn action-btn danger" onclick="openQuickTransaction('${p.id}', 'PAY')">
                    <i class='bx bx-minus'></i> Pagar
                </button>
                <button class="btn glass-btn action-btn success" onclick="openQuickTransaction('${p.id}', 'RECEIVE')">
                    <i class='bx bx-plus'></i> Cobrar
                </button>
            </div>

            <div id="tx-form-${p.id}" class="tx-form-container" style="display:none;">
                <!-- Form injected dynamically -->
            </div>
            ` : `<div style="text-align:center; font-size:0.8rem; opacity:0.6; padding:0.5rem;">Excluido del Pozo</div>`}
        `;
        grid.appendChild(card);
    });
}

function openQuickTransaction(playerId, type) {
    const player = state.players.find(p => p.id === playerId);
    if (!player || player.isHidden) {
        if(player && player.isHidden) showToast('Habilitá al jugador primero', 'error');
        return;
    }

    // Reset any previous expansion before expanding new one
    updateGridExpansion(null); 
    
    // Slight delay to allow CSS transition if needed, but immediate is fine for now
    updateGridExpansion(playerId);

    const formContainer = document.getElementById(`tx-form-${playerId}`);
    const actionsContainer = document.getElementById(`actions-${playerId}`);
    
    if(!formContainer || !actionsContainer) return;

    actionsContainer.style.display = 'none';
    formContainer.style.display = 'block';

    const isPay = type === 'PAY';
    const poolBalance = getPoolBalance();

    let helperBtnHtml = '';
    // Only show helper button if there is a pool balance
    if (poolBalance > 0) {
        helperBtnHtml = `
            <button class="btn glass-btn small-btn full-width" style="margin-bottom:0.5rem" onclick="setInputToPool('${playerId}', ${poolBalance})">
                <i class='bx bxs-bank'></i> Usar Pozo ($${poolBalance.toLocaleString()})
            </button>
        `;
    }

    let targetOptions = `<option value="POOL">Pozo Común</option>`;
    state.players.forEach(p => {
        if(p.id !== playerId && !p.isHidden) {
            targetOptions += `<option value="${p.id}">${p.name}</option>`;
        }
    });

    formContainer.innerHTML = `
        <div class="inline-tx-form">
            <div class="tx-header">
                <span>${isPay ? 'Pagar (-)' : 'Cobrar (+)'}</span>
            </div>
            
            <input type="number" id="amt-${playerId}" class="glass-input small-input" placeholder="Monto $" autofocus>
            
            ${helperBtnHtml}

            <label class="input-label small-label">${isPay ? 'Destino:' : 'Origen:'}</label>
            <select id="target-${playerId}" class="glass-input small-input">
                ${targetOptions}
            </select>

            <div class="tx-actions">
                <button class="btn glass-btn danger small-btn" onclick="cancelTransaction('${playerId}')">Cancelar</button>
                <button class="btn primary-btn small-btn" onclick="confirmTransaction('${playerId}', '${type}')">Confirmar</button>
            </div>
        </div>
    `;

    // Focus input
    setTimeout(() => {
        const inp = document.getElementById(`amt-${playerId}`);
        if(inp) {
            inp.focus();
            inp.addEventListener('keypress', (e) => {
                if(e.key === 'Enter') confirmTransaction(playerId, type);
            });
        }
    }, 100);
}

function setInputToPool(playerId, amount) {
    const inp = document.getElementById(`amt-${playerId}`);
    const sel = document.getElementById(`target-${playerId}`);
    if(inp) inp.value = amount;
    if(sel) sel.value = 'POOL';
}

function cancelTransaction(playerId) {
    updateGridExpansion(null); // Reset Grid

    const formContainer = document.getElementById(`tx-form-${playerId}`);
    const actionsContainer = document.getElementById(`actions-${playerId}`);
    if(formContainer) {
        formContainer.style.display = 'none';
        formContainer.innerHTML = '';
    }
    if(actionsContainer) actionsContainer.style.display = 'flex';
}

function confirmTransaction(playerId, type) {
    const amtInput = document.getElementById(`amt-${playerId}`);
    const targetSel = document.getElementById(`target-${playerId}`);
    
    if(!amtInput || !targetSel) return;

    const amount = parseFloat(amtInput.value);
    const targetId = targetSel.value;
    
    if (!amount || amount <= 0) {
        showToast('Monto inválido', 'error');
        return;
    }

    const direction = type; 
    let from, to;
    let msg = '';

    if (direction === 'PAY') {
        from = playerId;
        to = targetId;
        msg = targetId === 'POOL' ? 'Pago al Pozo registrado' : 'Transferencia enviada';
    } else {
        from = targetId;
        to = playerId;
        msg = targetId === 'POOL' ? 'Cobro del Pozo registrado' : 'Transferencia recibida';
    }

    // Validation
    if (from === 'POOL') {
        const currentPool = getPoolBalance();
        if (amount > currentPool) {
            showToast(`El pozo solo tiene $${currentPool}`, 'error');
            return; 
        }
    }

    saveHistory(); // Save before performing transaction
    performTransaction(from, to, amount);
    showToast(msg, 'success');
    saveState(); // Will re-render and thus close the form automatically (or we can call cancelTransaction)
}

function updateGridExpansion(activePlayerId) {
    const grid = document.getElementById('members-grid');
    if (!grid) return;
    
    // Reset classes first
    grid.classList.remove('expand-left', 'expand-right');
    
    if (!activePlayerId) return;

    const index = state.players.findIndex(p => p.id === activePlayerId);
    if (index === -1) return;

    // Even index (0, 2, 4...) is Left column
    // Odd index (1, 3, 5...) is Right column
    if (index % 2 === 0) {
        grid.classList.add('expand-left');
    } else {
        grid.classList.add('expand-right');
    }
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
    }, 1000); // 1 Second
}
