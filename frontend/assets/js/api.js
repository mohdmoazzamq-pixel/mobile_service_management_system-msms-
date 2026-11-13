/**
 * MSMS Frontend API Client
 * Centralized fetch client and UI helper utilities
 */

const API_BASE_URL = (window.location.port === '5000' || (!window.location.port && window.location.protocol.startsWith('http')))
  ? '/api'
  : (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5000/api'
    : '/api';

const API = {
  baseUrl: API_BASE_URL,

  getToken() {
    return localStorage.getItem('msms_token');
  },

  setToken(token) {
    localStorage.setItem('msms_token', token);
  },

  getUser() {
    const raw = localStorage.getItem('msms_user');
    try {
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  },

  setUser(user) {
    localStorage.setItem('msms_user', JSON.stringify(user));
  },

  clearSession() {
    localStorage.removeItem('msms_token');
    localStorage.removeItem('msms_user');
  },

  async request(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
    const token = this.getToken();

    const headers = options.headers || {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // If body is NOT FormData, set JSON content-type
    if (options.body && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        // If unauthorized and not already on auth/login/reset pages, clear and redirect
        const isAuthPage = window.location.pathname.includes('login') ||
                           window.location.pathname.includes('register') ||
                           window.location.pathname.includes('forgot-password') ||
                           window.location.pathname.includes('reset-password');
        if (response.status === 401 && !isAuthPage) {
          this.clearSession();
          if (window.navigate && typeof window.navigate === 'function') {
            window.navigate('/login.html');
          } else {
            window.location.href = '/login.html';
          }
        }

        const errorMsg = data.message || (data.errors ? data.errors.map(e => e.message).join(', ') : 'Request failed');
        const error = new Error(errorMsg);
        error.status = response.status;
        error.errors = data.errors || [];
        throw error;
      }

      return data;
    } catch (err) {
      console.error(`API Error on [${options.method || 'GET'}] ${endpoint}:`, err);
      throw err;
    }
  },

  get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  },

  post(endpoint, body) {
    return this.request(endpoint, { method: 'POST', body });
  },

  patch(endpoint, body) {
    return this.request(endpoint, { method: 'PATCH', body });
  },

  put(endpoint, body) {
    return this.request(endpoint, { method: 'PUT', body });
  },

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
};

// UI Notification and Formatter Utilities
const UI = {
  showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const toastId = 'toast-' + Date.now();
    const bgClass = type === 'success' ? 'bg-success text-white' :
                    type === 'error' || type === 'danger' ? 'bg-danger text-white' :
                    type === 'warning' ? 'bg-warning text-dark' : 'bg-primary text-white';

    const toastEl = document.createElement('div');
    toastEl.className = `toast align-items-center ${bgClass} border-0 shadow mb-2`;
    toastEl.id = toastId;
    toastEl.setAttribute('role', 'alert');
    toastEl.setAttribute('aria-live', 'assertive');
    toastEl.setAttribute('aria-atomic', 'true');
    toastEl.innerHTML = `
      <div class="d-flex">
        <div class="toast-body py-2 px-3 fw-medium">
          ${message}
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
      </div>
    `;

    container.appendChild(toastEl);
    if (window.bootstrap && window.bootstrap.Toast) {
      const bsToast = new window.bootstrap.Toast(toastEl, { delay: 4000 });
      bsToast.show();
      toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
    } else {
      setTimeout(() => toastEl.remove(), 4000);
    }
  },

  formatCurrency(amount) {
    const num = parseFloat(amount) || 0;
    return '$' + num.toFixed(2);
  },

  formatDate(dateString) {
    if (!dateString) return '—';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  },

  formatDateTime(dateString) {
    if (!dateString) return '—';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  },

  getStatusBadge(status) {
    if (!status) return '<span class="badge bg-secondary">UNKNOWN</span>';
    const s = status.toUpperCase().replace(/\s+/g, '_');
    const label = status.replace(/_/g, ' ');
    return `<span class="badge badge-status status-${s.toLowerCase()}">${label}</span>`;
  }
};
