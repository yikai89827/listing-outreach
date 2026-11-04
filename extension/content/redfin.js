(function () {
  const { textOf, firstMatch, meta, phoneFromText, postListing } = window.__LO;

  function extract() {
    const url = location.href;
    if (!/redfin\.com/i.test(url)) return null;

    const address =
      textOf(firstMatch([
        'h1.fullAddress',
        'h1[data-rf-test-id="abp-streetLine"]',
        '[data-rf-test-id="abp-streetLine"]',
        'h1',
      ])) ||
      meta('og:title').split(',')[0].trim();

    const cityLine = textOf(firstMatch([
      '[data-rf-test-id="abp-cityStateZip"]',
      '.cityStateZip',
    ]));

    const price = textOf(firstMatch([
      '[data-rf-test-id="abp-price"]',
      '.statsValue',
      '[class*="price"]',
    ]));

    let agentName = '';
    let agentPhone = '';
    document.querySelectorAll('[class*="agent"], [data-rf-test-id*="agent"], .listingAgent').forEach((block) => {
      if (agentName && agentPhone) return;
      const t = textOf(block);
      const nameEl = block.querySelector('a, .agent-name, [class*="Name"]');
      if (nameEl) agentName = textOf(nameEl);
      const tel = block.querySelector('a[href^="tel:"]');
      if (tel) agentPhone = (tel.getAttribute('href') || '').replace(/^tel:/i, '');
      if (!agentPhone) agentPhone = phoneFromText(t);
    });

    if (!agentPhone) {
      const tel = document.querySelector('a[href^="tel:"]');
      if (tel) agentPhone = (tel.getAttribute('href') || '').replace(/^tel:/i, '');
    }

    const fullAddress = [address, cityLine].filter(Boolean).join(', ');

    const payload = {
      source: 'redfin',
      url,
      address: fullAddress.slice(0, 200),
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
    clearTimeout(window.__LO_R_T__);
    window.__LO_R_T__ = setTimeout(tick, 800);
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
})();
