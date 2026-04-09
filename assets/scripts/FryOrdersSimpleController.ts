import {
    _decorator,
    Camera,
    Color,
    Collider2D,
    Component,
    director,
    EventMouse,
    EventTouch,
    Input,
    instantiate,
    Node,
    PhysicsSystem2D,
    RichText,
    RigidBody2D,
    Sprite,
    SpriteFrame,
    Tween,
    UIOpacity,
    UITransform,
    v2,
    Vec2,
    Vec3,
    input,
    tween,
    view,
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
    /** Локальная позиция ноды `check` в покое (чтобы вернуть после анимации). */
    trayCheckRestLocal: Vec3 | null;
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
            'Включить непрерывный конвейер при старте (ставит conveyorMode на FryingOrdersQueue в true). Выключите для старой пошаговой смены без ленты.',
    })
    enableConveyorBelt = true;

    @property({
        tooltip:
            'Только для первого подноса: сколько слотов уже занято из 3 (прогресс 2/3 и т.д.). Не задаёт количество подносов в очереди — их число = уникальные ноды в Fry Rows.',
    })
    firstRowInitialFilled = 2;

    @property({ tooltip: 'Template for progress text' })
    progressTemplate = '<b><color=#fff>{n}/3</color></b>';

    @property({ tooltip: 'Finger x offset in world space' })
    fingerOffsetX = 0;

    @property({ tooltip: 'Finger y offset in world space' })
    fingerOffsetY = 40;

    @property({ tooltip: 'Длительность плавного появления/исчезновения руки (сек)' })
    fingerFadeDuration = 0.18;

    @property({ tooltip: 'Длительность одного цикла тап-подсказки руки (сек)' })
    fingerTapCycleDuration = 1.45;

    @property({ tooltip: 'Устаревший параметр старой анимации руки. Больше не используется.' })
    fingerTapMoveY = 18;

    @property({ tooltip: 'Устаревший параметр старой анимации руки. Больше не используется.' })
    fingerTapMoveX = 6;

    @property({ tooltip: 'Поворот руки в момент тапа-подсказки (градусы)' })
    fingerTapRotateDeg = -6;

    @property({ tooltip: 'Во сколько раз целевой клон уменьшается в момент тапа-подсказки' })
    fingerTargetPressScale = 0.92;

    @property({ tooltip: 'Через сколько секунд бездействия показать один цикл подсказки' })
    fingerIdleHintDelay = 4;

    @property({ tooltip: 'Сила shake при нажатии на неправильный клон (px)' })
    wrongTapShakeDistance = 10;

    @property({ tooltip: 'Длительность shake при неправильном клике (сек)' })
    wrongTapShakeDuration = 0.24;

    @property({ tooltip: 'Длительность красной подсветки неправильного клона (сек)' })
    wrongTapTintDuration = 0.22;

    @property({ tooltip: 'Откуда по Y палец влетает к цели снизу (px)' })
    fingerFlyInOffsetY = -120;

    @property({ tooltip: 'Куда по Y палец улетает вверх после тапа (px)' })
    fingerFlyOutOffsetY = 120;

    @property({ tooltip: 'Устаревший параметр старой анимации руки. Больше не используется.' })
    fingerTapExpandScale = 1.08;

    @property({ tooltip: 'Устаревший параметр старой анимации руки. Больше не используется.' })
    fingerTapPressScale = 0.92;

    @property({ tooltip: 'Устаревший параметр старой анимации клона. Больше не используется.' })
    fingerTargetPopScale = 1.1;

    @property({ tooltip: 'Горизонтальный шаг между подносами в очереди (px). Первый ряд остаётся на месте, остальные выстраиваются правее.' })
    queueSlotSpacingX = 100;

    @property({ tooltip: 'На сколько px влево уезжает завершённый поднос' })
    queueCompletedExitLeft = 320;

    @property({ tooltip: 'Длительность сдвига очереди (сек)' })
    queueLayoutTweenDuration = 0.28;

    @property({ tooltip: 'Пауза перед уходом подноса после 3/3 (сек)' })
    queueCompletePauseSec = 1;

    @property({ tooltip: 'Длительность анимации нажатия на еду (сек)' })
    pickPulseDuration = 0.055;

    @property({ tooltip: 'Во сколько раз еда чуть уменьшается в момент тапа' })
    pickPulseShrinkScale = 0.92;

    @property({ tooltip: 'Во сколько раз еда чуть увеличивается после тапа перед полётом' })
    pickPulseExpandScale = 1.06;

    @property({ tooltip: 'Длительность полёта еды в слот (сек)' })
    pickFlyDuration = 0.42;

    @property({ tooltip: 'Нода `check`: сдвиг вверх в локальных px после 3/3, затем скрытие' })
    trayCheckFloatOffsetY = 30;

    @property({ tooltip: 'Длительность подъёма галочки check (сек)' })
    trayCheckFloatDuration = 0.38;

    @property({ tooltip: 'Затухание галочки check в конце (сек)' })
    trayCheckFadeOutDuration = 0.22;

    @property({
        type: Node,
        tooltip:
            'Одна общая нода check на Canvas (вне fry). Если не задана — ищется в сцене по имени check / Check.',
    })
    trayCompleteCheckNode: Node | null = null;

    @property({ tooltip: 'Высота дуги при перелёте еды в слот' })
    pickFlyArcHeight = 105;

    private _rows: RowState[] = [];
    private _activeRow = 0;
    private _rainDone = false;
    private _targetFoodNode: Node | null = null;
    private readonly _tmpLocal = new Vec3();
    private readonly _tmpWorld = new Vec3();
    private _waitingQueueAdvanceFrom = -1;
    private _fingerPointNode: Node | null = null;
    private _fingerSwayActive = false;
    private _fingerSwayTime = 0;
    private _fingerShouldBeVisible = false;
    private _fingerResizeRetryCount = 0;
    private _fingerPulseTarget: Node | null = null;
    private readonly _fingerBaseScale = new Vec3(1, 1, 1);
    private readonly _fingerPulseBaseScale = new Vec3(1, 1, 1);
    private readonly _fingerCycleStartLocal = new Vec3();
    private readonly _fingerCycleTargetLocal = new Vec3();
    private readonly _fingerCycleExitLocal = new Vec3();
    private _fingerBaseAngle = 0;
    private _fingerCyclePrimed = false;
    private _fingerInitialTutorActive = true;
    private _fingerIdleElapsed = 0;
    private _fingerRestoreAfterResize = false;
    private _boardInputEnabled = true;
    private _pickAnimationInFlight = false;
    private readonly _slotsWithActiveFly = new Set<string>();

    /** Вызывается очередью / SorEndgame при заморозке. */
    public setBoardInputEnabled(on: boolean): void {
        this._boardInputEnabled = on;
    }

    /** Для FryingOrdersQueue (conveyor): сколько предметов в подносе (0–3). */
    public getFilledForTrayRoot(root: Node | null): number {
        if (!root?.isValid) {
            return 0;
        }
        const r = this._rows.find((x) => x.root === root);
        return r ? r.filled : 0;
    }

    /**
     * Незаполненный поднос ушёл за экран — удалить из логики заказов (без UI, пока очередь не sync).
     * @returns индекс удалённого ряда или -1
     */
    public removeTrayByConveyorUnfilled(root: Node | null): number {
        if (!root?.isValid) {
            return -1;
        }
        const idx = this._rows.findIndex((x) => x.root === root);
        if (idx < 0) {
            return -1;
        }
        this._rows.splice(idx, 1);
        if (idx < this._activeRow) {
            this._activeRow--;
        } else if (idx === this._activeRow) {
            this._activeRow = Math.min(idx, Math.max(0, this._rows.length - 1));
        }
        this._activeRow = Math.max(0, this._activeRow);
        return idx;
    }

    public refreshAfterConveyorRemoval(): void {
        this.syncActiveRowFromQueue();
        if (this._rows.length === 0) {
            this.hideFinger();
            return;
        }
        this.prepareActiveRow();
        this.scheduleOnce(() => {
            this.refreshFingerTarget();
            this.queueIdleFingerHint();
        }, 0);
        this.physicsBowl?.refreshPhysicsBoundsAfterLayout();
    }

    protected override onLoad(): void {
        console.log('[FryOrders] onLoad node=' + this.node?.name + ' fryRows=' + this.fryRows.length + ' finger=' + !!this.fingerNode);
        this.buildRows();
        this.resetAllRows();
        if (this.fingerNode?.isValid) {
            this._fingerBaseScale.set(this.fingerNode.scale);
            this._fingerBaseAngle = this.fingerNode.angle;
            const opacity = this.ensureFingerOpacity();
            if (opacity) {
                opacity.opacity = 0;
            }
        }
        this.hideFinger(true);
        input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.on(Input.EventType.MOUSE_UP, this.onMouseUp, this);
        view.on('canvas-resize', this.onCanvasResize, this);
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
            if (this.enableConveyorBelt) {
                this.fryingQueue.conveyorMode = true;
            }
            this.fryingQueue.bindRows(this._rows.map((r) => r.root), this);
            this._activeRow = this.fryingQueue.getActiveRowIndex();
        }
        this.prepareAllRowsAtStart();
        this.waitForRainAndShowFinger();
    }

    /** Эмблема и заказ для каждого подноса в очереди (раньше гасились все, кроме активного). */
    private prepareAllRowsAtStart(): void {
        for (let i = 0; i < this._rows.length; i++) {
            const row = this._rows[i]!;
            const isFirstTray = this._rows.length > 0 && row.root === this._rows[0]!.root;
            this.prepareSingleRow(row, isFirstTray, true);
        }
    }

    protected override update(dt: number): void {
        this.updateFingerFollow();
        this.updateFingerSway(dt);
        this.updateFingerTargetPulse();
        this.updateIdleFingerHint(dt);
    }

    private updateFingerSway(dt: number): void {
        const finger = this.fingerNode;
        if (!finger?.isValid) return;
        if (!this._fingerSwayActive || !this.isFingerRowActive()) {
            finger.setScale(this._fingerBaseScale);
            finger.angle = this._fingerBaseAngle;
            return;
        }

        const duration = Math.max(0.6, this.fingerTapCycleDuration);
        this._fingerSwayTime += dt;
        if (!this._fingerCyclePrimed) {
            this._fingerSwayTime = 0;
            this.primeFingerCycle();
        } else if (this._fingerSwayTime >= duration) {
            this.completeFingerCycle();
            return;
        }

        const opacity = this.ensureFingerOpacity();
        const phase = this.getFingerTapPhase();
        finger.setScale(this._fingerBaseScale);
        finger.angle = this._fingerBaseAngle;

        if (phase < 0.32) {
            const t = this.easeOutCubic(phase / 0.32);
            const pos = this.lerpVec3(this._fingerCycleStartLocal, this._fingerCycleTargetLocal, t);
            finger.setPosition(pos);
            if (opacity) {
                opacity.opacity = Math.round(255 * t);
            }
            return;
        }

        if (phase < 0.5) {
            finger.setPosition(this._fingerCycleTargetLocal);
            finger.angle = this._fingerBaseAngle + this.fingerTapRotateDeg * this.getFingerTapPressAlpha();
            if (opacity) {
                opacity.opacity = 255;
            }
            return;
        }

        if (phase < 0.82) {
            const t = this.easeInOutQuad((phase - 0.5) / 0.32);
            const pos = this.lerpVec3(this._fingerCycleTargetLocal, this._fingerCycleExitLocal, t);
            finger.setPosition(pos);
            if (opacity) {
                opacity.opacity = Math.round(255 * (1 - t));
            }
            return;
        }

        finger.setPosition(this._fingerCycleExitLocal);
        if (opacity) {
            opacity.opacity = 0;
        }
    }

    protected override onDestroy(): void {
        input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.off(Input.EventType.MOUSE_UP, this.onMouseUp, this);
        view.off('canvas-resize', this.onCanvasResize, this);
        this.unschedule(this.restoreFingerAfterResize);
        this.clearFingerPulseTarget();
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
            trayCheckRestLocal: null,
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
        this.ensureTrayBackgroundBehindFoodSlots(this.resolveTrayLayoutRoot(row.root));
    }

    private resetAllRows(): void {
        for (let i = 0; i < this._rows.length; i++) {
            const row = this._rows[i]!;
            this.clearSlots(row);
            row.orderKey = '';
            row.frame = null;
            row.filled = 0;
            row.trayCheckRestLocal = null;
            this.hideAllEmblemVariants(row.emblemNode);
            this.updateProgress(row);
        }
    }

    private prepareActiveRow(): void {
        const row = this.currentRow();
        if (!row) {
            console.warn('[FryOrders] prepareActiveRow: no current row, _activeRow=' + this._activeRow + ' total=' + this._rows.length);
            return;
        }
        const isFirstTray = this._rows.length > 0 && row.root === this._rows[0]!.root;
        this.prepareSingleRow(row, isFirstTray, false);
    }

    /**
     * @param fullInit — старт уровня / новый поднос: случайный заказ, очистка слотов.
     *   false — смена активного подноса: сохранить уже выбранный заказ и прогресс слотов.
     */
    private prepareSingleRow(row: RowState, isFirstTray: boolean, fullInit: boolean): void {
        if (!row?.root?.isValid) return;
        this.refreshSingleRowRefs(row);
        this.ensureEmblemChildrenActive(row.emblemNode);

        let order: { key: string; frame: SpriteFrame } | null = null;
        if (!fullInit && row.orderKey && row.frame) {
            order = { key: row.orderKey, frame: row.frame };
        } else {
            order = this.pickOrderFromEmblemNode(row.emblemNode);
            if (!order) {
                console.warn('[FryOrders] prepareSingleRow: pickOrder returned null for', row.root?.name);
                return;
            }
            row.orderKey = order.key;
            row.frame = order.frame;
        }

        this.applyRowEmblem(row, row.orderKey, row.frame!);

        if (fullInit) {
            this.hideTrayOrderCompleteMarks(row);
            this.clearSlots(row);
            const baseFilled = isFirstTray ? Math.max(0, Math.min(3, this.firstRowInitialFilled)) : 0;
            row.filled = baseFilled;
            for (let i = 0; i < baseFilled; i++) {
                const slot = row.slots[i];
                if (!slot?.isValid) {
                    console.warn(`[FryOrders] Слот GameContainerFood${i + 1} не найден под "${row.root.name}" — проверьте иерархию (слоты как дочерние "fry").`);
                }
            }
            if (isFirstTray && baseFilled > 0) {
                this.fillFirstTrayInitialSlotsFromSpawn();
                this.scheduleFillFirstTrayInitialSlotsUntilDone();
            }
        }

        this.updateProgress(row);
    }

    private waitForRainAndShowFinger(): void {
        if (this._rainDone) {
            this.refreshFingerTarget();
            this.showFinger();
            return;
        }
        const done = this.physicsBowl?.isRainSpawnFinished() ?? true;
        console.log('[FryOrders] waitForRain: done=' + done + ' bowl=' + !!this.physicsBowl);
        if (done) {
            this._rainDone = true;
            this.refreshFingerTarget();
            this.showFinger();
            return;
        }
        this.scheduleOnce(() => this.waitForRainAndShowFinger(), 0.05);
    }

    private onTouchEnd(e: EventTouch): void {
        this.notePlayerInteraction();
        this.handlePick(e.getUILocation(), e.getLocation());
    }

    private onMouseUp(e: EventMouse): void {
        this.notePlayerInteraction();
        this.handlePick(e.getUILocation(), e.getLocation());
    }

    /** Клик по еде в gameContainer: попадание только если тип совпадает с заказом текущего подноса (ключ из Emblem). */
    private handlePick(uiPoint: Vec2, screenPoint: Vec2): void {
        if (!this._boardInputEnabled || !this._rainDone || this._pickAnimationInFlight) return;
        const row = this.currentRow();
        if (!row?.frame) return;
        if (row.filled >= 3) return;

        const spawn = this.resolveSpawnRoot();
        if (!spawn?.isValid) return;
        const hit = this.hitTestFoodUnderSpawn(spawn, screenPoint, uiPoint);
        if (!hit?.isValid) return;
        const cloneRoot = this.findSpawnedCloneRoot(hit, spawn) ?? hit;
        const hitFrame = this.getFirstFrameDeep(hit);
        if (!this.isOrderHitMatch(row.orderKey, row.frame, hit, hitFrame, true)) {
            this.playWrongPickFeedback(cloneRoot);
            return;
        }

        SorEndgameController.I?.notifyFirstCorrectPick();
        this._targetFoodNode = cloneRoot;
        this.placePickedFoodIntoCurrentRow();
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

        const finalizePlacement = () => {
            this._pickAnimationInFlight = false;
            this._targetFoodNode = null;
            row.filled++;
            this.updateProgress(row);

            if (row.filled >= 3) {
                this.handleRowCompleted();
                return;
            }

            this.refreshFingerTarget();
            this.queueIdleFingerHint();
        };

        const pickedNode = this._targetFoodNode;
        if (pickedNode?.isValid) {
            this._pickAnimationInFlight = true;
            this.hideFinger();
            this.moveNodeIntoSlot(pickedNode, slot, finalizePlacement, () => {
                if (pickedNode.isValid) {
                    pickedNode.destroy();
                }
                this.placeFrameInSlot(slot, row.frame!);
                finalizePlacement();
            });
        } else {
            this.placeFrameInSlot(slot, row.frame);
            finalizePlacement();
        }
    }

    private moveNodeIntoSlot(
        foodNode: Node,
        slot: Node,
        onComplete: () => void,
        onFallback: () => void,
    ): void {
        if (!foodNode?.isValid || !slot?.isValid) {
            onFallback();
            return;
        }

        const sourceParent = foodNode.parent;
        const flightParent = sourceParent?.isValid ? sourceParent : this.resolveFoodFlightParent(slot);
        const parentTf = flightParent?.getComponent(UITransform);
        if (!flightParent?.isValid || !parentTf) {
            onFallback();
            return;
        }

        const flightNode = instantiate(foodNode);
        this.stripPhysics(flightNode);
        this.applyLayerRecursive(flightNode, slot.layer);
        flightParent.addChild(flightNode);
        flightNode.setSiblingIndex(Math.max(0, flightParent.children.length - 1));

        let startLocalPos: Vec3;
        let startScale: Vec3;
        let startFlightLocalEulerZ: number;
        if (sourceParent?.isValid && sourceParent === flightParent) {
            startLocalPos = foodNode.position.clone();
            startScale = foodNode.scale.clone();
            startFlightLocalEulerZ = foodNode.angle;
        } else {
            const startWorldPos = foodNode.worldPosition.clone();
            const startWorldScale = foodNode.worldScale.clone();
            const startWorldEulerZ = this.getWorldEulerZ(foodNode);
            startLocalPos = new Vec3();
            parentTf.convertToNodeSpaceAR(startWorldPos, startLocalPos);
            startScale = this.worldScaleToLocalScale(startWorldScale, flightParent, flightNode.scale.z);
            startFlightLocalEulerZ = this.getLocalEulerZForParent(startWorldEulerZ, flightParent);
        }
        flightNode.setPosition(startLocalPos);
        flightNode.setScale(startScale);
        flightNode.angle = startFlightLocalEulerZ;
        foodNode.destroy();

        const pulseExpandScale = this.scaledVec3(startScale, this.pickPulseExpandScale);
        const targetScratch = new Vec3();
        parentTf.convertToNodeSpaceAR(slot.worldPosition, targetScratch);
        const targetScale = this.computeSlotFitScaleInParent(flightNode, slot, flightParent, startScale.z);
        const fallback = () => {
            if (flightNode.isValid) {
                flightNode.destroy();
            }
            onFallback();
        };

        const flightState: { t: number } = { t: 0 };

tween(flightState)
    .to(Math.max(0.08, this.pickFlyDuration), { t: 1 }, {
        easing: 'sineInOut',
        onUpdate: (state?: { t: number }) => {
            if (!flightNode.isValid || !state || !slot.isValid || !parentTf.isValid) return;

            parentTf.convertToNodeSpaceAR(slot.worldPosition, targetScratch);
            const controlPos = this.computePickupArcControlPoint(startLocalPos, targetScratch);
            const tw = this.getWorldEulerZ(slot);
            const rzEnd = this.getLocalEulerZForParent(tw, flightParent);

            const pos = this.sampleQuadraticBezier(startLocalPos, controlPos, targetScratch, state.t);
            const scale = this.lerpVec3(pulseExpandScale, targetScale, state.t);
            const rotZ = this.lerpAngleDeg(startFlightLocalEulerZ, rzEnd, state.t);

            flightNode.setPosition(pos);
            flightNode.setScale(scale);
            flightNode.angle = rotZ;
        },
    })
    .call(() => {
        if (!flightNode.isValid || !slot.isValid) {
            fallback();
            return;
        }

        slot.removeAllChildren();
        flightNode.removeFromParent();
        this.applyLayerRecursive(flightNode, slot.layer);
        slot.addChild(flightNode);
        flightNode.setPosition(0, 0, 0);
        flightNode.angle = 0;
        flightNode.setScale(1, 1, 1);

        const slotTf = slot.getComponent(UITransform);
        if (slotTf) {
            const targetW = Math.max(24, slotTf.contentSize.width * 0.78);
            const targetH = Math.max(24, slotTf.contentSize.height * 0.78);
            this.fitNodeToSize(flightNode, targetW, targetH);
        }

        onComplete();
    })
            .start();
    }

    private playWrongPickFeedback(targetNode: Node | null): void {
        this.playWrongPickShake();
        this.playWrongPickTint(targetNode);
    }

    private playWrongPickShake(): void {
        const target = this.resolveWrongPickShakeTarget();
        if (!target?.isValid) {
            return;
        }
        const basePos = target.position.clone();
        const distance = Math.max(2, this.wrongTapShakeDistance);
        const duration = Math.max(0.12, this.wrongTapShakeDuration);
        const left = new Vec3(basePos.x - distance, basePos.y, basePos.z);
        const right = new Vec3(basePos.x + distance, basePos.y, basePos.z);
        const leftSoft = new Vec3(basePos.x - distance * 0.45, basePos.y, basePos.z);

        Tween.stopAllByTarget(target);
        target.setPosition(basePos);
        tween(target)
            .to(duration * 0.22, { position: left }, { easing: 'sineOut' })
            .to(duration * 0.28, { position: right }, { easing: 'sineInOut' })
            .to(duration * 0.18, { position: leftSoft }, { easing: 'sineInOut' })
            .to(duration * 0.32, { position: basePos }, { easing: 'sineOut' })
            .start();
    }

    private resolveWrongPickShakeTarget(): Node | null {
        return this.resolveSpawnRoot() ?? this.gameContainer ?? this.node;
    }

    private playWrongPickTint(targetNode: Node | null): void {
        if (!targetNode?.isValid) {
            return;
        }
        const sprites = targetNode.getComponentsInChildren(Sprite);
        if (!sprites.length) {
            return;
        }

        const tintColor = new Color(255, 135, 135, 255);
        const duration = Math.max(0.12, this.wrongTapTintDuration);
        for (let i = 0; i < sprites.length; i++) {
            const sp = sprites[i]!;
            if (!sp?.isValid) continue;
            const tweenTarget = sp as Sprite & { __wrongTapTintT?: number };
            const baseColor = sp.color.clone();
            tweenTarget.__wrongTapTintT = 0;
            Tween.stopAllByTarget(tweenTarget);
            tween(tweenTarget)
                .to(duration * 0.35, { __wrongTapTintT: 1 }, {
                    easing: 'quadOut',
                    onUpdate: () => {
                        if (!sp.isValid) return;
                        sp.color = this.lerpColor(baseColor, tintColor, tweenTarget.__wrongTapTintT ?? 0);
                    },
                })
                .to(duration * 0.65, { __wrongTapTintT: 0 }, {
                    easing: 'sineInOut',
                    onUpdate: () => {
                        if (!sp.isValid) return;
                        sp.color = this.lerpColor(baseColor, tintColor, tweenTarget.__wrongTapTintT ?? 0);
                    },
                })
                .call(() => {
                    if (sp.isValid) {
                        sp.color = baseColor;
                    }
                })
                .start();
        }
    }

    private resolveFoodFlightParent(slot: Node): Node | null {
        return this.node.parent ?? slot.parent ?? this.node;
    }

    private computeSlotFitScaleInParent(node: Node, slot: Node, parent: Node, zScale: number): Vec3 {
        const slotTf = slot.getComponent(UITransform);
        const nodeTf = node.getComponent(UITransform);
        if (!slotTf || !nodeTf) {
            return node.scale.clone();
        }

        const targetW = Math.max(24, slotTf.contentSize.width * 0.78);
        const targetH = Math.max(24, slotTf.contentSize.height * 0.78);
        const baseW = Math.max(1, nodeTf.contentSize.width || 1);
        const baseH = Math.max(1, nodeTf.contentSize.height || 1);
        const slotWorldScale = slot.worldScale;
        const parentWorldScale = parent.worldScale;
        const targetWorldW = targetW * Math.abs(slotWorldScale.x);
        const targetWorldH = targetH * Math.abs(slotWorldScale.y);
        const targetWorldScale = Math.min(targetWorldW / baseW, targetWorldH / baseH);
        const px = Math.max(1e-4, Math.abs(parentWorldScale.x));
        const py = Math.max(1e-4, Math.abs(parentWorldScale.y));

        return new Vec3(targetWorldScale / px, targetWorldScale / py, zScale);
    }

    private worldScaleToLocalScale(worldScale: Vec3, parent: Node, zScale: number): Vec3 {
        const parentWorldScale = parent.worldScale;
        const px = Math.abs(parentWorldScale.x) > 1e-4 ? parentWorldScale.x : 1;
        const py = Math.abs(parentWorldScale.y) > 1e-4 ? parentWorldScale.y : 1;
        return new Vec3(worldScale.x / px, worldScale.y / py, zScale);
    }

    private computePickupArcControlPoint(start: Vec3, end: Vec3): Vec3 {
        const dx = Math.abs(end.x - start.x);
        const arcHeight = Math.max(70, Math.min(160, this.pickFlyArcHeight + dx * 0.12));
        return new Vec3(
            (start.x + end.x) * 0.5,
            Math.max(start.y, end.y) + arcHeight,
            0,
        );
    }

    private sampleQuadraticBezier(start: Vec3, control: Vec3, end: Vec3, t: number): Vec3 {
        const tt = this.clamp01(t);
        const omt = 1 - tt;
        return new Vec3(
            omt * omt * start.x + 2 * omt * tt * control.x + tt * tt * end.x,
            omt * omt * start.y + 2 * omt * tt * control.y + tt * tt * end.y,
            omt * omt * start.z + 2 * omt * tt * control.z + tt * tt * end.z,
        );
    }

    private scaledVec3(v: Vec3, mul: number): Vec3 {
        return new Vec3(v.x * mul, v.y * mul, v.z);
    }

    private lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
        const tt = this.clamp01(t);
        return new Vec3(
            a.x + (b.x - a.x) * tt,
            a.y + (b.y - a.y) * tt,
            a.z + (b.z - a.z) * tt,
        );
    }

    private lerpColor(a: Color, b: Color, t: number): Color {
        const tt = this.clamp01(t);
        return new Color(
            Math.round(a.r + (b.r - a.r) * tt),
            Math.round(a.g + (b.g - a.g) * tt),
            Math.round(a.b + (b.b - a.b) * tt),
            Math.round(a.a + (b.a - a.a) * tt),
        );
    }

    private lerpNumber(a: number, b: number, t: number): number {
        return a + (b - a) * this.clamp01(t);
    }

    private getWorldEulerZ(node: Node | null): number {
        let angle = 0;
        for (let n = node; n; n = n.parent) {
            angle += n.angle;
        }
        return angle;
    }

    private getLocalEulerZForParent(worldZ: number, parent: Node | null): number {
        const parentWorldZ = parent ? this.getWorldEulerZ(parent) : 0;
        return worldZ - parentWorldZ;
    }

    private lerpAngleDeg(a: number, b: number, t: number): number {
        const from = a;
        const to = this.unwrapAngleDeg(a, b);
        return from + (to - from) * this.clamp01(t);
    }

    private unwrapAngleDeg(reference: number, angle: number): number {
        let out = angle;
        while (out - reference > 180) out -= 360;
        while (out - reference < -180) out += 360;
        return out;
    }

    private normalizeAngleDeg(v: number): number {
        let angle = v % 360;
        if (angle > 180) angle -= 360;
        if (angle < -180) angle += 360;
        return angle;
    }

    private clamp01(v: number): number {
        if (v < 0) return 0;
        if (v > 1) return 1;
        return v;
    }

    private computeFitScale(node: Node, targetW: number, targetH: number): number {
        const tf = node.getComponent(UITransform);
        if (!tf) return 1;
        const curW = tf.contentSize.width || 1;
        const curH = tf.contentSize.height || 1;
        return Math.min(targetW / curW, targetH / curH);
    }

    private fitNodeToSize(node: Node, targetW: number, targetH: number): void {
        const tf = node.getComponent(UITransform);
        if (!tf) return;
        const scale = this.computeFitScale(node, targetW, targetH);
        node.setScale(scale, scale, 1);
    }

    /**
     * Снимает 2D-физику без опоры на constructor.name (в release-билде имена минифицируются
     * и Collider/RigidBody не находились — твин перелёта конфликтовал с симуляцией).
     */
    private stripPhysics(node: Node): void {
        const walk = (n: Node) => {
            const comps = n.getComponents(Component);
            for (let i = comps.length - 1; i >= 0; i--) {
                const c = comps[i]!;
                if (c instanceof RigidBody2D || c instanceof Collider2D) {
                    c.enabled = false;
                    c.destroy();
                }
            }
            for (let i = 0; i < n.children.length; i++) walk(n.children[i]!);
        };
        walk(node);
    }

    /** Один layer на всё поддерево — иначе дочерний Sprite может остаться не на том LayerMask UI-камеры. */
    private applyLayerRecursive(root: Node, layer: number): void {
        const walk = (n: Node) => {
            n.layer = layer;
            for (let i = 0; i < n.children.length; i++) walk(n.children[i]!);
        };
        walk(root);
    }

    private handleRowCompleted(): void {
        this.hideFinger();
        const completedRow = this.currentRow();
        if (completedRow) {
            this.showTrayOrderCompleteMark(completedRow);
        }
        const q = this.fryingQueue;
        if (q?.isValid) {
            const prev = q.getActiveRowIndex();
            this._waitingQueueAdvanceFrom = prev;
            q.notifyActiveRowComplete();
            if (SorEndgameController.I?.isGameEnded()) {
                this._waitingQueueAdvanceFrom = -1;
                return;
            }
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
            this.scheduleOnce(() => {
                this.refreshFingerTarget();
                this.queueIdleFingerHint();
            }, 0);
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
        this.scheduleOnce(() => {
            this.refreshFingerTarget();
            this.queueIdleFingerHint();
        }, 0);
    }

    private refreshFingerTarget(): void {
        if (!this.isFingerRowActive()) {
            this._targetFoodNode = null;
            this.hideFinger();
            return;
        }
        const row = this.currentRow();
        const spawn = this.resolveSpawnRoot();
        if (!row?.frame || !spawn?.isValid) {
            this._targetFoodNode = null;
            console.warn('[Finger] no row/frame or spawn', !!row?.frame, !!spawn?.isValid);
            return;
        }
        this._targetFoodNode = this.findFirstMatchingFoodNode(spawn, row.orderKey, row.frame);
        this.syncFingerPulseTarget(this._targetFoodNode);
        console.log(`[Finger] target="${this._targetFoodNode?.name ?? 'null'}" orderKey="${row.orderKey}" spawnChildren=${spawn.children.length}`);
    }

    private updateFingerFollow(): void {
        if (!this.isFingerRowActive()) return;
        let target = this._targetFoodNode;
        if (!target?.isValid) {
            this.refreshFingerTarget();
            target = this._targetFoodNode;
            if (!target?.isValid) {
                if (this._fingerShouldBeVisible) {
                    this.hideFinger();
                }
                return;
            }
        }
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

    private showFinger(): void {
        const finger = this.fingerNode;
        if (!finger?.isValid) return;
        const hasTarget = !!this._targetFoodNode?.isValid;
        this._fingerShouldBeVisible = hasTarget;
        if (hasTarget) {
            this.cancelIdleFingerHint();
            finger.active = true;
            const opacity = this.ensureFingerOpacity();
            if (opacity) {
                Tween.stopAllByTarget(opacity);
                opacity.opacity = 0;
            }
            this.startFingerSway();
            this.primeFingerCycle();
        } else {
            this.hideFinger();
        }
    }

    private hideFinger(immediate = false): void {
        const finger = this.fingerNode;
        if (!finger?.isValid) return;
        this._fingerShouldBeVisible = false;
        this.stopFingerSway();
        this.clearFingerPulseTarget();
        const opacity = this.ensureFingerOpacity();
        if (!opacity || immediate) {
            if (opacity) {
                opacity.opacity = 0;
            }
            finger.active = false;
            return;
        }
        if (!finger.activeInHierarchy) {
            opacity.opacity = 0;
            finger.active = false;
            return;
        }
        Tween.stopAllByTarget(opacity);
        tween(opacity)
            .to(Math.max(0.01, this.fingerFadeDuration), { opacity: 0 }, { easing: 'sineInOut' })
            .call(() => {
                if (finger.isValid && !this._fingerShouldBeVisible) {
                    finger.active = false;
                }
            })
            .start();
    }

    private startFingerSway(): void {
        if (!this.fingerNode?.isValid) return;
        this._fingerSwayTime = 0;
        this._fingerSwayActive = true;
        this._fingerCyclePrimed = false;
    }

    private stopFingerSway(): void {
        this._fingerSwayActive = false;
        this._fingerSwayTime = 0;
        this._fingerCyclePrimed = false;
        if (this.fingerNode?.isValid) {
            this.fingerNode.setScale(this._fingerBaseScale);
            this.fingerNode.angle = this._fingerBaseAngle;
        }
    }

    private ensureFingerOpacity(): UIOpacity | null {
        const finger = this.fingerNode;
        if (!finger?.isValid) return null;
        return finger.getComponent(UIOpacity) ?? finger.addComponent(UIOpacity);
    }

    private onCanvasResize(): void {
        this._fingerResizeRetryCount = 0;
        this._fingerRestoreAfterResize = this._fingerShouldBeVisible;
        this.hideFinger(true);
        this.unschedule(this.restoreFingerAfterResize);
        if (this._fingerRestoreAfterResize) {
            this.scheduleOnce(this.restoreFingerAfterResize, 0.1);
        }
    }

    private restoreFingerAfterResize(): void {
        if (this._pickAnimationInFlight || !this._rainDone || !this.isFingerRowActive()) {
            return;
        }
        if (!this._fingerRestoreAfterResize) {
            return;
        }
        this.refreshFingerTarget();
        if (this._targetFoodNode?.isValid) {
            this.showFinger();
            this._fingerRestoreAfterResize = false;
            return;
        }
        this._fingerResizeRetryCount++;
        if (this._fingerResizeRetryCount < 4) {
            this.scheduleOnce(this.restoreFingerAfterResize, 0.08);
        }
    }

    private getFingerTapPressAlpha(): number {
        const phase = this.getFingerTapPhase();
        if (phase < 0.32) {
            return 0;
        }
        if (phase < 0.4) {
            const localT = (phase - 0.32) / 0.08;
            return this.easeInOutQuad(localT);
        }
        if (phase < 0.5) {
            const localT = (phase - 0.4) / 0.1;
            return 1 - this.easeInOutQuad(localT);
        }
        return 0;
    }

    private getFingerTapPhase(): number {
        const duration = Math.max(0.8, this.fingerTapCycleDuration);
        return (this._fingerSwayTime % duration) / duration;
    }

    private easeInOutQuad(t: number): number {
        const tt = this.clamp01(t);
        if (tt < 0.5) {
            return 2 * tt * tt;
        }
        return 1 - Math.pow(-2 * tt + 2, 2) / 2;
    }

    private easeOutCubic(t: number): number {
        const tt = this.clamp01(t);
        return 1 - Math.pow(1 - tt, 3);
    }

    private primeFingerCycle(): void {
        const finger = this.fingerNode;
        const target = this._targetFoodNode;
        if (!finger?.isValid || !target?.isValid) {
            return;
        }
        if (!this.resolveFingerTargetLocalPosition(target, this._fingerCycleTargetLocal)) {
            return;
        }
        this._fingerCycleStartLocal.set(
            this._fingerCycleTargetLocal.x,
            this._fingerCycleTargetLocal.y + this.fingerFlyInOffsetY,
            0,
        );
        this._fingerCycleExitLocal.set(
            this._fingerCycleTargetLocal.x,
            this._fingerCycleTargetLocal.y + this.fingerFlyOutOffsetY,
            0,
        );
        finger.setPosition(this._fingerCycleStartLocal);
        finger.setScale(this._fingerBaseScale);
        finger.angle = this._fingerBaseAngle;
        const opacity = this.ensureFingerOpacity();
        if (opacity) {
            opacity.opacity = 0;
        }
        this._fingerCyclePrimed = true;
    }

    private completeFingerCycle(): void {
        if (this._fingerInitialTutorActive && this._targetFoodNode?.isValid && this.isFingerRowActive()) {
            this._fingerSwayTime = 0;
            this._fingerCyclePrimed = false;
            this.primeFingerCycle();
            return;
        }
        this.hideFinger(true);
        this.queueIdleFingerHint();
    }

    private queueIdleFingerHint(): void {
        if (this._fingerInitialTutorActive) {
            return;
        }
        this._fingerIdleElapsed = 0;
    }

    private cancelIdleFingerHint(): void {
        this._fingerIdleElapsed = 0;
    }

    private notePlayerInteraction(): void {
        this._fingerInitialTutorActive = false;
        this._fingerRestoreAfterResize = false;
        this.cancelIdleFingerHint();
        if (this._fingerShouldBeVisible) {
            this.hideFinger(true);
        }
        if (this._rainDone && this.isFingerRowActive()) {
            this.queueIdleFingerHint();
        }
    }

    private updateIdleFingerHint(dt: number): void {
        if (this._fingerInitialTutorActive) {
            return;
        }
        if (!this._boardInputEnabled) {
            this._fingerIdleElapsed = 0;
            return;
        }
        if (!this._rainDone) {
            this._fingerIdleElapsed = 0;
            return;
        }
        if (this._pickAnimationInFlight) {
            this._fingerIdleElapsed = 0;
            return;
        }
        if (!this.isFingerRowActive()) {
            this._fingerIdleElapsed = 0;
            return;
        }
        if (this._fingerShouldBeVisible || this._fingerSwayActive) {
            this._fingerIdleElapsed = 0;
            return;
        }

        if (!this._targetFoodNode?.isValid) {
            this.refreshFingerTarget();
            if (!this._targetFoodNode?.isValid) {
                this._fingerIdleElapsed = 0;
                return;
            }
        }

        this._fingerIdleElapsed += dt;
        if (this._fingerIdleElapsed >= Math.max(0.5, this.fingerIdleHintDelay)) {
            this._fingerIdleElapsed = 0;
            this.showFinger();
        }
    }

    private updateFingerTargetPulse(): void {
        const desiredTarget =
            this._fingerSwayActive &&
            this._fingerShouldBeVisible &&
            this.isFingerRowActive() &&
            this._targetFoodNode?.isValid
                ? this._targetFoodNode
                : null;
        this.syncFingerPulseTarget(desiredTarget);
        const target = this._fingerPulseTarget;
        if (!target?.isValid) return;
        const press = this.getFingerTapPressAlpha();
        const targetPressScale = Math.max(0.1, this.fingerTargetPressScale);
        const scaleMul = 1 + (targetPressScale - 1) * press;
        target.setScale(
            this._fingerPulseBaseScale.x * scaleMul,
            this._fingerPulseBaseScale.y * scaleMul,
            this._fingerPulseBaseScale.z,
        );
    }

    private syncFingerPulseTarget(target: Node | null): void {
        const pulseTarget = this.resolveFingerPulseTargetNode(target);
        if (pulseTarget === this._fingerPulseTarget) return;
        this.clearFingerPulseTarget();
        if (!pulseTarget?.isValid) return;
        this._fingerPulseTarget = pulseTarget;
        this._fingerPulseBaseScale.set(pulseTarget.scale);
    }

    private clearFingerPulseTarget(): void {
        if (this._fingerPulseTarget?.isValid) {
            this._fingerPulseTarget.setScale(this._fingerPulseBaseScale);
        }
        this._fingerPulseTarget = null;
    }

    private resolveFingerPulseTargetNode(target: Node | null): Node | null {
        if (!target?.isValid) return null;
        const spawn = this.resolveSpawnRoot();
        if (!spawn?.isValid) return target;
        return this.findSpawnedCloneRoot(target, spawn) ?? target;
    }

    private resolveFingerTargetLocalPosition(target: Node, out: Vec3): boolean {
        const finger = this.fingerNode;
        if (!finger?.isValid || !target?.isValid || !finger.parent?.isValid) {
            return false;
        }
        const fingerPoint = this.resolveFingerPoint();
        const tfParent = finger.parent.getComponent(UITransform);
        if (!tfParent) {
            return false;
        }

        const world = target.worldPosition;
        if (fingerPoint?.isValid) {
            const fpWorld = fingerPoint.worldPosition;
            const offsetX = fpWorld.x - finger.worldPosition.x;
            const offsetY = fpWorld.y - finger.worldPosition.y;
            tfParent.convertToNodeSpaceAR(
                new Vec3(world.x - offsetX, world.y - offsetY, world.z),
                out,
            );
        } else {
            tfParent.convertToNodeSpaceAR(
                new Vec3(world.x + this.fingerOffsetX, world.y + this.fingerOffsetY, world.z),
                out,
            );
        }
        out.z = 0;
        return true;
    }

    private resolveSpawnRoot(): Node | null {
        const gc = this.gameContainer;
        if (!gc?.isValid) return null;
        return gc.getChildByName('SpawnedPhysicsItems') ?? gc;
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


    /** Убирает устаревшие спрайт-заглушки (`__OrderFood`), если остались в сцене. */
    private removeSpritePlaceholdersFromSlot(slot: Node): void {
        if (!slot?.isValid) return;
        for (let i = slot.children.length - 1; i >= 0; i--) {
            const ch = slot.children[i]!;
            if (ch.name === '__OrderFood') ch.destroy();
        }
    }

    private slotHasSpawnFoodChild(slot: Node | null): boolean {
        if (!slot?.isValid) return false;
        if (this._slotsWithActiveFly.has(slot.uuid)) return true;
        for (let i = 0; i < slot.children.length; i++) {
            const ch = slot.children[i]!;
            if (ch.name === '__OrderFood') continue;
            if (ch.isValid) return true;
        }
        return false;
    }

    /** Первые стартовые слоты первого подноса заполняются реальными клонами из SpawnedPhysicsItems. */
    private fillFirstTrayInitialSlotsFromSpawn(): void {
        if (this._activeRow !== 0) return;
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
            this.stripPhysics(cloneRoot);
            this.applyNodeIntoSlotFinal(cloneRoot, slot);
            this._slotsWithActiveFly.delete(slot.uuid);
        }
    }

    private stealMatchingCloneRootFromSpawnDeep(spawn: Node, orderKey: string, frame: SpriteFrame): Node | null {
        const hit = this.findFirstMatchingFoodNode(spawn, orderKey, frame);
        if (!hit?.isValid) return null;
        return this.findSpawnedCloneRoot(hit, spawn) ?? hit;
    }

    /** Клоны дождя — прямые дети SpawnedPhysicsItems (`${categoryKey}_C${i}`). */
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

    /** Повторяет перенос, пока стартовые слоты первого подноса не будут заполнены реальными нодами. */
    private scheduleFillFirstTrayInitialSlotsUntilDone(): void {
        const delay = 0.03;
        const maxAttempts = 120;
        const step = (attempt: number) => {
            this.fillFirstTrayInitialSlotsFromSpawn();
            if (attempt >= maxAttempts) return;
            if (!this.firstTrayInitialSlotsStillNeedSpawnNodes()) return;
            this.scheduleOnce(() => step(attempt + 1), delay);
        };
        step(0);
    }

    private firstTrayInitialSlotsStillNeedSpawnNodes(): boolean {
        if (this._activeRow !== 0) return false;
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

    private applyNodeIntoSlotFinal(foodNode: Node, slot: Node): void {
        if (!foodNode?.isValid || !slot?.isValid) return;
        slot.removeAllChildren();
        foodNode.removeFromParent();
        this.applyLayerRecursive(foodNode, slot.layer);
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
    }
    private placeFrameInSlot(slot: Node, frame: SpriteFrame): void {
        slot.removeAllChildren();
        const icon = new Node('__OrderFood');
        this.applyLayerRecursive(icon, slot.layer);
        slot.addChild(icon);
        icon.setSiblingIndex(slot.children.length - 1);

        const sp = icon.addComponent(Sprite);
        sp.spriteFrame = frame;
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.color = Color.WHITE;

        const slotTf = slot.getComponent(UITransform);
        const iconTf = icon.getComponent(UITransform) ?? icon.addComponent(UITransform);
        const sourceSize = frame.originalSize;
        const sourceW = Math.max(1, sourceSize?.width || frame.rect?.width || 60);
        const sourceH = Math.max(1, sourceSize?.height || frame.rect?.height || 60);
        iconTf.setContentSize(sourceW, sourceH);
        icon.setScale(1, 1, 1);
        if (slotTf) {
            const w = Math.max(24, slotTf.contentSize.width * 0.78);
            const h = Math.max(24, slotTf.contentSize.height * 0.78);
            this.fitNodeToSize(icon, w, h);
        }
        icon.setPosition(0, 0, 0);
    }

    private clearSlots(row: RowState): void {
        for (let i = 0; i < row.slots.length; i++) {
            const slot = row.slots[i];
            if (!slot?.isValid) continue;
            slot.removeAllChildren();
        }
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
                if (key && !seen.has(key) && !this.isEmblemUiDecorationKey(key)) {
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

    /** Подсказка-палец доступна для текущего активного подноса очереди. */
    private isFingerRowActive(): boolean {
        this.syncActiveRowFromQueue();
        return this._activeRow >= 0 && this._activeRow < this._rows.length;
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


    /**
     * Подложка трея (FryBG) у детей `fry` часто стоит после слотов — тогда она рисуется поверх и скрывает еду.
     * Ставим фон в начало списка детей, чтобы еда гарантированно была сверху.
     */
    private ensureTrayBackgroundBehindFoodSlots(fryOrTray: Node): void {
        if (!fryOrTray?.isValid) return;
        const names = ['FryBG', 'fryBG', 'FryBg', 'TrayBG', 'trayBG', 'TrayBg', 'BoardBG'];
        for (let i = 0; i < names.length; i++) {
            const bg = fryOrTray.getChildByName(names[i]!);
            if (bg?.isValid) {
                bg.setSiblingIndex(0);
                return;
            }
        }
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

    /**
     * Галочка / welldone / fx — не гасим при смене варианта заказа в Emblem.
     * Имена приводятся через normalizeNameTag (Well Done → welldone).
     */
    private isEmblemUiDecorationKey(key: string): boolean {
        if (!key) return false;
        return (
            key === 'check' ||
            key === 'checkmark' ||
            key === 'tick' ||
            key === 'done' ||
            key === 'ok' ||
            key === 'complete' ||
            key === 'fx' ||
            key === 'glow' ||
            key === 'star' ||
            key === 'v' ||
            key === 'welldone' ||
            key === 'success' ||
            key === 'approved' ||
            key === 'good' ||
            key === 'yes' ||
            key === 'nice' ||
            key === 'great' ||
            key === 'orderdone' ||
            key === 'traycheck' ||
            key === 'iconcheck' ||
            key === 'galochka'
        );
    }

    private findTrayOrderCompleteMarkNode(root: Node | null): Node | null {
        if (!root?.isValid) return null;
        const t = this.normalizeNameTag(root.name);
        if (
            t &&
            (t === 'welldone' ||
                t === 'check' ||
                t === 'checkmark' ||
                t === 'tick' ||
                t === 'done' ||
                t === 'complete' ||
                t === 'success' ||
                t === 'approved' ||
                t === 'orderdone' ||
                t === 'traycheck' ||
                t === 'iconcheck' ||
                t === 'galochka')
        ) {
            return root;
        }
        for (let i = 0; i < root.children.length; i++) {
            const f = this.findTrayOrderCompleteMarkNode(root.children[i]!);
            if (f) return f;
        }
        return null;
    }

    private hideTrayOrderCompleteMarks(row: RowState): void {
        if (!row.root?.isValid) return;
        const roots = [this.resolveTrayLayoutRoot(row.root), row.root, row.emblemNode].filter(Boolean) as Node[];
        const hideWalk = (n: Node) => {
            const t = this.normalizeNameTag(n.name);
            if (
                t === 'welldone' ||
                t === 'check' ||
                t === 'checkmark' ||
                t === 'tick' ||
                t === 'done' ||
                t === 'complete' ||
                t === 'success' ||
                t === 'approved' ||
                t === 'orderdone' ||
                t === 'traycheck' ||
                t === 'iconcheck' ||
                t === 'galochka'
            ) {
                if (t === 'check') {
                    Tween.stopAllByTarget(n);
                    const op = n.getComponent(UIOpacity);
                    if (op?.isValid) {
                        Tween.stopAllByTarget(op);
                        op.opacity = 255;
                    }
                    if (row.trayCheckRestLocal) {
                        n.setPosition(row.trayCheckRestLocal);
                    }
                }
                n.active = false;
            }
            for (let i = 0; i < n.children.length; i++) hideWalk(n.children[i]!);
        };
        for (const r of roots) {
            if (r?.isValid) hideWalk(r);
        }
    }

    private findTrayCheckSpriteNode(root: Node | null): Node | null {
        if (!root?.isValid) return null;
        if (this.normalizeNameTag(root.name) === 'check') {
            return root;
        }
        for (let i = 0; i < root.children.length; i++) {
            const f = this.findTrayCheckSpriteNode(root.children[i]!);
            if (f) return f;
        }
        return null;
    }

    /** Нода check вне подноса (дочерняя Canvas и т.д.) — в сцене часто одна на всё поле. */
    private resolveGlobalTrayCheckNode(): Node | null {
        if (this.trayCompleteCheckNode?.isValid) {
            return this.trayCompleteCheckNode;
        }
        const sc = director.getScene();
        return sc?.isValid ? this.findTrayCheckSpriteNode(sc) : null;
    }

    private isNodeUnderAncestor(node: Node | null, ancestor: Node | null): boolean {
        let n: Node | null = node;
        while (n) {
            if (n === ancestor) return true;
            n = n.parent;
        }
        return false;
    }

    /** Спрайт `check`: показ, подъём на trayCheckFloatOffsetY (локально), затем fade и скрытие. */
    private playTrayCheckFloatAnimation(row: RowState, mark: Node): void {
        if (!row.root?.isValid || !mark.isValid) return;
        const parent = mark.parent;
        const parentTf = parent?.getComponent(UITransform);
        if (!parentTf?.isValid) return;

        const underTray = this.isNodeUnderAncestor(mark, row.root);
        let rest: Vec3;
        if (underTray) {
            if (!row.trayCheckRestLocal) {
                row.trayCheckRestLocal = mark.position.clone();
            }
            rest = row.trayCheckRestLocal.clone();
        } else {
            const anchor = row.emblemNode ?? this.resolveTrayLayoutRoot(row.root);
            if (!anchor?.isValid) return;
            rest = new Vec3();
            parentTf.convertToNodeSpaceAR(anchor.worldPosition, rest);
        }

        Tween.stopAllByTarget(mark);
        const opExisting = mark.getComponent(UIOpacity);
        if (opExisting?.isValid) {
            Tween.stopAllByTarget(opExisting);
        }
        if (underTray) {
            this.activateBranchToRoot(mark, row.root);
        } else {
            let p: Node | null = mark.parent;
            while (p) {
                p.active = true;
                p = p.parent;
            }
        }
        const enableWalk = (n: Node) => {
            n.active = true;
            const sp = n.getComponent(Sprite);
            if (sp?.isValid) sp.enabled = true;
            for (let i = 0; i < n.children.length; i++) enableWalk(n.children[i]!);
        };
        enableWalk(mark);
        mark.active = true;
        mark.setPosition(rest);
        const opacity = mark.getComponent(UIOpacity) ?? mark.addComponent(UIOpacity);
        opacity.opacity = 255;
        const end = new Vec3(rest.x, rest.y + this.trayCheckFloatOffsetY, rest.z);
        const upDur = Math.max(0.05, this.trayCheckFloatDuration);
        const fadeDur = Math.max(0.05, this.trayCheckFadeOutDuration);
        tween(mark)
            .to(upDur, { position: end }, { easing: 'sineOut' })
            .call(() => {
                if (!mark.isValid || !opacity.isValid) return;
                tween(opacity)
                    .to(fadeDur, { opacity: 0 }, { easing: 'sineIn' })
                    .call(() => {
                        if (mark.isValid) {
                            mark.active = false;
                            mark.setPosition(rest);
                        }
                        if (opacity.isValid) {
                            opacity.opacity = 255;
                        }
                    })
                    .start();
            })
            .start();
    }

    private showTrayOrderCompleteMark(row: RowState): void {
        if (!row.root?.isValid) return;
        const roots = [this.resolveTrayLayoutRoot(row.root), row.root, row.emblemNode].filter(Boolean) as Node[];
        for (let r = 0; r < roots.length; r++) {
            const checkNode = this.findTrayCheckSpriteNode(roots[r]!);
            if (checkNode?.isValid) {
                this.playTrayCheckFloatAnimation(row, checkNode);
                return;
            }
        }
        const globalCheck = this.resolveGlobalTrayCheckNode();
        if (globalCheck?.isValid) {
            this.playTrayCheckFloatAnimation(row, globalCheck);
            return;
        }
        for (let r = 0; r < roots.length; r++) {
            const mark = this.findTrayOrderCompleteMarkNode(roots[r]!);
            if (!mark?.isValid || this.normalizeNameTag(mark.name) === 'check') continue;
            this.activateBranchToRoot(mark, row.root);
            const enableWalk = (n: Node) => {
                n.active = true;
                const sp = n.getComponent(Sprite);
                if (sp?.isValid) sp.enabled = true;
                for (let i = 0; i < n.children.length; i++) enableWalk(n.children[i]!);
            };
            enableWalk(mark);
            const s0 = mark.scale.clone();
            Tween.stopAllByTarget(mark);
            mark.setScale(s0.x * 0.35, s0.y * 0.35, s0.z);
            tween(mark)
                .to(0.32, { scale: s0 }, { easing: 'backOut' })
                .start();
            return;
        }
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
                if (this.isEmblemUiDecorationKey(this.normalizeNameTag(ch.name))) {
                    continue;
                }
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









