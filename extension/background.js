/**
 * Open side panel on action click; cache latest listing extract.
 */
chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) return;

  if (msg.type === 'LISTING_EXTRACTED') {
    chrome.storage.session.set({
      latestListing: {
        ...msg.payload,
        tabId: sender.tab && sender.tab.id,
        capturedAt: Date.now(),
      },
    }).then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (msg.type === 'GET_LATEST_LISTING') {
    chrome.storage.session.get(['latestListing']).then((data) => {
      sendResponse({ ok: true, listing: data.latestListing || null });
    });
    return true;
  }

  if (msg.type === 'REQUEST_EXTRACT') {
    const tabId = msg.tabId;
    if (!tabId) {
      sendResponse({ ok: false, error: 'No tab' });
      return;
    }
    chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_NOW' }, (res) => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      sendResponse(res || { ok: false });
    });
    return true;
  }
});
