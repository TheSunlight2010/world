export class Josh {
  constructor(logicalW, logicalH) {
    this.logicalW = logicalW;
    this.logicalH = logicalH;

    // Stages: 0 = CAM_01, 1 = CAM_02, 2 = CAM_06, 3 = CAM_07, 4 = off-cams (about to jumpscare)
    this.stage = 0;
    this.currentCam = 'CAM_01';
    this.movementTimer = 0;
    this.nextMoveInterval = this._randInterval();
    this.pauseTimer = 0;
    this.pausedUntil = 0;
    this.watchTimer = 0;
    this.lingerWhileWatching = false;
    this.stageFailCount = 0;
    this.preloadImgs();
  }

  preloadImgs() {
    // josh cam images, same sizing/positioning as Shadow's camera assets
    this.cam1Img = new Image();
    this.cam1Img.src = 'josh_cam1.png';
    this.cam2Img = new Image();
    this.cam2Img.src = 'josh_cam2.png';
    this.cam6Img = new Image();
    this.cam6Img.src = 'josh_cam6.png';
    this.cam7Img = new Image();
    this.cam7Img.src = 'josh_cam7.png';
  }

  _randInterval() {
    // seconds -> ms
    return (2.34 + Math.random() * (7.01 - 2.34)) * 1000;
  }

  _randPause() {
    return (0.9 + Math.random() * (2.32 - 0.9)) * 1000;
  }

  getAILevel(nightNumber, currentHourString) {
    let baseAI = 0;
    if (nightNumber === 1) baseAI = 1;
    else if (nightNumber === 2) baseAI = 3;
    else if (nightNumber === 3) baseAI = 4;
    else if (nightNumber === 4) baseAI = 6;
    else if (nightNumber === 5) baseAI = 8;
    if (currentHourString === '2AM') baseAI += 1;
    if (currentHourString === '3AM') baseAI += 1;
    if (currentHourString === '4AM') baseAI += 1;
    if (currentHourString === '5AM') baseAI += 3;
    if (typeof window !== 'undefined' && window.powerOut) baseAI = Math.min(20, baseAI + 5);
    return baseAI;
  }

  reset() {
    this.stage = 0;
    this.currentCam = 'CAM_01';
    this.movementTimer = 0;
    this.nextMoveInterval = this._randInterval();
    this.pauseTimer = 0;
    this.pausedUntil = 0;
    this.watchTimer = 0;
    this.lingerWhileWatching = false;
    this.stageFailCount = 0;
  }

  // returns object: { pushedBack: boolean } to signal camera effect if applicable
  update(dt, nightNumber, currentHourString, isMonitorOpen, viewedCam, leftShield, triggerJumpscare, cameraSystem) {
    const aiLevel = this.getAILevel(nightNumber, currentHourString);
    // If monitor open, movement opportunities always fail
    if (isMonitorOpen) {
      // while being watched on his currentCam, track watch time for push-back on nights 4 & 5
      if (nightNumber >= 4 && this.stage > 0 && this.currentCam && viewedCam === this.currentCam && this.currentCam !== 'CAM_01') {
        this.watchTimer += dt;
        if (this.watchTimer >= 5000) {
          // push him back one stage
          const prevStage = Math.max(0, this.stage - 1);
          this.stage = prevStage;
          // set currentCam according to stage mapping
          this._stageToCam();
          this.watchTimer = 0;
          // camera effect requested
          return { pushedBack: true };
        }
      } else {
        this.watchTimer = 0;
      }
      // movement attempts fail if monitor open
      this.movementTimer = 0;
      return { pushedBack: false };
    }

    // If monitor was just closed and he's not in CAM_01, apply pause unless he is in CAM_01 (but that exception falters if you're watching CAM_01 or CAM_02)
    // Implementation: when monitor closed we set a pausedUntil if applicable. Here, check pausedUntil:
    if (this.pausedUntil > 0) {
      this.pauseTimer += dt;
      if (this.pauseTimer >= this.pausedUntil) {
        this.pausedUntil = 0;
        this.pauseTimer = 0;
      } else {
        return { pushedBack: false };
      }
    }

    this.movementTimer += dt;
    if (this.movementTimer < this.nextMoveInterval) return { pushedBack: false };

    // reset movementTimer and schedule next
    this.movementTimer = 0;
    this.nextMoveInterval = this._randInterval();

    // Chance calculation: floor(ai)/20
    const chance = Math.floor(aiLevel) / 20;

    // Second-to-last stage fail-safe:
    // If Josh is at stage 3 (the stage before leaving cameras) and has failed >4 times,
    // guarantee the next movement succeeds UNLESS the player is currently watching CAM_01.
    let forcedSuccess = false;
    if (this.stage === 3 && this.stageFailCount > 4 && viewedCam !== 'CAM_01') {
      forcedSuccess = true;
    }

    if (!forcedSuccess && Math.random() >= chance) {
      // movement failed
      if (this.stage === 3) {
        this.stageFailCount = (this.stageFailCount || 0) + 1;
      }
      return { pushedBack: false };
    }

    // movement succeeded -> reset fail counter if relevant
    if (this.stage === 3) {
      this.stageFailCount = 0;
    }

    // On success, advance stage sequence: 0->1->2->3->4 (leave cams)
    this.stage++;
    this._stageToCam();

    // If he left cameras (stage >=4), determine jumpscare logic or left-shield defense
    if (this.stage >= 4) {
      // On nights 4 & 5, he will skip 'leave cameras' and go straight to jumpscare unless leftShield is active
      if (nightNumber >= 4) {
        if (leftShield) {
          // bounce back to CAM_01 and restart cycle
          this.stage = 0;
          this.currentCam = 'CAM_01';
          this.nextMoveInterval = this._randInterval();
          return { pushedBack: false };
        } else {
          triggerJumpscare('josh');
          return { pushedBack: false };
        }
      }

      // regular nights: next movement opportunity (after leaving cameras) will jumpscare unless leftShield
      // we'll mark that he is off-camera by leaving currentCam null
      this.currentCam = null;
      // schedule a short pause before next movement unless he was in CAM_01 when monitor was closed (special pause rule)
      // (handled externally when monitor is toggled — main will set pausedUntil when monitor closed)
      return { pushedBack: false };
    }

    return { pushedBack: false };
  }

  // Called by main when monitor is closed to potentially pause Josh (rules described in prompt)
  applyMonitorClosedPause(isMonitorOpen, currentViewedCam) {
    // If Josh is in CAM_01, pause does NOT apply, except if the player is watching CAM_01 or CAM_02 — then the 'unless' falters and pause DOES apply.
    if (this.currentCam === 'CAM_01') {
      if (currentViewedCam === 'CAM_01' || currentViewedCam === 'CAM_02') {
        this.pausedUntil = this._randPause();
        this.pauseTimer = 0;
      } else {
        // no pause applied
        this.pausedUntil = 0;
        this.pauseTimer = 0;
      }
    } else {
      // normal pause applies
      this.pausedUntil = this._randPause();
      this.pauseTimer = 0;
    }
  }

  _stageToCam() {
    // mapping of stage -> camera
    // 0 => CAM_01, 1 => CAM_02, 2 => CAM_06, 3 => CAM_07
    if (this.stage === 0) this.currentCam = 'CAM_01';
    else if (this.stage === 1) this.currentCam = 'CAM_02';
    else if (this.stage === 2) this.currentCam = 'CAM_06';
    else if (this.stage === 3) this.currentCam = 'CAM_07';
    else this.currentCam = null;
  }
}