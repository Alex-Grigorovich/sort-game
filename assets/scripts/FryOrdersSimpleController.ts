import {
    _decorator,
    Camera,
    Canvas,
    Color,
    Component,
    EventMouse,
    EventTouch,
    Graphics,
    Input,
    Node,
    Collider2D,
    PhysicsSystem2D,
    RigidBody2D,
    RichText,
    Sprite,
    SpriteFrame,
    UITransform,
    UIOpacity,
    Widget,
    easing,
    input,
    tween,
    Tween,
    v2,
    view,
    Vec2,
    Vec3,
} from 'cc';
import { property } from '../core/scripts/playableCore/property';
import { ContainerPhysicsBowl } from './ContainerPhysicsBowl';
import { FryingOrdersQueue } from './FryingOrdersQueue';
import { SorEndgameController } from './SorEndgameController';

const { ccclass } = _decorator;

type RowState = {
    root: Node;
    emblemNode: Node | null;
    progress: RichText | null;
    slots: (Node | null)[];
    orderKey: string;
    frame: SpriteFrame | null;
    filled: number;
};

@ccclass('FryOrdersSimpleController')
export class FryOrdersSimpleController extends Component {
    @property({
        type: [Node],
        tooltip:
            'Очередь подносов: каждый элемент — отдельная нода (свой fry / Emblem / слоты). Нельзя четыре раза указать одну и ту же ноду — дублируйте поднос в иерархии (Ctrl+D).',
    })
    fryRows: Node[] = [];

    @property({ type: [SpriteFrame], tooltip: 'Order pool, expected 6 frames' })
    foodSprites: SpriteFrame[] = [];

    @property({ type: Node, tooltip: 'Container with SpawnedPhysicsItems' })
    gameContainer: Node | null = null;

    @property({ type: ContainerPhysicsBowl, tooltip: 'Rain completion source' })
    physicsBowl: ContainerPhysicsBowl | null = null;

    @property({ type: Node, tooltip: 'Finger node to move to target food' })
    fingerNode: Node | null = null;

    @property({ type: FryingOrdersQueue, tooltip: 'Optional queue controller for tray exit' })
    fryingQueue: FryingOrdersQueue | null = null;

    @property({
        tooltip:
            'Только для первого подноса: сколько слотов уже занято из 3 (прогресс 2/3 и т.д.). Не задаёт количество подносов в очереди — их число = уникальные ноды в Fry Rows.',
    })
    firstRowInitialFilled = 2;

    @property({
        tooltip:
            'Только первый поднос: белая обводка по контуру каждого Sprite внутри ноды еды (Food1–2), после посадки в слот. 0 = выкл. Снимается при следующем успешном клике по еде в куче.',
    })
    firstTraySlotOutlineWidth = 4.5;

    @property({ tooltip: 'Template for progress text' })
    progressTemplate = '<color=#fff>{n}/3</color>';

    @property({ tooltip: 'Finger x offset in world space' })
    fingerOffsetX = 0;

    @property({ tooltip: 'Finger y offset in world space' })
    fingerOffsetY = 40;

    @property({ tooltip: 'Палец: длительность поворота от 0° до fingerHintRotateDeg по Z (сек)' })
    fingerHintRotateDurationSec = 0.65;

    @property({ tooltip: 'Палец: угол поворота против часовой стрелки по Z (от текущего Z в покое), обычно 90' })
    fingerHintRotateDeg = 90;

    @property({
        tooltip:
            'Фаза «указания»: множитель scale пальца и ноды еды под ним (0.7 = −30% к покою по всем осям)',
    })
    fingerHintPunchScaleMul = 0.7;

    @property({
        tooltip:
            'Красная подсветка ноды еды под пальцем (0–1), синхронно с фазой «указания» пальца (не сам палец)',
    })
    fingerIndicateRedMix = 0.52;

    @property({ tooltip: 'Палец: длительность одной фазы сжатия или возврата scale (сек)' })
    fingerHintPunchDurationSec = 0.1;

    @property({ tooltip: 'Палец: пауза перед следующим циклом поворота (сек)' })
    fingerHintLoopPauseSec = 0.12;

    @property({
        tooltip:
            'Мин. секунд без нажатий после дождя еды, до показа пальца (случайная пауза между min и max)',
    })
    fingerHintIdleMinSec = 3;

    @property({
        tooltip: 'Макс. секунд без нажатий до показа пальца',
    })
    fingerHintIdleMaxSec = 4;

    @property({ tooltip: 'Горизонтальный шаг между подносами в очереди (px). Первый ряд остаётся на месте, остальные выстраиваются правее.' })
    queueSlotSpacingX = 100;

    @property({ tooltip: 'На сколько px влево уезжает завершённый поднос' })
    queueCompletedExitLeft = 320;

    @property({ tooltip: 'Длительность сдвига очереди (сек)' })
    queueLayoutTweenDuration = 0.28;

    @property({ tooltip: 'Пауза перед уходом подноса после 3/3 (сек)' })
    queueCompletePauseSec = 1;

    @property({
        tooltip:
            'Только без FryingOrdersQueue: таймер на текущий поднос; 0 = выкл. С очередью пропуски считает конвейер (лоток уехал неполным).',
    })
    trayServeTimeLimitSec = 12;

    @property({ tooltip: 'Длительность перелёта еды в слот (сек), easing + дуга' })
    foodFlyDurationSec = 0.45;

    @property({ tooltip: 'Высота дуги перелёта в мировых координатах UI (пик над прямой start→end)' })
    foodFlyArcHeight = 90;

    @property({ type: SpriteFrame, tooltip: 'Галочка при заполнении лотка (3/3); не назначено — эффект выключен' })
    checkmarkSpriteFrame: SpriteFrame | null = null;

    @property({ tooltip: 'Длительность: подъём + исчезновение (сек)' })
    checkmarkAnimDurationSec = 0.38;

    @property({ tooltip: 'На сколько px поднимается галочка вверх (локально к подносу)' })
    checkmarkRisePx = 10;

    @property({ tooltip: 'Сдвиг галочки от центра подноса (локальные px)' })
    checkmarkOffsetX = 0;

    @property({ tooltip: 'Сдвиг галочки от центра подноса (локальные px)' })
    checkmarkOffsetY = 0;

    @property({ tooltip: 'Ширина галочки (px). 0 = по размеру кадра' })
    checkmarkDisplayWidth = 0;

    @property({ tooltip: 'Высота галочки (px). 0 = по ширине с сохранением пропорций или по кадру' })
    checkmarkDisplayHeight = 0;

    @property({ tooltip: 'Закрепить ноду этого компонента (frying container) снизу родителя (Widget)' })
    pinFryingContainerToBottom = true;

    @property({ tooltip: 'Отступ от низа при закреплении (px)' })
    fryingContainerBottomMargin = 0;

    @property({ tooltip: 'Сдвиг по горизонтали от центра при закреплении (px)' })
    fryingContainerHorizontalCenterOffset = 0;

    @property({
        tooltip:
            'True: вертикаль — по доле высоты Canvas (fryingBandCenterFractionFromBottom), линия подносов стабильна на разных разрешениях. False: только прижатие к низу (bottom).',
    })
    fryingBandUseScreenFraction = true;

    @property({
        tooltip:
            'Доля высоты Canvas от низа до центра блока лотков: 0 = у нижнего края, 1 = у верха. ~0.32–0.38 — зона стойки как на референсе.',
    })
    fryingBandCenterFractionFromBottom = 0.34;

    @property({
        tooltip:
            'Доп. сдвиг по Y (px в координатах target) для режима доли экрана; крутить после подбора fraction.',
    })
    fryingBandVerticalPixelOffset = 0;

    @property({
        tooltip:
            'При fryingBandUseScreenFraction: отступ от верха Canvas (px); блок лотков сдвигается вниз. 0 = без отступа.',
    })
    fryingBandTopMargin = 0;

    @property({ tooltip: 'При неверном клике по еде: амплитуда тряски по X (px)' })
    wrongPickShakePx = 7;

    @property({ tooltip: 'Длительность одного шага тряски (сек); всего 4 шага' })
    wrongPickShakeStepSec = 0.075;

    @property({ tooltip: 'Неверный клик: насколько смешивать цвет спрайта с красным (0–1)' })
    wrongPickRedMix = 0.52;

    @property({ tooltip: 'Неверный клик: время нарастания красного оттенка (сек)' })
    wrongPickRedInSec = 0.14;

    @property({ tooltip: 'Неверный клик: возврат к исходному цвету (сек)' })
    wrongPickRedOutSec = 0.24;

    private _rows: RowState[] = [];
    private _activeRow = 0;
    private _rainDone = false;
    private _targetFoodNode: Node | null = null;
    private readonly _tmpLocal = new Vec3();
    private readonly _tmpWorld = new Vec3();
    private _waitingQueueAdvanceFrom = -1;
    private _fingerPointNode: Node | null = null;
    private _fingerSwayActive = false;
    private _fingerAnimRestValid = false;
    private readonly _fingerAnimRestEuler = new Vec3();
    private readonly _fingerAnimRestScale = new Vec3(1, 1, 1);
    /** Время в текущем цикле анимации пальца (update, не tween — repeatForever на цепочке ненадёжен). */
    private _fingerHintCycleTime = 0;
    private readonly _fingerHintSprites: Sprite[] = [];
    private readonly _fingerHintSpriteOrigColors: Color[] = [];
    /**
     * Корень порции в куче (обычно прямой ребёнок SpawnedPhysicsItems) — тинт/scale подсказки для всех
     * спрайтов сразу (парные половинки); не путать с _targetFoodNode для позиции пальца.
     */
    private _fingerHintTintTarget: Node | null = null;
    /** Покойный scale цели подсказки (до «пunch»), восстанавливается в restoreFingerHintSpriteColors. */
    private readonly _fingerTargetHintRestScale = new Vec3(1, 1, 1);
    private static readonly _fingerIndicateAccent = new Color(255, 72, 78, 255);
    /** После окончания дождя можно отсчитывать простой до показа пальца. */
    private _fingerIdleCountdownArmed = false;
    private _fingerIdleAccumSec = 0;
    private _fingerIdleThresholdSec = 3.5;
    private _boardInputEnabled = true;
    /** Слоты, в которые сейчас летит еда (по uuid), чтобы не спавнить второй клон. */
    private readonly _slotsWithActiveFly = new Set<string>();
    /** Таймер «пропуска» без FryingOrdersQueue (fallback). */
    private _standaloneServeRemainSec = 0;

