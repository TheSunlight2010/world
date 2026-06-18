export class CameraSystem {
  constructor(logicalW, logicalH) {
    this.logicalW = logicalW;
    this.logicalH = logicalH;
    this.isOpen = false;
    this.currentCam = 'CAM_01';
    this.previousCam = 'CAM_01';

    this.cameras = {
      'CAM_01': { name: 'Main Entrance', code: 'CAM 01' },
      'CAM_02': { name: 'North Hallway', code: 'CAM 02' },
      'CAM_03': { name: 'Supply Closet', code: 'CAM 03' },
      'CAM_04': { name: 'East Hallway Entrance', code: 'CAM 04' },
      'CAM_05': { name: 'Ventilation Hub', code: 'CAM 05' },
      'CAM_06': { name: 'West Hallway Entrance', code: 'CAM 06' },
      'CAM_07': { name: 'West Hallway', code: 'CAM 07' },
      'CAM_08': { name: 'East Hallway', code: 'CAM 08' },
      'CAM_09': { name: "Prize Corner", code: 'CAM 09' },
    };

    // Preload Camera Enemy Images
    this.shadowCam7Img = new Image();
    this.shadowCam7Img.src = 'shadow_cam7.png';
    this.shadowCam8Img = new Image();
    this.shadowCam8Img.src = 'shadow_cam8.png';

    // Mannequin camera overlays (renders in front of Shadow when mannequin is present)
    this.mannequinCam5Img = new Image();
    this.mannequinCam5Img.src = 'mannequin_cam5.png';
    this.mannequinCam4Img = new Image();
    this.mannequinCam4Img.src = 'mannequin_cam4.png';
    this.mannequinCam8Img = new Image();
    this.mannequinCam8Img.src = 'mannequin_cam8.png';

    // Josh camera images (same sizing/positioning as Shadow)
    this.joshCam1Img = new Image();
    this.joshCam1Img.src = 'josh_cam1.png';
    this.joshCam2Img = new Image();
    this.joshCam2Img.src = 'josh_cam2.png';
    this.joshCam6Img = new Image();
    this.joshCam6Img.src = 'josh_cam6.png';
    this.joshCam7Img = new Image();
    this.joshCam7Img.src = 'josh_cam7.png';

    // Oculosaurus camera overlay
    this.oculoImg = new Image();
    this.oculoImg.src = 'oculosaurus_camera.png';

    // Rettel CAM_03 overlay
    this.rettelCam3Img = new Image();
    this.rettelCam3Img.src = 'rettel_cam3.png';

    // Preload simple monitor/camera sounds
    this.monitorOpen = new Audio('monitor_open.mp3');
    this.monitorOpen.preload = 'auto';
    // Increase volume by ~65% (clamped to 1.0)
    this.monitorOpen.volume = 1.0;

    this.monitorClose = new Audio('monitor_close.mp3');
    this.monitorClose.preload = 'auto';
    // Increase volume by ~65% (clamped to 1.0)
    this.monitorClose.volume = 1.0;

    this.camSwitch = new Audio('cam_switch.mp3');
    this.camSwitch.preload = 'auto';
    this.camSwitch.volume = 0.85;

    // Mini-map layout
    this.mapW = 260;
    this.mapH = 240;
    this.mapX = this.logicalW - (this.mapW + 20);
    this.mapY = this.logicalH - (this.mapH + 50);

    this.buttons = {
      'CAM_01': { x: this.mapX + 100, y: this.mapY + 15, w: 60, h: 22 },
      'CAM_02': { x: this.mapX + 100, y: this.mapY + 55, w: 60, h: 22 },
      'CAM_03': { x: this.mapX + 185, y: this.mapY + 55, w: 60, h: 22 },
      'CAM_06': { x: this.mapX + 15, y: this.mapY + 105, w: 60, h: 22 },
      'CAM_07': { x: this.mapX + 15, y: this.mapY + 155, w: 60, h: 22 },
      'CAM_04': { x: this.mapX + 185, y: this.mapY + 105, w: 60, h: 22 },
      'CAM_05': { x: this.mapX + 105, y: this.mapY + 130, w: 60, h: 22 },
      'CAM_09': { x: this.mapX + 15, y: this.mapY + 55, w: 60, h: 22 }, // Coinman's Shop (left of CAM_02, same row as CAM_03)
      'CAM_08': { x: this.mapX + 185, y: this.mapY + 155, w: 60, h: 22 },
    };

    this.flipBtn = {
      x: this.logicalW / 2 - 150,
      y: this.logicalH - 30,
      w: 300,
      h: 25
    };

    this.lastFlip = 0;
    this.flipCooldown = 600;
    this.switchBlipTime = 0;
  }

  toggle() {
    this.isOpen = !this.isOpen;

    // Play open/close sound immediately on state change
    try {
      if (this.isOpen) {
        if (this.monitorOpen) { this.monitorOpen.currentTime = 0; this.monitorOpen.play().catch(()=>{}); }
        this.switchBlipTime = 12;
      } else {
        if (this.monitorClose) { this.monitorClose.currentTime = 0; this.monitorClose.play().catch(()=>{}); }
      }
    } catch (e) {}

  }

  handleMouseClick(clickX, clickY, started) {
    if (!started) return false;
    const now = Date.now();

    if (
      clickX >= this.flipBtn.x && clickX <= this.flipBtn.x + this.flipBtn.w &&
      clickY >= this.flipBtn.y && clickY <= this.flipBtn.y + this.flipBtn.h
    ) {
      if (now - this.lastFlip < this.flipCooldown) return true;
      this.lastFlip = now;
      this.toggle();
      return true;
    }

    if (this.isOpen) {
      for (const [camId, bounds] of Object.entries(this.buttons)) {
        if (
          clickX >= bounds.x && clickX <= bounds.x + bounds.w &&
          clickY >= bounds.y && clickY <= bounds.y + bounds.h
        ) {
          if (this.currentCam !== camId) {
            this.previousCam = this.currentCam;
            this.currentCam = camId;
            this.switchBlipTime = 8;
            // play a quick camera switch blip
            try {
              if (this.camSwitch) { this.camSwitch.currentTime = 0; this.camSwitch.play().catch(()=>{}); }
            } catch (e) {}
          }
          return true;
        }
      }
    }
    return false;
  }

  drawWireframeRoom(ctx, vanishX, vanishY, backX, backY, backW, backH) {
    ctx.strokeStyle = '#1b3d2b';
    ctx.lineWidth = 1.5;

    ctx.fillStyle = '#08140f';
    ctx.fillRect(backX, backY, backW, backH);
    ctx.strokeRect(backX, backY, backW, backH);

    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(backX, backY);
    ctx.moveTo(this.logicalW, 0); ctx.lineTo(backX + backW, backY);
    ctx.moveTo(0, this.logicalH); ctx.lineTo(backX, backY + backH);
    ctx.moveTo(this.logicalW, this.logicalH); ctx.lineTo(backX + backW, backY + backH);
    ctx.stroke();
  }

  render3DScene(ctx) {
    const time = Date.now();
    ctx.save();

    ctx.fillStyle = '#030a06';
    ctx.fillRect(0, 0, this.logicalW, this.logicalH);

    switch (this.currentCam) {
      case 'CAM_01':
        this.drawWireframeRoom(ctx, this.logicalW / 2, 200, 312, 120, 400, 220);
        ctx.strokeStyle = '#285e3d';
        ctx.strokeRect(362, 120, 140, 220);
        ctx.strokeRect(522, 120, 140, 220);
        for (let i = 0; i <= 6; i++) {
          let y = 340 + i * 35;
          ctx.beginPath();
          ctx.moveTo(312 - i * 50, y);
          ctx.lineTo(712 + i * 50, y);
          ctx.stroke();
        }

        // Josh CAM_01 overlay
        if (window.gameJoshInstance && window.gameJoshInstance.stage >= 0 && window.gameJoshInstance.currentCam === 'CAM_01') {
          ctx.drawImage(this.joshCam1Img, 0, 0, this.logicalW, this.logicalH);
        }
        break;

      case 'CAM_02':
        this.drawWireframeRoom(ctx, this.logicalW / 2, 240, 412, 180, 200, 150);
        ctx.strokeStyle = '#225235';
        ctx.beginPath();
        ctx.moveTo(432, 180); ctx.lineTo(350, 0);
        ctx.moveTo(592, 180); ctx.lineTo(674, 0);
        ctx.moveTo(412, 330); ctx.lineTo(412, 180);
        ctx.lineTo(250, 576); ctx.moveTo(612, 330);
        ctx.lineTo(612, 180); ctx.lineTo(774, 576);
        ctx.stroke();

        // Josh CAM_02 overlay
        if (window.gameJoshInstance && window.gameJoshInstance.stage >= 0 && window.gameJoshInstance.currentCam === 'CAM_02') {
          ctx.drawImage(this.joshCam2Img, 0, 0, this.logicalW, this.logicalH);
        }
        break;

      case 'CAM_03': {
        // If Rettel is charging on CAM_03 and progress > 100, apply a subtle camera shake
        const rettel = window.gameRettelInstance;
        let applyShake = false;
        let shakeX = 0;
        let shakeY = 0;
        if (rettel && rettel.stage === 1 && rettel.currentCam === 'CAM_03' && typeof rettel.progress === 'number' && rettel.progress > 100) {
          applyShake = true;
          // progress >100 => start shake; scale intensity with progress up to a cap
          const p = Math.max(0, rettel.progress - 100); // 0..400
          // Map p (0..400) to intensity (0..12)
          const intensity = Math.min(12, (p / 400) * 12);
          // time-based jitter for smooth shaking
          const t = Date.now();
          // Add a little randomness so intensity grows when progress jumps
          const randomJitter = (Math.sin(t / 37) + Math.cos(t / 53)) * 0.35;
          shakeX = Math.sin(t / 80) * (intensity * 0.9) + randomJitter;
          shakeY = Math.cos(t / 70) * (intensity * 0.6) + randomJitter * 0.6;
        }

        if (applyShake) ctx.save();
        if (applyShake) ctx.translate(shakeX, shakeY);

        this.drawWireframeRoom(ctx, 250, 200, 150, 100, 300, 300);
        ctx.strokeStyle = '#32734b';
        ctx.fillStyle = 'rgba(15, 43, 27, 0.4)';
        ctx.beginPath();
        ctx.moveTo(450, 100); ctx.lineTo(this.logicalW - 100, 20);
        ctx.lineTo(this.logicalW - 100, 500); ctx.lineTo(450, 400);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        for (let s = 1; s <= 4; s++) {
          let hY1 = 100 + s * 60;
          let hY2 = 20 + s * 95;
          ctx.beginPath();
          ctx.moveTo(450, hY1); ctx.lineTo(this.logicalW - 100, hY2);
          ctx.stroke();
        }

        // Rettel overlay: render when Rettel is in charging stage and present on CAM_03
        if (window.gameRettelInstance && window.gameRettelInstance.stage === 1 && window.gameRettelInstance.currentCam === 'CAM_03') {
          try {
            ctx.drawImage(this.rettelCam3Img, 0, 0, this.logicalW, this.logicalH);
          } catch (e) {}
        }

        if (applyShake) ctx.restore();
        break;
      }

      case 'CAM_04':
        this.drawWireframeRoom(ctx, 800, 220, 550, 140, 260, 200);
        ctx.strokeStyle = '#225235';
        ctx.fillStyle = '#060f0b';
        ctx.beginPath();
        ctx.moveTo(0, 80); ctx.lineTo(550, 140);
        ctx.lineTo(550, 340); ctx.lineTo(0, 540);
        ctx.closePath();
        ctx.fill(); ctx.stroke();

        // Mannequin CAM_04 overlay (render when mannequin is staged on CAM_04)
        if (window.gameMannequinInstance && window.gameMannequinInstance.stage === 2 && window.gameMannequinInstance.currentCam === 'CAM_04') {
          try {
            ctx.drawImage(this.mannequinCam4Img, 0, 0, this.logicalW, this.logicalH);
          } catch (e) {}
        }
        break;

      case 'CAM_05':
        this.drawWireframeRoom(ctx, this.logicalW / 2, this.logicalH / 2, 362, 138, 300, 300);
        ctx.strokeStyle = '#3b8756';
        ctx.beginPath();
        ctx.arc(512, 288, 110, 0, Math.PI * 2);
        ctx.stroke();
        let angle = (time / 260);
        for (let b = 0; b < 4; b++) {
          ctx.beginPath();
          ctx.moveTo(512, 288);
          let bAngle = angle + (b * Math.PI / 2);
          ctx.lineTo(512 + Math.cos(bAngle) * 105, 288 + Math.sin(bAngle) * 105);
          ctx.lineWidth = 4;
          ctx.stroke();
        }
        ctx.lineWidth = 1.5;

        // Mannequin CAM_05 overlay (render when mannequin is staged on CAM_05)
        if (window.gameMannequinInstance && window.gameMannequinInstance.stage === 1 && window.gameMannequinInstance.currentCam === 'CAM_05') {
          try {
            ctx.drawImage(this.mannequinCam5Img, 0, 0, this.logicalW, this.logicalH);
          } catch (e) {}
        }
        break;

      case 'CAM_06':
        this.drawWireframeRoom(ctx, 220, 220, 212, 140, 260, 200);
        ctx.strokeStyle = '#225235';
        ctx.fillStyle = '#060f0b';
        ctx.beginPath();
        ctx.moveTo(this.logicalW, 80); ctx.lineTo(472, 140);
        ctx.lineTo(472, 340); ctx.lineTo(this.logicalW, 540);
        ctx.closePath();
        ctx.fill(); ctx.stroke();

        // Josh CAM_06 overlay
        if (window.gameJoshInstance && window.gameJoshInstance.stage >= 0 && window.gameJoshInstance.currentCam === 'CAM_06') {
          ctx.drawImage(this.joshCam6Img, 0, 0, this.logicalW, this.logicalH);
        }
        break;

      case 'CAM_07':
        // Base room (mirrored)
        ctx.save();
        ctx.translate(this.logicalW, 0);
        ctx.scale(-1, 1);
        this.drawWireframeRoom(ctx, 874, 300, 724, 50, 220, 400);
        ctx.strokeStyle = '#439c63';
        ctx.fillStyle = 'rgba(100, 20, 20, 0.15)';
        ctx.beginPath();
        ctx.moveTo(724, 50); ctx.lineTo(0, 0);
        ctx.lineTo(0, this.logicalH); ctx.lineTo(724, 450);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.restore();

        // Draw Shadow overlay first (background layer)
        if (window.gameShadowInstance && window.gameShadowInstance.stage === 1 && window.gameShadowInstance.currentCam === 'CAM_07') {
          ctx.drawImage(this.shadowCam7Img, 0, 0, this.logicalW, this.logicalH);
        }

        // Draw Josh overlay after Shadow so Josh appears in front when both are present
        if (window.gameJoshInstance && window.gameJoshInstance.stage >= 0 && window.gameJoshInstance.currentCam === 'CAM_07') {
          ctx.drawImage(this.joshCam7Img, 0, 0, this.logicalW, this.logicalH);
        }
        break;

      case 'CAM_08':
        this.drawWireframeRoom(ctx, 874, 300, 724, 50, 220, 400);
        ctx.strokeStyle = '#439c63';
        ctx.fillStyle = 'rgba(100, 20, 20, 0.15)';
        ctx.beginPath();
        ctx.moveTo(724, 50); ctx.lineTo(0, 0);
        ctx.lineTo(0, this.logicalH); ctx.lineTo(724, 450);
        ctx.closePath();
        ctx.fill(); ctx.stroke();

        if (window.gameShadowInstance && window.gameShadowInstance.stage === 1 && window.gameShadowInstance.currentCam === 'CAM_08') {
          ctx.drawImage(this.shadowCam8Img, 0, 0, this.logicalW, this.logicalH);
        }

        // Draw Mannequin overlay in front of Shadow when Mannequin is present on CAM_08
        if (window.gameMannequinInstance && window.gameMannequinInstance.stage === 3 && window.gameMannequinInstance.currentCam === 'CAM_08') {
          try {
            ctx.drawImage(this.mannequinCam8Img, 0, 0, this.logicalW, this.logicalH);
          } catch (e) {}
        }
        break;

      case 'CAM_09': {
        // 1. Draw the base wireframe room (Vanish point, Back wall bounds)
        // Back wall is smaller and slightly offset to give room depth
        this.drawWireframeRoom(ctx, this.logicalW / 2, 220, 340, 140, 344, 220);
        ctx.strokeStyle = '#225235'; // Default dark green matching room lines

        // 2. Left Wall: The Vent System
        // Draw a dark background for the vent opening
        ctx.fillStyle = '#050d0a';
        ctx.beginPath();
        ctx.moveTo(80, 180);  ctx.lineTo(200, 200);
        ctx.lineTo(200, 340); ctx.lineTo(80, 360);
        ctx.closePath();
        ctx.fill();
        
        // Vent outer frame
        ctx.strokeStyle = '#3b8756'; // Brighter green for interactive/important areas
        ctx.lineWidth = 2;
        ctx.stroke();

        // Vent inner horizontal slats/grates
        ctx.lineWidth = 1;
        for (let i = 1; i <= 6; i++) {
          let ratio = i / 7;
          let topY = 180 + (200 - 180) * ratio;
          let botY = 360 + (340 - 360) * ratio;
          ctx.beginPath();
          ctx.moveTo(80 + (200 - 80) * ratio, topY);
          ctx.lineTo(80 + (200 - 80) * ratio, botY);
          ctx.stroke();
        }
        ctx.lineWidth = 1.5; // Reset line width

        // 3. Right Side: The Cashier Stand
        ctx.strokeStyle = '#285e3d';
        ctx.fillStyle = '#0a1a13';
        
        // Counter top (Isometric quadrilateral)
        ctx.beginPath();
        ctx.moveTo(600, 290); ctx.lineTo(850, 330);
        ctx.lineTo(750, 420); ctx.lineTo(540, 360);
        ctx.closePath();
        ctx.fill(); ctx.stroke();

        // Counter front/sides base legs
        ctx.beginPath();
        ctx.moveTo(540, 360); ctx.lineTo(540, 500);
        ctx.moveTo(750, 420); ctx.lineTo(750, 550);
        ctx.moveTo(850, 330); ctx.lineTo(850, 470);
        ctx.stroke();

        // Cash Register (Box on top of the counter)
        ctx.fillStyle = '#102b1f';
        ctx.strokeRect(620, 270, 40, 30); // Register body
        ctx.beginPath(); // Register screen angle
        ctx.moveTo(630, 270); ctx.lineTo(625, 250);
        ctx.lineTo(655, 250); ctx.lineTo(650, 270);
        ctx.closePath();
        ctx.fill(); ctx.stroke();

        // 4. Back Wall: Shelves & Abstract Plushies
        ctx.strokeStyle = '#1b3d2b';
        // Shelf lines
        ctx.strokeRect(380, 180, 260, 10);  // Top shelf row
        ctx.strokeRect(380, 230, 260, 10);  // Bottom shelf row

        // Draw Abstract Wireframe Plushies on shelves
        ctx.strokeStyle = '#32734b';
        
        // Plushie 1 (Left top shelf - Blocky Bear/Coin Shape)
        ctx.strokeRect(400, 145, 30, 35); // Head/Body
        ctx.beginPath(); ctx.arc(405, 145, 5, 0, Math.PI * 2); ctx.stroke(); // Left ear
        ctx.beginPath(); ctx.arc(425, 145, 5, 0, Math.PI * 2); ctx.stroke(); // Right ear

        // Plushie 2 (Right top shelf - Simple round creature)
        ctx.beginPath();
        ctx.arc(580, 160, 15, 0, Math.PI * 2);
        ctx.stroke();

        // Plushie 3 (Middle bottom shelf - Dino/Monster outline)
        ctx.strokeRect(495, 205, 25, 25); // Main body
        ctx.beginPath(); // Tail
        ctx.moveTo(495, 225); ctx.lineTo(480, 220); ctx.lineTo(495, 210);
        ctx.stroke();

        // 5. Floor perspective grid lines (to match CAM_01 aesthetic)
        ctx.strokeStyle = '#153022';
        for (let i = 0; i <= 4; i++) {
          let xOffset = i * 60;
          ctx.beginPath();
          ctx.moveTo(340 + xOffset, 360);
          ctx.lineTo(200 + (xOffset * 0.4), this.logicalH);
          ctx.stroke();
        }

        // 6. Future Enemy Hooks (Example placeholder for rendering logic)
        // If an enemy like Josh or Shadow comes to the shop, draw them here:
        if (window.gameCoinmanInstance && window.gameCoinmanInstance.currentCam === 'CAM_09') {
          // ctx.drawImage(this.coinmanCam9Img, 0, 0, this.logicalW, this.logicalH);
        }

        break;
      }
    }



    ctx.restore();
  }

  render(ctx) {
    ctx.save();
    const now = Date.now();
    const since = now - this.lastFlip;
    const remaining = Math.max(0, this.flipCooldown - since);
    const cooling = remaining > 0;

    if (!this.isOpen) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 2;
      ctx.fillStyle = cooling ? 'rgba(255,255,255,0.06)' : 'rgba(255, 255, 255, 0.15)';
      ctx.beginPath();
      ctx.roundRect?.(this.flipBtn.x, this.flipBtn.y, this.flipBtn.w, this.flipBtn.h, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = cooling ? 'rgba(255,255,255,0.6)' : '#fff';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      if (cooling) {
        ctx.fillText(`COOLDOWN ${(remaining / 1000).toFixed(1)}s`, this.logicalW / 2, this.flipBtn.y + 16);
      } else {
        ctx.fillText('▲ OPEN MONITOR ▲', this.logicalW / 2, this.flipBtn.y + 16);
      }
      ctx.restore();
      return;
    }

    this.render3DScene(ctx);

    // Draw Oculosaurus behind the minimap/UI so the camera map and buttons appear in front
    if (window.gameOculoInstance && window.gameOculoInstance.stage === 1 && window.gameOculoInstance.currentCam === this.currentCam) {
      try {
        ctx.drawImage(this.oculoImg, 0, 0, this.logicalW, this.logicalH);
      } catch (e) {}
    }

    ctx.save();
    // VHS Scanlines overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    for (let i = 0; i < this.logicalH; i += 4) {
      if (Math.floor((i + Date.now() / 40) % 8) < 2) {
        ctx.fillRect(0, i, this.logicalW, 2);
      }
    }



    if (Math.random() > 0.985) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fillRect(0, Math.random() * this.logicalH, this.logicalW, Math.random() * 40);
    }

    // Recording Dot
    ctx.fillStyle = '#ff3b30';
    if (Math.floor(Date.now() / 500) % 2 === 0) {
      ctx.beginPath();
      ctx.arc(50, 40, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Metadata Text
    ctx.fillStyle = '#fff';
    ctx.font = '20px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`REC`, 70, 47);
    ctx.fillText(this.cameras[this.currentCam].code + ' - ' + this.cameras[this.currentCam].name, 40, 85);

    // --- DRAW MINIMAP SYSTEM ---
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.fillRect(this.mapX, this.mapY, this.mapW, this.mapH);
    ctx.strokeRect(this.mapX, this.mapY, this.mapW, this.mapH);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(this.mapX + 130, this.mapY + 26);
    ctx.lineTo(this.mapX + 130, this.mapY + 66);
    ctx.lineTo(this.mapX + 185, this.mapY + 66);
    ctx.moveTo(this.mapX + 130, this.mapY + 66);
    ctx.lineTo(this.mapX + 130, this.mapY + 90);

    // Connect CAM_09 (left) to CAM_02 (center) with a short horizontal path
    // CAM_09 center: this.mapX + 15 + 30 = this.mapX + 45
    // CAM_02 center: this.mapX + 100 + 30 = this.mapX + 130
    ctx.moveTo(this.mapX + 45, this.mapY + 66);
    ctx.lineTo(this.mapX + 130, this.mapY + 66);

    ctx.moveTo(this.mapX + 130, this.mapY + 90);
    ctx.lineTo(this.mapX + 45, this.mapY + 90);
    ctx.lineTo(this.mapX + 45, this.mapY + 215);
    ctx.lineTo(this.mapX + 105, this.mapY + 215);
    ctx.moveTo(this.mapX + 130, this.mapY + 90);
    ctx.lineTo(this.mapX + 215, this.mapY + 90);
    ctx.lineTo(this.mapX + 215, this.mapY + 215);
    ctx.lineTo(this.mapX + 155, this.mapY + 215);
    ctx.moveTo(this.mapX + 215, this.mapY + 116);
    ctx.lineTo(this.mapX + 135, this.mapY + 116);
    ctx.lineTo(this.mapX + 135, this.mapY + 130);
    ctx.stroke();

    // PLAYER NODE
    ctx.fillStyle = '#1a1a1a';
    ctx.strokeStyle = '#00ffcc';
    ctx.lineWidth = 2;
    ctx.fillRect(this.mapX + 105, this.mapY + 200, 50, 30);
    ctx.strokeRect(this.mapX + 105, this.mapY + 200, 50, 30);

    ctx.fillStyle = '#00ffcc';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('YOU', this.mapX + 130, this.mapY + 218);

    // INTERACTIVE CAMERA BUTTONS
    for (const [camId, bounds] of Object.entries(this.buttons)) {
      const isSelected = (this.currentCam === camId);
      ctx.fillStyle = isSelected ? '#2e7d32' : '#151515';
      ctx.strokeStyle = isSelected ? '#fff' : '#777';
      ctx.lineWidth = 1.5;
      ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
      ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);

      ctx.fillStyle = isSelected ? '#fff' : '#ccc';
      ctx.font = '9px monospace';
      ctx.fillText(this.cameras[camId].code, bounds.x + bounds.w / 2, bounds.y + bounds.h / 2 + 3);
    }



    ctx.restore();

    // Foreground control button overlay
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.fillStyle = cooling ? 'rgba(0, 120, 60, 0.12)' : 'rgba(0, 255, 100, 0.2)';
    ctx.beginPath();
    ctx.roundRect?.(this.flipBtn.x, this.flipBtn.y, this.flipBtn.w, this.flipBtn.h, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = cooling ? 'rgba(255,255,255,0.6)' : '#fff';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    if (cooling) {
      ctx.fillText(this.isOpen ? `WAIT ${(remaining / 1000).toFixed(1)}s` : `COOLDOWN ${(remaining / 1000).toFixed(1)}s`, this.logicalW / 2, this.flipBtn.y + 16);
    } else {
      ctx.fillText(this.isOpen ? '▼ CLOSE MONITOR ▼' : '▲ OPEN MONITOR ▲', this.logicalW / 2, this.flipBtn.y + 16);
    }
    ctx.restore();


  }
}