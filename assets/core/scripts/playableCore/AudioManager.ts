import {
    _decorator,
    AudioClip,
    AudioSource,
    Camera,
    Component,
    director,
    game,
    Input,
    input,
    js,
    Node,
    sys,
    tween,
    Tween,
} from 'cc';

const { ccclass } = _decorator;
import super_html_playable from './super_html_playable';
import { property } from './property';
@ccclass('AudioManager')
export class AudioManager extends Component {
     public static instance: AudioManager;




     @property({ type: AudioSource, group: "Audio sources" })
     private _soundSource: AudioSource = null!;

     @property({ type: AudioSource, group: "Audio sources" })
     private _musicSource: AudioSource = null!;

     private _soundBuffer: Set<AudioClip> = new Set();

     /** Зацикленный эффект (дождь): тот же пайплайн громкости, что у _soundSource (SDK / SoundMuter). */
     private _rainLoopHolder: Node | null = null;
     private _rainLoopSource: AudioSource | null = null;
     private _rainLoopActive = false;
     private _rainLoopClip: AudioClip | null = null;
     private _rainLoopUserVolume = 1;

     private static _browserRainResumeHooked = false;

     /** document/canvas: первый жест для Chrome autoplay (AudioContext suspended). */
     private static _documentWebAudioUnlockHooked = false;

     /** Пробный контекст: resume вместе с движком, если внутренний _player ещё не создан. */
     private static _probeAudioContext: AudioContext | null = null;

     private _didWarnMissingMusicClip = false;

     /** После победы/поражения / packshot — не поднимать фон снова из onSoundChange. */
     private _suppressAutoResumeBackgroundMusic = false;

     @property({ type: AudioClip, group: "Audio clips" })
     public gameEndSound: AudioClip = null!;

     @property({ type: AudioClip, group: "Audio clips", tooltip: 'Фоновая зацикленная мелодия игры (например assets/sound/back)' })
     public backgroundMusicClip: AudioClip | null = null;

     private muteOnStart: boolean = true;

     /**
      * Включение канала эффектов по SDK / SoundMuter.
      * Дождь НЕ должен умножаться на числовой volume у SFX-источника: в инспекторе часто 0 до первого кадра,
      * и тогда computeRainLoopVolume давал 0 при живом клипе.
      */
     private _effectsChannelOn = true;

     /** SDK может вызвать колбэк с undefined — иначе весь микшер обнулялся. */
     private static normalizeChannelOn(raw: unknown): boolean {
          if (raw === undefined || raw === null) {
               return true;
          }
          if (typeof raw === 'boolean') {
               return raw;
          }
          if (typeof raw === 'number') {
               return raw > 0;
          }
          return true;
     }

     /**
      * Без слушателя на камере в Cocos 3.x AudioSource часто не слышен.
      * Импорт `AudioListener` из `cc` в части билдов даёт undefined → getComponent/addComponent падают;
      * берём класс через js.getClassByName и проверяем на nil.
      */
     private resolveAudioListenerConstructor(): (typeof Component & { prototype: Component }) | null {
          const Cls = js.getClassByName('cc.AudioListener') as
               | (typeof Component & { prototype: Component })
               | null
               | undefined;
          return Cls ?? null;
     }

     private cameraHasAnyAudioListener(camNode: Node): boolean {
          return camNode.getComponents(Component).some((c) => (c.constructor?.name ?? '').includes('AudioListener'));
     }

     private ensureAudioListenerOnMainCamera(): void {
          const scene = director.getScene();
          if (!scene?.isValid) {
               return;
          }
          let cam =
               (Camera as unknown as { main?: Camera | null }).main ??
               scene.getComponentInChildren(Camera);
          if (!cam?.node?.isValid) {
               return;
          }
          if (this.cameraHasAnyAudioListener(cam.node)) {
               return;
          }
          const ListenerCtor = this.resolveAudioListenerConstructor();
          if (!ListenerCtor) {
               console.warn(
                    '[AudioManager] Класс AudioListener недоступен (js.getClassByName). Добавь компонент Audio Listener на ноду Camera в сцене.',
               );
               return;
          }
          if (cam.node.getComponent(ListenerCtor)) {
               return;
          }
          cam.node.addComponent(ListenerCtor);
          console.info('[AudioManager] На камеру добавлен AudioListener.');
     }

