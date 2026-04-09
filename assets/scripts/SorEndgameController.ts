import { _decorator, Button, Component, director, easing, Node, PhysicsSystem2D, sys, tween, Tween, Vec3 } from 'cc';
import { property } from '../core/scripts/playableCore/property';
import super_html_playable from '../core/scripts/playableCore/super_html_playable';
import { ContainerPhysicsBowl } from './ContainerPhysicsBowl';
import { FryingOrdersQueue } from './FryingOrdersQueue';

const { ccclass } = _decorator;

type FryInputController = Component & {
    setBoardInputEnabled?: (on: boolean) => void;
};

/**
 * PopupWin / PopupLose: проигрыш после N неверных кликов по еде;
 * выигрыш после завершения заказа по индексу. sessionDurationSec: лимит сессии.
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
            'Индекс подноса (0 = первый), после 3/3 на котором засчитать победу. -1 = последний поднос в очереди. Для «победа после N-го лотка» поставь N−1 (например 3 = четвёртый лоток).',
    })
    winOnCompletedRowIndex = 3;

    @property({
        tooltip: 'Минимум рядов в очереди; для победы после 4 лотков должно быть ≥4',
    })
    minRowsForWin = 4;

    @property({ tooltip: 'Длительность появления PopupWin / PopupLose: масштаб от центра (сек)' })
    popupOpenAnimDurationSec = 0.38;

    @property({ tooltip: 'Кнопка в попапе: пульсация scale до этого множителя и обратно (бесконечно)' })
    popupButtonPulseScale = 1.5;

    @property({ tooltip: 'Полупериод пульса («до 1.5» или «обратно»), сек; полный цикл = 2×' })
    popupButtonPulseHalfPeriodSec = 0.55;

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
    private _sessionWinAchieved = false;
    private _wrongFoodClicks = 0;
    private _queue: FryingOrdersQueue | null = null;
    private readonly _wiredPopupButtonNodeUuids = new Set<string>();
    private readonly _popupWinScaleRest = new Vec3(1, 1, 1);
    private readonly _popupLoseScaleRest = new Vec3(1, 1, 1);
    private readonly _popupWinBtnScale0 = new Vec3(1, 1, 1);
    private readonly _popupLoseBtnScale0 = new Vec3(1, 1, 1);

    private readonly _onSessionTimeExpired = (): void => {
        if (this._ended) return;
        if (this._sessionWinAchieved) {
            this.finalizeDeferredWin();
        } else {
            this.enterLose();
        }
    };

    private readonly _onPopupDownloadClick = () => this.openStoreForCurrentDevice();

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
        this.resolvePopupRoots();
        this.refreshPopupRestScalesFromNodes();
        this.captureDownloadButtonRestScales();
        this.hidePopupInstant(this.popupWinRoot, this._popupWinScaleRest);
        this.hidePopupInstant(this.popupLoseRoot, this._popupLoseScaleRest);
    }

    protected override onDestroy(): void {
        this.stopPopupDownloadButtonPulse(this.popupWinRoot);
        this.stopPopupDownloadButtonPulse(this.popupLoseRoot);
        this.unschedule(this._onSessionTimeExpired);
        if (SorEndgameController.I === this) {
            SorEndgameController.I = null;
        }
    }

    protected override start(): void {
        this.resolvePopupRoots();
        this.wirePopupButtons();
        this.scheduleOnce(() => {
            this.resolvePopupRoots();
            this.wirePopupButtons();
            this.bindQueueIfNeeded();
        }, 0);
        this.scheduleOnce(() => {
            this.resolvePopupRoots();
            this.wirePopupButtons();
            this.bindQueueIfNeeded();
        }, 0.12);
    }

    private resolvePopupRoots(): void {
        if (!this.popupWinRoot?.isValid) {
            this.popupWinRoot =
                this.node.getChildByName('PopupWin') ?? this.node.parent?.getChildByName('PopupWin') ?? null;
        }
        if (!this.popupLoseRoot?.isValid) {
            this.popupLoseRoot =
                this.node.getChildByName('PopupLose') ?? this.node.parent?.getChildByName('PopupLose') ?? null;
        }
    }

    private hasSessionTimeLimit(): boolean {
        const sec = Number(this.sessionDurationSec);
        return Number.isFinite(sec) && sec > 0;
    }

    private cancelSessionTimeLimit(): void {
        this.unschedule(this._onSessionTimeExpired);
    }

    private capturePopupRestScale(root: Node | null, out: Vec3): void {
        if (!root?.isValid) {
            out.set(1, 1, 1);
            return;
        }
        const s = root.scale;
        const sx = Math.abs(s.x) < 1e-5 ? 1 : s.x;
        const sy = Math.abs(s.y) < 1e-5 ? 1 : s.y;
        out.set(sx, sy, s.z);
    }

    private refreshPopupRestScalesFromNodes(): void {
        this.capturePopupRestScale(this.popupWinRoot, this._popupWinScaleRest);
        this.capturePopupRestScale(this.popupLoseRoot, this._popupLoseScaleRest);
    }

    private captureDownloadButtonRestScales(): void {
        this.resolvePopupRoots();
        const snap = (popupRoot: Node | null, out: Vec3) => {
            const bn = popupRoot?.getComponentInChildren(Button)?.node;
            if (bn?.isValid) {
                const s = bn.scale;
                out.set(s.x, s.y, s.z);
            }
        };
        snap(this.popupWinRoot, this._popupWinBtnScale0);
        snap(this.popupLoseRoot, this._popupLoseBtnScale0);
    }

    private stopPopupDownloadButtonPulse(popupRoot: Node | null): void {
        const bn = popupRoot?.getComponentInChildren(Button)?.node;
        if (!bn?.isValid) return;
        Tween.stopAllByTarget(bn);
        if (popupRoot === this.popupWinRoot) {
            bn.setScale(this._popupWinBtnScale0.x, this._popupWinBtnScale0.y, this._popupWinBtnScale0.z);
        } else if (popupRoot === this.popupLoseRoot) {
            bn.setScale(this._popupLoseBtnScale0.x, this._popupLoseBtnScale0.y, this._popupLoseBtnScale0.z);
        }
    }

    private startPopupDownloadButtonPulse(popupRoot: Node | null): void {
        if (!popupRoot?.isValid || !popupRoot.active) return;
        const bn = popupRoot.getComponentInChildren(Button)?.node;
        if (!bn?.isValid) return;

        const rest =
            popupRoot === this.popupWinRoot ? this._popupWinBtnScale0 : popupRoot === this.popupLoseRoot ? this._popupLoseBtnScale0 : null;
        if (!rest) return;

        const s = bn.scale;
        rest.set(s.x, s.y, s.z);

        Tween.stopAllByTarget(bn);
        const mul = Math.max(1.001, Number(this.popupButtonPulseScale) || 1.5);
        const half = Math.max(0.08, Number(this.popupButtonPulseHalfPeriodSec) || 0.55);
        const peak = new Vec3(rest.x * mul, rest.y * mul, rest.z);
        const restClone = new Vec3(rest.x, rest.y, rest.z);
        bn.setScale(restClone);

        tween(bn)
            .to(half, { scale: peak }, { easing: easing.sineInOut })
            .to(half, { scale: restClone }, { easing: easing.sineInOut })
            .repeatForever()
            .start();
    }

    private hidePopupInstant(root: Node | null, restScale: Vec3): void {
        if (!root?.isValid) return;
        this.stopPopupDownloadButtonPulse(root);
        Tween.stopAllByTarget(root);
        root.active = false;
        root.setScale(restScale.x, restScale.y, restScale.z);
    }

    private showPopupScaleIn(root: Node | null, restScale: Vec3, onOpenComplete?: () => void): void {
        if (!root?.isValid) return;
        const dur = Math.max(0.05, Number(this.popupOpenAnimDurationSec) || 0.38);
        Tween.stopAllByTarget(root);
        root.active = true;
        const k = 0.04;
        root.setScale(restScale.x * k, restScale.y * k, restScale.z);
        const tw = tween(root).to(dur, { scale: restScale }, { easing: easing.backOut });
        if (onOpenComplete) {
            tw.call(onOpenComplete);
        }
        tw.start();
    }

    private wirePopupButtons(): void {
        this.resolvePopupRoots();
        for (const root of [this.popupWinRoot, this.popupLoseRoot]) {
            if (!root?.isValid) continue;
            const btn = root.getComponentInChildren(Button);
            const bn = btn?.node;
            if (!bn?.isValid) continue;
            const id = bn.uuid;
            if (this._wiredPopupButtonNodeUuids.has(id)) continue;
            bn.on(Button.EventType.CLICK, this._onPopupDownloadClick, this);
            this._wiredPopupButtonNodeUuids.add(id);
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

    private markSessionWin(): void {
        if (this._ended || this._sessionWinAchieved) return;
        this._sessionWinAchieved = true;
        this.freezePlay();
    }

    private finalizeDeferredWin(): void {
        if (this._ended) return;
        this._ended = true;
        this.resolvePopupRoots();
        this.refreshPopupRestScalesFromNodes();
        this.hidePopupInstant(this.popupLoseRoot, this._popupLoseScaleRest);
        this.captureDownloadButtonRestScales();
        this.showPopupScaleIn(this.popupWinRoot, this._popupWinScaleRest, () =>
            this.startPopupDownloadButtonPulse(this.popupWinRoot),
        );
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
        this.resolvePopupRoots();
        this.refreshPopupRestScalesFromNodes();
        this.hidePopupInstant(this.popupLoseRoot, this._popupLoseScaleRest);
        this.captureDownloadButtonRestScales();
        this.showPopupScaleIn(this.popupWinRoot, this._popupWinScaleRest, () =>
            this.startPopupDownloadButtonPulse(this.popupWinRoot),
        );
        super_html_playable.game_end();
    }

    private enterLose(): void {
        if (this._ended) return;
        this.cancelSessionTimeLimit();
        this._ended = true;
        this.freezePlay();
        this.resolvePopupRoots();
        this.refreshPopupRestScalesFromNodes();
        this.hidePopupInstant(this.popupWinRoot, this._popupWinScaleRest);
        this.captureDownloadButtonRestScales();
        this.showPopupScaleIn(this.popupLoseRoot, this._popupLoseScaleRest, () =>
            this.startPopupDownloadButtonPulse(this.popupLoseRoot),
        );
        super_html_playable.game_end();
    }
}
