/* ==========================================================================
   1. VARIABLES & THEMING (SOLID COLORS, NO GLASS)
   ========================================================================== */
:root { 
  --bg-page: #f8fafc; 
  --bg-card: #ffffff; 
  --bg-subtle: #f1f5f9; 
  --border-light: #e2e8f0; 
  --border-hover: #cbd5e1; 
  --primary-purple: #7c3aed; 
  --primary-pink: #ec4899; 
  --primary-blue: #2563eb; 
  --spotify-green: #16a34a; 
  --discord-blue: #4f46e5; 
  --text-main: #0f172a; 
  --text-muted: #475569; 
  --text-dim: #94a3b8; 
  --card-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); 
  --card-shadow-hover: 0 10px 25px rgba(0, 0, 0, 0.08); 
}

[data-theme="dark"], 
body.dark-theme { 
  --bg-page: #0b0f17; 
  --bg-card: #151c28; 
  --bg-subtle: #1e293b; 
  --border-light: #334155; 
  --border-hover: #475569; 
  --text-main: #f8fafc; 
  --text-muted: #94a3b8; 
  --text-dim: #64748b; 
  --card-shadow: 0 4px 20px rgba(0, 0, 0, 0.25); 
  --card-shadow-hover: 0 10px 25px rgba(0, 0, 0, 0.35); 
}

/* ==========================================================================
   2. RESET & BASE STYLES
   ========================================================================== */
* { 
  margin: 0; 
  padding: 0; 
  box-sizing: border-box; 
  font-family: 'Plus Jakarta Sans', sans-serif; 
}

html { 
  scroll-behavior: smooth; 
}

body { 
  background: var(--bg-page); 
  color: var(--text-main); 
  min-height: 100vh; 
  overflow-x: hidden; 
  transition: background-color 0.3s, color 0.3s; 
}

.main-container { 
  max-width: 1140px; 
  margin: 0 auto; 
  padding: 0 1.5rem 4rem; 
}

.hidden { 
  display: none !important; 
}

/* ==========================================================================
   3. NAVIGATION (SOLID BACKGROUND)
   ========================================================================== */
.navbar { 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  padding: 1rem 2.5rem; 
  background: var(--bg-card); 
  border-bottom: 1px solid var(--border-light); 
  position: sticky; 
  top: 0; 
  z-index: 100; 
  width: 100%;
  transition: background-color 0.3s, border-color 0.3s; 
}

.logo { 
  display: flex; 
  align-items: center; 
  gap: 10px; 
  font-size: 1.25rem; 
  font-weight: 800; 
  color: var(--text-main); 
  text-decoration: none; 
}

.logo-icon { 
  color: var(--primary-purple); 
}

.nav-user-menu, 
.user-menu-wrapper { 
  display: flex; 
  align-items: center; 
  gap: 8px; 
  background: var(--bg-subtle); 
  padding: 4px 10px 4px 6px; 
  border-radius: 30px; 
  border: 1px solid var(--border-light); 
}

.nav-avatar,
.gmail-avatar { 
  width: 32px !important; 
  height: 32px !important; 
  min-width: 32px !important;
  min-height: 32px !important;
  border-radius: 50% !important; 
  border: 1px solid var(--primary-purple); 
  object-fit: cover !important; 
  flex-shrink: 0 !important;
  display: block;
}

.nav-username { 
  font-size: 0.88rem; 
  font-weight: 700; 
  color: var(--text-main); 
  margin-right: 4px; 
}

.nav-btn { 
  background: transparent; 
  border: none; 
  color: var(--text-main); 
  font-size: 0.82rem; 
  font-weight: 600; 
  cursor: pointer; 
  padding: 6px 12px; 
  border-radius: 20px; 
  display: flex; 
  align-items: center; 
  gap: 6px; 
  transition: background 0.2s, color 0.2s; 
}

.nav-btn:hover { 
  background: var(--border-light); 
}

.nav-btn.outline { 
  color: var(--text-muted); 
}

.theme-switch-group { 
  display: flex; 
  background: var(--bg-subtle); 
  padding: 3px; 
  border-radius: 20px; 
  border: 1px solid var(--border-light); 
  gap: 2px; 
}

.theme-btn { 
  background: transparent; 
  border: none; 
  color: var(--text-muted); 
  padding: 4px 8px; 
  border-radius: 14px; 
  cursor: pointer; 
  font-size: 0.75rem; 
  transition: all 0.2s; 
}

