chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'openDashboard') {
        chrome.tabs.create({ url: 'dashboard/index.html' });
    } else if (request.action === 'fetchPage') {
        // Proxy fetch to bypass CORS
        fetch(request.url, {
            credentials: 'include',
            referrer: 'https://www.flipkart.com/',
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Upgrade-Insecure-Requests': '1',
                'Cache-Control': 'max-age=0'
            }
        })
            .then(response => {
                // Check if redirected to login
                if (response.redirected && response.url.includes('login')) {
                    return { success: false, error: 'Not logged in (Redirected)' };
                }
                if (!response.ok) {
                    return { success: false, error: `Network error: ${response.status}` };
                }
                return response.text().then(text => ({ success: true, data: text }));
            })
            .then(result => sendResponse(result))
            .catch(err => sendResponse({ success: false, error: err.message }));

        return true; // Keep channel open for async response
    }

    // Also listen for scraping updates to maybe update badge
    if (request.action === 'scrapeProgress') {
        chrome.action.setBadgeText({ text: String(request.count) });
        chrome.action.setBadgeBackgroundColor({ color: '#2874f0' });
    } else if (request.action === 'scrapeComplete') {
        chrome.action.setBadgeText({ text: 'Done' });
        setTimeout(() => chrome.action.setBadgeText({ text: '' }), 5000);
    }
});
