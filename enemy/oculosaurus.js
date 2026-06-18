export class Oculosaurus {
  constructor(logicalW, logicalH) {
    this.logicalW = logicalW;
    this.logicalH = logicalH;

    // 0 = inactive, 1 = present on camera
    this.stage = 0;
    this.currentCam = null;

    // life timer in frames (we'll track in fractional frames using ms -> frames conversion)
    this.frameCounter = 0;

    // preload image
    this.camImg = new Image();
    this.camImg.src = 'oculosaurus_camera.png';
  }

  getAILevel(nightNumber) {
    if (nightNumber === 1) return 0;
    if (nightNumber === 2) return 2;
    if (nightNumber === 3) return 5;
    if (nightNumber === 4) return 5;
    if (nightNumber === 5) return 7;
    const base = 7;
    if (typeof window !== 'undefined' && window.powerOut) return Math.min(20, base + 5);
    return base;
  }

  // Called when player switches cameras; there's an AI/30 chance to appear on the camera just switched to
  onCameraSwitch(targetCam, nightNumber) {
    const ai = this.getAILevel(nightNumber);
    if (ai <= 0) return;
    if (Math.random() * 30 < ai) {
      this.stage = 1;
      this.currentCam = targetCam;
      this.frameCounter = 0;
    }
  }

  // Called when monitor closed or camera changed to remove it if applicable
  removeIfVisible() {
    if (this.stage === 1) {
      this.stage = 0;
      this.currentCam = null;
      this.frameCounter = 0;
    }
  }

  // dt in ms, framesPerSecond ~ 60 -> 1 frame == 1000/60 ms
  update(dt, nightNumber, isMonitorOpen, currentViewedCam, triggerJumpscare) {
    if (this.stage !== 1) return;

    // If player turns monitor off or switches away from the camera where Oculosaurus is, it's removed
    if (!isMonitorOpen || (isMonitorOpen && currentViewedCam !== this.currentCam)) {
      // The rules stated: "You must turn off the monitor or switch cameras to get rid of it."
      // If the player switched to another camera, or monitor turned off, remove it:
      this.removeIfVisible();
      return;
    }

    // accumulate frames
    const framesThisTick = dt / (1000 / 60);
    this.frameCounter += framesThisTick;

    const ai = this.getAILevel(nightNumber);
    const timeoutFrames = Math.max(1, Math.floor(200 - (2 * ai / 2)));
    if (this.frameCounter >= timeoutFrames) {
      // Trigger jumpscare if still present
      triggerJumpscare('oculosaurus');
      // ensure it's cleared
      this.removeIfVisible();
    }
  }
}