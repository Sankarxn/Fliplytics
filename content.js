chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'startScraping') {
        startScraping();
        sendResponse({ status: 'started' });
    }
});

async function startScraping() {
    let allOrders = [];
    let page = 1;
    let hasNext = true;

    // Notify backend
    chrome.runtime.sendMessage({ action: 'scrapeStarted' });

    while (hasNext) {
        // Scrape current page
        const orders = parseOrders();
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
            nextBtn.click();
            // Wait for load
            await new Promise(r => setTimeout(r, 3000)); // Simple wait, ideally distinct wait
            page++;
        } else {
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

    alert(`Flipcart Expenses: Scraped ${allOrders.length} orders! Check the dashboard.`);
}

function parseOrders() {
    const orders = [];
    // Flipkart Order Item Selector (Heuristic: Look for row-like structures)
    // Common class for order row could vary. Let's look for standard structures.
    // Usually each order is in a container.
    // Try to find elements that contain "Delivery" or status text, then traverse up.

    // Strategy: Look for the main order container class usually "_2teB7X" or similar is unstable.
    // Let's rely on finding all elements that look like an order card.

    // Try to find order items by class starting with 'row' or 'col' combined with price?
    // Actually, on /account/orders, each order is a distinct block.

    // Fallback: Use a broad selector and filter.
    const orderCards = document.querySelectorAll('div[class*="row"]'); // Too broad?

    // Better: Look for unique text like 'Rs' or '₹'
    // Or inspect the DOM if we could. Since we can't, let's try a best-effort selector based on known Flipkart classes (which might be outdated) or generic structure.

    // Current Flipkart Order Row Class (often encoded): 
    // Usually they are in a list.
    // Let's try locating by text relative positions.

    // Iterate over all anchor tags that link to /order_details?
    const orderLinks = Array.from(document.querySelectorAll('a[href*="/order_details"]'));
    const processedCards = new Set();

    orderLinks.forEach(link => {
        // Find the designated card container
        const card = link.closest('div'); // The immediate container
        if (!card || processedCards.has(card)) return;
        processedCards.add(card); // Avoid duplicates if multiple links in one card

        try {
            // Extract Date (Usually "Delivered on ...")
            const statusNode = card.innerText.match(/Delivered on ([A-Za-z]{3} \d{1,2}(?:, \d{4})?)/);
            const dateStr = statusNode ? statusNode[1] : new Date().toDateString(); // Fallback

            // Extract Price
            const priceNode = card.innerText.match(/₹[\d,]+/);
            const amount = priceNode ? parseFloat(priceNode[0].replace(/[₹,]/g, '')) : 0;

            // Extract Name
            // Usually the first substantial text in the card or the text inside the link
            const name = link.innerText || "Unknown Product";

            // Extract Image
            const img = card.querySelector('img');
            const image = img ? img.src : '';

            // Extract Status
            const textContent = card.innerText;
            let status = 'Delivered';
            if (textContent.includes('Cancelled')) status = 'Cancelled';
            else if (textContent.includes('Returned')) status = 'Returned';
            else if (textContent.includes('Refund')) status = 'Returned';

            if (amount > 0) {
                orders.push({
                    id: Math.random().toString(36).substr(2, 9),
                    date: dateStr,
                    amount: amount,
                    productName: name,
                    imageUrl: image,
                    status: status
                });
            }
        } catch (e) {
            console.error("Error parsing card", e);
        }
    });

    return orders;
}

function findNextButton() {
    // Look for a link with text "Next"
    const links = Array.from(document.querySelectorAll('a, button'));
    return links.find(el => el.innerText.includes('Next') || el.innerText.includes('NEXT'));
}
