/* ============================================================
   AD ARSENAL — Interactive Engine
   Variable injection, copy, search, navigation, theme toggle
   ============================================================ */

(function () {
    'use strict';

    // ---- State ----
    const VARS_KEY = 'ad_arsenal_vars';
    const THEME_KEY = 'ad_arsenal_theme';

    const DEFAULT_VARS = {
        TARGET_DC: '',
        DOMAIN: '',
        USERNAME: '',
        PASSWORD: '',
        HASH: '',
        ATTACKER_IP: '',
        CA_NAME: '',
        TARGET_HOST: ''
    };

    let currentVars = { ...DEFAULT_VARS };

    // ---- DOM Ready ----
    document.addEventListener('DOMContentLoaded', init);

    function init() {
        loadSavedVars();
        loadTheme();
        renderContent();
        setupVariableBar();
        setupThemeToggle();
        setupSidebar();
        setupSearch();
        setupSections();
        setupCopyButtons();
        setupControls();
        setupMobileToggle();
        populateVarInputs();
        injectVariables();
    }

    // ============================================================
    // RENDER CONTENT FROM DATA
    // ============================================================
    function renderContent() {
        var data = window.ARSENAL_DATA;
        if (!data || !data.length) return;

        var navEl = document.getElementById('sidebar-nav');
        var containerEl = document.getElementById('sections-container');
        if (!navEl || !containerEl) return;

        var navHtml = '';
        var contentHtml = '';

        data.forEach(function (section) {
            // --- Nav item ---
            navHtml += '<a class="nav-item" data-target="' + section.id + '">' +
                '<span class="nav-dot dot-' + section.phase + '"></span>' +
                escapeHtml(section.title.replace(/^\/\/\s*/, '')) + '</a>';

            // --- Section card ---
            contentHtml += '<div id="' + section.id + '" class="section-card phase-' + section.phase + '">';
            contentHtml += '<div class="section-header">';
            contentHtml += '<span class="section-phase-dot"></span>';
            contentHtml += '<span class="section-title">' + escapeHtml(section.title) + '</span>';
            contentHtml += '<span class="section-chevron">▾</span>';
            contentHtml += '</div>';
            contentHtml += '<div class="section-body"><div class="section-content">';

            if (section.intro) {
                contentHtml += '<p class="section-intro">' + escapeHtml(section.intro) + '</p>';
            }

            // Subsections
            if (section.subsections) {
                section.subsections.forEach(function (sub) {
                    contentHtml += '<div class="subsection">';
                    contentHtml += '<h3 class="subsection-title">' + escapeHtml(sub.title) + '</h3>';

                    // Commands
                    if (sub.type === 'commands' && sub.commands) {
                        sub.commands.forEach(function (cmd) {
                            contentHtml += buildCmdBlock(cmd.tool, cmd.cmd, cmd.desc);
                        });
                    }

                    // Diagram / reference
                    if (sub.type === 'diagram' && sub.content) {
                        contentHtml += '<div class="diagram-block">';
                        contentHtml += '<div class="cmd-header"><span class="cmd-tool">' + escapeHtml(sub.tool || 'DIAGRAM') + '</span>';
                        contentHtml += '<button class="copy-btn">📋 Copy</button></div>';
                        contentHtml += '<pre class="diagram-code">' + escapeHtml(sub.content) + '</pre>';
                        contentHtml += '</div>';
                    }

                    // List
                    if (sub.type === 'list' && sub.items) {
                        contentHtml += '<div class="subsection-text"><ul>';
                        sub.items.forEach(function (item) {
                            contentHtml += '<li>' + escapeHtml(item) + '</li>';
                        });
                        contentHtml += '</ul></div>';
                    }

                    // Notes
                    if (sub.notes) {
                        contentHtml += '<div class="subsection-text"><ul>';
                        sub.notes.forEach(function (note) {
                            contentHtml += '<li>' + escapeHtml(note) + '</li>';
                        });
                        contentHtml += '</ul></div>';
                    }

                    // Why box
                    if (sub.why) {
                        contentHtml += '<div class="why-box"><strong>Why this works: </strong>' + escapeHtml(sub.why) + '</div>';
                    }

                    contentHtml += '</div>'; // end subsection
                });
            }

            contentHtml += '</div></div></div>'; // end section-content, section-body, section-card
        });

        navEl.innerHTML = navHtml;
        containerEl.innerHTML = contentHtml;
    }

    function buildCmdBlock(tool, cmd, desc) {
        var html = '<div class="cmd-block">';
        html += '<div class="cmd-header">';
        html += '<span class="cmd-tool">' + escapeHtml(tool) + '</span>';
        html += '<button class="copy-btn">📋 Copy</button>';
        html += '</div>';
        html += '<pre class="cmd-code" data-template="' + escapeHtml(cmd).replace(/"/g, '&quot;') + '">' + escapeHtml(cmd) + '</pre>';
        if (desc) {
            html += '<div style="padding:4px 12px 8px;font-size:0.78rem;color:var(--text-muted);border-top:1px solid var(--border-default);">' + escapeHtml(desc) + '</div>';
        }
        html += '</div>';
        return html;
    }

    // ============================================================
    // THEME TOGGLE (LIGHT / DARK)
    // ============================================================
    function loadTheme() {
        var saved = localStorage.getItem(THEME_KEY);
        var theme = saved || 'dark';
        document.documentElement.setAttribute('data-theme', theme);
        updateThemeIcon(theme);
    }

    function setupThemeToggle() {
        var btn = document.getElementById('theme-toggle');
        if (!btn) return;
        btn.addEventListener('click', function () {
            var current = document.documentElement.getAttribute('data-theme') || 'dark';
            var next = current === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next);
            localStorage.setItem(THEME_KEY, next);
            updateThemeIcon(next);
        });
    }

    function updateThemeIcon(theme) {
        var icon = document.getElementById('theme-icon');
        if (icon) {
            icon.textContent = theme === 'dark' ? '🌙' : '☀️';
        }
    }

    // ============================================================
    // SAVED VARIABLES
    // ============================================================
    function loadSavedVars() {
        var savedVars = localStorage.getItem(VARS_KEY);
        if (savedVars) {
            try { currentVars = { ...DEFAULT_VARS, ...JSON.parse(savedVars) }; } catch (e) { }
        }
    }

    // ============================================================
    // VARIABLE BAR
    // ============================================================
    function setupVariableBar() {
        const toggle = document.querySelector('.var-bar-toggle');
        const grid = document.querySelector('.var-grid');
        const chevron = document.querySelector('.var-bar-chevron');

        if (toggle && grid) {
            // Start open
            grid.classList.add('open');
            if (chevron) chevron.classList.add('open');

            toggle.addEventListener('click', function () {
                grid.classList.toggle('open');
                if (chevron) chevron.classList.toggle('open');
            });
        }

        // Listen for input changes
        document.querySelectorAll('.var-input').forEach(function (input) {
            input.addEventListener('input', function () {
                const key = this.dataset.var;
                if (key) {
                    currentVars[key] = this.value;
                    saveVars();
                    injectVariables();
                }
            });
        });
    }

    function populateVarInputs() {
        document.querySelectorAll('.var-input').forEach(function (input) {
            const key = input.dataset.var;
            if (key && currentVars[key]) {
                input.value = currentVars[key];
            }
        });
    }

    function saveVars() {
        localStorage.setItem(VARS_KEY, JSON.stringify(currentVars));
    }

    // ============================================================
    // VARIABLE INJECTION INTO COMMANDS
    // ============================================================
    function injectVariables() {
        document.querySelectorAll('.cmd-code').forEach(function (block) {
            let template = block.dataset.template;
            if (!template) {
                template = block.textContent;
                block.dataset.template = template;
            }
            let result = template;

            // Replace each variable
            Object.keys(currentVars).forEach(function (key) {
                const val = currentVars[key];
                const placeholder = '{{' + key + '}}';
                if (val) {
                    result = result.split(placeholder).join(
                        '<span class="var-highlight">' + escapeHtml(val) + '</span>'
                    );
                } else {
                    result = result.split(placeholder).join(
                        '<span class="var-highlight">' + placeholder + '</span>'
                    );
                }
            });

            block.innerHTML = result;
        });
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ============================================================
    // COPY TO CLIPBOARD
    // ============================================================
    function setupCopyButtons() {
        document.addEventListener('click', function (e) {
            const btn = e.target.closest('.copy-btn');
            if (!btn) return;

            const block = btn.closest('.cmd-block') || btn.closest('.diagram-block');
            if (!block) return;

            const codeEl = block.querySelector('.cmd-code') || block.querySelector('.diagram-code');
            if (!codeEl) return;

            // Get plain text with variables resolved
            let text = codeEl.dataset.template || codeEl.textContent;

            // Replace variables with actual values
            Object.keys(currentVars).forEach(function (key) {
                const val = currentVars[key];
                const placeholder = '{{' + key + '}}';
                if (val) {
                    text = text.split(placeholder).join(val);
                }
            });

            navigator.clipboard.writeText(text.trim()).then(function () {
                btn.classList.add('copied');
                btn.innerHTML = '✓ Copied';
                block.classList.add('copied');

                setTimeout(function () {
                    btn.classList.remove('copied');
                    btn.innerHTML = '📋 Copy';
                    block.classList.remove('copied');
                }, 1500);
            }).catch(function () {
                // Fallback
                const ta = document.createElement('textarea');
                ta.value = text.trim();
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);

                btn.classList.add('copied');
                btn.innerHTML = '✓ Copied';
                setTimeout(function () {
                    btn.classList.remove('copied');
                    btn.innerHTML = '📋 Copy';
                }, 1500);
            });
        });
    }

    // ============================================================
    // SIDEBAR & NAVIGATION
    // ============================================================
    function setupSidebar() {
        document.querySelectorAll('.nav-item').forEach(function (item) {
            item.addEventListener('click', function (e) {
                e.preventDefault();
                const targetId = this.dataset.target;
                if (!targetId) return;

                const section = document.getElementById(targetId);
                if (!section) return;

                // Open the section
                section.classList.add('open');

                // Scroll to it
                section.scrollIntoView({ behavior: 'smooth', block: 'start' });

                // Update active nav
                document.querySelectorAll('.nav-item').forEach(function (n) { n.classList.remove('active'); });
                this.classList.add('active');

                // Close sidebar on mobile
                if (window.innerWidth <= 900) {
                    document.querySelector('.sidebar').classList.remove('open');
                }
            });
        });
    }

    // ============================================================
    // SEARCH
    // ============================================================
    function setupSearch() {
        const searchInput = document.querySelector('.search-input');
        if (!searchInput) return;

        searchInput.addEventListener('input', function () {
            const query = this.value.toLowerCase().trim();
            document.querySelectorAll('.nav-item').forEach(function (item) {
                const text = item.textContent.toLowerCase();
                if (!query || text.includes(query)) {
                    item.classList.remove('hidden');
                } else {
                    item.classList.add('hidden');
                }
            });

            // Also filter section cards
            document.querySelectorAll('.section-card').forEach(function (card) {
                const text = card.textContent.toLowerCase();
                if (!query || text.includes(query)) {
                    card.style.display = '';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    }

    // ============================================================
    // ACCORDION SECTIONS
    // ============================================================
    function setupSections() {
        document.querySelectorAll('.section-header').forEach(function (header) {
            header.addEventListener('click', function () {
                const card = this.closest('.section-card');
                if (card) card.classList.toggle('open');
            });
        });
    }

    // ============================================================
    // EXPAND ALL / COLLAPSE ALL
    // ============================================================
    function setupControls() {
        const expandBtn = document.getElementById('expand-all');
        const collapseBtn = document.getElementById('collapse-all');

        if (expandBtn) {
            expandBtn.addEventListener('click', function () {
                document.querySelectorAll('.section-card').forEach(function (c) { c.classList.add('open'); });
            });
        }
        if (collapseBtn) {
            collapseBtn.addEventListener('click', function () {
                document.querySelectorAll('.section-card').forEach(function (c) { c.classList.remove('open'); });
            });
        }
    }

    // ============================================================
    // MOBILE SIDEBAR TOGGLE
    // ============================================================
    function setupMobileToggle() {
        const btn = document.querySelector('.mobile-toggle');
        const sidebar = document.querySelector('.sidebar');
        if (btn && sidebar) {
            btn.addEventListener('click', function () {
                sidebar.classList.toggle('open');
            });
        }
    }

})();
