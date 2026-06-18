import { CameraSystem } from './camerasystem.js';
import { Shadow } from './enemy/shadow.js';
import { Josh } from './enemy/josh.js';
import { Oculosaurus } from './enemy/oculosaurus.js';
import { Holio } from './enemy/holio.js';
import { Mannequin } from './enemy/mannequin.js';
import { Rettel } from './enemy/rettel.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

/* Logical (design) resolution */
const LOGICAL_W = 1024;
const LOGICAL_H = 576;

// Camera system instance
const cameraSystem = new CameraSystem(LOGICAL_W, LOGICAL_H);

// Initialize Shadow Enemy System
const shadow = new Shadow(LOGICAL_W, LOGICAL_H);
window.gameShadowInstance = shadow; // global hook for camera rendering checks

// Initialize Josh Enemy System
const josh = new Josh(LOGICAL_W, LOGICAL_H);
window.gameJoshInstance = josh;

// Initialize Oculosaurus Enemy System
const oculosaurus = new Oculosaurus(LOGICAL_W, LOGICAL_H);
window.gameOculoInstance = oculosaurus;

// Initialize Holio Enemy System
const holio = new Holio(LOGICAL_W, LOGICAL_H);
window.gameHolioInstance = holio;

/* Initialize Mannequin Enemy System */
const mannequin = new Mannequin(LOGICAL_W, LOGICAL_H);
window.gameMannequinInstance = mannequin;

/* Initialize Rettel Enemy System */
const rettel = new Rettel(LOGICAL_W, LOGICAL_H);
window.gameRettelInstance = rettel;

/* Preload Office Door & Jumpscare Sprites */
const shadowLeftImg = new Image();
shadowLeftImg.src = 'shadow_left.png';

const shadowRightImg = new Image();
shadowRightImg.src = 'shadow_right.png';

const shadowJumpscareImg = new Image();
shadowJumpscareImg.src = 'shadow_jumpscare.png';

const joshJumpscareImg = new Image();
joshJumpscareImg.src = 'josh_jumpscare.png';

// Oculosaurus jumpscare sprite
const oculoJumpscareImg = new Image();
oculoJumpscareImg.src = 'oculosaurus_jumpscare.png';

// Rettel jumpscare sprite
const rettelJumpscareImg = new Image();
rettelJumpscareImg.src = 'rettel_jumpscare.png';

// Holio office sprite and jumpscare sprite
const holioImg = new Image();
holioImg.src = 'holio.png';

const holioJumpscareImg = new Image();
holioJumpscareImg.src = 'holio_jumpscare.png';

// Mannequin office sprite
const mannequinImg = new Image();
mannequinImg.src = 'mannequin.png';

let jumpscareSource = null;

/* Room dims */
const roomWidth = 1600;
const roomHeight = 576;

/* Game State */
let power = 100;
let leftShield = false;
let rightShield = false;
let isGameOver = false;
let isJumpscaring = false;
// when power reaches zero this becomes true; shields/monitor are disabled but game doesn't end
let powerOut = false;
window.powerOut = false;

/* Title / start state */
let started = false;
let nightTimer = 0;
let postStartInitDone = false;
let nightNumber = 1; 

 // Paper / 11PM intro overlay state
let showPaper = false;
let paperSections = []; // array of {title, body, x,y,w,h} (simple layout)
// Track whether the paper has been shown this night (we'll show it after the black NIGHT screen finishes)
let paperShownThisNight = false;

/* Per-button cooldowns */
let leftCooldown = 0;
let rightCooldown = 0;
const BUTTON_COOLDOWN_MS = 1000;

/* Power Drain Logic */
let powerTimer = 0;

/* Camera & input */
let mouseX = LOGICAL_W / 2;
let cameraX = (roomWidth - LOGICAL_W) / 2;

// --- Clock / Timer ---
let clockElapsed = 0;
let clockHourIndex = 0;
const CLOCK_INTERVAL = 54000;
const CLOCK_HOURS = [
  "12AM","1AM","2AM","3AM","4AM","5AM",
  "6AM","7AM","8AM","9AM","10AM","11AM",
  "12PM","1PM","2PM","3PM","4PM","5PM",
  "6PM","7PM","8PM","9PM","10PM","11PM"
];

// --- 6AM Sequence state ---
let lastTriggeredHour = -1;
let in6amSequence = false;
let seqTimer = 0;
const SEQ_DURATION = 12000;
let seqAudio = null;
let seqFromHour = '5AM';
let seqToHour = '6AM';

// --- Post-win keypad state ---
let youWon = false;
let youWonTimer = 0;

// --- Jumpscare Mechanics ---
let jumpscareAudio = null;
let jumpscareTimeElapsed = 0;
let jumpscareYPos = LOGICAL_H; // Starts at bottom boundary screen

// Track cause of last death so we can show a hint on the Game Over screen
let lastDeathCause = null;

