/**
 * AIS Song Project State  —  v2
 * Shared library for The AI Music Studio
 *
 * Single source of truth: localStorage['ais_project']
 * All sessions read/write through this API only.
 *
 * SECURITY NOTE:
 * Project data is stored in browser localStorage (unencrypted).
 * Backup codes use Base64 encoding — this is NOT encryption.
 * Do not describe storage as secure, encrypted, or private.
 */

(function(global) {
  'use strict';

  var PROJECT_KEY    = 'ais_project';
  var SCHEMA_VERSION = 2;
  var BACKUP_HEADER  = 'AIS-PROJECT-v2';

  // ── DEFAULT PROJECT STRUCTURE ──────────────────────────────────────────────
  function defaultProject() {
    var now = new Date().toISOString();
    return {
      schema:  SCHEMA_VERSION,
      created: now,
      updated: now,
      project: {
        startingRoute: null   // 'idea' | 'write' | 'ready'
      },
      concept: {
        about:   '',
        why:     '',
        details: '',
        memory:  '',
        feeling: '',
        avoid:   '',
        genre:   '',
        mood:    ''
      },
      blueprint: {
        original: '',   // first version generated
        working:  '',   // current in-progress version
        approved: ''    // creator-approved version — used by later sessions
      },
      lyrics: {
        original: '',   // first version (AI or creator)
        working:  '',   // current in-progress version
        approved: '',   // creator-approved version — used by later sessions
        ready:    false
      },
      production: {
        soundDirection:  '',
        sunoPrompt:      '',
        songLinks:       [],
        selectedVersion: '',
        notes:           ''
      },
      visuals: {
        concept:            '',
        direction:          '',
        storyboard:         '',
        generationPrompts:  [],
        videoLink:          '',
        coverArt:           ''
      },
      release: {
        decision:  '',      // 'keep' | 'share' | 'release'
        info:      '',
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
        if (p && p.schema) {
          // Forward-fill any missing sections (schema evolution)
          var def = defaultProject();
          for (var section in def) {
            if (p[section] === undefined || p[section] === null) {
              p[section] = def[section];
            }
          }
          return p;
        }
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

  /**
   * updateProject(path, value)
   * path: dot-notation string, e.g. 'concept.about' or 'lyrics.approved'
   * Writes to ais_project ONLY. Legacy keys are never written here.
   */
  function updateProject(path, value) {
    var p = getProject();
    var parts = path.split('.');
    var obj = p;
    for (var i = 0; i < parts.length - 1; i++) {
      if (obj[parts[i]] === undefined || obj[parts[i]] === null) obj[parts[i]] = {};
      obj = obj[parts[i]];
    }
    obj[parts[parts.length - 1]] = value;
    saveProject(p);
  }

  /**
   * getField(path)
   * Returns the value at the dot-notation path, or '' if not found.
   */
  function getField(path) {
    var p = getProject();
    var parts = path.split('.');
    var obj = p;
    for (var i = 0; i < parts.length; i++) {
      if (obj === null || obj === undefined) return '';
      obj = obj[parts[i]];
    }
    return (obj === null || obj === undefined) ? '' : obj;
  }

  // ── APPROVED VERSION HELPERS ───────────────────────────────────────────────
  // Always returns the most recently approved version.
  // Falls back: approved → working → original
  function getApprovedBlueprint() {
    var p = getProject();
    return p.blueprint.approved || p.blueprint.working || p.blueprint.original || '';
  }

  function getApprovedLyrics() {
    var p = getProject();
    return p.lyrics.approved || p.lyrics.working || p.lyrics.original || '';
  }

  // ── APPROVE HELPERS ────────────────────────────────────────────────────────
  // Call these when the creator clicks "Pick It" / "That's It"
  function approveBlueprint(text) {
    var p = getProject();
    if (!p.blueprint.original) p.blueprint.original = text;
    p.blueprint.working  = text;
    p.blueprint.approved = text;
    saveProject(p);
  }

  function approveLyrics(text) {
    var p = getProject();
    if (!p.lyrics.original) p.lyrics.original = text;
    p.lyrics.working  = text;
    p.lyrics.approved = text;
    p.lyrics.ready    = true;
    saveProject(p);
  }

  // ── MIGRATION FROM LEGACY KEYS ─────────────────────────────────────────────
  // Runs once on load.
  // If ais_project does not exist but legacy ais_ keys do, build from them.
  // song_type and song_label are intentionally excluded (Welcome selector removed).
  // After migration, ais_project is the source of truth — legacy keys are never
  // written to again by this library.
  function migrateLegacyKeys() {
    try {
      var existing = localStorage.getItem(PROJECT_KEY);
      if (existing) {
        // Already migrated. Ensure schema version is current.
        try {
          var ep = JSON.parse(existing);
          if (ep && ep.schema < SCHEMA_VERSION) {
            ep.schema = SCHEMA_VERSION;
            saveProject(ep);
          }
        } catch(e) {}
        return;
      }

      // Check for legacy keys (excluding song_type, song_label)
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

  // ── BACKUP / RESTORE ───────────────────────────────────────────────────────
  // Base64 encoding — NOT encryption. Do not describe as secure.
  function generateBackupCode() {
    try {
      var p = getProject();
      var json = JSON.stringify(p);
      var encoded = btoa(unescape(encodeURIComponent(json)));
      var lines = [BACKUP_HEADER];
      for (var i = 0; i < encoded.length; i += 60) {
        lines.push(encoded.substring(i, i + 60));
      }
      lines.push('/AIS-PROJECT');
      return lines.join('\n');
    } catch(e) { return ''; }
  }

  /**
   * validateBackupCode(code)
   * Returns {valid: bool, project: obj|null, error: string}
   */
  function validateBackupCode(code) {
    try {
      code = (code || '').trim();
      if (!code.startsWith(BACKUP_HEADER)) {
        return {valid: false, project: null, error: 'This does not look like an AI Music Studio project backup.'};
      }
      var inner = code
        .replace(new RegExp('^' + BACKUP_HEADER + '\n'), '')
        .replace(/\n\/AIS-PROJECT$/, '')
        .replace(/\n/g, '');
      var json = decodeURIComponent(escape(atob(inner)));
      var p = JSON.parse(json);
      if (!p || !p.schema) {
        return {valid: false, project: null, error: 'The backup appears to be incomplete or corrupted.'};
      }
      if (!p.concept || !p.lyrics || !p.blueprint) {
        return {valid: false, project: null, error: 'The backup is missing required project sections.'};
      }
      return {valid: true, project: p, error: ''};
    } catch(e) {
      return {valid: false, project: null, error: 'Could not read that backup. Please check the code and try again.'};
    }
  }

  function restoreFromBackupCode(code) {
    var result = validateBackupCode(code);
    if (!result.valid) return {ok: false, error: result.error};
    saveProject(result.project);
    return {ok: true, error: ''};
  }

  // ── "YOUR SONG SO FAR" CARD ────────────────────────────────────────────────
  function renderSongCard(containerId, completedStages, nextPrompt) {
    var el = document.getElementById(containerId);
    if (!el) return;

    var p = getProject();
    var bp = getApprovedBlueprint();
    var titleLine = '';
    if (bp) {
      var m = bp.match(/working title[:\s]+([^\n]+)/i);
      if (m) titleLine = m[1].trim().replace(/^["']|["']$/g, '');
    }
    if (!titleLine) titleLine = 'Your Song';

    var genre = p.concept.genre || '';
    var mood  = p.concept.mood  || '';
    var meta  = [genre, mood].filter(Boolean).join(' · ');

    var stageLabels = {concept:'Concept', lyrics:'Lyrics', production:'Song', visuals:'Video'};

    var checksHtml = (completedStages || []).map(function(s) {
      return '<div class="ssf-check">' +
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>' +
        escHtml(stageLabels[s] || s) +
        '</div>';
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

  // ── SAVE / RESTORE UI ──────────────────────────────────────────────────────
  function renderSaveRestoreUI(containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML =
      '<div class="sr-wrap">' +
        '<div class="sr-section">' +
          '<div class="sr-label">Save My Project</div>' +
          '<p class="sr-desc">Create a backup you can save or use on another device.</p>' +
          '<button class="sr-btn" onclick="AISProject.showSaveCode()">Generate Project Backup</button>' +
          '<div id="sr-save-output" style="display:none;margin-top:12px;">' +
            '<p class="sr-desc" style="margin-bottom:6px;">Copy this code and keep it somewhere you trust. Anyone with this backup can restore the project.</p>' +
            '<textarea id="sr-code-box" readonly style="width:100%;min-height:80px;background:var(--navy-4,#080C12);border:1px solid rgba(255,255,255,0.12);color:#E8EDF2;font-family:\'Courier New\',monospace;font-size:11px;padding:10px;outline:none;resize:vertical;line-height:1.6;"></textarea>' +
            '<button class="sr-btn" style="margin-top:8px;" onclick="AISProject.copyBackupCode()">Copy Code</button>' +
          '</div>' +
        '</div>' +
        '<div class="sr-section" style="margin-top:24px;padding-top:24px;border-top:1px solid rgba(255,255,255,0.07);">' +
          '<div class="sr-label">Restore a Project</div>' +
          '<p class="sr-desc">Paste your saved project code here.</p>' +
          '<textarea id="sr-restore-box" placeholder="Paste your project backup code here..." style="width:100%;min-height:80px;background:var(--navy-4,#080C12);border:1px solid rgba(255,255,255,0.12);color:#E8EDF2;font-family:\'Courier New\',monospace;font-size:11px;padding:10px;outline:none;resize:vertical;line-height:1.6;"></textarea>' +
          '<button class="sr-btn" style="margin-top:8px;" onclick="AISProject.confirmRestore()">Restore Project</button>' +
          '<div id="sr-restore-confirm" style="display:none;margin-top:12px;background:rgba(245,166,35,0.06);border:1px solid rgba(245,166,35,0.2);padding:14px 16px;">' +
            '<p style="font-size:13px;color:#E8EDF2;margin-bottom:12px;font-weight:600;">Restore this project? This will replace the Studio project currently saved in this browser.</p>' +
            '<div style="display:flex;gap:10px;">' +
              '<button class="sr-btn" onclick="AISProject.doRestore()">Yes, Restore</button>' +
              '<button class="sr-btn" style="border-color:rgba(255,255,255,0.2);color:rgba(196,205,214,0.7);" onclick="AISProject.cancelRestore()">Cancel</button>' +
            '</div>' +
          '</div>' +
          '<div id="sr-restore-status" style="display:none;margin-top:10px;font-size:13px;font-weight:700;"></div>' +
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
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(box.value).catch(function() { _fallbackCopy(box); });
    } else { _fallbackCopy(box); }
  }

  function _fallbackCopy(el) {
    el.select();
    try { document.execCommand('copy'); } catch(e) {}
  }

  function confirmRestore() {
    var box = document.getElementById('sr-restore-box');
    var status = document.getElementById('sr-restore-status');
    var confirm = document.getElementById('sr-restore-confirm');
    if (!box) return;
    // Validate first
    var result = validateBackupCode(box.value);
    if (!result.valid) {
      if (status) {
        status.style.display = 'block';
        status.textContent = result.error;
        status.style.color = '#E74C3C';
      }
      if (confirm) confirm.style.display = 'none';
      return;
    }
    // Valid — show confirmation
    if (status) status.style.display = 'none';
    if (confirm) confirm.style.display = 'block';
  }

  function cancelRestore() {
    var confirm = document.getElementById('sr-restore-confirm');
    if (confirm) confirm.style.display = 'none';
  }

  function doRestore() {
    var box = document.getElementById('sr-restore-box');
    var status = document.getElementById('sr-restore-status');
    var confirm = document.getElementById('sr-restore-confirm');
    if (!box) return;
    var result = restoreFromBackupCode(box.value);
    if (confirm) confirm.style.display = 'none';
    if (status) {
      status.style.display = 'block';
      if (result.ok) {
        status.textContent = 'Your project is back.';
        status.style.color = '#27AE60';
        setTimeout(function() { window.location.reload(); }, 1200);
      } else {
        status.textContent = result.error;
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
    // Core
    get:                  getProject,
    save:                 saveProject,
    update:               updateProject,
    field:                getField,
    // Approved versions
    approvedBlueprint:    getApprovedBlueprint,
    approvedLyrics:       getApprovedLyrics,
    approveBlueprint:     approveBlueprint,
    approveLyrics:        approveLyrics,
    // Backup / Restore
    generateBackupCode:   generateBackupCode,
    validateBackupCode:   validateBackupCode,
    restoreFromBackupCode: restoreFromBackupCode,
    // UI
    renderSongCard:       renderSongCard,
    renderSaveRestoreUI:  renderSaveRestoreUI,
    showSaveCode:         showSaveCode,
    copyBackupCode:       copyBackupCode,
    confirmRestore:       confirmRestore,
    cancelRestore:        cancelRestore,
    doRestore:            doRestore
  };

})(window);