.theme-btn.active { 
  background: var(--bg-card); 
  color: var(--primary-purple); 
  box-shadow: 0 2px 6px rgba(0,0,0,0.1); 
}

/* ==========================================================================
   4. HERO SECTION & CARDS (SOLID DESIGN)
   ========================================================================== */
.toast { 
  position: fixed; 
  bottom: 20px; 
  right: 20px; 
  background: var(--text-main); 
  color: var(--bg-page); 
  padding: 12px 20px; 
  border-radius: 12px; 
  font-size: 0.88rem; 
  font-weight: 600; 
  z-index: 2000; 
  box-shadow: 0 10px 25px rgba(0,0,0,0.15); 
  animation: fadeIn 0.2s ease; 
}

@keyframes fadeIn { 
  from { opacity: 0; transform: translateY(10px); } 
  to { opacity: 1; transform: translateY(0); } 
}

.hero-grid { 
  display: grid; 
  grid-template-columns: 1.1fr 0.9fr; 
  gap: 3.5rem; 
  align-items: center; 
  padding: 3.5rem 0 3rem; 
}

.pill-badge { 
  display: inline-flex; 
  align-items: center; 
  gap: 8px; 
  background: rgba(124,58,237,0.08); 
  border: 1px solid rgba(124,58,237,0.2); 
  color: var(--primary-purple); 
  font-size: 0.8rem; 
  font-weight: 700; 
  padding: 6px 16px; 
  border-radius: 30px; 
  margin-bottom: 1.2rem; 
}

.hero-title { 
  font-size: 3.1rem; 
  font-weight: 800; 
  line-height: 1.15; 
  letter-spacing: -1px; 
  margin-bottom: 1rem; 
  color: var(--text-main) !important;
  opacity: 1 !important;
}

.gradient-text { 
  background: linear-gradient(135deg, var(--primary-purple), var(--primary-pink)); 
  -webkit-background-clip: text; 
  -webkit-text-fill-color: transparent; 
  display: inline-block;
}

.hero-subtitle { 
  color: var(--text-muted); 
  font-size: 1rem; 
  line-height: 1.6; 
  margin-bottom: 1.75rem; 
  max-width: 480px; 
}

.claim-box { 
  display: flex; 
  align-items: center; 
  background: var(--bg-card); 
  border: 1px solid var(--border-light); 
  border-radius: 14px; 
  padding: 6px 8px 6px 16px; 
  width: 100%;
  max-width: 480px; 
  box-shadow: 0 4px 15px rgba(0,0,0,0.04); 
  transition: border-color 0.2s, box-shadow 0.2s; 
}

.claim-box:focus-within { 
  border-color: var(--primary-purple); 
  box-shadow: 0 0 0 3px rgba(124,58,237,0.15); 
}

.claim-box .prefix { 
  color: var(--text-dim); 
  font-size: 0.95rem; 
  font-weight: 600; 
  white-space: nowrap;
}

.claim-box input { 
  flex: 1; 
  background: transparent; 
  border: none; 
  outline: none; 
  color: var(--text-main); 
  font-size: 0.95rem; 
  padding: 8px; 
  font-weight: 600; 
  min-width: 0;
}

.btn-claim, 
.btn-claim-small { 
  background: var(--primary-purple); 
  color: #ffffff; 
  border: none; 
  font-weight: 700; 
  cursor: pointer; 
  text-decoration: none; 
  display: inline-flex; 
  align-items: center; 
  justify-content: center; 
  gap: 6px; 
  transition: transform 0.2s, background 0.2s; 
}

.btn-claim { 
  padding: 12px 22px; 
  border-radius: 10px; 
  font-size: 0.9rem; 
}

.btn-claim:hover { 
  background: #6d28d9; 
  transform: translateY(-1px); 
}

.btn-claim-small { 
  padding: 7px 14px; 
  border-radius: 8px; 
  font-size: 0.82rem; 
}

.quick-tags { 
  display: flex; 
  gap: 18px; 
  margin-top: 1.25rem; 
  font-size: 0.85rem; 
  color: var(--text-muted); 
  font-weight: 600; 
}

.check-icon { 
  color: var(--primary-purple); 
  margin-right: 4px; 
}

