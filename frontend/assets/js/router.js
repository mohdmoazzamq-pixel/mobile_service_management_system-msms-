/**
 * MSMS Frontend Client-Side SPA Router & Navigation Controller
 * Handles smooth page-to-page navigation, clean URL routing,
 * history pushState/popstate, and fallback/404 handling.
 */

(function () {
  'use strict';

  const MSMSRouter = {
    initialized: false,

    // Route alias mapping for clean URLs <-> file paths
    routeMap: {
      '/': '/index.html',
      '/index': '/index.html',
      '/login': '/login.html',
      '/register': '/register.html',
      '/forgot-password': '/forgot-password.html',
      '/reset-password': '/reset-password.html',
      '/404': '/404.html',
      '/customer': '/customer/index.html',
      '/customer/': '/customer/index.html',
      '/customer/index': '/customer/index.html',
      '/customer/dashboard': '/customer/index.html',
      '/customer/book': '/customer/book.html',
      '/customer/devices': '/customer/devices.html',
      '/customer/tracking': '/customer/tracking.html',
      '/customer/invoices': '/customer/invoices.html',
      '/customer/feedback': '/customer/feedback.html',
      '/admin': '/admin/index.html',
      '/admin/': '/admin/index.html',
      '/admin/index': '/admin/index.html',
      '/admin/dashboard': '/admin/index.html',
      '/admin/bookings': '/admin/bookings.html',
      '/admin/customers': '/admin/customers.html',
      '/admin/inventory': '/admin/inventory.html',
      '/admin/invoices': '/admin/invoices.html',
      '/admin/reports': '/admin/reports.html',
      '/admin/services': '/admin/services.html',
      '/admin/technicians': '/admin/technicians.html',
      '/technician': '/technician/index.html',
      '/technician/': '/technician/index.html',
      '/technician/index': '/technician/index.html',
      '/technician/dashboard': '/technician/index.html',
      '/technician/repair-detail': '/technician/repair-detail.html'
    },

    resolvePath(path) {
      if (!path) return '/index.html';
      const clean = path.split('?')[0].split('#')[0];
      // Check if alias exists
      if (this.routeMap[clean]) {
        return this.routeMap[clean];
      }
      if (this.routeMap[clean.replace(/\/$/, '')]) {
        return this.routeMap[clean.replace(/\/$/, '')];
      }
      // If path doesn't end with .html and not an asset/api, try appending .html
      if (!clean.endsWith('.html') && !clean.includes('.')) {
        return clean + '.html';
      }
      return clean;
    },

    async navigate(targetUrl, options = { pushState: true }) {
      if (!targetUrl) return;

      // Split URL into path, query, hash
      const parser = document.createElement('a');
      parser.href = targetUrl;

      // Handle pure hash links (e.g. #services, #tracking)
      if (parser.pathname === window.location.pathname && parser.hash && !parser.search) {
        const elem = document.querySelector(parser.hash);
        if (elem) {
          elem.scrollIntoView({ behavior: 'smooth' });
          if (options.pushState) history.pushState(null, '', parser.hash);
          return;
        }
      }

      const rawPath = parser.pathname;
      const queryString = parser.search;
      const hash = parser.hash;
      const fullTarget = rawPath + queryString + hash;

      // Check if same URL
      if (fullTarget === (window.location.pathname + window.location.search + window.location.hash) && !options.force) {
        return;
      }

      const resolvedFetchPath = this.resolvePath(rawPath);

      try {
        // Show subtle loading indicator
        this.showLoadingIndicator();

        const response = await fetch(resolvedFetchPath, {
          headers: { 'X-Requested-With': 'MSMS-Router' }
        });

        if (!response.ok) {
          // If 404, try loading 404.html
          if (response.status === 404) {
            const notFoundRes = await fetch('/404.html').catch(() => null);
            if (notFoundRes && notFoundRes.ok) {
              const html = await notFoundRes.text();
              this.applyPage(html, '/404.html', options.pushState ? targetUrl : null);
              this.hideLoadingIndicator();
              return;
            }
          }
          // Fallback to normal navigation
          window.location.href = targetUrl;
          return;
        }

        const html = await response.text();
        this.applyPage(html, fullTarget, options.pushState ? fullTarget : null);
        this.hideLoadingIndicator();

        if (hash) {
          setTimeout(() => {
            const targetElem = document.querySelector(hash);
            if (targetElem) targetElem.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        } else {
          window.scrollTo(0, 0);
        }

      } catch (err) {
        console.warn('[MSMS Router] SPA transition failed, falling back to full navigation:', err);
        window.location.href = targetUrl;
      }
    },

    applyPage(html, displayUrl, pushUrl) {
      const doc = new DOMParser().parseFromString(html, 'text/html');

      // Update Document Title
      if (doc.title) {
        document.title = doc.title;
      }

      // If pushUrl is provided, update browser history
      if (pushUrl) {
        history.pushState({ path: pushUrl }, doc.title || '', pushUrl);
      }

      // Check for main element or body content
      const newMain = doc.querySelector('main');
      const curMain = document.querySelector('main');

      // Check for modals in body that might be outside main
      const newModals = doc.querySelectorAll('.modal');
      // Clean up existing open modals / backdrops
      document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
      document.body.classList.remove('modal-open');
      document.body.style.removeProperty('padding-right');
      document.body.style.removeProperty('overflow');

      if (newMain && curMain) {
        // Swap main content
        curMain.innerHTML = newMain.innerHTML;
        // Copy any attributes on main
        Array.from(newMain.attributes).forEach(attr => {
          curMain.setAttribute(attr.name, attr.value);
        });

        // Sync navigation active links
        this.updateNavLinks(displayUrl, doc);

        // Update modals container or append modals
        document.querySelectorAll('body > .modal').forEach(m => m.remove());
        newModals.forEach(m => {
          document.body.appendChild(m.cloneNode(true));
        });

      } else {
        // Full body swap
        document.body.innerHTML = doc.body.innerHTML;
        // Copy body class and attributes
        document.body.className = doc.body.className;
      }

      // Re-initialize dynamic navigation / auth bar
      if (window.Auth && typeof window.Auth.initNav === 'function') {
        window.Auth.initNav();
      }

      // Re-bind click intercepts on newly loaded DOM elements
      this.bindInterceptors();

      // Execute newly injected inline scripts
      this.executeScripts(doc);

      // Dispatch route change events
      window.dispatchEvent(new CustomEvent('msms:routechange', { detail: { url: displayUrl } }));
      document.dispatchEvent(new Event('DOMContentLoaded'));
    },

    updateNavLinks(targetUrl, newDoc) {
      // If newDoc has a navbar, match active items
      const newNav = newDoc.querySelector('.navbar');
      const curNav = document.querySelector('.navbar');
      if (newNav && curNav) {
        const curNavLinks = curNav.querySelectorAll('.nav-link');
        curNavLinks.forEach(link => {
          const href = link.getAttribute('href');
          if (href && targetUrl.includes(href.split('?')[0])) {
            link.classList.add('active');
          } else {
            link.classList.remove('active');
          }
        });
      }
    },

    executeScripts(doc) {
      const scripts = doc.querySelectorAll('script');
      scripts.forEach(s => {
        // Only run inline scripts that are not external bundles already loaded
        if (!s.src && s.textContent.trim()) {
          try {
            // Execute inside Function scope to prevent variable re-declaration errors across SPA transitions
            const fn = new Function(s.textContent);
            fn();
          } catch (e) {
            console.error('[MSMS Router] Script execution error:', e);
          }
        }
      });
    },

    showLoadingIndicator() {
      let bar = document.getElementById('router-progress-bar');
      if (!bar) {
        bar = document.createElement('div');
        bar.id = 'router-progress-bar';
        bar.style.cssText = 'position:fixed;top:0;left:0;height:3px;background:#2563eb;z-index:99999;transition:width 0.2s ease;width:0%;box-shadow:0 0 8px rgba(37,99,235,0.6);';
        document.body.appendChild(bar);
      }
      bar.style.width = '30%';
      setTimeout(() => {
        if (bar) bar.style.width = '75%';
      }, 100);
    },

    hideLoadingIndicator() {
      const bar = document.getElementById('router-progress-bar');
      if (bar) {
        bar.style.width = '100%';
        setTimeout(() => {
          bar.remove();
        }, 200);
      }
    },

    bindInterceptors() {
      // Intercept clicks on links
      document.querySelectorAll('a').forEach(a => {
        if (a._hasRouterBound) return;
        a._hasRouterBound = true;

        a.addEventListener('click', (e) => {
          const href = a.getAttribute('href');
          const target = a.getAttribute('target');

          // Ignore special links, modals, or target="_blank"
          if (!href || href === '#' || href.startsWith('javascript:') || href.startsWith('http:') || href.startsWith('https:') || href.startsWith('mailto:') || href.startsWith('tel:') || target === '_blank' || a.hasAttribute('data-bs-toggle') || a.hasAttribute('data-bs-dismiss')) {
            return;
          }

          // Hash links on same page
          if (href.startsWith('#')) {
            const elem = document.querySelector(href);
            if (elem) {
              e.preventDefault();
              elem.scrollIntoView({ behavior: 'smooth' });
              history.pushState(null, '', href);
            }
            return;
          }

          e.preventDefault();
          this.navigate(href);
        });
      });

      // Intercept elements with data-navigate or data-href
      document.querySelectorAll('[data-navigate], [data-href]').forEach(el => {
        if (el._hasRouterBound) return;
        el._hasRouterBound = true;
        el.style.cursor = 'pointer';

        el.addEventListener('click', (e) => {
          const targetUrl = el.getAttribute('data-navigate') || el.getAttribute('data-href');
          if (targetUrl) {
            e.preventDefault();
            this.navigate(targetUrl);
          }
        });
      });
    },

    init() {
      if (this.initialized) return;
      this.initialized = true;

      // Bind popstate for browser back/forward buttons
      window.addEventListener('popstate', (e) => {
        const target = window.location.pathname + window.location.search + window.location.hash;
        this.navigate(target, { pushState: false, force: true });
      });

      // Initial binding
      this.bindInterceptors();

      // Observer for dynamically added buttons/links
      const observer = new MutationObserver(() => {
        this.bindInterceptors();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
  };

  // Expose globally
  window.MSMSRouter = MSMSRouter;
  window.navigate = function (url) {
    MSMSRouter.navigate(url);
  };

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => MSMSRouter.init());
  } else {
    MSMSRouter.init();
  }
})();
