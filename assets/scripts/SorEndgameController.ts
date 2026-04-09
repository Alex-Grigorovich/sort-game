import { _decorator, AudioClip, Button, Component, director, Enum, Node, PhysicsSystem2D, sys, tween, UIOpacity } from 'cc';
import { AudioManager } from '../core/scripts/playableCore/AudioManager';
import { property } from '../core/scripts/playableCore/property';
import super_html_playable from '../core/scripts/playableCore/super_html_playable';
import { BackgroundCover } from './BackgroundCover';
import { ContainerPhysicsBowl } from './ContainerPhysicsBowl';
import { FryingOrdersQueue } from './FryingOrdersQueue';

const { ccclass } = _decorator;

export enum TimedWinDuration {
    Off = 0,
    Sec7 = 7,
    Sec10 = 10,
    Sec15 = 15,
}

type FryInputController = Component & {
    setBoardInputEnabled?: (on: boolean) => void;
};

/**
 * PopupWin / PopupLose: победа после N полных подносов (3/3) и/или по таймеру после первого верного клика.
 */
@ccclass('SorEndgameController')
export class SorEndgameController extends Component {
    public static I: SorEndgameController | null = null;

    @property({ tooltip: 'Пусто — дочерний PopupWin на GameField' })
    popupWinRoot: Node | null = null;

    @property({ tooltip: 'Пусто — дочерний PopupLose на GameField' })
    popupLoseRoot: Node | null = null;

    @property({ type: AudioClip, tooltip: 'Звук при показе PopupWin (assets/sound/Win)' })
    popupWinSound: AudioClip | null = null;

    @property({ type: AudioClip, tooltip: 'Звук при показе PopupLose (assets/sound/gameOver)' })
    popupLoseSound: AudioClip | null = null;

    @property({ type: [Node], tooltip: 'Win popup: ноды (logo/text/extra) для поочерёдного плавного показа в нужном порядке' })
    popupWinRevealNodes: Node[] = [];

    @property({ type: Node, tooltip: 'Win popup: кнопка для отдельного показа с задержкой. Пусто — auto getComponentInChildren(Button)' })
    popupWinButtonRoot: Node | null = null;

    @property({ tooltip: 'Сколько неверных кликов по еде (не тот заказ) до проигрыша' })
    maxWrongFoodClicks = 2;

    @property({
        tooltip:
            'Конвейер: сколько подносов уехало влево не до конца заполненными (0–2 из 3) — затем PopupLose. 2 = два таких лотка.',
    })
    maxUnfilledConveyorTrays = 2;

    @property({
        tooltip: 'Сколько раз подряд нужно полностью закрыть поднос (3/3), чтобы показать PopupWin (обычно 3).',
    })
    winAfterFilledTrays = 3;

    @property({
        type: Enum(TimedWinDuration),
        tooltip:
            'Дополнительно: таймер победы после первого верного клика по еде. Off — только счёт подносов. Иначе packshot по таймеру или по подносам — что наступит раньше (дубли блокируются).',
    })
    timedWinDuration: TimedWinDuration = TimedWinDuration.Off;

    @property({ tooltip: 'Длительность плавного появления popup root (сек)' })
    popupFadeDuration = 0.3;

    @property({ tooltip: 'Задержка перед стартом поочерёдного показа win logo/text (сек)' })
    popupWinRevealStartDelay = 0.08;

    @property({ tooltip: 'Шаг задержки между logo/text на win popup (сек)' })
    popupWinRevealStepDelay = 0.08;

    @property({ tooltip: 'Длительность появления logo/text на win popup (сек)' })
    popupWinRevealFadeDuration = 0.18;

    @property({ tooltip: 'Задержка перед появлением кнопки на popup (сек)' })
    popupButtonDelay = 0.18;

    @property({ tooltip: 'Длительность появления кнопки на popup (сек)' })
    popupButtonFadeDuration = 0.22;