    private readonly _flyBezierOut = new Vec3();
    private readonly _flyStart = new Vec3();
    private readonly _flyEnd = new Vec3();
    private readonly _flyMid = new Vec3();
    private static readonly _firstTrayFoodOutlineChild = '__FirstTrayFoodOutline';

    /** После тача часто приходит синтетический mouseup — иначе двойной учёт клика. */
    private _suppressMouseUpUntilMs = 0;

    private readonly _onCanvasResizeFryingWidget = (): void => {
        this.ensureFryingContainerBottomWidget();
    };

    /** Вызывается очередью / SorEndgame при заморозке. */
    public setBoardInputEnabled(on: boolean): void {
        this._boardInputEnabled = on;
    }

    protected override onLoad(): void {
        console.log('[FryOrders] onLoad node=' + this.node?.name + ' fryRows=' + this.fryRows.length + ' finger=' + !!this.fingerNode);
        this.buildRows();
        this.resetAllRows();
        this.hideFinger();
        input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.on(Input.EventType.MOUSE_UP, this.onMouseUp, this);
        view.on('canvas-resize', this._onCanvasResizeFryingWidget, this);
    }

    protected override start(): void {
        if (this.fryRows.length === 0 && this.node?.isValid) {
            this.fryRows = [this.node];
        }
        console.log('[FryOrders] start fryRows=' + this.fryRows.length + ' rows=' + this._rows.length);
        this.refreshRowStateFromScene();
        console.log('[FryOrders] rows after refresh=' + this._rows.length + ' emblemNode=' + !!this._rows[0]?.emblemNode);

        if (!this.fryingQueue?.isValid) {
            this.fryingQueue = this.node.getComponent(FryingOrdersQueue) ?? this.node.parent?.getComponent(FryingOrdersQueue) ?? null;
        }
        if (this.fryingQueue?.isValid && this._rows.length > 0) {
            this.fryingQueue.bindRows(this._rows.map((r) => r.root));
            this._activeRow = this.fryingQueue.getActiveRowIndex();
            this.fryingQueue.setBeltMissHandlers(
                (idx) => this._rows[idx]?.filled ?? 0,
                () => {
                    SorEndgameController.I?.reportMissedTray();
                },
            );
        } else if (this.trayServeTimeLimitSec > 0) {
            this._standaloneServeRemainSec = this.trayServeTimeLimitSec;
        }
        for (let i = 0; i < this._rows.length; i++) {
            this.prepareRowAtIndex(i);
        }
        this.waitForRainAndArmFingerIdle();
        this.scheduleOnce(() => this.ensureFryingContainerBottomWidget(), 0);
    }

    /**
     * Лотки к Canvas (не к GameField). Режим доли экрана: центр ноды на высоте fraction от низа,
     * минус fryingBandTopMargin (отступ сверху). Иначе — прижатие к низу.
     */
    private ensureFryingContainerBottomWidget(): void {
        if (!this.pinFryingContainerToBottom || !this.node?.isValid) return;

        const alignTarget =
            this.resolveFryingWidgetCanvasTarget() ?? this.resolveFirstUiTransformAncestorExcludingSelf();
        const canvasTf = alignTarget?.getComponent(UITransform);
        if (!canvasTf) return;

        let w = this.node.getComponent(Widget);
        if (!w) w = this.node.addComponent(Widget);
        w.target = alignTarget;
        w.isAlignHorizontalCenter = true;
        w.isAlignLeft = false;
        w.isAlignRight = false;
        w.horizontalCenter = this.fryingContainerHorizontalCenterOffset;
        w.top = 0;
        w.left = 0;
        w.right = 0;

        if (this.fryingBandUseScreenFraction) {
            w.isAlignBottom = false;
            w.isAlignTop = false;
            w.isAlignVerticalCenter = true;
            w.bottom = 0;
            const frac = Math.min(1, Math.max(0, Number(this.fryingBandCenterFractionFromBottom) || 0));
            const h = Math.max(1, canvasTf.height);
            const dpy = Number(this.fryingBandVerticalPixelOffset);
            const tm = Number(this.fryingBandTopMargin);
            const topInset = Number.isFinite(tm) && tm > 0 ? tm : 0;
            w.verticalCenter = h * (frac - 0.5) + (Number.isFinite(dpy) ? dpy : 0) - topInset;
        } else {
            w.isAlignBottom = true;
            w.isAlignTop = false;
            w.isAlignVerticalCenter = false;
            w.bottom = this.fryingContainerBottomMargin;
            w.verticalCenter = 0;
        }

        w.alignMode = Widget.AlignMode.ALWAYS;
        w.updateAlignment();
    }

    /** Ближайший предок с Canvas — та же опорная область, что у фона под канвасом. */
    private resolveFryingWidgetCanvasTarget(): Node | null {
        let n: Node | null = this.node;
        while (n) {
            if (n.getComponent(Canvas)) return n;
            n = n.parent;
        }
        return null;
    }

    private resolveFirstUiTransformAncestorExcludingSelf(): Node | null {
        let n: Node | null = this.node.parent;
        while (n && !n.getComponent(UITransform)) {
            n = n.parent;
        }
        return n;
    }

    protected override update(dt: number): void {
        this.updateFingerFollow();
        this.updateFingerHintIdle(dt);
        this.updateFingerHintLoop(dt);
        this.updateStandaloneTrayServeMiss(dt);
        if (this._fingerSwayActive && !this.isFingerRowActive()) {
            this.stopFingerSway();
        }
    }

    /** Пропуск подноса по таймеру, если нет компонента FryingOrdersQueue. */
    private updateStandaloneTrayServeMiss(dt: number): void {
        if (this.fryingQueue?.isValid) return;
        if (this.trayServeTimeLimitSec <= 0) return;
        if (!this._rainDone) return;
        if (!this._boardInputEnabled) return;
        if (SorEndgameController.I?.hasEnded()) return;
        const row = this.currentRow();
        if (!row?.frame || row.filled >= 3) return;

        this._standaloneServeRemainSec -= dt;
        if (this._standaloneServeRemainSec > 0) return;

        SorEndgameController.I?.reportMissedTray();
    }

    private updateFingerHintLoop(dt: number): void {
        if (!this._fingerSwayActive || !this.isFingerRowActive()) return;
        const f = this.fingerNode;
        if (!f?.isValid || !this._fingerAnimRestValid) return;
        this.syncFingerHintTargetTintCache();

        const rx = this._fingerAnimRestEuler.x;
        const ry = this._fingerAnimRestEuler.y;
        const rz0 = this._fingerAnimRestEuler.z;
        const rs = this._fingerAnimRestScale;

        const rotDur = Math.max(0.08, Number(this.fingerHintRotateDurationSec) || 0.65);
        const deg = Math.max(1, Math.min(120, Math.abs(Number(this.fingerHintRotateDeg) || 90)));
        const punchMul = Math.min(1, Math.max(0.18, Number(this.fingerHintPunchScaleMul) || 0.7));
        const punchT = Math.max(0.04, Number(this.fingerHintPunchDurationSec) || 0.1);
        const pauseAfter = Math.max(0, Number(this.fingerHintLoopPauseSec) || 0);

        const cycle = rotDur + 2 * punchT + pauseAfter;
        this._fingerHintCycleTime += dt;
        let phase = this._fingerHintCycleTime % cycle;

        const endZ = rz0 + deg;
        const tgt = this._fingerHintTintTarget;

        if (phase < rotDur) {
            const u = rotDur > 1e-8 ? phase / rotDur : 1;
            const k = easing.sineInOut(u);
            const z = rz0 + deg * k;
            f.setRotationFromEuler(rx, ry, z);
            f.setScale(rs.x, rs.y, rs.z);
            this.applyFingerTargetHintScale(tgt, 1);
            this.applyFingerIndicateTint(0);
        } else if (phase < rotDur + punchT) {
            const u = punchT > 1e-8 ? (phase - rotDur) / punchT : 1;
            const k = easing.quadOut(u);
            const m = 1 + (punchMul - 1) * k;
            f.setRotationFromEuler(rx, ry, endZ);
            f.setScale(rs.x * m, rs.y * m, rs.z);
            this.applyFingerTargetHintScale(tgt, m);
            this.applyFingerIndicateTint(k);
        } else if (phase < rotDur + 2 * punchT) {
            const u = punchT > 1e-8 ? (phase - rotDur - punchT) / punchT : 1;
            const k = easing.quadIn(u);
            const m = punchMul + (1 - punchMul) * k;
            f.setRotationFromEuler(rx, ry, endZ);
            f.setScale(rs.x * m, rs.y * m, rs.z);
            this.applyFingerTargetHintScale(tgt, m);
            this.applyFingerIndicateTint(1 - k);
        } else {
            f.setRotationFromEuler(rx, ry, rz0);
            f.setScale(rs.x, rs.y, rs.z);
            this.applyFingerTargetHintScale(tgt, 1);
            this.applyFingerIndicateTint(0);
        }
    }

