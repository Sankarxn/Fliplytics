chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'startScraping') {
        createDebugOverlay();
        updateDebugStatus("Starting scrape...");
        startScraping();
        sendResponse({ status: 'started' });
    }
});

let debugOverlay = null;

function createDebugOverlay() {
    if (document.getElementById('fliplytics-debug')) return;
    const div = document.createElement('div');
    div.id = 'fliplytics-debug';
    div.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #2874f0;
        color: white;
        padding: 16px;
        border-radius: 8px;
        z-index: 99999;
        font-family: sans-serif;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        max-width: 300px;
        font-size: 14px;
    `;
    div.innerHTML = `<strong>Fliplytics Sync</strong><br><span id="fliplytics-status">Initializing...</span>`;
    document.body.appendChild(div);
    debugOverlay = div;
}

function updateDebugStatus(text) {
    if (!debugOverlay) createDebugOverlay();
    const el = document.getElementById('fliplytics-status');
    if (el) el.textContent = text;
    console.log(`[Fliplytics] ${text}`);
}

async function startScraping() {
    let allOrders = [];
    let page = 1;
    let hasNext = true;

    // Notify backend
    chrome.runtime.sendMessage({ action: 'scrapeStarted' });

    while (hasNext) {
        updateDebugStatus(`Scraping Page ${page}...`);

        // Wait a bit for dynamic content
        await new Promise(r => setTimeout(r, 2000));

        // Scrape current page
        let orders = parseOrders();

        // Fallback strategy if strict parsing fails
        if (orders.length === 0) {
            updateDebugStatus(`Page ${page}: Strict parse failed, trying fallback...`);
            orders = parseOrdersFallback();
        }

        updateDebugStatus(`Page ${page}: Found ${orders.length} orders`);

        allOrders.push(...orders);

        // Notify progress
        chrome.runtime.sendMessage({
            action: 'scrapeProgress',
            count: allOrders.length,
            page: page
        });

        // Check for next button and click
        const nextBtn = findNextButton();
        if (nextBtn) {
            updateDebugStatus(`Page ${page}: Clicking Next...`);
            nextBtn.click();
            // Wait for load - using a smarter wait
            await waitForNewOrders();
            page++;
        } else {
            updateDebugStatus(`Page ${page}: No 'Next' button. Finishing.`);
            hasNext = false;
        }
    }

    // Save to storage
    await chrome.storage.local.set({ orders: allOrders });

    // Notify completion
    chrome.runtime.sendMessage({
        action: 'scrapeComplete',
        total: allOrders.length
    });

    updateDebugStatus(`Done! Scraped ${allOrders.length} orders.`);
    setTimeout(() => {
        if (debugOverlay) debugOverlay.remove();
    }, 5000);

    alert(`Fliplytics: Scraped ${allOrders.length} orders! Check the dashboard.`);
}

function parseOrders() {
    const orders = [];
    // Primary Strategy: a[href*="/order_details"]
    const orderLinks = Array.from(document.querySelectorAll('a[href*="/order_details"]'));
    const processedCards = new Set();

    orderLinks.forEach(link => {
        let card = link.closest('div[class*="row"]');
        if (!card) card = link.closest('div._1AtVbE');
        if (!card) card = link.closest('div');

        if (!card || processedCards.has(card)) return;
        if (!card.contains(link)) return;

        processedCards.add(card);
        const order = extractOrderFromCard(card, link);
        if (order) orders.push(order);
    });

    return orders;
}

function parseOrdersFallback() {
    // Fallback Strategy: Find elements looking like Prices (₹450) and assume they are in an order card
    const orders = [];
    // Look for text nodes starting with ₹
    // This is expensive, so we scope it.
    const candidates = Array.from(document.querySelectorAll('div, span'));
    const processedCards = new Set();

    candidates.forEach(el => {
        if (el.children.length === 0 && el.innerText.includes('₹')) {
            // Potential price node.
            // Traverse up to find a "row" or container.
            let card = el.closest('div[class*="row"]');
            if (!card) return;

            if (processedCards.has(card)) return;

            // Check if it has "Delivered" or "Cancelled" or date
            const text = card.innerText;
            if (text.match(/(Delivered|Cancelled|Returned|Ordered) on/)) {
                processedCards.add(card);
                const order = extractOrderFromCard(card, null); // No link reference
                if (order) orders.push(order);
            }
        }
    });
    return orders;
}

function extractOrderFromCard(card, link) {
    try {
        const textContent = card.innerText || "";

        // Extract Price matches
        const priceMatches = textContent.match(/₹([\d,]+)/g);
        if (!priceMatches) return null;

        // Assume the largest price is the total? Or the first?
        // Usually order total is clear. Let's take the first one.
        const amount = parseFloat(priceMatches[0].replace(/[₹,]/g, ''));

        // Extract Status & Date
        let status = 'Delivered';
        let dateStr = "";

        if (textContent.includes('Cancelled')) {
            status = 'Cancelled';
            const dateMatch = textContent.match(/Cancelled on ([A-Za-z]{3} \d{1,2}(?:, \d{4})?)/);
            dateStr = dateMatch ? dateMatch[1] : "";
        } else if (textContent.includes('Returned') || textContent.includes('Refund')) {
            status = 'Returned';
            const dateMatch = textContent.match(/Returned on ([A-Za-z]{3} \d{1,2}(?:, \d{4})?)/);
            dateStr = dateMatch ? dateMatch[1] : "";
        } else {
            const dateMatch = textContent.match(/Delivered on ([A-Za-z]{3} \d{1,2}(?:, \d{4})?)/);
            dateStr = dateMatch ? dateMatch[1] : "";
        }

        if (!dateStr) {
            const anyDate = textContent.match(/([A-Za-z]{3} \d{1,2}(?:, \d{4})?)/);
            dateStr = anyDate ? anyDate[1] : new Date().toDateString();
        }

        // Extract Name
        let name = "Unknown Product";
        if (link) {
            name = link.innerText.trim();
        } else {
            // Try to find the title link manually
            const titleLink = card.querySelector('a[href*="/order_details"]');
            if (titleLink) name = titleLink.innerText.trim();
            else {
                // First non-empty text node?
                const lines = textContent.split('\n').map(l => l.trim()).filter(l => l.length > 5);
                if (lines.length > 0) name = lines[0];
            }
        }
        name = name.split('\n')[0];

        // Extract Image
        const img = card.querySelector('img');
        const image = img ? img.src : '';

        if (amount > 0) {
            return {
                id: Math.random().toString(36).substr(2, 9),
                date: dateStr,
                amount: amount,
                productName: name,
                imageUrl: image,
                status: status
            };
        }
    } catch (e) {
        console.error("Error extracting order", e);
    }
    return null;
}

function findNextButton() {
    const anchors = Array.from(document.querySelectorAll('a'));
    return anchors.find(el => {
        const text = (el.innerText || "").toUpperCase();
        return text.includes("NEXT");
    });
}

async function waitForNewOrders() {
    await new Promise(r => setTimeout(r, 4000));
}