    @property({ tooltip: 'App Store — кнопки PopupWin / PopupLose на iOS (и iPhone/iPad в браузере)' })
    storeUrlIos = 'https://apps.apple.com/app/id6757395652';

    @property({ tooltip: 'Google Play — на Android (и Android в браузере)' })
    storeUrlAndroid = 'https://play.google.com/store/apps/details?id=com.playgames.sorting';

    @property({
        tooltip:
            'Если ОС не iOS/Android (десктоп в браузере): какой URL открыть. Пусто — используется storeUrlAndroid',
    })
    storeUrlFallback = '';

    private _ended = false;
    private _wrongFoodClicks = 0;
    private _queue: FryingOrdersQueue | null = null;
    private _popupButtonsWired = false;
    private _unfilledConveyorTrays = 0;
    private _completedFullTrays = 0;
    private _timedWinStarted = false;

    private readonly _onTimedWinExpired = (): void => {
        if (this._ended) return;
        this.enterWin();
    };

    private readonly _onPopupDownloadClick = () => this.openStoreForCurrentDevice();

    /** Кнопки Win/Lose: открыть нужный магазин; затем SDK (если есть). */
    private openStoreForCurrentDevice(): void {
        const url = this.resolveStoreUrlForDevice();
        if (url) {
            sys.openURL(url);
        }
        super_html_playable.download();
    }

    private resolveStoreUrlForDevice(): string {
        const ios = (this.storeUrlIos || '').trim();
        const android = (this.storeUrlAndroid || '').trim();
        const fallbackRaw = (this.storeUrlFallback || '').trim();
        const fallback = fallbackRaw || android;

        if (sys.os === sys.OS.IOS) {
            return ios || fallback;
        }
        if (sys.os === sys.OS.ANDROID || sys.os === sys.OS.OHOS || sys.os === sys.OS.OPENHARMONY) {
            return android || ios;
        }

        if (sys.isBrowser && typeof navigator !== 'undefined') {
            const ua = navigator.userAgent || '';
            if (/iPad|iPhone|iPod/i.test(ua)) {
                return ios || fallback;
            }
            if (/Android/i.test(ua)) {
                return android || ios;
            }
        }

        return fallback || ios || android;
    }

    protected override onLoad(): void {
        SorEndgameController.I = this;
        if (!this.popupWinRoot) {
            this.popupWinRoot = this.findPopupRootFallback('PopupWin');
        }
        if (!this.popupLoseRoot) {
            this.popupLoseRoot = this.findPopupRootFallback('PopupLose');
        }
        this.setPopupVisible(this.popupWinRoot, false);
        this.setPopupVisible(this.popupLoseRoot, false);
    }

    protected override onDestroy(): void {
        this.unschedule(this._onTimedWinExpired);
        if (SorEndgameController.I === this) {
            SorEndgameController.I = null;
        }
    }

    protected override start(): void {
        this.scheduleOnce(() => this.bindQueueIfNeeded(), 0);
        this.scheduleOnce(() => this.bindQueueIfNeeded(), 0.12);
        this.wirePopupButtons();
    }

    public notifyFirstCorrectPick(): void {
        if (this._ended || this._timedWinStarted) return;
        const sec = this.getTimedWinDurationSec();
        if (sec <= 0) return;
        this._timedWinStarted = true;
        this.scheduleOnce(this._onTimedWinExpired, sec);
    }

    private getTimedWinDurationSec(): number {
        const sec = Number(this.timedWinDuration);
        return Number.isFinite(sec) && sec > 0 ? sec : 0;
    }

    private hasTimedWinMode(): boolean {
        return this.getTimedWinDurationSec() > 0;
    }

    public isGameEnded(): boolean {
        return this._ended;
    }

    private setPopupVisible(root: Node | null, on: boolean): void {
        if (root?.isValid) root.active = on;
    }

    private findPopupRootFallback(name: string): Node | null {
        const parent = this.node.parent;
        if (parent?.isValid) {
            const sibling = parent.getChildByName(name);
            if (sibling?.isValid) {
                return sibling;
            }
        }
        return this.findDescendantByName(director.getScene(), name);
    }