    private applyFingerTargetHintScale(target: Node | null, mul: number): void {
        if (!target?.isValid || target !== this._fingerHintTintTarget) return;
        const r = this._fingerTargetHintRestScale;
        const m = Number(mul);
        if (!Number.isFinite(m)) return;
        target.setScale(r.x * m, r.y * m, r.z * m);
    }

    private cacheFingerHintSpriteColors(root: Node | null): void {
        this._fingerHintSprites.length = 0;
        this._fingerHintSpriteOrigColors.length = 0;
        this._fingerHintTintTarget = null;
        if (!root?.isValid) return;
        const walk = (n: Node): void => {
            if (n.name === FryOrdersSimpleController._firstTrayFoodOutlineChild) return;
            const sp = n.getComponent(Sprite);
            if (sp?.isValid && sp.enabled !== false) {
                this._fingerHintSprites.push(sp);
                this._fingerHintSpriteOrigColors.push(sp.color.clone());
            }
            for (let i = 0; i < n.children.length; i++) walk(n.children[i]!);
        };
        walk(root);
        this._fingerHintTintTarget = root;
        this._fingerTargetHintRestScale.set(root.scale);
    }

    /**
     * Смена цели подсказки: снять эффект с прежнего корня порции, закешировать спрайты нового корня
     * (корень клона в куче — все парные спрайты одной порции вместе).
     */
    private syncFingerHintTargetTintCache(): void {
        const match =
            this._fingerSwayActive && this._targetFoodNode?.isValid ? this._targetFoodNode : null;
        const spawn = this.resolveSpawnRoot();
        const want = match ? this.resolveFingerHintVisualRoot(spawn, match) : null;
        if (want === this._fingerHintTintTarget) return;
        this.restoreFingerHintSpriteColors();
        if (want) this.cacheFingerHintSpriteColors(want);
    }

    /** mix 0 = исходные цвета, 1 = полная сила красного (с учётом fingerIndicateRedMix). */
    private applyFingerIndicateTint(mix01: number): void {
        const band = Math.min(1, Math.max(0, Number(this.fingerIndicateRedMix) || 0));
        const t = Math.min(1, Math.max(0, mix01)) * band;
        const acc = FryOrdersSimpleController._fingerIndicateAccent;
        for (let i = 0; i < this._fingerHintSprites.length; i++) {
            const sp = this._fingerHintSprites[i];
            const o = this._fingerHintSpriteOrigColors[i];
            if (!sp?.isValid || !o) continue;
            sp.color = this.blendRgbColor(o, acc, t);
        }
    }

    private restoreFingerHintSpriteColors(): void {
        for (let i = 0; i < this._fingerHintSprites.length; i++) {
            const sp = this._fingerHintSprites[i];
            const o = this._fingerHintSpriteOrigColors[i];
            if (sp?.isValid && o) sp.color = o.clone();
        }
        const t = this._fingerHintTintTarget;
        if (t?.isValid) {
            const r = this._fingerTargetHintRestScale;
            t.setScale(r.x, r.y, r.z);
        }
        this._fingerHintSprites.length = 0;
        this._fingerHintSpriteOrigColors.length = 0;
        this._fingerHintTintTarget = null;
    }

    protected override onDestroy(): void {
        view.off('canvas-resize', this._onCanvasResizeFryingWidget, this);
        input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.off(Input.EventType.MOUSE_UP, this.onMouseUp, this);
    }

    /** Уникальные корни подносов: повтор одной ноды даёт один ряд и предупреждение в консоль. */
    private getUniqueFryRowRoots(): Node[] {
        const seen = new Set<Node>();
        const out: Node[] = [];
        for (let i = 0; i < this.fryRows.length; i++) {
            const n = this.fryRows[i];
            if (!n?.isValid) continue;
            if (seen.has(n)) {
                console.warn(
                    `[FryOrders] fryRows[${i}]: повтор ноды "${n.name}". Нужны ${this.fryRows.length} разных подносов в иерархии — продублируйте контейнер с fry (Ctrl+D), не назначайте одну ноду несколько раз.`,
                );
                continue;
            }
            seen.add(n);
            out.push(n);
        }
        return out;
    }

    private buildRows(): void {
        const roots = this.getUniqueFryRowRoots();
        this._rows = roots.map((row) => ({
            root: row,
            emblemNode: this.resolveEmblemNode(row),
            progress: this.resolveProgress(row),
            slots: this.resolveSlots(row),
            orderKey: '',
            frame: null,
            filled: 0,
        }));
    }

    /** Пересборка ссылок после старта (иерархия/инспектор уже финальны). */
    private refreshRowStateFromScene(): void {
        if (this.fryRows.length === 0 && this.node?.isValid) {
            this.fryRows = [this.node];
        }
        this.buildRows();
    }

    private refreshSingleRowRefs(row: RowState): void {
        if (!row.root?.isValid) return;
        row.emblemNode = this.resolveEmblemNode(row.root);
        row.progress = this.resolveProgress(row.root);
        row.slots = this.resolveSlots(row.root);
    }

    private resetAllRows(): void {
        for (let i = 0; i < this._rows.length; i++) {
            const row = this._rows[i]!;
            this.clearSlots(row);
            row.orderKey = '';
            row.frame = null;
            row.filled = 0;
            this.hideAllEmblemVariants(row.emblemNode);
            this.updateProgress(row);
        }
    }

    /**
     * Готовит один поднос по индексу (эмблема + слоты). Не меняет `_activeRow`.
     * Если заказ для этого подноса уже выбран при старте — не перекидывает случайную эмблему заново
     * (иначе при переходе очереди второй/третий поднос «менял» бы заказ).
     */
    private prepareRowAtIndex(rowIndex: number): void {
        if (rowIndex < 0 || rowIndex >= this._rows.length) {
            console.warn('[FryOrders] prepareRowAtIndex: bad index ' + rowIndex + ' total=' + this._rows.length);
            return;
        }
        const row = this._rows[rowIndex]!;
        this.refreshSingleRowRefs(row);
        const layout = this.resolveTrayLayoutRoot(row.root);
        this.ensureTrayBackgroundBehindFoodSlots(layout);

        if (row.orderKey && row.frame) {
            this.applyRowEmblem(row, row.orderKey, row.frame);
            this.updateProgress(row);
            return;
        }

        console.log(
            '[FryOrders] prepareRowAtIndex(' + rowIndex + '): emblemNode=' + (row.emblemNode?.name ?? 'null') + ' children=' + (row.emblemNode?.children?.length ?? 0),
        );
        this.ensureEmblemChildrenActive(row.emblemNode);
        const order = this.pickOrderFromEmblemNode(row.emblemNode);
        if (!order) {
            console.warn('[FryOrders] prepareRowAtIndex: pickOrder returned null');
            return;
        }
        row.orderKey = order.key;
        row.frame = order.frame;
        console.log('[FryOrders] prepareRowAtIndex: orderKey=' + row.orderKey);

        this.applyRowEmblem(row, row.orderKey, row.frame);

        this.clearSlots(row);
        const isFirstTray = rowIndex === 0;
        const baseFilled = isFirstTray ? Math.max(0, Math.min(3, this.firstRowInitialFilled)) : 0;
        row.filled = baseFilled;
        for (let i = 0; i < baseFilled; i++) {
            const slot = row.slots[i];
            if (!slot?.isValid) {
                console.warn(`[FryOrders] Слот GameContainerFood${i + 1} не найден под "${row.root.name}" — проверьте иерархию (слоты как дочерние "fry").`);
            }
        }
        this.updateProgress(row);
        if (isFirstTray && baseFilled > 0) {
            this.fillFirstTrayInitialSlotsFromSpawn();
            this.scheduleFillFirstTrayInitialSlotsUntilDone();
        }
    }

    /** Убирает устаревшие спрайт-заглушки (`__OrderFood`), если остались в сцене. */
    private removeSpritePlaceholdersFromSlot(slot: Node): void {
        if (!slot?.isValid) return;
        for (let c = slot.children.length - 1; c >= 0; c--) {
            const ch = slot.children[c]!;
            if (ch.name === '__OrderFood') ch.destroy();
        }
    }

    private slotHasSpawnFoodChild(slot: Node | null): boolean {
        if (!slot?.isValid) return false;
        if (this._slotsWithActiveFly.has(slot.uuid)) return true;
        for (let c = 0; c < slot.children.length; c++) {
            const ch = slot.children[c]!;
            if (ch.name === '__OrderFood') continue;
            if (ch.name === FryOrdersSimpleController._firstTrayFoodOutlineChild) continue;
            if (!ch.activeInHierarchy) continue;
            if (this.getFirstFrameDeep(ch)) return true;
        }
        return false;
    }

    /**
     * Первый поднос: слоты 0..filled−1 заполняются только нодами-клонами из SpawnedPhysicsItems.
     * Пока клонов нет — слоты пустые (без спрайтов).
     */
    private fillFirstTrayInitialSlotsFromSpawn(): void {
        const row = this._rows[0];
        if (!row?.orderKey || !row.frame || row.filled <= 0) return;
        row.slots = this.resolveSlots(row.root);
        const spawn = this.resolveSpawnRoot();
        if (!spawn?.isValid) return;
        const max = Math.min(row.filled, row.slots.length);
        for (let i = 0; i < max; i++) {
            const slot = row.slots[i];
            if (!slot?.isValid) continue;
            this.removeSpritePlaceholdersFromSlot(slot);
            if (this._slotsWithActiveFly.has(slot.uuid)) continue;
            if (this.slotHasSpawnFoodChild(slot)) continue;
            let cloneRoot = this.takeNextMatchingSpawnedRoot(spawn, row.orderKey);
            if (!cloneRoot?.isValid) {
                cloneRoot = this.stealMatchingCloneRootFromSpawnDeep(spawn, row.orderKey, row.frame);
            }
            if (!cloneRoot?.isValid) continue;
            this._slotsWithActiveFly.add(slot.uuid);
            this.flyNodeToSlotArc(cloneRoot, slot, () => {
                this._slotsWithActiveFly.delete(slot.uuid);
                if (cloneRoot.isValid && slot.isValid) this.applyNodeIntoSlotFinal(cloneRoot, slot);
                // В билде первые клоны иногда прилетают позже/в другом порядке — после каждой посадки добираем недостающие.
                this.scheduleOnce(() => this.fillFirstTrayInitialSlotsFromSpawn(), 0);
            });
        }
    }

