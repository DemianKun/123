const API_BASE_URL = 'http://127.0.0.1:8000/api';

const app = {
    tempChartInstance: null,
    invChartInstance: null,
    tempData: [],
    tempLabels: [],

    initChefDashboard: function() {
        if(!this.checkAuth('chef')) return;
        this.initCharts();
        this.fetchDashboardData();
        // Polling cada 5 segundos para tiempo real
        setInterval(() => this.fetchDashboardData(), 5000);
    },

    initCharts: function() {
        Chart.defaults.color = '#64748B'; // text-muted
        Chart.defaults.font.family = "'Inter', sans-serif";
        Chart.defaults.font.weight = '600';
        
        const ctxTemp = document.getElementById('tempChart').getContext('2d');
        this.tempChartInstance = new Chart(ctxTemp, {
            type: 'line',
            data: {
                labels: this.tempLabels,
                datasets: [{
                    label: 'Temperatura (°C)',
                    data: this.tempData,
                    borderColor: '#3B82F6', // Blue
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { display: false },
                    y: { 
                        min: 0, max: 10,
                        grid: { color: 'rgba(0,0,0,0.05)' }
                    }
                },
                plugins: {
                    legend: { display: false }
                },
                animation: { duration: 0 }
            }
        });

        const ctxInv = document.getElementById('inventoryChart').getContext('2d');
        this.invChartInstance = new Chart(ctxInv, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: 'Nivel Actual (kg)',
                    data: [],
                    backgroundColor: 'rgba(16, 185, 129, 0.7)',
                    borderRadius: 6,
                    barThickness: 30
                }, {
                    label: 'Umbral Mínimo',
                    data: [],
                    type: 'line',
                    borderColor: '#EF4444',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: false,
                    pointRadius: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top', align: 'end' }
                },
                scales: {
                    x: { grid: { display: false } },
                    y: { grid: { color: 'rgba(0,0,0,0.05)' } }
                }
            }
        });
    },

    fetchDashboardData: async function() {
        try {
            const [invRes, tempRes, ordRes, prodRes] = await Promise.all([
                fetch(`${API_BASE_URL}/dashboard/inventory`),
                fetch(`${API_BASE_URL}/dashboard/temperature`),
                fetch(`${API_BASE_URL}/dashboard/orders`),
                fetch(`${API_BASE_URL}/dashboard/production`)
            ]);

            if(invRes.ok) {
                const data = await invRes.json();
                this.updateInventoryTable(data.inventory);
            }
            if(tempRes.ok) {
                const data = await tempRes.json();
                this.updateTemperature(data.temperatura);
            }
            if(ordRes.ok) {
                const data = await ordRes.json();
                this.updateOrders(data.orders);
            }
            if(prodRes.ok) {
                const data = await prodRes.json();
                this.updateProduction(data.production);
            }

        } catch (error) {
            console.error("Error obteniendo datos del dashboard:", error);
        }
    },

    updateTemperature: function(temp) {
        const display = document.getElementById('tempDisplay');
        const status = document.getElementById('tempStatus');
        
        display.textContent = `${temp.toFixed(1)} °C`;
        
        if(temp >= 2.0 && temp <= 5.0) {
            display.className = 'temp-display text-success';
            status.textContent = 'Estado Óptimo - Cadena de frío intacta';
            status.className = 'status-text text-success';
        } else if (temp > 5.0 && temp <= 8.0) {
            display.className = 'temp-display text-warning';
            status.textContent = 'Alerta: Temperatura en ascenso';
            status.className = 'status-text text-warning';
        } else {
            display.className = 'temp-display text-danger';
            status.textContent = 'PELIGRO: Riesgo de inocuidad alimentaria';
            status.className = 'status-text text-danger';
        }
        
        // Actualizar gráfica
        const now = new Date();
        const timeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0') + ':' + String(now.getSeconds()).padStart(2, '0');
        
        this.tempLabels.push(timeStr);
        this.tempData.push(temp);
        
        if(this.tempLabels.length > 20) {
            this.tempLabels.shift();
            this.tempData.shift();
        }
        
        if(this.tempChartInstance) {
            let borderColor = '#3B82F6';
            let bgColor = 'rgba(59, 130, 246, 0.1)';
            const pill = document.getElementById('tempStatusPill');

            if (temp > 5.0 && temp <= 8.0) {
                borderColor = '#F59E0B';
                bgColor = 'rgba(245, 158, 11, 0.1)';
                if(pill) { pill.className = 'status-pill status-warning'; pill.textContent = 'Alerta Térmica'; }
            } else if (temp > 8.0) {
                borderColor = '#EF4444';
                bgColor = 'rgba(239, 68, 68, 0.1)';
                if(pill) { pill.className = 'status-pill status-danger'; pill.textContent = 'Riesgo Crítico'; }
            } else {
                if(pill) { pill.className = 'status-pill status-success'; pill.textContent = 'Sistema Estable'; }
            }
            this.tempChartInstance.data.datasets[0].borderColor = borderColor;
            this.tempChartInstance.data.datasets[0].backgroundColor = bgColor;
            this.tempChartInstance.update();
        }
    },

    updateInventoryTable: function(inventory) {
        const tbody = document.getElementById('inventoryTableBody');
        tbody.innerHTML = '';
        
        inventory.forEach(item => {
            const tr = document.createElement('tr');
            
            let statusClass = 'status-success';
            let statusText = 'Nivel Óptimo';
            
            if(item.cantidad_kg <= item.umbral_minimo) {
                statusClass = 'status-danger';
                statusText = 'Crítico';
            } else if (item.cantidad_kg <= item.umbral_minimo * 1.5) {
                statusClass = 'status-warning';
                statusText = 'Bajo';
            }
            
            const icon = statusClass === 'status-danger' ? 'fa-exclamation-triangle' : (statusClass === 'status-warning' ? 'fa-info-circle' : 'fa-check-circle');

            tr.innerHTML = `
                <td style="text-transform: capitalize; font-weight: 600;">${item.insumo}</td>
                <td><span style="font-weight: 700; font-size: 1.1rem;">${item.cantidad_kg.toFixed(2)}</span> <small>kg</small></td>
                <td>${item.umbral_minimo.toFixed(2)}</td>
                <td><span class="status-pill ${statusClass}"><i class="fas ${icon}"></i> ${statusText}</span></td>
            `;
            tbody.appendChild(tr);
        });

        if(this.invChartInstance) {
            const labels = inventory.map(item => item.insumo.toUpperCase());
            const currentData = inventory.map(item => item.cantidad_kg);
            const thresholdData = inventory.map(item => item.umbral_minimo);
            
            const bgColors = inventory.map(item => {
                if(item.cantidad_kg <= item.umbral_minimo) return 'rgba(255, 71, 87, 0.6)';
                if(item.cantidad_kg <= item.umbral_minimo * 1.5) return 'rgba(255, 165, 2, 0.6)';
                return 'rgba(46, 213, 115, 0.6)';
            });
            const borderColors = inventory.map(item => {
                if(item.cantidad_kg <= item.umbral_minimo) return '#ff4757';
                if(item.cantidad_kg <= item.umbral_minimo * 1.5) return '#ffa502';
                return '#2ed573';
            });

            this.invChartInstance.data.labels = labels;
            this.invChartInstance.data.datasets[0].data = currentData;
            this.invChartInstance.data.datasets[0].backgroundColor = bgColors;
            this.invChartInstance.data.datasets[0].borderColor = borderColors;
            this.invChartInstance.data.datasets[1].data = thresholdData;
            this.invChartInstance.update();
        }
    },

    updateOrders: function(orders) {
        const list = document.getElementById('ordersList');
        list.innerHTML = '';
        
        if(orders.length === 0) {
            list.innerHTML = '<li><span class="text-secondary">No hay pedidos pendientes.</span></li>';
            return;
        }

        orders.forEach(order => {
            const li = document.createElement('li');
            const date = new Date(order.fecha_pedido).toLocaleTimeString();
            li.style.marginBottom = '1rem';
            li.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.02); padding: 0.75rem; border-radius: 8px;">
                    <div>
                        <div style="text-transform: capitalize; font-weight: 700;">${order.insumo}</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted);">${date}</div>
                    </div>
                    <span class="status-pill status-warning">${order.cantidad_solicitada} kg</span>
                </div>
            `;
            list.appendChild(li);
        });
    },

    updateProduction: function(production) {
        const list = document.getElementById('productionList');
        list.innerHTML = '';
        
        if(production.length === 0) {
            list.innerHTML = '<li><span class="text-secondary">Aún no hay producción hoy.</span></li>';
            return;
        }

        production.slice(0, 8).forEach(prod => {
            const date = new Date(prod.timestamp).toLocaleTimeString();
            const div = document.createElement('div');
            div.className = 'glass-panel';
            div.style.padding = '1rem';
            div.style.background = 'white';
            div.innerHTML = `
                <div style="font-weight: 700; color: var(--primary-red);">${prod.nombre_receta}</div>
                <div style="font-size: 0.85rem; margin-top: 0.5rem;">
                    <i class="fas fa-clock"></i> ${date}
                </div>
                <div style="font-size: 0.8rem; color: var(--text-muted); border-top: 1px solid #eee; margin-top: 0.5rem; padding-top: 0.5rem;">
                    ID: ${prod.cocinero_id}
                </div>
            `;
            list.appendChild(div);
        });
    },

    // --- Lógica del Panel del Cocinero ---
    currentRecipeId: null,

    initCookPanel: function() {
        if(!this.checkAuth('cocinero')) return;
        
        // Cargar nombre del usuario
        const user = JSON.parse(localStorage.getItem('user'));
        document.getElementById('cookId').textContent = user.username;

        const btnReq = document.getElementById('btnRequestTask');
        const btnFin = document.getElementById('btnFinishTask');
        
        btnReq.addEventListener('click', () => this.requestRecipe());
        btnFin.addEventListener('click', () => this.finishRecipe());
    },

    requestRecipe: async function() {
        const cookId = document.getElementById('cookId').textContent;
        this.showNotification('Consultando al sistema experto (Prolog)...', 'info');
        
        try {
            const response = await fetch(`${API_BASE_URL}/cook/request_recipe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cocinero_id: cookId })
            });
            
            const data = await response.json();
            
            if(data.status === 'success') {
                this.currentRecipeId = data.recipe.id_receta;
                this.displayRecipe(data.recipe);
                this.hideNotification();
            } else {
                this.showNotification(data.message, 'error');
            }
        } catch (error) {
            this.showNotification('Error de conexión con el backend.', 'error');
        }
    },

    displayRecipe: function(recipe) {
        document.getElementById('requestTaskSection').classList.add('hidden');
        document.getElementById('recipePanel').classList.remove('hidden');
        
        document.getElementById('recipeName').textContent = recipe.nombre;
        
        const list = document.getElementById('recipeIngredientsList');
        list.innerHTML = '';
        
        for (const [ing, qty] of Object.entries(recipe.ingredientes)) {
            const li = document.createElement('li');
            li.className = 'glass-panel';
            li.style.padding = '1rem';
            li.style.display = 'flex';
            li.style.justifyContent = 'space-between';
            li.style.alignItems = 'center';
            li.style.background = 'white';
            li.innerHTML = `
                <span style="text-transform: capitalize; font-weight: 600;"><i class="fas fa-check-circle" style="color: #eee; margin-right: 0.5rem;"></i> ${ing}</span>
                <span class="status-pill status-success" style="background: var(--bg-arctic); font-size: 0.9rem;">${qty} kg</span>
            `;
            list.appendChild(li);
        }
    },

    finishRecipe: async function() {
        if(!this.currentRecipeId) return;
        
        const cookId = document.getElementById('cookId').textContent;
        
        try {
            const response = await fetch(`${API_BASE_URL}/cook/finish_recipe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    cocinero_id: cookId,
                    receta_id: this.currentRecipeId
                })
            });
            
            const data = await response.json();
            
            if(data.status === 'success') {
                document.getElementById('recipePanel').classList.add('hidden');
                document.getElementById('requestTaskSection').classList.remove('hidden');
                this.showNotification('¡Preparación finalizada con éxito! Producción registrada.', 'success');
                this.currentRecipeId = null;
            }
        } catch (error) {
            this.showNotification('Error al finalizar la receta.', 'error');
        }
    },

    showNotification: function(message, type) {
        const div = document.getElementById('notificationArea');
        div.textContent = message;
        div.className = `notification-area notify-${type}`;
        div.classList.remove('hidden');
        
        if(type === 'success' || type === 'error') {
            setTimeout(() => {
                div.classList.add('hidden');
            }, 4000);
        }
    },

    hideNotification: function() {
        document.getElementById('notificationArea').classList.add('hidden');
        const authNotif = document.getElementById('authNotification');
        if(authNotif) authNotif.classList.add('hidden');
    },

    // --- Autenticación ---
    toggleAuthForm: function(type) {
        if(type === 'register') {
            document.getElementById('loginForm').classList.add('hidden');
            document.getElementById('registerForm').classList.remove('hidden');
        } else {
            document.getElementById('registerForm').classList.add('hidden');
            document.getElementById('loginForm').classList.remove('hidden');
        }
    },

    login: async function() {
        const u = document.getElementById('loginUsername').value;
        const p = document.getElementById('loginPassword').value;
        
        try {
            const res = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({username: u, password: p})
            });
            const data = await res.json();
            
            if(res.ok && data.status === 'success') {
                localStorage.setItem('user', JSON.stringify(data.user));
                if(data.user.role === 'chef') window.location.href = 'chef_panel.html';
                else window.location.href = 'cook_panel.html';
            } else {
                this.showAuthNotification(data.detail || 'Error al iniciar sesión', 'error');
            }
        } catch (error) {
            this.showAuthNotification('No se pudo conectar al servidor.', 'error');
        }
    },

    register: async function() {
        const u = document.getElementById('regUsername').value;
        const p = document.getElementById('regPassword').value;
        const r = document.getElementById('regRole').value;
        
        try {
            const res = await fetch(`${API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({username: u, password: p, role: r})
            });
            const data = await res.json();
            
            if(res.ok && data.status === 'success') {
                this.showAuthNotification('Usuario registrado. Ahora inicia sesión.', 'success');
                this.toggleAuthForm('login');
            } else {
                this.showAuthNotification(data.detail || 'Error al registrar', 'error');
            }
        } catch (error) {
            this.showAuthNotification('No se pudo conectar al servidor.', 'error');
        }
    },

    registerCookFromDashboard: async function() {
        const u = document.getElementById('newCookUsername').value;
        const p = document.getElementById('newCookPassword').value;
        
        if(!u || !p) {
            this.showDashboardNotification('Debes llenar ambos campos', 'error');
            return;
        }

        try {
            const res = await fetch(`${API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({username: u, password: p, role: 'cocinero'})
            });
            const data = await res.json();
            
            if(res.ok && data.status === 'success') {
                this.showDashboardNotification('Cocinero registrado correctamente.', 'success');
                document.getElementById('newCookUsername').value = '';
                document.getElementById('newCookPassword').value = '';
            } else {
                this.showDashboardNotification(data.detail || 'Error al registrar', 'error');
            }
        } catch (error) {
            this.showDashboardNotification('Error de conexión.', 'error');
        }
    },

    showDashboardNotification: function(message, type) {
        const div = document.getElementById('dashboardNotification');
        if(div) {
            div.textContent = message;
            div.className = `notification-area notify-${type}`;
            div.classList.remove('hidden');
            setTimeout(() => div.classList.add('hidden'), 4000);
        }
    },

    logout: function() {
        localStorage.removeItem('user');
        window.location.href = 'index.html';
    },

    checkAuth: function(requiredRole) {
        const user = localStorage.getItem('user');
        if(!user) {
            window.location.href = 'index.html';
            return false;
        }
        return true;
    },

    showAuthNotification: function(message, type) {
        const div = document.getElementById('authNotification');
        if(div) {
            div.textContent = message;
            div.className = `notification-area notify-${type}`;
            div.classList.remove('hidden');
            setTimeout(() => div.classList.add('hidden'), 4000);
        }
    }
};