     private ensureAssignedSources(): void {
          this.bindExistingSourcesFromHierarchy();
          if (!this._soundSource?.isValid) {
               this._soundSource = this.createManagedSource('__SoundSource');
               console.info('[AudioManager] Auto-created Sound Source.');
          }
          if (!this._musicSource?.isValid) {
               this._musicSource = this.createManagedSource('__MusicSource');
               console.info('[AudioManager] Auto-created Music Source.');
          }
     }

     private bindExistingSourcesFromHierarchy(): void {
          const all = this.node?.getComponentsInChildren(AudioSource) ?? [];
          const candidates = all.filter((src) => {
               if (!src?.isValid) return false;
               const nodeName = src.node?.name ?? '';
               return nodeName !== '__RainLoopAudio';
          });
          if (!this._musicSource?.isValid) {
               this._musicSource = this.pickSourceByHint(candidates, ['music', 'bgm', 'theme']);
          }
          if (!this._soundSource?.isValid) {
               this._soundSource = this.pickSourceByHint(candidates, ['sound', 'sfx', 'effect', 'fx']);
          }
          for (let i = 0; i < candidates.length; i++) {
               const src = candidates[i]!;
               if (!this._soundSource?.isValid) {
                    this._soundSource = src;
                    continue;
               }
               if (!this._musicSource?.isValid && src !== this._soundSource) {
                    this._musicSource = src;
               }
          }
     }

     private pickSourceByHint(candidates: AudioSource[], hints: string[]): AudioSource | null {
          for (let i = 0; i < candidates.length; i++) {
               const src = candidates[i]!;
               const tag = `${src.node?.name ?? ''} ${src.clip?.name ?? ''}`.toLowerCase();
               if (hints.some((hint) => tag.includes(hint))) {
                    return src;
               }
          }
          return null;
     }

     private createManagedSource(nodeName: string): AudioSource {
          const holder = new Node(nodeName);
          this.node.addChild(holder);
          const src = holder.addComponent(AudioSource);
          src.playOnAwake = false;
          src.loop = nodeName === '__MusicSource';
          return src;
     }

     public smoothStopMusic() {
          this.ensureAssignedSources();
          if (!this._musicSource?.isValid) return;
          this._suppressAutoResumeBackgroundMusic = true;
          Tween.stopAllByTarget(this._musicSource);
          tween(this._musicSource).to(1, { volume: 0 }).call(() => {
               this._musicSource.stop();
          }).start();
     }

     /** Немедленно остановить фон (победа / поражение). */
     public stopBackgroundMusic(): void {
          this.ensureAssignedSources();
          if (!this._musicSource?.isValid) return;
          this._suppressAutoResumeBackgroundMusic = true;
          Tween.stopAllByTarget(this._musicSource);
          this._musicSource.stop();
     }

     /** Зацикленный фон из backgroundMusicClip на Music Source. */
     public playBackgroundMusic(): void {
          this.ensureAssignedSources();
          if (!this.backgroundMusicClip || !this._musicSource?.isValid) {
               return;
          }
          this._suppressAutoResumeBackgroundMusic = false;
          this.muteOnStart = false;
          const targetVol = this._effectsChannelOn ? 0.2 : 0;
          const src = this._musicSource;

          if (src.clip === this.backgroundMusicClip && src.loop) {
               src.volume = targetVol;
               if (targetVol > 0.001 && !src.playing) {
                    src.play();
               }
               this.syncRainLoopMixer();
               return;
          }

          Tween.stopAllByTarget(src);
          src.stop();
          src.clip = this.backgroundMusicClip;
          src.loop = true;
          src.volume = targetVol;
          if (targetVol > 0.001) {
               src.play();
          }
          this.syncRainLoopMixer();
     }

