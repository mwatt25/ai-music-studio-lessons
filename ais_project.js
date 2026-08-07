/**
 * AIS Song Project State
 * Shared library for The AI Music Studio
 * Loaded by all session pages via <script src="ais_project.js">
 *
 * Stores one structured object: localStorage['ais_project']
 * All sessions read/write through this API — never directly to localStorage.
 */

(function(global) {
  'use strict';

  var PROJECT_KEY = 'ais_project';
  var SCHEMA_VERSION = 1;

  // ── DEFAULT PROJECT STRUCTURE ──────────────────────────────────────────────
  function defaultProject() {
    var now = new Date().toISOString();
    return {
      schema: SCHEMA_VERSION,
      created: now,
      updated: now,
      project: {
        startingRoute: null   // 'idea' | 'write' | 'ready'
      },
      concept: {
        about: '',
        why: '',
        details: '',
        memory: '',
        feeling: '',
        avoid: '',
        genre: '',
        mood: ''
      },
      blueprint: {
        original: '',
        working: '',
        approved: ''
      },
      lyrics: {
        original: '',
        working: '',
        approved: '',
        ready: false
      },
      production: {
        soundDirection: '',
        sunoPrompt: '',
        songLinks: [],
        selectedVersion: '',
        notes: ''
      },
      visuals: {
        concept: '',
        direction: '',
        storyboard: '',
        generationPrompts: [],
        videoLink: '',
        coverArt: ''
      },
      release: {
        decision: '',       // 'keep' | 'share' | 'release'
        info: '',
        completed: false
      }
    };
  }

  // ── CORE READ / WRITE ──────────────────────────────────────────────────────
  function getProject() {
    try {
      var raw = localStorage.getItem(PROJECT_KEY);
      if (raw) {
        var p = JSON.parse(raw);
        // Ensure all top-level sections exist (forward compatibility)
        var def = defaultProject();
        for (var section in def) {
          if (!p[section]) p[section] = def[section];
        }
        return p;
      }
    } catch(e) {}
    return defaultProject();
  }

  function saveProject(p) {
    try {
      p.updated = new Date().toISOString();
      localStorage.setItem(PROJECT_KEY, JSON.stringify(p));
    } catch(e) {}
  }

  function updateProject(path, value) {
    // path: 'concept.about' or 'lyrics.approved'
    var p = getProject();
    var parts = path.split('.');
    var obj = p;
    for (var i = 0; i < parts.length - 1; i++) {
      if (!obj[parts[i]]) obj[parts[i]] = {};
      obj = obj[parts[i]];
    }
    obj[parts[parts.length - 1]] = value;
    saveProject(p);
  }

  function getField(path) {
    var p = getProject();
    var parts = path.split('.');
    var obj = p;
    for (var i = 0; i < parts.length; i++) {
      if (obj == null) return '';
      obj = obj[parts[i]];
    }
    return obj == null ? '' : obj;
  }

  // ── APPROVED VERSION HELPERS ───────────────────────────────────────────────
  // Always returns the most recently approved version, falling back to working, then original
  function getApprovedBlueprint() {
    var p = getProject();
    return p.blueprint.approved || p.blueprint.working || p.blueprint.original || '';
  }

  function getApprovedLyrics() {
    var p = getProject();
    return p.lyrics.approved || p.lyrics.working || p.lyrics.original || '';
  }

  // ── MIGRATION FROM LEGACY KEYS ─────────────────────────────────────────────
  // Runs once: if ais_project does not exist but legacy ais_ keys do, build from them
  function migrateLegacyKeys() {
    try {
      if (localStorage.getItem(PROJECT_KEY)) return; // already migrated

      var legacyKeys = [
        'ais_start_path','ais_sb_about','ais_sb_why','ais_sb_details',
        'ais_sb_memory','ais_sb_feeling','ais_sb_avoid',
        'ais_genre','ais_mood','ais_blueprint_for_lyrics',
        'ais_lyrics','ais_lyrics_ready'
      ];

      var hasLegacy = legacyKeys.some(function(k) { return !!localStorage.getItem(k); });
      if (!hasLegacy) return;

      var p = defaultProject();
      p.project.startingRoute = localStorage.getItem('ais_start_path') || null;
      p.concept.about   = localStorage.getItem('ais_sb_about')   || '';
      p.concept.why     = localStorage.getItem('ais_sb_why')     || '';
      p.concept.details = localStorage.getItem('ais_sb_details') || '';
      p.concept.memory  = localStorage.getItem('ais_sb_memory')  || '';
      p.concept.feeling = localStorage.getItem('ais_sb_feeling') || '';
      p.concept.avoid   = localStorage.getItem('ais_sb_avoid')   || '';
      p.concept.genre   = localStorage.getItem('ais_genre')      || '';
      p.concept.mood    = localStorage.getItem('ais_mood')       || '';

      var bp = localStorage.getItem('ais_blueprint_for_lyrics') || '';
      p.blueprint.original = bp;
      p.blueprint.working  = bp;
      p.blueprint.approved = bp;

      var lyr = localStorage.getItem('ais_lyrics') || '';
      p.lyrics.original = lyr;
      p.lyrics.working  = lyr;
      p.lyrics.approved = lyr;
      p.lyrics.ready    = localStorage.getItem('ais_lyrics_ready') === '1';

      saveProject(p);
    } catch(e) {}
  }

  // ── SAVE / RESTORE (cross-device backup) ──────────────────────────────────
  function generateBackupCode() {
    try {
      var p = getProject();
      // Compact but human-opaque: base64-encoded JSON
      var json = JSON.stringify(p);
      var encoded = btoa(unescape(encodeURIComponent(json)));
      // Split into 60-char lines for readability
      var lines = [];
      for (var i = 0; i < encoded.length; i += 60) {
        lines.push(encoded.substring(i, i + 60));
      }
      return 'AIS-PROJECT-v1\n' + lines.join('\n') + '\n/AIS-PROJECT';
    } catch(e) { return ''; }
  }

  function restoreFromBackupCode(code) {
    try {
      code = code.trim();
      if (!code.startsWith('AIS-PROJECT-v1')) return false;
      var inner = code
        .replace(/^AIS-PROJECT-v1\n/, '')
        .replace(/\n\/AIS-PROJECT$/, '')
        .replace(/\n/g, '');
      var json = decodeURIComponent(escape(atob(inner)));
      var p = JSON.parse(json);
      if (!p || !p.schema) return false;
      saveProject(p);
      return true;
    } catch(e) { return false; }
  }

  // ── "YOUR SONG SO FAR" CARD ────────────────────────────────────────────────
  // Renders into a container element by ID
  // completedStages: array of completed stage names, e.g. ['concept','lyrics']
  // nextPrompt: string shown after the checkmarks, e.g. "Now let's hear it."
  function renderSongCard(containerId, completedStages, nextPrompt) {
    var el = document.getElementById(containerId);
    if (!el) return;

    var p = getProject();
    var title = getApprovedBlueprint();
    // Try to extract working title from blueprint text
    var titleLine = '';
    if (title) {
      var m = title.match(/working title[:\s]+([^\n]+)/i);
      if (m) titleLine = m[1].trim().replace(/^["']|["']$/g,'');
    }
    if (!titleLine) titleLine = 'Your Song';

    var genre = p.concept.genre || '';
    var mood  = p.concept.mood  || '';
    var meta  = [genre, mood].filter(Boolean).join(' · ');

    var stageLabels = {
      concept: 'Concept',
      lyrics: 'Lyrics',
      production: 'Song',
      visuals: 'Video'
    };

    var checksHtml = (completedStages || []).map(function(s) {
      return '<div class="ssf-check"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>' + (stageLabels[s] || s) + '</div>';
    }).join('');

    el.innerHTML =
      '<div class="ssf-card">' +
        '<div class="ssf-eyebrow">Your Song So Far</div>' +
        '<div class="ssf-title">' + escHtml(titleLine) + '</div>' +
        (meta ? '<div class="ssf-meta">' + escHtml(meta) + '</div>' : '') +
        (checksHtml ? '<div class="ssf-checks">' + checksHtml + '</div>' : '') +
        (nextPrompt ? '<div class="ssf-next">' + escHtml(nextPrompt) + '</div>' : '') +
      '</div>';
  }

  // ── SAVE/RESTORE UI HELPERS ────────────────────────────────────────────────
  function renderSaveRestoreUI(containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML =
      '<div class="sr-wrap">' +
        '<div class="sr-section">' +
          '<div class="sr-label">Save My Project</div>' +
          '<p class="sr-desc">Want a backup or planning to switch devices? Save a copy of your Studio project.</p>' +
          '<button class="sr-btn" onclick="AISProject.showSaveCode()">Generate Project Backup</button>' +
          '<div id="sr-save-output" style="display:none;margin-top:12px;">' +
            '<p class="sr-desc" style="margin-bottom:6px;">Copy this code and keep it somewhere safe.</p>' +
            '<textarea id="sr-code-box" readonly style="width:100%;min-height:80px;background:var(--navy-4,#080C12);border:1px solid rgba(255,255,255,0.12);color:#E8EDF2;font-family:\'Courier New\',monospace;font-size:11px;padding:10px;outline:none;resize:vertical;line-height:1.6;"></textarea>' +
            '<button class="sr-btn" style="margin-top:8px;" onclick="AISProject.copyBackupCode()">Copy Code</button>' +
          '</div>' +
        '</div>' +
        '<div class="sr-section" style="margin-top:24px;padding-top:24px;border-top:1px solid rgba(255,255,255,0.07);">' +
          '<div class="sr-label">Restore a Project</div>' +
          '<p class="sr-desc">Paste your saved project code here.</p>' +
          '<textarea id="sr-restore-box" placeholder="Paste your project backup code here..." style="width:100%;min-height:80px;background:var(--navy-4,#080C12);border:1px solid rgba(255,255,255,0.12);color:#E8EDF2;font-family:\'Courier New\',monospace;font-size:11px;padding:10px;outline:none;resize:vertical;line-height:1.6;"></textarea>' +
          '<button class="sr-btn" style="margin-top:8px;" onclick="AISProject.doRestore()">Restore Project</button>' +
          '<div id="sr-restore-status" style="display:none;margin-top:10px;font-size:13px;font-weight:700;color:#27AE60;">Your project is back.</div>' +
        '</div>' +
        '<p style="font-size:11px;color:rgba(122,138,154,0.7);margin-top:20px;line-height:1.6;">Your Studio project saves automatically in this browser. Switching devices? Save a project backup first.</p>' +
      '</div>';
  }

  function showSaveCode() {
    var code = generateBackupCode();
    var out = document.getElementById('sr-save-output');
    var box = document.getElementById('sr-code-box');
    if (out) out.style.display = 'block';
    if (box) box.value = code;
  }

  function copyBackupCode() {
    var box = document.getElementById('sr-code-box');
    if (!box) return;
    var text = box.value;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function() { fallbackCopy(box); });
    } else { fallbackCopy(box); }
  }

  function fallbackCopy(el) {
    el.select();
    try { document.execCommand('copy'); } catch(e) {}
  }

  function doRestore() {
    var box = document.getElementById('sr-restore-box');
    var status = document.getElementById('sr-restore-status');
    if (!box) return;
    var ok = restoreFromBackupCode(box.value);
    if (status) {
      status.style.display = 'block';
      if (ok) {
        status.textContent = 'Your project is back.';
        status.style.color = '#27AE60';
        // Reload page to repopulate all fields
        setTimeout(function() { window.location.reload(); }, 1200);
      } else {
        status.textContent = 'Could not read that backup. Please check the code and try again.';
        status.style.color = '#E74C3C';
      }
    }
  }

  // ── UTILITIES ──────────────────────────────────────────────────────────────
  function escHtml(s) {
    return String(s)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

  // ── RUN MIGRATION ON LOAD ──────────────────────────────────────────────────
  migrateLegacyKeys();

  // ── PUBLIC API ─────────────────────────────────────────────────────────────
  global.AISProject = {
    get:                  getProject,
    save:                 saveProject,
    update:               updateProject,
    field:                getField,
    approvedBlueprint:    getApprovedBlueprint,
    approvedLyrics:       getApprovedLyrics,
    renderSongCard:       renderSongCard,
    renderSaveRestoreUI:  renderSaveRestoreUI,
    showSaveCode:         showSaveCode,
    copyBackupCode:       copyBackupCode,
    doRestore:            doRestore,
    generateBackupCode:   generateBackupCode,
    restoreFromBackupCode: restoreFromBackupCode
  };

})(window);
