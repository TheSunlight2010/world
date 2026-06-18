export class Mannequin {
  constructor(logicalW, logicalH) {
    this.logicalW = logicalW;
    this.logicalH = logicalH;

    // stages: 1 = CAM_05, 2 = CAM_04, 3 = CAM_08, 4 = office (mannequin.png)
    this.stage = 1;
    this.currentCam = 'CAM_05';

    // movement timing (ms)
    this.moveTimer = 0;
    this.nextInterval = this._randInterval();

    // when in office (stage 4), timer/cooldown handled elsewhere if needed
    this.stageTimer = 0;

    // preload image src key
    this.officeImgSrc = 'mannequin.png';
  }

  _randInterval() {
    // seconds -> ms for random(4.5 - 10.0) — increased intervals to slow mannequin movement
    return (4.5 + Math.random() * (10.0 - 4.5)) * 1000;
  }

  reset() {
    this.stage = 1;
    this.currentCam = 'CAM_05';
    this.moveTimer = 0;
    this.nextInterval = this._randInterval();
    this.stageTimer = 0;
  }

  getAILevel(nightNumber) {
    let ai = 0;
    if (nightNumber === 1) ai = 0;
    else if (nightNumber === 2) ai = 2;
    else if (nightNumber === 3) ai = 5;
    else if (nightNumber === 4) ai = 5;
    else if (nightNumber === 5) ai = 12;
    else ai = 12;
    if (typeof window !== 'undefined' && window.powerOut) ai = Math.min(20, ai + 5);
    return ai;
  }

  // compute effective AI with hour adjustments and small per-night bump (except night 1)
  computeAI(nightNumber, currentHourString) {
    let ai = this.getAILevel(nightNumber);

    // "They also get an ai increase on every night except night 1." -> small +1 bump for nights >1
    if (nightNumber > 1) ai += 1;

    // Hour adjustments:
    if (currentHourString === '3AM' && nightNumber !== 5) ai += 3;
    if (currentHourString === '4AM' && nightNumber === 5) ai -= 6;
    if (currentHourString === '5AM') {
      if (nightNumber === 4 || nightNumber === 5) ai -= 1;
      else ai -= 3;
    }

    return Math.max(0, ai);
  }

  _stageToCam() {
    if (this.stage === 1) this.currentCam = 'CAM_05';
    else if (this.stage === 2) this.currentCam = 'CAM_04';
    else if (this.stage === 3) this.currentCam = 'CAM_08';
    else this.currentCam = null;
  }

  update(dt, nightNumber, currentHourString, isMonitorOpen, viewedCam, shadowInstance, rightShield, triggerJumpscare) {
    // Mannequin is inert on Night 1 and will never attempt movement
    if (nightNumber === 1) return { pushedBack: false };

    // If already in office (stage 4), nothing here (office handling external)
    if (this.stage === 4) return { pushedBack: false };

    // BLOCK: If Shadow is currently at stage 2 (at the doors), Mannequin cannot attempt any movement
    if (shadowInstance && shadowInstance.stage === 2) {
      return { pushedBack: false };
    }

    // Countdown to next movement opportunity
    this.moveTimer += dt;
    if (this.moveTimer < this.nextInterval) return { pushedBack: false };

    // Reset timer and schedule next
    this.moveTimer = 0;
    this.nextInterval = this._randInterval();

    const ai = this.computeAI(nightNumber, currentHourString);
    if (ai <= 0) return { pushedBack: false };

    // If on stage <3, normal movement chance; reduced success rate to slow overall progress (chance = ai/25)
    // If ai < 7, movement will fail if being watched on cameras or the camera its next state will be in.
    // Determine the next stage/cam
    let nextStage = Math.min(4, this.stage + 1);
    let nextCam = null;
    if (nextStage === 2) nextCam = 'CAM_04';
    else if (nextStage === 3) nextCam = 'CAM_08';
    else if (nextStage === 4) nextCam = null; // office

    // If ai < 7 then fail if being watched on cameras or the camera the next state will be in
    if (ai < 7) {
      if (isMonitorOpen) {
        // if player is watching current cam or nextCam, movement fails
        if (viewedCam === this.currentCam || (nextCam && viewedCam === nextCam)) {
          return { pushedBack: false };
        }
      }
    }

    // For stage 3 movement additional conditions:
    if (this.stage === 3) {
      // "Mannequin will not move if your monitor is off (this first condition is only for NOT shielding the right door),
      // if you're watching cams 5 or 8, or if Shadow is at the right door."
      if (!isMonitorOpen) return { pushedBack: false };
      if (viewedCam === 'CAM_05' || viewedCam === 'CAM_08') return { pushedBack: false };
      if (shadowInstance && shadowInstance.stage === 2 && shadowInstance.doorSide === 'right') return { pushedBack: false };
    }

    // Movement roll — lowered from ai/17 to ai/25 to make movements rarer (slows mannequin)
    const chance = ai / 25;
    if (Math.random() >= chance) {
      // failed movement
      return { pushedBack: false };
    }

    // Movement succeeded -> advance stage
    this.stage = nextStage;
    this._stageToCam();

    // If movement happened while the monitor is open, signal a camera switch-style effect
    // by returning pushedBack: true so main can trigger cameraSystem.switchBlipTime.
    const causedCameraEffect = !!isMonitorOpen;

    // If we moved into stage 4 (office), apply office logic:
    if (this.stage === 4) {
      // If right door shield active, it goes back to first stage instead of office
      if (rightShield) {
        this.stage = 1;
        this._stageToCam();
        // schedule a small delay before it can attempt again
        this.moveTimer = 0;
        this.nextInterval = 1200 + Math.random() * 1200;
      } else {
        // Became office entity; caller will display mannequin.png and enforce consequences
        triggerJumpscare?.('mannequin'); // optional: main's jumpscare handler will handle immediate death if desired
        // We just mark as office; don't trigger immediate kills here (main can handle office timing)
      }
    }

    return { pushedBack: causedCameraEffect };
  }

  // Externally callable removal/reset if player flips monitor up or otherwise removes entity from office
  removeIfVisible() {
    if (this.stage === 4) {
      this.stage = 1;
      this.currentCam = 'CAM_05';
      this.moveTimer = 0;
      this.nextInterval = this._randInterval();
    }
  }
}