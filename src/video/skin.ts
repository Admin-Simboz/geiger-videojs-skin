import '../styles/video/geiger.css';
import './skin.css';
import './geiger.css';
import './geiger-status';
import './geiger-chapters';
import './geiger-meters';
import './geiger-knob';
import '@videojs/html/i18n';
import '@videojs/html/ui/container';
import '@videojs/html/ui/poster';
import '@videojs/html/ui/error-dialog';
import '@videojs/html/ui/dialog-backdrop';
import '@videojs/html/ui/dialog-popup';
import '@videojs/html/ui/dialog-title';
import '@videojs/html/ui/dialog-description';
import '@videojs/html/ui/dialog-close';
import '@videojs/html/ui/controls';
import '@videojs/html/ui/controls-backdrop';
import '@videojs/html/ui/controls-group';
import '@videojs/html/ui/buffering-indicator';
import '@videojs/html/ui/controls-content';
import '@videojs/html/ui/tooltip-group';
import '@videojs/html/ui/title';
import '@videojs/html/ui/airplay-button';
import '@videojs/html/ui/tooltip';
import '@videojs/html/ui/tooltip-label';
import '@videojs/html/ui/tooltip-shortcut';
import '@videojs/html/ui/cast-button';
import '@videojs/html/ui/pip-button';
import '@videojs/html/ui/fullscreen-button';
import '@videojs/html/ui/seek-button';
import '@videojs/html/ui/play-button';
import '@videojs/html/ui/time-slider';
import '@videojs/html/ui/time-slider-chapters';
import '@videojs/html/ui/slider-track';
import '@videojs/html/ui/slider-buffer';
import '@videojs/html/ui/slider-fill';
import '@videojs/html/ui/slider-thumb';
import '@videojs/html/ui/slider-preview';
import '@videojs/html/ui/slider-thumbnail';
import '@videojs/html/ui/slider-value';
import '@videojs/html/ui/time-slider-chapter-title';
import '@videojs/html/ui/mute-button';
import '@videojs/html/ui/volume-slider';
import '@videojs/html/ui/time-group';
import '@videojs/html/ui/time';
import '@videojs/html/ui/time-separator';
import '@videojs/html/ui/captions-button';
import '@videojs/html/ui/menu';
import '@videojs/html/ui/menu-content';
import '@videojs/html/ui/menu-item';
import '@videojs/html/ui/menu-separator';
import '@videojs/html/ui/quality-radio-group';
import '@videojs/html/ui/menu-radio-item';
import '@videojs/html/ui/menu-item-indicator';
import '@videojs/html/ui/audio-track-radio-group';
import '@videojs/html/ui/playback-rate-radio-group';
import '@videojs/html/ui/captions-radio-group';
import '@videojs/html/ui/hotkey';
import '@videojs/html/ui/gesture';
import '@videojs/html/ui/status-announcer';
import '@videojs/html/ui/volume-indicator';
import '@videojs/html/ui/volume-indicator-fill';
import '@videojs/html/ui/volume-indicator-value';
import '@videojs/html/ui/status-indicator';
import '@videojs/html/ui/status-indicator-value';
import '@videojs/html/ui/seek-indicator';
import '@videojs/html/ui/seek-indicator-value';
import { registerIcons } from '@videojs/html/icons';
import {
  airPlayEnterIcon,
  airPlayExitIcon,
  castEnterIcon,
  castExitIcon,
  checkIcon,
  chevronIcon,
  gearIcon,
  speechIcon,
  speedIcon,
  switchesIcon,
} from '@videojs/html/icons/scaffold';

const FONT_STYLESHEET_ID = 'geiger-skin-fonts';
const FONT_STYLESHEET_URL =
  'https://fonts.googleapis.com/css2?family=Barlow+Semi+Condensed:wght@500;600;700&family=Share+Tech+Mono&family=Yellowtail&display=swap';

/** Loads the skin's typefaces once per document. The theme falls back to system fonts until (or unless) they arrive. */
function loadFonts(): void {
  if (typeof document === 'undefined' || document.getElementById(FONT_STYLESHEET_ID)) return;
  const link = document.createElement('link');
  link.id = FONT_STYLESHEET_ID;
  link.rel = 'stylesheet';
  link.href = FONT_STYLESHEET_URL;
  document.head.append(link);
}

loadFonts();

