import { _decorator, Component, Node, tween, Tween, Vec3 } from 'cc';

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
            const outPos = completed.position.clone();
            outPos.x -= this._exitLeft;
            tween(completed)
                .to(this._dur, { position: outPos })
                .call(() => {
                    completed.active = false;
                })
                .start();
            return;
        }

        Tween.stopAllByTarget(completed);

        const outPos = completed.position.clone();
        outPos.x -= this._exitLeft;

        this._activeIndex = next;

        tween(completed)
            .to(this._dur, { position: outPos })
            .call(() => {
                completed.active = false;
            })
            .start();

        for (let i = next; i < this._rows.length; i++) {
            const n = this._rows[i]!;
            if (!n.isValid || !n.active) continue;
            Tween.stopAllByTarget(n);
            const target = this.slotPosition(i, next);
            tween(n).to(this._dur, { position: target }).start();
        }

        this.applyActiveRow(next);
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
