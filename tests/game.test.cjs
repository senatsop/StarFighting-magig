const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1].replace(/\r\n/g, "\n");
assert.ok(script, "index.html should contain the game script");
const initialization = "      resize();\n      titleScreen();\n      requestAnimationFrame(frame);";
assert.ok(script.includes(initialization), "game initialization should be present");
const instrumentedScript = script.replace(initialization, `      window.__gameTest = {
        get player() { return player; },
        get enemies() { return enemies; },
        get bullets() { return bullets; },
        get enemyBullets() { return enemyBullets; },
        get pickups() { return pickups; },
        get novaWave() { return novaWave; },
        get score() { return score; },
        get combo() { return combo; },
        awardKill,
        setNovaCharge(value) { player.nova = value; updateHud(); },
        novaBlast
      };
${initialization}`);

class Element {
  constructor(id = "") {
    this.id = id;
    this.listeners = new Map();
    this.style = {};
    this.attributes = {};
    this.classes = new Set();
    this.classList = {
      add: value => this.classes.add(value),
      remove: value => this.classes.delete(value),
      contains: value => this.classes.has(value),
      toggle: (value, force) => {
        const shouldAdd = force === undefined ? !this.classes.has(value) : force;
        if (shouldAdd) this.classes.add(value);
        else this.classes.delete(value);
        return shouldAdd;
      }
    };
    this.textContent = "";
    this.innerHTML = "";
  }

  addEventListener(type, handler) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(handler);
    this.listeners.set(type, listeners);
  }

  dispatch(type, event = {}) {
    for (const handler of this.listeners.get(type) || []) {
      handler({ preventDefault() {}, ...event, type, target: this });
    }
  }

  setAttribute(name, value) { this.attributes[name] = value; }
  focus() {}
  setPointerCapture() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: 112, height: 112 }; }

  querySelector(selector) {
    if (selector.startsWith("#")) return this.children.get(selector.slice(1)) || null;
    return null;
  }

  querySelectorAll(selector) {
    return selector === ".upgrade" ? this.upgrades || [] : [];
  }

  set innerHTML(value) {
    this._innerHTML = value;
    this.children = new Map();
    this.upgrades = [];
    for (const match of value.matchAll(/id="([^"]+)"/g)) {
      this.children.set(match[1], new Element(match[1]));
    }
    for (const match of value.matchAll(/data-upgrade="(\d+)"/g)) {
      this.upgrades.push(new Element(`upgrade-${match[1]}`));
    }
  }

  get innerHTML() { return this._innerHTML; }
}

function createGame() {
  const ids = [
    "canvas", "game", "overlay", "panel", "score", "time", "health-label",
    "health-fill", "xp-fill", "level-badge", "sound-button", "pause-button",
    "dash-button", "joystick", "stick", "nova-button", "nova-fill", "boss-banner", "boss-fill",
    "combo-label", "buff-label"
  ];
  const elements = new Map(ids.map(id => [id, new Element(id)]));
  const canvas = elements.get("canvas");
  canvas.getContext = () => new Proxy({
    createRadialGradient: () => ({ addColorStop() {} })
  }, {
    get(target, key) {
      if (key in target) return target[key];
      return () => {};
    },
    set(target, key, value) { target[key] = value; return true; }
  });
  const document = {
    hidden: false,
    querySelector(selector) {
      const id = selector.replace(/^#/, "");
      return elements.get(id) || elements.get("panel").querySelector(selector);
    },
    addEventListener(type, handler) {
      const listeners = this.listeners.get(type) || [];
      listeners.push(handler);
      this.listeners.set(type, listeners);
    },
    listeners: new Map(),
    dispatch(type) {
      for (const handler of this.listeners.get(type) || []) handler();
    }
  };
  const windowListeners = new Map();
  const frameCallbacks = [];
  const storage = new Map();
  let timestamp = 0;
  const window = {
    innerWidth: 800,
    innerHeight: 600,
    devicePixelRatio: 1,
    addEventListener(type, handler) {
      const listeners = windowListeners.get(type) || [];
      listeners.push(handler);
      windowListeners.set(type, listeners);
    }
  };
  const context = {
    document,
    window,
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value)
    },
    requestAnimationFrame: callback => frameCallbacks.push(callback),
    setTimeout: () => 0,
    performance: { now: () => 0 },
    Math,
    console
  };
  vm.runInNewContext(instrumentedScript, context, { filename: "index.html" });

  return {
    document, elements, frameCallbacks, storage, window, windowListeners,
    click(id) {
      const button = document.querySelector(`#${id}`);
      assert.ok(button, `expected #${id} to exist`);
      button.dispatch("click");
    },
    key(key) {
      for (const handler of windowListeners.get("keydown") || []) {
        handler({ key, repeat: false, preventDefault() {} });
      }
    },
    tick(count, step = 40) {
      for (let i = 0; i < count; i++) {
        const callback = frameCallbacks.shift();
        assert.ok(callback, "game should schedule its next animation frame");
        timestamp += step;
        callback(timestamp);
      }
    }
  };
}

