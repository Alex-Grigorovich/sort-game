import { _decorator, Component, easing, Node, tween, Tween, Vec3 } from 'cc';
import { property } from '../core/scripts/playableCore/property';
import { SorEndgameController } from './SorEndgameController';

const { ccclass } = _decorator;

type FryRowController = Component & {
    queueSlotSpacingX?: number;
    queueCompletedExitLeft?: number;
    queueLayoutTweenDuration?: number;
    queueCompletePauseSec?: number;
    orderCompleteDelegate?: (() => void) | null;
    setBoardInputEnabled?: (on: boolean) => void;
    needsDeferredKickstart?: () => boolean;
    kickstartOrder?: () => void;
};

/** Синхронизация с FryOrdersSimpleController без циклического импорта. */
export type FryConveyorRowProvider = {
    getFilledForTrayRoot(root: Node): number;
    removeTrayByConveyorUnfilled(root: Node): number;
    /** Убрать поднос после 3/3, если закрыт не «по порядку» активного индекса (синхронно с splice в очереди). */
    removeTrayOrderFilled?(root: Node): void;
    /** Вызвать после того, как очередь обновила _activeIndex / layout. */
    refreshAfterConveyorRemoval(): void;
};

/**
 * Очередь контейнеров: активный слева в «якорной» точке, следующие заказы — правее.
 * После завершения заказа контейнер уезжает влево, остальные сдвигаются влево (справа налево).
 *
 * Режим conveyorMode: после 3/3 на первом подносе (если лотков ≥2) лента сразу едет непрерывно;
 * первый лоток только уезжает tween'ом, цепочка не «подпрыгивает» дискретным exitRow;
 * со 2-го заполненного — лента стопорится, пауза, затем только этот лоток уезжает влево (остальные на месте),
 * после исчезновения — выравнивание сетки и снова движение полотна;
 * незаполненный за conveyorUnfilledExitWorldX — к проигрышу.
 */
@ccclass('FryingOrdersQueue')
export class FryingOrdersQueue extends Component {
    @property({
        tooltip:
            'Непрерывный конвейер: стартует после 3/3 на первом лотке. Выключите для старого только-по-tween поведения.',
    })
    conveyorMode = true;

    @property({
        tooltip: 'Скорость сдвига очереди влево (px/сек) после старта конвейера.',
        visible(this: FryingOrdersQueue) {
            return this.conveyorMode;
        },
    })
    conveyorSpeedPxPerSec = 52;

    @property({
        tooltip:
            'Мировая координата X: если центр подноса левее — незаполненный считается уехавшим (подстройте под сцену).',
        visible(this: FryingOrdersQueue) {
            return this.conveyorMode;
        },
    })
    conveyorUnfilledExitWorldX = -420;

    @property({
        tooltip:
            'Скорость смены лотков: длительность tween ухода готового и сдвига очереди (сек). −1 = брать с FryOrdersSimpleController (queueLayoutTweenDuration).',
    })
    trayReplaceTweenDurationSec = -1;

    @property({
        tooltip:
            'Пауза после 3/3 до начала анимации ухода лотка (сек). −1 = из FryOrdersSimpleController (queueCompletePauseSec). Первый лоток при старте конвейера всегда без паузы.',
    })
    trayReplacePauseBeforeExitSec = -1;

    @property({
        tooltip:
            'Взять шаг между лотками из расстановки в сцене (первые два fry), чтобы не прыгал интервал относительно инспектора.',
    })
    lockSpacingToScenePositions = true;

    @property({
        type: Node,
        tooltip:
            'Нода «полотна» конвейера: каждый кадр сдвигается влево целиком (все лотки-дети едут вместе). Пусто — берётся общий родитель, если у всех лотков он один.',
        visible(this: FryingOrdersQueue) {
            return this.conveyorMode;
        },
    })
    conveyorStripRoot: Node | null = null;

    private _rows: Node[] = [];
    private _activeIndex = 0;
    private readonly _anchor = new Vec3();
    private _spacing = 95;
    private _exitLeft = 320;
    private _dur = 0.28;
    private _completePause = 1.0;
    private _frozen = false;
    private _rowProvider: FryConveyorRowProvider | null = null;

    private _conveyorStarted = false;
    private _scrollPaused = false;
    /** После первого 3/3 (если лотков ≥2): лента не стопорится, уходит только первый лоток; дальше — пауза + цепной exit. */
    private _firstFilledBeltDetachDone = false;
    /** Лоток в анимации «отъезда», не трогать layoutAllImmediate (иначе срывает tween). */
    private readonly _beltLayoutExcluded = new Set<Node>();

