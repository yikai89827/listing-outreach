(function () {
  const { textOf, firstMatch, meta, phoneFromText, postListing } = window.__LO;

  function extract() {
    const url = location.href;
    if (!/zillow\.com/i.test(url)) return null;

    const address =
      textOf(firstMatch([
        'h1[data-test="property-card-addr"]',
        'h1[class*="Text-"]',
        '[data-testid="address-line"]',
        'h1',
      ])) ||
      meta('og:title').split('|')[0].trim() ||
      meta('twitter:title');

    const price =
      textOf(firstMatch([
        '[data-testid="price"]',
        '[data-test="property-card-price"]',
        'span[data-testid="price"]',
        '.summary-container span',
      ])) || '';

    let agentName = '';
    let agentPhone = '';
    const agentBlocks = document.querySelectorAll(
      '[data-testid*="agent"], [class*="Agent"], [class*="listing-agent"], aside, [class*="Contact"]'
    );
    agentBlocks.forEach((block) => {
      if (agentName && agentPhone) return;
      const t = textOf(block);
      if (/listing\s*agent|buyer.?s agent|contact/i.test(t) || block.querySelector('a[href^="tel:"]')) {
        const nameEl = block.querySelector('a[href*="/profile/"], [class*="name"], strong, h2, h3');
        if (!agentName && nameEl) agentName = textOf(nameEl);
        const tel = block.querySelector('a[href^="tel:"]');
        if (tel) agentPhone = (tel.getAttribute('href') || '').replace(/^tel:/i, '');
        if (!agentPhone) agentPhone = phoneFromText(t);
      }
    });

    if (!agentPhone) {
      const tel = document.querySelector('a[href^="tel:"]');
      if (tel) agentPhone = (tel.getAttribute('href') || '').replace(/^tel:/i, '');
    }

    const payload = {
      source: 'zillow',
      url,
      address: address.slice(0, 200),
      price: price.slice(0, 40),
      agentName: agentName.slice(0, 80),
      agentPhone: agentPhone.slice(0, 40),
      agentEmail: '',
    };

    if (!payload.address && !payload.price) return null;
    return payload;
  }

  window.__LO_EXTRACT__ = extract;

  function tick() {
    const p = extract();
    if (p) postListing(p);
  }

  tick();
  const obs = new MutationObserver(() => {
    clearTimeout(window.__LO_Z_T__);
    window.__LO_Z_T__ = setTimeout(tick, 800);
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
})();
