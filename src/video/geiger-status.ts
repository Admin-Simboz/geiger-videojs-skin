import {
  PlayerController,
  type PropertyValues,
  playerContext,
  selectPlayback,
  selectPlaybackRate,
  selectStreamType,
  selectTime,
  selectVolume,
  UIElement,
} from '@videojs/html';

import { playBoot, playCrackle, playRelay } from './geiger-sound';

type Mode = 'standby' | 'play' | 'pause' | 'signal' | 'ff' | 'rew' | 'fast' | 'slow' | 'live' | 'end';
type WindDirection = Extract<Mode, 'ff' | 'rew'>;

/** The status word; the stylesheet sets it in capitals. */
const MODE_LABEL: Record<Mode, string> = {
  standby: 'Standby',
  play: 'Playing',
  pause: 'Paused',
  signal: 'Searching',
  ff: 'Winding ▶▶',
  rew: 'Winding ◀◀',
  fast: 'Fast',
  slow: 'Slow',
  live: 'Live',
  end: 'Signal lost',
};

/** The terminal's field notes. Playing rotates through its list, one per take. */
const MODE_NOTE: Record<Exclude<Mode, 'play'>, string> = {
  standby: 'Press play, Survivor.',
  pause: 'Take a breather, Survivor.',
  signal: 'Searching for signal…',
  ff: 'Winding the tape…',
  rew: 'Winding the tape…',
  fast: 'In a hurry, Survivor?',
  slow: 'Slow it down. Take it all in.',
  live: 'Receiving live broadcast.',
  end: 'Rewind and roll it again?',
};

const PLAY_NOTES = [
  'All quiet out there.',
  'Sit back. The world can wait.',
  'Water’s clean. Signal’s strong.',
  'Better days ahead… probably.',
  'Rad levels nominal. Enjoy the show.',
] as const;

const MUTED_NOTE = 'Running silent.';

/** A jump in the current time bigger than any playback tick: the tape is being wound, not played. */
const WIND_JUMP_SECONDS = 1.5;
/** How long WINDING stays up after the tape lands. */
const WIND_HOLD_MS = 600;

/**
 * The terminal's status line: a word for what the tape is doing (STANDBY, PLAYING, PAUSED, SEARCHING while buffering,
 * WINDING after a seek, FAST ×2, SLOW ×0.5, LIVE, SIGNAL LOST at the end) and a field note to go with it. It also plays
 * the hardware sounds (a power-up chirp on the first play, a relay click on play and pause, a Geiger crackle while
 * winding) unless the player is muted.
 *
 * The mode is exposed as `data-mode` (and `data-muted`), so the stylesheet can drive the screen effects from the same
 * source of truth. Decorative, so it's hidden from assistive technology; the controls carry the accessible state.
 *
 * Markup it expects inside: `[data-part="mode"]` and `[data-part="note"]`.
 */
class GeigerStatusElement extends UIElement {
  #playback = new PlayerController(this, playerContext, selectPlayback);
  #time = new PlayerController(this, playerContext, selectTime);
  #rate = new PlayerController(this, playerContext, selectPlaybackRate);
  #volume = new PlayerController(this, playerContext, selectVolume);
  #stream = new PlayerController(this, playerContext, selectStreamType);

  #lastTime = 0;
  #wasStarted = false;
  #wasRolling = false;
  #wind: WindDirection | null = null;
  #windTimer = 0;
  #takes = 0;
  #rendered = { mode: '', label: '', note: '', muted: false };

  connectedCallback() {
    super.connectedCallback();
    this.setAttribute('aria-hidden', 'true');
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    clearTimeout(this.#windTimer);
    this.#windTimer = 0;
  }

  update(changed: PropertyValues) {
    super.update(changed);
    const playback = this.#playback.value;
    const time = this.#time.value;
    if (!playback || !time) return;

    const volume = this.#volume.value;
    const loudness = volume && !volume.muted ? volume.volume : 0;

    // A seek lands as a jump in the current time. Loading the tape isn't a wind.
    const delta = time.currentTime - this.#lastTime;
    this.#lastTime = time.currentTime;
    if (this.#wasStarted && Math.abs(delta) > WIND_JUMP_SECONDS) {
      this.#holdWind(delta > 0 ? 'ff' : 'rew');
      playCrackle(loudness);
    }

    if (playback.started && !this.#wasStarted) playBoot(loudness);
    this.#wasStarted = playback.started;

    const rolling = playback.started && !playback.paused && !playback.ended;
    if (rolling !== this.#wasRolling) {
      if (rolling) this.#takes += 1;
      else if (playback.started) playRelay(loudness);
      this.#wasRolling = rolling;
    }

    this.#render();
  }

  #holdWind(direction: WindDirection) {
    this.#wind = direction;
    clearTimeout(this.#windTimer);
    this.#windTimer = window.setTimeout(() => {
      this.#wind = null;
      this.#windTimer = 0;
      this.#render();
    }, WIND_HOLD_MS);
  }

  #mode(): Mode {
    const playback = this.#playback.value!;
    const rate = this.#rate.value?.playbackRate ?? 1;
    if (playback.ended) return 'end';
    if (!playback.started) return 'standby';
    if (this.#wind) return this.#wind;
    if (playback.paused) return 'pause';
    if (playback.waiting) return 'signal';
    if (this.#stream.value?.streamType === 'live') return 'live';
    if (rate > 1) return 'fast';
    if (rate < 1) return 'slow';
    return 'play';
  }

  #render() {
    if (!this.#playback.value) return;
    const volume = this.#volume.value;
    const muted = !!volume && (volume.muted || volume.volume === 0);
    const mode = this.#mode();
    const rate = this.#rate.value?.playbackRate ?? 1;

    const label = mode === 'fast' || mode === 'slow' ? `${MODE_LABEL[mode]} ×${rate}` : MODE_LABEL[mode];
    let note = mode === 'play' ? PLAY_NOTES[(this.#takes - 1 + PLAY_NOTES.length) % PLAY_NOTES.length]! : MODE_NOTE[mode];
    if (muted && mode === 'play') note = MUTED_NOTE;

    if (mode !== this.#rendered.mode) {
      this.#rendered.mode = mode;
      this.setAttribute('data-mode', mode);
    }
    if (muted !== this.#rendered.muted) {
      this.#rendered.muted = muted;
      this.toggleAttribute('data-muted', muted);
    }
    if (label !== this.#rendered.label) {
      this.#rendered.label = label;
      const node = this.querySelector('[data-part="mode"]');
      if (node) node.textContent = label;
    }
    if (note !== this.#rendered.note) {
      this.#rendered.note = note;
      const node = this.querySelector('[data-part="note"]');
      if (node) node.textContent = note;
    }
  }
}

if (!customElements.get('geiger-status')) {
  customElements.define('geiger-status', GeigerStatusElement);
}