    private findDescendantByName(root: Node | null, name: string): Node | null {
        if (!root?.isValid) return null;
        if (root.name === name) return root;
        for (let i = 0; i < root.children.length; i++) {
            const found = this.findDescendantByName(root.children[i]!, name);
            if (found) return found;
        }
        return null;
    }

    private ensureOpacity(node: Node | null): UIOpacity | null {
        if (!node?.isValid) return null;
        return node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
    }

    /** После активации popup — пересчитать BackgroundCover (Widget/layout, dim на весь экран). */
    private refreshPopupBackgroundCovers(root: Node | null): void {
        if (!root?.isValid) return;
        const covers = root.getComponentsInChildren(BackgroundCover);
        for (let i = 0; i < covers.length; i++) {
            covers[i]!.applyCover();
        }
    }

    private playEndgamePopupSound(clip: AudioClip | null): void {
        if (!clip) return;
        AudioManager.instance?.allowSfxAfterUserInteraction();
        AudioManager.instance?.playSound(clip);
    }

    private showPopupAnimated(root: Node | null, revealNodes: Node[] = [], buttonNodeOverride: Node | null = null): void {
        if (!root?.isValid) return;
        root.active = true;
        this.scheduleOnce(() => this.refreshPopupBackgroundCovers(root), 0);

        const rootOpacity = this.ensureOpacity(root);
        const buttonNode = this.resolvePopupButtonNode(root, buttonNodeOverride);
        const button = buttonNode?.getComponent(Button) ?? null;
        const buttonOpacity = this.ensureOpacity(buttonNode);
        const orderedRevealNodes = this.normalizeRevealNodes(revealNodes, buttonNode);

        if (button) {
            button.interactable = false;
        }
        if (buttonNode) {
            buttonNode.active = true;
        }
        for (let i = 0; i < orderedRevealNodes.length; i++) {
            const n = orderedRevealNodes[i]!;
            n.active = true;
            const opacity = this.ensureOpacity(n);
            if (opacity) {
                opacity.opacity = 0;
            }
        }

        if (rootOpacity) {
            rootOpacity.opacity = 0;
            tween(rootOpacity)
                .to(Math.max(0.01, this.popupFadeDuration), { opacity: 255 }, { easing: 'sineInOut' })
                .start();
        }

        const revealStartDelay = Math.max(0, this.popupWinRevealStartDelay);
        const revealStepDelay = Math.max(0, this.popupWinRevealStepDelay);
        const revealFadeDuration = Math.max(0.01, this.popupWinRevealFadeDuration);
        for (let i = 0; i < orderedRevealNodes.length; i++) {
            const n = orderedRevealNodes[i]!;
            const opacity = this.ensureOpacity(n);
            if (!opacity) continue;
            tween(opacity)
                .delay(revealStartDelay + i * revealStepDelay)
                .to(revealFadeDuration, { opacity: 255 }, { easing: 'sineInOut' })
                .start();
        }

        if (buttonOpacity) {
            buttonOpacity.opacity = 0;
            tween(buttonOpacity)
                .delay(
                    revealStartDelay +
                    orderedRevealNodes.length * revealStepDelay +
                    Math.max(0, this.popupButtonDelay),
                )
                .to(Math.max(0.01, this.popupButtonFadeDuration), { opacity: 255 }, { easing: 'sineInOut' })
                .call(() => {
                    if (button?.isValid) {
                        button.interactable = true;
                    }
                })
                .start();
        } else if (button?.isValid) {
            button.interactable = true;
        }
    }

    private resolvePopupButtonNode(root: Node | null, overrideNode: Node | null): Node | null {
        if (overrideNode?.isValid) {
            return overrideNode;
        }
        const btn = root?.getComponentInChildren(Button);
        return btn?.node?.isValid ? btn.node : null;
    }

