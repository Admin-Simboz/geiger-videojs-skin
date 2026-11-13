import {
  PlayerController,
  type PropertyValues,
  playerContext,
  selectBuffer,
  selectPlaybackRate,
  selectTime,
  selectVolume,
  UIElement,
} from '@videojs/html';

const PERCENT = 100;
/** Seconds of buffered tape ahead that count as a full-strength signal. */
const FULL_SIGNAL_SECONDS = 30;
const MINUTE_MS = 60_000;
const DATE_FORMAT: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
const TIME_FORMAT: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };

/** Writes a 0–1 level to `--geiger-level` and a percentage to `[data-part="value"]`, touching the DOM only on change. */
function renderLevel(element: HTMLElement, level: number, rendered: { value: number }): void {
  const percent = Math.round(Math.min(Math.max(level, 0), 1) * PERCENT);
  if (percent === rendered.value) return;
  rendered.value = percent;
  element.style.setProperty('--geiger-level', String(percent / PERCENT));
  const valueNode = element.querySelector('[data-part="value"]');
  if (valueNode) valueNode.textContent = `${percent}%`;
}

/**
 * The volume as a level (0 when muted): drives the hardware rad gauge's needle and the VOL readout. Decorative; the
 * volume slider and mute button carry the accessible state.
 */
class GeigerVolumeLevelElement extends UIElement {
  #volume = new PlayerController(this, playerContext, selectVolume);
  #rendered = { value: -1 };

  connectedCallback() {
    super.connectedCallback();
    this.setAttribute('aria-hidden', 'true');
  }

  update(changed: PropertyValues) {
    super.update(changed);
    const volume = this.#volume.value;
    if (!volume) return;
    renderLevel(this, volume.muted ? 0 : volume.volume, this.#rendered);
  }
}

/**
 * Signal strength: how much tape is buffered ahead of the playhead, where 30 seconds is full strength. Decorative.
 */
class GeigerSignalElement extends UIElement {
  #buffer = new PlayerController(this, playerContext, selectBuffer);
  #time = new PlayerController(this, playerContext, selectTime);
  #rendered = { value: -1 };

  connectedCallback() {
    super.connectedCallback();
    this.setAttribute('aria-hidden', 'true');
  }

  update(changed: PropertyValues) {
    super.update(changed);
    const buffer = this.#buffer.value;
    const time = this.#time.value;
    if (!buffer || !time) return;
    const now = time.currentTime;
    const range = buffer.buffered.find(([start, end]) => start <= now + 0.5 && end >= now);
    const ahead = range ? range[1] - now : 0;
    const atEnd = Number.isFinite(time.duration) && time.duration - now < 1;
    renderLevel(this, atEnd ? 1 : ahead / FULL_SIGNAL_SECONDS, this.#rendered);
  }
}

/**
 * The SPD cell: shows the playback rate and steps to the next one on click, wrapping from the fastest to the slowest.
 * Sets `--geiger-level` to the rate's place in the list for the cell's bar.
 *
 * Markup it expects inside: a `<button>` and `[data-part="value"]`.
 */
class GeigerRateElement extends UIElement {
  #rate = new PlayerController(this, playerContext, selectPlaybackRate);
  #button: HTMLButtonElement | null = null;
  #renderedRate = Number.NaN;

  connectedCallback() {
    super.connectedCallback();
    this.#button = this.querySelector('button');
    this.#button?.addEventListener('click', this.#onClick);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#button?.removeEventListener('click', this.#onClick);
  }

  update(changed: PropertyValues) {
    super.update(changed);
    const state = this.#rate.value;
    const rate = state?.playbackRate ?? 1;
    if (rate === this.#renderedRate) return;
    this.#renderedRate = rate;

    const rates = [...(state?.playbackRates ?? [rate])].sort((a, b) => a - b);
    const place = rates.length > 1 ? rates.indexOf(rate) / (rates.length - 1) : 1;
    this.style.setProperty('--geiger-level', String(Math.max(place, 0)));
    const valueNode = this.querySelector('[data-part="value"]');
    if (valueNode) valueNode.textContent = `${rate}×`;
    this.#button?.setAttribute('aria-label', `Playback speed ${rate}×. Change speed`);
  }

  #onClick = () => {
    const state = this.#rate.value;
    if (!state || state.playbackRates.length === 0) return;
    const rates = [...state.playbackRates].sort((a, b) => a - b);
    state.setPlaybackRate(rates.find((rate) => rate > state.playbackRate) ?? rates[0]!);
  };
}

/**
 * The terminal's clock: the time in `[data-part="time"]` and the date in `[data-part="date"]`, in the language of the
 * nearest `lang` ancestor, updated on the minute. Decorative.
 */
class GeigerClockElement extends HTMLElement {
  #timer = 0;

  connectedCallback() {
    this.setAttribute('aria-hidden', 'true');
    this.#tick();
  }

  disconnectedCallback() {
    clearTimeout(this.#timer);
    this.#timer = 0;
  }

  #tick = () => {
    const now = new Date();
    this.#render(now);
    this.#timer = window.setTimeout(this.#tick, MINUTE_MS - (now.getSeconds() * 1000 + now.getMilliseconds()));
  };

  #render(now: Date) {
    const locale = this.closest('[lang]')?.getAttribute('lang') || undefined;
    let time: string;
    let date: string;
    try {
      time = now.toLocaleTimeString(locale, TIME_FORMAT);
      date = now.toLocaleDateString(locale, DATE_FORMAT);
    } catch {
      // An invalid language tag: fall back to the browser's language.
      time = now.toLocaleTimeString(undefined, TIME_FORMAT);
      date = now.toLocaleDateString(undefined, DATE_FORMAT);
    }
    const timeNode = this.querySelector('[data-part="time"]');
    const dateNode = this.querySelector('[data-part="date"]');
    if (timeNode && timeNode.textContent !== time) timeNode.textContent = time;
    if (dateNode && dateNode.textContent !== date) dateNode.textContent = date;
  }
}

if (!customElements.get('geiger-volume-level')) customElements.define('geiger-volume-level', GeigerVolumeLevelElement);
if (!customElements.get('geiger-signal')) customElements.define('geiger-signal', GeigerSignalElement);
if (!customElements.get('geiger-rate')) customElements.define('geiger-rate', GeigerRateElement);
if (!customElements.get('geiger-clock')) customElements.define('geiger-clock', GeigerClockElement);