     /** Старт музыки: back, иначе playMusic по клипу на источнике. */
     public tryStartGameplayMusic(): void {
          this.ensureAssignedSources();
          this.muteOnStart = false;
          if (this.backgroundMusicClip) {
               this.playBackgroundMusic();
          } else {
               this.playMusic();
          }
     }

     public playMusic() {
          this.ensureAssignedSources();
          if (!this._musicSource?.isValid) {
               console.warn('AudioManager: Music Source не назначен');
               return;
          }
          if (!this._musicSource.clip) {
               if (!this._didWarnMissingMusicClip) {
                    this._didWarnMissingMusicClip = true;
                    console.warn(
                         'AudioManager: Music Source найден, но AudioClip не назначен. Фоновая музыка не проиграется, пока не укажешь клип.',
                    );
               }
               return;
          }
          if (this._musicSource.playing) return;
          this._suppressAutoResumeBackgroundMusic = false;
          this.muteOnStart = false;
          this._musicSource.play();
          console.log('playMusic');
          this.syncRainLoopMixer();
     }

     public onSoundChange(raw?: unknown) {
          this.ensureAssignedSources();
          const status = AudioManager.normalizeChannelOn(raw);
          this._effectsChannelOn = status;
          if (!this._musicSource?.isValid && !this._soundSource?.isValid) {
               return;
          }
          if (this._musicSource?.isValid) {
               this._musicSource.volume = status ? 0.2 : 0;
               this.ensureBackgroundMusicPlayingIfUnlocked();
          }
          if (this._soundSource?.isValid) {
               this._soundSource.volume = status ? 0.6 : 0;
          }
          this.syncRainLoopMixer();
     }

     /**
      * Если SDK сначала дал громкость 0, playBackgroundMusic не вызывал play();
      * после onSoundChange канал включился — нужно запустить уже назначенный clip.
      * Не трогаем muteOnStart (Google/AppLovin/Moloco до первого тапа).
      */
     private ensureBackgroundMusicPlayingIfUnlocked(): void {
          if (this._suppressAutoResumeBackgroundMusic) {
               return;
          }
          if (!this._musicSource?.isValid || !this.backgroundMusicClip || this.muteOnStart) {
               return;
          }
          if (!this._effectsChannelOn) {
               return;
          }
          const src = this._musicSource;
          if (src.volume <= 0.001) {
               return;
          }
          if (src.clip !== this.backgroundMusicClip || !src.loop) {
               this.playBackgroundMusic();
               return;
          }
          if (!src.playing) {
               src.play();
          }
     }


     /** Первый осмысленный тап в игре (еда и т.д.) — до вызова playMusic из GameStateManager. */
     public allowSfxAfterUserInteraction(): void {
          this.muteOnStart = false;
     }

     public playSound(sound: AudioClip) {
          this.ensureAssignedSources();
          if (this.muteOnStart) {
             
               return;
          }
          if (!sound) return;


         if (!this._soundSource?.isValid) return;
         this._soundSource.playOneShot(sound);
     }

     public playSoundWithBuffer(sound: AudioClip) {
          this.ensureAssignedSources();
          if (this.muteOnStart) {
             
               return;
          }
          if (!sound) return;


         this._soundBuffer.add(sound);
     }

     /**
      * Зацикленный SFX (например дождь). Громкость умножается на уровень канала эффектов (как у playOneShot).
      * Не использует muteOnStart — иначе на части сетей звук никогда не стартует до клика, а loop уже закончился.
      */
     public startRainLoop(clip: AudioClip | null, volume01: number): void {
          if (!clip || !this.node?.isValid) {
               return;
          }
          this.ensureAssignedSources();
          this.ensureAudioListenerOnMainCamera();
          const src = this.ensureRainLoopSource();
          if (!src) {
               return;
          }
          this._rainLoopActive = true;
          this._rainLoopClip = clip;
          this._rainLoopUserVolume = Math.max(0, Math.min(1, Number(volume01) || 0));

          src.stop();
          src.clip = clip;
          src.loop = true;
          src.volume = this.computeRainLoopVolume(this._rainLoopUserVolume);
          AudioManager.hookBrowserRainResumeOnce();
          if (src.volume > 0.001) {
               src.play();
          } else {
               console.warn(
                    '[AudioManager] Громкость дождя 0 (канал эффектов выключен SDK / mute). Проверь getAudioVolume / SoundMuter.',
               );
          }
          this.scheduleOnce(() => {
               if (this._rainLoopActive && src.isValid && !src.playing && src.volume > 0.001) {
                    src.play();
               }
          }, 0);
     }