const STROKE = 'fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"';
const svg = (body: string, attrs = 'fill="currentColor"') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" ${attrs}>${body}</svg>`;

const SPEAKER = '<path d="M3.5 9h4l5.5-4.5v15L7.5 15h-4z" fill="currentColor" stroke="none"/>';

/** The Geiger icon set: chunky terminal glyphs with soft corners, drawn to glow. */
const geigerIcons = {
  play: svg('<path d="M7 4.8v14.4a1 1 0 0 0 1.5.86l11.6-7.2a1 1 0 0 0 0-1.72L8.5 3.94A1 1 0 0 0 7 4.8Z"/>'),
  pause: svg('<rect x="5.5" y="4.5" width="4.5" height="15" rx="1"/><rect x="14" y="4.5" width="4.5" height="15" rx="1"/>'),
  restart: svg('<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4 3.5V8h4.5"/>', STROKE),
  seek: svg('<path d="M3.5 6.2v11.6a.8.8 0 0 0 1.25.66L12 12.66 4.75 5.54a.8.8 0 0 0-1.25.66ZM12.5 6.2v11.6a.8.8 0 0 0 1.25.66L21 12.66l-7.25-7.12a.8.8 0 0 0-1.25.66Z"/>'),
  'volume-high': svg(`${SPEAKER}<path d="M16 9.25a3.75 3.75 0 0 1 0 5.5"/><path d="M18.75 6.5a7.5 7.5 0 0 1 0 11"/>`, STROKE),
  'volume-low': svg(`${SPEAKER}<path d="M16 9.25a3.75 3.75 0 0 1 0 5.5"/>`, STROKE),
  'volume-off': svg(`${SPEAKER}<path d="M16 9.5l5 5M21 9.5l-5 5"/>`, STROKE),
  bolt: svg('<path d="M13.5 2.5 5 13.5h6l-1 8 8.5-11h-6z"/>'),
  signal: svg('<path d="M12 13.5v7M8.5 20.5h7"/><circle cx="12" cy="11" r="1.6" fill="currentColor"/><path d="M8.1 7.1a5.5 5.5 0 0 0 0 7.8M15.9 7.1a5.5 5.5 0 0 1 0 7.8M5.3 4.3a9.5 9.5 0 0 0 0 13.4M18.7 4.3a9.5 9.5 0 0 1 0 13.4"/>', STROKE),
  'pip-enter': svg('<rect x="2.75" y="4.75" width="18.5" height="14.5" rx="2"/><rect x="12" y="11.5" width="7" height="5.5" rx="1" fill="currentColor" stroke="none"/>', STROKE),
  'pip-exit': svg('<rect x="2.75" y="4.75" width="18.5" height="14.5" rx="2"/><path d="M9 9l5 5M9 13.5V9h4.5"/>', STROKE),
  'fullscreen-enter': svg('<path d="M3.5 9V3.5H9M15 3.5h5.5V9M20.5 15v5.5H15M9 20.5H3.5V15"/>', STROKE),
  'fullscreen-exit': svg('<path d="M9 3.5V9H3.5M20.5 9H15V3.5M15 20.5V15h5.5M3.5 15H9v5.5"/>', STROKE),
  'captions-off': svg(
    '<rect x="2.75" y="5.25" width="18.5" height="13.5" rx="2"/><path d="M10.5 10.1a2.1 2.1 0 1 0 0 3.8M17 10.1a2.1 2.1 0 1 0 0 3.8" stroke-width="2"/>',
    STROKE
  ),
  'captions-on': svg(
    '<rect x="1.75" y="4.25" width="20.5" height="15.5" rx="2.5"/><path d="M10.5 10.1a2.1 2.1 0 1 0 0 3.8M17 10.1a2.1 2.1 0 1 0 0 3.8" fill="none" stroke-width="2" stroke-linecap="round" style="stroke: var(--geiger-panel-solid, #000)"/>'
  ),
};

registerIcons('geiger', {
  'airplay-enter': airPlayEnterIcon,
  'airplay-exit': airPlayExitIcon,
  'cast-enter': castEnterIcon,
  'cast-exit': castExitIcon,
  check: checkIcon,
  chevron: chevronIcon,
  gear: gearIcon,
  speech: speechIcon,
  speed: speedIcon,
  switches: switchesIcon,
  ...geigerIcons,
});
