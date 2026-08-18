(function () {
  const root = document.getElementById("root");
  const userPill = document.getElementById("user-pill");

  if (!window.supabase || SUPABASE_URL.includes("YOUR-PROJECT-REF")) {
    root.innerHTML =
      '<div class="setup-warning">Supabase isn\'t configured yet. Open <code>config.js</code> and paste in your Supabase project URL and anon key (Supabase dashboard → Settings → API), then reload this page.</div>';
    return;
  }

  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  let tests = [];
  let target = 65;
  let loaded = false;
  let chart = null;
  let formError = "";
  let currentUser = null;
  let authMode = "login"; // 'login' | 'signup'
  let authError = "";
  let authNotice = "";

  // ---------- AUTH ----------

  function renderAuth() {
    userPill.innerHTML = "";
    document.getElementById("footer-note").style.display = "none";
    root.innerHTML = `
      <div class="panel auth-panel">
        <div class="auth-tabs">
          <div class="auth-tab ${authMode === "login" ? "active" : ""}" id="tab-login">Log in</div>
          <div class="auth-tab ${authMode === "signup" ? "active" : ""}" id="tab-signup">Sign up</div>
        </div>
        <div class="auth-field">
          <label>Email</label>
          <input type="email" id="auth-email" autocomplete="email"/>
        </div>
        <div class="auth-field">
          <label>Password</label>
          <input type="password" id="auth-password" autocomplete="${authMode === "login" ? "current-password" : "new-password"}"/>
        </div>
        <button id="auth-submit" style="width:100%;">${authMode === "login" ? "Log in" : "Create account"}</button>
        ${authError ? `<div class="auth-msg error">${authError}</div>` : ""}
        ${authNotice ? `<div class="auth-msg ok">${authNotice}</div>` : ""}
      </div>
    `;
    document.getElementById("tab-login").addEventListener("click", () => {
      authMode = "login"; authError = ""; authNotice = ""; renderAuth();
    });
    document.getElementById("tab-signup").addEventListener("click", () => {
      authMode = "signup"; authError = ""; authNotice = ""; renderAuth();
    });
    document.getElementById("auth-submit").addEventListener("click", onAuthSubmit);
    root.querySelectorAll("#auth-email, #auth-password").forEach((el) => {
      el.addEventListener("keydown", (e) => { if (e.key === "Enter") onAuthSubmit(); });
    });
  }

  async function onAuthSubmit() {
    const email = document.getElementById("auth-email").value.trim();
    const password = document.getElementById("auth-password").value;
    authError = ""; authNotice = "";

    if (!email || !password) {
      authError = "Enter both email and password.";
      renderAuth();
      return;
    }

    if (authMode === "signup") {
      const { data, error } = await sb.auth.signUp({ email, password });
      if (error) {
        authError = error.message;
        renderAuth();
        return;
      }
      if (data.session) {
        // Email confirmation is off — logged in immediately.
        await ensureSettingsRow();
        return; // onAuthStateChange will pick it up
      }
      authNotice = "Account created. Check your email to confirm, then log in.";
      authMode = "login";
      renderAuth();
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) {
        authError = error.message;
        renderAuth();
      }
      // success handled by onAuthStateChange
    }
  }

  async function ensureSettingsRow() {
    // Create a default settings row for a brand-new user, ignore if it already exists.
    await sb.from("settings").insert({ target: 65 }).select();
  }

  async function logout() {
    await sb.auth.signOut();
  }

  sb.auth.onAuthStateChange((_event, session) => {
    const user = session ? session.user : null;
    const changed = (user && !currentUser) || (!user && currentUser) || (user && currentUser && user.id !== currentUser.id);
    currentUser = user;
    if (!currentUser) {
      loaded = false;
      tests = [];
      target = 65;
      renderAuth();
      return;
    }
    if (changed) {
      loaded = false;
      loadData();
    }
  });

  function fmtPct(m, t) {
    return t ? Math.round((m / t) * 1000) / 10 : 0;
  }
  function pctColor(p) {
    if (p >= target) return "hi";
    if (p >= target - 10) return "mid";
    return "lo";
  }

  async function loadData() {
    if (!currentUser) return;

    const { data: testRows, error: e1 } = await sb
      .from("mock_tests")
      .select("*")
      .order("test_date", { ascending: true });
    if (e1) console.error(e1);
    tests = (testRows || []).map((r) => ({
      id: r.id,
      date: r.test_date,
      subject: r.subject,
      marks: Number(r.marks),
      total: Number(r.total),
    }));

    let { data: settingsRow, error: e2 } = await sb
      .from("settings")
      .select("*")
      .eq("user_id", currentUser.id)
      .maybeSingle();
    if (e2) console.error(e2);
    if (!settingsRow) {
      await ensureSettingsRow();
      const retry = await sb.from("settings").select("*").eq("user_id", currentUser.id).maybeSingle();
      settingsRow = retry.data;
    }
    target = settingsRow ? Number(settingsRow.target) : 65;

    loaded = true;
    render();
  }

  async function addTest(date, subject, marks, total) {
    const { error } = await sb
      .from("mock_tests")
      .insert({ test_date: date, subject, marks, total });
    if (error) {
      formError = "Could not save: " + error.message;
      render();
      return;
    }
    formError = "";
    await loadData();
  }

  async function deleteTest(id) {
    const { error } = await sb.from("mock_tests").delete().eq("id", id);
    if (error) console.error(error);
    await loadData();
  }

  async function saveTarget(newTarget) {
    target = newTarget;
    const { error } = await sb
      .from("settings")
      .update({ target: newTarget })
      .eq("user_id", currentUser.id);
    if (error) console.error(error);
    render();
  }

  function computeStats() {
    if (tests.length === 0) return { avg: 0, latest: 0, best: 0, delta: 0 };
    const pcts = tests.map((t) => fmtPct(t.marks, t.total));
    const avg = Math.round((pcts.reduce((a, b) => a + b, 0) / pcts.length) * 10) / 10;
    const latest = pcts[pcts.length - 1];
    const best = Math.max(...pcts);
    const prev = pcts.length > 1 ? pcts[pcts.length - 2] : latest;
    const delta = Math.round((latest - prev) * 10) / 10;
    return { avg, latest, best, delta };
  }

  function gaugeSVG(current) {
    const pct = Math.max(0, Math.min(100, current));
    const r = 70, cx = 100, cy = 100;
    const circumference = Math.PI * r;
    const offset = circumference * (1 - pct / 100);
    const targetAngle = Math.PI * (1 - target / 100);
    const tx = cx + r * Math.cos(targetAngle);
    const ty = cy - r * Math.sin(targetAngle);
    const color = pct >= target ? "#5FBF7A" : pct >= target - 10 ? "#F2A93B" : "#E2574C";
    return `
    <svg width="200" height="130" viewBox="0 0 200 130" role="img" aria-label="Gauge showing average score ${pct} percent against target ${target} percent">
      <path d="M 30 100 A 70 70 0 0 1 170 100" fill="none" stroke="#0E1524" stroke-width="14" stroke-linecap="round"/>
      <path d="M 30 100 A 70 70 0 0 1 170 100" fill="none" stroke="${color}" stroke-width="14" stroke-linecap="round"
        stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"/>
      <line x1="${tx}" y1="${ty}" x2="${cx + (r - 18) * Math.cos(targetAngle)}" y2="${cy - (r - 18) * Math.sin(targetAngle)}" stroke="#4FD1C5" stroke-width="3"/>
      <text x="100" y="95" text-anchor="middle" class="gauge-num">${pct}%</text>
      <text x="100" y="115" text-anchor="middle" class="gauge-lbl">AVERAGE &middot; TARGET ${target}%</text>
    </svg>`;
  }

  function renderChart() {
    const canvas = document.getElementById("trendChart");
    if (!canvas) return;
    if (chart) chart.destroy();
    if (tests.length === 0) return;
    const labels = tests.map((t) => t.date);
    const data = tests.map((t) => fmtPct(t.marks, t.total));
    chart = new Chart(canvas, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Score %",
            data,
            borderColor: "#F2A93B",
            backgroundColor: "rgba(242,169,59,0.1)",
            fill: true,
            tension: 0.25,
            pointRadius: 4,
            pointBackgroundColor: "#F2A93B",
            borderWidth: 2,
          },
          {
            label: "Target",
            data: labels.map(() => target),
            borderColor: "#4FD1C5",
            borderDash: [6, 4],
            pointRadius: 0,
            borderWidth: 1.5,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: { legend: { display: false } },
        scales: {
          y: { min: 0, max: 100, ticks: { color: "#8C9AB5", callback: (v) => v + "%" }, grid: { color: "#243046" } },
          x: { ticks: { color: "#8C9AB5" }, grid: { display: false } },
        },
      },
    });
  }

  function render() {
    if (!loaded) {
      root.innerHTML = '<div class="loading">Loading saved tests…</div>';
      return;
    }

    userPill.innerHTML = `<span>${currentUser.email}</span><button class="ghost" id="logout-btn">log out</button>`;
    document.getElementById("logout-btn").addEventListener("click", logout);
    document.getElementById("footer-note").style.display = "block";

    const stats = computeStats();
    const deltaClass = stats.delta > 0 ? "up" : stats.delta < 0 ? "down" : "";
    const deltaSign = stats.delta > 0 ? "+" : "";

    const rowsHTML = tests
      .slice()
      .reverse()
      .map((t) => {
        const p = fmtPct(t.marks, t.total);
        return `<tr>
          <td class="mono">${t.date}</td>
          <td>${t.subject}</td>
          <td class="mono">${t.marks} / ${t.total}</td>
          <td class="pct ${pctColor(p)}">${p}%</td>
          <td><button class="ghost" data-del="${t.id}">remove</button></td>
        </tr>`;
      })
      .join("");

    root.innerHTML = `
      <div class="panel top-grid">
        <div class="gauge-wrap">${gaugeSVG(stats.avg)}</div>
        <div>
          <div class="stat-row">
            <div class="stat"><div class="stat-label">Latest score</div><div class="stat-value">${stats.latest}%</div></div>
            <div class="stat"><div class="stat-label">Best score</div><div class="stat-value">${stats.best}%</div></div>
            <div class="stat"><div class="stat-label">Vs previous</div><div class="stat-value ${deltaClass}">${deltaSign}${stats.delta}%</div></div>
          </div>
          <div class="target-row">
            <label for="targetInput">Target score (%)</label>
            <input type="number" id="targetInput" min="0" max="100" value="${target}"/>
            <span style="color:var(--ink-dim);font-size:12px;">${tests.length} test${tests.length === 1 ? "" : "s"} logged</span>
          </div>
        </div>
      </div>

      <div class="panel">
        <p class="panel-title">Log a mock test</p>
        <div class="form-grid">
          <div class="field"><label>Date</label><input type="date" id="f-date"/></div>
          <div class="field"><label>Subject</label><input type="text" id="f-subject" placeholder="e.g. Engineering Mathematics" list="subj-list"/>
            <datalist id="subj-list">
              <option value="Engineering Mathematics"></option>
              <option value="General Aptitude"></option>
              <option value="Data Structures"></option>
              <option value="Algorithms"></option>
              <option value="Full Length Mock"></option>
            </datalist>
          </div>
          <div class="field"><label>Marks obtained</label><input type="number" id="f-marks" step="0.01" min="0"/></div>
          <div class="field"><label>Total marks</label><input type="number" id="f-total" step="0.01" min="1" value="100"/></div>
          <div class="field"><button id="add-btn">Add entry</button></div>
        </div>
        ${formError ? `<div class="err">${formError}</div>` : ""}
      </div>

      <div class="panel">
        <p class="panel-title">Score trend</p>
        <div class="chart-wrap"><canvas id="trendChart" role="img" aria-label="Line chart of score percentage over time against target"></canvas></div>
      </div>

      <div class="panel">
        <p class="panel-title">Test log</p>
        ${
          tests.length === 0
            ? '<div class="empty">No mock tests logged yet. Add your first one above.</div>'
            : `<table>
          <thead><tr><th>Date</th><th>Subject</th><th>Marks</th><th>Score</th><th></th></tr></thead>
          <tbody>${rowsHTML}</tbody>
        </table>`
        }
      </div>
    `;

    document.getElementById("add-btn").addEventListener("click", onAdd);
    document.getElementById("targetInput").addEventListener("change", (e) => {
      const v = parseFloat(e.target.value);
      if (!isNaN(v)) saveTarget(Math.max(0, Math.min(100, v)));
    });
    root.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", () => deleteTest(btn.getAttribute("data-del")));
    });

    renderChart();
  }

  function onAdd() {
    const date = document.getElementById("f-date").value;
    const subject = document.getElementById("f-subject").value.trim();
    const marks = parseFloat(document.getElementById("f-marks").value);
    const total = parseFloat(document.getElementById("f-total").value);

    if (!date || !subject || isNaN(marks) || isNaN(total) || total <= 0) {
      formError = "Fill in date, subject, marks and a total greater than 0.";
      render();
      return;
    }
    if (marks > total) {
      formError = "Marks obtained cannot exceed total marks.";
      render();
      return;
    }
    formError = "";
    addTest(date, subject, marks, total);
  }

  document.getElementById("reset-btn").addEventListener("click", async () => {
    if (!currentUser) return;
    if (!confirm("Clear all of your logged mock tests? This cannot be undone.")) return;
    const { error } = await sb.from("mock_tests").delete().eq("user_id", currentUser.id);
    if (error) console.error(error);
    await loadData();
  });

  // Initial check: is someone already logged in from a previous visit?
  sb.auth.getSession().then(({ data }) => {
    if (data.session) {
      currentUser = data.session.user;
      loadData();
    } else {
      renderAuth();
    }
  });
})();
