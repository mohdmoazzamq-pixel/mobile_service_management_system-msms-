/**
 * MSMS Frontend Auth & Navigation Guard
 */

const Auth = {
  redirect(url) {
    if (window.navigate && typeof window.navigate === 'function') {
      window.navigate(url);
    } else {
      window.location.href = url;
    }
  },

  getRoleRedirect(role) {
    switch (role) {
      case 'admin':
        return '/admin/dashboard';
      case 'technician':
        return '/technician/dashboard';
      case 'customer':
      default:
        return '/customer/dashboard';
    }
  },

  requireAuth(requiredRoles = []) {
    const user = API.getUser();
    const token = API.getToken();

    if (!token || !user) {
      this.redirect('/login.html');
      return null;
    }

    if (requiredRoles.length > 0 && !requiredRoles.includes(user.role)) {
      // User is logged in but doesn't have permission for this portal
      const target = this.getRoleRedirect(user.role);
      this.redirect(target);
      return null;
    }

    return user;
  },

  initNav() {
    const token = API.getToken();
    const user = token ? API.getUser() : null;
    if (!token && API.getUser()) {
      API.clearSession();
    }
    const navUserContainer = document.getElementById('nav-user-container');

    if (!navUserContainer) return;

    if (token && user) {
      const portalLink = this.getRoleRedirect(user.role);
      navUserContainer.innerHTML = `
        <div class="d-flex align-items-center gap-2" id="nav-user-links">
          <span class="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1 small d-none d-md-inline-block">
            <i class="bi bi-person-circle me-1"></i>${user.name} <span class="text-uppercase fw-bold" style="font-size:0.65rem;">(${user.role})</span>
          </span>
          <a href="${portalLink}" class="btn btn-sm btn-primary fw-medium px-3" id="navDashboardBtn">
            <i class="bi bi-speedometer2 me-1"></i>Dashboard
          </a>
          <button type="button" class="btn btn-sm btn-outline-danger fw-medium px-3" id="navLogoutBtn" onclick="Auth.logout()">
            <i class="bi bi-box-arrow-right me-1"></i>Sign Out
          </button>
        </div>
      `;
    } else {
      navUserContainer.innerHTML = `
        <div class="d-flex gap-2" id="nav-guest-links" style="display: inline-flex !important;">
          <a href="/login.html" class="btn btn-sm btn-outline-primary fw-medium px-3" id="navLoginBtn" style="display: inline-block !important;">Sign In</a>
          <a href="/register.html" class="btn btn-sm btn-primary fw-medium px-3" id="navRegisterBtn" style="display: inline-block !important;">Register</a>
        </div>
      `;
    }
  },

  logout() {
    API.clearSession();
    this.redirect('/login.html');
  }
};

// Ensure router is loaded if not already present or queued in DOM
if (!window.MSMSRouter && !document.querySelector('script[src*="router.js"]')) {
  const routerScript = document.createElement('script');
  routerScript.src = '/assets/js/router.js';
  document.head.appendChild(routerScript);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Auth.initNav());
} else {
  Auth.initNav();
}
window.addEventListener('msms:routechange', () => Auth.initNav());
