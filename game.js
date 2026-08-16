const elements = {
  player: document.getElementById("player"),
  patron: document.getElementById("patron"),
  shop: document.getElementById("shop"),
  stage: document.getElementById("stage"),
  dialogue: document.getElementById("dialogue"),
  suspicionFlash: document.getElementById("suspicionFlash"),
  patronAlert: document.getElementById("patronAlert"),
  cornerOverlay: document.getElementById("cornerOverlay"),
  cornerStage: document.getElementById("cornerStage"),
  cornerText: document.getElementById("cornerText"),
  staminaBar: document.getElementById("staminaBar"),
  distanceBar: document.getElementById("distanceBar"),
  phaseLabel: document.getElementById("phaseLabel"),
  hintLabel: document.getElementById("hintLabel"),
  overlay: document.getElementById("overlay"),
  overlayTitle: document.getElementById("overlayTitle"),
  overlayText: document.getElementById("overlayText"),
  startButton: document.getElementById("startButton"),
  advanceButton: document.getElementById("advanceButton"),
  poseButton: document.getElementById("poseButton"),
  bossOverlay: document.getElementById("bossOverlay"),
  bossPrompt: document.getElementById("bossPrompt"),
  timingCursor: document.getElementById("timingCursor"),
  tailingBgm: document.getElementById("tailingBgm"),
  entryBgm: document.getElementById("entryBgm")
};

const input = {
  advanceHeld: false,
  poseHeld: false,
  advancePresses: 0,
  posePressedThisFrame: false
};

const state = {
  phase: "intro",
  result: null,
  playerX: 36,
  patronX: 56,
  distanceToShop: 100,
  maxDistanceToShop: 100,
  stamina: 100,
  messageTimer: 0,
  patronBehavior: null,
  pendingBehavior: null,
  queuedLookDuration: 0,
  patronBehaviorTimer: 0,
  patronLookbackTimer: 0,
  doubleLookStage: 0,
  stageLevel: 0,
  cornerTransitionTimer: 0,
  bgmPhase: "none",
  lostSightTimer: 0,
  dashMeter: 0,
  dashTimer: 0,
  poseCursor: 0,
  poseDirection: 1,
  poseWindowOpen: false,
  showSuspicion: false,
  worldOffset: 0,
  lastTimestamp: 0
};

const config = {
  playerAdvanceSpeed: 17,
  patronWalkSpeed: 10,
  patronStopChance: 0.22,
  patronLookChance: 0.45,
  patronFeintChance: 0.16,
  patronDoubleLookChance: 0.17,
  lookbackCueTime: 0.45,
  staminaDrain: 12,
  staminaRecover: 26,
  minGap: 10,
  maxGap: 34,
  loseSightGap: 36,
  loopResetThreshold: 84,
  loopResetOffset: 52,
  shopRevealDistance: 15,
  cornerTransitionDuration: 1.3,
  dashTarget: 100,
  dashDecay: 16,
  poseSweetspotMin: 45,
  poseSweetspotMax: 57,
  poseCursorSpeed: 74
};

function resetGame() {
  state.phase = "tailing";
  state.result = null;
  state.playerX = 34;
  state.patronX = 58;
  state.distanceToShop = state.maxDistanceToShop;
  state.stamina = 100;
  state.messageTimer = 0;
  state.patronBehavior = "walk";
  state.pendingBehavior = null;
  state.queuedLookDuration = 0;
  state.patronBehaviorTimer = 1.2;
  state.patronLookbackTimer = 0;
  state.doubleLookStage = 0;
  state.stageLevel = 0;
  state.cornerTransitionTimer = 0;
  state.bgmPhase = "none";
  state.lostSightTimer = 0;
  state.dashMeter = 0;
  state.dashTimer = 0;
  state.poseCursor = 0;
  state.poseDirection = 1;
  state.poseWindowOpen = false;
  state.showSuspicion = false;
  state.worldOffset = 0;
  input.advanceHeld = false;
  input.poseHeld = false;
  input.advancePresses = 0;
  input.posePressedThisFrame = false;
  elements.shop.classList.add("hidden");
  elements.overlay.classList.add("hidden");
  elements.bossOverlay.classList.add("hidden");
  elements.cornerOverlay.classList.add("hidden");
  setDialogue("常連の歩幅に合わせ、振り返りだけを潰せ。");
  syncBgmTrack();
  updateHud();
  render();
}

function pauseBgm(audio) {
  if (!audio) {
    return;
  }

  audio.pause();
  audio.currentTime = 0;
}