.hero-right { 
  display: flex; 
  justify-content: center; 
}

.clean-card,
.glass-widget-card { 
  background: var(--bg-card) !important; 
  border: 1px solid var(--border-light); 
  border-radius: 24px; 
  padding: 1.75rem; 
  width: 100%; 
  max-width: 360px; 
  box-shadow: var(--card-shadow); 
  display: flex; 
  flex-direction: column; 
  gap: 1rem; 
  transition: box-shadow 0.3s, border-color 0.3s, transform 0.2s; 
}

.clean-card:hover,
.glass-widget-card:hover { 
  box-shadow: var(--card-shadow-hover); 
}

.card-profile-header { 
  text-align: center; 
}

.avatar-wrapper { 
  width: 76px; 
  height: 76px; 
  margin: 0 auto 10px; 
  border-radius: 50%; 
  padding: 3px; 
  background: linear-gradient(135deg, var(--primary-pink), var(--primary-purple)); 
  position: relative; 
}

.card-avatar { 
  width: 100%; 
  height: 100%; 
  border-radius: 50%; 
  background: var(--bg-subtle); 
  object-fit: cover !important; 
}

.profile-name { 
  font-size: 1.2rem; 
  font-weight: 800; 
  color: var(--text-main); 
  display: flex; 
  align-items: center; 
  justify-content: center; 
  gap: 6px; 
}

.verified-icon { 
  color: var(--primary-pink); 
  font-size: 0.9rem; 
}

.profile-handle { 
  font-size: 0.82rem; 
  color: var(--primary-purple); 
  font-weight: 700; 
}

.card-bio { 
  text-align: center; 
  font-size: 0.85rem; 
  color: var(--text-muted); 
  line-height: 1.5; 
}

.card-links { 
  display: flex; 
  flex-direction: column; 
  gap: 8px; 
}

.link-button { 
  display: flex; 
  align-items: center; 
  justify-content: center; 
  gap: 8px; 
  background: var(--bg-subtle); 
  border: 1px solid var(--border-light); 
  color: var(--text-main); 
  text-decoration: none; 
  padding: 10px; 
  border-radius: 10px; 
  font-size: 0.85rem; 
  font-weight: 700; 
  transition: all 0.2s; 
}

.link-button:hover { 
  background: var(--bg-card); 
  border-color: var(--primary-purple); 
  color: var(--primary-purple); 
  transform: translateY(-1px); 
}

.activity-widget { 
  background: var(--bg-subtle); 
  border: 1px solid var(--border-light); 
  border-radius: 12px; 
  padding: 9px 12px; 
  display: flex; 
  align-items: center; 
  gap: 10px; 
}

.activity-widget.spotify { border-color: rgba(22,163,74,0.25); }
.activity-widget.spotify .act-icon { color: var(--spotify-green); }
.activity-widget.discord { border-color: rgba(79,70,229,0.25); }
.activity-widget.discord .act-icon { color: var(--discord-blue); }

.act-text { 
  flex: 1; 
  overflow: hidden; 
}

.act-label { 
  display: block; 
  font-size: 0.62rem; 
  font-weight: 800; 
  color: var(--text-dim); 
  text-transform: uppercase; 
}

.act-title { 
  font-size: 0.78rem; 
  color: var(--text-main); 
  font-weight: 700; 
  white-space: nowrap; 
  overflow: hidden; 
  text-overflow: ellipsis; 
}

.wave-icon { 
  color: var(--spotify-green); 
  font-size: 0.8rem; 
}

.pulse-dot { 
  width: 8px; 
  height: 8px; 
  background: #22c55e; 
  border-radius: 50%; 
  box-shadow: 0 0 8px #22c55e; 
}

/* ==========================================================================
   5. GUIDE SECTION
   ========================================================================== */
.guide-section, 
.guide-wrapper-card { 
  background: var(--bg-card); 
  border-radius: 20px; 
  padding: 2rem; 
  margin-top: 2rem; 
  box-shadow: var(--card-shadow); 
  border: 1px solid var(--border-light); 
}

.section-header, 
.guide-header { 
  margin-bottom: 1.5rem; 
  text-align: left; 
}

.section-title, 
.guide-header h2 { 
  font-size: 1.6rem; 
  font-weight: 800; 
  color: var(--text-main); 
  margin-bottom: 0.3rem; 
  letter-spacing: -0.5px; 
}

