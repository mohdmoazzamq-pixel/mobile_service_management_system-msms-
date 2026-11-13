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
        return '/admin/index.html';
      case 'technician':
        return '/technician/index.html';
      case 'customer':
      default:
        return '/customer/index.html';
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
    const user = API.getUser();
    const navUserContainer = document.getElementById('nav-user-container');

    if (!navUserContainer) return;

    if (user) {
      const portalLink = this.getRoleRedirect(user.role);
      navUserContainer.innerHTML = `
        <div class="d-flex align-items-center gap-3">
          <div class="text-end d-none d-sm-block">
            <div class="fw-semibold text-dark small">${user.name}</div>
            <div class="text-muted text-uppercase" style="font-size: 0.65rem; font-weight: 700; letter-spacing: 0.5px;">${user.role}</div>
          </div>
          <div class="dropdown">
            <button class="btn btn-sm btn-outline-secondary dropdown-toggle d-flex align-items-center gap-2" type="button" data-bs-toggle="dropdown">
              <i class="bi bi-person-circle"></i>
            </button>
            <ul class="dropdown-menu dropdown-menu-end shadow-sm">
              <li><h6 class="dropdown-header">${user.email}</h6></li>
              <li><a class="dropdown-item" href="${portalLink}"><i class="bi bi-speedometer2 me-2"></i>Dashboard</a></li>
              <li><hr class="dropdown-divider"></li>
              <li><button class="dropdown-item text-danger" onclick="Auth.logout()"><i class="bi bi-box-arrow-right me-2"></i>Sign Out</button></li>
            </ul>
          </div>
        </div>
      `;
    } else {
      navUserContainer.innerHTML = `
        <div class="d-flex gap-2">
          <a href="/login.html" class="btn btn-sm btn-outline-primary fw-medium px-3">Sign In</a>
          <a href="/register.html" class="btn btn-sm btn-primary fw-medium px-3">Register</a>
        </div>
      `;
    }
  },

  logout() {
    API.clearSession();
    this.redirect('/login.html');
  }
};

// Ensure router is loaded if not already present
if (!window.MSMSRouter) {
  const routerScript = document.createElement('script');
  routerScript.src = '/assets/js/router.js';
  document.head.appendChild(routerScript);
}

document.addEventListener('DOMContentLoaded', () => {
  Auth.initNav();
});