    /** Общий родитель лотков: сдвиг в lateUpdate идёт здесь (устойчиво к Widget на лотках). */
    private _stripDriveParent: Node | null = null;

    /** Возвращает true, если endgame обработал завершение ряда и взял управление на себя. */
    public advanceBlockedByEndgame: ((completedIdx: number, rowCount: number) => boolean) | null = null;

    public bindRows(rows: Node[], rowProvider?: FryConveyorRowProvider | null): void {
        this._rows = rows.filter((n) => n?.isValid);
        if (this._rows.length === 0) return;
        this._frozen = false;
        this._rowProvider = rowProvider ?? null;
        this._conveyorStarted = false;
        this._scrollPaused = false;
        this._firstFilledBeltDetachDone = false;
        this._beltLayoutExcluded.clear();
        this._stripDriveParent = this.conveyorMode ? this.resolveStripDriveParent() : null;

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

        for (let i = 0; i < this._rows.length; i++) {
            const fr = this.getRowController(this._rows[i]!);
            if (!fr) continue;
            const idx = i;
            fr.orderCompleteDelegate = () => this.notifyRowCompleteAtIndex(idx);
        }

        this.layoutAllImmediate();
        this.applyActiveRow(0);
    }

    /** Один общий предок для всех нод лотков — обычно «frying container». */
    private resolveStripDriveParent(): Node | null {
        if (this.conveyorStripRoot?.isValid) {
            return this.conveyorStripRoot;
        }
        if (this._rows.length === 0) {
            return null;
        }
        const p0 = this._rows[0]!.parent;
        if (!p0?.isValid) {
            return null;
        }
        for (let i = 1; i < this._rows.length; i++) {
            if (this._rows[i]!.parent !== p0) {
                return null;
            }
        }
        return p0;
    }

    public getActiveRowIndex(): number {
        return this._activeIndex;
    }

    public notifyActiveRowComplete(): void {
        this.notifyRowCompleteAtIndex(this._activeIndex);
    }

    /** Завершён заказ на подносе с индексом `completedIdx` (может отличаться от активного — любой видимый лоток). */
    public notifyRowCompleteAtIndex(completedIdx: number): void {
        if (this._frozen) {
            return;
        }
        if (completedIdx < 0 || completedIdx >= this._rows.length) {
            return;
        }
        if (this.advanceBlockedByEndgame?.(completedIdx, this._rows.length)) {
            return;
        }
        if (completedIdx === this._activeIndex) {
            this.onRowCompleteActive(completedIdx);
        } else {
            this.onRowCompleteOutOfOrder(completedIdx);
        }
    }

    /**
     * Сдвиг в lateUpdate: иначе Widget / Layout на нодах лотков могут в том же кадре
     * вернуть position после Component.update — визуально конвейер «стоит».
     */
    protected override lateUpdate(dt: number): void {
        if (!this.conveyorMode || !this._conveyorStarted || this._frozen || this._scrollPaused) {
            return;
        }
        const v = Math.max(0, this.conveyorSpeedPxPerSec);
        if (v <= 0.001) {
            return;
        }

        const strip = this._stripDriveParent;
        if (strip?.isValid) {
            const lp = strip.position;
            strip.setPosition(lp.x - v * dt, lp.y, lp.z);
        } else {
            this._anchor.x -= v * dt;
            this.layoutAllImmediate();
        }
        this.tryRemoveUnfilledOffscreen();
    }

    private tryRemoveUnfilledOffscreen(): void {
        if (!this._rowProvider) {
            return;
        }
        const threshold = this.conveyorUnfilledExitWorldX;
        for (let i = 0; i < this._rows.length; i++) {
            const n = this._rows[i];
            if (!n?.isValid || !n.active) {
                continue;
            }
            const filled = this._rowProvider.getFilledForTrayRoot(n);
            if (filled >= 3) {
                continue;
            }
            const wx = n.worldPosition.x;
            if (wx < threshold) {
                this.removeUnfilledTrayAt(n);
                break;
            }
        }
    }