// Collection of shadow dialog lines to play when shadow kills the player
const shadowLines = [];

function preloadSequenceAudio() {
  seqAudio = new Audio('6am.mp3');
  seqAudio.preload = 'auto';
  
  jumpscareAudio = new Audio('jumpscare.wav');
  jumpscareAudio.preload = 'auto';

  // Preload several shadow_line audio assets (existing in project)
  for (let i = 1; i <= 3; i++) {
    // files: shadow_line1.wav, shadow_line2.wav, shadow_line3.wav
    const a = new Audio(`shadow_line${i}.wav`);
    a.preload = 'auto';
    a.volume = 0.7;
    shadowLines.push(a);
  }

  // Preload Rettel electrocution sound
  try {
    window.rettelElectro = new Audio('rettel_electrocute.mp3');
    window.rettelElectro.preload = 'auto';
  } catch (e) {}

}
preloadSequenceAudio();

/* UI Layout Bounds */
const backWall = { x: 400, y: 150, w: 800, h: 300 };
const BUTTON_W = 100;
const BUTTON_H = 40;
const BUTTON_LEFT_X = 520;
const BUTTON_RIGHT_X = 980;
let BUTTON_Y = backWall.y + backWall.h / 2 - BUTTON_H / 2;

function resizeCanvas() {
  const container = document.getElementById('gameContainer');
  const rect = container.getBoundingClientRect();
  const dpr = Math.max(1, window.devicePixelRatio || 1);

  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
  canvas.width = Math.round(LOGICAL_W * dpr);
  canvas.height = Math.round(LOGICAL_H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  BUTTON_Y = backWall.y + backWall.h / 2 - BUTTON_H / 2;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function clientToLogical(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = LOGICAL_W / rect.width;
  const scaleY = LOGICAL_H / rect.height;
  return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
}

window.addEventListener('mousemove', (e) => {
  const pt = clientToLogical(e.clientX, e.clientY);
  mouseX = Math.max(0, Math.min(LOGICAL_W, pt.x));
});

function triggerJumpscareSequence(source = null) {
  if (isJumpscaring) return;
  isJumpscaring = true;
  cameraSystem.isOpen = false; // Collapse monitor view
  jumpscareTimeElapsed = 0;
  jumpscareYPos = LOGICAL_H; // Begin slide position setup

  // Record cause so Game Over screen can show a hint
  lastDeathCause = source || 'unknown';
  
  try {
    // record which enemy caused the jumpscare so we can pick the right image later
    jumpscareSource = source || null;

    if (jumpscareAudio) {
      jumpscareAudio.currentTime = 0;
      jumpscareAudio.play().catch(() => {});
    }
  } catch (e) {}
}

function handleClickClient(clientX, clientY) {
  if (!started) {
    startNight();
    return;
  }

  // If the paper intro is being shown at 11PM, clicking dismisses it and forces the time to 12AM
  if (showPaper) {
    clockHourIndex = CLOCK_HOURS.indexOf('12AM');
    clockElapsed = 0;
    showPaper = false;
    return;
  }

  // Handle retry clicks if game over is hit
  if (isGameOver && !isJumpscaring) {
    const pt = clientToLogical(clientX, clientY);
    // Button position check centered on screen context
    const btnW = 160;
    const btnH = 45;
    const btnX = LOGICAL_W / 2 - btnW / 2;
    const btnY = LOGICAL_H / 2 + 40;
    
    if (pt.x >= btnX && pt.x <= btnX + btnW && pt.y >= btnY && pt.y <= btnY + btnH) {
      startNight(); // Reload current active state night settings
    }
    return;
  }

  if (isGameOver || in6amSequence || isJumpscaring) return;

  const pt = clientToLogical(clientX, clientY);

  // Notify subsystems if camera opened/closed or switched
  const prevCam = cameraSystem.currentCam;
  const prevOpen = cameraSystem.isOpen;
  if (cameraSystem.handleMouseClick(pt.x, pt.y, started)) {
    // If camera was toggled (open/close)
    // - When monitor was open and now closed: notify Oculosaurus removal and attempt Holio spawn (Holio appears when you flip monitor down)
    if (prevOpen && !cameraSystem.isOpen) {
      if (window.gameOculoInstance) window.gameOculoInstance.removeIfVisible();
      if (window.gameHolioInstance) {
        const currentHourString = CLOCK_HOURS[clockHourIndex % CLOCK_HOURS.length];
        window.gameHolioInstance.trySpawnOnMonitorClose(nightNumber, currentHourString);
      }
    }
    // - When monitor was closed and now opened: remove Holio immediately (player flips monitor back up to get rid of it)
    if (!prevOpen && cameraSystem.isOpen) {
      if (window.gameHolioInstance) window.gameHolioInstance.removeIfVisible();
    }

    // If camera changed, notify Oculosaurus about the switch (it may spawn on the new camera)
    if (cameraSystem.currentCam !== prevCam) {
      if (window.gameOculoInstance) window.gameOculoInstance.onCameraSwitch(cameraSystem.currentCam, nightNumber);
    }
    return;
  }

  const clickX = pt.x + cameraX;
  const clickY = pt.y;

  if (clickX >= BUTTON_LEFT_X && clickX <= BUTTON_LEFT_X + BUTTON_W && clickY >= BUTTON_Y && clickY <= BUTTON_Y + BUTTON_H) {
    if (leftCooldown <= 0) {
      leftShield = !leftShield;
      leftCooldown = BUTTON_COOLDOWN_MS;
    }
  }
  // Right shield click: disabled/hidden if Mannequin is in office (stage 4)
  if (!(window.gameMannequinInstance && window.gameMannequinInstance.stage === 4)) {
    if (clickX >= BUTTON_RIGHT_X && clickX <= BUTTON_RIGHT_X + BUTTON_W && clickY >= BUTTON_Y && clickY <= BUTTON_Y + BUTTON_H) {
      if (rightCooldown <= 0) {
        rightShield = !rightShield;
        rightCooldown = BUTTON_COOLDOWN_MS;
      }
    }
  }
}

canvas.addEventListener('click', (e) => handleClickClient(e.clientX, e.clientY));
canvas.addEventListener('touchstart', (e) => {
  const touch = e.touches[0];
  if (!touch) return;
  handleClickClient(touch.clientX, touch.clientY);
}, { passive: true });

function startNight() {
  started = true;
  isGameOver = false;
  isJumpscaring = false;
  nightTimer = 2900;
  // Start nights at 11PM; we'll show an intro "paper" overlay and only progress to 12AM after dismissing it
  clockHourIndex = CLOCK_HOURS.indexOf('11PM');
  clockElapsed = 0;
  power = 100;
  powerTimer = 0;
  leftShield = false;
  rightShield = false;
  leftCooldown = 0;
  rightCooldown = 0;
  cameraSystem.isOpen = false;
  postStartInitDone = false;
  lastTriggeredHour = -1;
  shadow.reset(); // Reset enemy logic systems cleanly
  josh.reset();
  mannequin.reset();

  // Prepare paper sections per night
  paperSections = [];
  if (nightNumber === 1) {
    paperSections.push({
      title: 'Shadow',
      body: "When you hear him laugh, he will appear on either the east or west hallway. Look for the one he's on, and prepare to shield your door when he laughs again."
    });
    paperSections.push({
      title: 'Josh',
      body: "Who even let this kid in the factory at night?? He starts in the Entrance and makes his way to your left door. If you don't see him on the cameras, shield your left door."
    });
  } else if (nightNumber === 2) {
    // Detailed mechanics for Night 2
    paperSections.push({
      title: 'Oculosaurus',
      body: "This entity can appear ON a camera and 'block' it — when it does, just don't look at that camera: switching away or closing the monitor will remove it. If you switch to a camera and it shows up, turn away until it's gone."
    });
    paperSections.push({
      title: 'Holio',
      body: "Whenever you flip your monitor off, Holio may spawn in the office and wait for you to flip the monitor back down. To remove it, flip the monitor back up — the quick on/off will get rid of it."
    });
    paperSections.push({
      title: 'Mannequin',
      body: "A possessed mannequin starts at the Ventilation Hub (CAM 05) and moves toward the East Hallway (CAM 08 / right door). You must shield your RIGHT door when it reaches the hallway — if you fail, it will move into the office and then permanently block your right door (the right shield button will disappear). Mannequin is inert on Night 1."
    });
  } else if (nightNumber === 3) {
    paperSections.push({
      title: 'Rettel',
      body: "I seriously don't know why the government hasn't investigated this place yet. It starts in the Supply Closet (CAM 03). The camera has been reported to shake as if warning you when it's about to attack. When it leaves the supply closet, letters will appear on the middle wall of your office forming a word — shield the indicated door while the timer runs!"
    });
  } else if (nightNumber === 4) {
    paperSections.push({
      title: 'Josh',
      body: "The kid got smarter. Once he leaves camera view he will instantly ambush you. You can push him back by looking at him for a long period of time on the cameras."
    });
  } else {
    // Nights 5+ use a placeholder single section
    paperSections.push({
      title: 'Placeholder',
      body: 'Placeholder'
    });
  }

  // Ensure paper will display once the "NIGHT" black screen finishes
  paperShownThisNight = false;

  // Reapply canvas sizing / transform immediately when a night starts to avoid transient text placement issues
  // (this mirrors what a manual resize fixes)
  try {
    resizeCanvas();
  } catch (e) {}
}

let lastTime = 0;
function gameLoop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const dt = timestamp - lastTime;
  lastTime = timestamp;

  update(dt);
  render();

  requestAnimationFrame(gameLoop);
}
requestAnimationFrame(gameLoop);

/* Key input for the removed keypad no longer required; no-op handler left intentionally. */
window.addEventListener('keydown', (e) => {});

function start6amSequence() {
  if (in6amSequence) return;
  in6amSequence = true;
  seqTimer = 0;
  leftShield = false;
  rightShield = false;
  cameraSystem.isOpen = false;
  shadow.reset(); // Pause and clean state arrays instantly
  josh.reset();
  mannequin.reset();
  try {
    if (seqAudio) {
      seqAudio.currentTime = 0;
      seqAudio.play().catch(() => {});
    }
  } catch (e) {}
}

function end6amSequence() {
  in6amSequence = false;

  // If we just finished Night 5 -> 6AM, show the win/keypad screen instead of immediately starting Night 6.
  if (nightNumber === 5) {
    // Show a simple YOU WON state (no keypad) and pause enemy updates; then attempt to close the window after 5s.
    youWon = true;
    youWonTimer = 0;
    setTimeout(() => {
      try { window.close(); } catch (e) {}
    }, 5000);
    return;
  }

  // Default path for other nights: advance night and start.
  nightNumber = Math.min(99, nightNumber + 1);
  startNight();
}

function update(dt) {
  if (!started) return;

  // --- JUMPSCARE SYSTEM HANDLING ---
  if (isJumpscaring) {
    jumpscareTimeElapsed += dt;
    
    // Fast glide translation interpolation calculation: Target center (Y=0)
    // Moves from screen height down to center in roughly 350ms
    jumpscareYPos = Math.max(0, LOGICAL_H - (jumpscareTimeElapsed / 350) * LOGICAL_H);
    
    // Check if jumpscare mp3 track audio duration processing complete
    if (jumpscareAudio && jumpscareAudio.ended) {
      // If Shadow caused the jumpscare, play one of the shadow post-jumpscare lines now
      try {
        if (jumpscareSource === 'shadow' && shadowLines.length > 0) {
          const idx = Math.floor(Math.random() * shadowLines.length);
          const s = shadowLines[idx];
          try { s.currentTime = 0; s.play().catch(() => {}); } catch (e) {}
        }
      } catch (e) {}

      isJumpscaring = false;
      isGameOver = true; // Drop processing window to Static Game Over UI panel loop
    }
    return; // Block game loops when tracking hits
  }

  if (in6amSequence) {
    seqTimer += dt;
    if (seqTimer >= SEQ_DURATION) {
      end6amSequence();
    }
    return;
  }

  if (nightTimer > 0) {
    nightTimer = Math.max(0, nightTimer - dt);
  }

  if (started && nightTimer === 0 && !postStartInitDone) {
    leftShield = false;
    rightShield = false;
    cameraSystem.isOpen = false;

    // Show the paper overlay immediately after the NIGHT black background (nightTimer) ends,
    // but only the first time this transition occurs for the night.
    if (!paperShownThisNight) {
      showPaper = true;
      paperShownThisNight = true;
    }

    postStartInitDone = true;
  }

  // System Core Timer
  if (started && nightTimer === 0) {
    clockElapsed += dt;
    while (clockElapsed >= CLOCK_INTERVAL) {
      clockElapsed -= CLOCK_INTERVAL;
      clockHourIndex = (clockHourIndex + 1) % CLOCK_HOURS.length;

      if (CLOCK_HOURS[clockHourIndex] === '6AM' && lastTriggeredHour !== clockHourIndex) {
        lastTriggeredHour = clockHourIndex;
        start6amSequence();
      }
    }
  }

  if (power <= 0) {
    power = 0;
    // disable shields and monitor but do NOT kill player; set global flag for enemies
    leftShield = false;
    rightShield = false;
    cameraSystem.isOpen = false;
    powerOut = true;
    window.powerOut = true;
  } else {
    if (powerOut) {
      powerOut = false;
      window.powerOut = false;
    }
  }

  if (isGameOver) return;

  // Run Shadow update cycle ticks if normal phase logic active
  if (started && nightTimer === 0) {
    const currentHourString = CLOCK_HOURS[clockHourIndex % CLOCK_HOURS.length];

    // If the post-win keypad is shown, pause all enemy behavior so nobody moves after you win.
    if (wonScreen) {
      // skip enemy updates entirely while on the win screen
    } else {
      // No enemies are active until 12AM (and the paper overlay is dismissed).
      if (currentHourString !== '11PM' && !showPaper) {
        // If Mannequin is in office (stage 4) the right door shield does not function.
        const effectiveRightShield = (window.gameMannequinInstance && window.gameMannequinInstance.stage === 4) ? false : rightShield;

        shadow.update(
          dt, 
          nightNumber, 
          currentHourString, 
          cameraSystem.isOpen, 
          cameraSystem.currentCam, 
          leftShield, 
          effectiveRightShield, 
          triggerJumpscareSequence
        );

        // Josh update; capture pushBack signal to trigger camera effect
        const joshResult = josh.update(
          dt,
          nightNumber,
          currentHourString,
          cameraSystem.isOpen,
          cameraSystem.currentCam,
          leftShield,
          triggerJumpscareSequence,
          cameraSystem
        );
        if (joshResult && joshResult.pushedBack) {
          cameraSystem.switchBlipTime = 8;
        }

        // Oculosaurus update
        if (window.gameOculoInstance) {
          window.gameOculoInstance.update(
            dt,
            nightNumber,
            cameraSystem.isOpen,
            cameraSystem.currentCam,
            triggerJumpscareSequence
          );
        }

        // Mannequin update
        if (window.gameMannequinInstance) {
          const currentHourString = CLOCK_HOURS[clockHourIndex % CLOCK_HOURS.length];
          const mannequinResult = window.gameMannequinInstance.update(
            dt,
            nightNumber,
            currentHourString,
            cameraSystem.isOpen,
            cameraSystem.currentCam,
            window.gameShadowInstance,
            rightShield,
            // no immediate jumpscare on entering office here; main will render/determine consequences
            null
          );
          // If mannequin moved while monitor was open, trigger camera switch/blip effect (similar to Josh push-back)
          if (mannequinResult && mannequinResult.pushedBack) {
            cameraSystem.switchBlipTime = 8;
          }
        }

        // Holio update
        if (window.gameHolioInstance) {
          const currentHourString = CLOCK_HOURS[clockHourIndex % CLOCK_HOURS.length];
          window.gameHolioInstance.update(
            dt,
            nightNumber,
            currentHourString,
            cameraSystem.isOpen,
            triggerJumpscareSequence
          );
        }

        // Rettel update (charging on CAM_03 -> door attack)
        if (window.gameRettelInstance) {
          const currentHourString = CLOCK_HOURS[clockHourIndex % CLOCK_HOURS.length];
          // Notify Rettel when player is actively watching CAM_03 so it can pause progress & start post-watch pause
          const isWatchingCam3 = cameraSystem.isOpen && cameraSystem.currentCam === 'CAM_03';
          window.gameRettelInstance.notifyWatchingCam3(isWatchingCam3);

          window.gameRettelInstance.update(
            dt,
            nightNumber,
            cameraSystem.isOpen,
            cameraSystem.currentCam,
            leftShield,
            rightShield,
            triggerJumpscareSequence,
            // play electrocution sound
            () => {
              try {
                if (window.rettelElectro) { window.rettelElectro.currentTime = 0; window.rettelElectro.play().catch(()=>{}); }
              } catch (e) {}
            },
            // drain power callback
            (drainPct) => {
              power = Math.max(0, power - drainPct);
            }
          );
        }
      }
    }
  }

  const targetCameraX = (mouseX / LOGICAL_W) * (roomWidth - LOGICAL_W);
  cameraX += (targetCameraX - cameraX) * 0.08;

  if (leftCooldown > 0) leftCooldown = Math.max(0, leftCooldown - dt);
  if (rightCooldown > 0) rightCooldown = Math.max(0, rightCooldown - dt);

  // Ensure right shield is forcibly disabled while Mannequin occupies the office (stage 4)
  if (window.gameMannequinInstance && window.gameMannequinInstance.stage === 4) {
    rightShield = false;
  }

  const activeShields = (leftShield ? 1 : 0) + (rightShield ? 1 : 0);
  const bars = activeShields + 1;
  const intervalMs = bars === 1 ? 10800 : bars === 2 ? 8700 : bars === 3 ? 5400 : 2700;

  powerTimer += dt;
  if (powerTimer >= intervalMs) {
    const decrements = Math.floor(powerTimer / intervalMs);
    power -= decrements;
    powerTimer = powerTimer % intervalMs;
  }
  power = Math.max(0, Math.min(100, power));
}

function render() {
  ctx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);

  // Simple YOU WON screen (no keypad): shown after finishing Night 5's 6AM sequence
  if (youWon) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    ctx.fillStyle = '#9ae6ff';
    ctx.font = '64px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('YOU WON', LOGICAL_W / 2, LOGICAL_H / 2 - 18);

    // sublabel / cheeky message under the title
    ctx.font = '16px monospace';
    ctx.fillStyle = '#cfeff6';
    ctx.fillText('congrats i hope you enjoyed the troll game', LOGICAL_W / 2, LOGICAL_H / 2 + 22);

    return;
  }

  if (in6amSequence) {
    // Render backplate setup during clean execution frames
    ctx.save();
    ctx.translate(-cameraX, 0);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, roomWidth, roomHeight);
    ctx.fillStyle = '#252525';
    ctx.fillRect(backWall.x, backWall.y, backWall.w, backWall.h);
    ctx.restore();
  } else {
    ctx.save();
    ctx.translate(-cameraX, 0);

    // --- DRAW ROOM BACKGROUND ---
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, roomWidth, roomHeight);

    // Back Wall
    ctx.fillStyle = '#252525';
    ctx.fillRect(backWall.x, backWall.y, backWall.w, backWall.h);

    // Rettel door hint text: show "LEFT" or "RIGHT" on the middle back wall when Rettel is in stage 2
    try {
      if (window.gameRettelInstance && window.gameRettelInstance.stage === 2 && window.gameRettelInstance.attackTarget) {
        ctx.save();
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.font = '64px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const txt = window.gameRettelInstance.attackTarget.toUpperCase(); // 'LEFT' or 'RIGHT'
        const tx = backWall.x + backWall.w / 2;
        const ty = backWall.y + backWall.h / 2;
        // slight shadow/outlines for readability
        ctx.lineWidth = 6;
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.strokeText(txt, tx, ty);
        ctx.fillStyle = '#ffd36b';
        ctx.fillText(txt, tx, ty);
        ctx.restore();
      }
    } catch (e) {}

    // Guidelines
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, roomHeight); ctx.lineTo(400, 450);
    ctx.moveTo(roomWidth, roomHeight); ctx.lineTo(1200, 450);
    ctx.moveTo(0, 0); ctx.lineTo(400, 150);
    ctx.moveTo(roomWidth, 0); ctx.lineTo(1200, 150);
    ctx.stroke();

    // --- DRAW DOORS (Restored Perspective Slopes) ---
    ctx.fillStyle = '#0a0a0a';
    
    // Left Door Trapezoid
    ctx.beginPath();
    ctx.moveTo(150, 56.25);
    ctx.lineTo(350, 131.25);
    ctx.lineTo(350, 465.75);
    ctx.lineTo(150, 528.75);
    ctx.closePath();
    ctx.fill();

    // Right Door Trapezoid
    ctx.beginPath();
    ctx.moveTo(1450, 56.25);
    ctx.lineTo(1250, 131.25);
    ctx.lineTo(1250, 465.75);
    ctx.lineTo(1450, 528.75);
    ctx.closePath();
    ctx.fill();

    // --- RENDER SHADOW OFFICE LAYER (PRIORITY: > DOOR, < SHIELD) ---
    if (shadow.stage === 2 && shadow.doorSide === 'left') {
      ctx.drawImage(shadowLeftImg, 0, 0, roomWidth, roomHeight);
    }
    if (shadow.stage === 2 && shadow.doorSide === 'right') {
      ctx.drawImage(shadowRightImg, 0, 0, roomWidth, roomHeight);
    }

    // Holio appears in the office (same placement/priority as shadow office sprites)
    if (window.gameHolioInstance && window.gameHolioInstance.stage === 1) {
      try {
        ctx.drawImage(holioImg, 0, 0, roomWidth, roomHeight);
      } catch (e) {}
    }

    // Mannequin appears in the office (same placement/priority as shadow/holio office sprites)
    if (window.gameMannequinInstance && window.gameMannequinInstance.stage === 4) {
      try {
        ctx.drawImage(mannequinImg, 0, 0, roomWidth, roomHeight);
      } catch (e) {}
    }

    // --- DRAW BUTTONS ---
    const leftDisabled = leftCooldown > 0;
    ctx.fillStyle = leftShield ? '#4caf50' : '#f44336';
    roundRect(ctx, BUTTON_LEFT_X, BUTTON_Y, BUTTON_W, BUTTON_H, 6, true, false);
    if (leftDisabled) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      roundRect(ctx, BUTTON_LEFT_X, BUTTON_Y, BUTTON_W, BUTTON_H, 6, true, false);
    }
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(leftShield ? "SHIELD ON" : "SHIELD OFF", BUTTON_LEFT_X + BUTTON_W / 2, BUTTON_Y + BUTTON_H / 2);

    // Hide right shield button entirely when Mannequin is occupying the office (stage 4)
    if (!(window.gameMannequinInstance && window.gameMannequinInstance.stage === 4)) {
      const rightDisabled = rightCooldown > 0;
      ctx.fillStyle = rightShield ? '#4caf50' : '#f44336';
      roundRect(ctx, BUTTON_RIGHT_X, BUTTON_Y, BUTTON_W, BUTTON_H, 6, true, false);
      if (rightDisabled) {
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        roundRect(ctx, BUTTON_RIGHT_X, BUTTON_Y, BUTTON_W, BUTTON_H, 6, true, false);
      }
      ctx.fillStyle = '#fff';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(rightShield ? "SHIELD ON" : "SHIELD OFF", BUTTON_RIGHT_X + BUTTON_W / 2, BUTTON_Y + BUTTON_H / 2);
    }

    // --- DRAW ELECTRIC SHIELDS (Restored Perspective Slopes) ---
    if (leftShield) {
      ctx.fillStyle = `rgba(0, 191, 255, ${0.28 + (Math.sin(Date.now() / 120) + 1) * 0.12})`;
      ctx.beginPath();
      ctx.moveTo(150, 56.25);
      ctx.lineTo(350, 131.25);
      ctx.lineTo(350, 465.75);
      ctx.lineTo(150, 528.75);
      ctx.closePath();
      ctx.fill();

      // Draw a matching outline to hide antialias seams (prevents thin white lines)
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = 3;
      ctx.stroke();


    }

    if (rightShield) {
      ctx.fillStyle = `rgba(0, 191, 255, ${0.28 + (Math.cos(Date.now() / 120) + 1) * 0.12})`;
      ctx.beginPath();
      ctx.moveTo(1450, 56.25);
      ctx.lineTo(1250, 131.25);
      ctx.lineTo(1250, 465.75);
      ctx.lineTo(1450, 528.75);
      ctx.closePath();
      ctx.fill();

      // Draw a matching outline to hide antialias seams (prevents thin white lines)
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = 3;
      ctx.stroke();


    }

    ctx.restore();

    // --- DRAW UI OVERLAYS ---
    ctx.fillStyle = '#fff';
    ctx.font = '24px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Power: ${Math.ceil(power)}%`, 30, LOGICAL_H - 40);

    let usage = 0;
    if (leftShield) usage++;
    if (rightShield) usage++;
    ctx.fillStyle = usage === 0 ? '#4caf50' : usage === 1 ? '#ff9800' : '#f44336';
    ctx.fillText(`Usage: ${'▶'.repeat(usage + 1)}`, 30, LOGICAL_H - 15);

    cameraSystem.render(ctx);
  }

  // Ensure camera switch/distortion is rendered above everything so it overlays all characters
  if (cameraSystem.switchBlipTime > 0) {
    // decrement and draw full-screen glitch bars on top of all scene elements
    cameraSystem.switchBlipTime--;
    ctx.save();
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.25 + 0.15})`;
    for (let i = 0; i < LOGICAL_H; i += Math.floor(Math.random() * 10) + 5) {
      ctx.fillRect(0, i, LOGICAL_W, Math.random() * 8);
    }
    ctx.restore();
  }

  if (!started) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    ctx.fillStyle = '#0f0f0f';
    const boxW = 700;
    const boxH = 260;
    roundRect(ctx, (LOGICAL_W - boxW) / 2, (LOGICAL_H - boxH) / 2, boxW, boxH, 12, true, false);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = '64px sans-serif';
    ctx.fillText('W.O.R.L.D.', LOGICAL_W / 2, (LOGICAL_H - boxH) / 2 + 90);
    ctx.font = '20px sans-serif';
    ctx.fillStyle = '#bbb';
    ctx.fillText('Security Office Simulation', LOGICAL_W / 2, (LOGICAL_H - boxH) / 2 + 130);
    ctx.font = '18px monospace';
    ctx.fillStyle = '#9ae6ff';
    ctx.fillText('Click or tap anywhere to start', LOGICAL_W / 2, (LOGICAL_H - boxH) / 2 + 185);
    return;
  }

  // If the paper intro is active, draw it fullscreen and block gameplay until dismissed
  if (showPaper) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    // Paper background
    const pad = 40;
    const paperX = pad;
    const paperY = pad;
    const paperW = LOGICAL_W - pad * 2;
    const paperH = LOGICAL_H - pad * 2;

    ctx.fillStyle = '#f7f3e8';
    roundRect(ctx, paperX, paperY, paperW, paperH, 8, true, true);

    // Title
    ctx.fillStyle = '#222';
    ctx.font = '28px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`Night ${nightNumber} — Enemy Manual`, LOGICAL_W / 2, paperY + 48);

    // Draw sections stacked vertically
    ctx.font = '16px monospace';
    ctx.textAlign = 'left';
    const sectionStartY = paperY + 90;
    const sectionGap = 100;
    for (let i = 0; i < paperSections.length; i++) {
      const s = paperSections[i];
      const sx = paperX + 36;
      const sy = sectionStartY + i * sectionGap;
      ctx.fillStyle = '#111';
      ctx.font = '18px bold monospace';
      ctx.fillText(s.title, sx, sy);
      ctx.fillStyle = '#333';
      ctx.font = '14px monospace';
      // wrap body text manually
      const words = s.body.split(' ');
      let line = '';
      let lineY = sy + 20;
      const maxW = paperW - 72;
      for (let w = 0; w < words.length; w++) {
        const test = line + (line ? ' ' : '') + words[w];
        const metrics = ctx.measureText(test);
        if (metrics.width > maxW) {
          ctx.fillText(line, sx, lineY);
          line = words[w];
          lineY += 18;
        } else {
          line = test;
        }
      }
      if (line) ctx.fillText(line, sx, lineY);
    }

    // Dismiss hint
    ctx.fillStyle = '#666';
    ctx.font = '13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Click or tap anywhere to continue to 12AM', LOGICAL_W/2, paperY + paperH - 28);
    return;
  }

  if (nightTimer > 0) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = '56px sans-serif';
    ctx.fillText(`NIGHT ${nightNumber}`, LOGICAL_W / 2, LOGICAL_H / 2 - 10);
    ctx.font = '28px monospace';
    ctx.fillStyle = '#9ae6ff';
    ctx.fillText(CLOCK_HOURS[clockHourIndex % CLOCK_HOURS.length], LOGICAL_W / 2, LOGICAL_H / 2 + 36);
    return;
  }

  if (in6amSequence) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    const p = Math.min(1, seqTimer / SEQ_DURATION);
    const ease = (t) => t < 0.5 ? 2*t*t : -1 + (4-2*t)*t;
    const e = ease(p);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 1 - e;
    ctx.fillStyle = '#9ae6ff';
    ctx.font = '36px monospace';
    ctx.fillText(seqFromHour, LOGICAL_W/2 - 80 - e*40, LOGICAL_H/2 - 10 - e*10);

    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff';
    ctx.font = '28px monospace';
    ctx.fillText('→', LOGICAL_W/2, LOGICAL_H/2 - 6);

    ctx.globalAlpha = e;
    ctx.fillStyle = '#9ae6ff';
    ctx.font = '48px monospace';
    ctx.fillText(seqToHour, LOGICAL_W/2 + 80 + (1-e)*40, LOGICAL_H/2 + 4 + (1-e)*10);
    ctx.globalAlpha = 1;
    return;
  }

  if (started && nightTimer === 0) {
    const boxX = LOGICAL_W - 150 - 14;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    roundRect(ctx, boxX, 14, 150, 40, 8, true, false);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.strokeRect(boxX, 14, 150, 40);
    ctx.fillStyle = '#9ae6ff';
    ctx.font = '18px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(CLOCK_HOURS[clockHourIndex % CLOCK_HOURS.length], boxX + 75, 39);
  }

  // --- RENDERING JUMPSCARE FRAMES (FORMOST OVERLAY) ---
  if (isJumpscaring) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H); // Clear backing workspace
    // Draw sliding enemy sprite sheet overlay asset on context area
    if (jumpscareSource === 'josh') {
      ctx.drawImage(joshJumpscareImg, 0, jumpscareYPos, LOGICAL_W, LOGICAL_H);
    } else if (jumpscareSource === 'oculosaurus') {
      // Use Oculosaurus-specific jumpscare art
      ctx.drawImage(oculoJumpscareImg, 0, jumpscareYPos, LOGICAL_W, LOGICAL_H);
    } else if (jumpscareSource === 'holio') {
      // Holio-specific jumpscare art
      ctx.drawImage(holioJumpscareImg, 0, jumpscareYPos, LOGICAL_W, LOGICAL_H);
    } else if (jumpscareSource === 'rettel') {
      // Use Rettel-specific jumpscare art
      try {
        ctx.drawImage(rettelJumpscareImg, 0, jumpscareYPos, LOGICAL_W, LOGICAL_H);
      } catch (e) {
        // fallback to shadow art if asset missing
        ctx.drawImage(shadowJumpscareImg, 0, jumpscareYPos, LOGICAL_W, LOGICAL_H);
      }
    } else {
      ctx.drawImage(shadowJumpscareImg, 0, jumpscareYPos, LOGICAL_W, LOGICAL_H);
    }
  }

  if (isGameOver && !isJumpscaring) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    ctx.fillStyle = '#f44336';
    ctx.font = '48px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText("GAME OVER", LOGICAL_W / 2, LOGICAL_H / 2 - 32);

    // Died to label
    ctx.font = '18px monospace';
    ctx.fillStyle = '#ddd';
    ctx.textAlign = 'center';
    ctx.fillText(`Died to: ${lastDeathCause || '???'}`, LOGICAL_W / 2, LOGICAL_H / 2 + 2);

    // Interactive Retry Button Rendering
    const btnW = 160;
    const btnH = 45;
    const btnX = LOGICAL_W / 2 - btnW / 2;
    const btnY = LOGICAL_H / 2 + 40;

    ctx.fillStyle = '#222';
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 2;
    roundRect(ctx, btnX, btnY, btnW, btnH, 6, true, true);

    ctx.fillStyle = '#fff';
    ctx.font = '16px monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText("RETRY NIGHT", LOGICAL_W / 2, btnY + btnH / 2);
  }
}

function roundRect(ctx, x, y, w, h, r, fill, stroke) {
  if (r === undefined) r = 5;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}