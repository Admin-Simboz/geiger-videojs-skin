import { PlayerController, type PropertyValues, playerContext, selectTime, selectVolume, UIElement } from '@videojs/html';

/** The volume knob turns through 270°, from 7 o'clock to 5 o'clock. */
const VOLUME_SWEEP_DEG = 270;
const VOLUME_STEP = 0.05;
const VOLUME_PAGE_STEP = 0.2;
/** The tuning knob is endless: every detent winds the tape this far. */
const TUNE_DEG_PER_STEP = 24;
const TUNE_STEP_SECONDS = 5;
const TUNE_PAGE_SECONDS = 30;
const WHEEL_STEP_PX = 40;
const PERCENT = 100;

type KnobKind = 'volume' | 'tune';

const formatClock = (seconds: number) => {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
};

/**
 * A turning knob on the device's side, as a real slider (`role="slider"`).
 *
 * - `kind="volume"`: turns through 270° from silent to full, like the volume pot on a radio.
 * - `kind="tune"`: an endless tuning dial that winds the tape; each detent seeks 5 seconds.
 *
 * Drag it round, scroll over it, or focus it and use the arrow keys, Page Up/Down, Home and End. Handled keys stop
 * here, so the player's own arrow-key hotkeys don't fire twice. The angle is exposed as `--geiger-turn`.
 */
class GeigerKnobElement extends UIElement {
  #volume = new PlayerController(this, playerContext, selectVolume);
  #time = new PlayerController(this, playerContext, selectTime);

  /** The tuning knob's own angle: it keeps turning however far the tape winds. */
  #tuneAngle = 0;
  #dragAngle: number | null = null;
  #dragCarry = 0;
  #rendered = { turn: Number.NaN, text: '' };

  get kind(): KnobKind {
    return this.getAttribute('kind') === 'tune' ? 'tune' : 'volume';
  }

  connectedCallback() {
    super.connectedCallback();
    this.setAttribute('role', 'slider');
    if (!this.hasAttribute('tabindex')) this.tabIndex = 0;
    this.setAttribute('aria-orientation', 'vertical');
    this.addEventListener('pointerdown', this.#onPointerDown);
    this.addEventListener('pointerup', this.#swallow);
    this.addEventListener('keydown', this.#onKeyDown);
    this.addEventListener('wheel', this.#onWheel, { passive: false });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('pointerdown', this.#onPointerDown);
    this.removeEventListener('pointerup', this.#swallow);
    this.removeEventListener('keydown', this.#onKeyDown);
    this.removeEventListener('wheel', this.#onWheel);
    this.#endDrag();
  }

  update(changed: PropertyValues) {
    super.update(changed);
    this.#render();
  }

  // ------------------------------------------------------------ State

  #render() {
    if (this.kind === 'volume') {
      const volume = this.#volume.value;
      if (!volume) return;
      const level = volume.muted ? 0 : volume.volume;
      const percent = Math.round(level * PERCENT);
      this.#apply((level - 0.5) * VOLUME_SWEEP_DEG, `${percent}%${volume.muted ? ', muted' : ''}`, 0, PERCENT, percent);
    } else {
      const time = this.#time.value;
      if (!time) return;
      const duration = Number.isFinite(time.duration) ? time.duration : 0;
      const text = `${formatClock(time.currentTime)} of ${formatClock(duration)}`;
      this.#apply(this.#tuneAngle, text, 0, Math.round(duration), Math.round(time.currentTime));
    }
  }

  #apply(turn: number, text: string, min: number, max: number, now: number) {
    if (turn !== this.#rendered.turn) {
      this.#rendered.turn = turn;
      this.style.setProperty('--geiger-turn', `${turn}deg`);
    }
    if (text !== this.#rendered.text) {
      this.#rendered.text = text;
      this.setAttribute('aria-valuemin', String(min));
      this.setAttribute('aria-valuemax', String(max));
      this.setAttribute('aria-valuenow', String(now));
      this.setAttribute('aria-valuetext', text);
    }
  }

  // ------------------------------------------------------------ Actions

  /** Turns the knob by `steps` detents (negative turns it back). */
  #turn(steps: number) {
    if (steps === 0) return;
    if (this.kind === 'volume') {
      const volume = this.#volume.value;
      if (!volume) return;
      const from = volume.muted ? 0 : volume.volume;
      const next = Math.min(Math.max(from + steps * VOLUME_STEP, 0), 1);
      if (volume.muted && next > 0) volume.setMuted(false);
      volume.setVolume(next);
    } else {
      this.#wind(steps * TUNE_STEP_SECONDS);
      this.#tuneAngle += steps * TUNE_DEG_PER_STEP;
      this.#render();
    }
  }

  #wind(seconds: number) {
    const time = this.#time.value;
    if (!time) return;
    const end = Number.isFinite(time.duration) ? time.duration : time.currentTime + seconds;
    void time.seek(Math.min(Math.max(time.currentTime + seconds, 0), end));
  }

  #setVolume(level: number) {
    const volume = this.#volume.value;
    if (!volume) return;
    if (volume.muted && level > 0) volume.setMuted(false);
    volume.setVolume(Math.min(Math.max(level, 0), 1));
  }

  // ------------------------------------------------------------ Input

  #onKeyDown = (event: KeyboardEvent) => {
    const volume = this.kind === 'volume';
    const page = volume ? VOLUME_PAGE_STEP / VOLUME_STEP : TUNE_PAGE_SECONDS / TUNE_STEP_SECONDS;
    switch (event.key) {
      case 'ArrowUp':
      case 'ArrowRight':
        this.#turn(1);
        break;
      case 'ArrowDown':
      case 'ArrowLeft':
        this.#turn(-1);
        break;
      case 'PageUp':
        this.#turn(page);
        break;
      case 'PageDown':
        this.#turn(-page);
        break;
      case 'Home':
        if (volume) this.#setVolume(0);
        else void this.#time.value?.seek(0);
        break;
      case 'End':
        if (volume) this.#setVolume(1);
        else {
          const time = this.#time.value;
          if (time && Number.isFinite(time.duration)) void time.seek(time.duration);
        }
        break;
      default:
        return;
    }
    event.preventDefault();
    event.stopPropagation();
  };

  #onWheel = (event: WheelEvent) => {
    event.preventDefault();
    const steps = Math.round(-event.deltaY / WHEEL_STEP_PX) || -Math.sign(event.deltaY);
    this.#turn(steps);
  };

