import { _decorator, CCBoolean, CCFloat, Size, UITransform, Vec3, Widget, Enum, Label } from 'cc';
import { DynamicUI } from './DynamicUI';
import { GameOrientation } from './GameOrientation';
import { property } from '../playableCore/property';
const { ccclass } = _decorator;

// Enum для соотношений сторон
export enum AspectRatio {
    emn_4_3 = 0,
    mn_3_2 = 1,
    xsm_16_10 = 2,
    sm_5_3 = 3,
    md_16_9 = 4,
    lg_16_8 = 5,
    xlg_19_5_9 = 6
}

// Получение числового значения соотношения сторон
export function getAspectRatioValue(ratio: AspectRatio): number {
    switch (ratio) {
        case AspectRatio.emn_4_3: return 4 / 3;
        case AspectRatio.mn_3_2: return 3 / 2;
        case AspectRatio.xsm_16_10: return 16 / 10;
        case AspectRatio.sm_5_3: return 5 / 3;
        case AspectRatio.md_16_9: return 16 / 9;
        case AspectRatio.lg_16_8: return 16 / 8;
        case AspectRatio.xlg_19_5_9: return 19.5 / 9;
        default: return 1;
    }
}



@ccclass('WidgetProperties')
export class WidgetProperties {
    @property(CCBoolean) _isAlignTop: boolean = false;
    @property(CCBoolean) _isAlignBottom: boolean = false;
    @property(CCBoolean) _isAlignLeft: boolean = false;
    @property(CCBoolean) _isAlignRight: boolean = false;
    @property(CCBoolean) _isAlignVerticalCenter: boolean = false;
    @property(CCBoolean) _isAlignHorizontalCenter: boolean = false;
    @property(CCFloat) _top: number = 0;
    @property(CCFloat) _bottom: number = 0;
    @property(CCFloat) _left: number = 0;
    @property(CCFloat) _right: number = 0;
    @property(CCFloat) _horizontalCenter: number = 0;
    @property(CCFloat) _verticalCenter: number = 0;
}

@ccclass('TransformProperties')
export class TransformProperties {
    @property(CCFloat) _width: number = 0;
    @property(CCFloat) _height: number = 0;
}

@ccclass('NodeProperties')
export class NodeProperties {
    @property(Vec3) _scale: Vec3 = Vec3.ONE.clone();
    @property(Vec3) _position: Vec3 = Vec3.ZERO.clone();
    @property(CCFloat) _angle: number = 0;
}

// Основной класс адаптивного объекта
@ccclass('AdaptiveObject')
export class AdaptiveObject {
    @property({ type: Enum(AspectRatio) })
    _aspectRatio: AspectRatio = AspectRatio.emn_4_3;

    @property(CCBoolean) _enableWidget: boolean = true;
    @property({ type: WidgetProperties, visible(this: AdaptiveObject) { return this._enableWidget; } })
    _widgetProperties: WidgetProperties = new WidgetProperties();

    @property(CCBoolean) _enableNode: boolean = false;
    @property({ type: NodeProperties, visible(this: AdaptiveObject) { return this._enableNode; } })
    _nodeProperties: NodeProperties = new NodeProperties();

    @property(CCBoolean) _enableTransform: boolean = false;
    @property({ type: TransformProperties, visible(this: AdaptiveObject) { return this._enableTransform; } })
    _transformProperties: TransformProperties = new TransformProperties();
}

// Класс для группы объектов (landscape или portrait)
@ccclass('AdaptiveGroup')
export class AdaptiveGroup {
    @property([AdaptiveObject])
    _aspectRatios: AdaptiveObject[] = [];
}

// Интерфейс для результата поиска подходящего объекта
interface MatchResult {
    object: AdaptiveObject | null;
    usedAspectRatio: AspectRatio;
    usedFallback: boolean;
    fallbackAspectRatio?: AspectRatio;
}


@ccclass('AdaptiveLayout')
export class AdaptiveLayout extends DynamicUI {
    // === PORTRAIT ===
    @property({ type: AdaptiveGroup, group: "Portrait" })
    _portraitLayouts: AdaptiveGroup = new AdaptiveGroup();

    // === LANDSCAPE ===
    @property({ type: AdaptiveGroup, group: "Landscape" })
    _landscapeLayouts: AdaptiveGroup = new AdaptiveGroup();

    // === DEBUG LABEL ===
    @property({ type: Label, group: "Debug" })
    _debugLabel: Label = null!;


    public override onResize(newSize: Size = new Size()): void {
        super.onResize(newSize);

        GameOrientation.setResize(newSize);

        // Определяем ориентацию
        const isPortrait = GameOrientation.isPort;

        // Выбираем соответствующую группу
        const targetGroup = isPortrait ? this._portraitLayouts : this._landscapeLayouts;

        // Вычисляем текущее соотношение сторон
        const currentAspectRatio = (Math.max(newSize.width, newSize.height) / Math.min(newSize.width, newSize.height)) + 0.01;

        // Вычисляем какой enum подходит под текущий экран (независимо от группы)
        const suitableAspectRatio = this.findSuitableAspectRatio(currentAspectRatio);

        // Находим подходящий объект и применяем его настройки
        const matchResult = this.findMatchingObjectWithFallback(targetGroup, currentAspectRatio);

        if (matchResult.object) {
            this.applyObjectProperties(matchResult.object);
        }

        // Обновляем debug лейбл
        if (this._debugLabel) {
            const suitableName = AspectRatio[suitableAspectRatio];
            let enumInfo = `Orientation: ${isPortrait ? "Portrait" : "Landscape"}\n`;
            enumInfo += `Aspect Ratio: ${suitableName}(${currentAspectRatio.toFixed(2)})\n`;

            if (matchResult.object) {
                const selectedName = AspectRatio[matchResult.usedAspectRatio];
                const fallbackInfo = matchResult.usedFallback && matchResult.fallbackAspectRatio !== undefined
                    ? ` (fallback: ${AspectRatio[matchResult.fallbackAspectRatio]})`
                    : '';
                enumInfo += `Selected params: ${selectedName}${fallbackInfo}\n`;
            }

            this._debugLabel.string =
                enumInfo +
                `Size: ${Math.round(newSize.width)} × ${Math.round(newSize.height)}\n`;

        }

        // Принудительно обновляем компоновку
        const widget = this.node.getComponent(Widget);
        if (widget) {
            widget.updateAlignment();
        }
    }

