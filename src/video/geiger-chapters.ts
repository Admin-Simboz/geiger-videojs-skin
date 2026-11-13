import {
  PlayerController,
  type PropertyValues,
  playerContext,
  selectPlayback,
  selectTextTrack,
  selectTime,
  UIElement,
} from '@videojs/html';

interface Chapter {
  startTime: number;
  text: string;
}

const NUMBER_DIGITS = 2;
/** Pressing "previous" this far into a chapter replays it; closer to its start it goes to the one before. */
const REPLAY_WINDOW_SECONDS = 3;

/** Index of the chapter that holds `time`: the last one starting at or before it. */
export function findChapter(chapters: readonly Chapter[], time: number): number {
  let index = 0;
  for (let candidate = 0; candidate < chapters.length; candidate += 1) {
    if (chapters[candidate]!.startTime > time) break;
    index = candidate;
  }
  return index;
}

const chapterNumber = (index: number) => String(index + 1).padStart(NUMBER_DIGITS, '0');

/**
 * Shared base: reads the chapters track and the current time, and re-renders only when the chapter list or the current
 * chapter changes. Sets `data-empty` when the media has no chapters, so the stylesheet can hide the element.
 */
abstract class ChapterElement extends UIElement {
  protected textTrack = new PlayerController(this, playerContext, selectTextTrack);
  protected time = new PlayerController(this, playerContext, selectTime);
  #renderedKey = '';

  protected get chapters(): readonly Chapter[] {
    return this.textTrack.value?.chaptersCues ?? [];
  }

  update(changed: PropertyValues) {
    super.update(changed);
    const chapters = this.chapters;
    const time = this.time.value;
    const empty = chapters.length === 0 || !time;
    const index = empty ? -1 : findChapter(chapters, time.currentTime);
    const key = empty ? 'empty' : `${chapters.length}:${index}:${chapters[0]!.startTime}`;
    if (key === this.#renderedKey) return;
    this.#renderedKey = key;
    this.toggleAttribute('data-empty', empty);
    if (!empty) this.renderChapter(chapters, index);
  }

  protected seekTo(index: number) {
    const chapters = this.chapters;
    const time = this.time.value;
    if (chapters.length === 0 || !time) return;
    const target = Math.min(Math.max(index, 0), chapters.length - 1);
    void time.seek(chapters[target]!.startTime);
  }

  protected currentIndex(): number {
    const time = this.time.value;
    return time ? findChapter(this.chapters, time.currentTime) : 0;
  }

  protected abstract renderChapter(chapters: readonly Chapter[], index: number): void;
}

/**
 * The chapter playing now, as text: `[data-part="number"]` gets "03", `[data-part="name"]` the chapter's title (the part
 * before " — ", when there is one). Decorative; the time slider and the chapter list carry the accessible chapter.
 */
class GeigerChapterElement extends ChapterElement {
  connectedCallback() {
    super.connectedCallback();
    this.setAttribute('aria-hidden', 'true');
  }

  protected renderChapter(chapters: readonly Chapter[], index: number) {
    const numberNode = this.querySelector('[data-part="number"]');
    const nameNode = this.querySelector('[data-part="name"]');
    if (numberNode) numberNode.textContent = chapterNumber(index);
    if (nameNode) nameNode.textContent = chapters[index]!.text.split(' — ')[0]!;
  }
}

/**
 * The hardware PREV / NEXT keys: wind to the previous or next chapter. Like a CD player, PREV replays the current chapter
 * when more than a few seconds into it.
 *
 * Markup it expects inside: two `<button>`s marked `data-part="prev"` and `data-part="next"`.
 */
class GeigerSkipElement extends ChapterElement {
  #prev: HTMLButtonElement | null = null;
  #next: HTMLButtonElement | null = null;

  connectedCallback() {
    super.connectedCallback();
    this.#prev = this.querySelector('button[data-part="prev"]');
    this.#next = this.querySelector('button[data-part="next"]');
    this.#prev?.addEventListener('click', this.#onPrev);
    this.#next?.addEventListener('click', this.#onNext);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#prev?.removeEventListener('click', this.#onPrev);
    this.#next?.removeEventListener('click', this.#onNext);
  }

  protected renderChapter(chapters: readonly Chapter[], index: number) {
    const last = index === chapters.length - 1;
    if (this.#next) {
      this.#next.disabled = last;
      this.#next.setAttribute('aria-label', last ? 'Next chapter' : `Next chapter: ${chapters[index + 1]!.text}`);
    }
    this.#prev?.setAttribute('aria-label', `Previous chapter (now ${index + 1} of ${chapters.length}: ${chapters[index]!.text})`);
  }

  #onPrev = () => {
    const index = this.currentIndex();
    const time = this.time.value;
    const start = this.chapters[index]?.startTime ?? 0;
    const replay = !!time && time.currentTime - start > REPLAY_WINDOW_SECONDS;
    this.seekTo(replay ? index : index - 1);
  };

  #onNext = () => {
    this.seekTo(this.currentIndex() + 1);
  };
}

/**
 * The holotape list: every chapter as a button, the one playing marked with `aria-current`. Shown while paused. Picking
 * one winds the tape there and plays it.
 *
 * Markup it expects inside: a `<template>` holding one `<li>` with a `<button>`, `[data-part="number"]` and
 * `[data-part="name"]`, and an `<ol>` to render into.
 */
class GeigerTapesElement extends ChapterElement {
  #playback = new PlayerController(this, playerContext, selectPlayback);
  #list: HTMLOListElement | null = null;
  #template: HTMLTemplateElement | null = null;
  #renderedCount = -1;

  connectedCallback() {
    super.connectedCallback();
    this.#list = this.querySelector('ol');
    this.#template = this.querySelector('template');
    this.#list?.addEventListener('click', this.#onClick);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#list?.removeEventListener('click', this.#onClick);
  }

  protected renderChapter(chapters: readonly Chapter[], index: number) {
    if (!this.#list || !this.#template) return;
    if (chapters.length !== this.#renderedCount) this.#build(chapters);

    this.#list.querySelectorAll('button').forEach((button, buttonIndex) => {
      if (buttonIndex === index) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    });
  }

  #build(chapters: readonly Chapter[]) {
    this.#renderedCount = chapters.length;
    const items = chapters.map((chapter, index) => {
      const item = this.#template!.content.firstElementChild!.cloneNode(true) as HTMLElement;
      const button = item.querySelector('button');
      const numberNode = item.querySelector('[data-part="number"]');
      const nameNode = item.querySelector('[data-part="name"]');
      button?.setAttribute('data-index', String(index));
      button?.setAttribute('aria-label', `Chapter ${index + 1}: ${chapter.text}`);
      if (numberNode) numberNode.textContent = chapterNumber(index);
      if (nameNode) nameNode.textContent = chapter.text.split(' — ')[0]!;
      return item;
    });
    this.#list!.replaceChildren(...items);
  }

  #onClick = (event: Event) => {
    const button = (event.target as Element).closest('button[data-index]');
    if (!button) return;
    this.seekTo(Number(button.getAttribute('data-index')));
    void this.#playback.value?.play();
  };
}

if (!customElements.get('geiger-chapter')) customElements.define('geiger-chapter', GeigerChapterElement);
if (!customElements.get('geiger-skip')) customElements.define('geiger-skip', GeigerSkipElement);
if (!customElements.get('geiger-tapes')) customElements.define('geiger-tapes', GeigerTapesElement);
