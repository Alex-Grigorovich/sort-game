import {
    _decorator,
    Camera,
    Color,
    Component,
    EventMouse,
    EventTouch,
    Input,
    Node,
    PhysicsSystem2D,
    RichText,
    Sprite,
    SpriteFrame,
    UITransform,
    v2,
    Vec2,
    Vec3,
    input,
} from 'cc';
import { property } from '../core/scripts/playableCore/property';
import { ContainerPhysicsBowl } from './ContainerPhysicsBowl';
import { FryingOrdersQueue } from './FryingOrdersQueue';

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

    @property({ tooltip: 'Template for progress text' })
    progressTemplate = '<color=#fff>{n}/3</color>';

    @property({ tooltip: 'Finger x offset in world space' })
    fingerOffsetX = 0;

    @property({ tooltip: 'Finger y offset in world space' })
    fingerOffsetY = 40;

    @property({ tooltip: 'Горизонтальный шаг между подносами в очереди (px). Первый ряд остаётся на месте, остальные выстраиваются правее.' })
    queueSlotSpacingX = 100;

    @property({ tooltip: 'На сколько px влево уезжает завершённый поднос' })
    queueCompletedExitLeft = 320;

    @property({ tooltip: 'Длительность сдвига очереди (сек)' })
    queueLayoutTweenDuration = 0.28;

    @property({ tooltip: 'Пауза перед уходом подноса после 3/3 (сек)' })
    queueCompletePauseSec = 1;

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
    private _boardInputEnabled = true;

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
    }

    protected override start(): void {
        if (this.fryRows.length === 0 && this.node?.isValid) {
            this.fryRows = [this.node];
        }
        console.log('[FryOrders] start fryRows=' + this.fryRows.length + ' rows=' + this._rows.length);
        this.refreshRowStateFromScene();
        this.hideAllEmblemsInAllRows();
        console.log('[FryOrders] rows after refresh=' + this._rows.length + ' emblemNode=' + !!this._rows[0]?.emblemNode);

        if (!this.fryingQueue?.isValid) {
            this.fryingQueue = this.node.getComponent(FryingOrdersQueue) ?? this.node.parent?.getComponent(FryingOrdersQueue) ?? null;
        }
        if (this.fryingQueue?.isValid && this._rows.length > 0) {
            this.fryingQueue.bindRows(this._rows.map((r) => r.root));
            this._activeRow = this.fryingQueue.getActiveRowIndex();
        }
        this.prepareActiveRow();
        this.waitForRainAndShowFinger();
    }

    private hideAllEmblemsInAllRows(): void {
        for (let i = 0; i < this._rows.length; i++) {
            this.hideAllEmblemVariants(this._rows[i]!.emblemNode);
        }
    }

    protected override update(dt: number): void {
        this.updateFingerFollow();
        this.updateFingerSway(dt);
    }

    private updateFingerSway(dt: number): void {
        if (!this._fingerSwayActive || !this.isFingerRowActive()) return;
        const finger = this.fingerNode;
        if (!finger?.isValid) return;

        this._fingerSwayTime += dt;
        const offset = Math.sin(this._fingerSwayTime * 5.2) * 4;
        const pos = finger.position;
        finger.setPosition(pos.x + offset, pos.y, pos.z);
    }

    protected override onDestroy(): void {
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

    private prepareActiveRow(): void {
        const row = this.currentRow();
        if (!row) { console.warn('[FryOrders] prepareActiveRow: no current row, _activeRow=' + this._activeRow + ' total=' + this._rows.length); return; }
        this.refreshSingleRowRefs(row);
        console.log('[FryOrders] prepareActiveRow: emblemNode=' + (row.emblemNode?.name ?? 'null') + ' children=' + (row.emblemNode?.children?.length ?? 0));
        this.ensureEmblemChildrenActive(row.emblemNode);
        const order = this.pickOrderFromEmblemNode(row.emblemNode);
        if (!order) { console.warn('[FryOrders] prepareActiveRow: pickOrder returned null'); return; }
        row.orderKey = order.key;
        row.frame = order.frame;
        console.log('[FryOrders] prepareActiveRow: orderKey=' + row.orderKey);

        this.applyRowEmblem(row, row.orderKey, row.frame);

        this.clearSlots(row);
        const isFirstTray = this._rows.length > 0 && row.root === this._rows[0]!.root;
        const baseFilled = isFirstTray ? Math.max(0, Math.min(3, this.firstRowInitialFilled)) : 0;
        row.filled = baseFilled;
        for (let i = 0; i < baseFilled; i++) {
            const slot = row.slots[i];
            if (!slot?.isValid) {
                console.warn(`[FryOrders] Слот GameContainerFood${i + 1} не найден под "${row.root.name}" — проверьте иерархию (слоты как дочерние "fry").`);
                continue;
            }
            this.placeFrameInSlot(slot, row.frame);
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
        this.handlePick(e.getUILocation(), e.getLocation());
    }

    private onMouseUp(e: EventMouse): void {
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
        if (!this.isOrderHitMatch(row.orderKey, row.frame, hit, hitFrame, true)) return;

        const cloneRoot = this.findSpawnedCloneRoot(hit, spawn) ?? hit;
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

        const pickedNode = this._targetFoodNode;
        if (pickedNode?.isValid) {
            this.moveNodeIntoSlot(pickedNode, slot);
        } else {
            this.placeFrameInSlot(slot, row.frame);
        }

        this._targetFoodNode = null;
        row.filled++;
        this.updateProgress(row);

        if (row.filled >= 3) {
            this.handleRowCompleted();
            return;
        }

        this.refreshFingerTarget();
        this.showFinger();
    }

    private moveNodeIntoSlot(foodNode: Node, slot: Node): void {
        this.stripPhysics(foodNode);
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
    }

    private fitNodeToSize(node: Node, targetW: number, targetH: number): void {
        const tf = node.getComponent(UITransform);
        if (!tf) return;
        const curW = tf.contentSize.width || 1;
        const curH = tf.contentSize.height || 1;
        const scale = Math.min(targetW / curW, targetH / curH);
        node.setScale(scale, scale, 1);
    }

    private stripPhysics(node: Node): void {
        const walk = (n: Node) => {
            const comps = n.getComponents(Component);
            for (let i = comps.length - 1; i >= 0; i--) {
                const c = comps[i]!;
                const name = (c.constructor as { name?: string }).name ?? '';
                if (name.indexOf('Collider') >= 0 || name.indexOf('RigidBody') >= 0) {
                    c.enabled = false;
                    c.destroy();
                }
            }
            for (let i = 0; i < n.children.length; i++) walk(n.children[i]!);
        };
        walk(node);
    }

    private handleRowCompleted(): void {
        this.hideFinger();
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
            this.refreshFingerTarget();
            this.showFinger();
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
        this.refreshFingerTarget();
        this.showFinger();
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

    private showFinger(): void {
        if (!this.fingerNode?.isValid) return;
        const hasTarget = !!this._targetFoodNode?.isValid;
        this.fingerNode.active = hasTarget;
        if (hasTarget) {
            this.startFingerSway();
        } else {
            this.stopFingerSway();
        }
    }

    private hideFinger(): void {
        if (!this.fingerNode?.isValid) return;
        this.stopFingerSway();
        this.fingerNode.active = false;
    }

    private startFingerSway(): void {
        if (!this.fingerNode?.isValid) return;
        this._fingerSwayTime = 0;
        this._fingerSwayActive = true;
    }

    private stopFingerSway(): void {
        this._fingerSwayActive = false;
        this._fingerSwayTime = 0;
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

    private placeFrameInSlot(slot: Node, frame: SpriteFrame): void {
        slot.removeAllChildren();
        const icon = new Node('__OrderFood');
        icon.layer = slot.layer;
        slot.addChild(icon);
        icon.setSiblingIndex(slot.children.length - 1);

        const sp = icon.addComponent(Sprite);
        sp.spriteFrame = frame;
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.color = Color.WHITE;

        const slotTf = slot.getComponent(UITransform);
        const iconTf = icon.getComponent(UITransform) ?? icon.addComponent(UITransform);
        if (slotTf) {
            const w = Math.max(24, slotTf.contentSize.width * 0.78);
            const h = Math.max(24, slotTf.contentSize.height * 0.78);
            iconTf.setContentSize(w, h);
        } else {
            iconTf.setContentSize(60, 60);
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

    /** Подсказка-палец только для первого подноса в очереди (индекс 0). */
    private isFingerRowActive(): boolean {
        this.syncActiveRowFromQueue();
        return this._activeRow === 0;
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
