// Copyright (c) 2014 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { IS_HIDPI } from './constants';
import Runner from './Runner';

/**
 * Handles displaying the distance meter.
 * @param {!HTMLCanvasElement} canvas
 * @param {Object} spritePos Image position in sprite.
 * @param {number} canvasWidth
 * @constructor
 */
class DistanceMeter {
  /**
   * @enum {number}
   */
  static dimensions = {
    WIDTH: 10,
    HEIGHT: 13,
    DEST_WIDTH: 11,
  };

  /**
   * Y positioning of the digits in the sprite sheet.
   * X position is always 0.
   * @type {Array<number>}
   */
  static yPos = [0, 13, 27, 40, 53, 67, 80, 93, 107, 120];

  /**
   * Distance meter config.
   * @enum {number}
   */
  static config = {
    // Number of digits.
    MAX_DISTANCE_UNITS: 5,

    // Distance that causes achievement animation.
    ACHIEVEMENT_DISTANCE: 100,

    // Used for conversion from pixel distance to a scaled unit.
    COEFFICIENT: 0.025,

    // Flash duration in milliseconds.
    FLASH_DURATION: 1000 / 4,

    // Flash iterations for achievement animation.
    FLASH_ITERATIONS: 3,
  };

  constructor(canvas, spritePos, canvasWidth) {
    this.canvas = canvas;
    this.canvasCtx = canvas.getContext('2d');
    this.image = Runner.imageSprite;
    this.spritePos = spritePos;
    this.x = 0;
    this.y = 5;

    this.currentDistance = 0;
    this.maxScore = 0;
    this.highScore = 0;
    this.container = null;

    this.digits = [];
    this.acheivement = false;
    this.defaultString = '';
    this.flashTimer = 0;
    this.flashIterations = 0;
    this.invertTrigger = false;

    this.config = DistanceMeter.config;
    this.maxScoreUnits = this.config.MAX_DISTANCE_UNITS;
    this.init(canvasWidth);
  }

  /**
   * Initialise the distance meter to '00000'.
   * @param {number} width Canvas width in px.
   */
  init(width) {
    let maxDistanceStr = '';

    this.calcXPos(width);
    this.maxScore = this.maxScoreUnits;
    for (let i = 0; i < this.maxScoreUnits; i++) {
      this.draw(i, 0);
      this.defaultString += '0';
      maxDistanceStr += '9';
    }

    this.maxScore = parseInt(maxDistanceStr);
  }

  /**
   * Calculate the xPos in the canvas.
   * @param {number} canvasWidth
   */
  calcXPos(canvasWidth) {
    this.x =
      canvasWidth -
      DistanceMeter.dimensions.DEST_WIDTH * (this.maxScoreUnits + 1);
  }

  /**
   * Draw a digit to canvas.
   * @param {number} digitPos Position of the digit.
   * @param {number} value Digit value 0-9.
   * @param {boolean} opt_highScore Whether drawing the high score.
   */
  draw(digitPos, value, opt_highScore) {
    let sourceWidth = DistanceMeter.dimensions.WIDTH;
    let sourceHeight = DistanceMeter.dimensions.HEIGHT;
    let sourceX = DistanceMeter.dimensions.WIDTH * value;
    let sourceY = 0;

    let targetX = digitPos * DistanceMeter.dimensions.DEST_WIDTH;
    let targetY = this.y;
    let targetWidth = DistanceMeter.dimensions.WIDTH;
    let targetHeight = DistanceMeter.dimensions.HEIGHT;

    // For high DPI we 2x source values.
    if (IS_HIDPI) {
      sourceWidth *= 2;
      sourceHeight *= 2;
      sourceX *= 2;
    }

    sourceX += this.spritePos.x;
    sourceY += this.spritePos.y;

    this.canvasCtx.save();

    if (opt_highScore) {
      // Left of the current score.
      let highScoreX =
        this.x - this.maxScoreUnits * 2 * DistanceMeter.dimensions.WIDTH;
      this.canvasCtx.translate(highScoreX, this.y);
    } else {
      this.canvasCtx.translate(this.x, this.y);
    }

    this.canvasCtx.drawImage(
      this.image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      targetX,
      targetY,
      targetWidth,
      targetHeight
    );

    this.canvasCtx.restore();
  }

  /**
   * Covert pixel distance to a 'real' distance.
   * @param {number} distance Pixel distance ran.
   * @return {number} The 'real' distance ran.
   */
  getActualDistance(distance) {
    return distance ? Math.round(distance * this.config.COEFFICIENT) : 0;
  }

  /**
   * Update the distance meter.
   * @param {number} distance
   * @param {number} deltaTime
   * @return {boolean} Whether the acheivement sound fx should be played.
   */
  update(deltaTime, distance) {
    let paint = true;
    let playSound = false;

    if (!this.acheivement) {
      distance = this.getActualDistance(distance);
      // Score has gone beyond the initial digit count.
      if (
        distance > this.maxScore &&
        this.maxScoreUnits == this.config.MAX_DISTANCE_UNITS
      ) {
        this.maxScoreUnits++;
        this.maxScore = parseInt(this.maxScore + '9');
      } else {
        this.distance = 0;
      }

      if (distance > 0) {
        // Acheivement unlocked
        if (distance % this.config.ACHIEVEMENT_DISTANCE == 0) {
          // Flash score and play sound.
          this.acheivement = true;
          this.flashTimer = 0;
          playSound = true;
        }

        // Create a string representation of the distance with leading 0.
        let distanceStr = (this.defaultString + distance).substr(
          -this.maxScoreUnits
        );
        this.digits = distanceStr.split('');
      } else {
        this.digits = this.defaultString.split('');
      }
    } else {
      // Control flashing of the score on reaching acheivement.
      if (this.flashIterations <= this.config.FLASH_ITERATIONS) {
        this.flashTimer += deltaTime;

        if (this.flashTimer < this.config.FLASH_DURATION) {
          paint = false;
        } else if (this.flashTimer > this.config.FLASH_DURATION * 2) {
          this.flashTimer = 0;
          this.flashIterations++;
        }
      } else {
        this.acheivement = false;
        this.flashIterations = 0;
        this.flashTimer = 0;
      }
    }

    // Draw the digits if not flashing.
    if (paint) {
      for (let i = this.digits.length - 1; i >= 0; i--) {
        this.draw(i, parseInt(this.digits[i]));
      }
    }

    this.drawHighScore();
    return playSound;
  }

  /**
   * Draw the high score.
   */
  drawHighScore() {
    this.canvasCtx.save();
    this.canvasCtx.globalAlpha = 0.8;
    for (let i = this.highScore.length - 1; i >= 0; i--) {
      this.draw(i, parseInt(this.highScore[i], 10), true);
    }
    this.canvasCtx.restore();
  }

  /**
   * Set the highscore as a array string.
   * Position of char in the sprite: H - 10, I - 11.
   * @param {number} distance Distance ran in pixels.
   */
  setHighScore(distance) {
    distance = this.getActualDistance(distance);
    let highScoreStr = (this.defaultString + distance).substr(
      -this.maxScoreUnits
    );

    this.highScore = ['10', '11', ''].concat(highScoreStr.split(''));
  }

  /**
   * Reset the distance meter back to '00000'.
   */
  reset() {
    this.update(0);
    this.acheivement = false;
  }
}

export default DistanceMeter;