    private removeUnfilledTrayAt(root: Node): void {
        const prov = this._rowProvider;
        if (!prov) {
            return;
        }
        const qIdx = this._rows.indexOf(root);
        if (qIdx < 0) {
            return;
        }
        const removedIdx = prov.removeTrayByConveyorUnfilled(root);
        if (removedIdx < 0) {
            return;
        }
        this._rows.splice(qIdx, 1);
        if (qIdx < this._activeIndex) {
            this._activeIndex--;
        } else if (qIdx === this._activeIndex) {
            this._activeIndex = Math.min(qIdx, Math.max(0, this._rows.length - 1));
        }
        this._activeIndex = Math.max(0, Math.min(this._activeIndex, Math.max(0, this._rows.length - 1)));
        if (root?.isValid) {
            root.active = false;
        }
        this.layoutAllImmediate();
        if (this._rows.length > 0) {
            this.applyActiveRow(this._activeIndex);
        }
        const gameOver = SorEndgameController.I?.reportUnfilledConveyorTray() ?? false;
        if (gameOver) {
            return;
        }
        prov.refreshAfterConveyorRemoval();
    }

    private slotPosition(rowIndex: number, activeIdx: number): Vec3 {
        const dx = (rowIndex - activeIdx) * this._spacing;
        return new Vec3(this._anchor.x + dx, this._anchor.y, this._anchor.z);
    }

    private layoutAllImmediate(): void {
        for (let i = 0; i < this._rows.length; i++) {
            const n = this._rows[i];
            if (!n?.isValid || !n.active || this._beltLayoutExcluded.has(n)) {
                continue;
            }
            n.setPosition(this.slotPosition(i, this._activeIndex));
        }
    }

    private applyActiveRow(idx: number): void {
        this._activeIndex = idx;
        // Один FryOrdersSimpleController на провайдере обслуживает все лотки: не глушить ввод false'ом
        // на «неактивных» нодах — иначе нельзя перетаскивать еду, пока на экране виден только другой лоток.
        const provider = this._rowProvider as unknown as FryRowController | null;
        provider?.setBoardInputEnabled?.(true);
        for (let i = 0; i < this._rows.length; i++) {
            const fr = this.getRowController(this._rows[i]!);
            if (!fr) {
                continue;
            }
            const active = i === idx;
            if (active && fr.needsDeferredKickstart?.()) {
                fr.kickstartOrder?.();
            }
        }
    }

    /** Компонент на самой ноде ряда (для делегатов / input по ряду). Не ищет на предках — иначе один и тот же FryOrdersSimpleController для всех детей. */
    private getRowController(row: Node): FryRowController | null {
        return (
            (row.getComponent('FryRandomFoodSprite') as FryRowController | null) ??
            (row.getComponent('FryOrdersSimpleController') as FryRowController | null) ??
            null
        );
    }

    /** Отступы и тайминг очереди: компонент на ноде ряда или FryOrdersSimpleController на предке. */
    private resolveQueueSettingsSource(row: Node): FryRowController | null {
        const direct = this.getRowController(row);
        if (direct) {
            return direct;
        }
        for (let n: Node | null = row.parent; n; n = n.parent) {
            const simple = n.getComponent('FryOrdersSimpleController') as FryRowController | null;
            if (simple) {
                return simple;
            }
        }
        return null;
    }

    private resolveFirstIncompleteRowIndex(): number {
        const prov = this._rowProvider;
        if (!prov) {
            return 0;
        }
        for (let i = 0; i < this._rows.length; i++) {
            const n = this._rows[i];
            if (!n?.isValid || !n.active) {
                continue;
            }
            if (prov.getFilledForTrayRoot(n) < 3) {
                return i;
            }
        }
        return Math.max(0, this._rows.length - 1);
    }

    /** Закрыт активный поднос — прежняя логика конвейера / exitRow. */
    private onRowCompleteActive(completedIdx: number): void {
        const completed = this._rows[completedIdx];
        if (!completed?.isValid) {
            return;
        }

        const isFirstConveyorKickoff =
            this.conveyorMode && !this._conveyorStarted && completedIdx === 0;
        if (isFirstConveyorKickoff) {
            this._conveyorStarted = true;
        }

        const pauseConveyorForFilledExit =
            this.conveyorMode && this._conveyorStarted && !isFirstConveyorKickoff;
        if (pauseConveyorForFilledExit) {
            this.beginExitScrollPause();
        }

        const pause = isFirstConveyorKickoff ? 0 : this._completePause;
        if (pause > 0) {
            this.scheduleOnce(() => {
                if (this._frozen) {
                    return;
                }
                this.exitRow(completedIdx);
            }, pause);
        } else {
            this.exitRow(completedIdx);
        }
    }

