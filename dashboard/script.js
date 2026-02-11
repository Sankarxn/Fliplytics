document.addEventListener('DOMContentLoaded', async () => {
    // UI Elements
    const syncBtn = document.getElementById('syncBtn');
    const navItems = document.querySelectorAll('.nav li');
    const sections = document.querySelectorAll('.view-section');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const pageTitle = document.getElementById('pageTitle');
    const orderSearch = document.getElementById('orderSearch');
    const filterBar = document.querySelector('.filter-bar');

    // State
    let rawOrders = []; // All fetched orders
    let currentFilter = 'all'; // all, year, quarter, month


    // Navigation Logic
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            const viewId = `view-${item.dataset.view}`;
            sections.forEach(section => {
                section.style.display = section.id === viewId ? 'block' : 'none';
                section.classList.toggle('active', section.id === viewId);
            });

            // Toggle Filter Bar
            if (filterBar) {
                filterBar.style.display = item.dataset.view === 'instructions' ? 'none' : 'flex';
            }

            // Update Title
            const titleMap = {
                'overview': 'Overview',
                'orders': 'All Orders',
                'brands': 'Analytics',
                'instructions': 'Instructions'
            };
            pageTitle.textContent = titleMap[item.dataset.view];
        });
    });

    // Filter Logic
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.period;
            processData(); // Re-run all calculations with new filter
        });
    });

    // Search Logic
    if (orderSearch) {
        orderSearch.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = getFilteredOrders().filter(o =>
                o.productName.toLowerCase().includes(term) ||
                o.date.toLowerCase().includes(term)
            );
            renderAllOrders(filtered);
        });
    }

    // Initial Load
    // loadData();

    // Event Listeners
    syncBtn.addEventListener('click', handleSync);

    chrome.runtime.onMessage.addListener((message) => {
        if (message.action === 'scrapeProgress') {
            syncBtn.textContent = `Syncing... (${message.count})`;
            syncBtn.disabled = true;
        } else if (message.action === 'scrapeComplete') {
            syncBtn.textContent = 'Sync Complete';
            setTimeout(() => {
                syncBtn.innerHTML = '<span class="icon">🔄</span> Sync Orders';
                syncBtn.disabled = false;
                loadData();
            }, 2000);
        }
    });



    async function loadData() {
        const data = await chrome.storage.local.get(['orders']);
        rawOrders = data.orders || [];
        processData();
    }

    function getFilteredOrders() {
        // First filter valid (status)
        const valid = rawOrders.filter(o => {
            const s = (o.status || '').toLowerCase();
            return !s.includes('cancelled') && !s.includes('returned') && !s.includes('refund');
        });

        // Current Date Context
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        // Filter by Time Period
        return valid.filter(order => {
            const d = new Date(order.date);
            if (isNaN(d.getTime())) return false; // Invalid date

            if (currentFilter === 'all') return true;

            if (currentFilter === 'last-month') {
                // Previous calendar month
                // Logic: Month is (currentMonth - 1). If current is Jan (0), prev is Dec (11) of prev Year.
                let prevMonth = currentMonth - 1;
                let prevYear = currentYear;
                if (prevMonth < 0) {
                    prevMonth = 11;
                    prevYear--;
                }
                return d.getMonth() === prevMonth && d.getFullYear() === prevYear;
            }

            if (currentFilter === 'last-3-months') {
                // Last 90 days relative to today
                const ninetyDaysAgo = new Date();
                ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
                return d >= ninetyDaysAgo;
            }

            if (currentFilter === 'last-year') {
                // Previous calendar year
                return d.getFullYear() === (currentYear - 1);
            }

            if (currentFilter === 'last-2-years') {
                // Current Year + Previous Year + Year Before?
                // User said "Last 2 year".
                // Let's interpret as "Last 2 Calendar Years" (Current Year is usually "This Year").
                // So 2024 and 2025.
                // Or "Last 2 years" rolling.
                // Let's do: Year >= (CurrentYear - 2) AND Year < CurrentYear?
                // Actually usually people want "History of 2 years". 
                // Let's include current year? No, "This Year" is separate.
                // Let's return orders where Year is (current-1) OR (current-2).
                return d.getFullYear() === (currentYear - 1) || d.getFullYear() === (currentYear - 2);
            }

            return true;
        });
    }

    function processData() {
        const orders = getFilteredOrders();

        if (orders.length === 0 && rawOrders.length === 0) {
            // Empty state if needed
        }

        // Stats
        const totalSpent = orders.reduce((sum, order) => sum + (parseFloat(order.amount) || 0), 0);
        const totalOrders = orders.length;
        const avgOrder = totalOrders > 0 ? totalSpent / totalOrders : 0;

        document.getElementById('totalSpent').textContent = formatCurrency(totalSpent);
        document.getElementById('totalOrders').textContent = totalOrders;
        document.getElementById('avgOrder').textContent = formatCurrency(avgOrder);

        // Charts
        renderMonthlyChart(orders);
        renderCategoryChart(orders);

        // Tables
        renderRecentOrders(orders);
        renderAllOrders(orders);
        renderBrandsTable(orders);
    }

    async function handleSync() {
        syncBtn.disabled = true;
        syncBtn.textContent = 'Checking tabs...';

        // Method 1: Check if Flipkart Orders tab is already open
        try {
            const tabs = await chrome.tabs.query({ url: '*://www.flipkart.com/account/orders*' });

            if (tabs.length > 0) {
                // Use the existing tab!
                syncBtn.textContent = 'Syncing via Tab...';
                chrome.tabs.sendMessage(tabs[0].id, { action: 'startScraping' }, (response) => {
                    if (chrome.runtime.lastError) {
                        // If sending fails (e.g. content script not ready), fallback
                        console.warn("Tab found but message failed:", chrome.runtime.lastError);
                        startBackgroundScrape();
                    } else {
                        console.log("Started scraping on existing tab:", tabs[0].id);
                    }
                });
                return;
            }
        } catch (e) {
            console.error("Tab query failed:", e);
        }

        // Method 2: Background Fetch (Fallback)
        await startBackgroundScrape();
    }

    async function startBackgroundScrape() {
        let allOrders = [];
        let nextUrl = 'https://www.flipkart.com/account/orders?link=home_orders'; // Start URL
        let pageCount = 1;

        syncBtn.textContent = 'Connecting...';
        console.log("Starting scrape process...");

        while (nextUrl) {
            try {
                console.log(`Fetching Page ${pageCount}: ${nextUrl}`);

                // Fetch via Background Proxy to avoid CORS
                const fetchResult = await new Promise(resolve => {
                    chrome.runtime.sendMessage({ action: 'fetchPage', url: nextUrl }, resolve);
                });

                if (!fetchResult || !fetchResult.success) {
                    const err = fetchResult ? fetchResult.error : 'No response';
                    if (err.includes('Not logged in') || err.includes('redirected')) {
                        throw new Error('Not logged in');
                    }
                    throw new Error(err);
                }

                const html = fetchResult.data;
                console.log(`Received ${html.length} bytes`);

                // Parse HTML
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');

                // Check for Login Page Content
                if (html.includes('Login') && html.includes('Get access to your Orders')) {
                    throw new Error('Not logged in');
                }

                // Extract Orders
                const orders = parseOrdersFromDoc(doc);
                console.log(`Page ${pageCount} orders found: ${orders.length}`);

                if (orders.length === 0 && pageCount === 1) {
                    // If Page 1 is empty, it might be an issue.
                    // But we continue just in case.
                }

                allOrders.push(...orders);

                syncBtn.textContent = `Found ${allOrders.length} orders (Pg ${pageCount})`;

                // Find Next Button
                const nextBtn = Array.from(doc.querySelectorAll('a')).find(el => el.innerText && el.innerText.toUpperCase().includes('NEXT'));

                if (nextBtn && nextBtn.getAttribute('href')) {
                    nextUrl = 'https://www.flipkart.com' + nextBtn.getAttribute('href');
                    pageCount++;
                    await new Promise(r => setTimeout(r, 1500));
                } else {
                    nextUrl = null;
                }
            } catch (err) {
                console.error("Scrape Error:", err);
                // Critical Failure encountered
                if (err.message.includes('Not logged in') || err.message.includes('Network')) {
                    const confirmOpen = confirm("Background Sync failed (Login/Network). \n\nWould you like to open Flipkart Orders in a new tab to sync securely?");
                    if (confirmOpen) {
                        chrome.tabs.create({ url: 'https://www.flipkart.com/account/orders' });
                        syncBtn.textContent = 'Opened Tab. Try Sync Again.';
                    } else {
                        syncBtn.textContent = 'Sync Failed';
                    }
                } else {
                    syncBtn.textContent = 'Error: ' + err.message;
                }

                setTimeout(() => {
                    syncBtn.disabled = false;
                    syncBtn.innerHTML = '<span class="icon">🔄</span> Sync Orders';
                }, 4000);
                return; // Stop function
            }
        }

        if (allOrders.length > 0) {
            await chrome.storage.local.set({ orders: allOrders });
            syncBtn.textContent = 'Sync Complete!';
            loadData();
            setTimeout(() => {
                syncBtn.disabled = false;
                syncBtn.innerHTML = '<span class="icon">🔄</span> Sync Orders';
            }, 2000);
        } else {
            syncBtn.textContent = 'No orders found';
            setTimeout(() => {
                syncBtn.disabled = false;
                syncBtn.innerHTML = '<span class="icon">🔄</span> Sync Orders';
            }, 2000);
        }
    }

    function parseOrdersFromDoc(doc) {
        const orders = [];
        const orderLinks = Array.from(doc.querySelectorAll('a[href*="/order_details"]'));
        const processedCards = new Set();

        orderLinks.forEach(link => {
            let card = link.parentElement;
            card = link.closest('div');

            if (!card || processedCards.has(card)) return;
            processedCards.add(card);

            try {
                const textContent = card.innerText || card.textContent || "";

                // Extract Date
                const statusNode = textContent.match(/Delivered on ([A-Za-z]{3} \d{1,2}(?:, \d{4})?)/);
                const dateStr = statusNode ? statusNode[1] : null;
                const finalDate = dateStr || new Date().toDateString(); // Default to today if unknown

                // Extract Price
                const priceNode = textContent.match(/₹[\d,]+/);
                const amount = priceNode ? parseFloat(priceNode[0].replace(/[₹,]/g, '')) : 0;

                // Extract Name
                const name = link.innerText || "Unknown Product";

                // Extract Image
                const img = card.querySelector('img');
                const image = img ? img.src : '';

                // Extract Status
                let status = 'Delivered';
                if (textContent.includes('Cancelled')) status = 'Cancelled';
                else if (textContent.includes('Returned')) status = 'Returned';
                else if (textContent.includes('Refund')) status = 'Returned';

                if (amount > 0) {
                    orders.push({
                        id: Math.random().toString(36).substr(2, 9),
                        date: finalDate,
                        amount: amount,
                        productName: name,
                        imageUrl: image,
                        status: status
                    });
                }
            } catch (e) {
                // Ignore
            }
        });
        return orders;
    }

    function formatCurrency(amount) {
        return '₹' + amount.toLocaleString('en-IN', { maximumFractionDigits: 0 });
    }

    let monthlyChartInstance = null;
    let categoryChartInstance = null;

    function renderMonthlyChart(orders) {
        const ctx = document.getElementById('monthlyChart').getContext('2d');
        if (monthlyChartInstance) monthlyChartInstance.destroy();

        // Aggregate Data
        const dataMap = {};
        orders.forEach(order => {
            const d = new Date(order.date);
            let key;
            // Dynamic grouping based on filter
            if (currentFilter === 'month') {
                // Show days
                key = `${d.getDate()}`;
            } else if (currentFilter === 'year' || currentFilter === 'all') {
                // Show months: Jan 2024
                key = d.toLocaleString('default', { month: 'short', year: '2-digit' });
            } else {
                key = d.toLocaleDateString();
            }

            dataMap[key] = (dataMap[key] || 0) + (parseFloat(order.amount) || 0);
        });

        // Sort Keys (Tricky for mixed formats, simple alpha sort for now or improved later)
        // For monthly (days), numeric sort. For others, maybe just insertion order?
        // Let's try to sort by date object logic if possible, else simple.
        const labels = Object.keys(dataMap);
        const values = labels.map(k => dataMap[k]);

        monthlyChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Spending',
                    data: values,
                    borderColor: '#2874f0',
                    backgroundColor: 'rgba(40, 116, 240, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true, grid: { borderDash: [2, 4] } },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    function renderCategoryChart(orders) {
        const ctx = document.getElementById('categoryChart').getContext('2d');
        if (categoryChartInstance) categoryChartInstance.destroy();

        const categories = {};
        orders.forEach(order => {
            const cat = getCategory(order.productName);
            categories[cat] = (categories[cat] || 0) + (parseFloat(order.amount) || 0);
        });

        // Top 5 + Others
        const sortedCats = Object.entries(categories).sort((a, b) => b[1] - a[1]);
        const top5 = sortedCats.slice(0, 5);
        if (sortedCats.length > 5) {
            const others = sortedCats.slice(5).reduce((sum, item) => sum + item[1], 0);
            top5.push(['Others', others]);
        }

        categoryChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: top5.map(i => i[0]),
                datasets: [{
                    data: top5.map(i => i[1]),
                    backgroundColor: ['#2874f0', '#fb641b', '#ff9f00', '#388e3c', '#878787', '#673ab7'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right', labels: { boxWidth: 12 } }
                },
                cutout: '70%'
            }
        });
    }

    function getCategory(productName) {
        let category = 'Others';
        const name = (productName || '').toLowerCase();

        if (name.includes('mobile') || name.includes('phone') || name.includes('iphone') || name.includes('samsung') || name.includes('redmi')) category = 'Mobiles';
        else if (name.includes('laptop') || name.includes('computer') || name.includes('pc') || name.includes('macbook')) category = 'Laptops';
        else if (name.includes('headphone') || name.includes('earphone') || name.includes('airpods') || name.includes('sony') || name.includes('boat')) category = 'Audio';
        else if (name.includes('shoe') || name.includes('shirt') || name.includes('t-shirt') || name.includes('jeans') || name.includes('pant') || name.includes('watch')) category = 'Fashion';
        else if (name.includes('book')) category = 'Books';
        else if (name.includes('tv') || name.includes('television')) category = 'Appliances';

        return category;
    }

    function renderRecentOrders(orders) {
        const tbody = document.querySelector('#recentOrdersTable tbody');
        tbody.innerHTML = '';

        const sorted = [...orders].sort((a, b) => new Date(b.date) - new Date(a.date));
        const recent = sorted.slice(0, 5);

        recent.forEach(order => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${new Date(order.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                <td><div style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${order.productName}">${order.productName}</div></td>
                <td>${formatCurrency(order.amount)}</td>
                <td><span style="color:#10b981; font-weight:500; font-size:12px; background:#ecfdf5; padding:4px 8px; border-radius:4px">${order.status || 'Delivered'}</span></td>
            `;
            tbody.appendChild(tr);
        });
    }

    function renderAllOrders(orders) {
        const tbody = document.querySelector('#allOrdersTable tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        // Sort Date Desc
        const sorted = [...orders].sort((a, b) => new Date(b.date) - new Date(a.date));

        sorted.forEach(order => {
            const tr = document.createElement('tr');
            const d = new Date(order.date);
            // Validating date
            const dateStr = !isNaN(d.getTime()) ? d.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) : order.date;

            tr.innerHTML = `
                <td>${dateStr}</td>
                <td><div style="max-width: 300px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${order.productName}">${order.productName}</div></td>
                <td>${formatCurrency(order.amount)}</td>
                <td><span style="color:#334155;">${order.status || 'Delivered'}</span></td>
            `;
            tbody.appendChild(tr);
        });
    }

    function renderBrandsTable(orders) {
        const tbody = document.querySelector('#brandsTable tbody');
        const thead = document.querySelector('#brandsTable thead tr th:first-child');
        if (thead) thead.textContent = 'Brand'; // Update header dynamically

        if (!tbody) return;
        tbody.innerHTML = '';

        const brands = {};
        let totalAmount = 0;

        orders.forEach(order => {
            const brand = getBrand(order.productName);
            if (!brands[brand]) brands[brand] = { count: 0, amount: 0 };
            brands[brand].count++;
            brands[brand].amount += parseFloat(order.amount) || 0;
            totalAmount += parseFloat(order.amount) || 0;
        });

        const sortedBrands = Object.entries(brands).sort((a, b) => b[1].amount - a[1].amount);

        // Show Top 10 + Others
        const topBrands = sortedBrands.slice(0, 10);
        if (sortedBrands.length > 10) {
            const othersAmount = sortedBrands.slice(10).reduce((sum, item) => sum + item[1].amount, 0);
            const othersCount = sortedBrands.slice(10).reduce((sum, item) => sum + item[1].count, 0);
            topBrands.push(['Others', { amount: othersAmount, count: othersCount }]);
        }

        topBrands.forEach(([brand, data]) => {
            const percentage = totalAmount > 0 ? ((data.amount / totalAmount) * 100).toFixed(1) : 0;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><span style="font-weight:500">${brand}</span></td>
                <td>${formatCurrency(data.amount)}</td>
                <td>${data.count}</td>
                <td>
                    <div style="display:flex; align-items:center; gap:8px">
                        <div style="flex:1; height:6px; background:#e2e8f0; border-radius:3px; max-width:100px">
                            <div style="width:${percentage}%; height:100%; background:var(--primary); border-radius:3px"></div>
                        </div>
                        <span style="font-size:12px; color:var(--text-muted)">${percentage}%</span>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    function getBrand(productName) {
        if (!productName) return 'Unknown';
        // Heuristic: First word is usually the brand
        const words = productName.trim().split(' ');
        let brand = words[0];

        // Cleanup common artifacts
        brand = brand.replace(/[^a-zA-Z0-9]/g, '');

        if (brand.length < 2 && words.length > 1) {
            brand = words[0] + ' ' + words[1];
        }

        // Capitalize
        return brand.charAt(0).toUpperCase() + brand.slice(1).toLowerCase();
    }
});