    private normalizeRevealNodes(nodes: Node[], buttonNode: Node | null): Node[] {
        const out: Node[] = [];
        const seen = new Set<Node>();
        for (let i = 0; i < nodes.length; i++) {
            const n = nodes[i];
            if (!n?.isValid || n === buttonNode || seen.has(n)) {
                continue;
            }
            seen.add(n);
            out.push(n);
        }
        return out;
    }

    private wirePopupButtons(): void {
        if (this._popupButtonsWired) return;
        this._popupButtonsWired = true;
        for (const root of [this.popupWinRoot, this.popupLoseRoot]) {
            if (!root?.isValid) continue;
            const btn = root.getComponentInChildren(Button);
            if (btn?.node?.isValid) {
                btn.node.on(Button.EventType.CLICK, this._onPopupDownloadClick, this);
            }
        }
    }

    private findQueue(): FryingOrdersQueue | null {
        return director.getScene()?.getComponentInChildren(FryingOrdersQueue) ?? null;
    }

    private bindQueueIfNeeded(): void {
        if (this._ended) return;
        const q = this.findQueue();
        if (!q || q.advanceBlockedByEndgame) return;
        this._queue = q;
        q.advanceBlockedByEndgame = (completedIdx, rowCount) => this.tryConsumeWin(completedIdx, rowCount);
    }

    private tryConsumeWin(_completedIdx: number, _rowCount: number): boolean {
        if (this._ended) {
            return false;
        }
        this._completedFullTrays++;
        const need = Math.max(1, Math.floor(this.winAfterFilledTrays));
        if (this._completedFullTrays < need) {
            return false;
        }
        this.enterWin();
        return true;
    }

    private freezePlay(): void {
        if (PhysicsSystem2D.instance) {
            PhysicsSystem2D.instance.enable = false;
        }
        const scene = director.getScene();
        const bowls = scene?.getComponentsInChildren(ContainerPhysicsBowl) ?? [];
        for (let i = 0; i < bowls.length; i++) {
            bowls[i]!.stopSpawning();
        }
        (this._queue ?? this.findQueue())?.freeze();

        const all = scene?.getComponentsInChildren(Component) ?? [];
        for (let i = 0; i < all.length; i++) {
            const fr = all[i] as FryInputController;
            if (typeof fr.setBoardInputEnabled === 'function') {
                fr.setBoardInputEnabled(false);
            }
        }
    }

    public reportWrongFoodPick(): void {
        if (this._ended || this.hasTimedWinMode()) return;
        this._wrongFoodClicks++;
        const maxW = Math.max(1, Math.floor(this.maxWrongFoodClicks));
        if (this._wrongFoodClicks >= maxW) {
            this.enterLose();
        }
    }

    /**
     * Поднос уехал за левый край без 3/3 (FryingOrdersQueue + конвейер).
     * @returns true если игра уже завершена (в т.ч. только что вызван проигрыш).
     */
    public reportUnfilledConveyorTray(): boolean {
        if (this._ended) {
            return true;
        }
        this._unfilledConveyorTrays++;
        const limit = Math.max(1, Math.floor(this.maxUnfilledConveyorTrays));
        if (this._unfilledConveyorTrays >= limit) {
            this.enterLose();
            return true;
        }
        return false;
    }

    private enterWin(): void {
        if (this._ended) return;
        this._ended = true;
        this.freezePlay();
        AudioManager.instance?.stopBackgroundMusic();
        this.setPopupVisible(this.popupLoseRoot, false);
        this.playEndgamePopupSound(this.popupWinSound);
        this.showPopupAnimated(this.popupWinRoot, this.popupWinRevealNodes, this.popupWinButtonRoot);
        super_html_playable.game_end();
    }

    private enterLose(): void {
        if (this._ended) return;
        this._ended = true;
        this.freezePlay();
        AudioManager.instance?.stopBackgroundMusic();
        this.setPopupVisible(this.popupWinRoot, false);
        this.playEndgamePopupSound(this.popupLoseSound);
        this.showPopupAnimated(this.popupLoseRoot);
        super_html_playable.game_end();
    }
}
