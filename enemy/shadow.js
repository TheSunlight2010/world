export class Shadow {
  constructor(logicalW, logicalH) {
    this.logicalW = logicalW;
    this.logicalH = logicalH;
    
    // Core state tracking
    this.stage = 0; // 0 = inactive, 1 = on camera, 2 = at door
    this.currentCam = null; // 'CAM_07' or 'CAM_08'
    this.doorSide = null; // 'left' or 'right'
    
    // Timing accumulation for AI ticks
    this.movementTimer = 0;

    // Count consecutive failed movement opportunities while at stage 2
    this.stage2FailCount = 0;
    
    // Audio asset collections
    this.laughs = [];
    this.preloadAudio();
  }

  preloadAudio() {
    // Preload all 10 laugh variations
    for (let i = 1; i <= 10; i++) {
      const audio = new Audio(`shadowLaugh_${i}.wav`);
      audio.preload = 'auto';
      audio.volume = 0.40; // Set to 40% volume exactly
      this.laughs.push(audio);
    }
  }

  reset() {
    this.stage = 0;
    this.currentCam = null;
    this.doorSide = null;
    this.movementTimer = 0;
    this.stage2FailCount = 0;
  }

  getAILevel(nightNumber, currentHourString) {
    // Determine baseline AI per night requirements
    let baseAI = 0;
    if (nightNumber === 1) baseAI = 0;
    else if (nightNumber === 2) baseAI = 3;
    else if (nightNumber === 3) baseAI = 1;
    else if (nightNumber === 4) baseAI = 4;
    else if (nightNumber === 5) baseAI = 10;
    else if (nightNumber > 5) baseAI = 10;

    // Apply incremental hour updates
    if (currentHourString === '1AM') baseAI += 2;
    if (currentHourString === '2AM' && (nightNumber === 4 || nightNumber === 5)) baseAI += 2;
    if (currentHourString === '3AM') baseAI += 1;

    if (typeof window !== 'undefined' && window.powerOut) baseAI = Math.min(20, baseAI + 5);
    return baseAI;
  }

  playRandomLaughAndExecute(callback) {
    const randomIndex = Math.floor(Math.random() * this.laughs.length);
    const laugh = this.laughs[randomIndex];
    
    laugh.currentTime = 0;
    laugh.play().catch(() => {});
    // Fire structural callback synchronization hooks
    callback();
  }

  update(dt, nightNumber, currentHourString, isMonitorOpen, viewedCam, leftShield, rightShield, triggerJumpscare) {
    const aiLevel = this.getAILevel(nightNumber, currentHourString);
    if (aiLevel <= 0) return; // Freeze roaming processing if AI remains 0

    this.movementTimer += dt;

    // --- STAGE 0: INACTIVE BACKGROUND ROAMING ---
    if (this.stage === 0) {
      if (this.movementTimer >= 3850) { // Every 3.85 seconds
        this.movementTimer = 0;
        
        // Only block spawning while the player is actively watching CAM_07 or CAM_08.
        // (Previously this required the monitor to be fully closed.)
        const watchingHallCams = isMonitorOpen && (viewedCam === 'CAM_07' || viewedCam === 'CAM_08');
        if (!watchingHallCams) {
          if (Math.random() * 25 < aiLevel) {
            // If Mannequin is active in office (stage 4), Shadow must never spawn on CAM_08
            let targetCam;
            try {
              if (window.gameMannequinInstance && window.gameMannequinInstance.stage === 4) {
                targetCam = 'CAM_07';
              } else {
                targetCam = Math.random() < 0.5 ? 'CAM_07' : 'CAM_08';
              }
            } catch (e) {
              targetCam = Math.random() < 0.5 ? 'CAM_07' : 'CAM_08';
            }

            this.playRandomLaughAndExecute(() => {
              this.stage = 1;
              this.currentCam = targetCam;
            });
          }
        }
      }
    }
    
    // --- STAGE 1: SPOTTED STANDING ON CORRIDOR CAMERAS ---
    else if (this.stage === 1) {
      if (this.movementTimer >= 10000) { // Every 10 seconds
        this.movementTimer = 0;
        
        // Fails if you actively view their exact terminal positioning location
        const beingWatched = isMonitorOpen && (viewedCam === this.currentCam);
        if (!beingWatched) {
          // Use a larger roll range once AI surpasses 6 (makes success comparatively rarer per-roll)
          const chanceBase = aiLevel > 6 ? 30 : 10;
          if (Math.random() * chanceBase < aiLevel) {
            const side = (this.currentCam === 'CAM_07') ? 'left' : 'right';
            this.playRandomLaughAndExecute(() => {
              // If the move would go to the right door but Mannequin is currently in the office (stage 4),
              // cancel the door approach and reset Shadow back to stage 1 (on CAM_07).
              try {
                if (side === 'right' && window.gameMannequinInstance && window.gameMannequinInstance.stage === 4) {
                  this.stage = 1;
                  this.currentCam = 'CAM_07';
                  this.doorSide = null;
                  return;
                }
              } catch (e) {}
              
              this.stage = 2;
              this.doorSide = side;
              this.currentCam = null;
            });
          }
        }
      }
    }
    
    // --- STAGE 2: STANDING IMMEDIATELY OUTSIDE THE OFFICE DOORS ---
    else if (this.stage === 2) {
      const checkInterval = (aiLevel < 10) ? 5000 : 2500; // 5s under AI level 10, else 2.5s
      
      if (this.movementTimer >= checkInterval) {
        this.movementTimer = 0;
        
        // Determine whether this movement attempt should succeed.
        // If Shadow has failed 5 times in a row at stage 2, force success this attempt.
        let rollSuccess = false;
        if (this.stage2FailCount >= 5) {
          rollSuccess = true;
        } else {
          rollSuccess = (Math.random() * 20 < aiLevel);
        }

        if (rollSuccess) {
          // reset fail counter on a successful roll
          this.stage2FailCount = 0;

          const shieldActive = (this.doorSide === 'left') ? leftShield : rightShield;
          
          if (shieldActive) {
            // Defended successfully; bounce enemy back to clean loop cycle
            this.stage = 0;
            this.doorSide = null;
          } else {
            // Caught unguarded; engage jumpscare framework transition (signal caller that Shadow caused it)
            triggerJumpscare('shadow');
          }
        } else {
          // Count consecutive failures while at stage 2
          this.stage2FailCount = (this.stage2FailCount || 0) + 1;
        }
      }
    }
  }
}