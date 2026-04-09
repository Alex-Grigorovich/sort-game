import { _decorator, Component, easing, Node, tween, Tween, Vec3 } from 'cc';
import { property } from '../core/scripts/playableCore/property';

const { ccclass } = _decorator;

type FryRowController = Component & {
    queueSlotSpacingX?: number;
    queueCompletedExitLeft?: number;
    queueLayoutTweenDuration?: number;
    queueCompletePauseSec?: number;
    trayServeTimeLimitSec?: number;
    orderCompleteDelegate?: (() => void) | null;
    setBoardInputEnabled?: (on: boolean) => void;
    needsDeferredKickstart?: () => boolean;
    kickstartOrder?: () => void;
};

/**
 * Очередь подносов: первый статичен у «якоря»; после 3/3 — пауза, отцепление и уход влево
 * (без дискретного сдвига следующих лотков). Затем лента непрерывно везёт остальных влево.
 * Незаполненные уезжают за экран (2 пропуска = проигрыш). Со 2-го подноса при 3/3 — так же
 * пауза, отцепление, уход; остальные на ленте не останавливаются.
 */
@ccclass('FryingOrdersQueue')
export class FryingOrdersQueue extends Component {
    @property({
        tooltip:
            'Скорость смены лотков: длительность tween ухода первого подноса и сдвига (сек). −1 = FryOrdersSimpleController.queueLayoutTweenDuration.',
    })
    trayReplaceTweenDurationSec = -1;

    @property({
        tooltip:
            'Пауза после 3/3 первого подноса до старта анимации ухода (сек). −1 = queueCompletePauseSec.',
    })
    trayReplacePauseBeforeExitSec = -1;

    @property({
        tooltip:
            'Скорость конвейера после первого подноса (px/сек в локали родителя лотков).',
    })
    beltSpeedPxPerSec = 72;

    @property({
        tooltip:
            'Полуширина зоны «заказа» от anchor.x (px): лоток в интервале получает ввод.',
    })
    serveZoneHalfWidthPx = 48;

    @property({
        tooltip:
            'Лоток на ленте левее (anchor.x − это значение) считается пропущенным и исчезает.',
    })
    beltMissLeftBeyondAnchorPx = 90;

    @property({ tooltip: 'Сколько незаполненных ушедших подносов до проигрыша (обычно 2).' })
    missedUnfilledTraysToLose = 2;

    @property({
        tooltip:
            'Взять шаг между лотками из позиций в сцене (первые два fry), если включено.',
    })
    lockSpacingToScenePositions = true;

    private _rows: Node[] = [];
    private _activeIndex = 0;
    /** При работающей ленте — индекс подноса в зоне подачи (синхронизируется с FryOrders._activeRow). */
    private _serveIndex = 0;
    private readonly _anchor = new Vec3();
    private _spacing = 95;
    private _exitLeft = 320;
    private _dur = 0.28;
    private _completePause = 1.0;
    private _frozen = false;

    /** До ухода первого подноса лента выключена. */
    private _beltRunning = false;

    private readonly _onBelt: boolean[] = [];
    private readonly _detaching: boolean[] = [];
    private readonly _detachRemain: number[] = [];
    private readonly _beltMissRegistered: boolean[] = [];
    /** Чтобы kickstartOrder не дергать каждый кадр на ленте. */
    private readonly _rowHadServeInput: boolean[] = [];
    private _missedUnfilledTotal = 0;

    private _getRowFilled: ((rowIndex: number) => number) | null = null;
    private _onTrayMissed: (() => void) | null = null;

    /** Возвращает true, если endgame обработал завершение ряда (победа). */
    public advanceBlockedByEndgame: ((completedIdx: number, rowCount: number) => boolean) | null = null;

    private resizeBoolArrays(len: number): void {
        while (this._onBelt.length < len) {
            this._onBelt.push(false);
            this._detaching.push(false);
            this._detachRemain.push(0);
            this._beltMissRegistered.push(false);
            this._rowHadServeInput.push(false);
        }
    }