function playBgm(audio, volume = 0.6) {
  if (!audio) {
    return;
  }

  audio.volume = volume;
  const playPromise = audio.play();
  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch(() => {
      // Ignore autoplay blocking. Playback will retry on next user interaction.
    });
  }
}

function getBgmPhaseKey() {
  if (state.phase === "tailing") {
    return "tailing";
  }

  if (state.phase === "dash" || state.phase === "pose") {
    return "entry";
  }

  return "none";
}

function syncBgmTrack() {
  const nextPhase = getBgmPhaseKey();
  if (nextPhase === state.bgmPhase) {
    return;
  }

  state.bgmPhase = nextPhase;

  if (nextPhase === "tailing") {
    pauseBgm(elements.entryBgm);
    playBgm(elements.tailingBgm, 0.55);
    return;
  }

  if (nextPhase === "entry") {
    pauseBgm(elements.tailingBgm);
    playBgm(elements.entryBgm, 0.62);
    return;
  }

  pauseBgm(elements.tailingBgm);
  pauseBgm(elements.entryBgm);
}

function setDialogue(text, seconds = 1.2) {
  elements.dialogue.textContent = text;
  state.messageTimer = seconds;
}

function getDefaultDialogue() {
  if (state.phase === "tailing") {
    return "常連の歩幅に合わせ、振り返りだけを潰せ。";
  }

  if (state.phase === "dash") {
    return "常連が消えた直後を逃さず、暖簾まで一気に詰める。";
  }

  if (state.phase === "pose") {
    return "大将の視線が通る一点に、平然とした顔を差し込む。";
  }

  return "常連の背後に自然に張り付け。";
}

function setResult(title, text) {
  state.phase = "result";
  elements.overlayTitle.textContent = title;
  elements.overlayText.textContent = text;
  elements.startButton.textContent = "もう一度挑戦";
  elements.overlay.classList.remove("hidden");
  elements.overlay.classList.add("visible");
}

function lose(reason) {
  state.result = "lose";
  state.showSuspicion = true;

  if (reason === "caught") {
    setResult("女将に塩を撒かれた", "振り返りに無防備だった。ごまかしを維持して切り抜けよう。");
  } else if (reason === "stamina") {
    setResult("ポーズが崩れた", "ごまかしゲージが尽きた。押しっぱなしに頼りすぎている。");
  } else if (reason === "lost") {
    setResult("見失った", "常連との距離が開きすぎた。少しずつ詰め続ける必要がある。");
  } else if (reason === "dash") {
    setResult("暖簾前で失速", "常連が消えた直後は A を素早く連打する必要がある。");
  } else {
    setResult("キメ切れなかった", "大将の視線に合わせて、甘い判定帯で B を押そう。");
  }
}

function win() {
  state.result = "win";
  setResult("お連れ様でしたか、どうぞ", "暖簾の向こう側へ潜り込んだ。完璧な常連シャドウイングだ。");
}

function chooseBehavior() {
  const difficulty = getDifficultyProfile();
  const roll = Math.random();

  if (roll < difficulty.stopChance) {
    state.patronBehavior = "stop";
    state.patronBehaviorTimer = 0.8 + Math.random() * 0.7;
    setDialogue("立ち止まった。詰めすぎるな。", 0.9);
    return;
  }

  if (roll < difficulty.stopChance + difficulty.lookChance) {
    state.pendingBehavior = "lookback";
    state.queuedLookDuration = 0.9 + Math.random() * 0.6;
    state.patronBehavior = "lookbackCue";
    state.patronBehaviorTimer = difficulty.lookbackCueTime;
    setDialogue("？ 振り返りそうだ。ごまかしの準備をしろ。", 0.8);
    return;
  }

  if (roll < difficulty.stopChance + difficulty.lookChance + difficulty.feintChance) {
    state.patronBehavior = "feint";
    state.patronBehaviorTimer = 0.65;
    setDialogue("フェイントだ。早押しで B を固定しない。", 1.0);
    return;
  }

  if (roll < difficulty.stopChance + difficulty.lookChance + difficulty.feintChance + difficulty.doubleLookChance) {
    state.pendingBehavior = "doublelook";
    state.patronBehavior = "doublelookCue";
    state.patronBehaviorTimer = difficulty.lookbackCueTime;
    state.queuedLookDuration = 1.55;
    state.doubleLookStage = 1;
    setDialogue("？ 二度見の気配がある。少し構えろ。", 0.85);
    return;
  }

  state.patronBehavior = "walk";
  state.patronBehaviorTimer = 0.9 + Math.random() * 1.4;
}

