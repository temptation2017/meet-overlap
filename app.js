(function () {
  "use strict";

  var PRESETS = [
    { label: "北京 / 上海", tz: "Asia/Shanghai" },
    { label: "东京", tz: "Asia/Tokyo" },
    { label: "新加坡", tz: "Asia/Singapore" },
    { label: "印度班加罗尔", tz: "Asia/Kolkata" },
    { label: "迪拜", tz: "Asia/Dubai" },
    { label: "伦敦", tz: "Europe/London" },
    { label: "柏林", tz: "Europe/Berlin" },
    { label: "纽约", tz: "America/New_York" },
    { label: "芝加哥", tz: "America/Chicago" },
    { label: "旧金山", tz: "America/Los_Angeles" },
    { label: "圣保罗", tz: "America/Sao_Paulo" },
    { label: "悉尼", tz: "Australia/Sydney" },
    { label: "奥克兰", tz: "Pacific/Auckland" },
    { label: "UTC", tz: "UTC" }
  ];

  var cities = [
    { id: uid(), label: "北京 / 上海", tz: "Asia/Shanghai" },
    { id: uid(), label: "纽约", tz: "America/New_York" },
    { id: uid(), label: "伦敦", tz: "Europe/London" }
  ];

  var els = {
    preset: document.getElementById("preset"),
    addPreset: document.getElementById("add-preset"),
    cityList: document.getElementById("city-list"),
    workStart: document.getElementById("work-start"),
    workEnd: document.getElementById("work-end"),
    refDate: document.getElementById("ref-date"),
    summary: document.getElementById("summary"),
    gridHead: document.querySelector("#grid thead"),
    gridBody: document.querySelector("#grid tbody"),
    slots: document.getElementById("slots")
  };

  function uid() {
    return Math.random().toString(36).slice(2, 10);
  }

  function todayISO() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
  }

  function fillPresets() {
    els.preset.innerHTML = "";
    PRESETS.forEach(function (p) {
      var opt = document.createElement("option");
      opt.value = p.tz;
      opt.textContent = p.label + " (" + p.tz + ")";
      opt.dataset.label = p.label;
      els.preset.appendChild(opt);
    });
  }

  function offsetLabel(tz, date) {
    try {
      var parts = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        timeZoneName: "shortOffset",
        hour: "2-digit"
      }).formatToParts(date);
      var name = parts.find(function (p) { return p.type === "timeZoneName"; });
      return name ? name.value : tz;
    } catch (e) {
      return tz;
    }
  }

  function localHourOnUtcHour(tz, utcDate) {
    var parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      hourCycle: "h23"
    }).formatToParts(utcDate);
    var h = parts.find(function (p) { return p.type === "hour"; });
    return h ? parseInt(h.value, 10) : 0;
  }

  function inWork(localHour, start, end) {
    if (start === end) return true;
    if (start < end) return localHour >= start && localHour < end;
    return localHour >= start || localHour < end;
  }

  function renderCities() {
    els.cityList.innerHTML = "";
    var ref = parseRefDate();
    cities.forEach(function (c) {
      var li = document.createElement("li");
      var meta = document.createElement("div");
      meta.className = "city-meta";
      var strong = document.createElement("strong");
      strong.textContent = c.label;
      var span = document.createElement("span");
      span.textContent = c.tz + " · " + offsetLabel(c.tz, ref);
      meta.appendChild(strong);
      meta.appendChild(span);
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn ghost";
      btn.textContent = "移除";
      btn.disabled = cities.length <= 2;
      btn.addEventListener("click", function () {
        if (cities.length <= 2) return;
        cities = cities.filter(function (x) { return x.id !== c.id; });
        render();
      });
      li.appendChild(meta);
      li.appendChild(btn);
      els.cityList.appendChild(li);
    });
  }

  function parseRefDate() {
    var v = els.refDate.value || todayISO();
    var parts = v.split("-").map(Number);
    return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12, 0, 0));
  }

  function utcDayWindow(refNoonUtc) {
    var y = refNoonUtc.getUTCFullYear();
    var m = refNoonUtc.getUTCMonth();
    var d = refNoonUtc.getUTCDate();
    var start = Date.UTC(y, m, d - 1, 0, 0, 0);
    var hours = [];
    for (var i = 0; i < 48; i++) {
      hours.push(new Date(start + i * 3600 * 1000));
    }
    return hours;
  }

  function compute() {
    var start = clampInt(els.workStart.value, 0, 23, 9);
    var end = clampInt(els.workEnd.value, 1, 24, 18);
    if (start === end) end = (start + 1) % 24;
    var ref = parseRefDate();
    var hours = utcDayWindow(ref);
    var rows = cities.map(function (c) {
      return {
        city: c,
        flags: hours.map(function (h) {
          var lh = localHourOnUtcHour(c.tz, h);
          return inWork(lh, start, end);
        })
      };
    });
    var overlap = hours.map(function (_, i) {
      return rows.every(function (r) { return r.flags[i]; });
    });
    return { hours: hours, rows: rows, overlap: overlap, start: start, end: end };
  }

  function clampInt(v, min, max, fallback) {
    var n = parseInt(v, 10);
    if (isNaN(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  function fmtUtcLabel(d) {
    return String(d.getUTCHours()).padStart(2, "0");
  }

  function fmtLocal(d, tz) {
    return new Intl.DateTimeFormat("zh-CN", {
      timeZone: tz,
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).format(d);
  }

  function renderGrid(data) {
    var head = document.createElement("tr");
    var th0 = document.createElement("th");
    th0.className = "city";
    th0.textContent = "城市 \\ UTC";
    head.appendChild(th0);
    data.hours.forEach(function (h) {
      var th = document.createElement("th");
      th.textContent = fmtUtcLabel(h);
      head.appendChild(th);
    });
    els.gridHead.innerHTML = "";
    els.gridHead.appendChild(head);

    els.gridBody.innerHTML = "";
    data.rows.forEach(function (row) {
      var tr = document.createElement("tr");
      var td0 = document.createElement("th");
      td0.className = "city";
      td0.scope = "row";
      td0.textContent = row.city.label;
      tr.appendChild(td0);
      row.flags.forEach(function (on, i) {
        var td = document.createElement("td");
        td.className = "cell " + (data.overlap[i] ? "overlap" : on ? "work" : "off");
        td.title = row.city.label + " " + fmtLocal(data.hours[i], row.city.tz);
        tr.appendChild(td);
      });
      els.gridBody.appendChild(tr);
    });
  }

  function mergeSlots(data) {
    var slots = [];
    var i = 0;
    while (i < data.overlap.length) {
      if (!data.overlap[i]) {
        i++;
        continue;
      }
      var j = i;
      while (j < data.overlap.length && data.overlap[j]) j++;
      slots.push({ from: data.hours[i], to: data.hours[j - 1], hours: j - i });
      i = j;
    }
    return slots;
  }

  function renderSlots(data) {
    var slots = mergeSlots(data);
    var n = slots.reduce(function (a, s) { return a + s.hours; }, 0);
    if (n === 0) {
      els.summary.innerHTML = "在参考日前后 48 小时 UTC 窗口内，<strong>没有</strong>全员同时处于工作时段的小时。可放宽工作时段或换城市。";
    } else {
      els.summary.innerHTML =
        "找到 <strong>" + n + "</strong> 个重叠小时（工作时段 " +
        String(data.start).padStart(2, "0") + ":00–" +
        String(data.end).padStart(2, "0") + ":00 本地）。下列为连续区间（按第一城本地时间）：";
    }
    els.slots.innerHTML = "";
    var anchorTz = cities[0].tz;
    slots.forEach(function (s) {
      var end = new Date(s.to.getTime() + 3600 * 1000);
      var pill = document.createElement("span");
      pill.className = "slot";
      pill.textContent =
        fmtLocal(s.from, anchorTz) + " → " + fmtLocal(end, anchorTz) +
        "（" + s.hours + "h · " + cities[0].label + "）";
      els.slots.appendChild(pill);
    });
  }

  function render() {
    renderCities();
    var data = compute();
    renderGrid(data);
    renderSlots(data);
  }

  els.addPreset.addEventListener("click", function () {
    var opt = els.preset.selectedOptions[0];
    if (!opt) return;
    var tz = opt.value;
    var label = opt.dataset.label || opt.textContent;
    var exists = cities.some(function (c) { return c.tz === tz; });
    if (exists) return;
    cities.push({ id: uid(), label: label, tz: tz });
    render();
  });

  ["change", "input"].forEach(function (ev) {
    els.workStart.addEventListener(ev, render);
    els.workEnd.addEventListener(ev, render);
    els.refDate.addEventListener(ev, render);
  });

  els.refDate.value = todayISO();
  fillPresets();
  render();
})();