    /**
     * 3/3 на подносе не в позиции активного: уезжает только он, строка очереди и FryOrders синхронно укорачиваются.
     */
    private onRowCompleteOutOfOrder(completedIdx: number): void {
        const completed = this._rows[completedIdx];
        if (!completed?.isValid) {
            return;
        }

        if (this.conveyorMode && this._conveyorStarted) {
            this.beginExitScrollPause();
        }

        Tween.stopAllByTarget(completed);
        for (let i = completedIdx + 1; i < this._rows.length; i++) {
            const n = this._rows[i];
            if (n?.isValid) {
                Tween.stopAllByTarget(n);
            }
        }

        this._beltLayoutExcluded.add(completed);

        const twOpts = { easing: easing.sineInOut };
        const s = Math.max(1, this._spacing);
        const v = s / Math.max(0.01, this._dur);
        const dur = Math.max(0.01, this._exitLeft / v);
        const outPos = completed.position.clone();
        outPos.x -= this._exitLeft;

        tween(completed)
            .to(dur, { position: outPos }, twOpts)
            .call(() => {
                this._beltLayoutExcluded.delete(completed);
                if (completed.isValid) {
                    completed.active = false;
                }

                const prov = this._rowProvider;
                const qIdx = this._rows.indexOf(completed);
                if (qIdx >= 0) {
                    this._rows.splice(qIdx, 1);
                }
                prov?.removeTrayOrderFilled?.(completed);

                if (this._rows.length === 0) {
                    this.endExitScrollPause();
                    prov?.refreshAfterConveyorRemoval();
                    return;
                }

                this._activeIndex = this.resolveFirstIncompleteRowIndex();
                this._activeIndex = Math.max(0, Math.min(this._activeIndex, this._rows.length - 1));

                const lead = this._rows[this._activeIndex];
                if (lead?.isValid) {
                    this._anchor.set(lead.position);
                }
                this.layoutAllImmediate();
                this.applyActiveRow(this._activeIndex);
                this.endExitScrollPause();
                prov?.refreshAfterConveyorRemoval();
            })
            .start();
    }

    private beginExitScrollPause(): void {
        if (this.conveyorMode && this._conveyorStarted) {
            this._scrollPaused = true;
        }
    }

    private endExitScrollPause(): void {
        this._scrollPaused = false;
    }

    /**
     * Первый закрытый лоток при ≥2 лотках: лента в lateUpdate не паузится,
     * остальные привязаны к якорю; завершённый лоток уезжает tween'ом отдельно.
     */
    private exitFirstFilledTrayBeltKeepsRolling(completedIdx: number): void {
        const completed = this._rows[completedIdx];
        if (!completed?.isValid) {
            return;
        }
        const next = completedIdx + 1;
        if (next >= this._rows.length) {
            return;
        }

        Tween.stopAllByTarget(completed);
        for (let i = next; i < this._rows.length; i++) {
            const n = this._rows[i];
            if (n?.isValid) {
                Tween.stopAllByTarget(n);
            }
        }

        this._activeIndex = next;
        this.applyActiveRow(next);

        const follower = this._rows[next]!;
        this._anchor.set(follower.position);
        this.layoutAllImmediate();

        this._beltLayoutExcluded.add(completed);
        const twOpts = { easing: easing.sineInOut };
        const s = Math.max(1, this._spacing);
        const v = s / Math.max(0.01, this._dur);
        const dur = Math.max(0.01, this._exitLeft / v);
        const outPos = completed.position.clone();
        outPos.x -= this._exitLeft;

        tween(completed)
            .to(dur, { position: outPos }, twOpts)
            .call(() => {
                this._beltLayoutExcluded.delete(completed);
                if (completed.isValid) {
                    completed.active = false;
                }
                this._firstFilledBeltDetachDone = true;
            })
            .start();
    }