    public bindRows(rows: Node[]): void {
        this._rows = rows.filter((n) => n?.isValid);
        if (this._rows.length === 0) return;
        this._frozen = false;
        this._beltRunning = false;
        this._missedUnfilledTotal = 0;

        const lead = this.resolveQueueSettingsSource(this._rows[0]!);
        if (lead) {
            this._spacing = Math.max(1, Number(lead.queueSlotSpacingX) || this._spacing);
            this._exitLeft = Math.max(0, Number(lead.queueCompletedExitLeft) || this._exitLeft);
            this._dur = Math.max(0.01, Number(lead.queueLayoutTweenDuration) || this._dur);
            this._completePause = Math.max(0, lead.queueCompletePauseSec ?? 1.0);
        }

        if (this.trayReplaceTweenDurationSec >= 0) {
            this._dur = Math.max(0.01, Number(this.trayReplaceTweenDurationSec) || 0.01);
        }
        if (this.trayReplacePauseBeforeExitSec >= 0) {
            this._completePause = Math.max(0, Number(this.trayReplacePauseBeforeExitSec));
        }

        if (this.lockSpacingToScenePositions && this._rows.length >= 2) {
            const measured = Math.abs(this._rows[1]!.position.x - this._rows[0]!.position.x);
            if (measured > 2) {
                this._spacing = measured;
            }
        }

        this._anchor.set(this._rows[0]!.position);
        this._activeIndex = 0;
        this._serveIndex = 0;

        const len = this._rows.length;
        this.resizeBoolArrays(len);
        for (let i = 0; i < len; i++) {
            this._onBelt[i] = false;
            this._detaching[i] = false;
            this._detachRemain[i] = 0;
            this._beltMissRegistered[i] = false;
            this._rowHadServeInput[i] = false;
        }

        for (let i = 0; i < this._rows.length; i++) {
            const fr = this.getRowController(this._rows[i]!);
            if (!fr) continue;
            const idx = i;
            fr.orderCompleteDelegate = () => this.onRowCompleteFromDelegate(idx);
        }

        this.layoutAllImmediate();
        this.refreshServeRowAndInput();
    }

    /** Заполнение по индексу + проигрыш при N пропусках. */
    public setBeltMissHandlers(getFilled: (rowIndex: number) => number, onMissedEnough: () => void): void {
        this._getRowFilled = getFilled;
        this._onTrayMissed = onMissedEnough;
    }

    public getActiveRowIndex(): number {
        return this._beltRunning ? this._serveIndex : this._activeIndex;
    }

    public notifyActiveRowComplete(): void {
        this.onRowCompleteFromDelegate(this.getActiveRowIndex());
    }

    private onRowCompleteFromDelegate(completedIdx: number): void {
        this.onRowComplete(completedIdx);
    }

    private onRowComplete(completedIdx: number): void {
        if (this._frozen) return;
        if (this.advanceBlockedByEndgame?.(completedIdx, this._rows.length)) return;

        if (this._beltRunning) {
            if (completedIdx !== this._serveIndex) return;
            const filled = this._getRowFilled?.(completedIdx) ?? 0;
            if (filled < 3) return;
            this.beginDetachedCompleteExit(completedIdx);
            return;
        }

        if (completedIdx !== this._activeIndex) return;

        const completed = this._rows[completedIdx];
        if (!completed?.isValid) return;

        this._conveyorPausedForComplete = true;
        this.unschedule(this.runFirstTrayAfterCompletePause);

        this.disableAllRowInput();

        if (this._completePause > 0) {
            this.scheduleOnce(this.runFirstTrayAfterCompletePause, this._completePause);
        } else {
            this.runFirstTrayAfterCompletePause();
        }
    }

    private _conveyorPausedForComplete = false;

    private disableAllRowInput(): void {
        for (let i = 0; i < this._rows.length; i++) {
            this.getRowController(this._rows[i]!)?.setBoardInputEnabled?.(false);
        }
    }

    private readonly runFirstTrayAfterCompletePause = (): void => {
        if (this._frozen) return;
        this.runFirstTrayDetachTweenAndStartBelt();
    };

