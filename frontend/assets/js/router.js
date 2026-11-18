/**
 * MSMS Frontend Client-Side SPA Router & Navigation Controller
 * Handles smooth page-to-page navigation, clean URL routing,
 * history pushState/popstate, and fallback/404 handling.
 */

(function () {
  'use strict';

  // Prevent duplicate router initialization if already active
  if (window.MSMSRouter && window.MSMSRouter.initialized) {
    return;
  }

  const MSMSRouter = {
    initialized: false,
    _navSequence: 0,
    _progressTimer: null,

    // Route alias mapping for clean URLs <-> file paths
    routeMap: {
      '/': '/index.html',
      '/index': '/index.html',
      '/index.html': '/index.html',
      '/frontend': '/index.html',
      '/frontend/': '/index.html',
      '/frontend/index': '/index.html',
      '/frontend/index.html': '/index.html',
      '/login': '/login.html',
      '/login.html': '/login.html',
      '/register': '/register.html',
      '/register.html': '/register.html',
      '/forgot-password': '/forgot-password.html',
      '/forgot-password.html': '/forgot-password.html',
      '/reset-password': '/reset-password.html',
      '/reset-password.html': '/reset-password.html',
      '/404': '/404.html',
      '/404.html': '/404.html',
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

    isHomeRoute(path) {
      if (!path) return true;
      const clean = path.split('?')[0].split('#')[0].trim().replace(/^\.\//, '/');
      const normalized = clean.startsWith('/') ? clean : '/' + clean;
      return (
        normalized === '/' ||
        normalized === '/index' ||
        normalized === '/index.html' ||
        normalized === '/frontend' ||
        normalized === '/frontend/' ||
        normalized === '/frontend/index' ||
        normalized === '/frontend/index.html'
      );
    },

    normalizePath(path) {
      if (this.isHomeRoute(path)) {
        return '/';
      }
      let clean = (path || '').split('?')[0].split('#')[0].trim().replace(/^\.\//, '/');
      if (!clean.startsWith('/')) clean = '/' + clean;
      if (clean.startsWith('/frontend/')) {
        clean = clean.replace(/^\/frontend/, '');
      }
      return clean || '/';
    },

    resolvePath(path) {
      if (this.isHomeRoute(path)) {
        if (window.location.pathname.startsWith('/frontend/')) {
          return '/frontend/index.html';
        }
        return '/index.html';
      }
      const clean = this.normalizePath(path);
      let resolved = this.routeMap[clean] || this.routeMap[clean.replace(/\/$/, '')];
      if (!resolved) {
        resolved = (!clean.endsWith('.html') && !clean.includes('.')) ? clean + '.html' : clean;
      }
      if (window.location.pathname.startsWith('/frontend/') && !resolved.startsWith('/frontend/')) {
        resolved = '/frontend' + (resolved.startsWith('/') ? resolved : '/' + resolved);
      }
      return resolved;
    },

    async navigate(targetUrl, options = { pushState: true }) {
      if (!targetUrl) return;

      const currentNav = ++this._navSequence;

      // Split URL into path, query, hash
      const parser = document.createElement('a');
      parser.href = targetUrl;

      // Handle pure hash links (e.g. #services, #tracking)
      if (parser.pathname === window.location.pathname && parser.hash && !parser.search) {
        try {
          const elem = document.querySelector(parser.hash);
          if (elem) {
            elem.scrollIntoView({ behavior: 'smooth' });
            if (options.pushState) history.pushState(null, '', parser.hash);
            return;
          }
        } catch (_) {}
      }

      const rawPath = parser.pathname;
      const queryString = parser.search || '';
      const hash = parser.hash || '';

      // Determine canonical display URL and normalized target
      const isHome = this.isHomeRoute(rawPath);
      const normalizedPath = isHome ? '/' : this.normalizePath(rawPath);
      const fullTarget = normalizedPath + queryString + hash;

      // Compare against current location
      const currentNormalized = this.normalizePath(window.location.pathname);
      const currentFull = currentNormalized + window.location.search + window.location.hash;

      // Check if same URL
      if (fullTarget === currentFull && !options.force) {
        return;
      }

      const resolvedFetchPath = this.resolvePath(rawPath);

      try {
        // Show subtle loading indicator
        this.showLoadingIndicator();

        let response = await fetch(resolvedFetchPath, {
          headers: { 'X-Requested-With': 'MSMS-Router' }
        });

        // Resilient fallback for home route
        if (!response.ok && isHome) {
          const fallbacks = ['/index.html', '/frontend/index.html', '/', 'index.html'];
          for (const fb of fallbacks) {
            if (fb === resolvedFetchPath) continue;
            try {
              const fbRes = await fetch(fb, { headers: { 'X-Requested-With': 'MSMS-Router' } });
              if (fbRes.ok) {
                response = fbRes;
                break;
              }
            } catch (_) {}
          }
        }

        // Abort if another navigation was requested in the meantime
        if (currentNav !== this._navSequence) {
          return;
        }

        if (!response.ok) {
          // If 404, try loading 404.html
          if (response.status === 404) {
            const notFoundRes = await fetch('/404.html').catch(() => null);
            if (notFoundRes && notFoundRes.ok) {
              const html = await notFoundRes.text();
              this.applyPage(html, '/404.html', options.pushState ? '/404' : null);
              this.hideLoadingIndicator();
              return;
            }
          }
          // Fallback to normal navigation
          window.location.href = isHome ? '/' : targetUrl;
          return;
        }

        const html = await response.text();
        if (currentNav !== this._navSequence) return;

        this.applyPage(html, fullTarget, options.pushState ? fullTarget : null);
        this.hideLoadingIndicator();

        if (hash) {
          setTimeout(() => {
            try {
              const targetElem = document.querySelector(hash);
              if (targetElem) targetElem.scrollIntoView({ behavior: 'smooth' });
            } catch (_) {}
          }, 100);
        } else {
          window.scrollTo(0, 0);
        }

      } catch (err) {
        console.warn('[MSMS Router] SPA transition failed, falling back to full navigation:', err);
        window.location.href = isHome ? '/' : targetUrl;
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

      // Clean up existing open bootstrap modals & backdrops
      document.querySelectorAll('.modal.show').forEach(m => {
        const inst = window.bootstrap?.Modal?.getInstance(m);
        if (inst) {
          try { inst.hide(); } catch (_) {}
        }
      });
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

        // If navbar differs across portals, swap navbar too
        const newNav = doc.querySelector('.navbar');
        const curNav = document.querySelector('.navbar');
        if (newNav && curNav && newNav.querySelector('.navbar-brand')?.getAttribute('href') !== curNav.querySelector('.navbar-brand')?.getAttribute('href')) {
          curNav.innerHTML = newNav.innerHTML;
          Array.from(newNav.attributes).forEach(attr => curNav.setAttribute(attr.name, attr.value));
        }

        // Sync navigation active links
        this.updateNavLinks(displayUrl, doc);

        // Update modals container or append modals
        document.querySelectorAll('body > .modal').forEach(m => m.remove());
        newModals.forEach(m => {
          document.body.appendChild(m.cloneNode(true));
        });

      } else {
        // Full body swap
        Array.from(document.body.attributes).forEach(attr => {
          if (!doc.body.hasAttribute(attr.name)) {
            document.body.removeAttribute(attr.name);
          }
        });
        Array.from(doc.body.attributes).forEach(attr => {
          document.body.setAttribute(attr.name, attr.value);
        });
        document.body.innerHTML = doc.body.innerHTML;
      }

      // Re-initialize dynamic navigation / auth bar
      if (window.Auth && typeof window.Auth.initNav === 'function') {
        window.Auth.initNav();
      }

      // Re-bind click intercepts on newly loaded DOM elements
      this.bindInterceptors();

      // Execute newly injected inline scripts in global context
      this.executeScripts(doc, displayUrl);

      // Dispatch route change events (pages initialize on this event)
      window.dispatchEvent(new CustomEvent('msms:routechange', { detail: { url: displayUrl } }));

      // Ensure Auth navbar state is synchronized after scripts run
      if (window.Auth && typeof window.Auth.initNav === 'function') {
        window.Auth.initNav();
      }
    },

    updateNavLinks(targetUrl, newDoc) {
      const newNav = newDoc.querySelector('.navbar');
      const curNav = document.querySelector('.navbar');
      if (newNav && curNav) {
        const curNavLinks = curNav.querySelectorAll('.nav-link');
        const isCurrentHome = this.isHomeRoute(targetUrl);
        const normTarget = this.normalizePath(targetUrl);

        curNavLinks.forEach(link => {
          const href = link.getAttribute('href');
          if (!href) return;
          const isHomeLink = this.isHomeRoute(href);

          if (isCurrentHome && isHomeLink) {
            link.classList.add('active');
          } else if (!isCurrentHome && !isHomeLink) {
            const normHref = this.normalizePath(href);
            if (normHref === normTarget) {
              link.classList.add('active');
            } else {
              link.classList.remove('active');
            }
          } else {
            link.classList.remove('active');
          }
        });
      }
    },

    executeScripts(doc, displayUrl) {
      const scripts = doc.querySelectorAll('script');
      scripts.forEach(s => {
        // Only run inline scripts that are not external bundles already loaded
        if (!s.src && s.textContent.trim()) {
          try {
            // Remove raw unicode non-breaking spaces
            const cleanCode = s.textContent.replace(/\u00a0/g, ' ');
            // Append sourceURL for clear debugging in DevTools
            const sourceTag = '\n//# sourceURL=' + (window.location.origin + (displayUrl || '/inline-script.js'));
            // Indirect eval executes in global scope so top-level function declarations bind to window
            (0, eval)(cleanCode + sourceTag);
          } catch (e) {
            console.error('[MSMS Router] Script execution error:', e);
          }
        }
      });
    },

    showLoadingIndicator() {
      if (this._progressTimer) clearTimeout(this._progressTimer);
      let bar = document.getElementById('router-progress-bar');
      if (!bar) {
        bar = document.createElement('div');
        bar.id = 'router-progress-bar';
        bar.style.cssText = 'position:fixed;top:0;left:0;height:3px;background:#2563eb;z-index:99999;transition:width 0.2s ease;width:0%;box-shadow:0 0 8px rgba(37,99,235,0.6);';
        document.body.appendChild(bar);
      }
      bar.style.width = '30%';
      this._progressTimer = setTimeout(() => {
        const b = document.getElementById('router-progress-bar');
        if (b) b.style.width = '75%';
      }, 100);
    },

    hideLoadingIndicator() {
      if (this._progressTimer) clearTimeout(this._progressTimer);
      const bar = document.getElementById('router-progress-bar');
      if (bar) {
        bar.style.width = '100%';
        this._progressTimer = setTimeout(() => {
          const b = document.getElementById('router-progress-bar');
          if (b) b.remove();
        }, 200);
      }
    },

    bindInterceptors() {
      // Intercept clicks on links
      document.querySelectorAll('a').forEach(a => {
        if (a._hasRouterBound) return;
        a._hasRouterBound = true;

        a.addEventListener('click', (e) => {
          // Allow opening in new tabs via Ctrl/Cmd/Shift/Alt or middle-click, and file downloads
          if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || (e.button && e.button !== 0) || a.hasAttribute('download')) {
            return;
          }

          // Never intercept if click originated on or inside a button, input, or role tab
          if (e.target.closest('button, input, select, textarea, [role="group"], .btn-group, [data-role]')) {
            return;
          }

          const href = a.getAttribute('href');
          const target = a.getAttribute('target');

          // Ignore special links, modals, target="_blank", or explicitly marked no-spa links
          if (!href || href === '#' || href.startsWith('javascript:') || href.startsWith('http:') || href.startsWith('https:') || href.startsWith('mailto:') || href.startsWith('tel:') || target === '_blank' || a.hasAttribute('data-bs-toggle') || a.hasAttribute('data-bs-dismiss') || a.getAttribute('data-no-spa') === 'true' || a.hasAttribute('data-no-spa')) {
            return;
          }

          // Hash links on same page
          if (href.startsWith('#')) {
            try {
              const elem = document.querySelector(href);
              if (elem) {
                e.preventDefault();
                elem.scrollIntoView({ behavior: 'smooth' });
                history.pushState(null, '', href);
              }
            } catch (_) {}
            return;
          }

          e.preventDefault();
          this.navigate(href);
        });
      });

      // Intercept elements with data-navigate or data-href (excluding buttons and role selectors)
      document.querySelectorAll('[data-navigate], [data-href]').forEach(el => {
        // Exclude button elements, form controls, and role group members
        if (el.tagName === 'BUTTON' || el.getAttribute('type') === 'button' || el.closest('#roleBtnGroup') || el.hasAttribute('data-role')) {
          return;
        }

        if (el._hasRouterBound) return;
        el._hasRouterBound = true;
        el.style.cursor = 'pointer';

        el.addEventListener('click', (e) => {
          if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || (e.button && e.button !== 0)) {
            return;
          }
          if (e.target.closest('button, input, select, textarea, [role="group"], [data-role]')) {
            return;
          }
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
        const raw = window.location.pathname + window.location.search + window.location.hash;
        const target = this.isHomeRoute(window.location.pathname) ? '/' : raw;
        this.navigate(target, { pushState: false, force: true });
      });

      // Bind initial link click intercepts
      this.bindInterceptors();

      // Safe observer setup for dynamically added buttons/links
      const startObserver = () => {
        if (typeof MutationObserver !== 'undefined' && document.body) {
          const observer = new MutationObserver(() => {
            this.bindInterceptors();
          });
          observer.observe(document.body, { childList: true, subtree: true });
        }
      };

      if (document.body) {
        startObserver();
      } else {
        document.addEventListener('DOMContentLoaded', startObserver);
      }
    }
  };

  // Expose globally
  window.MSMSRouter = MSMSRouter;
  window.navigate = function (url, options) {
    return MSMSRouter.navigate(url, options);
  };

  // Auto-initialize router when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => MSMSRouter.init());
  } else {
    MSMSRouter.init();
  }
})();