.section-subtitle, 
.guide-header p { 
  color: var(--text-muted); 
  font-size: 0.92rem; 
  line-height: 1.45; 
}

.guide-steps-grid, 
.guide-steps-list { 
  display: grid; 
  grid-template-columns: repeat(2, 1fr); 
  gap: 1.25rem; 
}

.guide-card, 
.guide-step-card { 
  background: var(--bg-subtle); 
  border: 1px solid var(--border-light); 
  border-radius: 16px; 
  padding: 1.25rem 1.5rem; 
  display: flex; 
  flex-direction: column; 
  gap: 0.5rem; 
  transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s; 
}

.guide-card:hover, 
.guide-step-card:hover { 
  border-color: var(--border-hover); 
  transform: translateY(-2px); 
  box-shadow: 0 6px 16px rgba(0,0,0,0.04); 
}

.guide-card-top { 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  width: 100%; 
}

.step-badge, 
.step-num { 
  font-size: 1rem; 
  font-weight: 800; 
  color: var(--text-dim); 
  line-height: 1; 
}

.guide-icon, 
.guide-step-icon { 
  font-size: 1.1rem; 
  color: var(--text-main); 
}

.guide-step-icon.purple { color: var(--primary-purple); }
.guide-step-icon.green { color: var(--spotify-green); }
.guide-step-icon.blue { color: var(--discord-blue); }
.guide-step-icon.pink { color: var(--primary-pink); }

.guide-card h3, 
.guide-step-body h3 { 
  font-size: 1.05rem; 
  font-weight: 700; 
  color: var(--text-main); 
  margin-bottom: 0.25rem; 
}

.guide-card p, 
.guide-step-body p { 
  font-size: 0.85rem; 
  color: var(--text-muted); 
  line-height: 1.5; 
  margin: 0; 
}

.guide-card code, 
.guide-step-body code { 
  background: var(--border-light); 
  padding: 1px 6px; 
  border-radius: 4px; 
  font-family: monospace; 
  color: var(--primary-purple); 
  font-weight: 700; 
  font-size: 0.82rem; 
}

/* ==========================================================================
   6. MODAL OVERLAYS & LEADERBOARD (CLEAN OVERLAY, VISIT BUTTON ON ALL, FULL BLUR FOR BLURRED PROFILES)
   ========================================================================== */
.modal-overlay { 
  position: fixed !important; 
  inset: 0 !important; 
  width: 100vw;
  height: 100vh;
  /* Dark backdrop overlay WITHOUT blur filters affecting custom space */
  background: rgba(0, 0, 0, 0.5) !important; 
  display: flex; 
  align-items: center; 
  justify-content: center; 
  z-index: 1000; 
  padding: 1rem; 
}

.modal-overlay.hidden {
  display: none !important;
}

.modal-card { 
  background: var(--bg-card); 
  border: 1px solid var(--border-light); 
  border-radius: 20px; 
  width: 100%; 
  max-width: 480px; 
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3); 
  overflow: hidden; 
}

.leaderboard-modal-card { 
  max-width: 540px; 
}

.modal-header { 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  padding: 1.2rem 1.5rem; 
  border-bottom: 1px solid var(--border-light); 
  flex-shrink: 0;
}

.modal-header h3 { 
  font-size: 1.05rem; 
  font-weight: 700; 
  color: var(--text-main); 
}

.pill-badge-sm { 
  display: inline-flex; 
  align-items: center; 
  gap: 4px; 
  background: rgba(124,58,237,0.1); 
  color: var(--primary-purple); 
  font-size: 0.72rem; 
  font-weight: 700; 
  padding: 3px 10px; 
  border-radius: 20px; 
}

.close-btn { 
  background: none; 
  border: none; 
  color: var(--text-muted); 
  font-size: 1.4rem; 
  cursor: pointer; 
  transition: color 0.2s; 
}

.close-btn:hover { 
  color: var(--text-main); 
}

.modal-body { 
  padding: 1.25rem 1.5rem; 
  overflow-y: auto;
}

.modal-subtitle { 
  font-size: 0.85rem; 
  color: var(--text-muted); 
  margin-bottom: 1.25rem; 
}

.modal-tabs { 
  display: flex; 
  gap: 8px; 
  margin-bottom: 1.25rem; 
  border-bottom: 1px solid var(--border-light); 
  padding-bottom: 8px; 
}