    /** После паузы 3/3: первый поднос уезжает влево; следующие не двигаются дискретно — только потом лента. */
    private runFirstTrayDetachTweenAndStartBelt(): void {
        if (this._frozen) return;
        const n = this._rows[0];
        if (!n?.isValid) {
            this.finalizeStartBeltAfterFirstTrayExit();
            return;
        }
        if (!n.active) {
            this.finalizeStartBeltAfterFirstTrayExit();
            return;
        }

        Tween.stopAllByTarget(n);
        const p = n.position;
        const out = new Vec3(p.x - this._exitLeft, p.y, p.z);
        const dur = Math.max(0.18, this._dur * 1.8);
        tween(<Node>n)
            .to(dur, { position: out }, { easing: easing.sineInOut })
            .call(() => {
                n.active = false;
                this.finalizeStartBeltAfterFirstTrayExit();
            })
            .start();
    }

    private finalizeStartBeltAfterFirstTrayExit(): void {
        if (this._frozen) return;
        this._conveyorPausedForComplete = false;
        this._beltRunning = true;
        for (let i = 0; i < this._rows.length; i++) {
            this._onBelt[i] = !!(this._rows[i]?.active);
        }
        this.refreshServeRowAndInput();
    }

    private beginDetachedCompleteExit(idx: number): void {
        if (this._frozen || this._detaching[idx]) return;
        const n = this._rows[idx];
        if (!n?.isValid || !n.active) return;
        const filled = this._getRowFilled?.(idx) ?? 0;
        if (filled < 3) return;

        this._detaching[idx] = true;
        this._detachRemain[idx] = Math.max(0.05, this._completePause);
        Tween.stopAllByTarget(n);
    }

    private runDetachTweenOffLeft(idx: number): void {
        const n = this._rows[idx];
        if (!n?.isValid) {
            this._detaching[idx] = false;
            return;
        }
        const p = n.position;
        const out = new Vec3(p.x - this._exitLeft, p.y, p.z);
        const dur = Math.max(0.18, this._dur * 1.8);
        tween(<Node>n)
            .to(dur, { position: out }, { easing: easing.sineInOut })
            .call(() => {
                n.active = false;
                this._detaching[idx] = false;
                this._onBelt[idx] = false;
                this.refreshServeRowAndInput();
            })
            .start();
    }

    private registerBeltMiss(idx: number): void {
        if (this._beltMissRegistered[idx]) return;
        const filled = this._getRowFilled?.(idx) ?? 0;
        if (filled >= 3) return;

        this._beltMissRegistered[idx] = true;
        this._missedUnfilledTotal++;

        const n = this._rows[idx];
        if (n?.isValid) {
            Tween.stopAllByTarget(n);
            n.active = false;
        }
        this._onBelt[idx] = false;
        this._detaching[idx] = false;

        const loseAt = Math.max(1, Math.floor(this.missedUnfilledTraysToLose));
        if (this._missedUnfilledTotal >= loseAt) {
            this._onTrayMissed?.();
        }
        this.refreshServeRowAndInput();
    }

    protected override update(dt: number): void {
        if (this._frozen || !this._beltRunning || this._rows.length === 0) return;

        const speed = Math.max(0, Number(this.beltSpeedPxPerSec) || 0);
        const dx = speed * dt;

        for (let i = 0; i < this._rows.length; i++) {
            const n = this._rows[i];
            if (!n?.isValid || !n.active) continue;
            if (!this._onBelt[i]) continue;
            if (this._detaching[i]) continue;

            const p = n.position;
            n.setPosition(p.x - dx, p.y, p.z);
        }

        for (let i = 0; i < this._rows.length; i++) {
            if (!this._detaching[i]) continue;
            const prevRemain = this._detachRemain[i] ?? 0;
            if (prevRemain <= 0) continue;
            const nextRemain = prevRemain - dt;
            this._detachRemain[i] = nextRemain;
            if (nextRemain <= 0) {
                this._detachRemain[i] = 0;
                this.runDetachTweenOffLeft(i);
            }
        }

        const missX = this._anchor.x - Math.max(20, Number(this.beltMissLeftBeyondAnchorPx) || 90);
        for (let i = 0; i < this._rows.length; i++) {
            const n = this._rows[i];
            if (!n?.isValid || !n.active) continue;
            if (!this._onBelt[i]) continue;
            if (this._detaching[i]) continue;
            const filled = this._getRowFilled?.(i) ?? 0;
            if (filled >= 3) continue;
            if (n.position.x < missX) {
                this.registerBeltMiss(i);
            }
        }

        this.refreshServeRowAndInput();
    }

