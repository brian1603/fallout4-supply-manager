const supplyRunForm = document.getElementById('supplyRunForm');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const supplyRunsTableBody = document.getElementById('supplyRunsTableBody');
const reportForm = document.getElementById('reportForm');
const reportTableBody = document.getElementById('reportTableBody');
const reportStats = document.getElementById('reportStats');

let lookups = {
    settlements: [],
    factions: [],
    itemTypes: []
};

async function fetchJSON(url, options = {}) {
    const response = await fetch(url, options);
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Something went wrong');
    }
    return data;
}

function populateSelect(selectElement, items, valueField, textField, includeDefault = false, defaultText = 'Select One') {
    selectElement.innerHTML = '';

    if (includeDefault) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = defaultText;
        selectElement.appendChild(option);
    }

    items.forEach((item) => {
        const option = document.createElement('option');
        option.value = item[valueField];
        option.textContent = item[textField];
        selectElement.appendChild(option);
    });
}

async function loadLookups() {
    lookups = await fetchJSON('/api/lookups');

    populateSelect(document.getElementById('settlement_id'), lookups.settlements, 'settlement_id', 'name');
    populateSelect(document.getElementById('faction_id'), lookups.factions, 'faction_id', 'name');
    populateSelect(document.getElementById('item_type_id'), lookups.itemTypes, 'item_type_id', 'name');

    populateSelect(document.getElementById('report_settlement_id'), lookups.settlements, 'settlement_id', 'name', true, 'All Settlements');
    populateSelect(document.getElementById('report_faction_id'), lookups.factions, 'faction_id', 'name', true, 'All Factions');
}

async function loadSupplyRuns() {
    const runs = await fetchJSON('/api/supply-runs');
    supplyRunsTableBody.innerHTML = '';

    runs.forEach((run) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
        <td>${run.run_id}</td>
        <td>${run.run_date}</td>
        <td>${run.settlement_name}</td>
        <td>${run.faction_name}</td>
        <td>${run.item_type_name}</td>
        <td>${run.quantity}</td>
        <td>${Number(run.cap_cost).toFixed(2)}</td>
        <td>${run.notes || ''}</td>
        <td>
            <div class="action-buttons">
            <button onclick="editSupplyRun(${run.run_id}, ${run.settlement_id}, ${run.faction_id}, ${run.item_type_id}, '${run.run_date}', ${run.quantity}, ${run.cap_cost}, ${JSON.stringify(run.notes || '').replace(/"/g, '&quot;')})">Edit</button>
            <button class="delete-btn" onclick="deleteSupplyRun(${run.run_id})">Delete</button>
            </div>
        </td>
        `;
        supplyRunsTableBody.appendChild(tr);
    });
}

window.editSupplyRun = function (run_id, settlement_id, faction_id, item_type_id, run_date, quantity, cap_cost, notes) {
    document.getElementById('run_id').value = run_id;
    document.getElementById('settlement_id').value = settlement_id;
    document.getElementById('faction_id').value = faction_id;
    document.getElementById('item_type_id').value = item_type_id;
    document.getElementById('run_date').value = run_date;
    document.getElementById('quantity').value = quantity;
    document.getElementById('cap_cost').value = cap_cost;
    document.getElementById('notes').value = notes;
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.deleteSupplyRun = async function (run_id) {
    const confirmed = confirm('Delete this supply run?');
    if (!confirmed) return;

    try {
        await fetchJSON(`/api/supply-runs/${run_id}`, { method: 'DELETE' });
        await loadSupplyRuns();
    } catch (err) {
        alert(err.message);
    }
};

function resetSupplyRunForm() {
    supplyRunForm.reset();
    document.getElementById('run_id').value = '';
}

supplyRunForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const payload = {
        settlement_id: document.getElementById('settlement_id').value,
        faction_id: document.getElementById('faction_id').value,
        item_type_id: document.getElementById('item_type_id').value,
        run_date: document.getElementById('run_date').value,
        quantity: Number(document.getElementById('quantity').value),
        cap_cost: Number(document.getElementById('cap_cost').value),
        notes: document.getElementById('notes').value
    };

    const runId = document.getElementById('run_id').value;

    try {
        if (runId) {
        await fetchJSON(`/api/supply-runs/${runId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        } else {
        await fetchJSON('/api/supply-runs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        }

        resetSupplyRunForm();
        await loadSupplyRuns();
    } catch (err) {
        alert(err.message);
    }
});

cancelEditBtn.addEventListener('click', () => {
    resetSupplyRunForm();
});

document.getElementById('settlementForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('newSettlementName').value;
    const region = document.getElementById('newSettlementRegion').value;

    try {
        await fetchJSON('/api/settlements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, region })
        });
        e.target.reset();
        await loadLookups();
    } catch (err) {
        alert(err.message);
    }
});

document.getElementById('factionForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('newFactionName').value;

    try {
        await fetchJSON('/api/factions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
        });
        e.target.reset();
        await loadLookups();
    } catch (err) {
        alert(err.message);
    }
});

document.getElementById('itemTypeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('newItemTypeName').value;

    try {
        await fetchJSON('/api/item-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
        });
        e.target.reset();
        await loadLookups();
    } catch (err) {
        alert(err.message);
    }
});


reportForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const params = new URLSearchParams({
        settlement_id: document.getElementById('report_settlement_id').value,
        faction_id: document.getElementById('report_faction_id').value,
        start_date: document.getElementById('report_start_date').value,
        end_date: document.getElementById('report_end_date').value
    });

    try {
        const report = await fetchJSON(`/api/report?${params.toString()}`);
        renderReport(report);
    } catch (err) {
        alert(err.message);
    }
});

function renderReport(report) {
    reportTableBody.innerHTML = '';

    report.rows.forEach((row) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
        <td>${row.run_id}</td>
        <td>${row.run_date}</td>
        <td>${row.settlement_name}</td>
        <td>${row.faction_name}</td>
        <td>${row.item_type_name}</td>
        <td>${row.quantity}</td>
        <td>${Number(row.cap_cost).toFixed(2)}</td>
        <td>${row.notes || ''}</td>
        `;
        reportTableBody.appendChild(tr);
    });

    reportStats.innerHTML = `
        <div class="stats-grid">
        <div><strong>Total Runs:</strong> ${report.stats.total_runs}</div>
        <div><strong>Average Quantity:</strong> ${report.stats.avg_quantity}</div>
        <div><strong>Average Cap Cost:</strong> ${report.stats.avg_cap_cost}</div>
        <div><strong>Total Quantity:</strong> ${report.stats.total_quantity}</div>
        <div><strong>Total Cap Cost:</strong> ${report.stats.total_cap_cost}</div>
        </div>
    `;
}

async function initializeApp() {
    try {
        await loadLookups();
        await loadSupplyRuns();
    } catch (err) {
        alert(err.message);
    }
}

initializeApp();