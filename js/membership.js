// ==========================================================================
// BIOGRAM MEMBERSHIP MODULE
// Shared lifetime-membership (₹ INR) modal + premium-status helpers.
// Import { openMembershipModal, getSystemConfig, isUserPremium } wherever needed.
// ==========================================================================
import { auth, db } from "./firebase.js?v=20260816a";
import { doc, getDoc, setDoc, increment } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let cachedSystemConfig = null;
let razorpayScriptPromise = null;

const DEFAULTS = {
  membershipPriceINR: 499,
  razorpayKeyId: "",
  paymentsEnabled: false,
  contactEmail: "hello@biogram.me",
  siteBaseUrl: ""
};

export const getSystemConfig = async (force = false) => {
  if (cachedSystemConfig && !force) return cachedSystemConfig;
  try {
    const snap = await getDoc(doc(db, "system", "config"));
    cachedSystemConfig = { ...DEFAULTS, ...(snap.exists() ? snap.data() : {}) };
    // An admin saving the settings form with the email field left blank shouldn't
    // wipe out a usable fallback address — treat a blank saved value as "unset".
    if (!cachedSystemConfig.contactEmail) cachedSystemConfig.contactEmail = DEFAULTS.contactEmail;
  } catch (e) {
    console.warn("Could not load system config:", e);
    cachedSystemConfig = { ...DEFAULTS };
  }
  return cachedSystemConfig;
};

export const isUserPremium = (userData) => {
  return !!(userData && (userData.isPremium === true));
};

const LOOPBACK_HOSTS = ["127.0.0.1", "localhost", "0.0.0.0", "::1"];

// Resolve the canonical public URL for a profile page. Prefers the admin-configured
// siteBaseUrl (system/config.siteBaseUrl) over window.location, because the page's
// own location can be a local/dev/preview address (e.g. 127.0.0.1) when viewed through
// a proxy or preview tool — which would otherwise get baked into QR codes / share links
// as an unreachable address. Returns { url, isUnreliable } — isUnreliable is true when
// falling back to a loopback/local hostname with no configured override, so callers can
// warn instead of silently generating a broken link.
export const resolveCanonicalProfileUrl = (config, handle) => {
  const pagePath = window.location.pathname.split('/').pop() || "profile.html";
  const query = handle ? `?u=${encodeURIComponent(handle)}` : "";

  const configuredBase = (config?.siteBaseUrl || "").trim().replace(/\/$/, "");
  if (configuredBase) {
    return { url: `${configuredBase}/${pagePath}${query}`, isUnreliable: false };
  }

  const currentOrigin = window.location.origin;
  const isLoopback = LOOPBACK_HOSTS.some(h => window.location.hostname === h);
  return {
    url: `${currentOrigin}/${pagePath}${query}`,
    isUnreliable: isLoopback
  };
};

const loadRazorpayScript = () => {
  if (window.Razorpay) return Promise.resolve(true);
  if (razorpayScriptPromise) return razorpayScriptPromise;
  razorpayScriptPromise = new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
  return razorpayScriptPromise;
};