    private computeServeIndex(): number {
        const sx = this._anchor.x;
        const hw = Math.max(8, Number(this.serveZoneHalfWidthPx) || this._spacing * 0.45);
        let best = -1;
        let bestDist = 1e9;
        for (let i = 0; i < this._rows.length; i++) {
            const n = this._rows[i];
            if (!n?.active || !n.isValid) continue;
            if (!this._onBelt[i]) continue;
            if (this._detaching[i]) continue;
            const filled = this._getRowFilled?.(i) ?? 0;
            if (filled >= 3) continue;
            const d = Math.abs(n.position.x - sx);
            if (d <= hw && d < bestDist) {
                bestDist = d;
                best = i;
            }
        }
        return best;
    }

    private refreshServeRowAndInput(): void {
        if (this._beltRunning) {
            this._serveIndex = this.computeServeIndex();
            for (let i = 0; i < this._rows.length; i++) {
                const fr = this.getRowController(this._rows[i]!);
                if (!fr) continue;
                const on = i === this._serveIndex && this._serveIndex >= 0 && !this._conveyorPausedForComplete;
                fr.setBoardInputEnabled?.(on);
                if (on && !this._rowHadServeInput[i] && fr.needsDeferredKickstart?.()) {
                    fr.kickstartOrder?.();
                }
                this._rowHadServeInput[i] = on;
            }
            return;
        }

        this._serveIndex = this._activeIndex;
        this.applyActiveRowLegacy(this._activeIndex);
    }

    private applyActiveRowLegacy(idx: number): void {
        this._activeIndex = idx;
        this._serveIndex = idx;
        for (let i = 0; i < this._rows.length; i++) {
            const fr = this.getRowController(this._rows[i]!);
            if (!fr) continue;
            const active = i === idx;
            fr.setBoardInputEnabled?.(active);
            if (active && !this._rowHadServeInput[i] && fr.needsDeferredKickstart?.()) {
                fr.kickstartOrder?.();
            }
            this._rowHadServeInput[i] = active;
        }
    }

    private slotPosition(rowIndex: number, activeIdx: number): Vec3 {
        const dx = (rowIndex - activeIdx) * this._spacing;
        return new Vec3(this._anchor.x + dx, this._anchor.y, this._anchor.z);
    }

    private layoutAllImmediate(): void {
        for (let i = 0; i < this._rows.length; i++) {
            const n = this._rows[i];
            if (!n?.isValid || !n.active) continue;
            n.setPosition(this.slotPosition(i, this._activeIndex));
        }
    }

    private getRowController(row: Node): FryRowController | null {
        return (
            (row.getComponent('FryRandomFoodSprite') as FryRowController | null) ??
            (row.getComponent('FryOrdersSimpleController') as FryRowController | null) ??
            null
        );
    }

    private resolveQueueSettingsSource(row: Node): FryRowController | null {
        const direct = this.getRowController(row);
        if (direct) return direct;
        for (let n: Node | null = row.parent; n; n = n.parent) {
            const simple = n.getComponent('FryOrdersSimpleController') as FryRowController | null;
            if (simple) return simple;
        }
        return null;
    }

    public freeze(): void {
        if (this._frozen) return;
        this._frozen = true;
        this.unschedule(this.runFirstTrayAfterCompletePause);
        for (let i = 0; i < this._rows.length; i++) {
            const n = this._rows[i];
            if (!n?.isValid) continue;
            Tween.stopAllByTarget(n);
        }
    }
}