    private stealMatchingCloneRootFromSpawnDeep(spawn: Node, orderKey: string, frame: SpriteFrame): Node | null {
        const hit = this.findFirstMatchingFoodNode(spawn, orderKey, frame);
        if (!hit?.isValid) return null;
        return this.findSpawnedCloneRoot(hit, spawn) ?? hit;
    }

    /**
     * Клоны дождя — прямые дети `SpawnedPhysicsItems`, см. ContainerPhysicsBowl (`${categoryKey}_C${i}`).
     * Надёжнее, чем обход вложенных спрайтов.
     */
    private takeNextMatchingSpawnedRoot(spawn: Node, orderKey: string): Node | null {
        if (!orderKey) return null;
        const want = this.normalizeCategoryNodeTag(orderKey) || this.normalizeNameTag(orderKey);
        if (!want) return null;
        for (let i = 0; i < spawn.children.length; i++) {
            const ch = spawn.children[i]!;
            if (!ch.activeInHierarchy) continue;
            const tag = this.normalizeCategoryNodeTag(ch.name);
            if (tag === want) return ch;
        }
        return null;
    }

    /** Повторяет перенос клонов в первый лоток, пока не появятся все начальные ноды (дождь спавнит постепенно). */
    private scheduleFillFirstTrayInitialSlotsUntilDone(): void {
        const delay = 0.05;
        const maxAttempts = 400;
        const step = (attempt: number) => {
            this.fillFirstTrayInitialSlotsFromSpawn();
            if (attempt >= maxAttempts) return;
            if (!this.firstTrayInitialSlotsStillNeedSpawnNodes()) return;
            this.scheduleOnce(() => step(attempt + 1), delay);
        };
        step(0);
    }

    private firstTrayInitialSlotsStillNeedSpawnNodes(): boolean {
        const row = this._rows[0];
        if (!row || row.filled <= 0) return false;
        row.slots = this.resolveSlots(row.root);
        const max = Math.min(row.filled, row.slots.length);
        for (let i = 0; i < max; i++) {
            const slot = row.slots[i];
            if (!slot?.isValid) continue;
            this.removeSpritePlaceholdersFromSlot(slot);
            if (this._slotsWithActiveFly.has(slot.uuid)) continue;
            if (!this.slotHasSpawnFoodChild(slot)) return true;
        }
        return false;
    }

    private prepareActiveRow(): void {
        this.syncActiveRowFromQueue();
        if (!this.currentRow()) {
            console.warn('[FryOrders] prepareActiveRow: no current row, _activeRow=' + this._activeRow + ' total=' + this._rows.length);
            return;
        }
        this.prepareRowAtIndex(this._activeRow);
        if (!this.fryingQueue?.isValid && this.trayServeTimeLimitSec > 0) {
            this._standaloneServeRemainSec = this.trayServeTimeLimitSec;
        }
    }

    /**
     * Подложка трея (FryBG) у детей `f` часто стоит после слотов — тогда она рисуется поверх и скрывает еду.
     * Ставим фон в начало списка детей (рисуется сзади).
     */
    private ensureTrayBackgroundBehindFoodSlots(fryOrTray: Node): void {
        if (!fryOrTray?.isValid) return;
        const names = ['FryBG', 'fryBG', 'FryBg', 'TrayBG', 'trayBG', 'TrayBg', 'BoardBG'];
        for (let n = 0; n < names.length; n++) {
            const bg = fryOrTray.getChildByName(names[n]!);
            if (bg?.isValid) {
                bg.setSiblingIndex(0);
                return;
            }
        }
    }

    private waitForRainAndArmFingerIdle(): void {
        if (this._rainDone) {
            this.fillFirstTrayInitialSlotsFromSpawn();
            this.armFingerIdleCountdown();
            return;
        }
        const done = this.physicsBowl?.isRainSpawnFinished() ?? true;
        console.log('[FryOrders] waitForRain: done=' + done + ' bowl=' + !!this.physicsBowl);
        if (done) {
            this._rainDone = true;
            this.fillFirstTrayInitialSlotsFromSpawn();
            this.scheduleFillFirstTrayInitialSlotsUntilDone();
            this.armFingerIdleCountdown();
            return;
        }
        this.scheduleOnce(() => this.waitForRainAndArmFingerIdle(), 0.05);
    }

    private armFingerIdleCountdown(): void {
        this._fingerIdleCountdownArmed = true;
        this._fingerIdleAccumSec = 0;
        this.rollFingerIdleThreshold();
    }

    private rollFingerIdleThreshold(): void {
        let a = Number(this.fingerHintIdleMinSec);
        let b = Number(this.fingerHintIdleMaxSec);
        if (!Number.isFinite(a)) a = 3;
        if (!Number.isFinite(b)) b = 4;
        a = Math.max(0.25, a);
        b = Math.max(a, b);
        this._fingerIdleThresholdSec = a >= b - 1e-6 ? a : a + Math.random() * (b - a);
    }

    /** Любое отпускание касания / клика: сброс таймера простоя и скрытие подсказки. */
    private noteFingerHintPlayerActivity(): void {
        if (!this._rainDone) return;
        this._fingerIdleAccumSec = 0;
        this.rollFingerIdleThreshold();
        this.hideFinger();
    }

    private updateFingerHintIdle(dt: number): void {
        if (!this._fingerIdleCountdownArmed || !this._rainDone || !this._boardInputEnabled) return;
        if (!this.isFingerRowActive()) return;
        if (!this.fingerNode?.isValid) return;
        if (this.fingerNode.active) return;

        const spawn = this.resolveSpawnRoot();
        if (!spawn?.isValid) return;

        this._fingerIdleAccumSec += dt;
        if (this._fingerIdleAccumSec < this._fingerIdleThresholdSec) return;

        this._fingerIdleAccumSec = 0;
        this.rollFingerIdleThreshold();
        this.refreshFingerTarget();
        if (this._targetFoodNode?.isValid) this.showFinger();
    }

    private onTouchEnd(e: EventTouch): void {
        this.noteFingerHintPlayerActivity();
        const now = typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
        this._suppressMouseUpUntilMs = now + 250;
        this.handlePick(e.getUILocation(), e.getLocation());
    }

    private onMouseUp(e: EventMouse): void {
        const now = typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
        if (now < this._suppressMouseUpUntilMs) return;
        this.noteFingerHintPlayerActivity();
        this.handlePick(e.getUILocation(), e.getLocation());
    }

    /** Клик по еде в gameContainer: попадание только если тип совпадает с заказом текущего подноса (ключ из Emblem). */
    private handlePick(uiPoint: Vec2, screenPoint: Vec2): void {
        if (!this._boardInputEnabled || !this._rainDone) return;
        const row = this.currentRow();
        if (!row?.frame) return;
        if (row.filled >= 3) return;

        const spawn = this.resolveSpawnRoot();
        if (!spawn?.isValid) return;
        const hit = this.hitTestFoodUnderSpawn(spawn, screenPoint, uiPoint);
        if (!hit?.isValid) return;
        const hitFrame = this.getFirstFrameDeep(hit);
        if (!this.isOrderHitMatch(row.orderKey, row.frame, hit, hitFrame, true)) {
            const foodRoot = this.findSpawnedCloneRoot(hit, spawn) ?? hit;
            this.playWrongPickFeedback(foodRoot);
            SorEndgameController.I?.reportWrongFoodPick();
            return;
        }

        const cloneRoot = this.findSpawnedCloneRoot(hit, spawn) ?? hit;
        this.stopFingerSway();
        this._targetFoodNode = cloneRoot;
        this.placePickedFoodIntoCurrentRow();
    }

    /**
     * Неверный заказ: короткая тряска корня куска и плавный красный тинт на всех Sprite (затем сброс).
     */
    private playWrongPickFeedback(foodRoot: Node | null): void {
        if (!foodRoot?.isValid) return;

        Tween.stopAllByTarget(foodRoot);
        const p = foodRoot.position;
        const ox = p.x;
        const oy = p.y;
        const oz = p.z;
        const amp = Math.max(2, this.wrongPickShakePx);
        const step = Math.max(0.04, this.wrongPickShakeStepSec);
        const ease = easing.sineInOut;

        tween(foodRoot)
            .to(step, { position: new Vec3(ox + amp, oy, oz) }, { easing: ease })
            .to(step, { position: new Vec3(ox - amp, oy, oz) }, { easing: ease })
            .to(step, { position: new Vec3(ox + amp * 0.45, oy, oz) }, { easing: ease })
            .to(step, { position: new Vec3(ox, oy, oz) }, { easing: ease })
            .start();

        const sprites: Sprite[] = [];
        this.collectFoodSpritesForWrongFeedback(foodRoot, sprites);
        if (sprites.length === 0) return;

        const mix = Math.min(0.95, Math.max(0.12, this.wrongPickRedMix));
        const tIn = Math.max(0.06, this.wrongPickRedInSec);
        const tOut = Math.max(0.08, this.wrongPickRedOutSec);
        const flash = new Color(255, 105, 110, 255);
        const orig: Color[] = sprites.map((s) => s.color.clone());
        const mid: Color[] = orig.map((o) => this.blendRgbColor(o, flash, mix));

        for (let i = 0; i < sprites.length; i++) {
            const s = sprites[i]!;
            Tween.stopAllByTarget(s);
            const o = orig[i]!;
            const m = mid[i]!;
            tween(s)
                .to(tIn, { color: m }, { easing: easing.sineOut })
                .to(tOut, { color: o }, { easing: easing.sineInOut })
                .call(() => {
                    if (s.isValid) s.color = o.clone();
                })
                .start();
        }
    }

