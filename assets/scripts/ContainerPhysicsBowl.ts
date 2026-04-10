import {
    _decorator,
    CCInteger,
    Component,
    instantiate,
    Node,
    RigidBody2D,
    UITransform,
    Vec2,
    Vec3,
    Widget,
    view,
} from 'cc';
import { property } from '../core/scripts/playableCore/property';

const { ccclass } = _decorator;

/** Доп. шаблоны еды в инспекторе: любая нода как корень клона + ключ для имён `key_C0` и матчинга заказа. */
@ccclass('ContainerPhysicsBowlExtraFood')
export class ContainerPhysicsBowlExtraFood {
    @property({
        type: Node,
        tooltip:
            'Корень шаблона (как папки cheeseburger под GameContainer). Лучше дочерняя нода GameContainer — её скрывают до спавна. Ссылка на UI вне контейнера не скрывается (чтобы не гасить эмблемы и т.п.).',
    })
    templateRoot: Node | null = null;

    @property({
        tooltip:
            'Ключ категории: латиница, как имя спрайта заказа после normalize (префикс клонов `ключ_C0`). Должен совпадать с тем, что ожидает FryOrders.',
    })
    categoryKey = '';

    @property({
        type: CCInteger,
        tooltip:
            'Сколько клонов заспавнить (portrait/landscape одно и то же; у базовых шести — массивы Copies Per Category выше)',
    })
    copyCount = 3;
}

/**
 * Категории в том же порядке, что и `copiesPerCategory[0…5]`.
 * `key` — префикс имени клона (совпадает с ключом эмблемы после normalize).
 * `folderAliases` — возможные имена дочерней ноды под Container (как в иерархии).
 */
const FOOD_CATEGORY_DEFS: { key: string; folderAliases: string[] }[] = [
    { key: 'cheeseburger', folderAliases: ['cheeseburgers', 'cheeseburger', 'Cheeseburger'] },
    { key: 'chicken', folderAliases: ['chickens', 'chicken', 'Chicken'] },
    { key: 'crab', folderAliases: ['crab', 'crabs', 'Crab'] },
    { key: 'hotdog', folderAliases: ['hotdog', 'hotdogs', 'Hotdog'] },
    { key: 'lattice', folderAliases: ['lattice', 'lattices', 'Lattice'] },
    { key: 'shrimp', folderAliases: ['shrimps', 'shrimp', 'Shrimp'] },
];

const SKIP_TEMPLATE_SCAN = new Set(
    ['SpawnedPhysicsItems', 'Rain', 'rain', 'Container'].map((s) => s.toLowerCase()),
);

const _tmpWorld = new Vec3();
const _tmpLocal = new Vec3();

type SpawnJob = {
    folder: Node;
    categoryKey: string;
    copyIndex: number;
};

/**
 * Шаблоны категорий скрыты; клоны (×0.5) сыпятся сверху от ноды `Rain` (или от верха контейнера) и падают с разбросом по скорости.
 */
@ccclass('ContainerPhysicsBowl')
export class ContainerPhysicsBowl extends Component {
    @property({ tooltip: 'Создавать копии в SpawnedPhysicsItems' })
    spawnClones = true;

    @property({
        type: Node,
        tooltip: 'Точка «дождя»; если пусто — ищется дочерняя нода Rain / rain, иначе верх Container',
        visible(this: ContainerPhysicsBowl) {
            return this.spawnClones;
        },
    })
    rainOrigin: Node | null = null;

    @property({
        type: [CCInteger],
        tooltip:
            'Копий по порядку: cheeseburger → chicken → crab → hotdog → lattice → shrimp (индексы как в FOOD_CATEGORY_DEFS)',
        visible(this: ContainerPhysicsBowl) {
            return this.spawnClones;
        },
    })
    copiesPerCategory: number[] = [5, 3, 6, 2, 4, 3];

    @property({
        type: [CCInteger],
        tooltip:
            'Копий по порядку для landscape: cheeseburger → chicken → crab → hotdog → lattice → shrimp. Пусто или без значения по индексу = fallback на Copies Per Category',
        visible(this: ContainerPhysicsBowl) {
            return this.spawnClones;
        },
    })
    copiesPerCategoryLandscape: number[] = [];

