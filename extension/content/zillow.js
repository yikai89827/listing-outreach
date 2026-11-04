(function () {
  const { textOf, firstMatch, meta, phoneFromText, postListing } = window.__LO;

  function parseNamePhone(raw) {
    const t = String(raw || '')
      .replace(/^Listed by:?/i, '')
      .replace(/,\s*$/, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!t) return { name: '', phone: '' };
    const phone = phoneFromText(t);
    let name = t;
    if (phone) {
      const idx = t.indexOf(phone);
      name = (idx >= 0 ? t.slice(0, idx) : t).replace(/[,\s]+$/g, '').trim();
    }
    // Drop trailing brokerage fragments if name somehow includes them
    name = name.split(',')[0].trim();
    if (name.length > 80) name = name.slice(0, 80);
    return { name, phone };
  }

  function fromAttributionDom() {
    const agentEl = document.querySelector(
      '[data-testid="attribution-LISTING_AGENT"], [data-testid="attribution-AGENT"]'
    );
    if (agentEl) {
      const parsed = parseNamePhone(textOf(agentEl));
      if (parsed.name || parsed.phone) return parsed;
    }
    const seller = document.querySelector(
      '[data-testid="seller-attribution"], [data-testid="listing-attribution-overview"]'
    );
    if (seller) {
      const parsed = parseNamePhone(textOf(seller));
      if (parsed.name || parsed.phone) return parsed;
    }
    return { name: '', phone: '' };
  }

  function fromNextData() {
    try {
      const el = document.getElementById('__NEXT_DATA__');
      if (!el || !el.textContent) return { name: '', phone: '' };
      const data = JSON.parse(el.textContent);
      const cache = data && data.props && data.props.pageProps && data.props.pageProps.componentProps
        && data.props.pageProps.componentProps.gdpClientCache;
      const parsedCache = typeof cache === 'string' ? JSON.parse(cache) : cache;
      if (!parsedCache || typeof parsedCache !== 'object') return { name: '', phone: '' };
      const first = Object.values(parsedCache)[0];
      const info = first && first.property && first.property.attributionInfo;
      if (!info) return { name: '', phone: '' };
      const name = info.agentName || info.listingAgentAttributionContact || '';
      const phone =
        info.agentPhoneNumber ||
        info.brokerPhoneNumber ||
        info.listingAttributionContact ||
        '';
      return {
        name: String(name || '').trim(),
        phone: String(phone || '').trim(),
      };
    } catch (e) {
      return { name: '', phone: '' };
    }
  }

  function fromLegacyBlocks() {
    let agentName = '';
    let agentPhone = '';
    const agentBlocks = document.querySelectorAll(
      '[data-testid*="agent" i], [data-testid*="Agent"], [class*="Agent"], [class*="listing-agent"], aside, [class*="Contact"]'
    );
    agentBlocks.forEach((block) => {
      if (agentName && agentPhone) return;
      const t = textOf(block);
      if (
        /listing\s*agent|listed by|buyer.?s agent|contact/i.test(t) ||
        block.querySelector('a[href^="tel:"]')
      ) {
        const nameEl = block.querySelector(
          'a[href*="/profile/"], [class*="name"], strong, h2, h3, [data-testid="attribution-LISTING_AGENT"]'
        );
        if (!agentName && nameEl) {
          const parsed = parseNamePhone(textOf(nameEl));
          agentName = parsed.name || textOf(nameEl);
          if (!agentPhone && parsed.phone) agentPhone = parsed.phone;
        }
        const tel = block.querySelector('a[href^="tel:"]');
        if (tel) agentPhone = (tel.getAttribute('href') || '').replace(/^tel:/i, '');
        if (!agentPhone) agentPhone = phoneFromText(t);
        if (!agentName) {
          const parsed = parseNamePhone(t);
          if (parsed.name) agentName = parsed.name;
        }
      }
    });
    if (!agentPhone) {
      const tel = document.querySelector('a[href^="tel:"]');
      if (tel) agentPhone = (tel.getAttribute('href') || '').replace(/^tel:/i, '');
    }
    return { name: agentName, phone: agentPhone };
  }

  function extract() {
    const url = location.href;
    if (!/zillow\.com/i.test(url)) return null;

    const address =
      textOf(
        firstMatch([
          'h1[data-test="property-card-addr"]',
          'h1[class*="Text-"]',
          '[data-testid="address-line"]',
          'h1',
        ])
      ) ||
      meta('og:title').split('|')[0].trim() ||
      meta('twitter:title');

    const price =
      textOf(
        firstMatch([
          '[data-testid="price"]',
          '[data-test="property-card-price"]',
          'span[data-testid="price"]',
          '.summary-container span',
        ])
      ) || '';

    const attr = fromAttributionDom();
    const next = fromNextData();
    const legacy = fromLegacyBlocks();

    const agentName = attr.name || next.name || legacy.name || '';
    const agentPhone = attr.phone || next.phone || legacy.phone || '';

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
