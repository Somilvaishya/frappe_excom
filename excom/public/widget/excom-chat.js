(function() {
  "use strict";

  var STORAGE_KEY = "excom_chat_session";
  var POLL_INTERVAL = 3000;
  var siteUrl = "";
  var accountId = "";

  function api(method, args) {
    var url = siteUrl + "/api/method/excom.excom.api.webchat." + method;
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Frappe-CSRF-Token": "None" },
      body: JSON.stringify(args),
      credentials: "include"
    }).then(function(r) {
      if (!r.ok) throw new Error("API error " + r.status);
      return r.json();
    }).then(function(d) { return d.message; });
  }

  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function(k) {
      if (k === "style" && typeof attrs[k] === "object") {
        Object.assign(el.style, attrs[k]);
      } else if (k.indexOf("on") === 0) {
        el.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
      } else {
        el.setAttribute(k, attrs[k]);
      }
    });
    if (children) {
      if (typeof children === "string") el.textContent = children;
      else if (Array.isArray(children)) children.forEach(function(c) { if (c) el.appendChild(c); });
      else el.appendChild(children);
    }
    return el;
  }

  function ExcomWidget(container) {
    var self = this;
    self.container = container;
    self.config = null;
    self.session = null;
    self.messages = [];
    self.pollTimer = null;
    self.view = "button";

    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { self.session = JSON.parse(saved); } catch(e) { localStorage.removeItem(STORAGE_KEY); }
    }

    api("get_config", { account_id: accountId }).then(function(cfg) {
      self.config = cfg;
      if (self.session) { self.view = "chat"; self.startPolling(); }
      self.render();
    }).catch(function(e) { console.error("Excom widget:", e); });
  }

  ExcomWidget.prototype.render = function() {
    var self = this;
    self.container.innerHTML = "";
    var color = (self.config && self.config.color) || "#3b82f6";
    var isRight = !self.config || self.config.position !== "bottom-left";
    var side = isRight ? "right" : "left";

    if (self.view === "button") {
      var fab = h("button", {
        style: {
          position: "fixed", bottom: "24px", [side]: "24px",
          width: "56px", height: "56px", borderRadius: "50%",
          backgroundColor: color, color: "white", border: "none",
          cursor: "pointer", display: "flex", alignItems: "center",
          justifyContent: "center", boxShadow: "0 4px 14px rgba(0,0,0,0.2)",
          zIndex: "99999", transition: "transform 0.2s", fontFamily: "inherit"
        },
        onClick: function() { self.view = self.session ? "chat" : "prechat"; self.render(); if (self.session) self.startPolling(); }
      });
      fab.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
      self.container.appendChild(fab);
      return;
    }

    var panel = h("div", { style: {
      position: "fixed", bottom: "96px", [side]: "24px",
      width: "380px", maxHeight: "560px", borderRadius: "16px",
      backgroundColor: "white", boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
      zIndex: "99999", display: "flex", flexDirection: "column", overflow: "hidden",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    }});

    var headerEl = h("div", { style: {
      padding: "16px 20px", backgroundColor: color, color: "white",
      display: "flex", alignItems: "center", justifyContent: "space-between"
    }}, [
      h("div", {}, [
        h("div", { style: { fontWeight: "700", fontSize: "15px" } },
          (self.config && self.config.title) || "Chat with us"),
        h("div", { style: { fontSize: "12px", opacity: "0.85", marginTop: "2px" } },
          "We typically reply within minutes")
      ]),
      h("button", {
        style: { background: "none", border: "none", color: "white", cursor: "pointer", padding: "4px", display: "flex" },
        onClick: function() { self.view = "button"; self.stopPolling(); self.render(); }
      })
    ]);
    headerEl.lastChild.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>';
    panel.appendChild(headerEl);

    if (self.view === "prechat") {
      panel.appendChild(self.renderPreChat(color));
    } else {
      panel.appendChild(self.renderMessages(color));
      panel.appendChild(self.renderInput(color));
    }

    self.container.appendChild(panel);

    var miniFab = h("button", {
      style: {
        position: "fixed", bottom: "24px", [side]: "24px",
        width: "56px", height: "56px", borderRadius: "50%",
        backgroundColor: color, color: "white", border: "none",
        cursor: "pointer", display: "flex", alignItems: "center",
        justifyContent: "center", boxShadow: "0 4px 14px rgba(0,0,0,0.2)",
        zIndex: "99999", transform: "scale(0.9)", fontFamily: "inherit"
      },
      onClick: function() { self.view = "button"; self.stopPolling(); self.render(); }
    });
    miniFab.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>';
    self.container.appendChild(miniFab);
  };

  ExcomWidget.prototype.renderPreChat = function(color) {
    var self = this;
    var fields;
    try { fields = JSON.parse(self.config.prechat_fields); } catch(e) { fields = ["name", "email"]; }

    var form = h("form", { style: { padding: "24px 20px" }, onSubmit: function(e) {
      e.preventDefault();
      var data = {};
      fields.forEach(function(f) { var inp = form.querySelector("[name='" + f + "']"); if (inp) data[f] = inp.value; });
      self.createSession(data);
    }}, [
      h("p", { style: { color: "#6b7280", fontSize: "13px", marginBottom: "16px", lineHeight: "1.5" } },
        "Please share your details so we can assist you better.")
    ]);

    var inputStyle = {
      width: "100%", padding: "10px 12px", border: "1px solid #d1d5db",
      borderRadius: "8px", fontSize: "14px", outline: "none",
      boxSizing: "border-box", fontFamily: "inherit", marginBottom: "4px"
    };

    fields.forEach(function(f) {
      var label = f.charAt(0).toUpperCase() + f.slice(1);
      var type = f === "email" ? "email" : f === "phone" ? "tel" : "text";
      var div = h("div", { style: { marginBottom: "12px" } }, [
        h("label", { style: { display: "block", fontSize: "12px", fontWeight: "500", color: "#374151", marginBottom: "4px" } }, label),
        h("input", { type: type, name: f, placeholder: label, required: f !== "phone", style: inputStyle })
      ]);
      form.appendChild(div);
    });

    form.appendChild(h("button", {
      type: "submit",
      style: {
        width: "100%", padding: "10px", backgroundColor: color, color: "white",
        border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: "600",
        cursor: "pointer", marginTop: "8px", fontFamily: "inherit"
      }
    }, "Start Chat"));

    return form;
  };

  ExcomWidget.prototype.renderMessages = function(color) {
    var self = this;
    var container = h("div", { style: {
      flex: "1", overflowY: "auto", padding: "16px",
      display: "flex", flexDirection: "column", gap: "8px",
      minHeight: "300px", maxHeight: "380px"
    }});

    if (self.config && self.config.welcome_message) {
      container.appendChild(h("div", { style: { textAlign: "center", marginBottom: "8px" } },
        h("span", { style: {
          display: "inline-block", padding: "8px 14px", backgroundColor: "#f3f4f6",
          borderRadius: "12px", fontSize: "13px", color: "#6b7280", maxWidth: "80%"
        } }, self.config.welcome_message)
      ));
    }

    self.messages.forEach(function(msg) {
      var isVisitor = msg.direction === "Inbound";
      var bubble = h("div", { style: { display: "flex", justifyContent: isVisitor ? "flex-end" : "flex-start" } },
        h("div", { style: {
          maxWidth: "75%", padding: "10px 14px",
          borderRadius: isVisitor ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
          backgroundColor: isVisitor ? color : "#f3f4f6",
          color: isVisitor ? "white" : "#1f2937",
          fontSize: "14px", lineHeight: "1.5", wordBreak: "break-word"
        }}, [
          !isVisitor ? h("div", { style: { fontSize: "11px", fontWeight: "600", color: color, marginBottom: "2px" } }, msg.sender_name) : null,
          h("div", {}, msg.content),
          h("div", { style: { fontSize: "10px", marginTop: "4px", opacity: "0.7", textAlign: "right" } },
            (function() { try { return new Date(msg.timestamp).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}); } catch(e) { return ""; } })()
          )
        ])
      );
      container.appendChild(bubble);
    });

    self._msgContainer = container;
    setTimeout(function() { container.scrollTop = container.scrollHeight; }, 50);
    return container;
  };

  ExcomWidget.prototype.renderInput = function(color) {
    var self = this;
    var input = h("input", {
      type: "text", placeholder: "Type a message...",
      style: {
        flex: "1", padding: "10px 14px", border: "1px solid #d1d5db",
        borderRadius: "20px", fontSize: "14px", outline: "none",
        fontFamily: "inherit", boxSizing: "border-box"
      }
    });

    var sendBtn = h("button", {
      style: {
        width: "36px", height: "36px", borderRadius: "50%", border: "none",
        backgroundColor: "#d1d5db", color: "white", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: "0", transition: "background-color 0.2s"
      },
      onClick: function() { doSend(); }
    });
    sendBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';

    function updateBtn() {
      sendBtn.style.backgroundColor = input.value.trim() ? color : "#d1d5db";
      sendBtn.style.cursor = input.value.trim() ? "pointer" : "default";
    }

    input.addEventListener("input", updateBtn);
    input.addEventListener("keydown", function(e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doSend(); }
    });

    function doSend() {
      var text = input.value.trim();
      if (!text || !self.session) return;
      input.value = "";
      updateBtn();
      self.messages.push({
        id: "opt_" + Date.now(), direction: "Inbound", content: text,
        message_type: "Text", timestamp: new Date().toISOString(), sender_name: "You"
      });
      self.render();
      api("send_visitor_message", { session_token: self.session.token, content: text })
        .then(function() { return self.fetchMessages(); })
        .catch(function(e) { console.error("Send error:", e); });
    }

    return h("div", { style: {
      display: "flex", alignItems: "center", gap: "8px",
      padding: "12px 16px", borderTop: "1px solid #e5e7eb", backgroundColor: "white"
    }}, [input, sendBtn]);
  };

  ExcomWidget.prototype.createSession = function(data) {
    var self = this;
    api("create_session", {
      account_id: accountId,
      visitor_name: data.name || "Visitor",
      visitor_email: data.email || "",
      visitor_phone: data.phone || "",
      page_url: window.location.href,
      user_agent: navigator.userAgent
    }).then(function(res) {
      self.session = { token: res.session_token, threadId: res.thread_id };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(self.session));
      self.view = "chat";
      self.startPolling();
      self.render();
    }).catch(function(e) { console.error("Session error:", e); });
  };

  ExcomWidget.prototype.fetchMessages = function() {
    var self = this;
    if (!self.session) return Promise.resolve();
    return api("get_visitor_messages", {
      session_token: self.session.token, after: ""
    }).then(function(msgs) {
      if (msgs && msgs.length > 0) {
        var ids = {};
        self.messages.forEach(function(m) { if (m.id.indexOf("opt_") !== 0) ids[m.id] = true; });
        var optimistics = self.messages.filter(function(m) { return m.id.indexOf("opt_") === 0; });
        var serverMsgs = msgs;
        var newOptimistics = optimistics.filter(function(o) {
          return !serverMsgs.some(function(s) { return s.content === o.content && s.direction === o.direction; });
        });
        self.messages = serverMsgs.concat(newOptimistics);
        self.render();
      }
    }).catch(function(e) { console.error("Poll error:", e); });
  };

  ExcomWidget.prototype.startPolling = function() {
    var self = this;
    self.stopPolling();
    self.fetchMessages();
    self.pollTimer = setInterval(function() { self.fetchMessages(); }, POLL_INTERVAL);
  };

  ExcomWidget.prototype.stopPolling = function() {
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
  };

  function init() {
    var scripts = document.getElementsByTagName("script");
    var script = scripts[scripts.length - 1];
    accountId = script.getAttribute("data-account") || "";
    siteUrl = script.getAttribute("data-site") || "";

    if (!accountId) { console.error("Excom Chat: data-account required"); return; }
    if (!siteUrl) {
      try { siteUrl = new URL(script.src).origin; } catch(e) { siteUrl = ""; }
    }
    siteUrl = siteUrl.replace(/\/$/, "");

    var host = document.createElement("div");
    host.id = "excom-chat-widget";
    document.body.appendChild(host);

    var shadow = host.attachShadow({ mode: "open" });
    var style = document.createElement("style");
    style.textContent = ":host { all: initial; } *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }";
    shadow.appendChild(style);

    var container = document.createElement("div");
    shadow.appendChild(container);
    new ExcomWidget(container);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
