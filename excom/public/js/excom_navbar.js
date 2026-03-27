/**
 * Adds an "Excom Inbox" button to the Frappe desk navbar (top-right)
 * when enabled in Excom Settings. Only visible to users with Excom roles.
 */
$(document).on("app_ready", function () {
  const roles = (frappe.user_roles || []);
  const hasAccess = roles.includes("System Manager")
    || roles.includes("Excom Manager")
    || roles.includes("Excom User");

  if (!hasAccess) return;

  frappe.xcall("excom.excom.api.chat.get_navbar_config").then(function (cfg) {
    if (!cfg || !cfg.show_navbar_button) return;

    const helpMenu = $(".navbar .dropdown-help");
    if (!helpMenu.length) {
      addToNavbar(cfg);
      return;
    }
    addToNavbar(cfg, helpMenu);
  }).catch(function () {
    // silently skip if API unavailable
  });
});

function addToNavbar(cfg, helpMenu) {
  const gradFrom = cfg.gradient_from || "#3b82f6";
  const gradTo = cfg.gradient_to || "#8b5cf6";

  const btn = $(`
    <li class="nav-item d-none d-sm-block">
      <a class="nav-link excom-navbar-btn" href="/excom"
         title="Open Excom Inbox"
         style="display:flex;align-items:center;gap:6px;padding:4px 12px;margin:4px 2px;border-radius:8px;background:linear-gradient(135deg,${gradFrom},${gradTo});color:#fff;font-weight:600;font-size:12px;text-decoration:none;transition:opacity .2s;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        Excom
      </a>
    </li>
  `);

  btn.find("a").on("mouseenter", function () {
    $(this).css("opacity", "0.85");
  }).on("mouseleave", function () {
    $(this).css("opacity", "1");
  });

  if (helpMenu && helpMenu.length) {
    helpMenu.before(btn);
  } else {
    $(".navbar .navbar-collapse .navbar-nav:last").append(btn);
  }
}