     public stopRainLoop(): void {
          this._rainLoopActive = false;
          this._rainLoopClip = null;
          if (this._rainLoopSource?.isValid) {
               this._rainLoopSource.stop();
          }
     }

     private ensureRainLoopSource(): AudioSource | null {
          if (!this.node?.isValid) {
               return null;
          }
          if (!this._rainLoopSource?.isValid) {
               const holder = new Node('__RainLoopAudio');
               this.node.addChild(holder);
               this._rainLoopHolder = holder;
               this._rainLoopSource = holder.addComponent(AudioSource);
               this._rainLoopSource.playOnAwake = false;
          }
          return this._rainLoopSource;
     }

     private computeRainLoopVolume(user01: number): number {
          const u = Math.max(0, Math.min(1, user01));
          if (!this._effectsChannelOn) {
               return 0;
          }
          return u;
     }

     private syncRainLoopMixer(): void {
          if (!this._rainLoopActive || !this._rainLoopSource?.isValid || !this._rainLoopClip) {
               return;
          }
          const v = this.computeRainLoopVolume(this._rainLoopUserVolume);
          this._rainLoopSource.volume = v;
          if (v <= 0.001) {
               this._rainLoopSource.stop();
          } else if (!this._rainLoopSource.playing) {
               this._rainLoopSource.clip = this._rainLoopClip;
               this._rainLoopSource.loop = true;
               this._rainLoopSource.play();
          }
     }

     private static getOrCreateProbeAudioContext(): AudioContext | null {
          if (AudioManager._probeAudioContext) {
               return AudioManager._probeAudioContext;
          }
          try {
               const g = globalThis as unknown as {
                    AudioContext?: typeof AudioContext;
                    webkitAudioContext?: typeof AudioContext;
               };
               const Ctor = g.AudioContext ?? g.webkitAudioContext;
               if (Ctor) {
                    AudioManager._probeAudioContext = new Ctor();
               }
          } catch {
               /* нет Web Audio */
          }
          return AudioManager._probeAudioContext;
     }

     private resumeAudioContextIfNeeded(ctx: AudioContext | null | undefined): void {
          if (!ctx || ctx.state === 'closed') {
               return;
          }
          if (ctx.state === 'suspended') {
               void ctx.resume().catch(() => {
                    /* игнор — политика браузера */
               });
          }
     }

     private resumeFromAudioSourceInternals(src: AudioSource | null | undefined): void {
          if (!src?.isValid) {
               return;
          }
          try {
               const player = (src as unknown as { _player?: Record<string, unknown> })._player;
               if (!player) {
                    return;
               }
               const ctx =
                    (player._context as AudioContext | undefined) ??
                    (player._audioContext as AudioContext | undefined) ??
                    (player.audioContext as AudioContext | undefined);
               this.resumeAudioContextIfNeeded(ctx);
          } catch {
               /* внутренний API движка может отличаться */
          }
     }

     /**
      * После user gesture: resume AudioContext (движок + пробный), затем повтор дождя/музыки.
      * Обходит предупреждение Chrome «AudioContext was not allowed to start».
      */
     public resumeWebAudioAfterUserGesture(): void {
          this.ensureAssignedSources();
          this.resumeAudioContextIfNeeded(AudioManager.getOrCreateProbeAudioContext());
          this.resumeFromAudioSourceInternals(this._musicSource);
          this.resumeFromAudioSourceInternals(this._soundSource);
          this.resumeFromAudioSourceInternals(this._rainLoopSource);
          this.resumeRainLoopAfterBrowserGesture();
          this.syncRainLoopMixer();
          this.ensureBackgroundMusicPlayingIfUnlocked();
     }

