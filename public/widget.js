/*
 * AmpUp GTM chat: embeddable widget loader.
 *
 * Drop one tag on any site:
 *   <script src="https://YOUR-APP.vercel.app/widget.js" data-theme="dark" async></script>
 *
 * It injects a floating launcher (in a Shadow DOM so the host page's CSS can't
 * touch it) and, on first open, lazily mounts an <iframe> pointed at the app's
 * chrome-less /embed route. Host <-> widget talk over postMessage with an exact
 * origin check both ways. Fails silently, never throws into the host page.
 *
 * The embedding site's origin must be allowlisted on the app via
 * EMBED_ALLOWED_ORIGINS (the /embed CSP frame-ancestors). Same-origin embeds
 * (this script served from the same origin as the iframe) work out of the box.
 */
(function () {
  try {
    if (window.__ampupWidgetLoaded) return;
    window.__ampupWidgetLoaded = true;

    var script =
      document.currentScript ||
      (function () {
        // Wix/Squarespace sandboxes can null currentScript; match by src.
        var s = document.getElementsByTagName("script");
        for (var i = s.length - 1; i >= 0; i--) {
          if (s[i].src && s[i].src.indexOf("widget.js") !== -1) return s[i];
        }
        return null;
      })();
    if (!script) return;

    var ORIGIN = new URL(script.src).origin;
    var EMBED_URL = ORIGIN + "/embed";
    var theme = script.getAttribute("data-theme") || "dark";
    var label = script.getAttribute("data-label") || "Chat";

    var host = document.createElement("div");
    host.setAttribute("data-ampup-widget", "");
    document.body.appendChild(host);
    var root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;

    var style = document.createElement("style");
    style.textContent =
      ":host{all:initial}" +
      ".launcher{position:fixed;bottom:20px;right:20px;width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;background:#FFB712;color:#1a1200;box-shadow:0 6px 20px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;z-index:2147483000;transition:transform .15s ease}" +
      ".launcher:hover{transform:scale(1.05)}" +
      ".launcher svg{width:26px;height:26px}" +
      ".panel{position:fixed;bottom:88px;right:20px;width:400px;height:640px;max-height:calc(100vh - 120px);border-radius:16px;overflow:hidden;box-shadow:0 12px 48px rgba(0,0,0,.35);z-index:2147483000;opacity:0;transform:translateY(8px) scale(.98);pointer-events:none;transition:opacity .16s ease,transform .16s ease;background:#0b0b0c}" +
      ".panel.open{opacity:1;transform:none;pointer-events:auto}" +
      ".panel iframe{width:100%;height:100%;border:0;display:block}" +
      "@media (max-width:480px){.panel{bottom:0;right:0;left:0;top:0;width:100%;height:100%;max-height:none;border-radius:0}.launcher{bottom:16px;right:16px}}";
    root.appendChild(style);

    var launcher = document.createElement("button");
    launcher.className = "launcher";
    launcher.setAttribute("aria-label", "Open " + label);
    launcher.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';
    root.appendChild(launcher);

    var panel = null;
    var iframe = null;
    var isOpen = false;

    function ensurePanel() {
      if (panel) return;
      panel = document.createElement("div");
      panel.className = "panel";
      iframe = document.createElement("iframe");
      iframe.src = EMBED_URL;
      iframe.title = label;
      // Allow the popup sign-in to open and clipboard for copy actions.
      iframe.setAttribute("allow", "clipboard-write");
      panel.appendChild(iframe);
      root.appendChild(panel);
    }

    function postToEmbed(msg) {
      try {
        if (iframe && iframe.contentWindow) iframe.contentWindow.postMessage(msg, ORIGIN);
      } catch (e) {}
    }

    function setOpen(next) {
      isOpen = next;
      ensurePanel();
      panel.classList.toggle("open", next);
      postToEmbed({ type: "ampup:host", theme: theme, open: next });
    }

    launcher.addEventListener("click", function () {
      setOpen(!isOpen);
    });

    // Messages FROM the embed: verify exact origin AND that it's our iframe.
    window.addEventListener("message", function (e) {
      if (e.origin !== ORIGIN) return;
      if (!iframe || e.source !== iframe.contentWindow) return;
      var data = e.data || {};
      if (data.type === "ampup:ready") {
        postToEmbed({ type: "ampup:host", theme: theme, open: isOpen });
      } else if (data.type === "ampup:close") {
        setOpen(false);
      }
    });

    // Minimal host API for programmatic control.
    window.AmpUpChat = {
      open: function () { setOpen(true); },
      close: function () { setOpen(false); },
      toggle: function () { setOpen(!isOpen); },
    };
  } catch (e) {
    if (window.console && console.warn) console.warn("AmpUp widget failed to load", e);
  }
})();