    @property({
        type: [CCInteger],
        tooltip:
            'Копий по порядку для portrait: cheeseburger → chicken → crab → hotdog → lattice → shrimp. Пусто или без значения по индексу = fallback на Copies Per Category',
        visible(this: ContainerPhysicsBowl) {
            return this.spawnClones;
        },
    })
    copiesPerCategoryPortrait: number[] = [];

    @property({
        type: [ContainerPhysicsBowlExtraFood],
        tooltip:
            'Дополнительные типы еды: укажите корень шаблона, ключ (как у базовых) и число копий. Не дублируйте ключи базовых шести категорий.',
        visible(this: ContainerPhysicsBowl) {
            return this.spawnClones;
        },
    })
    extraFoodTemplates: ContainerPhysicsBowlExtraFood[] = [];

    @property({
        tooltip: 'Если для категории нет элемента в copiesPerCategory — берётся это число',
        visible(this: ContainerPhysicsBowl) {
            return this.spawnClones;
        },
    })
    fallbackCopiesPerCategory = 3;

    @property({
        tooltip: 'Задержка перед первым спавном (с)',
        visible(this: ContainerPhysicsBowl) {
            return this.spawnClones;
        },
    })
    copyStartDelay = 0.25;

    @property({
        tooltip: 'Интервал между появлением клонов (с); 0 — все в один кадр',
        visible(this: ContainerPhysicsBowl) {
            return this.spawnClones;
        },
    })
    spawnInterval = 0.055;

    @property({
        tooltip: 'Полуширина зоны спавна по X (если у Rain нет UITransform — берётся это значение)',
        visible(this: ContainerPhysicsBowl) {
            return this.spawnClones;
        },
    })
    rainHalfWidth = 130;

    @property({
        tooltip: 'Случайный разброс по Y при появлении (локально к SpawnedPhysicsItems)',
        visible(this: ContainerPhysicsBowl) {
            return this.spawnClones;
        },
    })
    spawnVerticalJitter = 10;

    @property({
        tooltip: 'Какая доля ширины Rain реально используется для дождя. 0.7 = спавн ближе к центру',
        visible(this: ContainerPhysicsBowl) {
            return this.spawnClones;
        },
    })
    rainSpawnWidthFactor = 0.62;

    @property({
        tooltip: 'Насколько дождь тянется к центру. Больше значение = меньше спавна у краёв',
        visible(this: ContainerPhysicsBowl) {
            return this.spawnClones;
        },
    })
    rainCenterBiasPower = 2.2;

    @property({
        tooltip: 'Отступ от верха Container, если ноды Rain нет (якорь 0.5)',
        visible(this: ContainerPhysicsBowl) {
            return this.spawnClones;
        },
    })
    layoutPadding = 12;

    @property({
        tooltip: 'Макс. |Vx| стартовой скорости у RigidBody2D (разлет в стороны)',
        visible(this: ContainerPhysicsBowl) {
            return this.spawnClones;
        },
    })
    rainVelocityXMax = 120;

    @property({
        tooltip: 'Мягкий боковой drift от центра. Помогает еде расползаться по поверхности без резких бросков',
        visible(this: ContainerPhysicsBowl) {
            return this.spawnClones;
        },
    })
    rainOutwardDrift = 14;

    @property({
        tooltip: 'Небольшой случайный шум по X поверх drift. Держите низким для спокойного дождя',
        visible(this: ContainerPhysicsBowl) {
            return this.spawnClones;
        },
    })
    rainVelocityXJitter = 5;

    @property({
        tooltip: 'Доп. начальная Vy (отрицательная — вниз; к гравитации)',
        visible(this: ContainerPhysicsBowl) {
            return this.spawnClones;
        },
    })
    rainVelocityY = -35;

    @property({
        tooltip: 'Доля случайного разброса по вертикальной скорости. 0.1 = мягкий разброс, 0.35 = резкий',
        visible(this: ContainerPhysicsBowl) {
            return this.spawnClones;
        },
    })
    rainVelocityYJitterFactor = 0.12;

    @property({
        tooltip: 'Случайный поворот корня клона по Z',
        visible(this: ContainerPhysicsBowl) {
            return this.spawnClones;
        },
    })
    randomSpawnRotation = false;