    // Находит подходящий enum на основе соотношения сторон из всех доступных
    private findSuitableAspectRatio(currentAspectRatio: number): AspectRatio {
        currentAspectRatio -= 0.001;
        // Все доступные соотношения сторон в порядке возрастания
        const allRatios: AspectRatio[] = [
            AspectRatio.emn_4_3,
            AspectRatio.mn_3_2,
            AspectRatio.xsm_16_10,
            AspectRatio.sm_5_3,
            AspectRatio.md_16_9,
            AspectRatio.lg_16_8,
            AspectRatio.xlg_19_5_9
        ];

        // Находим наибольший enum, где соотношение сторон <= текущего
        let bestRatio: AspectRatio = AspectRatio.emn_4_3;
        for (const ratio of allRatios) {
            const ratioValue = getAspectRatioValue(ratio);
            if (ratioValue <= currentAspectRatio) {
                bestRatio = ratio;
            } else {
                break;
            }
        }

        return bestRatio;
    }

    // Находит подходящий объект с информацией о фоллбеке
    private findMatchingObjectWithFallback(group: AdaptiveGroup, currentAspectRatio: number): MatchResult {
        const result: MatchResult = {
            object: null,
            usedAspectRatio: AspectRatio.emn_4_3,
            usedFallback: false
        };

        if (!group._aspectRatios || group._aspectRatios.length === 0) {
            result.usedFallback = true;
            return result;
        }

        // Сортируем объекты по соотношению сторон (от меньшего к большему)
        const sortedObjects = [...group._aspectRatios].sort((a, b) => {
            const ratioA = getAspectRatioValue(a._aspectRatio);
            const ratioB = getAspectRatioValue(b._aspectRatio);
            return ratioA - ratioB;
        });

        // Находим наибольший объект, где соотношение сторон <= текущего
        let bestMatch: AdaptiveObject | null = null;
        for (const obj of sortedObjects) {
            const objAspectRatio = getAspectRatioValue(obj._aspectRatio);
            if (objAspectRatio <= currentAspectRatio) {
                bestMatch = obj;
            } else {
                // Если наткнулись на объект с большим соотношением, прекращаем поиск
                // так как список отсортирован по возрастанию
                break;
            }
        }

        if (bestMatch) {
            result.object = bestMatch;
            result.usedAspectRatio = bestMatch._aspectRatio;
            return result;
        }

        // Если не нашли подходящий (текущее соотношение меньше всех в группе), используем фоллбек
        result.usedFallback = true;

        // Ищем emn_4_3 как значение по умолчанию
        const defaultObject = sortedObjects.find(obj => obj._aspectRatio === AspectRatio.emn_4_3);
        if (defaultObject) {
            result.object = defaultObject;
            result.usedAspectRatio = AspectRatio.emn_4_3;
            result.fallbackAspectRatio = AspectRatio.emn_4_3;
            return result;
        }

        // Если emn_4_3 не найден, возвращаем первый (с наименьшим соотношением)
        const firstObject = sortedObjects[0];
        if (firstObject) {
            result.object = firstObject;
            result.usedAspectRatio = firstObject._aspectRatio;
            result.fallbackAspectRatio = firstObject._aspectRatio;
            return result;
        }

        return result;
    }

    // Применяет свойства найденного объекта
    private applyObjectProperties(obj: AdaptiveObject): void {
        if (obj._enableNode && obj._nodeProperties) {
            this.applyNodeProperties(obj._nodeProperties);
        }

        if (obj._enableTransform && obj._transformProperties) {
            this.applyTransformProperties(obj._transformProperties);
        }

        if (obj._enableWidget && obj._widgetProperties) {
            const widget = this.node.getComponent(Widget);
            if (widget) {
                this.applyWidgetProperties(widget, obj._widgetProperties);
            }
        }
    }

    private applyNodeProperties(properties: NodeProperties): void {
        this.node.position = properties._position.clone();
        this.node.scale = properties._scale.clone();
        this.node.angle = properties._angle;
    }

    private applyTransformProperties(properties: TransformProperties): void {
        const transform = this.node.getComponent(UITransform);
        if (transform) {
            if (properties._width > 0) {
                transform.width = properties._width;
            }
            if (properties._height > 0) {
                transform.height = properties._height;
            }
        }
    }

    private applyWidgetProperties(widget: Widget, properties: WidgetProperties): void {
        widget.isAlignTop = properties._isAlignTop;
        widget.isAlignBottom = properties._isAlignBottom;
        widget.isAlignLeft = properties._isAlignLeft;
        widget.isAlignRight = properties._isAlignRight;
        widget.isAlignVerticalCenter = properties._isAlignVerticalCenter;
        widget.isAlignHorizontalCenter = properties._isAlignHorizontalCenter;
        widget.top = properties._top;
        widget.bottom = properties._bottom;
        widget.left = properties._left;
        widget.right = properties._right;
        widget.horizontalCenter = properties._horizontalCenter;
        widget.verticalCenter = properties._verticalCenter;
    }
}