  /** Angle of the pointer around the knob's centre, clockwise from 12 o'clock. */
  #angleOf(event: PointerEvent): number {
    const rect = this.getBoundingClientRect();
    const x = event.clientX - (rect.left + rect.width / 2);
    const y = event.clientY - (rect.top + rect.height / 2);
    return (Math.atan2(x, -y) * 180) / Math.PI;
  }

  #onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    this.focus();
    this.setPointerCapture(event.pointerId);
    this.#dragAngle = this.#angleOf(event);
    this.#dragCarry = 0;
    this.toggleAttribute('data-dragging', true);
    this.addEventListener('pointermove', this.#onPointerMove);
    this.addEventListener('lostpointercapture', this.#endDrag);
  };

  #onPointerMove = (event: PointerEvent) => {
    if (this.#dragAngle === null) return;
    const angle = this.#angleOf(event);
    let delta = angle - this.#dragAngle;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    this.#dragAngle = angle;

    if (this.kind === 'volume') {
      const volume = this.#volume.value;
      if (!volume) return;
      this.#setVolume((volume.muted ? 0 : volume.volume) + delta / VOLUME_SWEEP_DEG);
      return;
    }
    // Tuning: wind a detent's worth of tape for every detent turned.
    this.#dragCarry += delta;
    const steps = Math.trunc(this.#dragCarry / TUNE_DEG_PER_STEP);
    if (steps !== 0) {
      this.#dragCarry -= steps * TUNE_DEG_PER_STEP;
      this.#turn(steps);
    }
  };

  #endDrag = () => {
    this.#dragAngle = null;
    this.removeAttribute('data-dragging');
    this.removeEventListener('pointermove', this.#onPointerMove);
    this.removeEventListener('lostpointercapture', this.#endDrag);
  };

  /** The player's tap gesture toggles playback on pointerup; a turn of the knob isn't a tap. */
  #swallow = (event: Event) => {
    event.stopPropagation();
  };
}

if (!customElements.get('geiger-knob')) {
  customElements.define('geiger-knob', GeigerKnobElement);
}