function updateTailing(dt) {
  const difficulty = getDifficultyProfile();
  const patronSpeed = getPatronSpeed(difficulty);

  if (input.poseHeld) {
    state.stamina -= difficulty.staminaDrain * dt;
    if (state.stamina <= 0) {
      state.stamina = 0;
      lose("stamina");
      return;
    }
  } else {
    state.stamina = Math.min(100, state.stamina + difficulty.staminaRecover * dt);
  }

  if (input.advanceHeld && !input.poseHeld) {
    state.playerX += difficulty.playerAdvanceSpeed * dt;
    state.worldOffset += difficulty.playerAdvanceSpeed * dt * 0.2;
  } else {
    state.playerX -= 3.5 * dt;
  }

  state.playerX = clamp(state.playerX, 8, 78);
  state.patronX += patronSpeed * dt;

  if (state.distanceToShop > config.shopRevealDistance && state.patronX >= config.loopResetThreshold) {
    startCornerTransition();
    return;
  }

  state.patronX = clamp(state.patronX, 32, 84);

  const gap = state.patronX - state.playerX;
  if (gap > config.loseSightGap) {
    state.lostSightTimer += dt;
    if (state.lostSightTimer >= 0.45) {
      lose("lost");
      return;
    }
  } else {
    state.lostSightTimer = 0;
  }

  if (gap < config.minGap) {
    state.playerX = state.patronX - config.minGap;
  }

  updatePatronBehavior(dt);

  state.distanceToShop = Math.max(0, state.distanceToShop - patronSpeed * dt * 0.82);
  if (state.distanceToShop <= config.shopRevealDistance) {
    elements.shop.classList.remove("hidden");
  }

  if (state.distanceToShop <= 0) {
    startDashPhase();
  }
}

function startCornerTransition() {
  state.cornerTransitionTimer = config.cornerTransitionDuration;
  state.stageLevel += 1;
  input.advanceHeld = false;
  input.poseHeld = false;
  state.showSuspicion = false;

  wrapStageLoop();

  elements.cornerStage.textContent = `第 ${state.stageLevel + 1} の通り`;
  elements.cornerText.textContent = getCornerText();
  setDialogue("角を曲がった。空気が張り詰める。", config.cornerTransitionDuration);
}

function wrapStageLoop() {
  state.patronX -= config.loopResetOffset;
  state.playerX -= config.loopResetOffset;

  if (state.playerX < 8) {
    const correction = 8 - state.playerX;
    state.playerX = 8;
    state.patronX += correction;
  }

  if (state.patronX - state.playerX < config.minGap) {
    state.playerX = state.patronX - config.minGap;
  }
}

function getPatronSpeed(difficulty = getDifficultyProfile()) {
  if (state.patronBehavior === "stop") {
    return 0;
  }

  if (state.patronBehavior === "lookbackCue" || state.patronBehavior === "doublelookCue") {
    return 4;
  }

  if (state.patronBehavior === "lookback" || state.patronBehavior === "doublelook") {
    return 2;
  }

  if (state.patronBehavior === "feint") {
    return state.patronBehaviorTimer > 0.28 ? 0 : difficulty.patronWalkSpeed * 1.05;
  }

  return difficulty.patronWalkSpeed;
}

function getDifficultyProfile() {
  const level = Math.min(state.stageLevel, 5);

  return {
    playerAdvanceSpeed: config.playerAdvanceSpeed + level * 0.35,
    patronWalkSpeed: 7.8 + level * 0.85,
    stopChance: Math.max(0.18, 0.36 - level * 0.04),
    lookChance: Math.min(0.42, 0.18 + level * 0.05),
    feintChance: Math.min(0.16, 0.08 + level * 0.015),
    doubleLookChance: Math.min(0.18, 0.03 + level * 0.035),
    lookbackCueTime: Math.max(0.34, 0.72 - level * 0.08),
    staminaDrain: Math.min(16, 8 + level * 1.2),
    staminaRecover: Math.max(18, 32 - level * 2.2)
  };
}

function getCornerText() {
  const texts = [
    "まだ通りは広い。焦らず距離感だけ守れ。",
    "人通りが減った。視線の鋭さが少し増す。",
    "提灯の先は静かだ。振り返りが読みにくくなる。",
    "店の気配が濃い。常連の勘がかなり冴えてくる。",
    "暖簾は近い。最後まで一瞬も崩すな。"
  ];

  return texts[Math.min(state.stageLevel, texts.length - 1)];
}

function updateCornerTransition(dt) {
  state.cornerTransitionTimer = Math.max(0, state.cornerTransitionTimer - dt);
}