const injectStylesOnce = () => {
  if (document.getElementById("membership-modal-styles")) return;
  const style = document.createElement("style");
  style.id = "membership-modal-styles";
  style.textContent = `
    .mem-overlay { position: fixed; inset: 0; background: rgba(10,10,20,0.72); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); z-index: 60000; display: flex; align-items: center; justify-content: center; padding: 1rem; }
    .mem-overlay.hidden { display: none !important; }
    .mem-card { background: var(--bg-card, #fff); color: var(--text-main, #111827); width: 100%; max-width: 460px; border-radius: 24px; overflow: hidden; box-shadow: 0 30px 80px rgba(0,0,0,0.4); border: 1px solid var(--border-light, #e2e8f0); max-height: 90vh; display: flex; flex-direction: column; }
    .mem-head { background: linear-gradient(135deg,#6366f1,#8b5cf6 60%,#ec4899); padding: 28px 24px; color: #fff; position: relative; overflow: hidden; }
    .mem-head::after { content:''; position:absolute; width:220px; height:220px; background:rgba(255,255,255,0.15); border-radius:50%; top:-100px; right:-60px; }
    .mem-head-crown { font-size: 1.6rem; margin-bottom: 6px; display:block; }
    .mem-head h2 { margin: 0 0 4px; font-size: 1.35rem; font-weight: 800; }
    .mem-head p { margin: 0; font-size: 0.85rem; opacity: 0.92; }
    .mem-close { position: absolute; top: 14px; right: 16px; background: rgba(255,255,255,0.2); border: none; color: #fff; width: 30px; height: 30px; border-radius: 50%; cursor: pointer; font-size: 1.1rem; line-height: 1; }
    .mem-body { padding: 22px 24px; overflow-y: auto; }
    .mem-price-row { display: flex; align-items: baseline; gap: 8px; margin-bottom: 4px; font-family: 'JetBrains Mono', monospace; }
    .mem-price { font-size: 2.3rem; font-weight: 800; }
    .mem-price-note { color: var(--text-muted, #6b7280); font-size: 0.85rem; font-weight: 600; }
    .mem-lifetime-pill { display:inline-block; margin-bottom:14px; background: rgba(99,102,241,0.12); color:#6366f1; font-weight:700; font-size:0.72rem; padding:3px 10px; border-radius: 20px; letter-spacing:0.4px; text-transform:uppercase; }
    .mem-feature-list { list-style: none; margin: 0 0 20px; padding: 0; display: flex; flex-direction: column; gap: 10px; }
    .mem-feature-list li { display: flex; align-items: flex-start; gap: 10px; font-size: 0.88rem; color: var(--text-main, #111827); }
    .mem-feature-list i { color: #22c55e; margin-top: 2px; flex-shrink: 0; }
    .mem-cta { width: 100%; padding: 14px; border: none; border-radius: 14px; background: linear-gradient(135deg,#6366f1,#8b5cf6); color: #fff; font-weight: 800; font-size: 0.95rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: transform 0.15s ease, opacity 0.15s; }
    .mem-cta:hover { transform: translateY(-2px); opacity: 0.94; }
    .mem-cta:disabled { opacity: 0.6; cursor: wait; transform: none; }
    .mem-fallback-note { text-align: center; font-size: 0.78rem; color: var(--text-muted, #6b7280); margin-top: 12px; line-height: 1.5; }
    .mem-fallback-note a { color: #6366f1; font-weight: 700; text-decoration: none; }
    .mem-already { text-align:center; padding: 10px 0 4px; }
    .mem-already i { font-size: 2.4rem; color: #f59e0b; margin-bottom: 8px; display:block; }
    .premium-crown-badge { color: #f59e0b; margin-left: 3px; }
  `;
  document.head.appendChild(style);
};