    @property({
        tooltip:
            'Высота корня клона как доля видимой высоты экрана. 0.08 = 8% высоты. <= 0 включает старый scale 0.5',
        visible(this: ContainerPhysicsBowl) {
            return this.spawnClones;
        },
    })
    spawnHeightPercentOfScreen = 0.08;

    @property({
        tooltip:
            'Высота корня клона как доля видимой высоты в landscape. Например 0.08 = 8%. <= 0 использует общий Spawn Height Percent Of Screen',
        visible(this: ContainerPhysicsBowl) {
            return this.spawnClones;
        },
    })
    spawnHeightPercentLandscape = 0;

    @property({
        tooltip:
            'Высота корня клона как доля видимой высоты в portrait. Например 0.1 = 10%. <= 0 использует общий Spawn Height Percent Of Screen',
        visible(this: ContainerPhysicsBowl) {
            return this.spawnClones;
        },
    })
    spawnHeightPercentPortrait = 0;

    private _spawnRoot: Node | null = null;
    private _done = false;
    /** После последнего клона дождя (или при мгновенном спавне) — можно кликать по полю. */
    private _rainSpawnFinished = false;
    private _resizeQueued = false;
    private _pendingJobs: SpawnJob[] = [];
    private _activeSpawnIsPortrait = true;

    private getBaseCategorySlotCount(): number {
        return FOOD_CATEGORY_DEFS.length;
    }

    private getExtraFoodTemplateList(): ContainerPhysicsBowlExtraFood[] {
        return Array.isArray(this.extraFoodTemplates) ? this.extraFoodTemplates : [];
    }

    private getTotalCategorySlotCount(): number {
        return this.getBaseCategorySlotCount() + this.getExtraFoodTemplateList().length;
    }