.tab-btn { 
  background: none; 
  border: none; 
  color: var(--text-muted); 
  font-size: 0.82rem; 
  font-weight: 600; 
  padding: 6px 12px; 
  border-radius: 8px; 
  cursor: pointer; 
  display: flex; 
  align-items: center; 
  gap: 6px; 
}

.tab-btn.active { 
  background: rgba(124,58,237,0.1); 
  color: var(--primary-purple); 
}

.tab-content { 
  display: none; 
}

.tab-content.active { 
  display: block; 
}

.leaderboard-list,
#leaderboard-list { 
  display: flex; 
  flex-direction: column; 
  gap: 10px; 
  max-height: 380px; 
  overflow-y: auto; 
  padding-right: 4px; 
}

.leaderboard-item,
.leaderboard-card { 
  display: flex; 
  align-items: center; 
  justify-content: space-between; 
  gap: 12px; 
  background: var(--bg-subtle); 
  border: 1px solid var(--border-light); 
  padding: 10px 14px; 
  border-radius: 14px; 
  text-decoration: none;
  color: var(--text-main);
  transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s; 
}

.leaderboard-item:hover,
.leaderboard-card:hover { 
  border-color: var(--primary-purple); 
  transform: translateY(-1px); 
  box-shadow: 0 4px 12px rgba(0,0,0,0.06);
}

.leaderboard-user-info,
.rank-details-wrapper { 
  display: flex; 
  align-items: center; 
  gap: 12px; 
  flex: 1;
  min-width: 0;
}

.rank-badge,
.rank-number { 
  font-size: 0.85rem; 
  font-weight: 800; 
  color: var(--primary-purple); 
  background: rgba(124,58,237,0.12); 
  padding: 4px 8px; 
  border-radius: 8px; 
  min-width: 32px;
  text-align: center;
  flex-shrink: 0;
}

.leaderboard-item img,
.leaderboard-card img,
.leaderboard-avatar,
.rank-avatar { 
  width: 42px !important; 
  height: 42px !important; 
  min-width: 42px !important; 
  min-height: 42px !important; 
  max-width: 42px !important; 
  max-height: 42px !important; 
  border-radius: 50% !important; 
  object-fit: cover !important; 
  flex-shrink: 0 !important; 
  border: 1px solid var(--border-light); 
  display: block;
}