const buildModal = () => {
  let overlay = document.getElementById("membership-modal-overlay");
  if (overlay) return overlay;

  overlay = document.createElement("div");
  overlay.id = "membership-modal-overlay";
  overlay.className = "mem-overlay hidden";
  overlay.innerHTML = `
    <div class="mem-card">
      <div class="mem-head">
        <button type="button" class="mem-close" id="mem-close-btn" aria-label="Close">&times;</button>
        <span class="mem-head-crown"><i class="fa-solid fa-crown"></i></span>
        <h2>BioGram Pro — Lifetime</h2>
        <p>One-time payment. Unlock every perk, forever.</p>
      </div>
      <div class="mem-body" id="mem-body-content">
        <div style="text-align:center; padding: 30px 0;"><i class="fa-solid fa-spinner fa-spin"></i></div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.classList.add("hidden");
  });
  overlay.querySelector("#mem-close-btn").addEventListener("click", () => overlay.classList.add("hidden"));

  return overlay;
};

const FEATURES = [
  "Real Insights panel — total views, views today, rank, and widget click stats",
  "All glass design themes, including exclusive Pro-only presets",
  "Custom accent color picker for your whole space",
  "Animated glow ring around your avatar + a custom name badge/tag",
  "Scannable QR code widget linking to your space",
  "Unlimited media gallery images & custom link widgets",
  "Custom browser tab title & favicon using your own avatar",
  "Animated background particles & premium layout effects",
  "No 'Powered by BioGram' badge on your public space",
  "Gold Pro crown badge on your profile & the leaderboard",
  "Priority support and early access to new widgets"
];

export const openMembershipModal = async () => {
  injectStylesOnce();
  const overlay = buildModal();
  overlay.classList.remove("hidden");

  const body = overlay.querySelector("#mem-body-content");
  const user = auth.currentUser;
  // Force a fresh read every time the modal opens — a cached copy here means an
  // admin's just-saved Razorpay key / price / payments-enabled toggle wouldn't be
  // picked up until a full page reload, and the button would keep silently falling
  // back to the mailto link even after payments were correctly configured.
  const config = await getSystemConfig(true);

  let userIsPremium = false;
  if (user) {
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      userIsPremium = snap.exists() && isUserPremium(snap.data());
    } catch (e) { /* ignore */ }
  }

  if (userIsPremium) {
    body.innerHTML = `
      <div class="mem-already">
        <i class="fa-solid fa-circle-check"></i>
        <h3 style="margin:0 0 6px;">You're already a Pro member!</h3>
        <p style="color:var(--text-muted,#6b7280); font-size:0.88rem;">Thanks for supporting BioGram. All perks are unlocked on your space.</p>
      </div>
    `;
    return;
  }

  const price = Number(config.membershipPriceINR) || DEFAULTS.membershipPriceINR;

  body.innerHTML = `
    <span class="mem-lifetime-pill"><i class="fa-solid fa-infinity"></i> Pay once, own it forever</span>
    <div class="mem-price-row">
      <span class="mem-price">₹${price.toLocaleString('en-IN')}</span>
      <span class="mem-price-note">one-time · lifetime</span>
    </div>
    <ul class="mem-feature-list">
      ${FEATURES.map(f => `<li><i class="fa-solid fa-circle-check"></i><span>${f}</span></li>`).join("")}
    </ul>
    <button type="button" class="mem-cta" id="mem-upgrade-cta">
      <i class="fa-solid fa-crown"></i> ${user ? `Upgrade for ₹${price.toLocaleString('en-IN')}` : "Sign in to Upgrade"}
    </button>
    <p class="mem-fallback-note" id="mem-fallback-note"></p>
  `;

  const fallbackNote = body.querySelector("#mem-fallback-note");
  const ctaBtn = body.querySelector("#mem-upgrade-cta");

  if (!config.paymentsEnabled || !config.razorpayKeyId) {
    fallbackNote.innerHTML = `Online payments aren't configured yet. Email <a href="mailto:${config.contactEmail}">${config.contactEmail}</a> to upgrade manually, or ask an admin to grant Pro access.`;
  } else {
    fallbackNote.textContent = "Secure checkout powered by Razorpay. Supports UPI, cards & netbanking.";
  }

  ctaBtn.addEventListener("click", async () => {
    if (!user) {
      alert("Please sign in first, then reopen this dialog to upgrade.");
      return;
    }

    if (!config.paymentsEnabled || !config.razorpayKeyId) {
      window.location.href = `mailto:${config.contactEmail}?subject=BioGram Pro Upgrade&body=Hi, I'd like to upgrade to BioGram Pro Lifetime (₹${price}). My handle/UID is ${user.uid}.`;
      return;
    }

    ctaBtn.disabled = true;
    ctaBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Loading checkout...`;

    const loaded = await loadRazorpayScript();
    if (!loaded || !window.Razorpay) {
      ctaBtn.disabled = false;
      ctaBtn.innerHTML = `<i class="fa-solid fa-crown"></i> Upgrade for ₹${price.toLocaleString('en-IN')}`;
      alert("Could not load the payment gateway. Please check your connection and try again.");
      return;
    }

    // NOTE FOR DEVELOPERS: This is a client-only Razorpay Checkout flow. Since this
    // project has no backend/serverless function, the payment success handler below
    // optimistically grants Pro access without server-side signature verification.
    // Before accepting real payments in production, create an order server-side and
    // verify the payment signature in a Cloud Function / webhook before setting
    // isPremium — otherwise a manipulated client could claim to have paid without
    // actually completing the transaction. Admins can always audit/revoke Pro
    // access manually from the Admin Panel's Membership tools.
    const rzp = new window.Razorpay({
      key: config.razorpayKeyId,
      amount: price * 100,
      currency: "INR",
      name: "BioGram Pro",
      description: "Lifetime membership — unlock all perks",
      prefill: { email: user.email || "", name: user.displayName || "" },
      theme: { color: "#6366f1" },
      handler: async (response) => {
        try {
          await setDoc(doc(db, "users", user.uid), {
            isPremium: true,
            membershipType: "lifetime",
            premiumSince: new Date().toISOString(),
            lastPaymentId: response?.razorpay_payment_id || null
          }, { merge: true });

          await setDoc(doc(db, "system", "config"), {
            totalRevenuePaise: increment(price * 100),
            totalPremiumPurchases: increment(1)
          }, { merge: true });

          body.innerHTML = `
            <div class="mem-already">
              <i class="fa-solid fa-circle-check"></i>
              <h3 style="margin:0 0 6px;">Welcome to BioGram Pro! 🎉</h3>
              <p style="color:var(--text-muted,#6b7280); font-size:0.88rem;">Refresh your space to see all Pro perks unlocked.</p>
            </div>
          `;
        } catch (e) {
          console.error("Error granting premium after payment:", e);
          alert("Payment succeeded, but we couldn't update your account automatically. Please contact support with your payment ID: " + (response?.razorpay_payment_id || "unknown"));
        }
      },
      modal: {
        ondismiss: () => {
          ctaBtn.disabled = false;
          ctaBtn.innerHTML = `<i class="fa-solid fa-crown"></i> Upgrade for ₹${price.toLocaleString('en-IN')}`;
        }
      }
    });

    rzp.open();
  });
};

export const bindMembershipTriggers = (selector = "[data-open-membership]") => {
  document.querySelectorAll(selector).forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      openMembershipModal();
    });
  });
};

export const renderPremiumCrown = (userData) => {
  return isUserPremium(userData)
    ? `<i class="fa-solid fa-crown premium-crown-badge" title="BioGram Pro Member"></i>`
    : "";
};
