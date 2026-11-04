(function () {
  function textOf(el) {
    return el ? String(el.textContent || '').replace(/\s+/g, ' ').trim() : '';
  }

  function firstMatch(selectors) {
    for (let i = 0; i < selectors.length; i++) {
      const el = document.querySelector(selectors[i]);
      if (el) return el;
    }
    return null;
  }

  function meta(prop) {
    const el =
      document.querySelector('meta[property="' + prop + '"]') ||
      document.querySelector('meta[name="' + prop + '"]');
    return el ? el.getAttribute('content') || '' : '';
  }

  function phoneFromText(s) {
    const m = String(s || '').match(/(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
    return m ? m[0].replace(/\s+/g, ' ').trim() : '';
  }

  function postListing(payload) {
    try {
      chrome.runtime.sendMessage({ type: 'LISTING_EXTRACTED', payload });
    } catch (e) {}
  }

  window.__LO = {
    textOf,
    firstMatch,
    meta,
    phoneFromText,
    postListing,
  };

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === 'EXTRACT_NOW' && typeof window.__LO_EXTRACT__ === 'function') {
      try {
        const payload = window.__LO_EXTRACT__();
        if (payload) window.__LO.postListing(payload);
        sendResponse({ ok: !!payload, listing: payload || null });
      } catch (e) {
        sendResponse({ ok: false, error: String(e && e.message ? e.message : e) });
      }
      return true;
    }
  });
})();