    private blendRgbColor(a: Color, b: Color, t: number): Color {
        const r = new Color();
        r.r = Math.round(a.r + (b.r - a.r) * t);
        r.g = Math.round(a.g + (b.g - a.g) * t);
        r.b = Math.round(a.b + (b.b - a.b) * t);
        r.a = a.a;
        return r;
    }

    private collectFoodSpritesForWrongFeedback(root: Node, out: Sprite[]): void {
        if (!root.activeInHierarchy) return;
        const sp = root.getComponent(Sprite);
        if (sp?.enabled && sp.spriteFrame && root.name !== FryOrdersSimpleController._firstTrayFoodOutlineChild) {
            out.push(sp);
        }
        const ch = root.children;
        for (let i = 0; i < ch.length; i++) {
            this.collectFoodSpritesForWrongFeedback(ch[i]!, out);
        }
    }

    private placePickedFoodIntoCurrentRow(): void {
        const row = this.currentRow();
        if (!row?.frame) return;
        if (row.filled >= 3) return;
        this.refreshSingleRowRefs(row);

        const slot = row.slots[row.filled];
        if (!slot?.isValid) {
            console.warn(`[FryOrders] Нет слота GameContainerFood${row.filled + 1} для "${row.root?.name}"`);
            return;
        }

        const pickedNode = this._targetFoodNode;
        if (!pickedNode?.isValid) {
            console.warn('[FryOrders] Нет ноды еды для слота — спрайты в лотке не используются.');
            return;
        }

        this._targetFoodNode = null;
        this._boardInputEnabled = false;
        this.hideFinger();
        this.stripFirstTrayFoodOutlinesOnSlots01();
        this._slotsWithActiveFly.add(slot.uuid);

        this.flyNodeToSlotArc(pickedNode, slot, () => {
            this._slotsWithActiveFly.delete(slot.uuid);
            this._boardInputEnabled = true;
            if (!pickedNode.isValid || !slot.isValid) return;
            this.applyNodeIntoSlotFinal(pickedNode, slot);

            row.filled++;
            this.updateProgress(row);

            if (row.filled >= 3) {
                this.handleRowCompleted();
                return;
            }

            this.armFingerIdleCountdown();
        });
    }

    /** Квадратичная Безье P(t) = (1−t)²P0 + 2(1−t)t P1 + t² P2, t∈[0,1]. */
    private bezierQuadOut(p0: Vec3, p1: Vec3, p2: Vec3, t: number, out: Vec3): void {
        const o = 1 - t;
        const u = o * o;
        const v = 2 * o * t;
        const w = t * t;
        out.x = u * p0.x + v * p1.x + w * p2.x;
        out.y = u * p0.y + v * p1.y + w * p2.y;
        out.z = u * p0.z + v * p1.z + w * p2.z;
    }

    private getSlotWorldCenterFly(slot: Node, out: Vec3): void {
        const tf = slot.getComponent(UITransform);
        if (tf) tf.convertToWorldSpaceAR(Vec3.ZERO, out);
        else out.set(slot.worldPosition);
    }

    /** Без getComponentInParent (нет в части билдов/рантаймов): ищем Canvas вверх по иерархии. */
    private resolveFlyCanvasRoot(slot: Node): Node {
        if (!slot?.isValid) return this.node.scene!;
        let n: Node | null = slot;
        while (n) {
            if (n.getComponent(Canvas)?.isValid) return n;
            n = n.parent;
        }
        return slot.scene ?? this.node.scene!;
    }

    /**
     * Плавный перелёт по дуге (квадратичная Безье) с easing; по завершении — коллбек (обычно посадка в слот).
     */
    private flyNodeToSlotArc(foodNode: Node, slot: Node, onComplete: () => void): void {
        if (!foodNode.isValid || !slot.isValid) {
            onComplete();
            return;
        }

        this.stripPhysics(foodNode);

        this._flyStart.set(foodNode.worldPosition);
        this.getSlotWorldCenterFly(slot, this._flyEnd);
        this._flyMid.set(
            (this._flyStart.x + this._flyEnd.x) * 0.5,
            (this._flyStart.y + this._flyEnd.y) * 0.5 + this.foodFlyArcHeight,
            (this._flyStart.z + this._flyEnd.z) * 0.5,
        );

        const flyRoot = this.resolveFlyCanvasRoot(slot);
        foodNode.setParent(flyRoot, true);
        foodNode.setSiblingIndex(Math.max(0, flyRoot.children.length - 1));

        const startEulerZ = foodNode.eulerAngles.z;
        const dur = Math.max(0.05, this.foodFlyDurationSec);
        const prog = { t: 0 };

        tween(prog)
            .to(
                dur,
                { t: 1 },
                {
                    easing: easing.cubicInOut,
                    onUpdate: () => {
                        if (!foodNode.isValid) return;
                        this.bezierQuadOut(this._flyStart, this._flyMid, this._flyEnd, prog.t, this._flyBezierOut);
                        foodNode.setWorldPosition(this._flyBezierOut);
                        foodNode.setRotationFromEuler(0, 0, startEulerZ * (1 - prog.t));
                    },
                },
            )
            .call(() => {
                if (foodNode.isValid) {
                    foodNode.setRotationFromEuler(0, 0, 0);
                }
                onComplete();
            })
            .start();
    }

    private applyNodeIntoSlotFinal(foodNode: Node, slot: Node): void {
        if (!foodNode.isValid || !slot.isValid) return;
        slot.removeAllChildren();

        foodNode.removeFromParent();
        foodNode.layer = slot.layer;
        slot.addChild(foodNode);

        foodNode.setPosition(0, 0, 0);
        foodNode.setRotationFromEuler(0, 0, 0);
        foodNode.setScale(1, 1, 1);

        const slotTf = slot.getComponent(UITransform);
        if (slotTf) {
            const targetW = Math.max(24, slotTf.contentSize.width * 0.78);
            const targetH = Math.max(24, slotTf.contentSize.height * 0.78);
            this.fitNodeToSize(foodNode, targetW, targetH);
        }
        this.tryAddFirstTrayFoodOutlineAfterLanding(slot, foodNode);
    }

    private fitNodeToSize(node: Node, targetW: number, targetH: number): void {
        const tf = node.getComponent(UITransform);
        if (!tf) return;
        const curW = tf.contentSize.width || 1;
        const curH = tf.contentSize.height || 1;
        const scale = Math.min(targetW / curW, targetH / curH);
        node.setScale(scale, scale, 1);
    }

    /**
     * Снимает 2D-физику перед полётом в слот. В Web-билде имена классов минифицируются (`a`, `t`),
     * проверка по `constructor.name` не находит Collider/RigidBody — тела остаются и упираются в BorderBottom.
     */
    private stripPhysics(node: Node): void {
        const walk = (n: Node) => {
            const cols = n.getComponents(Collider2D);
            for (let i = cols.length - 1; i >= 0; i--) {
                const c = cols[i];
                if (c?.isValid) {
                    c.enabled = false;
                    c.destroy();
                }
            }
            const rbs = n.getComponents(RigidBody2D);
            for (let i = rbs.length - 1; i >= 0; i--) {
                const rb = rbs[i];
                if (rb?.isValid) {
                    rb.enabled = false;
                    rb.destroy();
                }
            }
            for (let j = 0; j < n.children.length; j++) walk(n.children[j]!);
        };
        walk(node);
    }

    /**
     * Центр подноса (fry): спрайт галочки поднимается на checkmarkRisePx и исчезает (UIOpacity).
     * Назначьте checkmarkSpriteFrame в инспекторе.
     */
    private playTrayCompleteCheckmark(row: RowState | null): void {
        if (!row?.root?.isValid || !this.checkmarkSpriteFrame) return;

        const parent = this.resolveTrayLayoutRoot(row.root);
        if (!parent?.isValid) return;

        const mark = new Node('__TrayCheckmark');
        mark.layer = parent.layer;
        parent.addChild(mark);
        mark.setSiblingIndex(parent.children.length - 1);

        const { w: ckw, h: ckh } = this.getCheckmarkDisplaySize();
        const tf = mark.addComponent(UITransform);
        tf.setAnchorPoint(0.5, 0.5);

        const sp = mark.addComponent(Sprite);
        // Сначала CUSTOM, иначе при spriteFrame движок один кадр выставит размер из кадра и затрёт contentSize.
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.type = Sprite.Type.SIMPLE;
        sp.spriteFrame = this.checkmarkSpriteFrame;
        sp.color = Color.WHITE;
        tf.setContentSize(ckw, ckh);

        const op = mark.addComponent(UIOpacity);
        op.opacity = 255;

        const ox = this.checkmarkOffsetX;
        const oy = this.checkmarkOffsetY;
        const rise = this.checkmarkRisePx;
        mark.setPosition(ox, oy, 0);

        const dur = Math.max(0.05, this.checkmarkAnimDurationSec);
        const endY = oy + rise;
        const easingOut = easing.sineOut;

        Tween.stopAllByTarget(mark);
        Tween.stopAllByTarget(op);

        tween(mark)
            .parallel(
                tween(mark).to(dur, { position: new Vec3(ox, endY, 0) }, { easing: easingOut }),
                tween(op).to(dur, { opacity: 0 }, { easing: easingOut }),
            )
            .call(() => {
                if (mark.isValid) mark.destroy();
            })
            .start();
    }