function updatePatronBehavior(dt) {
  state.patronBehaviorTimer -= dt;

  if (state.patronBehavior === "lookbackCue" && state.patronBehaviorTimer <= 0) {
    state.pendingBehavior = null;
    state.patronBehavior = "lookback";
    state.patronBehaviorTimer = state.queuedLookDuration;
    state.patronLookbackTimer = 0.2;
    setDialogue("振り返る。今は通行人の顔を作れ。", 1.0);
    return;
  }

  if (state.patronBehavior === "doublelookCue" && state.patronBehaviorTimer <= 0) {
    state.pendingBehavior = null;
    state.patronBehavior = "doublelook";
    state.patronBehaviorTimer = state.queuedLookDuration;
    state.patronLookbackTimer = 0.2;
    state.doubleLookStage = 1;
    setDialogue("二度見が来る。ごまかしを切るな。", 1.2);
    return;
  }

  if (state.patronBehavior === "lookback") {
    state.patronLookbackTimer -= dt;
    if (state.patronLookbackTimer <= 0 && !input.poseHeld) {
      lose("caught");
      return;
    }
  }

  if (state.patronBehavior === "doublelook") {
    const inFirstLook = state.patronBehaviorTimer > 1.1;
    const inSecondLook = state.patronBehaviorTimer < 0.48;

    if (inFirstLook && state.doubleLookStage !== 1) {
      state.doubleLookStage = 1;
      state.patronLookbackTimer = 0.18;
    } else if (!inFirstLook && state.doubleLookStage === 1) {
      state.doubleLookStage = 2;
    } else if (inSecondLook && state.doubleLookStage !== 3) {
      state.doubleLookStage = 3;
      state.patronLookbackTimer = 0.18;
    }

    if (inFirstLook || inSecondLook) {
      state.patronLookbackTimer -= dt;
    }

    if ((inFirstLook || inSecondLook) && state.patronLookbackTimer <= 0 && !input.poseHeld) {
      lose("caught");
      return;
    }
  }

  if (state.patronBehaviorTimer <= 0) {
    chooseBehavior();
  }
}

function startDashPhase() {
  state.phase = "dash";
  state.patronX = 92;
  state.playerX = 62;
  state.dashMeter = 10;
  state.dashTimer = 2.8;
  input.advanceHeld = false;
  input.poseHeld = false;
  setDialogue("常連が暖簾をくぐった。A を連打して飛び込め。", 1.4);
}

function updateDashPhase(dt) {
  state.dashTimer -= dt;
  state.dashMeter = Math.max(0, state.dashMeter - config.dashDecay * dt + input.advancePresses * 8.2);
  state.playerX = 60 + state.dashMeter * 0.23;
  input.advancePresses = 0;

  if (state.dashMeter >= config.dashTarget) {
    startPosePhase();
    return;
  }

  if (state.dashTimer <= 0) {
    lose("dash");
  }
}

function startPosePhase() {
  state.phase = "pose";
  state.poseCursor = 0;
  state.poseDirection = 1;
  state.poseWindowOpen = true;
  elements.bossOverlay.classList.remove("hidden");
  setDialogue("最後の一押し。大将の間合いに B を合わせろ。", 1.6);
}

function updatePosePhase(dt) {
  state.poseCursor += config.poseCursorSpeed * dt * state.poseDirection;
  if (state.poseCursor >= 100) {
    state.poseCursor = 100;
    state.poseDirection = -1;
  }
  if (state.poseCursor <= 0) {
    state.poseCursor = 0;
    state.poseDirection = 1;
  }

  if (input.posePressedThisFrame) {
    if (state.poseCursor >= config.poseSweetspotMin && state.poseCursor <= config.poseSweetspotMax) {
      win();
    } else {
      lose("pose");
    }
  }
}

function updateHud() {
  elements.staminaBar.style.width = `${state.stamina}%`;
  const progress = (state.distanceToShop / state.maxDistanceToShop) * 100;
  elements.distanceBar.style.width = `${progress}%`;

  if (state.phase === "tailing") {
    elements.phaseLabel.textContent = "尾行フェーズ";
    elements.hintLabel.textContent = state.cornerTransitionTimer > 0 ? "角を曲がって次の通りへ" : `振り返り中はごまかしを維持 / 難度 ${state.stageLevel + 1}`;
  } else if (state.phase === "dash") {
    elements.phaseLabel.textContent = "入店フェーズ: ダッシュ";
    elements.hintLabel.textContent = "A を素早く連打して暖簾へ";
  } else if (state.phase === "pose") {
    elements.phaseLabel.textContent = "入店フェーズ: キメ顔";
    elements.hintLabel.textContent = "大将の目線に合わせて B";
  } else if (state.phase === "result") {
    elements.phaseLabel.textContent = state.result === "win" ? "潜入成功" : "潜入失敗";
    elements.hintLabel.textContent = "開始ボタンで再挑戦";
  }
}

