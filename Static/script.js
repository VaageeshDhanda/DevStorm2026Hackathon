(function () {
  const svgNS = "http://www.w3.org/2000/svg";

  // Level configuration data
  const FLOOR_CONFIGS = {
    L1: {
      title: "Zone A · Level 1 (Main Campus)",
      evSlots: ["A2", "B5"],
      handicapSlots: ["A4", "C2"],
      reservedSlots: ["D1"],
      initOccupied: ["A1", "A3", "B2", "C3"]
    },
    L2: {
      title: "Zone A · Level 2 (Executive Floor)",
      evSlots: ["B1", "B2"],
      handicapSlots: ["A1"],
      reservedSlots: ["C1", "C2", "C3", "C4"],
      initOccupied: ["A2", "C1", "D3", "D4"]
    },
    B1: {
      title: "Zone A · Basement 1 (EV Charging Hub)",
      evSlots: ["A1", "A2", "A3", "A4", "A5", "A6"],
      handicapSlots: ["B1"],
      reservedSlots: [],
      initOccupied: ["A1", "A4", "B3"]
    }
  };

  let currentFloor = "L1";

  const ROWS = [
    { key: "A", slotY: 76,  laneY: 58 },
    { key: "B", slotY: 246, laneY: 228 },
    { key: "C", slotY: 416, laneY: 398 },
    { key: "D", slotY: 586, laneY: 568 }
  ];
  const COL_X = [14, 148, 282, 510, 644, 778];
  const SLOT_W = 120;
  const SLOT_H = 128;
  const AISLE_X = 455;
  const ENTRANCE_POINT = { x: 455, y: 18 };
  
  const DIST = {
    A: [16, 12, 10, 10, 12, 16],
    B: [28, 24, 22, 22, 24, 28],
    C: [40, 36, 34, 34, 36, 40],
    D: [52, 48, 46, 46, 48, 52]
  };

  const TAG_CLASS = { route: "tag-route", occ: "tag-occ", free: "tag-free", ping: "tag-ping", alert: "tag-alert" };

  let slots = [];
  let selectedSlotForModal = null;
  let eventCount = 0;
  let trafficInterval = null;
  let animFrame = null;
  let routingBusy = false;
  let pendingTraffic = 0;

  const slotsLayer = document.getElementById("slotsLayer");
  const departuresLayer = document.getElementById("departuresLayer");
  const routePathEl = document.getElementById("routePath");
  const routeTrailEl = document.getElementById("routeTrail");
  const carIcon = document.getElementById("carIcon");
  const navBanner = document.getElementById("navBanner");
  const navText = document.getElementById("navText");
  const findBtn = document.getElementById("findBtn");
  const trafficBtn = document.getElementById("trafficBtn");
  const logFeed = document.getElementById("logFeed");
  const logCountEl = document.getElementById("logCount");
  const clockEl = document.getElementById("clock");
  const statFreeCard = document.getElementById("statFreeCard");
  const statOccupiedCard = document.getElementById("statOccupiedCard");
  const statRate = document.getElementById("statRate");
  const rateBarFill = document.getElementById("rateBarFill");

  // Modal Elements
  const vehicleModal = document.getElementById("vehicleModal");
  const modalCloseBtn = document.getElementById("modalCloseBtn");
  const modalPlate = document.getElementById("modalPlate");
  const modalSlotId = document.getElementById("modalSlotId");
  const modalType = document.getElementById("modalType");
  const modalDuration = document.getElementById("modalDuration");
  const modalTariff = document.getElementById("modalTariff");
  const modalVacateBtn = document.getElementById("modalVacateBtn");

  function initSlotData(floorKey) {
    const cfg = FLOOR_CONFIGS[floorKey];
    slots = [];
    ROWS.forEach(function (r) {
      COL_X.forEach(function (x, ci) {
        const id = r.key + (ci + 1);
        const isEv = cfg.evSlots.includes(id);
        const isHandicap = cfg.handicapSlots.includes(id);
        const isReserved = cfg.reservedSlots.includes(id);
        slots.push({
          id: id,
          rectX: x,
          rectY: r.slotY,
          laneY: r.laneY,
          col: ci,
          distance: DIST[r.key][ci],
          occupied: cfg.initOccupied.includes(id),
          type: isEv ? "ev" : isHandicap ? "handicap" : isReserved ? "reserved" : "standard",
          recommended: false,
          plate: "KA " + Math.floor(10 + Math.random() * 89) + " " + String.fromCharCode(65 + Math.floor(Math.random()*26)) + String.fromCharCode(65 + Math.floor(Math.random()*26)) + " " + Math.floor(1000 + Math.random() * 8999),
          el: null, rectEl: null, statusEl: null
        });
      });
    });
  }

  function buildLotSvg() {
    slotsLayer.innerHTML = "";
    slots.forEach(function (slot) {
      const g = document.createElementNS(svgNS, "g");
      g.classList.add("slot");
      if (slot.type !== "standard") g.classList.add("type-" + slot.type);
      g.setAttribute("tabindex", "0");
      g.dataset.id = slot.id;

      const rect = document.createElementNS(svgNS, "rect");
      rect.classList.add("slot-rect");
      rect.setAttribute("x", slot.rectX);
      rect.setAttribute("y", slot.rectY);
      rect.setAttribute("width", SLOT_W);
      rect.setAttribute("height", SLOT_H);
      rect.setAttribute("rx", 8);
      g.appendChild(rect);

      const idText = document.createElementNS(svgNS, "text");
      idText.classList.add("slot-id");
      idText.setAttribute("x", slot.rectX + SLOT_W / 2);
      idText.setAttribute("y", slot.rectY + 40);
      idText.setAttribute("text-anchor", "middle");
      idText.textContent = slot.id;
      g.appendChild(idText);

      // Category Icon/Badge
      if (slot.type !== "standard") {
        const typeBadge = document.createElementNS(svgNS, "text");
        typeBadge.classList.add("slot-type-badge");
        typeBadge.setAttribute("x", slot.rectX + SLOT_W / 2);
        typeBadge.setAttribute("y", slot.rectY + 58);
        typeBadge.setAttribute("text-anchor", "middle");
        typeBadge.textContent = slot.type === "ev" ? "⚡ EV" : slot.type === "handicap" ? "♿ ACC" : "🔒 RES";
        g.appendChild(typeBadge);
      }

      const statusText = document.createElementNS(svgNS, "text");
      statusText.classList.add("slot-status");
      statusText.setAttribute("x", slot.rectX + SLOT_W / 2);
      statusText.setAttribute("y", slot.rectY + (slot.type !== "standard" ? 74 : 64));
      statusText.setAttribute("text-anchor", "middle");
      g.appendChild(statusText);

      const distText = document.createElementNS(svgNS, "text");
      distText.classList.add("slot-dist");
      distText.setAttribute("x", slot.rectX + SLOT_W / 2);
      distText.setAttribute("y", slot.rectY + 94);
      distText.setAttribute("text-anchor", "middle");
      distText.textContent = slot.distance + "m away";
      g.appendChild(distText);

      g.addEventListener("click", function () { onSlotClick(slot); });
      slot.el = g;
      slot.rectEl = rect;
      slot.statusEl = statusText;
      slotsLayer.appendChild(g);
    });
  }

  function renderSlots() {
    slots.forEach(function (s) {
      const wasOccupied = s.el.classList.contains("occupied");
      s.el.classList.toggle("occupied", s.occupied);
      s.el.classList.toggle("available", !s.occupied);
      s.el.classList.toggle("recommended", s.recommended);
      s.statusEl.textContent = s.occupied ? "OCCUPIED" : s.recommended ? "RECOMMENDED" : "AVAILABLE";

      if (wasOccupied !== s.occupied) {
        s.el.classList.remove("just-changed");
        void s.el.offsetWidth;
        s.el.classList.add("just-changed");
      }
    });
    updateStats();
  }

  function updateStats() {
    const total = slots.length;
    const occupied = slots.filter(function (s) { return s.occupied; }).length;
    const free = total - occupied;
    const rate = Math.round((occupied / total) * 100);
    
    statFreeCard.textContent = free;
    statOccupiedCard.textContent = occupied;
    statRate.textContent = rate + "%";
    rateBarFill.style.width = rate + "%";
  }

  function onSlotClick(slot) {
    if (slot.occupied) {
      // Open ANPR Inspection Modal
      selectedSlotForModal = slot;
      modalSlotId.textContent = slot.id;
      modalPlate.textContent = slot.plate;
      modalType.textContent = slot.type === "ev" ? "EV Sedan" : "Standard Vehicle";
      modalDuration.textContent = Math.floor(15 + Math.random() * 80) + " mins";
      modalTariff.textContent = "$" + (3 + Math.random() * 5).toFixed(2);
      vehicleModal.classList.add("open");
    } else {
      // Occupy Slot
      slot.occupied = true;
      slot.recommended = false;
      renderSlots();
      logEvent(slot.id, "occ", "Manual toggle occupied", "Slot " + slot.id);
    }
  }

  modalCloseBtn.addEventListener("click", function() { vehicleModal.classList.remove("open"); });
  modalVacateBtn.addEventListener("click", function() {
    if (selectedSlotForModal) {
      const vacatedId = selectedSlotForModal.id;
      selectedSlotForModal.occupied = false;
      renderSlots();
      runDepartureAnimation(selectedSlotForModal);
      updateNav("Vehicle exiting bay " + vacatedId, false);
      logEvent(vacatedId, "free", "Vehicle departed bay", "Bay " + vacatedId + " released — car exiting to gate");
      vehicleModal.classList.remove("open");
    }
  });

  // Floor Switching Logic
  document.getElementById("floorSwitcher").addEventListener("click", function(e) {
    if (e.target.classList.contains("floor-btn")) {
      document.querySelectorAll(".floor-btn").forEach(b => b.classList.remove("active"));
      e.target.classList.add("active");
      currentFloor = e.target.dataset.floor;
      document.getElementById("mapTitle").textContent = FLOOR_CONFIGS[currentFloor].title;
      initSlotData(currentFloor);
      buildLotSvg();
      renderSlots();
      logEvent("SYS", "ping", "Switched floor view", "Active level: " + currentFloor);
    }
  });

  function computePath(slot) {
    const targetX = slot.rectX + SLOT_W / 2;
    const targetY = slot.rectY + SLOT_H / 2;
    return (
      "M " + ENTRANCE_POINT.x + " " + ENTRANCE_POINT.y +
      " L " + AISLE_X + " " + slot.laneY +
      " L " + targetX + " " + slot.laneY +
      " L " + targetX + " " + targetY
    );
  }

  function computeExitPath(slot) {
    const startX = slot.rectX + SLOT_W / 2;
    const startY = slot.rectY + SLOT_H / 2;
    return (
      "M " + startX + " " + startY +
      " L " + startX + " " + slot.laneY +
      " L " + AISLE_X + " " + slot.laneY +
      " L " + AISLE_X + " " + ENTRANCE_POINT.y
    );
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function createDepartCar() {
    const g = document.createElementNS(svgNS, "g");
    g.classList.add("depart-car");
    g.setAttribute("opacity", "1");

    const body = document.createElementNS(svgNS, "rect");
    body.classList.add("car-body");
    body.setAttribute("x", "-14");
    body.setAttribute("y", "-6");
    body.setAttribute("width", "28");
    body.setAttribute("height", "12");
    body.setAttribute("rx", "3.5");
    g.appendChild(body);

    const glass = document.createElementNS(svgNS, "rect");
    glass.classList.add("car-glass");
    glass.setAttribute("x", "-7");
    glass.setAttribute("y", "-5.5");
    glass.setAttribute("width", "11");
    glass.setAttribute("height", "5");
    glass.setAttribute("rx", "1.2");
    g.appendChild(glass);

    ["-10", "5"].forEach(function (wx) {
      ["-7.5", "5"].forEach(function (wy) {
        const wheel = document.createElementNS(svgNS, "rect");
        wheel.classList.add("car-wheel");
        wheel.setAttribute("x", wx);
        wheel.setAttribute("y", wy);
        wheel.setAttribute("width", "5");
        wheel.setAttribute("height", "2.5");
        wheel.setAttribute("rx", "0.8");
        g.appendChild(wheel);
      });
    });
    return g;
  }

  function clearRouteVisual() {
    routePathEl.setAttribute("d", "");
    routeTrailEl.setAttribute("d", "");
    routePathEl.style.strokeDasharray = "";
    routePathEl.style.strokeDashoffset = "";
    routeTrailEl.style.strokeDasharray = "";
    routeTrailEl.style.strokeDashoffset = "";
  }

  function runDepartureAnimation(slot) {
    if (!slot) return;

    const pathD = computeExitPath(slot);
    const trail = document.createElementNS(svgNS, "path");
    trail.classList.add("depart-trail");
    trail.setAttribute("d", pathD);
    trail.setAttribute("fill", "none");

    const path = document.createElementNS(svgNS, "path");
    path.classList.add("depart-path");
    path.setAttribute("d", pathD);
    path.setAttribute("fill", "none");

    const car = createDepartCar();

    departuresLayer.appendChild(trail);
    departuresLayer.appendChild(path);
    departuresLayer.appendChild(car);

    const length = path.getTotalLength();
    if (!length || length < 1) {
      trail.remove(); path.remove(); car.remove();
      return;
    }

    path.style.strokeDasharray = length + " " + length;
    path.style.strokeDashoffset = String(length);
    trail.style.strokeDasharray = length + " " + length;
    trail.style.strokeDashoffset = String(length);

    const duration = 1100 + slot.distance * 12;
    const start = performance.now();

    function frame(now) {
      const t = Math.min((now - start) / duration, 1);
      const eased = easeInOutCubic(t);
      const dist = Math.min(eased * length, length);

      path.style.strokeDashoffset = String(length - dist);
      const trailDist = Math.max(0, dist - length * 0.12);
      trail.style.strokeDashoffset = String(length - trailDist);

      const p = path.getPointAtLength(dist);
      const lookAhead = Math.min(dist + 6, length);
      const p2 = path.getPointAtLength(lookAhead);
      let angle = 0;
      if (lookAhead > dist) {
        angle = (Math.atan2(p2.y - p.y, p2.x - p.x) * 180) / Math.PI;
      }
      car.setAttribute("transform", "translate(" + p.x + "," + p.y + ") rotate(" + angle + ")");

      if (t > 0.75) {
        const fade = 1 - (t - 0.75) / 0.25;
        car.setAttribute("opacity", String(fade));
        path.style.opacity = String(0.9 * fade);
        trail.style.opacity = String(0.28 * fade);
      }

      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        trail.remove();
        path.remove();
        car.remove();
      }
    }
    requestAnimationFrame(frame);
  }

  function runVehicleAnimation(target) {
    if (animFrame) {
      cancelAnimationFrame(animFrame);
      animFrame = null;
    }
    routingBusy = true;

    const path = computePath(target);
    routePathEl.setAttribute("d", path);
    routeTrailEl.setAttribute("d", path);

    const length = routePathEl.getTotalLength();
    if (!length || length < 1) {
      routingBusy = false;
      return;
    }

    routePathEl.style.strokeDasharray = length + " " + length;
    routePathEl.style.strokeDashoffset = String(length);
    routeTrailEl.style.strokeDasharray = length + " " + length;
    routeTrailEl.style.strokeDashoffset = String(length);
    carIcon.style.opacity = "1";
    carIcon.classList.remove("depart-car");

    const duration = 1500 + target.distance * 18;
    const start = performance.now();

    function frame(now) {
      const t = Math.min((now - start) / duration, 1);
      const eased = easeInOutCubic(t);
      const dist = Math.min(eased * length, length);

      routePathEl.style.strokeDashoffset = String(length - dist);
      const trailDist = Math.max(0, dist - length * 0.1);
      routeTrailEl.style.strokeDashoffset = String(length - trailDist);

      const p = routePathEl.getPointAtLength(dist);
      const lookAhead = Math.min(dist + 6, length);
      const p2 = routePathEl.getPointAtLength(lookAhead);
      let angle = 0;
      if (lookAhead > dist) {
        angle = (Math.atan2(p2.y - p.y, p2.x - p.x) * 180) / Math.PI;
      }
      carIcon.setAttribute("transform", "translate(" + p.x + "," + p.y + ") rotate(" + angle + ")");

      if (t < 1) {
        animFrame = requestAnimationFrame(frame);
      } else {
        animFrame = null;
        target.occupied = true;
        target.recommended = false;
        renderSlots();
        updateNav("Arrived at " + target.id + " — slot marked occupied.", false);
        logEvent(target.id, "route", "Vehicle arrived & parked", "Bay " + target.id + " secured");
        routingBusy = false;
        carIcon.style.opacity = "0.35";
        setTimeout(function () {
          if (!routingBusy) {
            carIcon.style.opacity = "0";
            clearRouteVisual();
          }
        }, 700);
      }
    }
    animFrame = requestAnimationFrame(frame);
  }

  let lastFullAlertAt = 0;

  function findNearest() {
    if (routingBusy) {
      logEvent("SYS", "ping", "Guidance already active", "Wait for current vehicle to park");
      return;
    }
    const free = slots.filter(function (s) { return !s.occupied; }).sort(function (a, b) { return a.distance - b.distance; });
    if (!free.length) {
      updateNav("Lot full — no free bays available. Please wait or try another level.", true);
      const now = Date.now();
      if (now - lastFullAlertAt > 8000) {
        lastFullAlertAt = now;
        logEvent("FULL", "alert", "Lot capacity reached", "No free slots — vehicle denied entry");
      }
      return;
    }
    const target = free[0];
    slots.forEach(function (s) { s.recommended = s.id === target.id; });
    renderSlots();
    updateNav("Proceed to " + target.id + " · " + target.distance + " m — follow the access lane.", false);
    logEvent(target.id, "route", "Route calculated to " + target.id, target.distance + " m from entry");
    runVehicleAnimation(target);
  }

  function updateNav(txt, alert) {
    navText.textContent = txt;
    navBanner.classList.toggle("alert", !!alert);
    navBanner.classList.toggle("active", !alert && txt.indexOf("Proceed") === 0);
  }

  function logEvent(slotId, type, message, detail) {
    eventCount++;
    const time = new Date().toTimeString().slice(0, 8);
    const entry = document.createElement("div");
    entry.className = "log-entry type-" + type;
    entry.innerHTML = `<span class="log-time">${time}</span><span class="log-tag ${TAG_CLASS[type]}">${slotId}</span><span class="log-msg">${message}<span class="log-detail">${detail||''}</span></span>`;
    logFeed.prepend(entry);
    logCountEl.textContent = eventCount + " events";
  }

  function simulateRandomDeparture() {
    if (routingBusy) return;
    const occupied = slots.filter(function (s) { return s.occupied; });
    if (!occupied.length) return;
    const slot = occupied[Math.floor(Math.random() * occupied.length)];
    slot.occupied = false;
    slot.recommended = false;
    renderSlots();
    runDepartureAnimation(slot);
    updateNav("Vehicle exiting bay " + slot.id, false);
    logEvent(slot.id, "free", "Vehicle departed bay", "Bay " + slot.id + " released — car exiting to gate");
  }

  function toggleTraffic() {
    if (trafficInterval) {
      clearInterval(trafficInterval);
      trafficInterval = null;
      trafficBtn.classList.remove("active");
      trafficBtn.innerHTML =
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 17h14v-3l-2-4H7l-2 4v3z"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/><path d="M7 10V7h10v3"/></svg> Start Traffic Simulation';
      logEvent("SYS", "ping", "Traffic simulation stopped", "Arrivals & departures paused");
    } else {
      trafficBtn.classList.add("active");
      trafficBtn.innerHTML =
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 17h14v-3l-2-4H7l-2 4v3z"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/><path d="M7 10V7h10v3"/></svg> Stop Traffic Simulation';
      logEvent("SYS", "ping", "Traffic simulation started", "Live arrivals & departures active");
      trafficInterval = setInterval(function () {
        if (routingBusy) return;
        const occupied = slots.filter(function (s) { return s.occupied; }).length;
        const free = slots.length - occupied;
        // Bias: more departures when nearly full, more arrivals when empty
        const departChance = occupied === 0 ? 0 : (free === 0 ? 0.85 : 0.35 + (occupied / slots.length) * 0.35);
        if (Math.random() < departChance) {
          simulateRandomDeparture();
        } else if (free > 0) {
          findNearest();
        } else {
          simulateRandomDeparture();
        }
      }, 2800);
    }
  }

  window.simulateRefresh = function() {
    initSlotData(currentFloor);
    buildLotSvg();
    renderSlots();
    logEvent("SYS", "ping", "Sensors re-indexed", "Floor: " + currentFloor);
  };

  function applyTheme(theme) {
    if (theme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    try { localStorage.setItem("smartpark-theme", theme); } catch (e) {}
  }

  function initTheme() {
    let theme = "light";
    try {
      const saved = localStorage.getItem("smartpark-theme");
      if (saved === "dark" || saved === "light") theme = saved;
      else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) theme = "dark";
    } catch (e) {}
    applyTheme(theme);
  }

  function toggleTheme() {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    applyTheme(isDark ? "light" : "dark");
  }

  function init() {
    initTheme();
    initSlotData("L1");
    buildLotSvg();
    renderSlots();
    findBtn.addEventListener("click", findNearest);
    trafficBtn.addEventListener("click", toggleTraffic);
    const themeBtn = document.getElementById("themeToggle");
    if (themeBtn) themeBtn.addEventListener("click", toggleTheme);
    setInterval(() => { clockEl.textContent = new Date().toTimeString().slice(0, 8); }, 1000);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