    private getCheckmarkDisplaySize(): { w: number; h: number } {
        const fr = this.checkmarkSpriteFrame!;
        const { w: rw, h: rh } = this.getSpriteFrameLayoutSize(fr);
        let dw = Number(this.checkmarkDisplayWidth) || 0;
        let dh = Number(this.checkmarkDisplayHeight) || 0;
        if (dw > 0 && dh > 0) {
            return { w: Math.max(8, dw), h: Math.max(8, dh) };
        }
        if (dw > 0) {
            return { w: Math.max(8, dw), h: Math.max(8, (dw / rw) * rh) };
        }
        if (dh > 0) {
            return { w: Math.max(8, (dh / rh) * rw), h: Math.max(8, dh) };
        }
        return { w: Math.max(8, rw), h: Math.max(8, rh) };
    }

    /** Размер для расчёта пропорций: originalSize у тримнутых кадров, иначе rect. */
    private getSpriteFrameLayoutSize(fr: SpriteFrame): { w: number; h: number } {
        const o = fr.originalSize;
        if (o && o.width > 1 && o.height > 1) {
            return { w: o.width, h: o.height };
        }
        const r = fr.rect;
        return { w: Math.max(1, r.width), h: Math.max(1, r.height) };
    }

    private handleRowCompleted(): void {
        this.hideFinger();
        this.playTrayCompleteCheckmark(this.currentRow());
        const q = this.fryingQueue;
        if (q?.isValid) {
            const prev = q.getActiveRowIndex();
            this._waitingQueueAdvanceFrom = prev;
            q.notifyActiveRowComplete();
            this.waitQueueAdvanceAndPrepareNext();
            return;
        }
        this.advanceRowFallback();
    }

    private waitQueueAdvanceAndPrepareNext(): void {
        const q = this.fryingQueue;
        if (!q?.isValid) {
            this.advanceRowFallback();
            return;
        }
        const idx = q.getActiveRowIndex();
        if (this._waitingQueueAdvanceFrom >= 0 && idx !== this._waitingQueueAdvanceFrom) {
            this._waitingQueueAdvanceFrom = -1;
            this._activeRow = idx;
            if (!this.currentRow()) {
                this.hideFinger();
                return;
            }
            this.prepareActiveRow();
            this.armFingerIdleCountdown();
            return;
        }
        this.scheduleOnce(() => this.waitQueueAdvanceAndPrepareNext(), 0.05);
    }

    private advanceRowFallback(): void {
        this._activeRow++;
        if (this._activeRow >= this._rows.length) {
            this.hideFinger();
            return;
        }
        this.prepareActiveRow();
        this.armFingerIdleCountdown();
    }

    private refreshFingerTarget(): void {
        if (!this.isFingerRowActive()) {
            this.hideFinger();
            return;
        }
        const row = this.currentRow();
        const spawn = this.resolveSpawnRoot();
        if (!row?.frame || !spawn?.isValid) {
            console.warn('[Finger] no row/frame or spawn', !!row?.frame, !!spawn?.isValid);
            this.hideFinger();
            return;
        }
        this._targetFoodNode = this.findFirstMatchingFoodNode(spawn, row.orderKey, row.frame);
        console.log(`[Finger] target="${this._targetFoodNode?.name ?? 'null'}" orderKey="${row.orderKey}" spawnChildren=${spawn.children.length}`);
    }

    private updateFingerFollow(): void {
        if (!this.isFingerRowActive()) return;
        const finger = this.fingerNode;
        const target = this._targetFoodNode;
        if (!finger?.isValid || !target?.isValid || !finger.parent?.isValid) return;

        const fingerPoint = this.resolveFingerPoint();
        const tfParent = finger.parent.getComponent(UITransform);
        if (!tfParent) return;

        const world = target.worldPosition;
        if (fingerPoint?.isValid) {
            const fpWorld = fingerPoint.worldPosition;
            const offsetX = fpWorld.x - finger.worldPosition.x;
            const offsetY = fpWorld.y - finger.worldPosition.y;
            tfParent.convertToNodeSpaceAR(
                new Vec3(world.x - offsetX, world.y - offsetY, world.z),
                this._tmpLocal,
            );
        } else {
            tfParent.convertToNodeSpaceAR(
                new Vec3(world.x + this.fingerOffsetX, world.y + this.fingerOffsetY, world.z),
                this._tmpLocal,
            );
        }
        finger.setPosition(this._tmpLocal.x, this._tmpLocal.y, 0);
    }

    private resolveFingerPoint(): Node | null {
        if (this._fingerPointNode?.isValid) return this._fingerPointNode;
        const f = this.fingerNode;
        if (!f?.isValid) return null;
        this._fingerPointNode =
            f.getChildByName('FingerPoint') ??
            f.getChildByName('fingerPoint') ??
            f.getChildByName('fingerpoint') ??
            null;
        return this._fingerPointNode;
    }

    /**
     * Показ пальца-подсказки. Tween поворота не перезапускается, если палец уже анимируется и цель есть —
     * иначе цикл сбрасывался бы при каждом повторном showFinger и не выглядел бы «постоянным до клика».
     */
    private showFinger(): void {
        if (!this.fingerNode?.isValid) return;
        const hasTarget = !!this._targetFoodNode?.isValid;
        this.fingerNode.active = hasTarget;
        if (hasTarget) {
            if (!this._fingerSwayActive) {
                this.startFingerSway();
            }
        } else {
            this.stopFingerSway();
        }
    }

    private hideFinger(): void {
        this._targetFoodNode = null;
        if (!this.fingerNode?.isValid) return;
        this.stopFingerSway();
        this.fingerNode.active = false;
    }

    private startFingerSway(): void {
        if (!this.fingerNode?.isValid || !this.isFingerRowActive()) return;
        const f = this.fingerNode;

        this._fingerSwayActive = true;
        Tween.stopAllByTarget(f);

        this._fingerAnimRestEuler.set(f.eulerAngles);
        this._fingerAnimRestScale.set(f.scale);
        this._fingerAnimRestValid = true;
        this._fingerHintCycleTime = 0;

        const rx = this._fingerAnimRestEuler.x;
        const ry = this._fingerAnimRestEuler.y;
        const rz0 = this._fingerAnimRestEuler.z;
        const rs = this._fingerAnimRestScale;

        f.setRotationFromEuler(rx, ry, rz0);
        f.setScale(rs.x, rs.y, rs.z);
        this.syncFingerHintTargetTintCache();
        this.applyFingerTargetHintScale(this._fingerHintTintTarget, 1);
        this.applyFingerIndicateTint(0);
    }

    private stopFingerSway(): void {
        this._fingerSwayActive = false;
        this._fingerHintCycleTime = 0;
        this.restoreFingerHintSpriteColors();
        const f = this.fingerNode;
        if (f?.isValid) {
            Tween.stopAllByTarget(f);
            if (this._fingerAnimRestValid) {
                f.setScale(this._fingerAnimRestScale.x, this._fingerAnimRestScale.y, this._fingerAnimRestScale.z);
                f.setRotationFromEuler(
                    this._fingerAnimRestEuler.x,
                    this._fingerAnimRestEuler.y,
                    this._fingerAnimRestEuler.z,
                );
            }
        }
    }

    private resolveSpawnRoot(): Node | null {
        const gc =
            this.gameContainer?.isValid ? this.gameContainer : this.physicsBowl?.node ?? null;
        if (!gc?.isValid) return null;
        const spawn = gc.getChildByName('SpawnedPhysicsItems');
        return spawn?.isValid ? spawn : gc;
    }

    private hitTestFoodUnderSpawn(spawn: Node, screenPoint: Vec2, uiPoint: Vec2): Node | null {
        const byPhysics = this.hitTestByPhysics(spawn, screenPoint);
        if (byPhysics) return byPhysics;
        return this.hitTestTopSprite(spawn, screenPoint) ?? this.hitTestTopSprite(spawn, uiPoint);
    }

    private hitTestByPhysics(spawn: Node, screenPoint: Vec2): Node | null {
        const sys = PhysicsSystem2D.instance;
        const cam = this.resolveActiveCamera();
        if (!sys || !cam) return null;
        cam.screenToWorld(new Vec3(screenPoint.x, screenPoint.y, 0), this._tmpWorld);
        const colliders = sys.testPoint(v2(this._tmpWorld.x, this._tmpWorld.y));
        if (!colliders.length) return null;
        for (let i = 0; i < colliders.length; i++) {
            const n = colliders[i]!.node;
            if (!n?.isValid || !this.isUnder(n, spawn)) continue;
            return this.findNearestSpriteNode(n) ?? n;
        }
        return null;
    }

    private resolveActiveCamera(): Camera | null {
        return this.node.scene?.getComponentInChildren(Camera) ?? null;
    }

    private hitTestTopSprite(root: Node, point: Vec2): Node | null {
        if (!root.activeInHierarchy) return null;
        for (let i = root.children.length - 1; i >= 0; i--) {
            const hit = this.hitTestTopSprite(root.children[i]!, point);
            if (hit) return hit;
        }
        const tf = root.getComponent(UITransform);
        const sp = root.getComponent(Sprite);
        if (tf && sp?.enabled && sp.spriteFrame && tf.hitTest(point)) return root;
        return null;
    }

    private findNearestSpriteNode(from: Node | null): Node | null {
        let n = from;
        while (n) {
            const sp = n.getComponent(Sprite);
            if (sp?.enabled && sp.spriteFrame) return n;
            n = n.parent;
        }
        return null;
    }

    private isUnder(node: Node, root: Node): boolean {
        let n: Node | null = node;
        while (n) {
            if (n === root) return true;
            n = n.parent;
        }
        return false;
    }

