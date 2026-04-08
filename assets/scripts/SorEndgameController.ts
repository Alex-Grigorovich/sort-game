import { _decorator, Button, Component, director, Node, PhysicsSystem2D, sys } from 'cc';
import { property } from '../core/scripts/playableCore/property';
import super_html_playable from '../core/scripts/playableCore/super_html_playable';
import { ContainerPhysicsBowl } from './ContainerPhysicsBowl';
import { FryingOrdersQueue } from './FryingOrdersQueue';

const { ccclass } = _decorator;

type FryInputController = Component & {
    setBoardInputEnabled?: (on: boolean) => void;
};

/**
 * Два попапа (PopupWin / PopupLose): проигрыш после N неверных кликов по еде на конвейере;
 * выигрыш после завершения заказа по индексу. Если задан sessionDurationSec (>0) — сессия длится
 * фиксированное число секунд: выигрыш внутри срока фиксируется (заморозка), попап Win в конце срока;
 * иначе по таймеру — PopupLose. Без лимита времени выигрыш сразу как раньше.
 */
@ccclass('SorEndgameController')
export class SorEndgameController extends Component {
    public static I: SorEndgameController | null = null;

    @property({ tooltip: 'Пусто — дочерний PopupWin на GameField' })
    popupWinRoot: Node | null = null;

    @property({ tooltip: 'Пусто — дочерний PopupLose на GameField' })
    popupLoseRoot: Node | null = null;

    @property({ tooltip: 'Сколько неверных кликов по еде (не тот заказ) до проигрыша' })
    maxWrongFoodClicks = 2;

    @property({
        tooltip:
            'Индекс подноса (0 = первый), после 3/3 на котором засчитать победу. -1 = последний поднос в очереди (все fry в игре).',
    })
    winOnCompletedRowIndex = -1;

    @property({ tooltip: 'Минимум рядов в очереди, чтобы сработал выигрыш по двум конвейерам' })
    minRowsForWin = 2;

    // @property({
    //     tooltip:
    //         'Фиксированная длительность сессии в секундах. > 0: ждать это время и в конце показать Lose/Win; <= 0: без лимита',
    // })
    sessionDurationSec = 0;

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
    /** Условие выигрыша выполнено до конца таймера сессии (попап откладывается до таймера). */
    private _sessionWinAchieved = false;
    private _wrongFoodClicks = 0;
    private _queue: FryingOrdersQueue | null = null;
    private _popupButtonsWired = false;

    private readonly _onSessionTimeExpired = (): void => {
        if (this._ended) return;
        if (this._sessionWinAchieved) {
            this.finalizeDeferredWin();
        } else {
            this.enterLose();
        }
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
            this.popupWinRoot = this.node.getChildByName('PopupWin');
        }
        if (!this.popupLoseRoot) {
            this.popupLoseRoot = this.node.getChildByName('PopupLose');
        }
        this.setPopupVisible(this.popupWinRoot, false);
        this.setPopupVisible(this.popupLoseRoot, false);
    }

    protected override onDestroy(): void {
        this.unschedule(this._onSessionTimeExpired);
        if (SorEndgameController.I === this) {
            SorEndgameController.I = null;
        }
    }

    protected override start(): void {
        this.scheduleOnce(() => this.bindQueueIfNeeded(), 0);
        this.scheduleOnce(() => this.bindQueueIfNeeded(), 0.12);
        this.wirePopupButtons();
        //this.scheduleSessionTimeLimit();
    }

    private hasSessionTimeLimit(): boolean {
        const sec = Number(this.sessionDurationSec);
        return Number.isFinite(sec) && sec > 0;
    }

    private scheduleSessionTimeLimit(): void {
        const sec = Number(this.sessionDurationSec);
        if (!Number.isFinite(sec) || sec <= 0) return;
        this.scheduleOnce(this._onSessionTimeExpired, sec);
    }

    private cancelSessionTimeLimit(): void {
        this.unschedule(this._onSessionTimeExpired);
    }

    private setPopupVisible(root: Node | null, on: boolean): void {
        if (root?.isValid) root.active = on;
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

    private tryConsumeWin(completedIdx: number, rowCount: number): boolean {
        if (this._ended) return false;
        const raw = Math.floor(this.winOnCompletedRowIndex);
        const needIdx = raw < 0 ? Math.max(0, rowCount - 1) : Math.max(0, raw);
        const minRows = Math.max(1, Math.floor(this.minRowsForWin));
        if (rowCount < minRows || completedIdx !== needIdx) {
            return false;
        }
        if (this.hasSessionTimeLimit()) {
            this.markSessionWin();
        } else {
            this.enterWin();
        }
        return true;
    }

    /** Выигрыш до конца таймера: заморозка сразу, попап Win — в _onSessionTimeExpired. */
    private markSessionWin(): void {
        if (this._ended || this._sessionWinAchieved) return;
        this._sessionWinAchieved = true;
        this.freezePlay();
    }

    private finalizeDeferredWin(): void {
        if (this._ended) return;
        this._ended = true;
        this.setPopupVisible(this.popupLoseRoot, false);
        this.setPopupVisible(this.popupWinRoot, true);
        super_html_playable.game_end();
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
        if (this._ended || this._sessionWinAchieved) return;
        this._wrongFoodClicks++;
        const maxW = Math.max(1, Math.floor(this.maxWrongFoodClicks));
        if (this._wrongFoodClicks >= maxW) {
            this.enterLose();
        }
    }

    private enterWin(): void {
        if (this._ended) return;
        this._ended = true;
        this.freezePlay();
        this.setPopupVisible(this.popupLoseRoot, false);
        this.setPopupVisible(this.popupWinRoot, true);
        super_html_playable.game_end();
    }

    private enterLose(): void {
        if (this._ended) return;
        this.cancelSessionTimeLimit();
        this._ended = true;
        this.freezePlay();
        this.setPopupVisible(this.popupWinRoot, false);
        this.setPopupVisible(this.popupLoseRoot, true);
        super_html_playable.game_end();
    }
}