.rank-details {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.rank-name,
.leaderboard-username {
  font-weight: 700;
  font-size: 0.9rem;
  color: var(--text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rank-handle,
.leaderboard-handle {
  font-size: 0.78rem;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.leaderboard-actions,
.rank-views,
.leaderboard-views { 
  display: flex; 
  align-items: center; 
  gap: 10px; 
  font-size: 0.85rem; 
  font-weight: 700; 
  color: var(--text-muted); 
  white-space: nowrap;
  flex-shrink: 0;
}

/* Visit Profile Button Style (Visibile for EVERYONE including your profile) */
.btn-visit-profile { 
  display: inline-flex !important;
  align-items: center;
  gap: 4px;
  font-size: 0.78rem; 
  font-weight: 700; 
  color: #ffffff !important; 
  background: var(--primary-purple); 
  padding: 6px 14px; 
  border-radius: 8px; 
  text-decoration: none; 
  transition: background 0.2s, transform 0.15s; 
}

.btn-visit-profile:hover { 
  background: #6d28d9; 
  transform: translateY(-1px);
}

/* "You" Self Indicator Tag */
.self-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: rgba(124, 58, 237, 0.12);
  color: var(--primary-purple);
  padding: 5px 10px;
  border-radius: 8px;
  font-size: 0.78rem;
  font-weight: 700;
}

/* BLURRED PROFILE RULES: Blurs avatar photo and Visit button when profile is blurred */
.is-blurred .rank-avatar,
.is-blurred .leaderboard-avatar,
.is-blurred img,
.is-blurred .btn-visit-profile,
.is-blurred .rank-details,
.blurred-profile .rank-avatar,
.blurred-profile .leaderboard-avatar,
.blurred-profile img,
.blurred-profile .btn-visit-profile,
.blurred-profile .rank-details {
  filter: blur(8px) !important;
  pointer-events: none !important;
  user-select: none !important;
}

.form-group { 
  margin-bottom: 1rem; 
}

.form-group label { 
  display: block; 
  font-size: 0.78rem; 
  font-weight: 600; 
  color: var(--text-muted); 
  margin-bottom: 6px; 
}

.modal-input { 
  width: 100%; 
  background: var(--bg-subtle); 
  border: 1px solid var(--border-light); 
  border-radius: 10px; 
  padding: 9px 12px; 
  color: var(--text-main); 
  font-size: 0.88rem; 
  outline: none; 
  transition: border-color 0.2s, background 0.2s; 
}

.modal-input:focus { 
  border-color: var(--primary-purple); 
  background: var(--bg-card); 
}

.input-with-prefix { 
  display: flex; 
  align-items: center; 
  background: var(--bg-subtle); 
  border: 1px solid var(--border-light); 
  border-radius: 10px; 
  padding-left: 10px; 
}

.input-with-prefix span { 
  color: var(--text-dim); 
  font-size: 0.82rem; 
  font-weight: 600; 
}

.input-with-prefix input { 
  border: none; 
  background: transparent; 
}

.modal-footer { 
  display: flex; 
  justify-content: flex-end; 
  gap: 10px; 
  padding: 1rem 1.5rem; 
  background: var(--bg-subtle); 
  border-top: 1px solid var(--border-light); 
  flex-shrink: 0;
}

.status-msg { 
  font-size: 0.78rem; 
  font-weight: 600; 
  margin-top: 8px; 
  text-align: center; 
}

.full-width { 
  width: 100%; 
}

/* ==========================================================================
   7. MEDIA QUERIES (MOBILE RESPONSIVENESS)
   ========================================================================== */
@media (max-width: 900px) {
  .navbar {
    flex-wrap: wrap;
    padding: 0.85rem 1.5rem;
    gap: 10px;
  }

  .nav-center-menu {
    order: 3;
    width: 100%;
    margin-top: 6px;
    justify-content: center;
  }

  .hero-grid { 
    grid-template-columns: 1fr; 
    gap: 2.5rem; 
    padding: 2.5rem 0;
  }

  .hero-left { 
    text-align: center; 
  }

  .hero-subtitle {
    margin-left: auto;
    margin-right: auto;
  }

  .claim-box { 
    margin-left: auto; 
    margin-right: auto; 
  }

  .quick-tags { 
    justify-content: center; 
    margin-left: auto; 
    margin-right: auto; 
  }
}

@media (max-width: 768px) {
  .main-container {
    padding: 0 1rem 3rem;
  }

  .navbar { 
    padding: 0.75rem 1rem; 
  }

  .hero-title { 
    font-size: 2.3rem; 
  }

  .guide-steps-grid, 
  .guide-steps-list { 
    grid-template-columns: 1fr; 
  }

  .guide-wrapper-card,
  .guide-section {
    padding: 1.25rem;
  }

  .leaderboard-item,
  .leaderboard-card {
    padding: 8px 10px;
  }
}

@media (max-width: 576px) {
  .hero-title {
    font-size: 1.95rem;
  }

  .claim-box {
    flex-direction: column;
    padding: 10px;
    gap: 10px;
    align-items: stretch;
  }

  .claim-box .prefix {
    text-align: center;
  }

  .claim-box input {
    text-align: center;
  }

  .btn-claim {
    width: 100%;
    justify-content: center;
  }

  .clean-card {
    max-width: 100%;
    padding: 1.25rem;
  }

  .modal-overlay {
    padding: 0.5rem;
  }

  .modal-card,
  .leaderboard-modal-card {
    border-radius: 16px;
    max-height: 92vh;
  }

  .modal-header,
  .modal-body,
  .modal-footer {
    padding: 1rem;
  }

  .leaderboard-item,
  .leaderboard-card {
    flex-wrap: wrap;
    gap: 8px;
  }

  .leaderboard-actions,
  .rank-views,
  .leaderboard-views {
    width: 100%;
    justify-content: space-between;
    margin-top: 4px;
    padding-top: 4px;
    border-top: 1px dashed var(--border-light);
  }
}

@media (max-width: 400px) {
  .logo span {
    font-size: 1.1rem;
  }

  .nav-btn,
  .btn-claim-small {
    padding: 5px 8px;
    font-size: 0.75rem;
  }

  .quick-tags {
    flex-direction: column;
    gap: 8px;
    align-items: center;
  }
}
