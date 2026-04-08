import {
    _decorator,
    CCBoolean,
    CCFloat,
    CCInteger,
    Component,
    SpriteFrame,
    Sprite,
    EventHandler,
    UIOpacity,
} from 'cc';
import { property } from '../playableCore/property';
const { ccclass } = _decorator;

// Типы для коллбеков
export type AnimationCompleteCallback = (sequencePlayer: SequencePlayer) => void;
@ccclass('SequencePlayer')
export class SequencePlayer extends Component {
    @property(CCFloat)
    private _framesPerSecond: number = 60;

    @property(CCFloat)
    private _speedScale: number = 1;

    @property(CCBoolean)
    private _loop: boolean = false;

    @property(CCBoolean)
    private _playOnStart: boolean = false;

    @property(CCBoolean)
    private _hideOnEnd: boolean = false;

    @property(EventHandler)
    private _onAnimationComplete: EventHandler[] = [];

    // Программные коллбеки
    private _programmaticCallbacks: AnimationCompleteCallback[] = [];

    @property(SpriteFrame)
    private _frames: SpriteFrame[] = [];

    @property(CCBoolean)
    private _playing: boolean = false;

    @property(CCInteger)
    private _currentFrame: number = 0;

    private _sprite: Sprite = null!;
    private _frameTimer: number = 0;
    private _frameInterval: number = 0;

    protected override start(): void {
        this._sprite = this.getComponent(Sprite)!;
        this._currentFrame = 0;

        if (this._playOnStart) {
            this.play();
        }
    }

    protected override onDestroy(): void {
        // Очищаем программные коллбеки при уничтожении
        this.clearAnimationCompleteCallbacks();
    }

    public setFrames(frames: SpriteFrame[]) {
        this._frames = frames;
    }


    public play(hard: boolean = false) {
        if ((!hard) && (this._playing || this._frames.length === 0)) return;

        var opacity = this.node.getComponent(UIOpacity);
        if (opacity) {

            opacity.opacity = 255;
        } else {

            opacity = this.node.addComponent(UIOpacity)!;
            opacity.opacity = 255;

        }

        this._playing = true;
        if (hard) {

            this._currentFrame = 0;
        }
        this._frameTimer = 0;
        this.updateFrame();
    }

    public pause() {
        if (this._playing) this._playing = false;

    }

    public stop() {
        if (this._playing) {
            this._playing = false;
            this._currentFrame = 0;
            this.updateFrame();
        }
    }

    protected override update(deltaTime: number): void {
        this._frameInterval = 1 / this._framesPerSecond;
        if (!this._playing || this._frames.length === 0) return;

        this._frameTimer += deltaTime * this._speedScale;

        if (this._frameTimer >= this._frameInterval) {
            this._frameTimer = 0;
            this.nextFrame();
        }
    }

    private nextFrame(): void {
        this._currentFrame++;

        if (this._currentFrame >= this._frames.length) {
            if (this._loop) {
                this._currentFrame = 0;
            } else {
                this._playing = false;
                this._currentFrame = this._frames.length - 1;
                this.onAnimationComplete();
            }
        }

        this.updateFrame();
    }

    private updateFrame(): void {
        if (this._sprite && this._frames.length > 0 && this._currentFrame < this._frames.length) {
            const frame = this._frames[this._currentFrame];
            if (frame) {
                this._sprite.spriteFrame = frame;
            }
        }
    }

    public setSpeedScale(speed: number): void {
        this._speedScale = speed;
    }

    public setLoop(loop: boolean): void {
        this._loop = loop;
    }

    public isPlaying(): boolean {
        return this._playing;
    }

    public getCurrentFrame(): number {
        return this._currentFrame;
    }

    public getTotalFrames(): number {
        return this._frames.length;
    }

    /**
     * Добавляет программный коллбек для события завершения анимации
     * @param callback Функция-коллбек
     */
    public addAnimationCompleteCallback(callback: AnimationCompleteCallback): void {
        if (callback && !this._programmaticCallbacks.includes(callback)) {
            this._programmaticCallbacks.push(callback);
        }
    }

    /**
     * Удаляет программный коллбек для события завершения анимации
     * @param callback Функция-коллбек для удаления
     */
    public removeAnimationCompleteCallback(callback: AnimationCompleteCallback): void {
        const index = this._programmaticCallbacks.indexOf(callback);
        if (index !== -1) {
            this._programmaticCallbacks.splice(index, 1);
        }
    }

    /**
     * Очищает все программные коллбеки
     */
    public clearAnimationCompleteCallbacks(): void {
        this._programmaticCallbacks = [];
    }

    /**
     * Получает количество активных программных коллбеков
     */
    public getProgrammaticCallbacksCount(): number {
        return this._programmaticCallbacks.length;
    }

    private onAnimationComplete(): void {
        // Вызываем коллбек если он настроен
        this._playing = false;

        // Вызываем коллбеки из редактора
        if (this._onAnimationComplete && this._onAnimationComplete.length > 0) {
            EventHandler.emitEvents(this._onAnimationComplete, this);
        }

        // Вызываем программные коллбеки
        if (this._programmaticCallbacks.length > 0) {
            for (const callback of this._programmaticCallbacks) {
                try {
                    callback(this);
                } catch (error) {
                    console.error('Ошибка в программном коллбеке SequencePlayer:', error);
                }
            }
        }

        // Скрываем объект если включена опция hideOnEnd
        if (this._hideOnEnd) {
            var opacity = this.node.getComponent(UIOpacity);
            if (opacity) {
                opacity.opacity = 0;
            } else {
                opacity = this.node.addComponent(UIOpacity)!;
                opacity.opacity = 0;
            }
        }
    }
}
