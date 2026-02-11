document.addEventListener('DOMContentLoaded', () => {
    const dashboardBtn = document.getElementById('dashboardBtn');

    dashboardBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'openDashboard' });
    });
});