    private normalizeExtraCategoryKey(raw: string): string {
        return String(raw ?? '')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '');
    }

    /** Ключ для слота: базовые фиксированы; extra — из инспектора (пустой слот пропускается). */
    private getCategoryKeyAt(slotIndex: number): string {
        const baseN = this.getBaseCategorySlotCount();
        if (slotIndex < 0) return '';
        if (slotIndex < baseN) {
            return FOOD_CATEGORY_DEFS[slotIndex]!.key;
        }
        const ex = this.getExtraFoodTemplateList()[slotIndex - baseN];
        return this.normalizeExtraCategoryKey(ex?.categoryKey ?? '');
    }

    private warnDuplicateCategoryKeys(): void {
        const seen = new Set<string>();
        for (let i = 0; i < this.getTotalCategorySlotCount(); i++) {
            const k = this.getCategoryKeyAt(i);
            if (!k) continue;
            if (seen.has(k)) {
                console.warn(`ContainerPhysicsBowl: повторяется ключ категории «${k}» — спавн и заказы могут вести себя непредсказуемо`);
            }
            seen.add(k);
        }
    }

    private getSpawnCountForSlot(slotIndex: number, isPortrait: boolean): number {
        if (slotIndex < this.getBaseCategorySlotCount()) {
            return this.getCopyCountForCategory(slotIndex, isPortrait);
        }
        const ex = this.getExtraFoodTemplateList()[slotIndex - this.getBaseCategorySlotCount()];
        const n = Number(ex?.copyCount);
        return Math.max(0, Math.floor(Number.isFinite(n) ? n : 0));
    }

    /** `true`, если клоны не спавнятся или весь дождь уже высыпался. */
    public isRainSpawnFinished(): boolean {
        if (!this.spawnClones) {
            return true;
        }
        return this._rainSpawnFinished;
    }

    /** Снять отложенные спавны дождя (конец уровня / стоп конвейера). */
    public stopSpawning(): void {
        this.unscheduleAllCallbacks();
        this._done = true;
        this._pendingJobs = [];
    }

    /** Синхронизировать Widget/physics после layout-перестановок без полного respawn. */
    public refreshPhysicsBoundsAfterLayout(): void {
        const run = (): void => {
            if (!this.isValid || !this.node?.isValid) return;
            this.updateWidgetsImmediate();
            this.syncRigidBodiesToPhysics(this.node);
        };
        this.scheduleOnce(run, 0);
        this.scheduleOnce(run, 0.04);
    }

    protected override onLoad(): void {
        if (this.spawnClones) {
            this.warnDuplicateCategoryKeys();
            this.hideCategoryTemplates();
        }
        view.on('canvas-resize', this.onCanvasResize, this);
    }

    protected override onDestroy(): void {
        view.off('canvas-resize', this.onCanvasResize, this);
    }

    protected override onEnable(): void {
        if (!this.spawnClones) {
            const root = this.node.getChildByName('SpawnedPhysicsItems');
            if (root) root.active = false;
            return;
        }
        this.hideCategoryTemplates();
        this.scheduleOnce(() => this.runCopy(), Math.max(0, this.copyStartDelay));
    }

    /** Шаблон внутри поддерева контейнера с физикой (не сам контейнер). */
    private isTemplateUnderBowl(folder: Node): boolean {
        if (!folder?.isValid || !this.node?.isValid || folder === this.node) return false;
        for (let p = folder.parent; p; p = p.parent) {
            if (p === this.node) return true;
        }
        return false;
    }

    /** Оригиналы-шаблоны не должны мелькать на сцене до клонов и во время copyStartDelay. */
    private hideCategoryTemplates(): void {
        const seen = new Set<Node>();
        const baseN = this.getBaseCategorySlotCount();
        for (let i = 0; i < this.getTotalCategorySlotCount(); i++) {
            const folder = this.resolveCategoryFolder(i);
            if (folder && !seen.has(folder)) {
                seen.add(folder);
                if (this.isTemplateUnderBowl(folder)) {
                    folder.active = false;
                } else if (i >= baseN) {
                    const k = this.getCategoryKeyAt(i);
                    console.warn(
                        `ContainerPhysicsBowl: доп. шаблон «${k || '?'}» не под GameContainer — не отключаю ноду (скрытие гасит чужой UI, напр. Emblem). Продублируйте шаблон под контейнер или сделайте его неактивным вручную.`,
                    );
                }
            }
        }
    }

    private normalizeFolderName(raw: string): string {
        return raw.toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    /** Папка-шаблон: базовые — дочерние ноды Container по алиасам; extra — ссылка из инспектора. */
    private resolveCategoryFolder(categoryIndex: number): Node | null {
        const baseN = this.getBaseCategorySlotCount();
        if (categoryIndex >= baseN) {
            const ex = this.getExtraFoodTemplateList()[categoryIndex - baseN];
            const root = ex?.templateRoot;
            return root?.isValid ? root : null;
        }
        if (categoryIndex < 0) return null;
        const def = FOOD_CATEGORY_DEFS[categoryIndex]!;
        for (const alias of def.folderAliases) {
            const n = this.node.getChildByName(alias);
            if (n?.isValid) return n;
        }
        const targets = new Set(def.folderAliases.map((a) => this.normalizeFolderName(a)));
        for (let i = 0; i < this.node.children.length; i++) {
            const ch = this.node.children[i]!;
            if (!ch?.isValid) continue;
            if (SKIP_TEMPLATE_SCAN.has(ch.name.toLowerCase())) continue;
            if (targets.has(this.normalizeFolderName(ch.name))) return ch;
        }
        return null;
    }

    private runCopy(): void {
        if (this._done) return;
        this._done = true;

        const ctf = this.node.getComponent(UITransform);
        if (!ctf) {
            console.error('ContainerPhysicsBowl: нет UITransform на Container');
            this._rainSpawnFinished = true;
            return;
        }

        this.ensureSpawnRoot(ctf).destroyAllChildren();
        const jobs = this.buildDefaultJobs();

        if (jobs.length === 0) {
            console.error('ContainerPhysicsBowl: нет нод категорий под Container');
            this._rainSpawnFinished = true;
            return;
        }

        const interval = Number.isFinite(this.spawnInterval) ? Math.max(0, this.spawnInterval) : 0.055;
        this.queueSpawnJobs(jobs, ctf, interval);
    }

    private onCanvasResize(): void {
        if (this._resizeQueued) return;

        this._resizeQueued = true;
        this.scheduleOnce(() => {
            this._resizeQueued = false;
            this.updateWidgetsImmediate();
            this.syncRigidBodiesToPhysics(this.node);
            this.respawnRemainingForResize();
        }, 0);
    }

    private updateWidgetsImmediate(): void {
        const widgets = this.node.getComponentsInChildren(Widget);
        for (let i = 0; i < widgets.length; i++) {
            const widget = widgets[i];
            if (!widget?.isValid || !widget.enabled) continue;
            widget.updateAlignment();
        }
    }

    private respawnRemainingForResize(): void {
        if (!this.spawnClones) return;

        const ctf = this.node.getComponent(UITransform);
        if (!ctf) return;

        const counts = this.collectAdjustedRemainingCountsForResize(
            this._activeSpawnIsPortrait,
            this.isPortraitOrientation(),
        );
        let total = 0;
        counts.forEach((v) => {
            total += v;
        });
        if (total <= 0) {
            this._pendingJobs = [];
            this._rainSpawnFinished = true;
            this._activeSpawnIsPortrait = this.isPortraitOrientation();
            return;
        }

        this.unscheduleAllCallbacks();
        this._pendingJobs = [];

        const spawnRoot = this.ensureSpawnRoot(ctf);
        spawnRoot.destroyAllChildren();

        const jobs = this.buildJobsFromCounts(counts);
        if (jobs.length === 0) {
            this._rainSpawnFinished = true;
            return;
        }

        const respawnInterval = this.clamp(
            Number.isFinite(this.spawnInterval) ? this.spawnInterval : 0.02,
            0.012,
            0.028,
        );
        this.queueSpawnJobs(jobs, ctf, respawnInterval);
    }

    private ensureSpawnRoot(ctf: UITransform): Node {
        this._spawnRoot = this.node.getChildByName('SpawnedPhysicsItems') ?? this._spawnRoot ?? new Node('SpawnedPhysicsItems');
        if (!this._spawnRoot.parent) {
            this.node.addChild(this._spawnRoot);
        }
        this._spawnRoot.active = true;
        this._spawnRoot.layer = this.node.layer;
        const spawnTf = this._spawnRoot.getComponent(UITransform) ?? this._spawnRoot.addComponent(UITransform);
        spawnTf.setContentSize(ctf.contentSize.width, ctf.contentSize.height);
        spawnTf.setAnchorPoint(0.5, 0.5);
        this._spawnRoot.setSiblingIndex(Math.max(0, this.node.children.length - 1));
        return this._spawnRoot;
    }

    private buildDefaultJobs(): SpawnJob[] {
        const counts = new Map<string, number>();
        const portrait = this.isPortraitOrientation();
        for (let ci = 0; ci < this.getTotalCategorySlotCount(); ci++) {
            const k = this.getCategoryKeyAt(ci);
            if (!k) continue;
            counts.set(k, this.getSpawnCountForSlot(ci, portrait));
        }
        return this.buildJobsFromCounts(counts);
    }

    private buildJobsFromCounts(counts: Map<string, number>): SpawnJob[] {
        const jobs: SpawnJob[] = [];
        for (let ci = 0; ci < this.getTotalCategorySlotCount(); ci++) {
            const defKey = this.getCategoryKeyAt(ci);
            if (!defKey) continue;
            const count = Math.max(0, Math.floor(counts.get(defKey) ?? 0));
            if (count <= 0) continue;

            const folder = this.resolveCategoryFolder(ci);
            if (!folder?.isValid) {
                if (ci < this.getBaseCategorySlotCount()) {
                    const def = FOOD_CATEGORY_DEFS[ci]!;
                    console.warn(
                        `ContainerPhysicsBowl: нет дочерней ноды для «${def.key}». Добавьте под GameContainer одно из имён: ${def.folderAliases.join(', ')}`,
                    );
                } else {
                    console.warn(
                        `ContainerPhysicsBowl: нет шаблона для «${defKey}» — укажите Template Root в Extra Food Templates`,
                    );
                }
                continue;
            }

            for (let i = 0; i < count; i++) {
                jobs.push({ folder, categoryKey: defKey, copyIndex: i });
            }
        }
        this.shuffleInPlace(jobs);
        return jobs;
    }

    private collectRemainingCountsFromSpawnState(): Map<string, number> {
        const counts = new Map<string, number>();
        for (let i = 0; i < this.getTotalCategorySlotCount(); i++) {
            const k = this.getCategoryKeyAt(i);
            if (!k) continue;
            counts.set(k, 0);
        }

        const spawnRoot = this._spawnRoot?.isValid
            ? this._spawnRoot
            : this.node.getChildByName('SpawnedPhysicsItems');
        if (spawnRoot?.isValid) {
            for (let i = 0; i < spawnRoot.children.length; i++) {
                const child = spawnRoot.children[i]!;
                const key = this.getCloneCategoryKey(child.name);
                if (!key) continue;
                counts.set(key, (counts.get(key) ?? 0) + 1);
            }
        }

        for (let i = 0; i < this._pendingJobs.length; i++) {
            const job = this._pendingJobs[i]!;
            counts.set(job.categoryKey, (counts.get(job.categoryKey) ?? 0) + 1);
        }

        return counts;
    }

    private collectAdjustedRemainingCountsForResize(oldPortrait: boolean, newPortrait: boolean): Map<string, number> {
        const remaining = this.collectRemainingCountsFromSpawnState();
        const adjusted = new Map<string, number>();

        for (let i = 0; i < this.getTotalCategorySlotCount(); i++) {
            const key = this.getCategoryKeyAt(i);
            if (!key) continue;
            const oldTotal = this.getSpawnCountForSlot(i, oldPortrait);
            const newTotal = this.getSpawnCountForSlot(i, newPortrait);
            const oldRemaining = Math.max(0, Math.floor(remaining.get(key) ?? 0));
            const consumed = Math.max(0, oldTotal - oldRemaining);
            adjusted.set(key, Math.max(0, newTotal - consumed));
        }

        return adjusted;
    }

    private getCloneCategoryKey(rawName: string): string {
        const lower = String(rawName ?? '').toLowerCase();
        const idx = lower.indexOf('_c');
        const key = idx > 0 ? lower.slice(0, idx) : lower;
        for (let i = 0; i < this.getTotalCategorySlotCount(); i++) {
            const k = this.getCategoryKeyAt(i);
            if (k && k === key) return key;
        }
        return '';
    }

    private queueSpawnJobs(jobs: SpawnJob[], ctf: UITransform, interval: number): void {
        if (!this.isValid) return;

        this._rainSpawnFinished = false;
        this._pendingJobs = jobs.slice();
        this._activeSpawnIsPortrait = this.isPortraitOrientation();

        if (interval <= 0) {
            let spawned = 0;
            for (let i = 0; i < jobs.length; i++) {
                const job = jobs[i]!;
                this.forgetPendingJob(job);
                if (this.spawnOneAtRain(job, ctf)) spawned++;
            }
            this._pendingJobs = [];
            this._rainSpawnFinished = true;
            console.info('[ContainerPhysicsBowl] скопировано корней:', spawned);
            return;
        }

        let spawned = 0;
        const n = jobs.length;
        for (let i = 0; i < n; i++) {
            const job = jobs[i]!;
            const delay = i * interval;
            const isLast = i === n - 1;
            this.scheduleOnce(() => {
                const finishRainSpawn = () => {
                    this._pendingJobs = [];
                    this._rainSpawnFinished = true;
                    console.info('[ContainerPhysicsBowl] скопировано корней:', spawned);
                };
                if (!this.isValid) {
                    if (isLast) finishRainSpawn();
                    return;
                }
                if (!this._spawnRoot?.isValid) {
                    if (isLast) finishRainSpawn();
                    return;
                }
                this.forgetPendingJob(job);
                if (this.spawnOneAtRain(job, ctf)) spawned++;
                if (isLast) {
                    finishRainSpawn();
                }
            }, delay);
        }
    }

    private forgetPendingJob(target: SpawnJob): void {
        for (let i = 0; i < this._pendingJobs.length; i++) {
            const job = this._pendingJobs[i]!;
            if (job.categoryKey === target.categoryKey && job.copyIndex === target.copyIndex) {
                this._pendingJobs.splice(i, 1);
                return;
            }
        }
    }

    private syncRigidBodiesToPhysics(root: Node): void {
        const bodies = root.getComponentsInChildren(RigidBody2D);
        for (let i = 0; i < bodies.length; i++) {
            this.syncRigidBodyToPhysics(bodies[i]!);
        }
    }

    private syncRigidBodyToPhysics(rb: RigidBody2D): void {
        const api = rb as RigidBody2D & {
            syncPositionToPhysics?: () => void;
            syncRotationToPhysics?: () => void;
            wakeUp?: () => void;
        };
        api.syncPositionToPhysics?.();
        api.syncRotationToPhysics?.();
        api.wakeUp?.();
    }

    private clamp(v: number, min: number, max: number): number {
        if (v < min) return min;
        if (v > max) return max;
        return v;
    }

    private isPortraitOrientation(): boolean {
        const visibleSize = view.getVisibleSize();
        return visibleSize.height >= visibleSize.width;
    }

    private getConfiguredCountFromArray(arr: number[], categoryIndex: number): number | null {
        if (!Array.isArray(arr) || categoryIndex < 0 || categoryIndex >= arr.length) {
            return null;
        }
        const v = arr[categoryIndex];
        if (typeof v !== 'number' || !Number.isFinite(v)) {
            return null;
        }
        return Math.max(0, Math.floor(v));
    }

    private getActiveSpawnHeightPercent(): number {
        const visibleSize = view.getVisibleSize();
        const isPortrait = visibleSize.height >= visibleSize.width;
        const specific = isPortrait
            ? Number(this.spawnHeightPercentPortrait) || 0
            : Number(this.spawnHeightPercentLandscape) || 0;
        if (specific > 0) {
            return specific;
        }
        return Number(this.spawnHeightPercentOfScreen) || 0;
    }

    /** Базовая точка «дождя» в локальных координатах SpawnedPhysicsItems. */
    private getRainBaseLocal(ctf: UITransform, out: Vec3): void {
        const rain =
            this.rainOrigin?.isValid ? this.rainOrigin : this.node.getChildByName('Rain') ?? this.node.getChildByName('rain');
        const spawnTf = this._spawnRoot!.getComponent(UITransform);
        if (!spawnTf) {
            out.set(0, 0, 0);
            return;
        }

        if (rain?.isValid) {
            _tmpWorld.set(rain.worldPosition);
        } else {
            const pad = Math.max(0, this.layoutPadding);
            _tmpLocal.set(0, ctf.contentSize.height * 0.5 - pad, 0);
            ctf.convertToWorldSpaceAR(_tmpLocal, _tmpWorld);
        }

        spawnTf.convertToNodeSpaceAR(_tmpWorld, out);
    }

    private getRainHalfWidthLocal(): number {
        const rain =
            this.rainOrigin?.isValid ? this.rainOrigin : this.node.getChildByName('Rain') ?? this.node.getChildByName('rain');
        const rainTf = rain?.getComponent(UITransform);
        if (rainTf && rainTf.contentSize.width > 0) {
            return rainTf.contentSize.width * 0.5;
        }
        return Math.max(0, this.rainHalfWidth);
    }

    private sampleSignedBiasedUnit(power: number): number {
        const p = Math.max(1, power || 1);
        const raw = Math.random() * 2 - 1;
        const sign = raw < 0 ? -1 : 1;
        return sign * Math.pow(Math.abs(raw), p);
    }

    private getRainSpawnOffsetX(halfW: number): number {
        const widthFactor = this.clamp(Number(this.rainSpawnWidthFactor) || 0, 0, 1);
        const effectiveHalfW = halfW * widthFactor;
        if (effectiveHalfW <= 0) return 0;
        return this.sampleSignedBiasedUnit(this.rainCenterBiasPower) * effectiveHalfW;
    }

    private getRainInitialVelocityX(spawnOffsetX: number, halfW: number): number {
        const maxVx = Math.max(0, Number(this.rainVelocityXMax) || 0);
        if (maxVx <= 0) return 0;

        const normalizedOffset = halfW > 1e-4 ? this.clamp(spawnOffsetX / halfW, -1, 1) : 0;
        const outward = normalizedOffset * (Number(this.rainOutwardDrift) || 0);
        const jitter = this.sampleSignedBiasedUnit(1.8) * Math.max(0, Number(this.rainVelocityXJitter) || 0);
        return this.clamp(outward + jitter, -maxVx, maxVx);
    }

    private getRainInitialVelocityY(): number {
        const baseVy = Number(this.rainVelocityY) || 0;
        const jitterFactor = Math.max(0, Number(this.rainVelocityYJitterFactor) || 0);
        const jitter = (Math.random() - 0.5) * Math.abs(baseVy) * jitterFactor * 2;
        return baseVy + jitter;
    }

    private applySpawnScale(clone: Node): void {
        const percent = this.getActiveSpawnHeightPercent();
        const baseScaleX = clone.scale.x;
        const baseScaleY = clone.scale.y;
        const baseScaleZ = clone.scale.z;

        if (percent <= 0) {
            clone.setScale(baseScaleX * 0.5, baseScaleY * 0.5, baseScaleZ);
            return;
        }

        const tf = clone.getComponent(UITransform);
        const baseHeight = Math.max(0, tf?.contentSize.height ?? 0);
        const currentHeight = baseHeight * Math.max(1e-4, Math.abs(baseScaleY));
        if (!Number.isFinite(currentHeight) || currentHeight <= 0) {
            clone.setScale(baseScaleX * 0.5, baseScaleY * 0.5, baseScaleZ);
            return;
        }

        const visibleSize = view.getVisibleSize();
        const targetHeight = Math.max(1, visibleSize.height * percent);
        const mul = targetHeight / currentHeight;
        clone.setScale(baseScaleX * mul, baseScaleY * mul, baseScaleZ);
    }

    private spawnOneAtRain(job: { folder: Node; categoryKey: string; copyIndex: number }, ctf: UITransform): boolean {
        const clone = this.cloneFolder(job.folder);
        if (!clone) {
            console.warn('ContainerPhysicsBowl: не удалось скопировать', job.categoryKey, job.copyIndex);
            return false;
        }
        clone.name = `${job.categoryKey}_C${job.copyIndex}`;
        clone.layer = this.node.layer;
        this._spawnRoot!.addChild(clone);
        this.applySpawnScale(clone);

        this.getRainBaseLocal(ctf, _tmpLocal);
        const halfW = this.getRainHalfWidthLocal();
        const jx = this.getRainSpawnOffsetX(halfW);
        const jy = (Math.random() - 0.5) * this.spawnVerticalJitter;
        clone.setPosition(_tmpLocal.x + jx, _tmpLocal.y + jy, _tmpLocal.z);

        if (this.randomSpawnRotation) {
            clone.setRotationFromEuler(0, 0, (Math.random() - 0.5) * 360);
        }

        const vx = this.getRainInitialVelocityX(jx, halfW);
        const vy = this.getRainInitialVelocityY();
        this.applyRainVelocity(clone, vx, vy);

        return true;
    }

    private applyRainVelocity(root: Node, vx: number, vy: number): void {
        const v = new Vec2(vx, vy);
        const visit = (n: Node) => {
            const rb = n.getComponent(RigidBody2D);
            if (rb) rb.linearVelocity = v;
            for (const ch of n.children) visit(ch);
        };
        visit(root);
    }

    private getCopyCountForCategory(categoryIndex: number, isPortrait = this.isPortraitOrientation()): number {
        const specific = this.getConfiguredCountFromArray(
            isPortrait ? this.copiesPerCategoryPortrait : this.copiesPerCategoryLandscape,
            categoryIndex,
        );
        if (specific !== null) {
            return specific;
        }

        const base = this.getConfiguredCountFromArray(this.copiesPerCategory, categoryIndex);
        if (base !== null) {
            return base;
        }

        return Math.max(0, Math.floor(this.fallbackCopiesPerCategory));
    }

    private shuffleInPlace<T>(arr: T[]): void {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const a = arr[i]!;
            const b = arr[j]!;
            arr[i] = b;
            arr[j] = a;
        }
    }

    private cloneFolder(folder: Node): Node | null {
        const wasActive = folder.active;
        try {
            if (!wasActive) folder.active = true;
            const c = instantiate(folder) as Node;
            if (!wasActive) folder.active = false;
            if (!c?.isValid) return null;
            c.active = true;
            return c;
        } catch {
            if (!wasActive) folder.active = false;
            return null;
        }
    }
}