    private findSpawnedCloneRoot(node: Node, spawn: Node): Node | null {
        let n: Node | null = node;
        while (n) {
            if (n.parent === spawn) return n;
            n = n.parent;
        }
        return null;
    }

    /**
     * Для подсветки/масштаба подсказки — общий корень порции под SpawnedPhysicsItems (все спрайты-куски
     * внутри него синхронно). Если ноды нет под spawn — остаётся совпавший спрайт-узел (одиночный спрайт).
     */
    private resolveFingerHintVisualRoot(spawn: Node | null, matchedFoodNode: Node | null): Node | null {
        if (!matchedFoodNode?.isValid) return null;
        if (spawn?.isValid) {
            const root = this.findSpawnedCloneRoot(matchedFoodNode, spawn);
            if (root?.isValid) return root;
        }
        return matchedFoodNode;
    }

    private findFirstMatchingFoodNode(root: Node, orderKey: string, frame: SpriteFrame): Node | null {
        const candidates: string[] = [];
        const walk = (n: Node): Node | null => {
            if (!n.activeInHierarchy) return null;
            const sp = n.getComponent(Sprite);
            if (sp?.enabled && sp.spriteFrame) {
                candidates.push(`${n.name}(key=${this.normalizeCategoryNodeTag(n.name)})`);
                if (this.isOrderHitMatch(orderKey, frame, n, sp.spriteFrame, false)) return n;
            }
            for (let i = 0; i < n.children.length; i++) {
                const r = walk(n.children[i]!);
                if (r) return r;
            }
            return null;
        };
        const result = walk(root);
        if (!result) {
            console.warn(`[Finger] no match for orderKey="${orderKey}" among ${candidates.length} candidates:`, candidates.slice(0, 10).join(', '));
        }
        return result;
    }

    private getFirstFrameDeep(n: Node): SpriteFrame | null {
        const own = n.getComponent(Sprite)?.spriteFrame ?? null;
        if (own) return own;
        for (let i = 0; i < n.children.length; i++) {
            const r = this.getFirstFrameDeep(n.children[i]!);
            if (r) return r;
        }
        return null;
    }

    private clearSlots(row: RowState): void {
        for (let i = 0; i < row.slots.length; i++) {
            const slot = row.slots[i];
            if (!slot?.isValid) continue;
            slot.removeAllChildren();
        }
    }

    /**
     * Снимает обводку с еды в GameContainerFood1–2 первого подноса — при успешном клике по следующей порции в куче,
     * до полёта в слот.
     */
    private stripFirstTrayFoodOutlinesOnSlots01(): void {
        const row = this._rows[0];
        if (!row?.root?.isValid) return;
        row.slots = this.resolveSlots(row.root);
        for (const i of [0, 1] as const) {
            const slot = row.slots[i];
            if (!slot?.isValid) continue;
            for (let c = 0; c < slot.children.length; c++) {
                const food = slot.children[c]!;
                if (food?.isValid) this.removeFirstTrayFoodOutlineFromFoodRoot(food);
            }
        }
    }

    /** Белая обводка по каждому Sprite внутри ноды еды — после посадки в первые два слота первого подноса. */
    private tryAddFirstTrayFoodOutlineAfterLanding(slot: Node, foodNode: Node): void {
        const lw = Number(this.firstTraySlotOutlineWidth) || 0;
        if (lw <= 0 || !slot?.isValid || !foodNode?.isValid) return;
        const row0 = this._rows[0];
        if (!row0?.root?.isValid) return;
        row0.slots = this.resolveSlots(row0.root);
        const idx = row0.slots.indexOf(slot);
        if (idx !== 0 && idx !== 1) return;
        this.ensureFirstTrayFoodOutlineOnFoodRoot(foodNode, lw);
    }

    /** Удаляет все ноды `__FirstTrayFoodOutline` в поддереве еды (в т.ч. соседние со спрайтом). */
    private removeFirstTrayFoodOutlineFromFoodRoot(foodRoot: Node): void {
        if (!foodRoot?.isValid) return;
        const acc: Node[] = [];
        const walk = (n: Node) => {
            for (let i = 0; i < n.children.length; i++) {
                const ch = n.children[i]!;
                if (ch.name === FryOrdersSimpleController._firstTrayFoodOutlineChild) acc.push(ch);
                else walk(ch);
            }
        };
        walk(foodRoot);
        for (let i = 0; i < acc.length; i++) {
            const n = acc[i]!;
            if (n?.isValid) n.destroy();
        }
    }

    private ensureFirstTrayFoodOutlineOnFoodRoot(foodNode: Node, lineWidth: number): void {
        if (!foodNode?.isValid || lineWidth <= 0) return;
        this.removeFirstTrayFoodOutlineFromFoodRoot(foodNode);
        const walk = (n: Node) => {
            const sp = n.getComponent(Sprite);
            const ut = n.getComponent(UITransform);
            if (sp?.spriteFrame && sp.enabled !== false && ut) {
                const w = ut.contentSize.width;
                const h = ut.contentSize.height;
                if (w >= 2 && h >= 2) {
                    this.attachFirstTrayOutlineToSpriteNode(n, ut, lineWidth);
                }
            }
            // Снимок детей: attachOutline вставляет соседа в parent и меняет children.length / порядок —
            // иначе тот же Sprite обходится повторно и обводки плодятся до зависания.
            const kids = n.children.slice();
            for (let i = 0; i < kids.length; i++) {
                const ch = kids[i]!;
                if (ch.name === FryOrdersSimpleController._firstTrayFoodOutlineChild) continue;
                walk(ch);
            }
        };
        walk(foodNode);
    }

    /**
     * Обводка — сосед слева от ноды со Sprite у того же родителя: в UI сначала рисуется она, затем спрайт (поверх).
     * Раньше была дочерней — дети всегда поверх спрайта родителя.
     */
    private attachFirstTrayOutlineToSpriteNode(spriteHost: Node, hostTf: UITransform, lineWidth: number): void {
        const gNode = new Node(FryOrdersSimpleController._firstTrayFoodOutlineChild);
        gNode.layer = spriteHost.layer;

        const parent = spriteHost.parent;
        const ax = hostTf.anchorPoint.x;
        const ay = hostTf.anchorPoint.y;
        const w = hostTf.contentSize.width;
        const h = hostTf.contentSize.height;
        const pad = Math.max(1, lineWidth);

        if (parent?.isValid) {
            const insertAt = spriteHost.getSiblingIndex();
            parent.addChild(gNode);
            gNode.setSiblingIndex(insertAt);
            gNode.setPosition(
                spriteHost.position.x + pad * (2 * ax - 1),
                spriteHost.position.y + pad * (2 * ay - 1),
                spriteHost.position.z,
            );
            gNode.setRotationFromEuler(spriteHost.eulerAngles);
            gNode.setScale(spriteHost.scale);
        } else {
            spriteHost.addChild(gNode);
            gNode.setSiblingIndex(0);
        }

        const tf = gNode.addComponent(UITransform);
        tf.setAnchorPoint(ax, ay);
        tf.setContentSize(w + 2 * pad, h + 2 * pad);
        const g = gNode.addComponent(Graphics);
        this.redrawFirstTrayFoodOutline(gNode, g, lineWidth, hostTf);
    }

    private redrawFirstTrayFoodOutline(gNode: Node, g: Graphics, lineWidth: number, hostTf: UITransform): void {
        const ui = gNode.getComponent(UITransform)!;
        const ax = hostTf.anchorPoint.x;
        const ay = hostTf.anchorPoint.y;
        const w = hostTf.contentSize.width;
        const h = hostTf.contentSize.height;
        if (w < 2 || h < 2) return;
        const pad = Math.max(1, lineWidth);
        ui.setAnchorPoint(ax, ay);
        ui.setContentSize(w + 2 * pad, h + 2 * pad);
        // Контур по границе w×h (как у спрайта); половина штриха наружу — не съедается под непрозрачной текстурой.
        const x0 = -w * ax;
        const y0 = -h * ay;
        g.clear();
        g.lineWidth = lineWidth;
        g.strokeColor = Color.WHITE;
        const rad = Math.min(6, Math.min(w, h) * 0.15);
        g.roundRect(x0, y0, w, h, rad);
        g.stroke();
    }

    private updateProgress(row: RowState): void {
        if (!row.progress?.isValid) return;
        row.progress.string = this.progressTemplate.replace(/\{n\}/g, String(row.filled));
    }

    /** Включает всё поддерево Emblem (копии префаба часто с вложенными спрайтами). */
    private ensureEmblemChildrenActive(root: Node | null): void {
        if (!root?.isValid) return;
        root.active = true;
        const walk = (n: Node) => {
            for (let i = 0; i < n.children.length; i++) {
                const ch = n.children[i]!;
                ch.active = true;
                walk(ch);
            }
        };
        walk(root);
    }

    /** Все варианты заказа: прямые дети Emblem или любые потомки со Sprite + именем-категорией. */
    private pickOrderFromEmblemNode(root: Node | null): { key: string; frame: SpriteFrame } | null {
        if (!root?.isValid) return null;
        const variants: Array<{ key: string; frame: SpriteFrame }> = [];
        const seen = new Set<string>();
        const walk = (n: Node) => {
            const sp = n.getComponent(Sprite);
            if (sp?.spriteFrame) {
                const key = this.normalizeNameTag(n.name);
                if (key && !seen.has(key)) {
                    seen.add(key);
                    variants.push({ key, frame: sp.spriteFrame });
                }
            }
            for (let i = 0; i < n.children.length; i++) walk(n.children[i]!);
        };
        walk(root);
        if (variants.length === 0) return null;
        return variants[Math.floor(Math.random() * variants.length)] ?? null;
    }

