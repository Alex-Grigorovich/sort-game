import { _decorator, Component, easing, Node, tween, Tween, Vec3 } from 'cc';
import { property } from '../core/scripts/playableCore/property';

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

/**
 * Очередь контейнеров: активный слева в «якорной» точке, следующие заказы — правее.
 * После завершения заказа контейнер уезжает влево, остальные сдвигаются влево (справа налево).
 */
@ccclass('FryingOrdersQueue')
export class FryingOrdersQueue extends Component {
    @property({
        tooltip:
            'Скорость смены лотков: длительность tween ухода готового и сдвига очереди (сек). −1 = брать с FryOrdersSimpleController (queueLayoutTweenDuration).',
    })
    trayReplaceTweenDurationSec = -1;

    @property({
        tooltip:
            'Пауза после 3/3 до начала анимации ухода лотка (сек). −1 = из FryOrdersSimpleController (queueCompletePauseSec). 0 = сразу уезжать.',
    })
    trayReplacePauseBeforeExitSec = -1;

    @property({
        tooltip:
            'Взять шаг между лотками из расстановки в сцене (первые два fry), чтобы не прыгал интервал относительно инспектора.',
    })
    lockSpacingToScenePositions = true;

    private _rows: Node[] = [];
    private _activeIndex = 0;
    private readonly _anchor = new Vec3();
    private _spacing = 95;
    private _exitLeft = 320;
    private _dur = 0.28;
    private _completePause = 1.0;
    private _frozen = false;
    /** Возвращает true, если endgame обработал завершение ряда и взял управление на себя. */
    public advanceBlockedByEndgame: ((completedIdx: number, rowCount: number) => boolean) | null = null;

    public bindRows(rows: Node[]): void {
        this._rows = rows.filter((n) => n?.isValid);
        if (this._rows.length === 0) return;
        this._frozen = false;

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
            fr.orderCompleteDelegate = () => this.onRowComplete(idx);
        }

        this.layoutAllImmediate();
        this.applyActiveRow(0);
    }

    public getActiveRowIndex(): number {
        return this._activeIndex;
    }

    public notifyActiveRowComplete(): void {
        this.onRowComplete(this._activeIndex);
    }

    /** Истекло время на поднос: уезжает текущий лоток как при 3/3, без проверки заполнения. */
    public forceExitActiveRowForMiss(): void {
        if (this._frozen) return;
        const idx = this._activeIndex;
        if (idx < 0 || idx >= this._rows.length) return;
        const row = this._rows[idx];
        if (!row?.isValid) return;
        this.exitRow(idx);
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

    private applyActiveRow(idx: number): void {
        this._activeIndex = idx;
        for (let i = 0; i < this._rows.length; i++) {
            const fr = this.getRowController(this._rows[i]!);
            if (!fr) continue;
            const active = i === idx;
            fr.setBoardInputEnabled?.(active);
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
        if (direct) return direct;
        for (let n: Node | null = row.parent; n; n = n.parent) {
            const simple = n.getComponent('FryOrdersSimpleController') as FryRowController | null;
            if (simple) return simple;
        }
        return null;
    }

    private onRowComplete(completedIdx: number): void {
        if (this._frozen) return;
        if (completedIdx !== this._activeIndex) return;
        if (this.advanceBlockedByEndgame?.(completedIdx, this._rows.length)) return;

        const completed = this._rows[completedIdx];
        if (!completed?.isValid) return;

        if (this._completePause > 0) {
            this.scheduleOnce(() => {
                if (this._frozen) return;
                this.exitRow(completedIdx);
            }, this._completePause);
        } else {
            this.exitRow(completedIdx);
        }
    }

    private exitRow(completedIdx: number): void {
        const completed = this._rows[completedIdx];
        if (!completed?.isValid) return;

        const next = completedIdx + 1;

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
                })
                .start();
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
            if (n?.isValid) Tween.stopAllByTarget(n);
        }

        const twOpts = { easing: easing.sineInOut };

        for (let i = next; i < this._rows.length; i++) {
            const n = this._rows[i]!;
            if (!n.isValid || !n.active) continue;
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
                })
                .start();
        } else {
            tween(completed)
                .to(phase1, { position: afterShift }, twOpts)
                .call(() => {
                    completed.active = false;
                })
                .start();
        }
    }

    /** Мягкая заморозка: останавливаем только движение очереди. */
    public freeze(): void {
        if (this._frozen) return;
        this._frozen = true;
        for (let i = 0; i < this._rows.length; i++) {
            const n = this._rows[i];
            if (!n?.isValid) continue;
            Tween.stopAllByTarget(n);
        }
    }
}