test("renders a launch screen and starts a fresh run", () => {
  const game = createGame();
  assert.match(game.elements.get("panel").innerHTML, /Launch run/);

  game.click("start-button");
  assert.equal(game.elements.get("game").classList.contains("active"), true);
  assert.equal(game.elements.get("overlay").classList.contains("hidden"), true);
  assert.equal(game.elements.get("overlay").attributes["aria-hidden"], "true");
  assert.equal(game.elements.get("score").textContent, "000000");
});

test("automatically fires at enemies during a run", () => {
  const game = createGame();
  game.click("start-button");

  game.tick(30);

  assert.ok(game.window.__gameTest.enemies.length > 0, "an enemy should spawn");
  assert.ok(game.window.__gameTest.bullets.length > 0, "the auto-fire weapon should launch bullets");
});

test("pauses and resumes without advancing the run while paused", () => {
  const game = createGame();
  game.click("start-button");
  game.tick(5);
  const timeAtPause = game.elements.get("time").textContent;

  game.key("p");
  assert.match(game.elements.get("panel").innerHTML, /PAUSED/);
  assert.equal(game.elements.get("overlay").attributes["aria-hidden"], "false");
  game.tick(10);
  assert.equal(game.elements.get("time").textContent, timeAtPause);

  game.click("resume-button");
  assert.equal(game.elements.get("overlay").classList.contains("hidden"), true);
});

test("pauses when the page becomes hidden", () => {
  const game = createGame();
  game.click("start-button");
  game.document.hidden = true;
  game.document.dispatch("visibilitychange");
  assert.match(game.elements.get("panel").innerHTML, /PAUSED/);
});

test("Nova clears incoming shots and destroys swarm enemies when charged", () => {
  const game = createGame();
  game.click("start-button");
  const combat = game.window.__gameTest;
  combat.setNovaCharge(100);
  combat.enemies.push({ x: 20, y: 30, hp: 2, points: 50, type: "drone", color: "#a18aff" });
  combat.enemyBullets.push({ x: 10, y: 10, vx: 0, vy: 0, r: 4, life: 1 });
  assert.equal(game.elements.get("nova-button").disabled, false);

  combat.novaBlast();

  assert.equal(combat.player.nova, 14, "destroyed enemies recharge Nova");
  assert.equal(combat.enemyBullets.length, 0);
  assert.equal(combat.enemies.length, 0);
  assert.ok(combat.player.invuln > 0);
  assert.ok(combat.novaWave);
  assert.equal(game.elements.get("nova-button").disabled, true);
});

test("kill streaks increase score and expire after a break in combat", () => {
  const game = createGame();
  game.click("start-button");
  const combat = game.window.__gameTest;
  const target = { x: 40, y: 40, points: 50, type: "drone" };
  combat.awardKill(target);
  combat.awardKill(target);
  combat.awardKill(target);

  assert.equal(combat.combo, 3);
  assert.equal(combat.score, 200);
  game.tick(1);
  assert.match(game.elements.get("combo-label").textContent, /3× STREAK/);

  for (let frame = 0; frame < 80; frame++) {
    combat.enemies.length = 0;
    combat.bullets.length = 0;
    game.tick(1);
  }
  assert.equal(combat.combo, 0);
});

test("salvage pickups heal the ship when collected", () => {
  const game = createGame();
  game.click("start-button");
  const combat = game.window.__gameTest;
  combat.player.hp = 50;
  combat.pickups.push({ x: combat.player.x, y: combat.player.y, r: 9, type: "repair", life: 15, phase: 0, vx: 0, vy: 0 });

  game.tick(1);

  assert.equal(combat.player.hp, 80);
  assert.equal(combat.pickups.length, 0);
});

test("elite kills drop salvage and shields reduce incoming damage", () => {
  const game = createGame();
  game.click("start-button");
  const combat = game.window.__gameTest;
  combat.awardKill({ x: combat.player.x, y: combat.player.y, points: 100, type: "tank", elite: true });

  assert.equal(combat.pickups.length, 1, "elite enemies should always leave a salvage pickup");
  combat.pickups[0].type = "shield";
  game.tick(1);
  assert.ok(combat.player.shield > 0, "collecting shield salvage should grant a timed shield");
  assert.match(game.elements.get("buff-label").textContent, /AEGIS/);
});

test("a stationary run advances and continues through upgrade selections", () => {
  const game = createGame();
  game.click("start-button");
  for (let frames = 0; frames < 500; frames++) {
    if (/CHOOSE/.test(game.elements.get("panel").innerHTML)) {
      const upgrade = game.elements.get("panel").querySelectorAll(".upgrade")[0];
      assert.ok(upgrade, "a level-up should offer an upgrade");
      upgrade.dispatch("click");
    }
    game.tick(1);
  }
  assert.notEqual(game.elements.get("time").textContent, "00:00");
  assert.equal(game.elements.get("game").classList.contains("active"), true);
});
