# 🛒 Fliplytics: Flipkart Order Analytics & Expense Tracker

Fliplytics is a powerful, privacy-focused Chrome Extension that helps you visualize and track your spending habits on Flipkart. It provides a comprehensive dashboard with detailed insights, charts, and brand analysis—all running locally on your device.

![Fliplytics Banner](dashboard/icon128.png) <!-- Update with actual screenshot or banner if available -->

---

## ✨ Features

- **💰 Expense Tracking**: Automatically calculates total lifetime spending on Flipkart.
- **📦 Order History**: View your complete order history in a clean, searchable interface.
- **📊 Interactive Dashboard**: Visualize spending trends with monthly charts and category splits.
- **🏷️ Brand Analytics**: Discover which brands you shop from the most.
- **🔒 Privacy First**: All data is processed locally in your browser. No data is sent to external servers.
- **🌙 Modern UI**: A sleek, responsive dashboard designed for readability.
- **🔄 Smart Sync**: Automatically syncs your order history in the background.

---

## 🛠️ Tech Stack

Built with modern web technologies:
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Visualization**: [Chart.js](https://www.chartjs.org/) for beautiful, responsive charts
- **Extension API**: Chrome Manifest V3 (Service Workers, Storage API)
- **Styling**: Custom CSS with responsive design principles

---

## 🚀 How to Install

Since this extension is in developer mode, follow these steps to install it on your Chrome or Edge browser:

1. **Download the Code**: Clone this repository or download the ZIP file and extract it to a folder.
2. **Open Extensions Page**:
   - In Chrome, go to `chrome://extensions/`
   - In Edge, go to `edge://extensions/`
3. **Enable Developer Mode**: Toggle the "Developer mode" switch in the top right corner.
4. **Load Unpacked**:
   - Click the "Load unpacked" button.
   - Select the folder where you extracted the Fliplytics files (the folder containing `manifest.json`).
5. **Pin the Extension**: Click the puzzle icon in your browser toolbar and pin **Fliplytics**.

---

## 📖 How to Use

1. **Log in to Flipkart**: Ensure you are logged into your [Flipkart account](https://www.flipkart.com/).
2. **Open the Dashboard**: Click the Fliplytics extension icon and select **"Open Dashboard"**.
3. **Sync Orders**:
   - In the dashboard, click the **"Sync Orders"** button.
   - The extension will fetch your order history in the background. This may take a few moments depending on your order volume.
4. **Explore Insights**:
   - Check the **Overview** for total spending and trends.
   - Use the **Orders** tab to search for specific purchases.
   - Visit the **Analytics** tab to see your top brands and categories.

---

## 🛡️ Privacy & Security

Fliplytics operates entirely on your local machine.
- **No External Servers**: Your order data never leaves your browser.
- **Local Storage**: Data is stored securely in your browser's local storage.
- **Permissions**: The extension only requests permission to access `flipkart.com` to fetch your order history.

---

## 👨‍💻 Credits & Attribution

**Developed with ❤️ from Kerala**

- **Developer**: Sankaranarayanan KV
- **Feedback & Support**: [Your Email/Contact Link]

*Disclaimer: This project is not affiliated with or endorsed by Flipkart. It is an independent tool for personal analytics.*
