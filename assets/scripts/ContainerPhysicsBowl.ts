import {
    _decorator,
    CCInteger,
    Collider2D,
    Component,
    ERigidBody2DType,
    instantiate,
    Node,
    PhysicsSystem2D,
    RigidBody2D,
    UITransform,
    Vec2,
    Vec3,
    view,
    Widget,
} from 'cc';
import { property } from '../core/scripts/playableCore/property';

const { ccclass } = _decorator;

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

/**
 * Шаблоны категорий скрыты; клоны (×0.5) появляются у точки `Rain` (или у верха контейнера).
 * По умолчанию только по центру по X: без полосы по ширине Rain и без горизонтального импульса.
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
        tooltip:
            'Полуширина случайного смещения по X при появлении (локально). 0 — строго по центру точки Rain. Ширина ноды Rain не используется для разброса.',
        visible(this: ContainerPhysicsBowl) {
            return this.spawnClones;
        },
    })
    rainHalfWidth = 0;

    @property({
        tooltip: 'Случайный разброс по Y при появлении (локально к SpawnedPhysicsItems); 0 — одна «колонна» по центру',
        visible(this: ContainerPhysicsBowl) {
            return this.spawnClones;
        },
    })
    spawnVerticalJitter = 0;

    @property({
        tooltip: 'Отступ от верха Container, если ноды Rain нет (якорь 0.5)',
        visible(this: ContainerPhysicsBowl) {
            return this.spawnClones;
        },
    })
    layoutPadding = 12;

    @property({
        tooltip: 'Макс. |Vx| стартовой скорости у RigidBody2D (разлет в стороны); 0 — падение без горизонтального разлёта',
        visible(this: ContainerPhysicsBowl) {
            return this.spawnClones;
        },
    })
    rainVelocityXMax = 0;

    @property({
        tooltip: 'Доп. начальная Vy (отрицательная — вниз; к гравитации)',
        visible(this: ContainerPhysicsBowl) {
            return this.spawnClones;
        },
    })
    rainVelocityY = -35;

    @property({
        tooltip: 'Случайный поворот корня клона по Z',
        visible(this: ContainerPhysicsBowl) {
            return this.spawnClones;
        },
    })
    randomSpawnRotation = false;

    private _spawnRoot: Node | null = null;
    private _done = false;
    /** После последнего клона дождя (или при мгновенном спавне) — можно кликать по полю. */
    private _rainSpawnFinished = false;
    /** Сбрасывает отложенные apply после повторного запроса sync. */
    private _boundsRefreshSeq = 0;

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
    }

    protected onLoad(): void {
        this.applyPhysicsSolverTuning();
        view.on('canvas-resize', this._onCanvasResizePhysics, this);
        this.schedulePhysicsBoundsSync();
        if (this.spawnClones) {
            this.hideCategoryTemplates();
        }
    }

    protected onDestroy(): void {
        view.off('canvas-resize', this._onCanvasResizePhysics, this);
    }

    /**
     * Вызвать после смены ориентации / GameField layout / design resolution (например из OrientationSwitcher).
     * Один вызов `canvas-resize` часто срабатывает до `Widget.updateAlignment`, поэтому sync откладывается.
     */
    public refreshPhysicsBoundsAfterLayout(): void {
        this.schedulePhysicsBoundsSync();
    }

    /** Узкие ширины: Widget меняет пол/стены — без apply() фикстуры Box2D отстают от UITransform. */
    private _onCanvasResizePhysics = (): void => {
        this.schedulePhysicsBoundsSync();
    };

    private schedulePhysicsBoundsSync(): void {
        if (!this.node?.isValid) return;
        const seq = ++this._boundsRefreshSeq;
        const run = (): void => {
            if (!this.isValid || seq !== this._boundsRefreshSeq) return;
            this.forceWidgetsUpdateUnder(this.node);
            this.applyCollidersUnder(this.node);
            this.syncRigidBodiesUnder(this.node);
        };
        this.scheduleOnce(run, 0);
        this.scheduleOnce(run, 0.04);
        this.scheduleOnce(run, 0.12);
    }

    private forceWidgetsUpdateUnder(root: Node): void {
        const visit = (n: Node): void => {
            const widgets = n.getComponents(Widget);
            for (let i = 0; i < widgets.length; i++) {
                const w = widgets[i];
                if (w?.enabled && w.isValid) w.updateAlignment();
            }
            for (let j = 0; j < n.children.length; j++) {
                const ch = n.children[j];
                if (ch?.isValid) visit(ch);
            }
        };
        visit(root);
    }

    /** Больше итераций и сабстепов — меньше просадок стопок в Box2D при сильной гравитации. */
    private applyPhysicsSolverTuning(): void {
        const sys = PhysicsSystem2D.instance;
        if (!sys) return;
        const velIt = 18;
        const posIt = 14;
        if (sys.velocityIterations < velIt) sys.velocityIterations = velIt;
        if (sys.positionIterations < posIt) sys.positionIterations = posIt;
        const steps = 4;
        if (sys.maxSubSteps < steps) sys.maxSubSteps = steps;
    }

    private applyCollidersUnder(root: Node): void {
        if (!root?.isValid) return;
        const visit = (n: Node) => {
            const cols = n.getComponents(Collider2D);
            for (let i = 0; i < cols.length; i++) {
                const c = cols[i];
                if (c?.enabled && c.isValid) c.apply();
            }
            for (let j = 0; j < n.children.length; j++) {
                const ch = n.children[j];
                if (ch?.isValid) visit(ch);
            }
        };
        visit(root);
    }

    /**
     * После scale/rotate/shift у родителя (`GameField`) Box2D не всегда подхватывает новые
     * world-transform у дочерних rigid body. Пинаем sync вручную и будим тела.
     */
    private syncRigidBodiesUnder(root: Node): void {
        if (!root?.isValid) return;
        const visit = (n: Node): void => {
            const bodies = n.getComponents(RigidBody2D);
            for (let i = 0; i < bodies.length; i++) {
                const rb = bodies[i];
                if (!rb?.enabled || !rb.isValid) continue;

                const anyRb = rb as RigidBody2D & {
                    syncPositionToPhysics?: () => void;
                    syncRotationToPhysics?: () => void;
                    syncPosition?: () => void;
                    syncRotation?: () => void;
                };

                if (typeof anyRb.syncPositionToPhysics === 'function') anyRb.syncPositionToPhysics();
                else if (typeof anyRb.syncPosition === 'function') anyRb.syncPosition();

                if (typeof anyRb.syncRotationToPhysics === 'function') anyRb.syncRotationToPhysics();
                else if (typeof anyRb.syncRotation === 'function') anyRb.syncRotation();

                rb.wakeUp();
            }
            for (let j = 0; j < n.children.length; j++) {
                const ch = n.children[j];
                if (ch?.isValid) visit(ch);
            }
        };
        visit(root);
    }

    protected onEnable(): void {
        if (!this.spawnClones) {
            const root = this.node.getChildByName('SpawnedPhysicsItems');
            if (root) root.active = false;
            return;
        }
        this.hideCategoryTemplates();
        this.scheduleOnce(() => this.runCopy(), Math.max(0, this.copyStartDelay));
    }

    /** Оригиналы-шаблоны не должны мелькать на сцене до клонов и во время copyStartDelay. */
    private hideCategoryTemplates(): void {
        const seen = new Set<Node>();
        for (let i = 0; i < FOOD_CATEGORY_DEFS.length; i++) {
            const folder = this.resolveCategoryFolder(i);
            if (folder && !seen.has(folder)) {
                seen.add(folder);
                folder.active = false;
            }
        }
    }

    private normalizeFolderName(raw: string): string {
        return raw.toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    /** Папка-шаблон категории по индексу (точное имя или любой алиас / регистронезависимо среди прямых детей). */
    private resolveCategoryFolder(categoryIndex: number): Node | null {
        if (categoryIndex < 0 || categoryIndex >= FOOD_CATEGORY_DEFS.length) return null;
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
        this._rainSpawnFinished = false;

        const ctf = this.node.getComponent(UITransform);
        if (!ctf) {
            console.error('ContainerPhysicsBowl: нет UITransform на Container');
            this._rainSpawnFinished = true;
            return;
        }

        this._spawnRoot = this.node.getChildByName('SpawnedPhysicsItems') ?? new Node('SpawnedPhysicsItems');
        if (!this._spawnRoot.parent) {
            this.node.addChild(this._spawnRoot);
        }
        this._spawnRoot.active = true;
        this._spawnRoot.layer = this.node.layer;
        const spawnTf = this._spawnRoot.getComponent(UITransform) ?? this._spawnRoot.addComponent(UITransform);
        spawnTf.setContentSize(ctf.contentSize.width, ctf.contentSize.height);
        spawnTf.setAnchorPoint(0.5, 0.5);
        this._spawnRoot.destroyAllChildren();

        type Job = { folder: Node; categoryKey: string; copyIndex: number };
        const jobs: Job[] = [];
        const templateFolders = new Set<Node>();
        for (let ci = 0; ci < FOOD_CATEGORY_DEFS.length; ci++) {
            const folder = this.resolveCategoryFolder(ci);
            if (!folder?.isValid) {
                const def = FOOD_CATEGORY_DEFS[ci]!;
                console.warn(
                    `ContainerPhysicsBowl: нет дочерней ноды для «${def.key}». Добавьте под GameContainer одно из имён: ${def.folderAliases.join(', ')}`,
                );
                continue;
            }
            templateFolders.add(folder);
            const categoryKey = FOOD_CATEGORY_DEFS[ci]!.key;
            const n = this.getCopyCountForCategory(ci);
            for (let c = 0; c < n; c++) {
                jobs.push({ folder, categoryKey, copyIndex: c });
            }
        }

        this.shuffleInPlace(jobs);

        if (jobs.length === 0) {
            console.error('ContainerPhysicsBowl: нет нод категорий под Container');
            this._rainSpawnFinished = true;
            return;
        }

        this._spawnRoot.setSiblingIndex(Math.max(0, this.node.children.length - 1));

        const interval = Number.isFinite(this.spawnInterval) ? Math.max(0, this.spawnInterval) : 0.055;
        const finish = () => {
            this._rainSpawnFinished = true;
            for (const folder of templateFolders) {
                if (folder.isValid) folder.destroy();
            }
        };

        if (interval <= 0) {
            let spawned = 0;
            for (let i = 0; i < jobs.length; i++) {
                if (this.spawnOneAtRain(jobs[i]!, ctf)) spawned++;
            }
            finish();
            console.info('[ContainerPhysicsBowl] скопировано корней:', spawned);
            return;
        }

        // У каждого вызова свой callback — иначе в Cocos повторный scheduleOnce с тем же fn может снимать прошлый таймер.
        let spawned = 0;
        const n = jobs.length;
        for (let i = 0; i < n; i++) {
            const job = jobs[i]!;
            const delay = i * interval;
            const isLast = i === n - 1;
            this.scheduleOnce(() => {
                if (!this.isValid || !this._spawnRoot?.isValid) return;
                if (this.spawnOneAtRain(job, ctf)) spawned++;
                if (isLast) {
                    finish();
                    console.info('[ContainerPhysicsBowl] скопировано корней:', spawned);
                }
            }, delay);
        }
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
        return Math.max(0, this.rainHalfWidth);
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
        clone.setScale(clone.scale.x * 0.5, clone.scale.y * 0.5, clone.scale.z * 0.5);

        this.getRainBaseLocal(ctf, _tmpLocal);
        const halfW = this.getRainHalfWidthLocal();
        const jx = (Math.random() - 0.5) * 2 * halfW;
        const jy = (Math.random() - 0.5) * this.spawnVerticalJitter;
        clone.setPosition(_tmpLocal.x + jx, _tmpLocal.y + jy, _tmpLocal.z);

        if (this.randomSpawnRotation) {
            clone.setRotationFromEuler(0, 0, (Math.random() - 0.5) * 360);
        }

        const vx = (Math.random() * 2 - 1) * this.rainVelocityXMax;
        const vy = this.rainVelocityY + (Math.random() - 0.5) * Math.abs(this.rainVelocityY) * 0.35;
        this.applyRainVelocity(clone, vx, vy);
        this.enableBulletForDynamicBodies(clone);

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

    /** CCD для быстрых динамик — иначе при gravityScale и начальном импульсе возможен tunneling сквозь пол. */
    private enableBulletForDynamicBodies(root: Node): void {
        const visit = (n: Node) => {
            const rb = n.getComponent(RigidBody2D);
            if (rb?.type === ERigidBody2DType.Dynamic) {
                rb.bullet = true;
            }
            for (const ch of n.children) visit(ch);
        };
        visit(root);
    }

    private getCopyCountForCategory(categoryIndex: number): number {
        const arr = this.copiesPerCategory;
        if (Array.isArray(arr) && categoryIndex < arr.length) {
            const v = arr[categoryIndex];
            if (typeof v === 'number' && Number.isFinite(v)) {
                return Math.max(0, Math.floor(v));
            }
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
