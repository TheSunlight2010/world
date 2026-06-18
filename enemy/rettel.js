export class Rettel {
  constructor(logicalW, logicalH) {
    this.logicalW = logicalW;
    this.logicalH = logicalH;

    // stages: 1 = CAM_03 (charging), 2 = DOOR_ATTACK (target door, timer active)
    this.stage = 1;
    this.currentCam = 'CAM_03';

    // AI progress / config
    this.progress = 0; // 0..500
    this.progressCap = 500;

    // movement / timing
    this._tickInterval = 750; // ms ticker for progress increments
    this._tickAccumulator = 0;

    // when player is watching CAM_03, progress halts; when they stop watching, pause for 4s
    this._watchPauseRemaining = 0; // ms pause after leaving CAM_03
    this._watching = false;

    // stage 2 attack
    this.attackTarget = null; // 'left' or 'right'
    this.attackTimer = 0; // ms remaining
    this.ATTACK_WINDOW_MS = 3000; // 3s to shield
    this.attackPaused = false; // paused when monitor open (on cameras)
    this.attackNeutralized = false; // true if correct door was shielded and we're waiting for timer to finish
  }

  getAILevel(nightNumber) {
    let baseAI = 0;
    if (nightNumber === 1) baseAI = 0;
    else if (nightNumber === 2) baseAI = 0;
    else if (nightNumber === 3) baseAI = 4;
    else if (nightNumber === 4) baseAI = 3;
    else if (nightNumber === 5) baseAI = 7;
    else baseAI = 7;
    if (typeof window !== 'undefined' && window.powerOut) baseAI = Math.min(20, baseAI + 5);
    return baseAI;
  }

  // external reset
  reset() {
    this.stage = 1;
    this.currentCam = 'CAM_03';
    this.progress = 0;
    this._tickAccumulator = 0;
    this._watchPauseRemaining = 0;
    this._watching = false;
    this.attackTarget = null;
    this.attackTimer = 0;
    this.attackPaused = false;
    this.attackNeutralized = false;
  }

  // call when monitor toggles or camera switches: notify whether CAM_03 is actively being viewed
  notifyWatchingCam3(isWatching) {
    if (isWatching) {
      // start watching: stop the post-watch pause and mark watching
      this._watchPauseRemaining = 0;
      this._watching = true;
    } else {
      // only begin the post-watch 4s pause if we were previously watching;
      // don't reset the pause every frame when the player remains not-watching.
      if (this._watching) {
        this._watchPauseRemaining = 4000;
      }
      this._watching = false;
    }
  }

  // call every tick
  update(dt, nightNumber, isMonitorOpen, currentViewedCam, leftShield, rightShield, triggerJumpscare, playElectrocuteSound, drainPowerCallback) {
    const ai = this.getAILevel(nightNumber);

    // Stage 1: charging on CAM_03
    if (this.stage === 1) {
      // If AI is 0 for nights 1-2: do nothing
      if (ai <= 0) return;

      // If monitor is open and player is viewing CAM_03, mark as watching and pause progress
      const isWatchingCam3 = isMonitorOpen && currentViewedCam === 'CAM_03';
      if (isWatchingCam3) {
        this.notifyWatchingCam3(true);
      } else {
        // If monitor open but not viewing CAM_03, it's equivalent to "not watching" so start post-watch pause if applicable
        if (this._watching) this.notifyWatchingCam3(false);
      }

      // Decrease any post-watch pause
      if (this._watchPauseRemaining > 0) {
        this._watchPauseRemaining = Math.max(0, this._watchPauseRemaining - dt);
        // while paused, do not accumulate tick
        return;
      }

      // If currently watching cam3, do not progress
      if (isWatchingCam3) return;

      // accumulate tick time
      this._tickAccumulator += dt;
      while (this._tickAccumulator >= this._tickInterval) {
        this._tickAccumulator -= this._tickInterval;

        // increment amount: random((AI-1)-0) + (random(0..60)/5)
        const a = Math.max(0, ai - 1);
        const partA = Math.random() * a; // random between 0 and (AI-1)
        const partB = (Math.random() * 60) / 5; // 0..12
        const inc = partA + partB;

        this.progress += inc;
        if (this.progress >= this.progressCap) {
          this.progress = this.progressCap;
          // advance to stage 2
          this.stage = 2;
          // select a random door target
          this.attackTarget = (Math.random() < 0.5) ? 'left' : 'right';
          this.attackTimer = this.ATTACK_WINDOW_MS;
          this.attackPaused = false;
          // break out — stage changed
          return;
        }
      }
    }

    // Stage 2: door attack - player has ATTACK_WINDOW_MS to shield target door
    else if (this.stage === 2) {
      // If monitor is open (on ANY camera), attack timer is normally paused.
      // However, if the correct door has already been shielded (attackNeutralized === true),
      // the timer should keep counting down even while the monitor is open so electrocution/drain still occurs.
      if (isMonitorOpen && !this.attackNeutralized) {
        this.attackPaused = true;
        return;
      } else {
        // If monitor closed or we are neutralized (so timer must run), resume timer state
        if (this.attackPaused) this.attackPaused = false;
      }

      // decrement timer while not paused
      this.attackTimer = Math.max(0, this.attackTimer - dt);

      // If time expired -> either perform neutralized defense or jumpscare
      if (this.attackTimer <= 0) {
        if (this.attackNeutralized) {
          // Shield had been engaged earlier — now finalize defense: electrocute and drain power
          try {
            if (playElectrocuteSound) playElectrocuteSound();
          } catch (e) {}
          const drainPct = Math.round(10 + (ai / 3));
          if (drainPowerCallback) drainPowerCallback(drainPct);

          // Reset back to stage 1 with progress zero
          this.stage = 1;
          this.currentCam = 'CAM_03';
          this.progress = 0;
          this._tickAccumulator = 0;
          this._watchPauseRemaining = 0;
          this._watching = false;
          this.attackTarget = null;
          this.attackTimer = 0;
          this.attackPaused = false;
          this.attackNeutralized = false;
          return;
        } else {
          // No shield in place when timer expired -> jumpscare
          triggerJumpscare('rettel');
          return;
        }
      }

      // If the correct door is shielded in time, mark neutralized and wait for timer to finish
      if (!this.attackNeutralized && ((this.attackTarget === 'left' && leftShield) || (this.attackTarget === 'right' && rightShield))) {
        // Shield engaged: mark neutralized and let the attackTimer count down to apply electrocution/drain at timeout
        this.attackNeutralized = true;
        // keep attackTarget for display; do not immediately resolve
        return;
      }
    }
  }
}