    private syncActiveRowFromQueue(): void {
        const q = this.fryingQueue;
        if (!q?.isValid) return;
        const idx = q.getActiveRowIndex();
        if (idx >= 0 && idx < this._rows.length) this._activeRow = idx;
    }

    /** Подсказка-палец для текущего активного подноса (очередь / индекс), пока лоток не заполнен 3/3. */
    private isFingerRowActive(): boolean {
        this.syncActiveRowFromQueue();
        const row = this.currentRow();
        return !!(row?.frame && row.filled < 3);
    }

    private currentRow(): RowState | null {
        this.syncActiveRowFromQueue();
        if (this._activeRow < 0 || this._activeRow >= this._rows.length) return null;
        return this._rows[this._activeRow]!;
    }

    private resolveEmblemNode(row: Node): Node | null {
        const fry = row.getChildByName('fry') ?? row.getChildByName('Fry');
        const direct =
            fry?.getChildByName('Emblem') ??
            fry?.getChildByName('emblem') ??
            row.getChildByName('Emblem') ??
            row.getChildByName('emblem');
        if (direct?.isValid) return direct;

        const fryUI = fry?.getChildByName('fryUI') ?? fry?.getChildByName('FryUI');
        const fromUi =
            fryUI?.getChildByName('Emblem') ??
            fryUI?.getChildByName('emblem');
        if (fromUi?.isValid) return fromUi;

        return this.findDescendantByName(row, 'Emblem') ?? this.findDescendantByName(row, 'emblem');
    }

    private findEmblemVariantLeafByKey(host: Node, key: string): Node | null {
        if (!key) return null;
        let found: Node | null = null;
        const walk = (n: Node) => {
            if (found) return;
            const kn = this.normalizeNameTag(n.name);
            if (kn === key) {
                const sp = n.getComponent(Sprite);
                if (sp?.spriteFrame) {
                    found = n;
                    return;
                }
            }
            for (let i = 0; i < n.children.length; i++) walk(n.children[i]!);
        };
        walk(host);
        return found;
    }

    private activateBranchToRoot(leaf: Node, root: Node): void {
        let n: Node | null = leaf;
        while (n) {
            n.active = true;
            if (n === leaf) {
                const sp = n.getComponent(Sprite);
                if (sp?.isValid) {
                    sp.enabled = true;
                    sp.color = Color.WHITE;
                }
            }
            if (n === root) return;
            n = n.parent;
        }
    }

    private applyRowEmblem(row: RowState, orderKey: string, frame: SpriteFrame): void {
        const host = row.emblemNode ?? this.resolveEmblemNode(row.root) ?? null;
        if (!host?.isValid) { console.warn('[Emblem] host not found for row', row.root?.name); return; }
        row.emblemNode = host;
        host.active = true;

        this.hideAllEmblemVariants(host);
        const leaf = this.findEmblemVariantLeafByKey(host, orderKey);
        if (leaf?.isValid) {
            this.activateBranchToRoot(leaf, host);
            const hostSp = host.getComponent(Sprite);
            if (hostSp?.isValid) {
                hostSp.spriteFrame = null;
                hostSp.enabled = false;
            }
            return;
        }

        let sp = host.getComponent(Sprite);
        if (!sp) sp = host.addComponent(Sprite);
        sp.enabled = true;
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.spriteFrame = frame;
        sp.color = Color.WHITE;
        const tf = host.getComponent(UITransform) ?? host.addComponent(UITransform);
        const w = Math.max(48, frame.rect.width);
        const h = Math.max(48, frame.rect.height);
        tf.setContentSize(w, h);
    }

    private resolveProgress(row: Node): RichText | null {
        const fry = row.getChildByName('fry') ?? row.getChildByName('Fry');
        const fryUI = fry?.getChildByName('fryUI') ?? fry?.getChildByName('FryUI');
        const rtNode = fryUI?.getChildByName('RichText') ?? this.findDescendantByName(row, 'RichText');
        return rtNode?.getComponent(RichText) ?? null;
    }

    /** Трей с GameContainerFood* / Emblem: обычно дочерний `fry`, иначе сам корень ряда. */
    private resolveTrayLayoutRoot(row: Node): Node {
        const fry = row.getChildByName('fry') ?? row.getChildByName('Fry');
        return fry?.isValid ? fry : row;
    }

    private resolveSlots(row: Node): (Node | null)[] {
        const layout = this.resolveTrayLayoutRoot(row);
        const out: (Node | null)[] = [];
        for (let i = 1; i <= 3; i++) {
            const names = [`GameContainerFood${i}`, `GameContainerFood ${i}`, `gameContainerFood${i}`];
            let found: Node | null = null;
            for (let k = 0; k < names.length && !found; k++) {
                const nm = names[k]!;
                found =
                    layout.getChildByName(nm) ??
                    row.getChildByName(nm) ??
                    this.findDescendantByName(layout, nm) ??
                    this.findDescendantByName(row, nm);
            }
            out.push(found ?? null);
        }
        return out;
    }

    private findDescendantByName(root: Node, name: string): Node | null {
        if (root.name === name) return root;
        for (let i = 0; i < root.children.length; i++) {
            const r = this.findDescendantByName(root.children[i]!, name);
            if (r) return r;
        }
        return null;
    }

    private hideAllEmblemVariants(root: Node | null): void {
        if (!root?.isValid) return;
        const hostSprite = root.getComponent(Sprite);
        if (hostSprite?.isValid) {
            hostSprite.spriteFrame = null;
            hostSprite.enabled = false;
        }
        const walk = (n: Node) => {
            for (let i = 0; i < n.children.length; i++) {
                const ch = n.children[i]!;
                ch.active = false;
                const sp = ch.getComponent(Sprite);
                if (sp?.isValid) sp.enabled = false;
                walk(ch);
            }
        };
        walk(root);
    }

    private sameFrame(a: SpriteFrame | null, b: SpriteFrame | null): boolean {
        if (!a || !b) return false;
        if (a === b) return true;
        const au = this.normalizeUuid((a as { uuid?: string; _uuid?: string }).uuid ?? (a as { _uuid?: string })._uuid ?? '');
        const bu = this.normalizeUuid((b as { uuid?: string; _uuid?: string }).uuid ?? (b as { _uuid?: string })._uuid ?? '');
        if (au && bu && au === bu) return true;
        const an = (a as { name?: string }).name ?? '';
        const bn = (b as { name?: string }).name ?? '';
        if (an && an === bn) return true;
        return (
            a.rect.x === b.rect.x &&
            a.rect.y === b.rect.y &&
            a.rect.width === b.rect.width &&
            a.rect.height === b.rect.height
        );
    }

    /**
     * Совпадение с заказом. При известном корне клона чужая категория отсекается.
     * @param requireMatchingFrame для клика true — нужен тот же кадр; для пальца false — достаточно категории (экземпляры SpriteFrame могут различаться).
     */
    private isOrderHitMatch(
        orderKey: string,
        orderFrame: SpriteFrame | null,
        candidateNode: Node | null,
        candidateFrame: SpriteFrame | null,
        requireMatchingFrame = true,
    ): boolean {
        if (!candidateNode?.isValid) return false;
        const spawn = this.resolveSpawnRoot();
        const cloneRoot =
            spawn?.isValid ? this.findSpawnedCloneRoot(candidateNode, spawn) ?? null : null;
        const rootKey = cloneRoot ? this.normalizeCategoryNodeTag(cloneRoot.name) : '';

        if (orderKey) {
            if (rootKey) {
                if (rootKey !== orderKey) return false;
                if (!requireMatchingFrame) return true;
                return this.isOrderFrameMatch(orderFrame, candidateFrame);
            }
            if (this.nodeHasOrderKey(candidateNode, orderKey)) {
                if (!requireMatchingFrame) return true;
                return this.isOrderFrameMatch(orderFrame, candidateFrame);
            }
            return this.isOrderFrameMatch(orderFrame, candidateFrame);
        }
        return this.isOrderFrameMatch(orderFrame, candidateFrame);
    }

    private nodeHasOrderKey(node: Node | null, orderKey: string): boolean {
        if (!node || !orderKey) return false;
        for (let n: Node | null = node; n; n = n.parent) {
            const key = this.normalizeCategoryNodeTag(n.name);
            if (key === orderKey) return true;
        }
        return false;
    }

    private isOrderFrameMatch(order: SpriteFrame | null, candidate: SpriteFrame | null): boolean {
        if (!order || !candidate) return false;
        if (this.sameFrame(order, candidate)) return true;
        const a = this.normalizeFrameTag(order);
        const b = this.normalizeFrameTag(candidate);
        if (!a || !b) return false;
        return a === b;
    }

    private normalizeFrameTag(frame: SpriteFrame | null): string {
        const raw = ((frame as { name?: string }).name ?? '').toLowerCase().trim();
        return this.normalizeNameTag(raw);
    }

    private normalizeNameTag(raw: string): string {
        if (!raw) return '';
        const cleaned = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleaned === 'cheeseburger' || cleaned === 'cheeseburgers') return 'cheeseburger';
        if (cleaned === 'chicken' || cleaned === 'chickens') return 'chicken';
        if (cleaned === 'shrimp' || cleaned === 'shrimps') return 'shrimp';
        return cleaned;
    }

    private normalizeCategoryNodeTag(raw: string): string {
        let cleaned = this.normalizeNameTag(raw);
        if (!cleaned) return '';
        cleaned = cleaned.replace(/clone$/, '');
        cleaned = cleaned.replace(/c\d+$/, '');
        return cleaned;
    }

    private normalizeUuid(v: string): string {
        const s = String(v ?? '');
        const at = s.indexOf('@');
        return at >= 0 ? s.slice(0, at) : s;
    }
}