     /** Публичный: вызывается из статического input-хука (разблокировка Web Audio после жеста). */
     public resumeRainLoopAfterBrowserGesture(): void {
          if (!this._rainLoopActive || !this._rainLoopClip || !this._rainLoopSource?.isValid) {
               return;
          }
          this._rainLoopSource.stop();
          this._rainLoopSource.clip = this._rainLoopClip;
          this._rainLoopSource.loop = true;
          this._rainLoopSource.volume = this.computeRainLoopVolume(this._rainLoopUserVolume);
          if (this._rainLoopSource.volume > 0.001) {
               this._rainLoopSource.play();
          }
     }

     private static hookDocumentWebAudioUnlock(): void {
          if (AudioManager._documentWebAudioUnlockHooked) {
               return;
          }
          if (!sys.isBrowser || typeof document === 'undefined') {
               return;
          }
          AudioManager._documentWebAudioUnlockHooked = true;
          const opts: AddEventListenerOptions = { capture: true, passive: true };
          const onGesture = (): void => {
               AudioManager.instance?.resumeWebAudioAfterUserGesture();
          };
          const evs = ['touchstart', 'touchend', 'mousedown', 'pointerdown', 'click', 'keydown'] as const;
          for (let i = 0; i < evs.length; i++) {
               document.addEventListener(evs[i]!, onGesture, opts);
          }
          const canvas = (game?.canvas ?? null) as HTMLCanvasElement | null;
          if (canvas) {
               for (let i = 0; i < evs.length; i++) {
                    canvas.addEventListener(evs[i]!, onGesture, opts);
               }
          }
     }

     private static hookBrowserRainResumeOnce(): void {
          if (AudioManager._browserRainResumeHooked) {
               return;
          }
          AudioManager._browserRainResumeHooked = true;
          const resume = (): void => {
               input.off(Input.EventType.TOUCH_START, resume);
               input.off(Input.EventType.TOUCH_END, resume);
               input.off(Input.EventType.MOUSE_DOWN, resume);
               input.off(Input.EventType.MOUSE_UP, resume);
               AudioManager.instance?.resumeWebAudioAfterUserGesture();
          };
          input.on(Input.EventType.TOUCH_START, resume);
          input.on(Input.EventType.TOUCH_END, resume);
          input.on(Input.EventType.MOUSE_DOWN, resume);
          input.on(Input.EventType.MOUSE_UP, resume);
     }

     protected override onLoad(): void {
          AudioManager.instance = this;
          this.ensureAssignedSources();
          const rawVol = super_html_playable.getAudioVolume();
          this.onSoundChange(AudioManager.normalizeChannelOn(rawVol));
          super_html_playable.setAudioCallback(this.onSoundChange.bind(this));
          AudioManager.hookDocumentWebAudioUnlock();
          AudioManager.hookBrowserRainResumeOnce();
          this.scheduleOnce(() => this.ensureAudioListenerOnMainCamera(), 0);
     }
     protected override start(): void {
          this.ensureAssignedSources();
          this.ensureAudioListenerOnMainCamera();
          if (!this.backgroundMusicClip && !this._musicSource?.clip) {
               console.warn(
                    'AudioManager: нет backgroundMusicClip и клипа на Music Source — фон не заиграет; назначь back или клип на Music.',
               );
          }
          this.muteOnStart = super_html_playable.getMuteOnStart();

          if (!this.muteOnStart) {
               this.tryStartGameplayMusic();
          }
     }
     protected override update(dt: number): void {
          this.processSoundBuffer();
     }

     private processSoundBuffer() {
          this.ensureAssignedSources();
          if (this._soundBuffer.size === 0) {
               return;
          }


          const soundsToPlay = Array.from(this._soundBuffer);
          this._soundBuffer.clear();


          soundsToPlay.forEach((sound) => {
               if (sound && !this.muteOnStart && this._soundSource?.isValid) {
                    this._soundSource.playOneShot(sound);
               }
          });
     }







}