    /**
     * 2-й и далее заполненный лоток: полотно стоит, остальные лотки не едут «цепочкой» —
     * только завершённый уезжает влево в локальных координатах и гаснет.
     */
    private exitRowConveyorFilledDetachOnly(completedIdx: number): void {
        const completed = this._rows[completedIdx];
        if (!completed?.isValid) {
            this.endExitScrollPause();
            return;
        }
        const next = completedIdx + 1;
        if (next >= this._rows.length) {
            this.endExitScrollPause();
            return;
        }

        Tween.stopAllByTarget(completed);
        for (let i = next; i < this._rows.length; i++) {
            const n = this._rows[i];
            if (n?.isValid) {
                Tween.stopAllByTarget(n);
            }
        }

        this._beltLayoutExcluded.add(completed);

        this._activeIndex = next;
        this.applyActiveRow(next);

        const twOpts = { easing: easing.sineInOut };
        const s = Math.max(1, this._spacing);
        const v = s / Math.max(0.01, this._dur);
        const dur = Math.max(0.01, this._exitLeft / v);
        const outPos = completed.position.clone();
        outPos.x -= this._exitLeft;

        tween(completed)
            .to(dur, { position: outPos }, twOpts)
            .call(() => {
                this._beltLayoutExcluded.delete(completed);
                if (completed.isValid) {
                    completed.active = false;
                }
                const lead = this._rows[this._activeIndex];
                if (lead?.isValid) {
                    this._anchor.set(lead.position);
                }
                this.layoutAllImmediate();
                this.endExitScrollPause();
            })
            .start();
    }

    private exitRow(completedIdx: number): void {
        const completed = this._rows[completedIdx];
        if (!completed?.isValid) {
            this.endExitScrollPause();
            return;
        }

        const next = completedIdx + 1;

        const useBeltKeepsRolling =
            this.conveyorMode &&
            this._conveyorStarted &&
            !this._firstFilledBeltDetachDone &&
            completedIdx === 0 &&
            next < this._rows.length;

        if (useBeltKeepsRolling) {
            this.exitFirstFilledTrayBeltKeepsRolling(completedIdx);
            return;
        }

        this.beginExitScrollPause();

        if (next >= this._rows.length) {
            Tween.stopAllByTarget(completed);
            const s = Math.max(1, this._spacing);
            const v = s / Math.max(0.01, this._dur);
            const lastDur = Math.max(0.01, this._exitLeft / v);
            const outPos = completed.position.clone();
            outPos.x -= this._exitLeft;
            tween(completed)
                .to(lastDur, { position: outPos }, { easing: easing.sineInOut })
                .call(() => {
                    completed.active = false;
                    this.endExitScrollPause();
                })
                .start();
            return;
        }

        if (this.conveyorMode && this._conveyorStarted && this._firstFilledBeltDetachDone) {
            this.exitRowConveyorFilledDetachOnly(completedIdx);
            return;
        }

        const s = Math.max(1, this._spacing);
        const phase1 = Math.max(0.01, this._dur);
        const speed = s / phase1;
        const extra = Math.max(0, this._exitLeft - s);
        const phase2 = extra > 0.001 ? extra / speed : 0;

        this._activeIndex = next;
        this.applyActiveRow(next);

        Tween.stopAllByTarget(completed);
        for (let i = next; i < this._rows.length; i++) {
            const n = this._rows[i];
            if (n?.isValid) {
                Tween.stopAllByTarget(n);
            }
        }

        const twOpts = { easing: easing.sineInOut };

        for (let i = next; i < this._rows.length; i++) {
            const n = this._rows[i]!;
            if (!n.isValid || !n.active) {
                continue;
            }
            const p = n.position;
            const dest = new Vec3(p.x - s, p.y, p.z);
            tween(n).to(phase1, { position: dest }, twOpts).start();
        }

        const pc = completed.position;
        const afterShift = new Vec3(pc.x - s, pc.y, pc.z);
        if (extra > 0.001) {
            const offScreen = new Vec3(afterShift.x - extra, afterShift.y, afterShift.z);
            tween(completed)
                .to(phase1, { position: afterShift }, twOpts)
                .to(phase2, { position: offScreen }, twOpts)
                .call(() => {
                    completed.active = false;
                    this.endExitScrollPause();
                })
                .start();
        } else {
            tween(completed)
                .to(phase1, { position: afterShift }, twOpts)
                .call(() => {
                    completed.active = false;
                    this.endExitScrollPause();
                })
                .start();
        }
    }

    /** Мягкая заморозка: останавливаем только движение очереди. */
    public freeze(): void {
        if (this._frozen) {
            return;
        }
        this._frozen = true;
        for (let i = 0; i < this._rows.length; i++) {
            const n = this._rows[i];
            if (!n?.isValid) {
                continue;
            }
            Tween.stopAllByTarget(n);
        }
        this._beltLayoutExcluded.clear();
        this.endExitScrollPause();
    }
}