function render() {
  elements.player.style.left = `${state.playerX}%`;
  elements.patron.style.left = `${state.patronX}%`;
  elements.timingCursor.style.left = `${state.poseCursor}%`;

  elements.player.className = `character player ${getPlayerClass()}`;
  elements.patron.className = `character patron ${getPatronClass()}`;
  elements.stage.className = `stage ${state.phase === "tailing" ? "tailing-phase" : "entry-phase"}`;
  elements.suspicionFlash.classList.toggle("hidden", !state.showSuspicion);
  elements.patronAlert.classList.toggle("hidden", !shouldShowPatronAlert());
  elements.cornerOverlay.classList.toggle("hidden", state.cornerTransitionTimer <= 0);

  elements.advanceButton.classList.toggle("active", input.advanceHeld);
  elements.poseButton.classList.toggle("active", input.poseHeld);

  if (state.phase !== "pose") {
    elements.bossOverlay.classList.add("hidden");
  }
}

function shouldShowPatronAlert() {
  return state.phase === "tailing" && (state.patronBehavior === "lookbackCue" || state.patronBehavior === "doublelookCue");
}

function getPlayerClass() {
  if (state.phase === "dash") {
    return "dash";
  }

  if (input.poseHeld) {
    return "pose";
  }

  if (input.advanceHeld) {
    return "walking";
  }

  return "idle";
}

function getPatronClass() {
  if (state.patronBehavior === "lookback") {
    return "lookback";
  }

  if (state.patronBehavior === "lookbackCue" || state.patronBehavior === "doublelookCue") {
    return "walking";
  }

  if (state.patronBehavior === "doublelook") {
    const firstWindow = state.patronBehaviorTimer > 1.1;
    const secondWindow = state.patronBehaviorTimer < 0.48;
    return firstWindow || secondWindow ? "lookback" : "walking";
  }

  if (state.patronBehavior === "stop") {
    return "idle";
  }

  return "walking";
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function setHold(action, pressed) {
  if (state.phase === "result" || state.phase === "intro" || state.cornerTransitionTimer > 0) {
    return;
  }

  if (action === "advance") {
    input.advanceHeld = pressed;
    if (pressed && state.phase === "dash") {
      input.advancePresses += 1;
    }
  }

  if (action === "pose") {
    input.poseHeld = pressed;
    if (pressed && state.phase === "pose") {
      input.posePressedThisFrame = true;
    }
  }
}

function bindControl(button, action) {
  const onPress = (event) => {
    event.preventDefault();
    setHold(action, true);
  };
  const onRelease = (event) => {
    event.preventDefault();
    setHold(action, false);
  };

  button.addEventListener("pointerdown", onPress);
  button.addEventListener("pointerup", onRelease);
  button.addEventListener("pointerleave", onRelease);
  button.addEventListener("pointercancel", onRelease);
}

function update(timestamp) {
  const dt = Math.min(0.05, (timestamp - state.lastTimestamp) / 1000 || 0);
  state.lastTimestamp = timestamp;

  if (state.cornerTransitionTimer > 0) {
    updateCornerTransition(dt);
  } else if (state.phase === "tailing") {
    updateTailing(dt);
  } else if (state.phase === "dash") {
    updateDashPhase(dt);
  } else if (state.phase === "pose") {
    updatePosePhase(dt);
  }

  if (state.messageTimer > 0) {
    state.messageTimer = Math.max(0, state.messageTimer - dt);
    if (state.messageTimer === 0) {
      elements.dialogue.textContent = getDefaultDialogue();
    }
  }

  syncBgmTrack();

  updateHud();
  render();
  input.posePressedThisFrame = false;
  requestAnimationFrame(update);
}

window.addEventListener("keydown", (event) => {
  if (event.repeat) {
    return;
  }

  if (event.key === "z" || event.key === "Z") {
    setHold("advance", true);
  }

  if (event.key === "x" || event.key === "X") {
    setHold("pose", true);
  }
});

window.addEventListener("keyup", (event) => {
  if (event.key === "z" || event.key === "Z") {
    setHold("advance", false);
  }

  if (event.key === "x" || event.key === "X") {
    setHold("pose", false);
  }
});

elements.startButton.addEventListener("click", () => {
  elements.overlay.classList.remove("visible");
  resetGame();
});

bindControl(elements.advanceButton, "advance");
bindControl(elements.poseButton, "pose");

render();
requestAnimationFrame(update);