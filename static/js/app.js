/*
 * NeuraSpend Dynamic Single-Page Client Controller Script
 * Coordinates AJAX queries, tab swappers, CRUD ledger arrays, and chart plotters.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Primary State parameters
    let activeCurrency = '₹';
    let appTheme = localStorage.getItem('neuraspend_theme') || 'Dark';
    let loadedExpenses = [];
    let activeCalendarMonth = new Date().toISOString().split('T')[0].substring(0, 7); // YYYY-MM
    let csrfToken = '';
    
    // Set immediate theme data-theme on body
    document.body.setAttribute('data-theme', appTheme);
    
    // Intercept global fetch to inject CSRF token dynamically
    const originalFetch = window.fetch;
    window.fetch = function(url, options) {
        options = options || {};
        if (options.method && ['POST', 'PUT', 'DELETE'].includes(options.method.toUpperCase())) {
            const isPublic = url.endsWith('/login') || url.endsWith('/register') || url.endsWith('/api/forgot/verify') || url.includes('/api/forgot/question');
            if (!isPublic) {
                options.headers = options.headers || {};
                if (options.headers instanceof Headers) {
                    options.headers.set('X-CSRF-Token', csrfToken);
                } else {
                    options.headers['X-CSRF-Token'] = csrfToken;
                }
            }
        }
        return originalFetch(url, options);
    };
    
    // Emulated Canvas Chart instances
    let chartInstances = {};

    // ----------------------------------------------------------------------
    // 1. DYNAMIC NAVIGATION TAB SWAPPING
    // ----------------------------------------------------------------------
    const navButtons = document.querySelectorAll('.nav-btn');
    const panelSections = document.querySelectorAll('.panel-section');

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            switchTab(targetId);
        });
    });

    function switchTab(targetId) {
        // Swap active sidebar button highlight
        navButtons.forEach(b => {
            if (b.getAttribute('data-target') === targetId) {
                b.classList.add('active');
            } else {
                b.classList.remove('active');
            }
        });
        
        // Swap active viewport card panel
        panelSections.forEach(p => p.classList.remove('active'));
        
        const targetPanel = document.getElementById(targetId);
        if (targetPanel) {
            targetPanel.classList.add('active');
            
            // Refresh specific page records on swap
            if (targetId === 'dashboard-panel') {
                loadDashboardKPIs();
            } else if (targetId === 'transactions-panel') {
                loadTransactionsGrid();
            } else if (targetId === 'budget-panel') {
                loadBudgetPanel();
            } else if (targetId === 'analytics-panel') {
                loadAnalyticsDashboard();
            } else if (targetId === 'goals-panel') {
                loadGoalsGrid();
            } else if (targetId === 'rewards-panel') {
                loadRewardsTab();
            } else if (targetId === 'calendar-panel') {
                renderCalendar();
            } else if (targetId === 'prediction-panel') {
                loadPredictionInsights();
            } else if (targetId === 'backup-panel') {
                loadBackupsList();
            } else if (targetId === 'profile-panel') {
                loadProfileStats();
            } else if (targetId === 'settings-panel') {
                loadSystemSettings();
            } else if (targetId === 'help-panel') {
                loadUserSupportTickets();
            } else if (targetId === 'admin-panel') {
                loadAdminConsole();
            }
        }
    }

    // Logout handling
    const logoutBtn = document.getElementById('logoutBtn');
    logoutBtn.addEventListener('click', async () => {
        const confirm = window.confirm('Are you sure you want to end your current session?');
        if (confirm) {
            try {
                const response = await fetch('/logout', { method: 'POST' });
                const result = await response.json();
                if (result.success) {
                    window.location.href = '/login';
                }
            } catch (err) {
                alert('Connection failure during logout.');
            }
        }
    });

    // ----------------------------------------------------------------------
    // 2. EXECUTIVE CORE DASHBOARD KPIS & CHARTS LOADING
    // ----------------------------------------------------------------------
    async function loadDashboardKPIs() {
        try {
            const response = await fetch('/api/dashboard');
            const data = await response.json();
            
            if (data.success) {
                activeCurrency = data.currency;
                if (data.csrf_token) {
                    csrfToken = data.csrf_token;
                }
                
                // Update Top Greeting details & Avatars
                document.getElementById('topbarGreetingText').textContent = `${getGreeting()}, ${data.user.full_name}`;
                document.getElementById('sessionUser').textContent = `Role: ${data.user.role} | Profile: ${data.user.username}`;
                document.getElementById('topbarAvatarImg').src = data.user.profile_photo;
                
                // Role-based dropdown access controls
                const adminConsoleDropdownBtn = document.getElementById('adminConsoleDropdownBtn');
                if (adminConsoleDropdownBtn) {
                    if (data.role === 'Admin' || data.role === 'Administrator') {
                        adminConsoleDropdownBtn.classList.remove('hide');
                    } else {
                        adminConsoleDropdownBtn.classList.add('hide');
                    }
                }
                
                // Update Welcome Banner elements
                const welcomeUserName = document.getElementById('welcomeUserName');
                if (welcomeUserName) welcomeUserName.textContent = data.user.full_name;
                
                const welcomeTotalBudget = document.getElementById('welcomeTotalBudget');
                if (welcomeTotalBudget) welcomeTotalBudget.textContent = `${activeCurrency}${data.budget.monthly_limit.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
                
                const welcomeCurrentSpend = document.getElementById('welcomeCurrentSpend');
                if (welcomeCurrentSpend) welcomeCurrentSpend.textContent = `${activeCurrency}${data.total_month.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
                
                const welcomeSavingsAmount = document.getElementById('welcomeSavingsAmount');
                if (welcomeSavingsAmount) {
                    const remaining = Math.max(0, data.budget.monthly_limit - data.total_month);
                    welcomeSavingsAmount.textContent = `${activeCurrency}${remaining.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
                }
                
                const welcomeMotivationalMsg = document.getElementById('welcomeMotivationalMsg');
                if (welcomeMotivationalMsg) {
                    if (data.total_month > data.budget.monthly_limit) {
                        welcomeMotivationalMsg.textContent = "⚠️ You have exceeded your monthly budget. Reduce shopping and entertainment spending!";
                        welcomeMotivationalMsg.style.color = "#ff453a";
                    } else if (data.total_month >= data.budget.warning_limit) {
                        welcomeMotivationalMsg.textContent = "⚠️ Warning: You are near your monthly budget threshold. Spend cautiously!";
                        welcomeMotivationalMsg.style.color = "#ff9f0a";
                    } else {
                        welcomeMotivationalMsg.textContent = "✓ Great job managing expenses. You are within budget this month. Savings are growing steadily!";
                        welcomeMotivationalMsg.style.color = "#30d158";
                    }
                }
                
                // Role-based sidebar access controls (Feature 14)
                const adminNavBtn = document.getElementById('adminNavBtn');
                if (data.role === 'Admin' || data.role === 'Administrator') {
                    adminNavBtn.classList.remove('hide');
                } else {
                    adminNavBtn.classList.add('hide');
                }

                // Update Top Warning Budget Pill banner
                updateTopBudgetBanner(data.budget, data.total_month);
                
                // Populate numerical KPI values with counting animations (Feature 17)
                animateCounter('statTotalAll', data.metrics.total_all, true);
                animateCounter('statTotalMonth', data.metrics.total_month, true);
                animateCounter('statTotalToday', data.metrics.today_spend, true);
                animateCounter('statMaxExpense', data.metrics.max_expense, true);
                animateCounter('statAvgExpense', data.metrics.avg_expense, true);
                animateCounter('statRemainingBudget', data.metrics.remaining_budget, true);
                animateCounter('statHealthScore', data.metrics.health_score, false);
                animateCounter('statRewardWallet', data.metrics.total_rewards, true);
                animateCounter('statSavingsBalance', data.metrics.savings_balance, true);
                animateCounter('statGoalsCompleted', data.metrics.completed_goals, false);
                animateCounter('statActiveGoals', data.metrics.active_goals, false);
                animateCounter('statTransactionCount', data.metrics.transaction_count, false);

                // Update circular CSS financial Health Gauge Needle
                updateFinancialHealthGauge(data.metrics.health_score, data.predictor.health_rating);

                // Setup insight rotate carousel
                setupInsightCarousel(data.metrics.total_month, data.metrics.remaining_budget, data.predictor.predicted_next_month);

                // Populate recent Activity audits logs feed
                populateActivityTimeline(data.expenses);

                // Refresh mini dashboard outflow trend chart (last 7 days spends)
                renderMiniOverviewCharts(data.expenses);
            }
        } catch (err) {
            console.error('KPIs load failure:', err);
        }
    }

    // Mathematical count up counters ticker animation
    function animateCounter(id, finalVal, isCurrency) {
        const el = document.getElementById(id);
        if (!el) return;
        
        let start = 0;
        const duration = 800; // ms
        const steps = 30;
        const stepVal = finalVal / steps;
        const stepTime = duration / steps;
        
        let timer = setInterval(() => {
            start += stepVal;
            if (start >= finalVal) {
                start = finalVal;
                clearInterval(timer);
            }
            el.textContent = isCurrency ? `${activeCurrency}${start.toFixed(2)}` : start.toFixed(0);
        }, stepTime);
    }

    // Dynamic hour greeting logic
    function getGreeting() {
        const hour = new Date().getHours();
        if (hour < 6) return 'Good Night';
        if (hour < 12) return 'Good Morning';
        if (hour < 17) return 'Good Afternoon';
        return 'Good Evening';
    }

    // Circular health score meter needle vector updates
    function updateFinancialHealthGauge(score, rating) {
        const scoreVal = document.getElementById('gaugeScoreValue');
        const scoreRating = document.getElementById('gaugeRatingText');
        const needle = document.getElementById('healthGaugeNeedle');

        // Circular needle rotates from -90deg (0 score) to +90deg (100 score)
        const angle = -90 + (score * 1.8);
        needle.style.transform = `rotate(${angle}deg)`;
        
        // Count up score value text
        let count = 0;
        let timer = setInterval(() => {
            if (count >= score) {
                scoreVal.textContent = score;
                clearInterval(timer);
            } else {
                count++;
                scoreVal.textContent = count;
            }
        }, 10);

        scoreRating.textContent = rating;
        scoreRating.className = ''; // Reset
        if (score >= 85) scoreRating.classList.add('text-success');
        else if (score >= 70) scoreRating.classList.add('text-primary');
        else if (score >= 50) scoreRating.classList.add('text-warning');
        else scoreRating.classList.add('text-danger');
    }

    // Dynamic rotating carousel panels list
    function setupInsightCarousel(monthlySpend, budgetLeft, forecastNext) {
        const track = document.getElementById('carouselTrack');
        if (!track) return;

        const slides = [
            `⭐ <strong>Financial Tip:</strong> Keep your monthly qualitative score above 80 points to claim Silver Wallet Reward credit multipliers!`,
            `📊 <strong>Budget Status:</strong> You have spent <strong>${activeCurrency}${monthlySpend.toFixed(2)}</strong> this month. Remaining safe buffer: <strong>${activeCurrency}${budgetLeft.toFixed(2)}</strong>.`,
            `🔮 <strong>Spend Projections:</strong> Based on moving average vectors, you are forecast to spend <strong>${activeCurrency}${forecastNext.toFixed(2)}</strong> next month.`,
            `🚀 <strong>Smart Savings:</strong> Simulated 2% credit reward credit credits are unlocked automatically at month-end based on budget savings!`
        ];

        track.innerHTML = `<div class="carousel-slide">${slides[0]}</div>`;
        let slideIdx = 0;
        
        // Set recurring slider intervals
        if (window.carouselTimer) clearInterval(window.carouselTimer);
        window.carouselTimer = setInterval(() => {
            slideIdx = (slideIdx + 1) % slides.length;
            track.style.opacity = 0;
            setTimeout(() => {
                track.innerHTML = `<div class="carousel-slide">${slides[slideIdx]}</div>`;
                track.style.opacity = 1;
            }, 300);
        }, 6000);
    }

    // Recent activity feed timeline population
    function populateActivityTimeline(expenses) {
        const feed = document.getElementById('activityFeedList');
        if (!feed) return;

        feed.innerHTML = '';
        const limit = expenses.slice(0, 5); // Latest 5 items

        if (limit.length === 0) {
            feed.innerHTML = `<div style="text-align:center; color:var(--fg-muted); padding:20px; font-size:11px;">No transactions logged yet.</div>`;
            return;
        }

        limit.forEach(exp => {
            const item = document.createElement('div');
            item.className = 'activity-feed-item';
            
            let icon = '💸';
            if (exp.category === 'Food & Dining') icon = '🍔';
            else if (exp.category === 'Electronics & Gadgets') icon = '💻';
            else if (exp.category === 'Travel & Transport') icon = '🚗';
            else if (exp.category === 'Entertainment') icon = '🎬';

            item.innerHTML = `
                <span class="activity-icon">${icon}</span>
                <div class="activity-details">
                    <span>Logged outflow <strong>${activeCurrency}${parseFloat(exp.amount).toFixed(2)}</strong> for "${exp.title}"</span>
                    <span class="activity-time">${exp.transaction_date}</span>
                </div>
            `;
            feed.appendChild(item);
        });
    }

    function updateTopBudgetBanner(budget, totalSpent) {
        const banner = document.getElementById('budgetBanner');
        const text = document.getElementById('budgetBannerText');
        
        banner.className = 'budget-banner'; // reset styles
        
        const limit = parseFloat(budget.monthly_limit);
        const warn = parseFloat(budget.warning_limit);
        
        if (limit <= 0) {
            banner.classList.add('bg-success');
            text.textContent = 'No active monthly budget target set.';
            return;
        }

        const remaining = limit - totalSpent;
        const usagePct = (totalSpent / limit) * 100;

        // Build notification warnings queue dynamically (Feature 17)
        if (totalSpent > limit) {
            banner.classList.add('bg-danger');
            text.textContent = `⚠️ CRITICAL: Exceeded by ${activeCurrency}${Math.abs(remaining).toFixed(2)} (${usagePct.toFixed(1)}%)`;
            addSystemNotification('budget_exceeded', 'CRITICAL LIMIT EXCEEDED', `Your monthly spending has exceeded the budget by ${activeCurrency}${Math.abs(remaining).toFixed(2)}!`);
        } else if (totalSpent >= warn) {
            banner.classList.add('bg-warning');
            text.textContent = `⚠️ WARNING: Near Limit. ${activeCurrency}${remaining.toFixed(2)} left (${usagePct.toFixed(1)}%)`;
            addSystemNotification('budget_warning', 'BUDGET ALERT WARNING', `You are near your monthly warning threshold. Remaining: ${activeCurrency}${remaining.toFixed(2)}.`);
        } else {
            banner.classList.add('bg-success');
            text.textContent = `✓ Healthy: ${activeCurrency}${remaining.toFixed(2)} left (${usagePct.toFixed(1)}%)`;
        }
    }

    let currentMiniChartType = 'line';

    function renderMiniOverviewCharts(expenses) {
        // Group last 7 days outflow spends
        const dailySpend = {};
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            dailySpend[dateStr] = 0;
        }

        expenses.forEach(e => {
            if (dailySpend[e.transaction_date] !== undefined) {
                dailySpend[e.transaction_date] += parseFloat(e.amount);
            }
        });

        const sortedDates = Object.keys(dailySpend);
        const dailyTotals = sortedDates.map(d => dailySpend[d]);

        const ctxArea = document.getElementById('chartMiniArea');
        if (chartInstances['miniArea']) {
            chartInstances['miniArea'].config.type = currentMiniChartType;
            chartInstances['miniArea'].config.data.labels = sortedDates;
            chartInstances['miniArea'].config.data.datasets[0].data = dailyTotals;
            chartInstances['miniArea'].update();
        } else {
            chartInstances['miniArea'] = new Chart(ctxArea, {
                type: currentMiniChartType,
                data: {
                    labels: sortedDates,
                    datasets: [{
                        data: dailyTotals,
                        borderColor: '#30d158',
                        backgroundColor: 'rgba(48, 209, 88, 0.1)',
                        fill: true
                    }]
                }
            });
        }
    }

    // Bind Line/Bar chart toggles dynamically
    const btnTypeLine = document.getElementById('btnChartTypeLine');
    const btnTypeBar = document.getElementById('btnChartTypeBar');
    if (btnTypeLine && btnTypeBar) {
        btnTypeLine.addEventListener('click', () => {
            if (currentMiniChartType === 'line') return;
            currentMiniChartType = 'line';
            btnTypeLine.classList.add('active');
            btnTypeBar.classList.remove('active');
            if (chartInstances['miniArea']) {
                chartInstances['miniArea'].config.type = 'line';
                chartInstances['miniArea'].update();
            }
        });

        btnTypeBar.addEventListener('click', () => {
            if (currentMiniChartType === 'bar') return;
            currentMiniChartType = 'bar';
            btnTypeBar.classList.add('active');
            btnTypeLine.classList.remove('active');
            if (chartInstances['miniArea']) {
                chartInstances['miniArea'].config.type = 'bar';
                chartInstances['miniArea'].update();
            }
        });
    }

    // ----------------------------------------------------------------------
    // 3. SYSTEM NOTIFICATIONS CENTER
    // ----------------------------------------------------------------------
    const btnBell = document.getElementById('btnBellNotification');
    const dropdownNotifications = document.getElementById('notificationDropdown');
    const notificationList = document.getElementById('notificationList');
    const bellBadgeCount = document.getElementById('bellBadgeCount');
    let activeNotificationsList = [];

    btnBell.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownNotifications.classList.toggle('hide');
    });

    document.addEventListener('click', () => {
        dropdownNotifications.classList.add('hide');
    });

    dropdownNotifications.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    function addSystemNotification(id, title, desc) {
        // Check if duplicate alert is already queued
        if (activeNotificationsList.some(n => n.id === id)) return;
        
        activeNotificationsList.push({ id, title, desc, read: false });
        renderNotificationsDropdown();
    }

    function renderNotificationsDropdown() {
        const unreadCount = activeNotificationsList.filter(n => !n.read).length;
        if (unreadCount > 0) {
            bellBadgeCount.classList.remove('hide');
            bellBadgeCount.textContent = unreadCount;
        } else {
            bellBadgeCount.classList.add('hide');
        }

        notificationList.innerHTML = '';
        if (activeNotificationsList.length === 0) {
            notificationList.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--fg-muted); font-size: 11px;">No alerts logged yet.</div>`;
            return;
        }

        activeNotificationsList.forEach(n => {
            const item = document.createElement('div');
            item.className = `notification-item ${n.read ? '' : 'unread'}`;
            item.innerHTML = `
                <strong style="font-size:10px; color:${n.read ? 'var(--fg-muted)' : 'var(--primary)'}">${n.title}</strong>
                <span style="font-size:11px; line-height:1.3;">${n.desc}</span>
            `;
            item.addEventListener('click', () => {
                n.read = true;
                renderNotificationsDropdown();
            });
            notificationList.appendChild(item);
        });
    }

    document.getElementById('btnMarkAllRead').addEventListener('click', () => {
        activeNotificationsList.forEach(n => n.read = true);
        renderNotificationsDropdown();
    });

    // ----------------------------------------------------------------------
    // 4. ADD TRANSACTION FORM & NLP TEXT PARSER
    // ----------------------------------------------------------------------
    const addExpenseForm = document.getElementById('addExpenseForm');
    const expDateInput = document.getElementById('expDate');
    
    expDateInput.value = new Date().toISOString().split('T')[0];

    addExpenseForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const title = document.getElementById('expTitle').value.trim();
        const description = document.getElementById('expDescription').value.trim();
        const amount = parseFloat(document.getElementById('expAmount').value);
        const category = document.getElementById('expCategory').value;
        const payment_method = document.getElementById('expPaymentMethod').value;
        const transaction_date = expDateInput.value;
        const attachment = document.getElementById('expAttachment').files[0];

        if (!title || isNaN(amount) || amount <= 0 || !transaction_date) {
            alert('Please check input fields constraints. Amount must be positive.');
            return;
        }

        const formData = new FormData();
        formData.append('title', title);
        formData.append('description', description);
        formData.append('amount', amount);
        formData.append('category', category);
        formData.append('payment_method', payment_method);
        formData.append('transaction_date', transaction_date);
        if (attachment) {
            formData.append('attachment', attachment);
        }

        try {
            const response = await fetch('/api/expenses', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            if (result.success) {
                alert('Transaction committed successfully.');
                addExpenseForm.reset();
                expDateInput.value = new Date().toISOString().split('T')[0];
                loadDashboardKPIs();
            } else {
                alert(`Error: ${result.message}`);
            }
        } catch (err) {
            alert('Failed to connect to databases server.');
        }
    });

    // Deterministic Regex parsing assistant trigger
    const nlpParseBtn = document.getElementById('nlpParseBtn');
    nlpParseBtn.addEventListener('click', async () => {
        const text = document.getElementById('nlpInputText').value.trim();
        if (!text) {
            alert('Please enter descriptive transaction words first.');
            return;
        }

        try {
            const response = await fetch('/api/parser', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `text=${encodeURIComponent(text)}`
            });
            const result = await response.json();

            if (result.success) {
                const parsed = result.data;
                
                document.getElementById('expTitle').value = parsed.title;
                document.getElementById('expDescription').value = `Automatically parsed from: "${text}"`;
                if (parsed.amount > 0) {
                    document.getElementById('expAmount').value = parsed.amount;
                }
                document.getElementById('expCategory').value = parsed.category;
                
                alert(`Isolate values matches:\n • Title: ${parsed.title}\n • Category: ${parsed.category}\n • Amount: ${parsed.amount}`);
            }
        } catch (err) {
            alert('NLP parser connection failure.');
        }
    });

    // ----------------------------------------------------------------------
    // 5. SEARCHABLE LEDGER GRID (CRUD, SORT & FILTER & BULK OPERATIONS)
    // ----------------------------------------------------------------------
    const ledgerTableBody = document.getElementById('ledgerTableBody');
    const ledgerSearch = document.getElementById('ledgerSearch');
    const filterCategory = document.getElementById('filterCategory');
    const filterPayment = document.getElementById('filterPayment');
    const filterStartDate = document.getElementById('filterStartDate');
    const filterEndDate = document.getElementById('filterEndDate');
    
    const selectAllLedger = document.getElementById('selectAllLedger');
    const btnBulkDelete = document.getElementById('btnBulkDelete');

    async function loadTransactionsGrid() {
        try {
            const response = await fetch('/api/dashboard');
            const data = await response.json();
            
            if (data.success) {
                loadedExpenses = data.expenses;
                renderLedgerRows(loadedExpenses);
            }
        } catch (err) {
            console.error('Ledger loading failure:', err);
        }
    }

    function renderLedgerRows(expenses) {
        ledgerTableBody.innerHTML = '';
        
        const filterVal = ledgerSearch.value.trim().toLowerCase();
        const catVal = filterCategory.value;
        const payVal = filterPayment.value;
        const sDate = filterStartDate.value;
        const eDate = filterEndDate.value;

        expenses.forEach(exp => {
            // Apply Advanced filters (Feature 18)
            const matchSearch = !filterVal || 
                exp.id.toString().includes(filterVal) ||
                exp.title.toLowerCase().includes(filterVal) ||
                (exp.description || '').toLowerCase().includes(filterVal) ||
                exp.amount.toString().includes(filterVal);

            const matchCat = (catVal === 'All') || (exp.category === catVal);
            const matchPay = (payVal === 'All') || (exp.payment_method === payVal);
            const matchStart = !sDate || (exp.transaction_date >= sDate);
            const matchEnd = !eDate || (exp.transaction_date <= eDate);

            if (matchSearch && matchCat && matchPay && matchStart && matchEnd) {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="text-align: center;"><input type="checkbox" class="row-selector" data-id="${exp.id}"></td>
                    <td style="text-align: center;">${exp.id}</td>
                    <td>${exp.transaction_date}</td>
                    <td>
                        <strong>${exp.title}</strong>
                        ${exp.description ? `<br><small style="color: var(--fg-muted)">${exp.description}</small>` : ''}
                        ${exp.attachment_path ? `<br><a href="${exp.attachment_path}" target="_blank" style="font-size:9px; color:var(--primary); text-decoration:none;">📎 Preview Attachment</a>` : ''}
                    </td>
                    <td>${exp.category}</td>
                    <td>${exp.payment_method}</td>
                    <td style="text-align: right; font-weight: 700; color: var(--primary)">${activeCurrency}${parseFloat(exp.amount).toFixed(2)}</td>
                    <td style="text-align: center;">
                        <button class="table-btn btn-duplicate" data-id="${exp.id}" style="color:var(--success);">Copy</button>
                        <button class="table-btn table-btn-edit" data-id="${exp.id}">Edit</button>
                        <button class="table-btn table-btn-delete" data-id="${exp.id}">Delete</button>
                    </td>
                `;
                
                // Action hooks
                tr.querySelector('.btn-duplicate').addEventListener('click', () => duplicateLedgerRow(exp.id));
                tr.querySelector('.table-btn-edit').addEventListener('click', () => openEditModal(exp));
                tr.querySelector('.table-btn-delete').addEventListener('click', () => deleteLedgerRow(exp.id, exp.title));
                tr.querySelector('.row-selector').addEventListener('change', checkBulkSelectionStatus);

                ledgerTableBody.appendChild(tr);
            }
        });

        if (ledgerTableBody.innerHTML === '') {
            ledgerTableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--fg-muted)">No matching transactions found.</td></tr>`;
        }
        
        selectAllLedger.checked = false;
        checkBulkSelectionStatus();
    }

    // Ledger triggers filters updates
    [ledgerSearch, filterCategory, filterPayment, filterStartDate, filterEndDate].forEach(el => {
        el.addEventListener('input', () => renderLedgerRows(loadedExpenses));
        el.addEventListener('change', () => renderLedgerRows(loadedExpenses));
    });

    // Checkboxes selection status
    selectAllLedger.addEventListener('change', () => {
        const checked = selectAllLedger.checked;
        document.querySelectorAll('.row-selector').forEach(cb => cb.checked = checked);
        checkBulkSelectionStatus();
    });

    function checkBulkSelectionStatus() {
        const checkedRows = document.querySelectorAll('.row-selector:checked');
        btnBulkDelete.disabled = checkedRows.length === 0;
        if (checkedRows.length > 0) {
            btnBulkDelete.textContent = `Bulk Delete Selection (${checkedRows.length})`;
        } else {
            btnBulkDelete.textContent = `Bulk Delete Selection`;
        }
    }

    // Bulk Delete operation (Feature 18)
    btnBulkDelete.addEventListener('click', async () => {
        const checkedRows = document.querySelectorAll('.row-selector:checked');
        const ids = Array.from(checkedRows).map(cb => cb.getAttribute('data-id'));
        
        const confirm = window.confirm(`Are you absolutely sure you want to bulk delete ${ids.length} transactions?`);
        if (!confirm) return;

        try {
            const response = await fetch('/api/expenses/bulk_delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `ids=${ids.join(',')}`
            });

            const result = await response.json();
            if (result.success) {
                alert(`Purged ${result.count} selected transactions successfully.`);
                loadTransactionsGrid();
            } else {
                alert(`Bulk delete failed: ${result.message}`);
            }
        } catch (err) {
            alert('Failed to connect to bulk delete endpoint.');
        }
    });

    // Duplicate Action (Feature 18)
    async function duplicateLedgerRow(id) {
        try {
            const response = await fetch('/api/expenses/duplicate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `id=${id}`
            });
            const result = await response.json();
            if (result.success) {
                loadTransactionsGrid();
            } else {
                alert(`Duplication failed: ${result.message}`);
            }
        } catch (err) {
            alert('Duplication endpoint error.');
        }
    }

    // Bulk CSV parsing and uploads (Feature 18)
    const bulkCsvForm = document.getElementById('bulkCsvForm');
    bulkCsvForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const file = document.getElementById('bulkCsvFile').files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('csv_file', file);

        try {
            const response = await fetch('/api/expenses/bulk_import', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            if (result.success) {
                alert(`Successfully parsed and imported ${result.count} transactions!`);
                bulkCsvForm.reset();
                loadTransactionsGrid();
            } else {
                alert(`CSV parse error: ${result.message}`);
            }
        } catch (err) {
            alert('Bulk import connection failed.');
        }
    });

    async function deleteLedgerRow(id, title) {
        const confirm = window.confirm(`Are you sure you want to permanently delete transaction row #${id}: "${title}"?`);
        if (!confirm) return;

        try {
            const response = await fetch(`/api/expenses?id=${id}`, { method: 'DELETE' });
            const result = await response.json();
            
            if (result.success) {
                alert('Ledger row deleted successfully.');
                loadTransactionsGrid();
            } else {
                alert(`Error: ${result.message}`);
            }
        } catch (err) {
            alert('Failed to connect to delete endpoint.');
        }
    }

    // ----------------------------------------------------------------------
    // 6. UPDATE TRANSACTION EDIT MODALS
    // ----------------------------------------------------------------------
    const editModal = document.getElementById('editExpenseModal');
    const closeModalBtn = document.getElementById('btnCloseEditModal');
    const editExpenseForm = document.getElementById('editExpenseForm');

    function openEditModal(exp) {
        document.getElementById('editExpId').value = exp.id;
        document.getElementById('editExpTitle').value = exp.title;
        document.getElementById('editExpDescription').value = exp.description || '';
        document.getElementById('editExpAmount').value = exp.amount;
        document.getElementById('editExpCategory').value = exp.category;
        document.getElementById('editExpPaymentMethod').value = exp.payment_method;
        document.getElementById('editExpDate').value = exp.transaction_date;

        editModal.classList.remove('hidden');
    }

    closeModalBtn.addEventListener('click', () => {
        editModal.classList.add('hidden');
    });

    editExpenseForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const id = document.getElementById('editExpId').value;
        const title = document.getElementById('editExpTitle').value.trim();
        const description = document.getElementById('editExpDescription').value.trim();
        const amount = parseFloat(document.getElementById('editExpAmount').value);
        const category = document.getElementById('editExpCategory').value;
        const payment_method = document.getElementById('editExpPaymentMethod').value;
        const transaction_date = document.getElementById('editExpDate').value;

        if (!title || isNaN(amount) || amount <= 0 || !transaction_date) {
            alert('All form entries must follow validation bounds.');
            return;
        }

        try {
            const response = await fetch('/api/expenses', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `id=${id}&title=${encodeURIComponent(title)}&description=${encodeURIComponent(description)}&amount=${amount}&category=${encodeURIComponent(category)}&payment_method=${encodeURIComponent(payment_method)}&transaction_date=${transaction_date}`
            });

            const result = await response.json();
            if (result.success) {
                alert('Ledger row modified successfully.');
                editModal.classList.add('hidden');
                loadTransactionsGrid();
            } else {
                alert(`Error: ${result.message}`);
            }
        } catch (err) {
            alert('Failed to connect to server update route.');
        }
    });

    // ----------------------------------------------------------------------
    // 7. SAVINGS GOALS PANELS (Feature 4)
    // ----------------------------------------------------------------------
    const btnOpenGoal = document.getElementById('btnOpenGoalModal');
    const goalModal = document.getElementById('addGoalModal');
    const closeGoalModalBtn = document.getElementById('btnCloseGoalModal');
    const addGoalForm = document.getElementById('addGoalForm');
    const goalsCardsGrid = document.getElementById('goalsCardsGrid');

    btnOpenGoal.addEventListener('click', () => {
        goalModal.classList.remove('hidden');
    });

    closeGoalModalBtn.addEventListener('click', () => {
        goalModal.classList.add('hidden');
    });

    addGoalForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('goalTitle').value.trim();
        const target = parseFloat(document.getElementById('goalTarget').value);
        const saved = parseFloat(document.getElementById('goalSaved').value);

        if (!title || isNaN(target) || target <= 0) {
            alert('Valid target values required.');
            return;
        }

        try {
            const response = await fetch('/api/goals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `title=${encodeURIComponent(title)}&target=${target}&saved=${saved}`
            });

            const result = await response.json();
            if (result.success) {
                alert('Savings Goal target committed successfully.');
                addGoalForm.reset();
                goalModal.classList.add('hidden');
                loadGoalsGrid();
            }
        } catch (err) {
            alert('Failed to create savings goal.');
        }
    });

    async function loadGoalsGrid() {
        try {
            const response = await fetch('/api/dashboard');
            const data = await response.json();
            
            if (data.success) {
                goalsCardsGrid.innerHTML = '';
                
                if (data.goals.length === 0) {
                    goalsCardsGrid.innerHTML = `<div style="grid-column: span 3; text-align:center; color:var(--fg-muted); padding:30px; font-size:12px;">No active savings goals set. Create one!</div>`;
                    return;
                }

                data.goals.forEach(g => {
                    const saved = parseFloat(g.saved);
                    const target = parseFloat(g.target);
                    const pct = Math.min(100, (saved / target) * 100);
                    
                    // Trigger alert if completed (Feature 17)
                    if (saved >= target) {
                        addSystemNotification(`goal_${g.id}`, 'SAVINGS GOAL COMPLETED', `Congratulations! You reached your savings target for: "${g.title}"!`);
                    }

                    const card = document.createElement('div');
                    card.className = 'card card-padding hover-scale';
                    card.innerHTML = `
                        <div class="goal-card-header">
                            <h3 style="font-size:13px; font-weight:700;">${g.title}</h3>
                            <div class="goal-actions">
                                <button class="goal-btn-delete" data-id="${g.id}">🗑</button>
                            </div>
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--fg-body); margin-top:8px;">
                            <span>Progress: <strong>${pct.toFixed(0)}%</strong></span>
                            <span>${activeCurrency}${saved.toFixed(0)} / ${activeCurrency}${target.toFixed(0)}</span>
                        </div>
                        <div class="goal-progress-bar-container">
                            <div class="goal-progress-bar" style="width: ${pct}%"></div>
                        </div>
                    `;
                    
                    card.querySelector('.goal-btn-delete').addEventListener('click', () => deleteSavingsGoal(g.id));
                    goalsCardsGrid.appendChild(card);
                });
            }
        } catch (err) {
            console.error('Goals load failed:', err);
        }
    }

    async function deleteSavingsGoal(id) {
        const confirm = window.confirm('Delete this savings goal?');
        if (!confirm) return;

        try {
            const response = await fetch(`/api/goals?id=${id}`, { method: 'DELETE' });
            const result = await response.json();
            if (result.success) {
                loadGoalsGrid();
            }
        } catch (err) {
            alert('Failed to delete goal.');
        }
    }

    // ----------------------------------------------------------------------
    // 8. SIMULATED REWARDS & ACHIEVEMENT BADGES (Feature 9)
    // ----------------------------------------------------------------------
    const rewardsTotalWallet = document.getElementById('rewardsTotalWallet');
    const rewardsSaverLevelText = document.getElementById('rewardsSaverLevelText');
    const achievementsGrid = document.getElementById('achievementsBadgesGrid');
    const btnClaimReward = document.getElementById('btnClaimRewardSim');

    async function loadRewardsTab() {
        try {
            const response = await fetch('/api/dashboard');
            const data = await response.json();
            
            if (data.success) {
                rewardsTotalWallet.textContent = `${activeCurrency}${data.metrics.total_rewards.toFixed(2)}`;
                rewardsSaverLevelText.textContent = data.metrics.saver_level;

                // Render achievements badges (Feature 9 badges panel)
                achievementsGrid.innerHTML = '';
                data.achievements.forEach(ach => {
                    const card = document.createElement('div');
                    card.className = `badge-card ${ach.unlocked ? 'unlocked' : ''}`;
                    
                    let icon = '🔒';
                    if (ach.id === 'badge_first_savings') icon = '🐷';
                    else if (ach.id === 'badge_budget_master') icon = '👑';
                    else if (ach.id === 'badge_goal_achiever') icon = '🎯';
                    else if (ach.id === 'badge_financial_champion') icon = '🏆';
                    else if (ach.id === 'badge_streak_master') icon = '🔥';

                    card.innerHTML = `
                        <span class="badge-icon">${ach.unlocked ? icon : '🔒'}</span>
                        <span class="badge-title">${ach.title}</span>
                        <span class="badge-desc">${ach.desc}</span>
                    `;
                    achievementsGrid.appendChild(card);
                });
            }
        } catch (err) {
            console.error('Rewards load failed:', err);
        }
    }

    btnClaimReward.addEventListener('click', async () => {
        const month = document.getElementById('rewardSimMonth').value;
        try {
            const response = await fetch('/api/rewards/credit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `month=${month}`
            });

            const result = await response.json();
            if (result.success) {
                alert(`✓ Simulated savings reward claimed successfully! Credited: ${activeCurrency}${result.reward_amount.toFixed(2)} to your wallet.`);
                loadRewardsTab();
                addSystemNotification('reward_credited', 'REWARD WALLET CREDITED', `Credited simulated reward of ${activeCurrency}${result.reward_amount.toFixed(2)} based on your monthly savings!`);
            } else {
                alert(`Reward claim failed: ${result.message}`);
            }
        } catch (err) {
            alert('Failed to simulate reward claim.');
        }
    });

    // ----------------------------------------------------------------------
    // 9. OPTICAL RECEIPT OCR SCANNER (Feature 6)
    // ----------------------------------------------------------------------
    const dropzone = document.getElementById('ocrDropzone');
    const ocrInputFile = document.getElementById('ocrInputFile');
    const previewContainer = document.getElementById('ocrImagePreviewContainer');
    const previewImg = document.getElementById('ocrPreviewImg');
    const runOcrBtn = document.getElementById('btnRunOcrScan');
    const resultsCard = document.getElementById('ocrResultsCard');
    const resultsList = document.getElementById('ocrResultsList');
    const autofillBtn = document.getElementById('btnOcrAutofill');

    let scannedDataCache = null;

    dropzone.addEventListener('click', () => ocrInputFile.click());
    
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--primary)';
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.style.borderColor = 'var(--border-color)';
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--border-color)';
        const file = e.dataTransfer.files[0];
        if (file) {
            ocrInputFile.files = e.dataTransfer.files;
            handleOcrFileSelected(file);
        }
    });

    ocrInputFile.addEventListener('change', () => {
        const file = ocrInputFile.files[0];
        if (file) handleOcrFileSelected(file);
    });

    function handleOcrFileSelected(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            previewImg.src = e.target.result;
            previewContainer.classList.remove('hide');
            resultsCard.style.display = 'none';
        };
        reader.readAsDataURL(file);
    }

    runOcrBtn.addEventListener('click', async () => {
        const file = ocrInputFile.files[0];
        if (!file) return;

        runOcrBtn.disabled = true;
        runOcrBtn.textContent = 'ANALYZING RECEIPT CHARACTERS...';

        const formData = new FormData();
        formData.append('receipt_image', file);

        try {
            const response = await fetch('/api/ocr', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            runOcrBtn.disabled = false;
            runOcrBtn.textContent = '🔍 Start OCR Scan Analysis';

            if (result.success) {
                scannedDataCache = result.data;
                resultsCard.style.display = 'block';
                resultsList.innerHTML = `
                    <li><strong>Detected Merchant:</strong> ${scannedDataCache.merchant}</li>
                    <li><strong>Detected Total amount:</strong> ${activeCurrency}${scannedDataCache.amount.toFixed(2)}</li>
                    <li><strong>Raw character counts:</strong> ${scannedDataCache.text.length} characters parsed</li>
                `;
            } else {
                alert(`OCR parsing failed: ${result.message}`);
            }
        } catch (err) {
            alert('Receipt scanning crashed.');
            runOcrBtn.disabled = false;
            runOcrBtn.textContent = '🔍 Start OCR Scan Analysis';
        }
    });

    autofillBtn.addEventListener('click', () => {
        if (!scannedDataCache) return;
        
        switchTab('add-expense-panel');
        document.getElementById('expTitle').value = scannedDataCache.merchant !== 'N/A' ? scannedDataCache.merchant : 'Receipt Outflow';
        document.getElementById('expAmount').value = scannedDataCache.amount > 0 ? scannedDataCache.amount : '';
        document.getElementById('expDescription').value = `OCR Scanned Receipt Bill. Merchant: ${scannedDataCache.merchant}`;
    });

    // ----------------------------------------------------------------------
    // 10. INTERACTIVE MONTHLY CALENDAR GRID (Feature 9)
    // ----------------------------------------------------------------------
    const calendarDaysGrid = document.getElementById('calendarDaysGrid');
    const calendarMonthLabel = document.getElementById('calendarMonthLabel');

    document.getElementById('btnPrevMonth').addEventListener('click', () => shiftCalendarMonth(-1));
    document.getElementById('btnNextMonth').addEventListener('click', () => shiftCalendarMonth(1));

    function shiftCalendarMonth(offset) {
        const parts = activeCalendarMonth.split('-');
        let year = parseInt(parts[0]);
        let month = parseInt(parts[1]) - 1; // 0-based

        const d = new Date(year, month + offset, 1);
        activeCalendarMonth = d.toISOString().split('T')[0].substring(0, 7);
        renderCalendar();
    }

    async function renderCalendar() {
        calendarDaysGrid.innerHTML = '';
        const parts = activeCalendarMonth.split('-');
        const year = parseInt(parts[0]);
        const monthIdx = parseInt(parts[1]) - 1;

        const monthsNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        calendarMonthLabel.textContent = `${monthsNames[monthIdx]} ${year}`;

        // Get first day of month offset
        const firstDay = new Date(year, monthIdx, 1);
        const dayOffset = firstDay.getDay(); // 0 is Sun

        // Get total days in month
        const totalDays = new Date(year, monthIdx + 1, 0).getDate();

        // Suman requested calendar financial events
        const specialEvents = {
            '2026-05-05': { text: 'Grocery Expense', color: '#ff453a' },
            '2026-05-10': { text: 'Internet Bill', color: '#ff9f0a' },
            '2026-05-15': { text: 'Course Purchase', color: '#bf5af2' },
            '2026-05-20': { text: 'Reward Credit', color: '#30d158' },
            '2026-05-25': { text: 'Budget Review', color: '#0a84ff' }
        };

        // Get expenses to map
        try {
            const response = await fetch('/api/dashboard');
            const data = await response.json();
            
            if (data.success) {
                // Pre-calculate daily totals
                const dailyTotals = {};
                data.expenses.forEach(e => {
                    dailyTotals[e.transaction_date] = (dailyTotals[e.transaction_date] || 0) + parseFloat(e.amount);
                });

                // Add blank spacer cells using actual CSS grid classes (bug fix!)
                for (let i = 0; i < dayOffset; i++) {
                    const spacer = document.createElement('div');
                    spacer.className = 'calendar-day-cell empty';
                    calendarDaysGrid.appendChild(spacer);
                }

                // Add active days cells using correct styled classes (bug fix!)
                const todayStr = new Date().toISOString().split('T')[0];
                for (let day = 1; day <= totalDays; day++) {
                    const dayStr = `${year}-${String(monthIdx+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                    const cell = document.createElement('div');
                    cell.className = `calendar-day-cell ${dayStr === todayStr ? 'today' : ''}`;
                    
                    const dailySpend = dailyTotals[dayStr] || 0;
                    
                    const special = specialEvents[dayStr];
                    const specialHtml = special ? `<div class="calendar-event-tag" style="background: rgba(255,255,255,0.03); border-left: 2px solid ${special.color}; font-size: 8px; color: rgba(255,255,255,0.7); padding: 2px 4px; border-radius: 2px; margin-top: 4px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: left; width: 100%;" title="${special.text}">${special.text}</div>` : '';

                    cell.innerHTML = `
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
                            <div class="calendar-day-num">${day}</div>
                            ${dailySpend > 0 ? `<div class="calendar-day-spend">${activeCurrency}${dailySpend.toFixed(0)}</div>` : ''}
                        </div>
                        ${specialHtml}
                    `;
                    
                    cell.addEventListener('click', () => {
                        if (dailySpend > 0) {
                            switchTab('transactions-panel');
                            const searchEl = document.getElementById('ledgerSearch') || document.querySelector('.ledger-search-input');
                            if (searchEl) {
                                searchEl.value = dayStr;
                                searchEl.dispatchEvent(new Event('input'));
                            }
                        }
                    });

                    calendarDaysGrid.appendChild(cell);
                }
            }
        } catch (err) {
            console.error('Calendar generation failure:', err);
        }
    }

    // ----------------------------------------------------------------------
    // 11. LARGE ANALYTICS PLOTS
    // ----------------------------------------------------------------------
    async function loadAnalyticsDashboard() {
        try {
            const response = await fetch('/api/dashboard');
            const data = await response.json();
            
            if (data.success && data.expenses.length > 0) {
                renderLargeAnalyticsCharts(data.expenses);
            }
        } catch (err) {
            console.error('Analytics load failure:', err);
        }
    }

    function renderLargeAnalyticsCharts(expenses) {
        const catSums = {};
        expenses.forEach(e => {
            catSums[e.category] = (catSums[e.category] || 0) + parseFloat(e.amount);
        });
        const categories = Object.keys(catSums);
        const categoryTotals = Object.values(catSums);

        const monthlyTotals = {};
        expenses.forEach(e => {
            try {
                const dateParts = e.transaction_date.split('-');
                const monthKey = `${dateParts[0]}-${dateParts[1]}`;
                monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + parseFloat(e.amount);
            } catch (err) {}
        });
        const sortedMonths = Object.keys(monthlyTotals).sort();
        const monthlySums = sortedMonths.map(m => monthlyTotals[m]);

        const dailySpend = {};
        expenses.forEach(e => {
            dailySpend[e.transaction_date] = (dailySpend[e.transaction_date] || 0) + parseFloat(e.amount);
        });
        const sortedDates = Object.keys(dailySpend).sort();
        const dailyTotals = sortedDates.map(d => dailySpend[d]);

        let cumulative = 0;
        const runningTotals = sortedDates.map(d => {
            cumulative += dailySpend[d];
            return cumulative;
        });

        renderOrUpdateChart('largePie', 'chartLargePie', 'doughnut', categories, categoryTotals, ['#0a84ff', '#30d158', '#ffd60a', '#ff453a', '#8e8e93']);
        renderOrUpdateChart('largeBar', 'chartLargeBar', 'bar', sortedMonths, monthlySums, '#0a84ff');
        renderOrUpdateChart('largeLine', 'chartLargeLine', 'line', sortedDates, dailyTotals, '#30d158');
        
        const sortedCats = Object.entries(catSums).sort((a, b) => a[1] - b[1]);
        renderOrUpdateChart('largeHBar', 'chartLargeHBar', 'horizontalBar', sortedCats.map(x => x[0]), sortedCats.map(x => x[1]), '#ffd60a');
        renderOrUpdateChart('largeArea', 'chartLargeArea', 'line', sortedDates, runningTotals, '#0a84ff', true);
    }

    function renderOrUpdateChart(instanceKey, canvasId, type, labels, data, color, fill = false) {
        const ctx = document.getElementById(canvasId);
        if (chartInstances[instanceKey]) {
            chartInstances[instanceKey].config.data.labels = labels;
            chartInstances[instanceKey].config.data.datasets[0].data = data;
            chartInstances[instanceKey].update();
        } else {
            const datasetConfig = {
                data: data,
                backgroundColor: Array.isArray(color) ? color : color,
                borderColor: Array.isArray(color) ? undefined : color,
                fill: fill
            };
            chartInstances[instanceKey] = new Chart(ctx, {
                type: type,
                data: {
                    labels: labels,
                    datasets: [datasetConfig]
                }
            });
        }
    }

    // ----------------------------------------------------------------------
    // 12. MULTI-FORMAT REPORTS TRIGGER
    // ----------------------------------------------------------------------
    document.getElementById('btnExportPDF').addEventListener('click', () => triggerReportDownload('pdf'));
    document.getElementById('btnExportSummary').addEventListener('click', () => triggerReportDownload('summary'));
    document.getElementById('btnExportExcel').addEventListener('click', () => triggerReportDownload('excel'));

    async function triggerReportDownload(format) {
        const reportsMessage = document.getElementById('reportsMessage');
        reportsMessage.textContent = `Compiling financial ${format.toUpperCase()} worksheet...`;
        
        try {
            window.location.href = `/api/reports?format=${format}`;
            setTimeout(() => {
                reportsMessage.textContent = `✓ Document successfully compiled inside exports/ folder.`;
            }, 2500);
        } catch (err) {
            reportsMessage.textContent = `Failed to generate report.`;
        }
    }

    // ----------------------------------------------------------------------
    // 13. PREDICTIONS INSIGHTS
    // ----------------------------------------------------------------------
    async function loadPredictionInsights() {
        try {
            const response = await fetch('/api/dashboard');
            const data = await response.json();
            
            if (data.success) {
                const HS = data.predictor.health_score;
                const HR = data.predictor.health_rating;
                
                const scoreLabel = document.getElementById('predictHealthScore');
                const ratingLabel = document.getElementById('predictHealthRating');
                
                scoreLabel.textContent = HS;
                ratingLabel.textContent = `Financial Health Score: ${HR}`;

                scoreLabel.className = 'score-dial'; // reset
                if (HS >= 85) scoreLabel.classList.add('text-success');
                else if (HS >= 70) scoreLabel.classList.add('text-primary');
                else if (HS >= 50) scoreLabel.classList.add('text-warning');
                else scoreLabel.classList.add('text-danger');

                document.getElementById('predictAvgSpend').textContent = `${activeCurrency}${data.predictor.average_monthly_spend.toFixed(2)}`;
                document.getElementById('predictNextMonth').textContent = `${activeCurrency}${data.predictor.predicted_next_month.toFixed(2)}`;
                document.getElementById('predictTrend').textContent = data.predictor.spending_trend;
                document.getElementById('predictGrowthCat').textContent = data.predictor.highest_growth_category;
            }
        } catch (err) {
            console.error('Insights loading failure:', err);
        }
    }

    // ----------------------------------------------------------------------
    // 14. BROWSER VOICE RECOGNITION API HOOKS (Feature 7)
    // ----------------------------------------------------------------------
    const voiceMicBtn = document.getElementById('voiceMicBtn');
    const voiceStatus = document.getElementById('voiceStatus');
    const voiceTranscribeResult = document.getElementById('voiceTranscribeResult');

    voiceMicBtn.addEventListener('click', () => {
        toggleVoiceRecording(voiceMicBtn, voiceStatus, (success, data) => {
            if (success) {
                const parsed = data;
                voiceTranscribeResult.classList.remove('hidden');
                voiceTranscribeResult.innerHTML = `
                    <strong>Extracted Phrase:</strong> "${parsed.raw_text}"<br><br>
                    <strong>Match Details:</strong><br>
                    • Title: ${parsed.title}<br>
                    • Category: ${parsed.category}<br>
                    • Amount: ${activeCurrency}${parsed.amount.toFixed(2)}<br><br>
                    <button id="btnCommitVoice" class="btn btn-primary btn-block">✓ Save Voice Entry</button>
                `;

                document.getElementById('btnCommitVoice').addEventListener('click', async () => {
                    try {
                        const response = await fetch('/api/expenses', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                            body: `title=${encodeURIComponent(parsed.title)}&description=${encodeURIComponent(`Voice Capture: "${parsed.raw_text}"`)}&amount=${parsed.amount}&category=${encodeURIComponent(parsed.category)}&payment_method=UPI&transaction_date=${new Date().toISOString().split('T')[0]}`
                        });

                        const result = await response.json();
                        if (result.success) {
                            alert('Voice transaction committed successfully.');
                            voiceTranscribeResult.classList.add('hidden');
                            loadDashboardKPIs();
                        }
                    } catch (err) {
                        alert('Database transaction write failure.');
                    }
                });
            } else {
                alert(`Voice Input Alert: ${data}`);
                voiceStatus.textContent = 'Microphone service idle.';
            }
        });
    });

    // ----------------------------------------------------------------------
    // 15. SECURE DATABASE BACKUP & RESTORE
    // ----------------------------------------------------------------------
    const backupsListBody = document.getElementById('backupsListBody');
    const btnCreateBackup = document.getElementById('btnCreateBackup');

    btnCreateBackup.addEventListener('click', async () => {
        try {
            const response = await fetch('/api/backup', { method: 'POST' });
            const result = await response.json();
            if (result.success) {
                alert(`Backup snapshot successfully created: ${result.filename}`);
                loadBackupsList();
            } else {
                alert(`Error: ${result.message}`);
            }
        } catch (err) {
            alert('Server backup failed.');
        }
    });

    async function loadBackupsList() {
        try {
            const response = await fetch('/api/backup');
            const data = await response.json();
            
            if (data.success) {
                backupsListBody.innerHTML = '';
                
                if (data.backups.length === 0) {
                    backupsListBody.innerHTML = `<tr><td colspan="2" style="text-align: center; color: var(--fg-muted);">No historical backups found.</td></tr>`;
                    return;
                }

                data.backups.forEach(filename => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td><strong>${filename}</strong></td>
                        <td style="text-align: center;">
                            <button class="btn btn-secondary btn-restore" data-file="${filename}">Restore</button>
                        </td>
                    `;
                    
                    tr.querySelector('.btn-restore').addEventListener('click', () => triggerBackupRestore(filename));
                    backupsListBody.appendChild(tr);
                });
            }
        } catch (err) {
            console.error('Backups load failed:', err);
        }
    }

    async function triggerBackupRestore(filename) {
        const confirm = window.confirm(`Restoring database from snapshot "${filename}" will overwrite active ledger records.\n\nProceed?`);
        if (!confirm) return;

        try {
            const response = await fetch('/api/backup/restore', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `filename=${encodeURIComponent(filename)}`
            });

            const result = await response.json();
            if (result.success) {
                alert('Database snapshot restored successfully. Refreshing statistics.');
                loadDashboardKPIs();
            } else {
                alert(`Restore error: ${result.message}`);
            }
        } catch (err) {
            alert('Failed to connect to restore route.');
        }
    }

    // ----------------------------------------------------------------------
    // 16. USER PROFILE STATS & FORM UPDATES
    // ----------------------------------------------------------------------
    const profileForm = document.getElementById('profileUpdateForm');

    async function loadProfileStats() {
        try {
            const response = await fetch('/api/dashboard');
            const data = await response.json();
            if (data.success) {
                document.getElementById('profFullName').value = data.user.full_name;
                document.getElementById('profUsername').value = data.user.username;
                document.getElementById('profMobile').value = data.user.mobile;
                document.getElementById('profEmail').value = data.user.email;
                
                document.getElementById('profCardFullName').textContent = data.user.full_name;
                document.getElementById('profCardRole').textContent = data.user.role;
                document.getElementById('profCardAvatar').src = data.user.profile_photo;

                // Populate showcase dossier cards
                const docEmail = document.getElementById('profCardEmail');
                if (docEmail) docEmail.textContent = data.user.email;
                const docUsername = document.getElementById('profCardUsername');
                if (docUsername) docUsername.textContent = data.user.username;
                const docShowRole = document.getElementById('profCardShowcaseRole');
                if (docShowRole) docShowRole.textContent = data.user.role;
                const docCreated = document.getElementById('profCardCreatedAt');
                if (docCreated) docCreated.textContent = data.user.created_at || '2026-05-20 12:00:00';
                const docLastLog = document.getElementById('profCardLastLogin');
                if (docLastLog) docLastLog.textContent = data.user.last_login || '2026-05-24 10:00:00';

                // Also populate the second card if present
                const docEmail2 = document.getElementById('profCardEmail2');
                if (docEmail2) docEmail2.textContent = data.user.email;
                const docUsername2 = document.getElementById('profCardUsername2');
                if (docUsername2) docUsername2.textContent = data.user.username;
                const docShowRole2 = document.getElementById('profCardShowcaseRole2');
                if (docShowRole2) docShowRole2.textContent = data.user.role;
                const docCreated2 = document.getElementById('profCardCreatedAt2');
                if (docCreated2) docCreated2.textContent = data.user.created_at || '2026-05-20 12:00:00';
                const docLastLog2 = document.getElementById('profCardLastLogin2');
                if (docLastLog2) docLastLog2.textContent = data.user.last_login || '2026-05-24 10:00:00';
                const docAvatar2 = document.getElementById('profCardAvatar2');
                if (docAvatar2) docAvatar2.setAttribute('src', data.user.profile_photo);
                const docName2 = document.getElementById('profCardFullName2');
                if (docName2) docName2.textContent = data.user.full_name;
                const docRole2 = document.getElementById('profCardRole2');
                if (docRole2) docRole2.textContent = data.user.role;

                document.getElementById('profStatsCompletedGoals').textContent = `${data.goals.filter(g => parseFloat(g.saved) >= parseFloat(g.target)).length} Goals`;
                const unlockedCount = data.achievements.filter(ach => ach.unlocked).length;
                document.getElementById('profStatsBadges').textContent = `${unlockedCount}/5 Badges`;
            }
        } catch (err) {
            console.error('Profile loading error:', err);
        }
    }

    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(profileForm);

        try {
            const response = await fetch('/api/profile/update', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            if (result.success) {
                alert('✓ User profile updated successfully!');
                loadDashboardKPIs();
                loadProfileStats();
            } else {
                alert(`Profile update failed: ${result.message}`);
            }
        } catch (err) {
            alert('Server connection error during profile update.');
        }
    });

    // Avatar image upload triggering & visual live preview updates (Feature 16)
    const btnProfUploadTrigger = document.getElementById('btnProfUploadTrigger');
    const btnProfRemoveAvatar = document.getElementById('btnProfRemoveAvatar');
    const removeAvatarFlag = document.getElementById('removeAvatarFlag');
    const profAvatar = document.getElementById('profAvatar');
    if (btnProfUploadTrigger && profAvatar) {
        btnProfUploadTrigger.addEventListener('click', () => {
            profAvatar.click();
        });
    }

    if (btnProfRemoveAvatar) {
        btnProfRemoveAvatar.addEventListener('click', () => {
            const profAvatarPreview = document.getElementById('profAvatarPreview');
            if (profAvatarPreview) {
                profAvatarPreview.src = '/static/assets/default_avatar.svg';
            }
            if (removeAvatarFlag) {
                removeAvatarFlag.value = 'true';
            }
            if (profAvatar) {
                profAvatar.value = '';
            }
        });
    }

    if (profAvatar) {
        profAvatar.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                if (removeAvatarFlag) {
                    removeAvatarFlag.value = 'false';
                }
                const reader = new FileReader();
                reader.onload = (event) => {
                    const profAvatarPreview = document.getElementById('profAvatarPreview');
                    if (profAvatarPreview) {
                        profAvatarPreview.src = event.target.result;
                    }
                    const profCardAvatar = document.getElementById('profCardAvatar');
                    if (profCardAvatar) {
                        profCardAvatar.src = event.target.result;
                    }
                    const profCardAvatar2 = document.getElementById('profCardAvatar2');
                    if (profCardAvatar2) {
                        profCardAvatar2.src = event.target.result;
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // ----------------------------------------------------------------------
    // 17. APPLICATION THEMES & CURRENCIES SETTINGS
    // ----------------------------------------------------------------------
    const settingsConfigForm = document.getElementById('settingsConfigForm');

    async function loadSystemSettings() {
        try {
            const response = await fetch('/api/settings');
            const data = await response.json();
            
            if (data.success) {
                document.getElementById('settingsTheme').value = data.settings.theme;
                document.getElementById('settingsCurrency').value = data.settings.currency;
                document.getElementById('settingsExportFolder').value = data.settings.export_folder;
                
                appTheme = data.settings.theme;
                document.body.setAttribute('data-theme', appTheme);
                localStorage.setItem('neuraspend_theme', appTheme);
            }
        } catch (err) {
            console.error('Settings load failed:', err);
        }
    }

    settingsConfigForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const theme = document.getElementById('settingsTheme').value;
        const currency = document.getElementById('settingsCurrency').value;
        const exportFolder = document.getElementById('settingsExportFolder').value.trim();

        try {
            const response = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `theme=${theme}&currency=${encodeURIComponent(currency)}&export_folder=${encodeURIComponent(exportFolder)}`
            });

            const result = await response.json();
            if (result.success) {
                alert('Settings saved successfully.');
                
                appTheme = theme;
                document.body.setAttribute('data-theme', appTheme);
                localStorage.setItem('neuraspend_theme', appTheme);
                activeCurrency = currency;
                
                loadDashboardKPIs();
            }
        } catch (err) {
            alert('Failed to connect to settings endpoint.');
        }
    });

    // Header simple theme button switch
    document.getElementById('btnThemeToggle').addEventListener('click', async () => {
        const nextTheme = appTheme === 'Dark' ? 'Light' : 'Dark';
        try {
            const response = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `theme=${nextTheme}&currency=${encodeURIComponent(activeCurrency)}&export_folder=${encodeURIComponent(document.getElementById('settingsExportFolder').value || '')}`
            });
            const result = await response.json();
            if (result.success) {
                appTheme = nextTheme;
                document.body.setAttribute('data-theme', appTheme);
                document.getElementById('settingsTheme').value = appTheme;
                localStorage.setItem('neuraspend_theme', appTheme);
            }
        } catch (err) {
            console.error('Theme toggle update failed.');
        }
    });

    // ----------------------------------------------------------------------
    // 17B. BUDGET CENTER PANEL ALLOCATIONS
    // ----------------------------------------------------------------------
    const budgetSettingForm = document.getElementById('budgetSettingForm');

    async function loadBudgetPanel() {
        try {
            const response = await fetch('/api/dashboard');
            const data = await response.json();
            if (data.success) {
                document.getElementById('budgetTargetLimit').value = data.budget.monthly_limit;
                document.getElementById('budgetWarningLimit').value = data.budget.warning_limit;
            }
        } catch (err) {
            console.error('Budget load failed:', err);
        }
    }

    if (budgetSettingForm) {
        budgetSettingForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const limit = parseFloat(document.getElementById('budgetTargetLimit').value);
            const warn = parseFloat(document.getElementById('budgetWarningLimit').value);

            if (isNaN(limit) || limit <= 0 || isNaN(warn) || warn <= 0 || warn > limit) {
                alert('Invalid budget bounds. Warning limit must be less than monthly limit.');
                return;
            }

            try {
                const response = await fetch('/api/budget', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: `monthly_limit=${limit}&warning_limit=${warn}`
                });

                const result = await response.json();
                if (result.success) {
                    alert('✓ Budget allocations adjusted successfully!');
                    loadDashboardKPIs();
                } else {
                    alert(`Error: ${result.message}`);
                }
            } catch (err) {
                alert('Failed to connect to budget endpoint.');
            }
        });
    }

    // ----------------------------------------------------------------------
    // 18. ADMIN CONSOLE MANAGEMENT PANEL (Feature 14)
    // ----------------------------------------------------------------------
    const adminAddUserForm = document.getElementById('adminAddUserForm');

    async function loadAdminConsole() {
        try {
            // Load Users list
            const responseUsers = await fetch('/api/users');
            const dataUsers = await responseUsers.json();
            if (dataUsers.success) {
                const adminUsersList = document.getElementById('adminUsersListBody');
                if (adminUsersList) {
                    adminUsersList.innerHTML = '';
                    dataUsers.users.forEach(u => {
                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td><strong>${u.username}</strong></td>
                            <td>${u.role}</td>
                            <td>${u.created_at}</td>
                        `;
                        adminUsersList.appendChild(tr);
                    });
                }
            }

            // Load Audit Logs list
            const responseAudit = await fetch('/api/audit');
            const dataAudit = await responseAudit.json();
            if (dataAudit.success) {
                const adminAuditLogs = document.getElementById('adminAuditLogsBody');
                if (adminAuditLogs) {
                    adminAuditLogs.innerHTML = '';
                    dataAudit.audits.forEach(log => {
                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td>${log.timestamp}</td>
                            <td><strong>User #${log.user_id}</strong></td>
                            <td><span style="font-weight:700; color:var(--primary); font-size:10px;">${log.event_type}</span></td>
                            <td>${log.details}</td>
                        `;
                        adminAuditLogs.appendChild(tr);
                    });
                }
            }

            // Load Support Tickets
            const responseSupport = await fetch('/api/support');
            const dataSupport = await responseSupport.json();
            if (dataSupport.success) {
                const adminSupportTicketsBody = document.getElementById('adminSupportTicketsBody');
                if (adminSupportTicketsBody) {
                    adminSupportTicketsBody.innerHTML = '';
                    if (dataSupport.requests.length === 0) {
                        adminSupportTicketsBody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--fg-muted); font-size: 11px; padding: 15px;">No support tickets submitted yet.</td></tr>`;
                    } else {
                        dataSupport.requests.forEach(t => {
                            const tr = document.createElement('tr');
                            tr.innerHTML = `
                                <td>#${t.id}</td>
                                <td><strong>${t.username}</strong></td>
                                <td><span style="font-weight:700; color:var(--primary); font-size:10px;">${t.category}</span></td>
                                <td><strong>${t.subject}</strong></td>
                                <td style="max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${t.message}">${t.message}</td>
                                <td>${t.created_at}</td>
                                <td><span style="font-weight:bold; color:${t.status === 'Open' ? '#ff9500' : '#30d158'}; font-size:10px;">${t.status}</span></td>
                                <td>
                                    ${t.status === 'Open' ? `<button onclick="resolveSupportTicket(${t.id})" class="btn btn-secondary" style="padding:2px 8px; font-size:10px; border-radius:4px; margin:0;">Resolve</button>` : `<span style="font-size:10px; color:var(--fg-muted);">✓ Closed</span>`}
                                </td>
                            `;
                            adminSupportTicketsBody.appendChild(tr);
                        });
                    }
                }
            }
        } catch (err) {
            console.error('Failed to load admin console data:', err);
        }
    }

    if (adminAddUserForm) {
        adminAddUserForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('admNewUsername').value.trim();
            const pass = document.getElementById('admNewPassword').value;

            if (!username || pass.length < 8) {
                alert('Valid credentials parameters required. Password must be 8+ chars.');
                return;
            }

            try {
                const response = await fetch('/api/users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: `username=${encodeURIComponent(username)}&password=${encodeURIComponent(pass)}`
                });

                const result = await response.json();
                if (result.success) {
                    alert('✓ Registered new Employee user successfully!');
                    adminAddUserForm.reset();
                    loadAdminConsole();
                } else {
                    alert(`Admin user creation failed: ${result.message}`);
                }
            } catch (err) {
                alert('Failed to register admin employee.');
            }
        });
    }

    // ----------------------------------------------------------------------
    // 19. CLOCK TICKER & WELCOME BANNER CLOCK INITIALIZATION
    // ----------------------------------------------------------------------
    function startClockTicker() {
        setInterval(() => {
            const now = new Date();
            const timeString = now.toLocaleString();
            const sysClock = document.getElementById('systemClock');
            if (sysClock) sysClock.textContent = `🕒 Time: ${timeString}`;
        }, 1000);
    }

    function startWelcomeClock() {
        const dateEl = document.getElementById('welcomeCurrentDate');
        const timeEl = document.getElementById('welcomeCurrentTime');
        if (!dateEl || !timeEl) return;
        
        function updateClock() {
            const now = new Date();
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            timeEl.textContent = `${hours}:${minutes}:${seconds}`;
            
            const options = { day: 'numeric', month: 'short', year: 'numeric' };
            dateEl.textContent = now.toLocaleDateString('en-IN', options);
        }
        updateClock();
        setInterval(updateClock, 1000);
    }

    // ----------------------------------------------------------------------
    // 20. BOOTSTRAP INITIAL LOAD CALLS & GLOBAL EXPORTS
    // ----------------------------------------------------------------------
    window.switchTab = switchTab;
    startClockTicker();
    startWelcomeClock();
    loadDashboardKPIs();
    loadSystemSettings();

    // ----------------------------------------------------------------------
    // 21. CHITRAGUPTA FLOATING WIDGET & MAIN PANEL CHAT HANDLERS
    // ----------------------------------------------------------------------
    window.toggleChitraguptaWidget = function() {
        const widget = document.getElementById('chitraguptaChatWidget');
        if (widget) {
            if (widget.classList.contains('hide')) {
                widget.classList.remove('hide');
                widget.classList.add('show');
                const inp = document.getElementById('chatWidgetInputText');
                if (inp) inp.focus();
            } else {
                widget.classList.remove('show');
                widget.classList.add('hide');
            }
        }
    };

    async function sendChatbotMessage(msgText, isWidget) {
        if (!msgText) return;
        
        const msgsContainer = document.getElementById(isWidget ? 'chatWidgetMessages' : 'fullChatMessages');
        const inputField = document.getElementById(isWidget ? 'chatWidgetInputText' : 'fullChatInputText');
        const loadingEl = isWidget ? document.getElementById('chatWidgetLoading') : null;
        
        if (!msgsContainer) return;

        // Append user bubble
        const userBubble = document.createElement('div');
        userBubble.style.alignSelf = 'flex-end';
        userBubble.style.maxWidth = '80%';
        userBubble.style.background = 'var(--primary)';
        userBubble.style.borderRadius = '12px';
        userBubble.style.borderTopRightRadius = '2px';
        userBubble.style.padding = '10px 14px';
        userBubble.style.fontSize = '12px';
        userBubble.style.lineHeight = '1.4';
        userBubble.style.color = '#ffffff';
        userBubble.textContent = msgText;
        msgsContainer.appendChild(userBubble);
        
        msgsContainer.scrollTop = msgsContainer.scrollHeight;
        inputField.value = '';
        
        if (loadingEl) loadingEl.classList.remove('hide');
        
        const formData = new FormData();
        formData.append('message', msgText);
        
        try {
            const response = await fetch('/api/chatbot', {
                method: 'POST',
                body: formData
            });
            const result = await response.json();
            
            if (loadingEl) loadingEl.classList.add('hide');
            
            if (result.success) {
                const assistantBubble = document.createElement('div');
                assistantBubble.style.alignSelf = 'flex-start';
                assistantBubble.style.maxWidth = '80%';
                assistantBubble.style.background = 'rgba(255, 255, 255, 0.04)';
                assistantBubble.style.border = '1px solid rgba(255, 255, 255, 0.05)';
                assistantBubble.style.borderRadius = '12px';
                assistantBubble.style.borderTopLeftRadius = '2px';
                assistantBubble.style.padding = '10px 14px';
                assistantBubble.style.fontSize = '12px';
                assistantBubble.style.lineHeight = '1.4';
                assistantBubble.style.color = '#ffffff';
                
                let formatted = result.reply
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\*(.*?)\*/g, '<em>$1</em>');
                assistantBubble.innerHTML = formatted;
                msgsContainer.appendChild(assistantBubble);
            } else {
                const errorBubble = document.createElement('div');
                errorBubble.style.alignSelf = 'flex-start';
                errorBubble.style.background = 'rgba(255, 69, 58, 0.15)';
                errorBubble.style.border = '1px solid rgba(255, 69, 58, 0.25)';
                errorBubble.style.color = '#ff453a';
                errorBubble.style.borderRadius = '12px';
                errorBubble.style.padding = '10px 14px';
                errorBubble.style.fontSize = '12px';
                errorBubble.textContent = `Error: ${result.message}`;
                msgsContainer.appendChild(errorBubble);
            }
        } catch (err) {
            if (loadingEl) loadingEl.classList.add('hide');
            const errorBubble = document.createElement('div');
            errorBubble.style.alignSelf = 'flex-start';
            errorBubble.style.background = 'rgba(255, 69, 58, 0.15)';
            errorBubble.style.border = '1px solid rgba(255, 69, 58, 0.25)';
            errorBubble.style.color = '#ff453a';
            errorBubble.style.borderRadius = '12px';
            errorBubble.style.padding = '10px 14px';
            errorBubble.style.fontSize = '12px';
            errorBubble.textContent = 'Server connection error during assistant lookup.';
            msgsContainer.appendChild(errorBubble);
        }
        
        msgsContainer.scrollTop = msgsContainer.scrollHeight;
    }

    const chatWidgetForm = document.getElementById('chatWidgetForm');
    if (chatWidgetForm) {
        chatWidgetForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const textInput = document.getElementById('chatWidgetInputText');
            const msg = textInput.value.trim();
            sendChatbotMessage(msg, true);
        });
    }

    const fullChatForm = document.getElementById('fullChatForm');
    if (fullChatForm) {
        fullChatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const textInput = document.getElementById('fullChatInputText');
            const msg = textInput.value.trim();
            sendChatbotMessage(msg, false);
        });
    }

    // ----------------------------------------------------------------------
    // 22. TOP-RIGHT PROFILE DROPDOWN INTERACTIONS
    // ----------------------------------------------------------------------
    const topbarUserDropdownTrigger = document.getElementById('topbarUserDropdownTrigger');
    const topbarUserDropdownMenu = document.getElementById('topbarUserDropdownMenu');
    const dropdownLogoutBtn = document.getElementById('dropdownLogoutBtn');
    
    if (topbarUserDropdownTrigger && topbarUserDropdownMenu) {
        topbarUserDropdownTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            topbarUserDropdownMenu.classList.toggle('hide');
        });
        
        document.addEventListener('click', () => {
            topbarUserDropdownMenu.classList.add('hide');
        });
        
        topbarUserDropdownMenu.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
    
    if (dropdownLogoutBtn) {
        dropdownLogoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (logoutBtn) logoutBtn.click();
        });
    }

    // ----------------------------------------------------------------------
    // 23. ENTERPRISE HELP CENTER TAB SWITCHES, SEARCH & TICKETING
    // ----------------------------------------------------------------------
    window.switchHelpTab = function(tabId) {
        document.getElementById('btnHelpTabFAQ').classList.remove('active-help-tab');
        document.getElementById('btnHelpTabGuides').classList.remove('active-help-tab');
        document.getElementById('btnHelpTabSupport').classList.remove('active-help-tab');
        
        if (tabId === 'faq') {
            document.getElementById('btnHelpTabFAQ').classList.add('active-help-tab');
        } else if (tabId === 'guides') {
            document.getElementById('btnHelpTabGuides').classList.add('active-help-tab');
        } else if (tabId === 'support') {
            document.getElementById('btnHelpTabSupport').classList.add('active-help-tab');
        }
        
        document.getElementById('helpTabFAQContent').classList.remove('active');
        document.getElementById('helpTabGuidesContent').classList.remove('active');
        document.getElementById('helpTabSupportContent').classList.remove('active');
        
        document.getElementById(`helpTab${tabId.charAt(0).toUpperCase() + tabId.slice(1)}Content`).classList.add('active');
        
        if (tabId === 'support') {
            loadUserSupportTickets();
        }
    };

    window.filterHelpContent = function() {
        const query = document.getElementById('helpSearchInput').value.toLowerCase().trim();
        const details = document.querySelectorAll('.help-details');
        
        details.forEach(item => {
            const text = item.innerText.toLowerCase();
            if (text.includes(query)) {
                item.style.display = '';
            } else {
                item.style.display = 'none';
            }
        });
    };

    window.resolveSupportTicket = async function(ticketId) {
        if (!confirm('Are you sure you want to mark this support ticket as Resolved?')) return;
        const formData = new FormData();
        formData.append('ticket_id', ticketId);
        formData.append('status', 'Resolved');
        try {
            const response = await fetch('/api/support/update', {
                method: 'POST',
                body: formData
            });
            const result = await response.json();
            if (result.success) {
                alert('✓ Ticket marked as Resolved successfully!');
                loadAdminConsole();
            } else {
                alert(`❌ Failed to update ticket: ${result.message}`);
            }
        } catch (err) {
            alert('❌ Network error during ticket update.');
        }
    };

    async function loadUserSupportTickets() {
        const listContainer = document.getElementById('userTicketsList');
        if (!listContainer) return;
        
        try {
            const response = await fetch('/api/support');
            const data = await response.json();
            if (data.success && data.requests) {
                if (data.requests.length === 0) {
                    listContainer.innerHTML = `<div style="text-align: center; padding: 30px; color: var(--fg-muted); font-size: 11px;">No support tickets submitted yet.</div>`;
                } else {
                    listContainer.innerHTML = data.requests.map(t => `
                        <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; margin-bottom: 10px; display:flex; flex-direction:column; gap:4px;">
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span style="font-size:10px; font-weight:700; color:var(--primary);">${t.category}</span>
                                <span style="font-size:9px; padding:2px 6px; border-radius:4px; font-weight:bold; background:${t.status === 'Open' ? 'rgba(255,149,0,0.15)' : 'rgba(48,209,88,0.15)'}; color:${t.status === 'Open' ? '#ff9500' : '#30d158'};">${t.status}</span>
                            </div>
                            <h4 style="font-size:12px; font-weight:700; color:#ffffff; margin:4px 0 0 0;">${t.subject}</h4>
                            <p style="font-size:11px; color:var(--fg-muted); margin:4px 0;">${t.message}</p>
                            <span style="font-size:9px; color:rgba(255,255,255,0.3); text-align:right;">📅 ${t.created_at}</span>
                        </div>
                    `).join('');
                }
            }
        } catch (err) {
            console.error('Error loading support tickets:', err);
        }
    }

    const helpSupportForm = document.getElementById('helpSupportForm');
    if (helpSupportForm) {
        helpSupportForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const category = document.getElementById('helpCategory').value;
            const subject = document.getElementById('helpSubject').value.trim();
            const message = document.getElementById('helpMessage').value.trim();
            
            if (!subject || !message) {
                alert('❌ Please enter a subject and a message!');
                return;
            }
            
            const formData = new FormData();
            formData.append('category', category);
            formData.append('subject', subject);
            formData.append('message', message);
            
            try {
                const response = await fetch('/api/support', {
                    method: 'POST',
                    body: formData
                });
                const result = await response.json();
                if (result.success) {
                    alert('✓ Support ticket submitted successfully! The admin team will review it.');
                    helpSupportForm.reset();
                    loadUserSupportTickets();
                } else {
                    alert(`❌ Submission failed: ${result.message}`);
                }
            } catch (err) {
                alert('❌ Network error during support ticket submission.');
            }
        });
    }
});
