import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'fs-extra';
import { join, dirname, basename } from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import { UpdateManager } from './modules/UpdateManager';
// @ts-ignore
import packageJSON from '../../../package.json';

const execFileAsync = promisify(execFile);

// Определение пути к портативному pngquant binary
function getPngquantPath(): string | null {
    const platform = os.platform(); // 'darwin', 'win32', 'linux'
    const arch = os.arch(); // 'arm64', 'x64'
    
    // Базовый путь к папке vendor в расширении
    const vendorDir = join(__dirname, '../../../vendor');
    
    let binaryPath: string;
    
    if (platform === 'win32') {
        binaryPath = join(vendorDir, 'win32', 'pngquant.exe');
    } else if (platform === 'darwin') {
        // На macOS используем x64 binary (работает через Rosetta на ARM)
        binaryPath = join(vendorDir, arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64', 'pngquant');
    } else {
        // Linux или другие платформы - пока не поддерживаются
        console.warn(`Платформа ${platform} не поддерживается для pngquant`);
        return null;
    }
    
    if (existsSync(binaryPath)) {
        console.log(`pngquant найден: ${binaryPath}`);
        return binaryPath;
    }
    
    console.warn(`pngquant binary не найден по пути: ${binaryPath}`);
    return null;
}

const pngquantPath = getPngquantPath();

// Интерфейсы
interface SpriteData {
    id: string;
    name: string;
    image: HTMLImageElement;
    width: number;
    height: number;
    originalWidth: number;
    originalHeight: number;
    x?: number;
    y?: number;
    trimmed?: boolean;
    trimRect?: { x: number; y: number; w: number; h: number };
    filePath?: string; // Путь к файлу в проекте
    spriteFrameUuid?: string; // UUID спрайтфрейма
}

interface PackedRect {
    x: number;
    y: number;
    width: number;
    height: number;
    sprite: SpriteData;
}

// Глобальное хранилище данных панели
const panelState = {
    sprites: [] as SpriteData[],
    atlasCanvas: null as HTMLCanvasElement | null,
    packedSprites: [] as PackedRect[],
    atlasWidth: 0,
    atlasHeight: 0,
    atlasPlistPath: '' as string, // Путь к созданному plist файлу
    atlasUuid: '' as string, // UUID созданного атласа
    // Reference replacer state
    sourceItems: [] as Array<{ path: string; name: string; type: 'sprite' | 'atlas' }>,
    targetItems: [] as Array<{ path: string; name: string; type: 'sprite' | 'atlas'; uuid: string }>,
    // Optimizer state
    optimizerFiles: [] as Array<{ path: string; name: string }>,
    optimizerStats: {
        processed: 0,
        totalOriginalSize: 0,
        totalCompressedSize: 0,
    },
    optimizerErrors: [] as Array<{ file: string; reason: string }>,
    // Список PNG файлов, которые уже обработаны как атласы
    processedAtlasPngFiles: new Set<string>(),
};

// MaxRects Bin Packer Algorithm - правильная реализация
interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

class MaxRectsBinPacker {
    private binWidth: number;
    private binHeight: number;
    private freeRectangles: Rect[];
    private usedRectangles: Rect[];

    constructor(width: number, height: number) {
        this.binWidth = width;
        this.binHeight = height;
        this.freeRectangles = [{ x: 0, y: 0, width: width, height: height }];
        this.usedRectangles = [];
    }

    insert(width: number, height: number): { x: number; y: number } | null {
        // Находим лучшее место для размещения (Best Area Fit + Best Short Side Fit)
        let bestNode: Rect | null = null;
        let bestAreaFit = Infinity;
        let bestShortSideFit = Infinity;

        for (const rect of this.freeRectangles) {
            // Проверяем без поворота
            if (rect.width >= width && rect.height >= height) {
                const areaFit = rect.width * rect.height - width * height;
                const leftoverHoriz = Math.abs(rect.width - width);
                const leftoverVert = Math.abs(rect.height - height);
                const shortSideFit = Math.min(leftoverHoriz, leftoverVert);

                if (areaFit < bestAreaFit || 
                    (areaFit === bestAreaFit && shortSideFit < bestShortSideFit)) {
                    bestNode = { x: rect.x, y: rect.y, width: width, height: height };
                    bestAreaFit = areaFit;
                    bestShortSideFit = shortSideFit;
                }
            }
        }

        if (!bestNode) return null;

        // Проверяем, что место действительно свободно (не пересекается с уже размещёнными)
        for (const used of this.usedRectangles) {
            if (this.intersects(bestNode, used)) {
                console.error('COLLISION DETECTED! This should not happen.', bestNode, used);
                return null;
            }
        }

        // Добавляем в список использованных
        this.usedRectangles.push(bestNode);

        // Разбиваем все пересекающиеся свободные прямоугольники
        this.splitFreeRectangles(bestNode);
        this.pruneFreeList();

        return { x: bestNode.x, y: bestNode.y };
    }

    private splitFreeRectangles(placedRect: Rect) {
        const newFreeRects: Rect[] = [];

        for (const freeRect of this.freeRectangles) {
            // Если нет пересечения, оставляем как есть
            if (!this.intersects(freeRect, placedRect)) {
                newFreeRects.push(freeRect);
                continue;
            }

            // Вычисляем границы пересечения
            const overlapLeft = Math.max(freeRect.x, placedRect.x);
            const overlapTop = Math.max(freeRect.y, placedRect.y);
            const overlapRight = Math.min(freeRect.x + freeRect.width, placedRect.x + placedRect.width);
            const overlapBottom = Math.min(freeRect.y + freeRect.height, placedRect.y + placedRect.height);

            // Создаём до 4 новых прямоугольников вокруг размещённого
            
            // Левая часть (от левой границы freeRect до левой границы placedRect)
            if (placedRect.x > freeRect.x) {
                const newRect: Rect = {
                    x: freeRect.x,
                    y: freeRect.y,
                    width: placedRect.x - freeRect.x,
                    height: freeRect.height
                };
                if (newRect.width > 0 && newRect.height > 0) {
                    newFreeRects.push(newRect);
                }
            }

            // Правая часть (от правой границы placedRect до правой границы freeRect)
            if (placedRect.x + placedRect.width < freeRect.x + freeRect.width) {
                const newRect: Rect = {
                    x: placedRect.x + placedRect.width,
                    y: freeRect.y,
                    width: freeRect.x + freeRect.width - (placedRect.x + placedRect.width),
                    height: freeRect.height
                };
                if (newRect.width > 0 && newRect.height > 0) {
                    newFreeRects.push(newRect);
                }
            }

            // Верхняя часть (от верхней границы freeRect до верхней границы placedRect)
            if (placedRect.y > freeRect.y) {
                const newRect: Rect = {
                    x: freeRect.x,
                    y: freeRect.y,
                    width: freeRect.width,
                    height: placedRect.y - freeRect.y
                };
                if (newRect.width > 0 && newRect.height > 0) {
                    newFreeRects.push(newRect);
                }
            }

            // Нижняя часть (от нижней границы placedRect до нижней границы freeRect)
            if (placedRect.y + placedRect.height < freeRect.y + freeRect.height) {
                const newRect: Rect = {
                    x: freeRect.x,
                    y: placedRect.y + placedRect.height,
                    width: freeRect.width,
                    height: freeRect.y + freeRect.height - (placedRect.y + placedRect.height)
                };
                if (newRect.width > 0 && newRect.height > 0) {
                    newFreeRects.push(newRect);
                }
            }
        }

        this.freeRectangles = newFreeRects;
    }

    private intersects(a: Rect, b: Rect): boolean {
        // Строгая проверка: касающиеся прямоугольники НЕ считаются пересекающимися
        return a.x < b.x + b.width && 
               a.x + a.width > b.x && 
               a.y < b.y + b.height && 
               a.y + a.height > b.y;
    }

    private pruneFreeList() {
        // Удаляем прямоугольники нулевого размера
        this.freeRectangles = this.freeRectangles.filter(r => r.width > 0 && r.height > 0);

        // Удаляем прямоугольники, которые полностью содержатся в других
        // Используем более надёжный алгоритм
        const toRemove = new Set<number>();

        for (let i = 0; i < this.freeRectangles.length; i++) {
            if (toRemove.has(i)) continue;
            
            for (let j = 0; j < this.freeRectangles.length; j++) {
                if (i === j || toRemove.has(j)) continue;
                
                if (this.isContainedIn(this.freeRectangles[i], this.freeRectangles[j])) {
                    toRemove.add(i);
                    break;
                }
            }
        }

        // Удаляем помеченные прямоугольники (с конца, чтобы не сбить индексы)
        const indices = Array.from(toRemove).sort((a, b) => b - a);
        for (const idx of indices) {
            this.freeRectangles.splice(idx, 1);
        }
    }

    private isContainedIn(a: Rect, b: Rect): boolean {
        return a.x >= b.x && a.y >= b.y &&
               a.x + a.width <= b.x + b.width &&
               a.y + a.height <= b.y + b.height;
    }
}

module.exports = Editor.Panel.define({
    listeners: {
        show() { console.log('Spritesheet Creator panel shown'); },
        hide() { console.log('Spritesheet Creator panel hidden'); },
    },
    template: readFileSync(join(__dirname, '../../../static/template/default/index.html'), 'utf-8'),
    style: readFileSync(join(__dirname, '../../../static/style/default/index.css'), 'utf-8'),
    $: {
        dropZone: '#dropZone',
        fileInput: '#fileInput',
        atlasDropZone: '#atlasDropZone',
        atlasInput: '#atlasInput',
        spritesList: '#spritesList',
        spriteCount: '#spriteCount',
        packBtn: '#packBtn',
        clearBtn: '#clearBtn',
        previewContainer: '#previewContainer',
        atlasInfo: '#atlasInfo',
        exportSection: '#exportSection',
        exportPngBtn: '#exportPngBtn',
        exportPlistBtn: '#exportPlistBtn',
        exportBothBtn: '#exportBothBtn',
        padding: '#padding',
        atlasName: '#atlasName',
        powerOfTwo: '#powerOfTwo',
        trimAlpha: '#trimAlpha',
        // Compression elements
        enableCompression: '#enableCompression',
        compressionOptions: '#compressionOptions',
        compressionQuality: '#compressionQuality',
        qualityValue: '#qualityValue',
        maxColors: '#maxColors',
        enableDithering: '#enableDithering',
        fileSizeInfo: '#fileSizeInfo',
        // Tabs
        tabsContainer: '#tabsContainer',
        tabBtns: '.tab-btn',
        atlasCreatorTab: '#atlas-creator-tab',
        referenceReplacerTab: '#reference-replacer-tab',
        // Reference replacer
        sourceSpritesDropZone: '#sourceSpritesDropZone',
        sourceSpritesInput: '#sourceSpritesInput',
        sourceAtlasesDropZone: '#sourceAtlasesDropZone',
        sourceAtlasesInput: '#sourceAtlasesInput',
        targetSpritesDropZone: '#targetSpritesDropZone',
        targetSpritesInput: '#targetSpritesInput',
        targetAtlasesDropZone: '#targetAtlasesDropZone',
        targetAtlasesInput: '#targetAtlasesInput',
        sourceItemsList: '#sourceItemsList',
        targetItemsList: '#targetItemsList',
        replaceReferencesBtn: '#replaceReferencesBtn',
        clearReplacerBtn: '#clearReplacerBtn',
        replacerInfo: '#replacerInfo',
        // Optimizer elements
        optimizerTab: '#optimizer-tab',
        optimizeAllPng: '#optimizeAllPng',
        optimizerDropZone: '#optimizerDropZone',
        optimizerFileInput: '#optimizerFileInput',
        optimizerItemsList: '#optimizerItemsList',
        optimizerFileSelector: '#optimizerFileSelector',
        optimizerCompressionQuality: '#optimizerCompressionQuality',
        optimizerQualityValue: '#optimizerQualityValue',
        optimizerMaxColors: '#optimizerMaxColors',
        optimizerEnableDithering: '#optimizerEnableDithering',
        optimizeBtn: '#optimizeBtn',
        optimizerClearBtn: '#optimizerClearBtn',
        optimizerInfo: '#optimizerInfo',
        optimizerProgress: '#optimizerProgress',
        progressFill: '#progressFill',
        progressText: '#progressText',
        optimizerStats: '#optimizerStats',
        processedCount: '#processedCount',
        totalSavings: '#totalSavings',
        avgSavings: '#avgSavings',
        optimizerErrorsList: '#optimizerErrorsList',
        optimizerErrorsToggle: '#optimizerErrorsToggle',
        optimizerErrorsSection: '#optimizerErrorsSection',
        updateAtlasCreatorButton: '#update-atlas-creator-button',
        versionDisplay: '#version-display',
    },

    methods: {
        // Получение пути к проекту
        getProjectPath(): string | null {
            try {
                let projectPath: string | undefined;
                try {
                    projectPath = Editor.Project.path;
                } catch (e) {
                    // Если Editor.Project.path недоступен, пробуем альтернативный способ
                    projectPath = join(__dirname, '../../../../../');
                }
                return projectPath || null;
            } catch (error) {
                console.error('Ошибка при получении пути к проекту:', error);
                return null;
            }
        },

        // Загрузка изображений из путей файлов
        async handleFilesFromPaths(filePaths: string[]) {
            const errors: string[] = [];
            
            for (const filePath of filePaths) {
                try {
                    if (!existsSync(filePath)) {
                        errors.push(`${filePath}: файл не найден`);
                        continue;
                    }
                    
                    // Читаем файл и создаем File объект
                    const fileData = readFileSync(filePath);
                    const fileName = basename(filePath);
                    const file = new File([fileData], fileName, { type: this.getMimeType(fileName) });
                    
                    await this.loadImage(file);
                } catch (error: any) {
                    console.error(`Ошибка при загрузке файла ${filePath}:`, error);
                    errors.push(`${basename(filePath)}: ${error.message || error}`);
                }
            }
            
            this.updateSpritesList();
            this.updatePackButton();
            
            if (errors.length > 0) {
                Editor.Dialog.warn(
                    `Не удалось загрузить ${errors.length} файл(ов):\n\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n... и еще ${errors.length - 5} файл(ов)` : ''}`,
                    { buttons: ['OK'] }
                );
            }
        },

        // Определение MIME типа по расширению
        getMimeType(fileName: string): string {
            const ext = fileName.toLowerCase().split('.').pop();
            switch (ext) {
                case 'png': return 'image/png';
                case 'jpg':
                case 'jpeg': return 'image/jpeg';
                case 'gif': return 'image/gif';
                case 'webp': return 'image/webp';
                default: return 'image/png';
            }
        },

        // Загрузка изображений
        async handleFiles(files: FileList) {
            const imageFiles = Array.from(files).filter(f => {
                // Пропускаем PNG файлы, которые уже обработаны как атласы
                if (f.type.startsWith('image/') && f.name.toLowerCase().endsWith('.png')) {
                    const fileName = f.name.toLowerCase();
                    if (panelState.processedAtlasPngFiles.has(fileName)) {
                        console.log(`Пропущен PNG файл ${f.name} - уже обработан как атлас`);
                        return false;
                    }
                }
                return f.type.startsWith('image/');
            });
            
            const errors: string[] = [];
            
            for (const file of imageFiles) {
                try {
                    await this.loadImage(file);
                } catch (error: any) {
                    console.error(`Ошибка при загрузке файла ${file.name}:`, error);
                    errors.push(`${file.name}: ${error.message || error}`);
                }
            }
            
            this.updateSpritesList();
            this.updatePackButton();
            
            // Показываем ошибки, если они были
            if (errors.length > 0) {
                Editor.Dialog.warn(
                    `Не удалось загрузить ${errors.length} файл(ов):\n\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n... и еще ${errors.length - 5} файл(ов)` : ''}`,
                    { buttons: ['OK'] }
                );
            }
        },

        loadImage(file: File): Promise<void> {
            const self = this;
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                
                // Обработка ошибок чтения файла
                reader.onerror = () => {
                    console.error(`Ошибка чтения файла: ${file.name}`);
                    reject(new Error(`Не удалось прочитать файл: ${file.name}`));
                };
                
                reader.onload = (e) => {
                    const img = new Image();
                    
                    // Обработка ошибок загрузки изображения
                    img.onerror = () => {
                        console.error(`Ошибка загрузки изображения: ${file.name}`);
                        reject(new Error(`Не удалось загрузить изображение: ${file.name}`));
                    };
                    
                    img.onload = () => {
                        try {
                            const sprite: SpriteData = {
                                id: `sprite_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                                name: file.name.replace(/\.[^/.]+$/, ''),
                                image: img,
                                width: img.width,
                                height: img.height,
                                originalWidth: img.width,
                                originalHeight: img.height,
                            };
                            
                            // Trim alpha if enabled
                            if ((self.$.trimAlpha as HTMLInputElement).checked) {
                                const trimmed = self.trimAlpha(img);
                                sprite.width = trimmed.width;
                                sprite.height = trimmed.height;
                                sprite.trimmed = true;
                                sprite.trimRect = trimmed.rect;
                            }
                            
                            panelState.sprites.push(sprite);
                            resolve();
                        } catch (error) {
                            console.error(`Ошибка при обработке спрайта ${file.name}:`, error);
                            reject(error);
                        }
                    };
                    
                    img.src = e.target?.result as string;
                };
                
                reader.readAsDataURL(file);
            });
        },

        // Парсинг plist файла для извлечения информации о спрайтах
        parsePlist(plistContent: string): Array<{
            name: string;
            textureRect: { x: number; y: number; width: number; height: number };
            spriteSize: { width: number; height: number };
            spriteSourceSize: { width: number; height: number };
            spriteOffset: { x: number; y: number };
            textureRotated: boolean;
        }> {
            const sprites: Array<{
                name: string;
                textureRect: { x: number; y: number; width: number; height: number };
                spriteSize: { width: number; height: number };
                spriteSourceSize: { width: number; height: number };
                spriteOffset: { x: number; y: number };
                textureRotated: boolean;
            }> = [];

            try {
                // Парсим структуру plist - находим начало секции frames
                const framesStartMatch = plistContent.match(/<key>frames<\/key>\s*<dict>/);
                if (!framesStartMatch) {
                    console.warn('Не найдена секция frames в plist');
                    return sprites;
                }

                const framesStartIndex = framesStartMatch.index! + framesStartMatch[0].length;
                
                // Находим соответствующий закрывающий тег, учитывая вложенность
                let depth = 1;
                let framesEndIndex = framesStartIndex;
                let i = framesStartIndex;
                
                while (i < plistContent.length && depth > 0) {
                    const substr = plistContent.substring(i, i + 7);
                    if (plistContent.substring(i, i + 6) === '<dict>') {
                        depth++;
                        i += 6;
                    } else if (plistContent.substring(i, i + 7) === '</dict>') {
                        depth--;
                        if (depth === 0) {
                            framesEndIndex = i;
                            break;
                        }
                        i += 7;
                    } else {
                        i++;
                    }
                }
                
                const framesContent = plistContent.substring(framesStartIndex, framesEndIndex);
                console.log(`Найдена секция frames, длина: ${framesContent.length}`);
                
                // Находим все спрайты - используем более простой и надежный подход
                // Ищем паттерн: <key>имя</key><dict>...</dict>
                let searchIndex = 0;
                let spriteCount = 0;
                
                while (searchIndex < framesContent.length) {
                    // Ищем начало спрайта: <key>имя</key>
                    const keyStart = framesContent.indexOf('<key>', searchIndex);
                    if (keyStart === -1) break;
                    
                    const keyEnd = framesContent.indexOf('</key>', keyStart);
                    if (keyEnd === -1) break;
                    
                    const spriteName = framesContent.substring(keyStart + 5, keyEnd).trim();
                    
                    // Ищем следующий <dict> после </key>
                    const dictStart = framesContent.indexOf('<dict>', keyEnd);
                    if (dictStart === -1) break;
                    
                    // Находим соответствующий </dict>
                    let dictDepth = 1;
                    let dictEnd = dictStart + 6;
                    let j = dictEnd;
                    
                    while (j < framesContent.length && dictDepth > 0) {
                        if (framesContent.substring(j, j + 6) === '<dict>') {
                            dictDepth++;
                            j += 6;
                        } else if (framesContent.substring(j, j + 7) === '</dict>') {
                            dictDepth--;
                            if (dictDepth === 0) {
                                dictEnd = j;
                                break;
                            }
                            j += 7;
                        } else {
                            j++;
                        }
                    }
                    
                    const spriteDict = framesContent.substring(dictStart + 6, dictEnd);
                    spriteCount++;
                    console.log(`Найден спрайт #${spriteCount}: ${spriteName}, длина dict: ${spriteDict.length}`);
                    
                    // Парсим textureRect: {{x,y},{width,height}}
                    const textureRectMatch = spriteDict.match(/<key>textureRect<\/key>\s*<string>\{\{([\d.]+)\s*,\s*([\d.]+)\}\s*,\s*\{([\d.]+)\s*,\s*([\d.]+)\}\}<\/string>/);
                    if (!textureRectMatch) {
                        console.warn(`Не удалось распарсить textureRect для спрайта: ${spriteName}`);
                        searchIndex = dictEnd + 7;
                        continue;
                    }
                    
                    const textureRect = {
                        x: parseFloat(textureRectMatch[1]),
                        y: parseFloat(textureRectMatch[2]),
                        width: parseFloat(textureRectMatch[3]),
                        height: parseFloat(textureRectMatch[4])
                    };
                    
                    // Парсим spriteSize: {width,height}
                    const spriteSizeMatch = spriteDict.match(/<key>spriteSize<\/key>\s*<string>\{([\d.]+)\s*,\s*([\d.]+)\}<\/string>/);
                    const spriteSize = spriteSizeMatch ? {
                        width: parseFloat(spriteSizeMatch[1]),
                        height: parseFloat(spriteSizeMatch[2])
                    } : { width: textureRect.width, height: textureRect.height };
                    
                    // Парсим spriteSourceSize: {width,height}
                    const spriteSourceSizeMatch = spriteDict.match(/<key>spriteSourceSize<\/key>\s*<string>\{([\d.]+)\s*,\s*([\d.]+)\}<\/string>/);
                    const spriteSourceSize = spriteSourceSizeMatch ? {
                        width: parseFloat(spriteSourceSizeMatch[1]),
                        height: parseFloat(spriteSourceSizeMatch[2])
                    } : spriteSize;
                    
                    // Парсим spriteOffset: {x,y}
                    const spriteOffsetMatch = spriteDict.match(/<key>spriteOffset<\/key>\s*<string>\{([\d.\-]+)\s*,\s*([\d.\-]+)\}<\/string>/);
                    const spriteOffset = spriteOffsetMatch ? {
                        x: parseFloat(spriteOffsetMatch[1]),
                        y: parseFloat(spriteOffsetMatch[2])
                    } : { x: 0, y: 0 };
                    
                    // Парсим textureRotated
                    const textureRotatedMatch = spriteDict.match(/<key>textureRotated<\/key>\s*<(true|false)\/>/);
                    const textureRotated = textureRotatedMatch ? textureRotatedMatch[1] === 'true' : false;
                    
                    sprites.push({
                        name: spriteName,
                        textureRect,
                        spriteSize,
                        spriteSourceSize,
                        spriteOffset,
                        textureRotated
                    });
                    
                    // Продолжаем поиск с конца текущего спрайта
                    searchIndex = dictEnd + 7;
                }
                
                console.log(`Распарсено спрайтов: ${sprites.length} из ${spriteCount} найденных`);
            } catch (error) {
                console.error('Ошибка при парсинге plist:', error);
            }
            
            return sprites;
        },

        // Извлечение спрайтов из атласа
        async extractSpritesFromAtlas(plistFile: File, pngFile: File): Promise<void> {
            const self = this;
            
            return new Promise((resolve, reject) => {
                // Читаем plist файл
                const plistReader = new FileReader();
                plistReader.onload = async (e) => {
                    try {
                        const plistContent = e.target?.result as string;
                        console.log(`Размер plist контента: ${plistContent.length} символов`);
                        const spriteInfos = this.parsePlist(plistContent);
                        console.log(`Получено ${spriteInfos.length} спрайтов из plist`);
                        
                        if (spriteInfos.length === 0) {
                            console.warn('Не удалось извлечь спрайты из plist файла');
                            resolve();
                            return;
                        }
                        
                        // Загружаем PNG атлас
                        const pngReader = new FileReader();
                        pngReader.onload = (e) => {
                            const atlasImg = new Image();
                            atlasImg.onload = () => {
                                const canvas = document.createElement('canvas');
                                canvas.width = atlasImg.width;
                                canvas.height = atlasImg.height;
                                const ctx = canvas.getContext('2d')!;
                                ctx.drawImage(atlasImg, 0, 0);
                                
                                // Извлекаем каждый спрайт и ждем загрузки всех
                                const spritePromises: Promise<void>[] = [];
                                const extractedSprites: SpriteData[] = [];
                                
                                for (const spriteInfo of spriteInfos) {
                                    const { textureRect, spriteSize, spriteSourceSize, spriteOffset, textureRotated } = spriteInfo;
                                    
                                    const spritePromise = new Promise<void>((spriteResolve) => {
                                        // Создаем canvas для спрайта
                                        const spriteCanvas = document.createElement('canvas');
                                        spriteCanvas.width = spriteSize.width;
                                        spriteCanvas.height = spriteSize.height;
                                        const spriteCtx = spriteCanvas.getContext('2d')!;
                                        
                                        // Если спрайт повернут, нужно обработать это
                                        if (textureRotated) {
                                            spriteCtx.translate(spriteSize.width, 0);
                                            spriteCtx.rotate(Math.PI / 2);
                                            spriteCtx.drawImage(
                                                canvas,
                                                textureRect.x, textureRect.y,
                                                textureRect.height, textureRect.width,
                                                0, 0,
                                                textureRect.height, textureRect.width
                                            );
                                        } else {
                                            spriteCtx.drawImage(
                                                canvas,
                                                textureRect.x, textureRect.y,
                                                textureRect.width, textureRect.height,
                                                0, 0,
                                                textureRect.width, textureRect.height
                                            );
                                        }
                                        
                                        // Создаем изображение из canvas
                                        const spriteImg = new Image();
                                        spriteImg.onload = () => {
                                            const sprite: SpriteData = {
                                                id: `sprite_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                                                name: spriteInfo.name,
                                                image: spriteImg,
                                                width: spriteSize.width,
                                                height: spriteSize.height,
                                                originalWidth: spriteSourceSize.width,
                                                originalHeight: spriteSourceSize.height,
                                                trimmed: spriteOffset.x !== 0 || spriteOffset.y !== 0,
                                                trimRect: spriteOffset.x !== 0 || spriteOffset.y !== 0 ? {
                                                    x: spriteOffset.x,
                                                    y: spriteOffset.y,
                                                    w: spriteSize.width,
                                                    h: spriteSize.height
                                                } : undefined
                                            };
                                            
                                            // Добавляем спрайт в общий список
                                            panelState.sprites.push(sprite);
                                            extractedSprites.push(sprite);
                                            console.log(`Добавлен спрайт: ${sprite.name} (${sprite.width}x${sprite.height}), всего спрайтов: ${panelState.sprites.length}`);
                                            
                                            // Обновляем список сразу после добавления каждого спрайта
                                            this.updateSpritesList();
                                            this.updatePackButton();
                                            
                                            spriteResolve();
                                        };
                                        spriteImg.onerror = () => {
                                            console.error(`Ошибка загрузки спрайта ${spriteInfo.name}`);
                                            spriteResolve();
                                        };
                                        spriteImg.src = spriteCanvas.toDataURL();
                                    });
                                    
                                    spritePromises.push(spritePromise);
                                }
                                
                                // Ждем загрузки всех спрайтов
                                Promise.all(spritePromises).then(() => {
                                    // Финальное обновление списка после загрузки всех спрайтов
                                    this.updateSpritesList();
                                    this.updatePackButton();
                                    console.log(`Извлечено ${extractedSprites.length} спрайтов из атласа`);
                                    resolve();
                                });
                            };
                            atlasImg.onerror = () => {
                                console.error('Ошибка загрузки PNG атласа');
                                reject(new Error('Не удалось загрузить PNG атлас'));
                            };
                            atlasImg.src = e.target?.result as string;
                        };
                        pngReader.onerror = () => {
                            console.error('Ошибка чтения PNG файла');
                            reject(new Error('Не удалось прочитать PNG файл'));
                        };
                        pngReader.readAsDataURL(pngFile);
                    } catch (error) {
                        console.error('Ошибка при извлечении спрайтов:', error);
                        reject(error);
                    }
                };
                plistReader.onerror = () => {
                    console.error('Ошибка чтения plist файла');
                    reject(new Error('Не удалось прочитать plist файл'));
                };
                plistReader.readAsText(plistFile);
            });
        },

        // Обработка загрузки атласов
        // Обработка атласов из путей файлов
        async handleAtlasFilesFromPaths(filePaths: string[]) {
            const plistPaths = filePaths.filter(p => p.toLowerCase().endsWith('.plist'));
            
            if (plistPaths.length === 0) {
                console.warn('Не найдено plist файлов.');
                Editor.Dialog.warn('Не найдено plist файлов. Убедитесь, что вы выбрали plist файлы.', { buttons: ['OK'] });
                return;
            }
            
            for (const plistPath of plistPaths) {
                const plistName = basename(plistPath).replace(/\.plist$/i, '');
                const plistDir = dirname(plistPath);
                
                console.log(`Обработка атласа: ${plistName}`);
                
                // Ищем PNG файл рядом с plist
                const pngPath = join(plistDir, `${plistName}.png`);
                
                if (existsSync(pngPath)) {
                    const pngFileName = basename(pngPath).toLowerCase();
                    panelState.processedAtlasPngFiles.add(pngFileName);
                    
                    try {
                        // Создаем File объекты из путей
                        const plistData = readFileSync(plistPath);
                        const pngData = readFileSync(pngPath);
                        const plistFile = new File([plistData], basename(plistPath), { type: 'text/xml' });
                        const pngFile = new File([pngData], basename(pngPath), { type: 'image/png' });
                        
                        await this.extractSpritesFromAtlas(plistFile, pngFile);
                        console.log(`Успешно извлечены спрайты из атласа ${plistName}`);
                    } catch (error) {
                        console.error(`Ошибка при извлечении спрайтов из атласа ${plistName}:`, error);
                        panelState.processedAtlasPngFiles.delete(pngFileName);
                        Editor.Dialog.warn(
                            `Ошибка при обработке атласа ${plistName}:\n${error}`,
                            { buttons: ['OK'] }
                        );
                    }
                } else {
                    const message = `PNG файл для атласа "${plistName}" не найден по пути ${pngPath}.\n\nУбедитесь, что PNG файл находится рядом с plist файлом.`;
                    console.warn(message);
                    Editor.Dialog.warn(message, { buttons: ['OK'] });
                }
            }
        },

        async handleAtlasFiles(files: FileList) {
            const plistFiles = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.plist'));
            const allFiles = Array.from(files);
            
            if (plistFiles.length === 0) {
                console.warn('Не найдено plist файлов. Убедитесь, что вы перетащили plist файлы.');
                return;
            }
            
            // Собираем список PNG файлов, которые являются частью атласов (чтобы не добавлять их как обычные изображения)
            const atlasPngFiles = new Set<string>();
            
            for (const plistFile of plistFiles) {
                // Ищем соответствующий PNG файл
                const plistName = plistFile.name.replace(/\.plist$/i, '');
                
                console.log(`Обработка атласа: ${plistName}`);
                
                // Ищем PNG файл в том же списке файлов
                // Проверяем различные варианты имен
                const pngFile = allFiles.find(f => {
                    if (!f.name.toLowerCase().endsWith('.png')) return false;
                    const fileName = f.name.replace(/\.png$/i, '');
                    return fileName === plistName || 
                           fileName.toLowerCase() === plistName.toLowerCase() ||
                           f.name.toLowerCase() === `${plistName.toLowerCase()}.png`;
                });
                
                if (pngFile) {
                    const pngFileName = pngFile.name.toLowerCase();
                    atlasPngFiles.add(pngFileName);
                    // Добавляем в глобальный список обработанных PNG файлов
                    panelState.processedAtlasPngFiles.add(pngFileName);
                    try {
                        await this.extractSpritesFromAtlas(plistFile, pngFile);
                        console.log(`Успешно извлечены спрайты из атласа ${plistName}`);
                    } catch (error) {
                        console.error(`Ошибка при извлечении спрайтов из атласа ${plistName}:`, error);
                        // Удаляем из списка при ошибке
                        panelState.processedAtlasPngFiles.delete(pngFileName);
                        Editor.Dialog.warn(
                            `Ошибка при обработке атласа ${plistName}:\n${error}`,
                            { buttons: ['OK'] }
                        );
                    }
                } else {
                    const message = `PNG файл для атласа "${plistName}" не найден.\n\nУбедитесь, что вы перетащили оба файла (plist и png) вместе.`;
                    console.warn(message);
                    Editor.Dialog.warn(message, { buttons: ['OK'] });
                }
            }
        },

        // Trim transparent pixels
        trimAlpha(img: HTMLImageElement): { width: number; height: number; rect: { x: number; y: number; w: number; h: number } } {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0);
            
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
            
            for (let y = 0; y < canvas.height; y++) {
                for (let x = 0; x < canvas.width; x++) {
                    const alpha = data[(y * canvas.width + x) * 4 + 3];
                    if (alpha > 0) {
                        minX = Math.min(minX, x);
                        minY = Math.min(minY, y);
                        maxX = Math.max(maxX, x);
                        maxY = Math.max(maxY, y);
                    }
                }
            }
            
            if (minX > maxX || minY > maxY) {
                return { width: 1, height: 1, rect: { x: 0, y: 0, w: 1, h: 1 } };
            }
            
            return {
                width: maxX - minX + 1,
                height: maxY - minY + 1,
                rect: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
            };
        },

        updateSpritesList() {
            const list = this.$.spritesList as HTMLElement;
            const self = this;
            list.innerHTML = '';
            
            console.log(`Обновление списка спрайтов: всего ${panelState.sprites.length} спрайтов`);
            
            panelState.sprites.forEach((sprite, index) => {
                console.log(`  Спрайт #${index}: ${sprite.name} (${sprite.width}x${sprite.height}), image.src: ${sprite.image.src ? sprite.image.src.substring(0, 50) + '...' : 'null'}`);
                const item = document.createElement('div');
                item.className = 'sprite-item';
                item.innerHTML = `
                    <img class="sprite-thumb" src="${sprite.image.src}" alt="${sprite.name}">
                    <div class="sprite-info">
                        <div class="sprite-name">${sprite.name}</div>
                        <div class="sprite-size">${sprite.width} × ${sprite.height}</div>
                    </div>
                    <button class="sprite-remove" data-index="${index}">✕</button>
                `;
                list.appendChild(item);
            });
            
            (this.$.spriteCount as HTMLElement).textContent = panelState.sprites.length.toString();
            
            // Add remove handlers
            list.querySelectorAll('.sprite-remove').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const index = parseInt((e.target as HTMLElement).dataset.index || '0');
                    panelState.sprites.splice(index, 1);
                    self.updateSpritesList();
                    self.updatePackButton();
                });
            });
        },

        updatePackButton() {
            (this.$.packBtn as HTMLButtonElement).disabled = panelState.sprites.length === 0;
        },

        // Упаковка спрайтов в атлас
        packSprites() {
            if (panelState.sprites.length === 0) return;
            
            const padding = parseInt((this.$.padding as HTMLInputElement).value);
            const powerOfTwo = (this.$.powerOfTwo as HTMLInputElement).checked;
            
            // Sort sprites by area (largest first)
            const sortedSprites = [...panelState.sprites].sort((a, b) => 
                (b.width * b.height) - (a.width * a.height)
            );
            
            // Calculate total area and find minimum dimensions needed
            let totalArea = 0;
            let maxSpriteWidth = 0;
            let maxSpriteHeight = 0;
            
            for (const sprite of sortedSprites) {
                const w = sprite.width + padding * 2;
                const h = sprite.height + padding * 2;
                totalArea += w * h;
                maxSpriteWidth = Math.max(maxSpriteWidth, w);
                maxSpriteHeight = Math.max(maxSpriteHeight, h);
            }
            
            // Start with estimated size based on total area (with some overhead)
            const estimatedSide = Math.ceil(Math.sqrt(totalArea * 1.2));
            let atlasWidth = powerOfTwo ? this.nextPowerOfTwo(Math.max(estimatedSide, maxSpriteWidth)) : Math.max(estimatedSide, maxSpriteWidth);
            let atlasHeight = powerOfTwo ? this.nextPowerOfTwo(Math.max(64, maxSpriteHeight)) : Math.max(64, maxSpriteHeight);
            
            let packed: PackedRect[] = [];
            let success = false;
            const maxSize = 8192; // Maximum reasonable atlas size
            
            while (!success && atlasWidth <= maxSize && atlasHeight <= maxSize) {
                const packer = new MaxRectsBinPacker(atlasWidth, atlasHeight);
                packed = [];
                success = true;
                
                for (const sprite of sortedSprites) {
                    const w = sprite.width + padding * 2;
                    const h = sprite.height + padding * 2;
                    const pos = packer.insert(w, h);
                    
                    if (pos) {
                        packed.push({
                            x: pos.x + padding,
                            y: pos.y + padding,
                            width: sprite.width,
                            height: sprite.height,
                            sprite: sprite
                        });
                    } else {
                        success = false;
                        break;
                    }
                }
                
                if (!success) {
                    // Grow the smaller dimension first for more square-ish atlas
                    if (atlasWidth <= atlasHeight) {
                        atlasWidth = powerOfTwo ? atlasWidth * 2 : atlasWidth + 64;
                    } else {
                        atlasHeight = powerOfTwo ? atlasHeight * 2 : atlasHeight + 64;
                    }
                }
            }
            
            if (!success) {
                console.error('Cannot pack all sprites!');
                alert('Ошибка: Невозможно упаковать все спрайты! Слишком много или слишком большие изображения.');
                return;
            }
            
            // Optimize: try to shrink the atlas if possible
            if (powerOfTwo) {
                // Try to reduce height if possible
                const usedHeight = Math.max(...packed.map(p => p.y + p.height + padding));
                const minHeight = this.nextPowerOfTwo(usedHeight);
                if (minHeight < atlasHeight) {
                    atlasHeight = minHeight;
                }
            } else {
                // For non-power-of-two, use exact bounds
                const usedWidth = Math.max(...packed.map(p => p.x + p.width + padding));
                const usedHeight = Math.max(...packed.map(p => p.y + p.height + padding));
                atlasWidth = usedWidth;
                atlasHeight = usedHeight;
            }
            
            panelState.atlasWidth = atlasWidth;
            panelState.atlasHeight = atlasHeight;
            panelState.packedSprites = packed;
            
            // Create atlas canvas
            this.createAtlasCanvas();
        },

        // Helper function to get next power of two
        nextPowerOfTwo(n: number): number {
            let p = 1;
            while (p < n) p *= 2;
            return p;
        },

        createAtlasCanvas() {
            const canvas = document.createElement('canvas');
            canvas.id = 'atlasCanvas';
            canvas.width = panelState.atlasWidth;
            canvas.height = panelState.atlasHeight;
            
            const ctx = canvas.getContext('2d')!;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Draw each sprite
            for (const rect of panelState.packedSprites) {
                const sprite = rect.sprite;
                
                if (sprite.trimmed && sprite.trimRect) {
                    // Draw trimmed sprite
                    ctx.drawImage(
                        sprite.image,
                        sprite.trimRect.x, sprite.trimRect.y,
                        sprite.trimRect.w, sprite.trimRect.h,
                        rect.x, rect.y,
                        rect.width, rect.height
                    );
                } else {
                    ctx.drawImage(sprite.image, rect.x, rect.y);
                }
            }
            
            panelState.atlasCanvas = canvas;
            
            // Show preview
            const container = this.$.previewContainer as HTMLElement;
            container.innerHTML = '';
            container.appendChild(canvas);
            
            // Update info
            (this.$.atlasInfo as HTMLElement).innerHTML = 
                `<span>${panelState.atlasWidth}</span> × <span>${panelState.atlasHeight}</span> | ` +
                `<span>${panelState.packedSprites.length}</span> спрайтов`;
            
            // Show export buttons
            (this.$.exportSection as HTMLElement).style.display = 'flex';
            
            // Показать информацию о размере
            this.updatePreviewFileSize();
        },

        // Обновление предпросмотра размера файла
        async updatePreviewFileSize() {
            if (!panelState.atlasCanvas) return;
            
            const dataUrl = panelState.atlasCanvas.toDataURL('image/png');
            const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            const originalSize = buffer.length;
            
            const enableCompression = (this.$.enableCompression as HTMLInputElement).checked;
            
            if (enableCompression && pngquantPath) {
                // Показываем что идёт расчёт
                (this.$.fileSizeInfo as HTMLElement).innerHTML = `<span class="size-original">Расчёт сжатия...</span>`;
                
                try {
                    const compressionResult = await this.compressPng(buffer);
                    this.updateFileSizeInfo(compressionResult.originalSize, compressionResult.compressedSize, true);
                } catch (e) {
                    this.updateFileSizeInfo(originalSize, originalSize, false);
                }
            } else {
                this.updateFileSizeInfo(originalSize, originalSize, false);
            }
        },

        // Генерация Plist для Cocos Creator
        generatePlist(): string {
            const atlasName = (this.$.atlasName as HTMLInputElement).value || 'spritesheet';
            
            let frames = '';
            for (const rect of panelState.packedSprites) {
                const sprite = rect.sprite;
                const frame = `
        <key>${sprite.name}</key>
        <dict>
            <key>aliases</key>
            <array/>
            <key>spriteOffset</key>
            <string>{${sprite.trimmed ? Math.floor((sprite.originalWidth - sprite.width) / 2) : 0},${sprite.trimmed ? Math.floor((sprite.originalHeight - sprite.height) / 2) : 0}}</string>
            <key>spriteSize</key>
            <string>{${rect.width},${rect.height}}</string>
            <key>spriteSourceSize</key>
            <string>{${sprite.originalWidth},${sprite.originalHeight}}</string>
            <key>textureRect</key>
            <string>{{${rect.x},${rect.y}},{${rect.width},${rect.height}}}</string>
            <key>textureRotated</key>
            <false/>
        </dict>`;
                frames += frame;
            }

            return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>frames</key>
    <dict>${frames}
    </dict>
    <key>metadata</key>
    <dict>
        <key>format</key>
        <integer>3</integer>
        <key>pixelFormat</key>
        <string>RGBA8888</string>
        <key>premultiplyAlpha</key>
        <false/>
        <key>realTextureFileName</key>
        <string>${atlasName}.png</string>
        <key>size</key>
        <string>{${panelState.atlasWidth},${panelState.atlasHeight}}</string>
        <key>smartupdate</key>
        <string>${Date.now()}</string>
        <key>textureFileName</key>
        <string>${atlasName}.png</string>
    </dict>
</dict>
</plist>`;
        },

        // Получение UUID спрайта из .meta файла по пути к файлу изображения
        async findSpriteUuidByFilePath(filePath: string): Promise<string | null> {
            try {
                // Проверяем, что путь существует
                if (!existsSync(filePath)) {
                    console.warn(`Файл не найден: ${filePath}`);
                    return null;
                }

                // Читаем .meta файл рядом с файлом
                const metaPath = `${filePath}.meta`;
                if (!existsSync(metaPath)) {
                    console.warn(`Meta файл не найден: ${metaPath}`);
                    return null;
                }

                return await this.readSpriteUuidFromMetaFile(metaPath);
            } catch (error) {
                console.error(`Ошибка при чтении UUID из ${filePath}:`, error);
                return null;
            }
        },

        // Чтение UUID спрайта напрямую из .meta файла
        async readSpriteUuidFromMetaFile(metaPath: string): Promise<string | null> {
            try {
                if (!existsSync(metaPath)) {
                    console.warn(`Meta файл не найден: ${metaPath}`);
                    return null;
                }

                const metaContent = readFileSync(metaPath, 'utf-8');
                const meta = JSON.parse(metaContent);

                // Ищем UUID спрайтфрейма в subMetas
                if (meta.subMetas) {
                    for (const key in meta.subMetas) {
                        const subMeta = meta.subMetas[key];
                        if (subMeta.importer === 'sprite-frame' && subMeta.uuid) {
                            console.log(`Найден UUID спрайтфрейма в ${metaPath}: ${subMeta.uuid}`);
                            return subMeta.uuid;
                        }
                    }
                }

                // Если нет спрайтфрейма, возвращаем основной UUID
                const uuid = meta.uuid || null;
                if (uuid) {
                    console.log(`Найден UUID в ${metaPath}: ${uuid}`);
                }
                return uuid;
            } catch (error) {
                console.error(`Ошибка при чтении UUID из ${metaPath}:`, error);
                return null;
            }
        },

        // Поиск UUID спрайта по имени файла в проекте (для обратной совместимости)
        async findSpriteUuidByFileName(fileName: string): Promise<string | null> {
            try {
                // Получаем корневую директорию проекта
                let projectPath: string | undefined;
                try {
                    projectPath = Editor.Project.path;
                } catch (e) {
                    // Если Editor.Project.path недоступен, пробуем альтернативный способ
                    projectPath = join(__dirname, '../../../../../');
                }
                if (!projectPath) return null;

                // Ищем файл в assets директории
                const assetsPath = join(projectPath, 'assets');
                const { readdirSync, statSync } = require('fs');
                const { extname } = require('path');

                function findFile(dir: string, targetName: string): string | null {
                    try {
                        const items = readdirSync(dir);
                        for (const item of items) {
                            const fullPath = join(dir, item);
                            const stat = statSync(fullPath);
                            
                            if (stat.isDirectory() && !item.startsWith('.')) {
                                const found = findFile(fullPath, targetName);
                                if (found) return found;
                            } else if (stat.isFile() && item === targetName) {
                                return fullPath;
                            }
                        }
                    } catch (e) {
                        // Игнорируем ошибки доступа
                    }
                    return null;
                }

                const filePath = findFile(assetsPath, fileName);
                if (!filePath) return null;

                // Используем новую функцию для чтения UUID
                return await this.findSpriteUuidByFilePath(filePath);
            } catch (error) {
                console.error(`Ошибка при поиске UUID для ${fileName}:`, error);
                return null;
            }
        },

        // Получение UUID атласа из .plist.meta файла
        async getAtlasUuid(plistPath: string): Promise<string | null> {
            try {
                const metaPath = `${plistPath}.meta`;
                if (!existsSync(metaPath)) return null;

                const metaContent = readFileSync(metaPath, 'utf-8');
                const meta = JSON.parse(metaContent);
                return meta.uuid || null;
            } catch (error) {
                console.error(`Ошибка при чтении UUID атласа:`, error);
                return null;
            }
        },

        // Поиск всех .prefab и .scene файлов в проекте
        async findAllPrefabsAndScenes(): Promise<string[]> {
            try {
                // Получаем корневую директорию проекта
                let projectPath: string | undefined;
                try {
                    projectPath = Editor.Project.path;
                } catch (e) {
                    // Если Editor.Project.path недоступен, пробуем альтернативный способ
                    projectPath = join(__dirname, '../../../../../');
                }
                if (!projectPath) return [];

                const assetsPath = join(projectPath, 'assets');
                const { readdirSync, statSync } = require('fs');
                const files: string[] = [];

                function scanDirectory(dir: string) {
                    try {
                        const items = readdirSync(dir);
                        for (const item of items) {
                            const fullPath = join(dir, item);
                            const stat = statSync(fullPath);
                            
                            if (stat.isDirectory() && !item.startsWith('.')) {
                                scanDirectory(fullPath);
                            } else if (stat.isFile() && (item.endsWith('.prefab') || item.endsWith('.scene'))) {
                                files.push(fullPath);
                            }
                        }
                    } catch (e) {
                        // Игнорируем ошибки доступа
                    }
                }

                scanDirectory(assetsPath);
                return files;
            } catch (error) {
                console.error('Ошибка при поиске префабов и сцен:', error);
                return [];
            }
        },

        // Замена ссылок на спрайты в файле
        async replaceSpriteReferences(
            filePath: string,
            spriteUuidToNameMap: Map<string, string>, // UUID -> имя спрайта
            atlasUuid: string,
            spriteNameToIdMap: Map<string, string> // имя -> ID в атласе
        ): Promise<number> {
            try {
                let content = readFileSync(filePath, 'utf-8');
                let replacements = 0;

                // Для каждого старого UUID
                for (const [oldUuid, spriteName] of spriteUuidToNameMap.entries()) {
                    // Ищем все вхождения этого UUID в формате "__uuid__": "uuid" или "__uuid__": "uuid@id"
                    const uuidPattern = new RegExp(`"__uuid__"\\s*:\\s*"${oldUuid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(@[^"]*)?"`, 'g');
                    
                    const matches = content.match(uuidPattern);
                    if (matches && matches.length > 0) {
                        // Получаем ID спрайта из атласа
                        const spriteId = spriteNameToIdMap.get(spriteName);
                        if (spriteId) {
                            const newUuid = `${atlasUuid}@${spriteId}`;
                            content = content.replace(uuidPattern, `"__uuid__": "${newUuid}"`);
                            replacements += matches.length;
                            console.log(`  Заменяем ${oldUuid} -> ${newUuid} (${spriteName})`);
                        }
                    }
                }

                if (replacements > 0) {
                    writeFileSync(filePath, content, 'utf-8');
                }

                return replacements;
            } catch (error) {
                console.error(`Ошибка при замене ссылок в ${filePath}:`, error);
                return 0;
            }
        },

        // Получение ID спрайта из атласа по имени (из .meta файла)
        getSpriteIdFromAtlasMeta(spriteName: string, atlasMetaPath: string): string | null {
            try {
                if (!existsSync(atlasMetaPath)) return null;
                
                const atlasMeta = JSON.parse(readFileSync(atlasMetaPath, 'utf-8'));
                if (atlasMeta.subMetas) {
                    for (const key in atlasMeta.subMetas) {
                        const subMeta = atlasMeta.subMetas[key];
                        if (subMeta.name === spriteName) {
                            return key; // ID спрайта в атласе
                        }
                    }
                }
            } catch (e) {
                console.error('Ошибка при чтении .meta файла атласа:', e);
            }
            return null;
        },

        // Замена ссылок на спрайты во всех префабах и сценах
        async replaceAllSpriteReferences(): Promise<void> {

            try {
                console.log('Начинаем замену ссылок на спрайты...');

                // Собираем UUID всех загруженных спрайтов
                const spriteNameToUuidMap = new Map<string, string>(); // имя -> UUID спрайтфрейма
                const spriteUuidToNameMap = new Map<string, string>(); // UUID -> имя (для обратного поиска)
                
                for (const sprite of panelState.sprites) {
                    if (sprite.name && !spriteNameToUuidMap.has(sprite.name)) {
                        const uuid = await this.findSpriteUuidByFileName(`${sprite.name}.png`);
                        if (uuid) {
                            spriteNameToUuidMap.set(sprite.name, uuid);
                            spriteUuidToNameMap.set(uuid, sprite.name);
                            console.log(`Найден UUID для ${sprite.name}: ${uuid}`);
                        } else {
                            console.warn(`Не удалось найти UUID для ${sprite.name}`);
                        }
                    }
                }

                if (spriteNameToUuidMap.size === 0) {
                    console.log('Не найдено UUID для спрайтов. Пропускаем замену ссылок.');
                    Editor.Dialog.info('Не удалось найти UUID для загруженных спрайтов. Убедитесь, что файлы находятся в папке assets проекта.', {
                        buttons: ['OK'],
                    });
                    return;
                }

                // Получаем UUID атласа
                if (!panelState.atlasPlistPath || !existsSync(panelState.atlasPlistPath)) {
                    console.log('Путь к plist файлу не найден. Пропускаем замену ссылок.');
                    return;
                }

                // Ждем немного, чтобы Cocos Creator успел создать .meta файл
                await new Promise(resolve => setTimeout(resolve, 1000));

                const atlasUuid = await this.getAtlasUuid(panelState.atlasPlistPath);
                if (!atlasUuid) {
                    console.log('UUID атласа не найден. Возможно, .meta файл еще не создан. Пропускаем замену ссылок.');
                    Editor.Dialog.info('UUID атласа не найден. Возможно, нужно дождаться импорта файлов Cocos Creator. Попробуйте запустить замену ссылок позже.', {
                        buttons: ['OK'],
                    });
                    return;
                }

                console.log(`UUID атласа: ${atlasUuid}`);

                // Читаем .meta файл атласа для получения соответствия имен спрайтов и их ID
                const atlasMetaPath = `${panelState.atlasPlistPath}.meta`;
                const spriteNameToIdMap = new Map<string, string>(); // имя -> ID в атласе

                if (existsSync(atlasMetaPath)) {
                    try {
                        const atlasMeta = JSON.parse(readFileSync(atlasMetaPath, 'utf-8'));
                        if (atlasMeta.subMetas) {
                            for (const key in atlasMeta.subMetas) {
                                const subMeta = atlasMeta.subMetas[key];
                                if (subMeta.name) {
                                    spriteNameToIdMap.set(subMeta.name, key);
                                    console.log(`Спрайт ${subMeta.name} имеет ID ${key} в атласе`);
                                }
                            }
                        }
                    } catch (e) {
                        console.error('Ошибка при чтении .meta файла атласа:', e);
                    }
                } else {
                    console.warn(`.meta файл атласа не найден: ${atlasMetaPath}`);
                    Editor.Dialog.info('Файл .meta атласа еще не создан. Дождитесь импорта файлов Cocos Creator и попробуйте снова.', {
                        buttons: ['OK'],
                    });
                    return;
                }

                if (spriteNameToIdMap.size === 0) {
                    console.log('Не найдено соответствий имен спрайтов и ID в атласе.');
                    return;
                }

                // Находим все префабы и сцены
                const files = await this.findAllPrefabsAndScenes();
                console.log(`Найдено ${files.length} файлов для проверки`);

                let totalReplacements = 0;
                let filesWithReplacements = 0;

                // Заменяем ссылки в каждом файле
                for (const filePath of files) {
                    const replacements = await this.replaceSpriteReferences(
                        filePath,
                        spriteUuidToNameMap,
                        atlasUuid,
                        spriteNameToIdMap
                    );
                    if (replacements > 0) {
                        totalReplacements += replacements;
                        filesWithReplacements++;
                        console.log(`Заменено ${replacements} ссылок в ${filePath}`);
                    }
                }

                if (totalReplacements > 0) {
                    Editor.Dialog.info(`Заменено ${totalReplacements} ссылок на спрайты в ${filesWithReplacements} файлах.`, {
                        buttons: ['OK'],
                    });
                } else {
                    console.log('Ссылки на спрайты не найдены для замены.');
                    Editor.Dialog.info('Ссылки на загруженные спрайты не найдены в префабах и сценах.', {
                        buttons: ['OK'],
                    });
                }
            } catch (error) {
                console.error('Ошибка при замене ссылок:', error);
                Editor.Dialog.error(`Ошибка при замене ссылок: ${error}`);
            }
        },

        // Выбор папки и экспорт файлов
        async exportFiles(exportPng: boolean, exportPlist: boolean) {
            if (!panelState.atlasCanvas || panelState.packedSprites.length === 0) return;
            
            const atlasName = (this.$.atlasName as HTMLInputElement).value || 'spritesheet';
            const enableCompression = (this.$.enableCompression as HTMLInputElement).checked;
            
            // Спрашиваем папку один раз
            const result = await Editor.Dialog.select({
                title: 'Выберите папку для сохранения',
                type: 'directory',
            });
            
            if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
                return;
            }
            
            const saveDir = result.filePaths[0];
            
            try {
                let compressionInfo = '';
                
                // Сохраняем PNG
                if (exportPng) {
                    const pngPath = join(saveDir, `${atlasName}.png`);
                    const dataUrl = panelState.atlasCanvas.toDataURL('image/png');
                    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
                    const originalBuffer = Buffer.from(base64Data, 'base64');
                    const originalSize = originalBuffer.length;
                    let finalBuffer: Buffer | Uint8Array = originalBuffer;
                    
                    // Применяем сжатие если включено
                    if (enableCompression && pngquantPath) {
                        console.log('Сжатие PNG с помощью pngquant...');
                        const compressionResult = await this.compressPng(originalBuffer);
                        finalBuffer = compressionResult.compressed;
                        
                        if (compressionResult.compressedSize < compressionResult.originalSize) {
                            const savings = ((1 - compressionResult.compressedSize / compressionResult.originalSize) * 100).toFixed(1);
                            compressionInfo = `\n\n📊 Сжатие: ${this.formatFileSize(compressionResult.originalSize)} → ${this.formatFileSize(compressionResult.compressedSize)} (-${savings}%)`;
                        }
                    }
                    
                    writeFileSync(pngPath, finalBuffer);
                    console.log(`PNG saved to: ${pngPath} (${this.formatFileSize(finalBuffer.length)})`);
                }
                
                // Сохраняем Plist
                if (exportPlist) {
                    const plistPath = join(saveDir, `${atlasName}.plist`);
                    const plistContent = this.generatePlist();
                    writeFileSync(plistPath, plistContent, 'utf-8');
                    console.log(`Plist saved to: ${plistPath}`);
                    
                    // Сохраняем путь к plist для последующей замены ссылок
                    panelState.atlasPlistPath = plistPath;
                }
                
                // Уведомление об успехе
                const savedFiles = [];
                if (exportPng) savedFiles.push(`${atlasName}.png`);
                if (exportPlist) savedFiles.push(`${atlasName}.plist`);
                
                Editor.Dialog.info(`Файлы успешно сохранены в:\n${saveDir}\n\n${savedFiles.join('\n')}${compressionInfo}`, {
                    buttons: ['OK'],
                });
                
            } catch (error) {
                console.error('Error saving files:', error);
                Editor.Dialog.error(`Ошибка сохранения: ${error}`);
            }
        },

        // Экспорт PNG
        exportPng() {
            this.exportFiles(true, false);
        },

        // Экспорт Plist
        exportPlist() {
            this.exportFiles(false, true);
        },

        // Экспорт обоих файлов
        exportBoth() {
            this.exportFiles(true, true);
        },

        // Форматирование размера файла
        formatFileSize(bytes: number): string {
            if (bytes < 1024) return bytes + ' B';
            if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
            return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
        },

        // Сжатие PNG через pngquant
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async compressPng(inputBuffer: Buffer): Promise<{ compressed: any; originalSize: number; compressedSize: number }> {
            const originalSize = inputBuffer.length;
            
            if (!pngquantPath) {
                console.warn('pngquant не доступен');
                return { compressed: inputBuffer, originalSize, compressedSize: originalSize };
            }

            const quality = parseInt((this.$.compressionQuality as HTMLInputElement).value);
            const maxColors = parseInt((this.$.maxColors as HTMLSelectElement).value);
            const dithering = (this.$.enableDithering as HTMLInputElement).checked;

            // Создаём временные файлы
            const os = require('os');
            const tempDir = os.tmpdir();
            const tempInput = join(tempDir, `pngquant_input_${Date.now()}.png`);
            const tempOutput = join(tempDir, `pngquant_output_${Date.now()}.png`);

            try {
                // Записываем входной файл
                writeFileSync(tempInput, inputBuffer);

                // Формируем аргументы pngquant
                // Синтаксис: pngquant [ncolors] [options] -- input.png
                // Количество цветов должно идти ПЕРВЫМ!
                // --quality 0-{max} означает: "использовать до max% качества, но не отклонять из-за низкого качества"
                const args: string[] = [
                    maxColors.toString(), // количество цветов ПЕРВЫМ аргументом
                    '--quality', `0-${quality}`, // 0 как минимум чтобы избежать ошибки 99
                    '--speed', '1', // Лучшее качество
                    '--output', tempOutput,
                    '--force',
                    '--skip-if-larger', // Не сохранять если результат больше оригинала
                ];

                if (!dithering) {
                    args.push('--nofs'); // No Floyd-Steinberg dithering
                }

                // Входной файл должен идти после --
                args.push('--'); // Разделитель опций от файлов
                args.push(tempInput);

                console.log('pngquant args:', args.join(' '));

                // Запускаем pngquant
                try {
                    await execFileAsync(pngquantPath, args);
                } catch (execError: any) {
                    // pngquant возвращает код 98 если --skip-if-larger и результат больше
                    // Код 99 если качество не достигнуто (не должно произойти с 0-max)
                    console.warn('pngquant exit:', execError.code, execError.message);
                    // Если выходной файл не создан, вернём оригинал
                    if (!existsSync(tempOutput)) {
                        console.log('pngquant не создал выходной файл, используем оригинал');
                        if (existsSync(tempInput)) unlinkSync(tempInput);
                        return { compressed: inputBuffer, originalSize, compressedSize: originalSize };
                    }
                }

                // Читаем результат
                if (existsSync(tempOutput)) {
                    const compressedBuffer = readFileSync(tempOutput);
                    const compressedSize = compressedBuffer.length;

                    // Удаляем временные файлы
                    if (existsSync(tempInput)) unlinkSync(tempInput);
                    if (existsSync(tempOutput)) unlinkSync(tempOutput);

                    console.log(`PNG сжат: ${this.formatFileSize(originalSize)} → ${this.formatFileSize(compressedSize)} (${((1 - compressedSize / originalSize) * 100).toFixed(1)}%)`);

                    return { compressed: compressedBuffer, originalSize, compressedSize };
                }
            } catch (error: any) {
                console.error('Ошибка сжатия pngquant:', error);
                // Если качество слишком низкое, pngquant может завершиться с ошибкой
                // В таком случае возвращаем оригинал
            }

            // Очистка в случае ошибки
            try {
                if (existsSync(tempInput)) unlinkSync(tempInput);
                if (existsSync(tempOutput)) unlinkSync(tempOutput);
            } catch (e) {}

            return { compressed: inputBuffer, originalSize, compressedSize: originalSize };
        },

        // Обновление информации о размере файла
        updateFileSizeInfo(originalSize: number, compressedSize: number, isCompressed: boolean) {
            const fileSizeInfo = this.$.fileSizeInfo as HTMLElement;
            
            if (isCompressed && compressedSize < originalSize) {
                const savings = ((1 - compressedSize / originalSize) * 100).toFixed(1);
                fileSizeInfo.innerHTML = `
                    <span class="size-original">${this.formatFileSize(originalSize)}</span>
                    <span class="size-arrow">→</span>
                    <span class="size-compressed">${this.formatFileSize(compressedSize)}</span>
                    <span class="size-savings">-${savings}%</span>
                `;
            } else {
                fileSizeInfo.innerHTML = `
                    <span class="size-original">Размер: ${this.formatFileSize(originalSize)}</span>
                `;
            }
        },

        // Очистка
        clearAll() {
            // Очищаем список обработанных PNG файлов атласов
            panelState.processedAtlasPngFiles.clear();
            panelState.sprites = [];
            panelState.packedSprites = [];
            panelState.atlasCanvas = null;
            panelState.atlasWidth = 0;
            panelState.atlasHeight = 0;
            
            this.updateSpritesList();
            this.updatePackButton();
            
            (this.$.previewContainer as HTMLElement).innerHTML = `
                <div class="preview-placeholder">
                    <span>📦</span>
                    <p>Добавьте изображения и нажмите "Упаковать атлас"</p>
                </div>
            `;
            (this.$.atlasInfo as HTMLElement).innerHTML = '';
            (this.$.exportSection as HTMLElement).style.display = 'none';
        },

        // ========== Reference Replacer Methods ==========

        // Переключение табов
        switchTab(tabName: string) {
            console.log('switchTab вызван с:', tabName);
            
            // Получаем контейнер табов
            const tabsContainer = this.$.tabsContainer as HTMLElement;
            if (!tabsContainer) {
                console.error('Контейнер табов не найден в this.$');
                return;
            }

            // Убираем активный класс со всех табов
            const allTabBtns = tabsContainer.querySelectorAll('.tab-btn');
            allTabBtns.forEach(btn => {
                btn.classList.remove('active');
            });

            // Получаем все контенты табов - ищем в корневом элементе панели
            const panelRoot = tabsContainer.parentElement;
            if (!panelRoot) {
                console.error('Корневой элемент панели не найден');
                return;
            }

            const allTabContents = panelRoot.querySelectorAll('.tab-content');
            allTabContents.forEach(content => {
                content.classList.remove('active');
            });

            // Активируем выбранный таб
            const tabBtn = tabsContainer.querySelector(`[data-tab="${tabName}"]`) as HTMLElement;
            const tabContent = panelRoot.querySelector(`#${tabName}-tab`) as HTMLElement;
            
            console.log('tabBtn найден:', !!tabBtn, tabBtn);
            console.log('tabContent найден:', !!tabContent, tabContent);
            
            if (tabBtn && tabContent) {
                tabBtn.classList.add('active');
                tabContent.classList.add('active');
                console.log('Таб переключен успешно');
                
                // Обновляем состояние кнопок при переключении на таб замены ссылок
                if (tabName === 'reference-replacer') {
                    this.updateReplaceButton();
                }
            } else {
                console.error('Не удалось найти элементы таба:', { 
                    tabName, 
                    tabBtn: !!tabBtn, 
                    tabContent: !!tabContent,
                    allTabBtns: allTabBtns.length,
                    allTabContents: allTabContents.length
                });
            }
        },

        // Обработка файлов исходных спрайтов из путей
        async handleSourceSpritesFilesFromPaths(filePaths: string[]) {
            const spritePaths = filePaths.filter(p => {
                const name = basename(p).toLowerCase();
                return name.match(/\.(png|jpg|jpeg|meta)$/i);
            });

            console.log(`Обработка ${spritePaths.length} файлов исходных спрайтов (включая .meta)`);

            const errors: string[] = [];

            for (const filePath of spritePaths) {
                try {
                    const isMetaFile = filePath.toLowerCase().endsWith('.meta');
                    
                    let imagePath: string;
                    let metaPath: string;
                    let nameWithoutExt: string;
                    
                    if (isMetaFile) {
                        metaPath = filePath;
                        imagePath = metaPath.replace(/\.meta$/i, '');
                        nameWithoutExt = basename(metaPath).replace(/\.meta$/i, '').replace(/\.[^/.]+$/, '');
                        
                        if (!existsSync(metaPath)) {
                            errors.push(`${basename(filePath)}: .meta файл не найден`);
                            continue;
                        }
                    } else {
                        imagePath = filePath;
                        nameWithoutExt = basename(filePath).replace(/\.[^/.]+$/, '');
                        metaPath = `${imagePath}.meta`;
                        
                        if (!existsSync(imagePath)) {
                            errors.push(`${basename(filePath)}: файл не найден`);
                            continue;
                        }
                    }
                    
                    if (!panelState.sourceItems.find(item => item.name === nameWithoutExt && item.type === 'sprite')) {
                        panelState.sourceItems.push({
                            path: imagePath,
                            name: nameWithoutExt,
                            type: 'sprite'
                        });
                        console.log(`Добавлен спрайт: ${nameWithoutExt} (путь: ${imagePath})`);
                    }
                } catch (error: any) {
                    console.error(`Ошибка при обработке файла ${filePath}:`, error);
                    errors.push(`${basename(filePath)}: ${error.message || error}`);
                }
            }

            this.updateSourceItemsList();
            this.updateReplaceButton();
            
            if (errors.length > 0) {
                Editor.Dialog.warn(
                    `Не удалось обработать ${errors.length} файл(ов):\n\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n... и еще ${errors.length - 5} файл(ов)` : ''}`,
                    { buttons: ['OK'] }
                );
            }
        },

        // Обработка файлов исходных спрайтов (из drag & drop или input)
        async handleSourceSpritesFiles(files: FileList) {
            // Принимаем изображения и .meta файлы
            const spriteFiles = Array.from(files).filter(f => 
                f.type.startsWith('image/') || 
                f.name.match(/\.(png|jpg|jpeg|meta)$/i)
            );

            console.log(`Обработка ${spriteFiles.length} файлов спрайтов (включая .meta)`);

            const errors: string[] = [];

            for (const file of spriteFiles) {
                try {
                    const filePath = (file as any).path || file.name;
                    const isMetaFile = file.name.toLowerCase().endsWith('.meta');
                    
                    let imagePath: string;
                    let metaPath: string;
                    let nameWithoutExt: string;
                    
                    if (isMetaFile) {
                        // Если это .meta файл, извлекаем путь к изображению
                        metaPath = filePath;
                        // Убираем .meta из пути
                        imagePath = metaPath.replace(/\.meta$/i, '');
                        nameWithoutExt = file.name.replace(/\.meta$/i, '').replace(/\.[^/.]+$/, '');
                        
                        console.log(`Обработка .meta файла: ${file.name}`);
                        console.log(`  Путь к .meta: ${metaPath}`);
                        console.log(`  Путь к изображению: ${imagePath}`);
                        
                        // Проверяем существование .meta файла
                        if (!existsSync(metaPath)) {
                            errors.push(`${file.name}: .meta файл не найден по пути ${metaPath}`);
                            continue;
                        }
                        
                        // Проверяем существование изображения (опционально, может не быть если только .meta перетащили)
                        if (!existsSync(imagePath)) {
                            console.warn(`Изображение не найдено по пути ${imagePath}, но продолжаем обработку .meta файла`);
                        }
                    } else {
                        // Обычный файл изображения
                        imagePath = filePath;
                        nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
                        metaPath = `${imagePath}.meta`;
                        
                        // Проверяем существование файла
                        if (!filePath || filePath === file.name) {
                            console.warn(`Не удалось получить путь к файлу: ${file.name}. Пытаемся найти по имени в проекте.`);
                            const uuid = await this.findSpriteUuidByFileName(file.name);
                            if (!uuid) {
                                errors.push(`${file.name}: файл не найден в проекте`);
                                continue;
                            }
                        } else {
                            if (!existsSync(imagePath)) {
                                errors.push(`${file.name}: файл не найден по пути ${imagePath}`);
                                continue;
                            }
                            
                            if (!existsSync(metaPath)) {
                                errors.push(`${file.name}: .meta файл не найден рядом с файлом`);
                                continue;
                            }
                        }
                    }
                    
                    // Проверяем, не добавлен ли уже
                    if (!panelState.sourceItems.find(item => item.name === nameWithoutExt && item.type === 'sprite')) {
                        panelState.sourceItems.push({
                            path: imagePath, // Сохраняем путь к изображению
                            name: nameWithoutExt,
                            type: 'sprite'
                        });
                        console.log(`Добавлен спрайт: ${nameWithoutExt} (путь: ${imagePath})`);
                    }
                } catch (error: any) {
                    console.error(`Ошибка при обработке файла ${file.name}:`, error);
                    errors.push(`${file.name}: ${error.message || error}`);
                }
            }

            this.updateSourceItemsList();
            this.updateReplaceButton();
            
            // Показываем ошибки, если они были
            if (errors.length > 0) {
                Editor.Dialog.warn(
                    `Не удалось обработать ${errors.length} файл(ов):\n\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n... и еще ${errors.length - 5} файл(ов)` : ''}`,
                    { buttons: ['OK'] }
                );
            }
        },

        // Обработка файлов исходных атласов из путей
        async handleSourceAtlasesFilesFromPaths(filePaths: string[]) {
            const plistPaths = filePaths.filter(p => p.toLowerCase().endsWith('.plist'));

            console.log(`Обработка ${plistPaths.length} файлов исходных атласов`);

            for (const filePath of plistPaths) {
                const nameWithoutExt = basename(filePath).replace(/\.plist$/i, '');
                
                // Проверяем, не добавлен ли уже
                if (!panelState.sourceItems.find(item => item.name === nameWithoutExt && item.type === 'atlas')) {
                    panelState.sourceItems.push({
                        path: filePath,
                        name: nameWithoutExt,
                        type: 'atlas'
                    });
                    console.log(`Добавлен исходный атлас: ${nameWithoutExt}`);
                }
            }

            this.updateSourceItemsList();
            this.updateReplaceButton();
        },

        // Обработка файлов исходных атласов (из drag & drop или input)
        async handleSourceAtlasesFiles(files: FileList) {
            const plistFiles = Array.from(files).filter(f => 
                f.name.endsWith('.plist')
            );

            console.log(`Обработка ${plistFiles.length} файлов атласов`);

            for (const file of plistFiles) {
                const nameWithoutExt = file.name.replace(/\.plist$/, '');
                const filePath = (file as any).path || file.name;
                
                // Проверяем, не добавлен ли уже
                if (!panelState.sourceItems.find(item => item.name === nameWithoutExt && item.type === 'atlas')) {
                    panelState.sourceItems.push({
                        path: filePath,
                        name: nameWithoutExt,
                        type: 'atlas'
                    });
                    console.log(`Добавлен исходный атлас: ${nameWithoutExt}`);
                }
            }

            this.updateSourceItemsList();
            this.updateReplaceButton();
        },

        // Обработка файлов целевых спрайтов из путей
        async handleTargetSpritesFilesFromPaths(filePaths: string[]) {
            const spritePaths = filePaths.filter(p => {
                const name = basename(p).toLowerCase();
                return name.match(/\.(png|jpg|jpeg|meta)$/i);
            });

            console.log(`Обработка ${spritePaths.length} файлов целевых спрайтов (включая .meta)`);

            const errors: string[] = [];

            for (const filePath of spritePaths) {
                try {
                    const isMetaFile = filePath.toLowerCase().endsWith('.meta');
                    
                    let imagePath: string;
                    let metaPath: string;
                    let nameWithoutExt: string;
                    
                    if (isMetaFile) {
                        metaPath = filePath;
                        imagePath = metaPath.replace(/\.meta$/i, '');
                        nameWithoutExt = basename(metaPath).replace(/\.meta$/i, '').replace(/\.[^/.]+$/, '');
                        
                        if (!existsSync(metaPath)) {
                            errors.push(`${basename(filePath)}: .meta файл не найден`);
                            continue;
                        }
                    } else {
                        imagePath = filePath;
                        nameWithoutExt = basename(filePath).replace(/\.[^/.]+$/, '');
                        metaPath = `${imagePath}.meta`;
                        
                        if (!existsSync(imagePath)) {
                            errors.push(`${basename(filePath)}: файл не найден`);
                            continue;
                        }
                    }
                    
                    let spriteUuid: string | null = null;
                    
                    if (isMetaFile) {
                        spriteUuid = await this.readSpriteUuidFromMetaFile(metaPath);
                    } else {
                        if (existsSync(metaPath)) {
                            spriteUuid = await this.findSpriteUuidByFilePath(imagePath);
                        }
                    }
                    
                    if (!spriteUuid) {
                        errors.push(`${basename(filePath)}: UUID не найден в .meta файле`);
                        continue;
                    }

                    if (!panelState.targetItems.find(item => item.path === imagePath && item.type === 'sprite')) {
                        panelState.targetItems.push({
                            path: imagePath,
                            name: nameWithoutExt,
                            type: 'sprite',
                            uuid: spriteUuid
                        });
                        console.log(`Добавлен целевой спрайт: ${nameWithoutExt} (UUID: ${spriteUuid})`);
                    }
                } catch (error: any) {
                    console.error(`Ошибка при обработке файла ${filePath}:`, error);
                    errors.push(`${basename(filePath)}: ${error.message || error}`);
                }
            }

            this.updateTargetItemsList();
            this.updateReplaceButton();
            
            if (errors.length > 0) {
                Editor.Dialog.warn(
                    `Не удалось обработать ${errors.length} файл(ов):\n\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n... и еще ${errors.length - 5} файл(ов)` : ''}`,
                    { buttons: ['OK'] }
                );
            }
        },

        // Обработка файлов целевых спрайтов (из drag & drop или input)
        async handleTargetSpritesFiles(files: FileList) {
            // Принимаем изображения и .meta файлы
            const spriteFiles = Array.from(files).filter(f => 
                f.type.startsWith('image/') || 
                f.name.match(/\.(png|jpg|jpeg|meta)$/i)
            );

            console.log(`Обработка ${spriteFiles.length} файлов целевых спрайтов (включая .meta)`);

            const errors: string[] = [];

            for (const file of spriteFiles) {
                try {
                    const filePath = (file as any).path || file.name;
                    const isMetaFile = file.name.toLowerCase().endsWith('.meta');
                    
                    let imagePath: string;
                    let metaPath: string;
                    let nameWithoutExt: string;
                    
                    if (isMetaFile) {
                        // Если это .meta файл, извлекаем путь к изображению
                        metaPath = filePath;
                        // Убираем .meta из пути
                        imagePath = metaPath.replace(/\.meta$/i, '');
                        nameWithoutExt = file.name.replace(/\.meta$/i, '').replace(/\.[^/.]+$/, '');
                        
                        console.log(`Обработка .meta файла: ${file.name}`);
                        console.log(`  Путь к .meta: ${metaPath}`);
                        console.log(`  Путь к изображению: ${imagePath}`);
                        
                        // Проверяем существование .meta файла
                        if (!existsSync(metaPath)) {
                            errors.push(`${file.name}: .meta файл не найден по пути ${metaPath}`);
                            continue;
                        }
                    } else {
                        // Обычный файл изображения
                        imagePath = filePath;
                        nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
                        metaPath = `${imagePath}.meta`;
                        
                        // Проверяем существование файла
                        if (!filePath || filePath === file.name) {
                            console.warn(`Путь к файлу не найден для ${file.name}, ищем по имени в проекте`);
                        } else {
                            if (!existsSync(imagePath)) {
                                errors.push(`${file.name}: файл не найден по пути ${imagePath}`);
                                continue;
                            }
                        }
                    }
                    
                    // Получаем UUID спрайтфрейма из .meta файла
                    let spriteUuid: string | null = null;
                    
                    if (isMetaFile) {
                        // Если это .meta файл, читаем UUID напрямую из него
                        if (existsSync(metaPath)) {
                            spriteUuid = await this.readSpriteUuidFromMetaFile(metaPath);
                        }
                    } else {
                        // Обычный файл изображения
                        if (existsSync(metaPath)) {
                            // Читаем UUID из .meta файла рядом с изображением
                            spriteUuid = await this.findSpriteUuidByFilePath(imagePath);
                        } else if (filePath && filePath !== file.name) {
                            // Если нет .meta, но есть путь, пытаемся найти по имени в проекте
                            spriteUuid = await this.findSpriteUuidByFileName(file.name);
                        }
                    }
                    
                    if (!spriteUuid) {
                        console.warn(`Не удалось получить UUID для спрайта: ${imagePath || file.name}`);
                        errors.push(`${file.name}: UUID не найден в .meta файле`);
                        continue;
                    }

                    // Проверяем, не добавлен ли уже
                    if (!panelState.targetItems.find(item => item.path === imagePath && item.type === 'sprite')) {
                        panelState.targetItems.push({
                            path: imagePath, // Сохраняем путь к изображению
                            name: nameWithoutExt,
                            type: 'sprite',
                            uuid: spriteUuid
                        });
                        console.log(`Добавлен целевой спрайт: ${nameWithoutExt} (UUID: ${spriteUuid})`);
                    }
                } catch (error: any) {
                    console.error(`Ошибка при обработке файла ${file.name}:`, error);
                    errors.push(`${file.name}: ${error.message || error}`);
                }
            }

            this.updateTargetItemsList();
            this.updateReplaceButton();
            
            // Показываем ошибки, если они были
            if (errors.length > 0) {
                Editor.Dialog.warn(
                    `Не удалось обработать ${errors.length} файл(ов):\n\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n... и еще ${errors.length - 5} файл(ов)` : ''}`,
                    { buttons: ['OK'] }
                );
            }
        },

        // Обработка файлов целевых атласов из путей
        async handleTargetAtlasesFilesFromPaths(filePaths: string[]) {
            const plistPaths = filePaths.filter(p => p.toLowerCase().endsWith('.plist'));

            console.log(`Обработка ${plistPaths.length} файлов целевых атласов`);

            const errors: string[] = [];

            for (const filePath of plistPaths) {
                try {
                    const nameWithoutExt = basename(filePath).replace(/\.plist$/i, '');
                    
                    const atlasUuid = await this.getAtlasUuid(filePath);
                    if (!atlasUuid) {
                        errors.push(`${basename(filePath)}: UUID не найден`);
                        continue;
                    }

                    if (!panelState.targetItems.find(item => item.path === filePath && item.type === 'atlas')) {
                        panelState.targetItems.push({
                            path: filePath,
                            name: nameWithoutExt,
                            type: 'atlas',
                            uuid: atlasUuid
                        });
                        console.log(`Добавлен целевой атлас: ${nameWithoutExt}`);
                    }
                } catch (error: any) {
                    console.error(`Ошибка при обработке файла ${filePath}:`, error);
                    errors.push(`${basename(filePath)}: ${error.message || error}`);
                }
            }

            this.updateTargetItemsList();
            this.updateReplaceButton();
            
            if (errors.length > 0) {
                Editor.Dialog.warn(
                    `Не удалось обработать ${errors.length} файл(ов):\n\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n... и еще ${errors.length - 5} файл(ов)` : ''}`,
                    { buttons: ['OK'] }
                );
            }
        },

        // Обработка файлов целевых атласов (из drag & drop или input)
        async handleTargetAtlasesFiles(files: FileList) {
            const plistFiles = Array.from(files).filter(f => 
                f.name.endsWith('.plist')
            );

            console.log(`Обработка ${plistFiles.length} файлов целевых атласов`);

            const errors: string[] = [];

            for (const file of plistFiles) {
                try {
                    const nameWithoutExt = file.name.replace(/\.plist$/, '');
                    const filePath = (file as any).path || file.name;
                    
                    // Получаем UUID атласа
                    const atlasUuid = await this.getAtlasUuid(filePath);
                    if (!atlasUuid) {
                        console.warn(`Не удалось получить UUID для атласа: ${filePath}`);
                        errors.push(`${file.name}: UUID не найден`);
                        continue;
                    }

                    // Проверяем, не добавлен ли уже
                    if (!panelState.targetItems.find(item => item.path === filePath && item.type === 'atlas')) {
                        panelState.targetItems.push({
                            path: filePath,
                            name: nameWithoutExt,
                            type: 'atlas',
                            uuid: atlasUuid
                        });
                        console.log(`Добавлен целевой атлас: ${nameWithoutExt}`);
                    }
                } catch (error: any) {
                    console.error(`Ошибка при обработке файла ${file.name}:`, error);
                    errors.push(`${file.name}: ${error.message || error}`);
                }
            }

            this.updateTargetItemsList();
            this.updateReplaceButton();
            
            // Показываем ошибки, если они были
            if (errors.length > 0) {
                Editor.Dialog.warn(
                    `Не удалось обработать ${errors.length} файл(ов):\n\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n... и еще ${errors.length - 5} файл(ов)` : ''}`,
                    { buttons: ['OK'] }
                );
            }
        },

        // Выбор исходных спрайтов (старый метод через диалог - оставляем для совместимости)
        async selectSourceSprites() {
            try {
                console.log('Выбор исходных спрайтов...');
                const result = await Editor.Dialog.select({
                    title: 'Выберите спрайты',
                    type: 'file',
                    filters: [
                        { name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }
                    ],
                    multi: true,
                });

                console.log('Результат выбора спрайтов:', result);

                if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
                    console.log('Выбор отменен или файлы не выбраны');
                    return;
                }

                console.log(`Выбрано файлов: ${result.filePaths.length}`);

                for (const filePath of result.filePaths) {
                    const path = require('path');
                    const fileName = path.basename(filePath);
                    const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
                    
                    console.log(`Обработка файла: ${fileName} -> ${nameWithoutExt}`);
                    
                    // Проверяем, не добавлен ли уже
                    if (!panelState.sourceItems.find(item => item.path === filePath)) {
                        panelState.sourceItems.push({
                            path: filePath,
                            name: nameWithoutExt,
                            type: 'sprite'
                        });
                        console.log(`Добавлен спрайт: ${nameWithoutExt}`);
                    } else {
                        console.log(`Спрайт уже добавлен: ${nameWithoutExt}`);
                    }
                }

                console.log(`Всего исходных элементов: ${panelState.sourceItems.length}`);
                this.updateSourceItemsList();
                this.updateReplaceButton();
            } catch (error) {
                console.error('Ошибка при выборе спрайтов:', error);
                Editor.Dialog.error(`Ошибка при выборе спрайтов: ${error}`);
            }
        },

        // Выбор исходных атласов
        async selectSourceAtlases() {
            try {
                console.log('Выбор исходных атласов...');
                const result = await Editor.Dialog.select({
                    title: 'Выберите атласы (plist файлы)',
                    type: 'file',
                    filters: [
                        { name: 'Plist', extensions: ['plist'] }
                    ],
                    multi: true,
                });

                console.log('Результат выбора атласов:', result);

                if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
                    console.log('Выбор отменен или файлы не выбраны');
                    return;
                }

                console.log(`Выбрано файлов: ${result.filePaths.length}`);

                for (const filePath of result.filePaths) {
                    const path = require('path');
                    const fileName = path.basename(filePath);
                    const nameWithoutExt = fileName.replace(/\.plist$/, '');
                    
                    console.log(`Обработка атласа: ${fileName} -> ${nameWithoutExt}`);
                    
                    // Проверяем, не добавлен ли уже
                    if (!panelState.sourceItems.find(item => item.path === filePath)) {
                        panelState.sourceItems.push({
                            path: filePath,
                            name: nameWithoutExt,
                            type: 'atlas'
                        });
                        console.log(`Добавлен атлас: ${nameWithoutExt}`);
                    } else {
                        console.log(`Атлас уже добавлен: ${nameWithoutExt}`);
                    }
                }

                console.log(`Всего исходных элементов: ${panelState.sourceItems.length}`);
                this.updateSourceItemsList();
                this.updateReplaceButton();
            } catch (error) {
                console.error('Ошибка при выборе атласов:', error);
                Editor.Dialog.error(`Ошибка при выборе атласов: ${error}`);
            }
        },

        // Выбор целевых атласов
        async selectTargetAtlases() {
            try {
                console.log('Выбор целевых атласов...');
                const result = await Editor.Dialog.select({
                    title: 'Выберите целевые атласы (plist файлы)',
                    type: 'file',
                    filters: [
                        { name: 'Plist', extensions: ['plist'] }
                    ],
                    multi: true,
                });

                console.log('Результат выбора целевых атласов:', result);

                if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
                    console.log('Выбор отменен или файлы не выбраны');
                    return;
                }

                console.log(`Выбрано файлов: ${result.filePaths.length}`);

                for (const filePath of result.filePaths) {
                    const path = require('path');
                    const fileName = path.basename(filePath);
                    const nameWithoutExt = fileName.replace(/\.plist$/, '');
                    
                    console.log(`Обработка целевого атласа: ${fileName} -> ${nameWithoutExt}`);
                    
                    // Получаем UUID атласа
                    const atlasUuid = await this.getAtlasUuid(filePath);
                    if (!atlasUuid) {
                        console.warn(`Не удалось получить UUID для атласа: ${filePath}`);
                        Editor.Dialog.warn(`Не удалось получить UUID для атласа: ${fileName}. Убедитесь, что файл .meta существует.`);
                        continue;
                    }

                    console.log(`UUID атласа ${nameWithoutExt}: ${atlasUuid}`);

                    // Проверяем, не добавлен ли уже
                    if (!panelState.targetItems.find(item => item.path === filePath && item.type === 'atlas')) {
                        panelState.targetItems.push({
                            path: filePath,
                            name: nameWithoutExt,
                            type: 'atlas',
                            uuid: atlasUuid
                        });
                        console.log(`Добавлен целевой атлас: ${nameWithoutExt}`);
                    } else {
                        console.log(`Целевой атлас уже добавлен: ${nameWithoutExt}`);
                    }
                }

                console.log(`Всего целевых элементов: ${panelState.targetItems.length}`);
                this.updateTargetItemsList();
                this.updateReplaceButton();
            } catch (error) {
                console.error('Ошибка при выборе целевых атласов:', error);
                Editor.Dialog.error(`Ошибка при выборе целевых атласов: ${error}`);
            }
        },

        // Обновление списка исходных элементов
        updateSourceItemsList() {
            const list = this.$.sourceItemsList as HTMLElement;
            const self = this;

            if (panelState.sourceItems.length === 0) {
                list.innerHTML = '<p class="empty-message">Спрайты/атласы не выбраны</p>';
                return;
            }

            list.innerHTML = '';
            panelState.sourceItems.forEach((item, index) => {
                const itemEl = document.createElement('div');
                itemEl.className = 'selected-item';
                itemEl.innerHTML = `
                    <span class="selected-item-name">${item.name}</span>
                    <span class="selected-item-type">${item.type === 'sprite' ? 'Спрайт' : 'Атлас'}</span>
                    <button class="selected-item-remove" data-index="${index}">×</button>
                `;
                list.appendChild(itemEl);
            });

            // Обработчики удаления
            list.querySelectorAll('.selected-item-remove').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const index = parseInt((e.target as HTMLElement).dataset.index || '0');
                    panelState.sourceItems.splice(index, 1);
                    self.updateSourceItemsList();
                    self.updateReplaceButton();
                });
            });
        },

        // Обновление списка целевых элементов
        updateTargetItemsList() {
            const list = this.$.targetItemsList as HTMLElement;
            const self = this;

            if (panelState.targetItems.length === 0) {
                list.innerHTML = '<p class="empty-message">Спрайты/атласы не выбраны</p>';
                return;
            }

            list.innerHTML = '';
            panelState.targetItems.forEach((item, index) => {
                const itemEl = document.createElement('div');
                itemEl.className = 'selected-item';
                itemEl.innerHTML = `
                    <span class="selected-item-name">${item.name}</span>
                    <span class="selected-item-type">${item.type === 'sprite' ? 'Спрайт' : 'Атлас'}</span>
                    <button class="selected-item-remove" data-index="${index}">×</button>
                `;
                list.appendChild(itemEl);
            });

            // Обработчики удаления
            list.querySelectorAll('.selected-item-remove').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const index = parseInt((e.target as HTMLElement).dataset.index || '0');
                    panelState.targetItems.splice(index, 1);
                    self.updateTargetItemsList();
                    self.updateReplaceButton();
                });
            });
        },

        // Обновление кнопки замены
        updateReplaceButton() {
            const btn = this.$.replaceReferencesBtn as HTMLButtonElement;
            if (!btn) {
                console.warn('Кнопка замены ссылок не найдена');
                return;
            }
            btn.disabled = panelState.sourceItems.length === 0 || panelState.targetItems.length === 0;
        },

        // Очистка всех данных заменителя ссылок
        clearReplacerAll() {
            panelState.sourceItems = [];
            panelState.targetItems = [];
            
            this.updateSourceItemsList();
            this.updateTargetItemsList();
            this.updateReplaceButton();
            
            const infoEl = this.$.replacerInfo as HTMLElement;
            if (infoEl) {
                infoEl.textContent = '';
                infoEl.className = 'replacer-info';
                infoEl.style.display = 'none'; // Скрываем элемент при очистке
            }
        },

        // Замена ссылок на основе имен спрайтов
        async replaceReferencesByNames() {
            const infoEl = this.$.replacerInfo as HTMLElement;
            if (!infoEl) {
                console.error('Элемент replacerInfo не найден!');
                Editor.Dialog.error('Ошибка: элемент отображения информации не найден');
                return;
            }
            
            infoEl.textContent = 'Начинаем замену ссылок...';
            infoEl.className = 'replacer-info';
            infoEl.style.display = 'flex'; // Убеждаемся, что элемент виден

            try {
                // Собираем карту: имя спрайта -> UUID спрайтфрейма (из исходных элементов)
                const spriteNameToSourceUuidMap = new Map<string, string>();

                for (const sourceItem of panelState.sourceItems) {
                    if (sourceItem.type === 'sprite') {
                        // Для спрайта ищем UUID спрайтфрейма из .meta файла
                        let uuid: string | null = null;
                        
                        if (sourceItem.path && existsSync(sourceItem.path)) {
                            // Если есть путь к файлу, читаем .meta рядом с ним
                            uuid = await this.findSpriteUuidByFilePath(sourceItem.path);
                        } else {
                            // Если пути нет, пытаемся найти по имени в проекте
                            uuid = await this.findSpriteUuidByFileName(`${sourceItem.name}.png`);
                        }
                        
                        if (uuid) {
                            spriteNameToSourceUuidMap.set(sourceItem.name, uuid);
                            console.log(`Найден UUID для исходного спрайта ${sourceItem.name}: ${uuid}`);
                        } else {
                            console.warn(`Не удалось найти UUID для исходного спрайта ${sourceItem.name}`);
                        }
                    } else if (sourceItem.type === 'atlas') {
                        // Для атласа получаем UUID атласа и имена спрайтов
                        const atlasUuid = await this.getAtlasUuid(sourceItem.path);
                        if (atlasUuid) {
                            const spriteNameToIdMap = await this.getSpriteNameToIdMap(sourceItem.path, atlasUuid);
                            for (const [spriteName, spriteId] of spriteNameToIdMap.entries()) {
                                const spriteFrameUuid = `${atlasUuid}@${spriteId}`;
                                spriteNameToSourceUuidMap.set(spriteName, spriteFrameUuid);
                            }
                        }
                    }
                }

                if (spriteNameToSourceUuidMap.size === 0) {
                    const errorMessage = 'Не найдено UUID для исходных спрайтов.';
                    infoEl.textContent = errorMessage;
                    infoEl.className = 'replacer-info error';
                    infoEl.style.display = 'flex';
                    console.error(`❌ ${errorMessage}`);
                    Editor.Dialog.warn(errorMessage, { buttons: ['OK'] });
                    return;
                }

                console.log(`Найдено ${spriteNameToSourceUuidMap.size} исходных спрайтов для замены`);

                // Создаем карту: имя спрайта -> целевой UUID (спрайт или спрайт из атласа)
                const spriteNameToTargetUuidMap = new Map<string, string>();

                for (const targetItem of panelState.targetItems) {
                    if (targetItem.type === 'sprite') {
                        // Для целевого спрайта - просто используем его UUID
                        // Ищем по имени
                        if (spriteNameToSourceUuidMap.has(targetItem.name)) {
                            spriteNameToTargetUuidMap.set(targetItem.name, targetItem.uuid);
                        }
                    } else if (targetItem.type === 'atlas') {
                        // Для целевого атласа - получаем спрайты из него
                        const spriteNameToIdMap = await this.getSpriteNameToIdMap(targetItem.path, targetItem.uuid);
                        for (const [spriteName, spriteId] of spriteNameToIdMap.entries()) {
                            // Проверяем, есть ли этот спрайт в исходных
                            if (spriteNameToSourceUuidMap.has(spriteName)) {
                                const targetUuid = `${targetItem.uuid}@${spriteId}`;
                                spriteNameToTargetUuidMap.set(spriteName, targetUuid);
                            }
                        }
                    }
                }

                if (spriteNameToTargetUuidMap.size === 0) {
                    const errorMessage = 'Не найдено соответствий имен спрайтов между исходными и целевыми элементами.';
                    infoEl.textContent = errorMessage;
                    infoEl.className = 'replacer-info error';
                    infoEl.style.display = 'flex';
                    console.error(`❌ ${errorMessage}`);
                    Editor.Dialog.warn(
                        `${errorMessage}\n\n` +
                        `Исходных спрайтов: ${spriteNameToSourceUuidMap.size}\n` +
                        `Убедитесь, что имена спрайтов совпадают.`,
                        { buttons: ['OK'] }
                    );
                    return;
                }

                console.log(`Найдено ${spriteNameToTargetUuidMap.size} соответствий для замены`);

                // Создаем карту: исходный UUID -> целевой UUID
                const sourceUuidToTargetUuidMap = new Map<string, string>();
                for (const [spriteName, sourceUuid] of spriteNameToSourceUuidMap.entries()) {
                    const targetUuid = spriteNameToTargetUuidMap.get(spriteName);
                    if (targetUuid) {
                        sourceUuidToTargetUuidMap.set(sourceUuid, targetUuid);
                    }
                }

                // Находим все префабы и сцены
                const files = await this.findAllPrefabsAndScenes();
                console.log(`Найдено ${files.length} файлов для проверки`);

                let totalReplacements = 0;
                let filesWithReplacements = 0;

                // Заменяем ссылки в каждом файле
                for (const filePath of files) {
                    const replacements = await this.replaceSpriteReferencesByUuidMap(
                        filePath,
                        sourceUuidToTargetUuidMap
                    );
                    if (replacements > 0) {
                        totalReplacements += replacements;
                        filesWithReplacements++;
                        console.log(`Заменено ${replacements} ссылок в ${filePath}`);
                    }
                }

                if (totalReplacements > 0) {
                    const successMessage = `Успешно! Заменено ${totalReplacements} ссылок в ${filesWithReplacements} файлах.`;
                    infoEl.textContent = successMessage;
                    infoEl.className = 'replacer-info success';
                    infoEl.style.display = 'flex';
                    
                    console.log(`✅ ${successMessage}`);
                    
                    // Показываем диалог с результатами
                    Editor.Dialog.info(
                        `✅ Замена ссылок завершена успешно!\n\n` +
                        `📊 Статистика:\n` +
                        `   • Заменено ссылок: ${totalReplacements}\n` +
                        `   • Обработано файлов: ${filesWithReplacements}\n` +
                        `   • Всего проверено файлов: ${files.length}`,
                        {
                            buttons: ['OK'],
                            default: 0
                        }
                    );
                } else {
                    const noResultsMessage = 'Ссылки на спрайты не найдены для замены.';
                    infoEl.textContent = noResultsMessage;
                    infoEl.className = 'replacer-info';
                    infoEl.style.display = 'flex';
                    
                    console.log(`ℹ️ ${noResultsMessage}`);
                    console.log(`   Проверено файлов: ${files.length}`);
                    console.log(`   Исходных спрайтов: ${spriteNameToSourceUuidMap.size}`);
                    console.log(`   Целевых спрайтов: ${spriteNameToTargetUuidMap.size}`);
                    
                    // Показываем информационное сообщение
                    Editor.Dialog.info(
                        `ℹ️ Ссылки не найдены\n\n` +
                        `Проверено файлов: ${files.length}\n` +
                        `Исходных спрайтов: ${spriteNameToSourceUuidMap.size}\n` +
                        `Целевых спрайтов: ${spriteNameToTargetUuidMap.size}\n\n` +
                        `Возможно, в проекте нет ссылок на указанные спрайты.`,
                        {
                            buttons: ['OK'],
                            default: 0
                        }
                    );
                }
            } catch (error: any) {
                const errorMessage = error?.message || error || 'Неизвестная ошибка';
                console.error('❌ Ошибка при замене ссылок:', error);
                
                if (infoEl) {
                    infoEl.textContent = `Ошибка: ${errorMessage}`;
                    infoEl.className = 'replacer-info error';
                    infoEl.style.display = 'flex';
                }
                
                Editor.Dialog.error(
                    `❌ Ошибка при замене ссылок\n\n${errorMessage}`,
                    { buttons: ['OK'] }
                );
            }
        },

        // Получение имен спрайтов из атласа
        async getSpriteNamesFromAtlas(plistPath: string): Promise<string[]> {
            try {
                if (!existsSync(plistPath)) return [];

                const plistContent = readFileSync(plistPath, 'utf-8');
                const spriteNames: string[] = [];

                // Парсим plist (XML формат)
                const keyMatches = plistContent.matchAll(/<key>([^<]+)<\/key>/g);
                for (const match of keyMatches) {
                    const key = match[1];
                    // Проверяем, что это имя спрайта (не метаданные)
                    if (key !== 'frames' && key !== 'metadata' && key !== 'format' && 
                        key !== 'pixelFormat' && key !== 'premultiplyAlpha' && 
                        key !== 'realTextureFileName' && key !== 'size' && 
                        key !== 'smartupdate' && key !== 'textureFileName') {
                        spriteNames.push(key);
                    }
                }

                return spriteNames;
            } catch (error) {
                console.error(`Ошибка при чтении атласа ${plistPath}:`, error);
                return [];
            }
        },

        // Получение карты имя -> ID из атласа
        async getSpriteNameToIdMap(plistPath: string, atlasUuid: string): Promise<Map<string, string>> {
            const map = new Map<string, string>();

            try {
                const metaPath = `${plistPath}.meta`;
                if (!existsSync(metaPath)) {
                    console.warn(`.meta файл не найден: ${metaPath}`);
                    return map;
                }

                const atlasMeta = JSON.parse(readFileSync(metaPath, 'utf-8'));
                if (atlasMeta.subMetas) {
                    for (const key in atlasMeta.subMetas) {
                        const subMeta = atlasMeta.subMetas[key];
                        if (subMeta.name) {
                            map.set(subMeta.name, key);
                        }
                    }
                }
            } catch (error) {
                console.error(`Ошибка при чтении .meta файла ${plistPath}:`, error);
            }

            return map;
        },

        // Замена ссылок на спрайты в файле по карте UUID
        async replaceSpriteReferencesByUuidMap(
            filePath: string,
            sourceUuidToTargetUuidMap: Map<string, string>
        ): Promise<number> {
            try {
                let content = readFileSync(filePath, 'utf-8');
                let replacements = 0;

                // Для каждого исходного UUID
                for (const [sourceUuid, targetUuid] of sourceUuidToTargetUuidMap.entries()) {
                    // Экранируем специальные символы для regex
                    const escapedSourceUuid = sourceUuid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    
                    // Ищем все вхождения этого UUID (может быть с @id или без)
                    const uuidPattern = new RegExp(`"__uuid__"\\s*:\\s*"${escapedSourceUuid}"`, 'g');
                    
                    const matches = content.match(uuidPattern);
                    if (matches && matches.length > 0) {
                        content = content.replace(uuidPattern, `"__uuid__": "${targetUuid}"`);
                        replacements += matches.length;
                        console.log(`  Заменяем ${sourceUuid} -> ${targetUuid}`);
                    }
                }

                if (replacements > 0) {
                    writeFileSync(filePath, content, 'utf-8');
                }

                return replacements;
            } catch (error) {
                console.error(`Ошибка при замене ссылок в ${filePath}:`, error);
                return 0;
            }
        },

        // ========== Optimizer Methods ==========

        // Поиск всех PNG файлов в проекте
        async findAllPngFiles(): Promise<string[]> {
            try {
                let projectPath: string | undefined;
                try {
                    projectPath = Editor.Project.path;
                } catch (e) {
                    projectPath = join(__dirname, '../../../../../');
                }
                if (!projectPath) return [];

                const assetsPath = join(projectPath, 'assets');
                const { readdirSync, statSync } = require('fs');
                const files: string[] = [];

                function scanDirectory(dir: string) {
                    try {
                        const items = readdirSync(dir);
                        for (const item of items) {
                            const fullPath = join(dir, item);
                            const stat = statSync(fullPath);
                            
                            if (stat.isDirectory() && !item.startsWith('.')) {
                                scanDirectory(fullPath);
                            } else if (stat.isFile() && item.toLowerCase().endsWith('.png')) {
                                files.push(fullPath);
                            }
                        }
                    } catch (e) {
                        // Игнорируем ошибки доступа
                    }
                }

                scanDirectory(assetsPath);
                return files;
            } catch (error) {
                console.error('Ошибка при поиске PNG файлов:', error);
                return [];
            }
        },

        // Обработка файлов оптимизатора
        async handleOptimizerFiles(files: FileList) {
            const pngFiles = Array.from(files).filter(f => 
                f.type === 'image/png' || f.name.toLowerCase().endsWith('.png')
            );

            for (const file of pngFiles) {
                const filePath = (file as any).path || file.name;
                const name = file.name;
                
                if (!panelState.optimizerFiles.find(item => item.path === filePath)) {
                    panelState.optimizerFiles.push({
                        path: filePath,
                        name: name
                    });
                }
            }

            this.updateOptimizerItemsList();
            this.updateOptimizeButton();
        },

        // Обновление списка файлов оптимизатора
        updateOptimizerItemsList() {
            const list = this.$.optimizerItemsList as HTMLElement;
            const self = this;

            if (panelState.optimizerFiles.length === 0) {
                list.innerHTML = '<p class="empty-message">Изображения не выбраны</p>';
                return;
            }

            list.innerHTML = '';
            panelState.optimizerFiles.forEach((item, index) => {
                const itemEl = document.createElement('div');
                itemEl.className = 'selected-item';
                itemEl.innerHTML = `
                    <span class="selected-item-name">${item.name}</span>
                    <button class="selected-item-remove" data-index="${index}">×</button>
                `;
                list.appendChild(itemEl);
            });

            // Обработчики удаления
            list.querySelectorAll('.selected-item-remove').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const index = parseInt((e.target as HTMLElement).dataset.index || '0');
                    panelState.optimizerFiles.splice(index, 1);
                    self.updateOptimizerItemsList();
                    self.updateOptimizeButton();
                });
            });
        },

        // Обновление кнопки оптимизации
        updateOptimizeButton() {
            const optimizeAll = (this.$.optimizeAllPng as HTMLInputElement).checked;
            const hasFiles = panelState.optimizerFiles.length > 0;
            (this.$.optimizeBtn as HTMLButtonElement).disabled = !optimizeAll && !hasFiles;
        },

        // Оптимизация файлов
        async optimizeFiles() {
            const optimizeAll = (this.$.optimizeAllPng as HTMLInputElement).checked;
            let filesToOptimize: string[] = [];

            if (optimizeAll) {
                // Ищем все PNG файлы в проекте
                const infoEl = this.$.optimizerInfo as HTMLElement;
                infoEl.innerHTML = '<p>Поиск PNG файлов в проекте...</p>';
                
                filesToOptimize = await this.findAllPngFiles();
                
                if (filesToOptimize.length === 0) {
                    infoEl.innerHTML = '<p style="color: var(--accent-warning);">PNG файлы не найдены в проекте</p>';
                    return;
                }
            } else {
                // Используем выбранные файлы
                filesToOptimize = panelState.optimizerFiles.map(f => f.path);
                
                if (filesToOptimize.length === 0) {
                    Editor.Dialog.warn('Выберите файлы для оптимизации или включите опцию "Оптимизировать все PNG в проекте"');
                    return;
                }
            }

            // Сбрасываем статистику
            panelState.optimizerStats = {
                processed: 0,
                totalOriginalSize: 0,
                totalCompressedSize: 0,
            };
            panelState.optimizerErrors = [];

            // Показываем прогресс
            (this.$.optimizerProgress as HTMLElement).style.display = 'block';
            (this.$.optimizerStats as HTMLElement).style.display = 'none';
            (this.$.progressFill as HTMLElement).style.width = '0%';
            (this.$.progressText as HTMLElement).textContent = '0%';

            const totalFiles = filesToOptimize.length;
            let processed = 0;
            let successCount = 0;
            let errorCount = 0;

            // Оптимизируем каждый файл
            for (let i = 0; i < filesToOptimize.length; i++) {
                const filePath = filesToOptimize[i];
                
                try {
                    // Читаем файл
                    if (!existsSync(filePath)) {
                        const fileName = filePath.split(/[/\\]/).pop() || filePath;
                        panelState.optimizerErrors.push({
                            file: fileName,
                            reason: 'Файл не найден'
                        });
                        console.warn(`Файл не найден: ${filePath}`);
                        errorCount++;
                        continue;
                    }

                    const originalBuffer = readFileSync(filePath);
                    const originalSize = originalBuffer.length;

                    // Оптимизируем
                    const compressionResult = await this.compressPngFile(filePath, originalBuffer);
                    
                    if (compressionResult.compressedSize < originalSize) {
                        // Сохраняем оптимизированный файл
                        writeFileSync(filePath, compressionResult.compressed);
                        
                        panelState.optimizerStats.totalOriginalSize += originalSize;
                        panelState.optimizerStats.totalCompressedSize += compressionResult.compressedSize;
                        successCount++;
                    } else {
                        // Файл не стал меньше, оставляем оригинал
                        const fileName = filePath.split(/[/\\]/).pop() || filePath;
                        panelState.optimizerErrors.push({
                            file: fileName,
                            reason: 'Файл не стал меньше после оптимизации (уже оптимален)'
                        });
                        panelState.optimizerStats.totalOriginalSize += originalSize;
                        panelState.optimizerStats.totalCompressedSize += originalSize;
                    }
                } catch (error: any) {
                    const fileName = filePath.split(/[/\\]/).pop() || filePath;
                    const errorMessage = error?.message || 'Неизвестная ошибка';
                    panelState.optimizerErrors.push({
                        file: fileName,
                        reason: errorMessage
                    });
                    console.error(`Ошибка при оптимизации ${filePath}:`, error);
                    errorCount++;
                }

                processed++;
                panelState.optimizerStats.processed = processed;

                // Обновляем прогресс
                const progress = Math.round((processed / totalFiles) * 100);
                (this.$.progressFill as HTMLElement).style.width = `${progress}%`;
                (this.$.progressText as HTMLElement).textContent = `${progress}%`;
            }

            // Скрываем прогресс и показываем статистику
            (this.$.optimizerProgress as HTMLElement).style.display = 'none';
            (this.$.optimizerStats as HTMLElement).style.display = 'block';

            // Обновляем статистику
            const totalSavings = panelState.optimizerStats.totalOriginalSize - panelState.optimizerStats.totalCompressedSize;
            const avgSavingsPercent = panelState.optimizerStats.processed > 0 
                ? ((totalSavings / panelState.optimizerStats.totalOriginalSize) * 100).toFixed(1)
                : '0';

            (this.$.processedCount as HTMLElement).textContent = `${successCount} из ${totalFiles}`;
            (this.$.totalSavings as HTMLElement).textContent = this.formatFileSize(totalSavings);
            (this.$.avgSavings as HTMLElement).textContent = `${avgSavingsPercent}%`;

            // Показываем/скрываем секцию ошибок
            const errorsSection = this.$.optimizerErrorsSection as HTMLElement;
            const errorsList = this.$.optimizerErrorsList as HTMLElement;
            const errorsToggle = this.$.optimizerErrorsToggle as HTMLElement;
            
            if (panelState.optimizerErrors.length > 0) {
                errorsSection.style.display = 'block';
                errorsList.style.display = 'none';
                errorsToggle.classList.remove('active');
                
                // Формируем список ошибок
                const errorsHtml = panelState.optimizerErrors.map(err => `
                    <div class="optimizer-error-item">
                        <div class="optimizer-error-file">${err.file}</div>
                        <div class="optimizer-error-reason">${err.reason}</div>
                    </div>
                `).join('');
                errorsList.innerHTML = errorsHtml;
                
                // Обновляем текст кнопки
                const toggleText = errorsToggle.querySelector('.toggle-text') as HTMLElement;
                if (toggleText) {
                    toggleText.textContent = `Показать причины ошибок (${panelState.optimizerErrors.length})`;
                }
            } else {
                errorsSection.style.display = 'none';
            }

            // Показываем результат
            const infoEl = this.$.optimizerInfo as HTMLElement;
            if (panelState.optimizerErrors.length > 0) {
                infoEl.innerHTML = `<p style="color: var(--accent-warning);">Оптимизация завершена. Обработано ${successCount} из ${totalFiles} файлов</p>`;
            } else {
                infoEl.innerHTML = `<p style="color: var(--accent-secondary);">Оптимизация успешно завершена!</p>`;
            }

            Editor.Dialog.info(
                `Оптимизация завершена!\n\n` +
                `Обработано: ${successCount} из ${totalFiles} файлов\n` +
                `Экономия: ${this.formatFileSize(totalSavings)} (${avgSavingsPercent}%)\n` +
                (errorCount > 0 ? `Ошибок: ${errorCount}` : ''),
                { buttons: ['OK'] }
            );
        },

        // Сжатие PNG файла (отдельная функция для оптимизатора)
        async compressPngFile(filePath: string, inputBuffer: Buffer): Promise<{ compressed: Buffer; originalSize: number; compressedSize: number }> {
            const originalSize = inputBuffer.length;
            
            if (!pngquantPath) {
                console.warn('pngquant не доступен');
                return { compressed: inputBuffer, originalSize, compressedSize: originalSize };
            }

            const quality = parseInt((this.$.optimizerCompressionQuality as HTMLInputElement).value);
            const maxColors = parseInt((this.$.optimizerMaxColors as HTMLSelectElement).value);
            const dithering = (this.$.optimizerEnableDithering as HTMLInputElement).checked;

            // Создаём временные файлы
            const os = require('os');
            const tempDir = os.tmpdir();
            const tempInput = join(tempDir, `pngquant_input_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.png`);
            const tempOutput = join(tempDir, `pngquant_output_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.png`);

            try {
                // Записываем входной файл
                writeFileSync(tempInput, inputBuffer);

                // Формируем аргументы pngquant
                const args: string[] = [
                    maxColors.toString(),
                    '--quality', `0-${quality}`,
                    '--speed', '1',
                    '--output', tempOutput,
                    '--force',
                    '--skip-if-larger',
                ];

                if (!dithering) {
                    args.push('--nofs');
                }

                args.push('--');
                args.push(tempInput);

                // Запускаем pngquant
                try {
                    await execFileAsync(pngquantPath, args);
                } catch (execError: any) {
                    // pngquant может вернуть код 98 если результат больше оригинала
                    if (!existsSync(tempOutput)) {
                        if (existsSync(tempInput)) unlinkSync(tempInput);
                        return { compressed: inputBuffer, originalSize, compressedSize: originalSize };
                    }
                }

                // Читаем результат
                if (existsSync(tempOutput)) {
                    const compressedBuffer = readFileSync(tempOutput);
                    const compressedSize = compressedBuffer.length;

                    // Удаляем временные файлы
                    if (existsSync(tempInput)) unlinkSync(tempInput);
                    if (existsSync(tempOutput)) unlinkSync(tempOutput);

                    return { compressed: compressedBuffer, originalSize, compressedSize };
                }
            } catch (error: any) {
                console.error('Ошибка сжатия pngquant:', error);
            }

            // Очистка в случае ошибки
            try {
                if (existsSync(tempInput)) unlinkSync(tempInput);
                if (existsSync(tempOutput)) unlinkSync(tempOutput);
            } catch (e) {}

            return { compressed: inputBuffer, originalSize, compressedSize: originalSize };
        },

        // Очистка оптимизатора
        clearOptimizer() {
            panelState.optimizerFiles = [];
            panelState.optimizerStats = {
                processed: 0,
                totalOriginalSize: 0,
                totalCompressedSize: 0,
            };
            panelState.optimizerErrors = [];
            this.updateOptimizerItemsList();
            this.updateOptimizeButton();
            (this.$.optimizerInfo as HTMLElement).innerHTML = '<p>Выберите изображения и нажмите "Оптимизировать"</p>';
            (this.$.optimizerProgress as HTMLElement).style.display = 'none';
            (this.$.optimizerStats as HTMLElement).style.display = 'none';
        },

        // Проверка наличия обновления атлас крейтора
        checkForAtlasCreatorUpdate() {
            try {
                let projectPath: string | undefined;
                try {
                    projectPath = Editor.Project.path;
                } catch (e) {
                    // Если Editor.Project.path недоступен, пробуем альтернативный способ
                    projectPath = join(__dirname, '../../../../../');
                }
                
                if (!projectPath) {
                    console.warn('Не удалось определить путь к проекту');
                    return;
                }

                const updateManager = new UpdateManager(projectPath);
                const updateInfo = updateManager.checkForUpdate();

                console.log('Проверка обновлений атлас крейтора:', {
                    currentVersion: updateInfo.currentVersion,
                    latestVersion: updateInfo.latestVersion,
                    hasUpdate: updateInfo.hasUpdate
                });

                if (updateInfo.hasUpdate && updateInfo.latestVersion) {
                    // Показываем кнопку обновления
                    const updateButton = this.$.updateAtlasCreatorButton as HTMLButtonElement;
                    if (updateButton) {
                        updateButton.classList.remove('hidden');
                        updateButton.title = `Обновить атлас крейтор с ${updateInfo.currentVersion} до ${updateInfo.latestVersion}`;
                        console.log(`🔄 Доступно обновление атлас крейтора: ${updateInfo.currentVersion} → ${updateInfo.latestVersion}`);
                    } else {
                        console.warn('Кнопка обновления не найдена в DOM');
                    }
                } else {
                    // Скрываем кнопку обновления
                    const updateButton = this.$.updateAtlasCreatorButton as HTMLButtonElement;
                    if (updateButton) {
                        updateButton.classList.add('hidden');
                    }
                    // Логируем, если версии найдены, но обновления нет
                    if (updateInfo.currentVersion && updateInfo.latestVersion) {
                        console.log(`Атлас крейтор актуален: ${updateInfo.currentVersion} (последняя версия: ${updateInfo.latestVersion})`);
                    } else {
                        console.warn('Не удалось определить версии:', {
                            currentVersion: updateInfo.currentVersion,
                            latestVersion: updateInfo.latestVersion
                        });
                    }
                }
            } catch (error) {
                console.error('Ошибка при проверке обновлений атлас крейтора:', error);
            }
        },

        // Обновление атлас крейтора
        async updateAtlasCreator() {
            const updateButton = this.$.updateAtlasCreatorButton as HTMLButtonElement;
            if (!updateButton) return;

            // Блокируем кнопку и показываем индикатор загрузки
            updateButton.disabled = true;
            updateButton.textContent = '⏳ Обновление...';

            try {
                let projectPath: string | undefined;
                try {
                    projectPath = Editor.Project.path;
                } catch (e) {
                    // Если Editor.Project.path недоступен, пробуем альтернативный способ
                    projectPath = join(__dirname, '../../../../../');
                }

                if (!projectPath) {
                    throw new Error('Не удалось определить путь к проекту');
                }

                const updateManager = new UpdateManager(projectPath);

                console.log('🔄 Начинаю обновление атлас крейтора...');

                const result = await updateManager.updateAtlasCreator();

                if (result.success) {
                    console.log('✅ Атлас крейтор успешно обновлен!');
                    updateButton.textContent = '✅ Обновлено';
                    updateButton.disabled = true;

                    // Показываем поп-ап с предупреждением о необходимости перезапуска
                    Editor.Dialog.info(
                        '✅ Атлас крейтор успешно обновлен!\n\n' +
                        '⚠️ Пожалуйста, закройте и перезапустите панель для применения изменений.',
                        {
                            buttons: ['OK'],
                            default: 0
                        }
                    );

                    // Скрываем кнопку через некоторое время
                    setTimeout(() => {
                        updateButton.classList.add('hidden');
                    }, 3000);
                } else {
                    console.error(`❌ Ошибка при обновлении атлас крейтора: ${result.error}`);
                    alert(`❌ Ошибка при обновлении атлас крейтора: ${result.error}`);
                    updateButton.textContent = '🔄 Обновить';
                    updateButton.disabled = false;
                }
            } catch (error: any) {
                console.error(`❌ Ошибка при обновлении атлас крейтора: ${error.message || error}`);
                alert(`❌ Ошибка при обновлении атлас крейтора: ${error.message || error}`);
                updateButton.textContent = '🔄 Обновить';
                updateButton.disabled = false;
            }
        },
    },

    ready() {
        const self = this;
        
        // Обработчики для выбора файлов через диалог
        const dropZone = this.$.dropZone as HTMLElement;
        const fileInput = this.$.fileInput as HTMLInputElement;
        
        if (dropZone && fileInput) {
            // Клик по drop zone или file input открывает диалог выбора файлов
            const openFileDialog = async () => {
                try {
                    const result = await Editor.Dialog.select({
                        title: 'Выберите изображения',
                        type: 'file',
                        filters: [
                            { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }
                        ],
                        multi: true,
                    });
                    
                    if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
                        await self.handleFilesFromPaths(result.filePaths);
                    }
                } catch (error) {
                    console.error('Ошибка при выборе файлов:', error);
                }
            };
            
            fileInput.addEventListener('click', async (e) => {
                e.preventDefault();
                await openFileDialog();
            });
            
            dropZone.addEventListener('click', async (e) => {
                const target = e.target as HTMLElement;
                if (target.tagName === 'LABEL' || target.tagName === 'INPUT' || target.closest('label')) {
                    return;
                }
                e.preventDefault();
                await openFileDialog();
            });
        }

        // Обработчики для выбора атласов через диалог
        const atlasDropZone = this.$.atlasDropZone as HTMLElement;
        const atlasInput = this.$.atlasInput as HTMLInputElement;
        
        if (atlasDropZone && atlasInput) {
            const openAtlasDialog = async () => {
                try {
                    const result = await Editor.Dialog.select({
                        title: 'Выберите атласы (plist файлы)',
                        type: 'file',
                        filters: [
                            { name: 'Plist', extensions: ['plist'] }
                        ],
                        multi: true,
                    });
                    
                    if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
                        await self.handleAtlasFilesFromPaths(result.filePaths);
                    }
                } catch (error) {
                    console.error('Ошибка при выборе атласов:', error);
                }
            };
            
            atlasInput.addEventListener('click', async (e) => {
                e.preventDefault();
                await openAtlasDialog();
            });
            
            atlasDropZone.addEventListener('click', async (e) => {
                const target = e.target as HTMLElement;
                if (target.tagName === 'LABEL' || target.tagName === 'INPUT' || target.closest('label')) {
                    return;
                }
                e.preventDefault();
                await openAtlasDialog();
            });
        }
        
        // Button handlers
        const packBtn = this.$.packBtn as HTMLButtonElement;
        if (packBtn) {
            packBtn.addEventListener('click', () => {
                self.packSprites();
            });
        }
        
        const clearBtn = this.$.clearBtn as HTMLButtonElement;
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                self.clearAll();
            });
        }
        
        const exportPngBtn = this.$.exportPngBtn as HTMLButtonElement;
        if (exportPngBtn) {
            exportPngBtn.addEventListener('click', () => {
                self.exportPng();
            });
        }
        
        const exportPlistBtn = this.$.exportPlistBtn as HTMLButtonElement;
        if (exportPlistBtn) {
            exportPlistBtn.addEventListener('click', () => {
                self.exportPlist();
            });
        }
        
        const exportBothBtn = this.$.exportBothBtn as HTMLButtonElement;
        if (exportBothBtn) {
            exportBothBtn.addEventListener('click', () => {
                self.exportBoth();
            });
        }
        
        // Compression UI handlers
        const compressionCheckbox = this.$.enableCompression as HTMLInputElement;
        const compressionOptions = this.$.compressionOptions as HTMLElement;
        const qualitySlider = this.$.compressionQuality as HTMLInputElement;
        const qualityValue = this.$.qualityValue as HTMLElement;
        
        // Toggle compression options visibility
        compressionCheckbox.addEventListener('change', () => {
            if (compressionCheckbox.checked) {
                compressionOptions.classList.add('visible');
            } else {
                compressionOptions.classList.remove('visible');
            }
            // Обновить предпросмотр размера
            if (panelState.atlasCanvas) {
                self.updatePreviewFileSize();
            }
        });
        
        // Quality slider
        qualitySlider.addEventListener('input', () => {
            qualityValue.textContent = qualitySlider.value;
        });
        
        qualitySlider.addEventListener('change', () => {
            // Обновить предпросмотр размера при изменении качества
            if (panelState.atlasCanvas && compressionCheckbox.checked) {
                self.updatePreviewFileSize();
            }
        });
        
        // Max colors change
        (this.$.maxColors as HTMLSelectElement).addEventListener('change', () => {
            if (panelState.atlasCanvas && compressionCheckbox.checked) {
                self.updatePreviewFileSize();
            }
        });
        
        // Dithering change
        (this.$.enableDithering as HTMLInputElement).addEventListener('change', () => {
            if (panelState.atlasCanvas && compressionCheckbox.checked) {
                self.updatePreviewFileSize();
            }
        });
        
        // Проверяем доступность pngquant
        if (!pngquantPath) {
            compressionCheckbox.disabled = true;
            (compressionCheckbox.parentElement as HTMLElement).title = 'pngquant не установлен. Запустите npm install.';
            (compressionCheckbox.parentElement as HTMLElement).style.opacity = '0.5';
        }

        // ========== Reference Replacer Handlers ==========
        
        // Обработчики переключения табов
        // Используем делегирование событий для надежности
        const tabsContainer = this.$.tabsContainer as HTMLElement;
        if (tabsContainer) {
            tabsContainer.addEventListener('click', (e) => {
                const target = e.target as HTMLElement;
                const tabBtn = target.closest('.tab-btn') as HTMLElement;
                if (tabBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    const tabName = tabBtn.getAttribute('data-tab');
                    console.log('Клик по табу:', tabName);
                    if (tabName) {
                        self.switchTab(tabName);
                    }
                }
            });
            console.log('Обработчик табов установлен');
        } else {
            // Fallback: используем document если this.$ не работает
            setTimeout(() => {
                const container = document.querySelector('.tabs-container');
                if (container) {
                    container.addEventListener('click', (e) => {
                        const target = e.target as HTMLElement;
                        const tabBtn = target.closest('.tab-btn') as HTMLElement;
                        if (tabBtn) {
                            e.preventDefault();
                            e.stopPropagation();
                            const tabName = tabBtn.getAttribute('data-tab');
                            console.log('Клик по табу (fallback):', tabName);
                            if (tabName) {
                                self.switchTab(tabName);
                            }
                        }
                    });
                    console.log('Обработчик табов установлен (fallback)');
                } else {
                    console.error('Контейнер табов не найден даже в fallback!');
                }
            }, 500);
        }

        // ========== Reference Replacer File Handlers ==========
        
        // Обработчики для исходных спрайтов
        const sourceSpritesDropZone = this.$.sourceSpritesDropZone as HTMLElement;
        const sourceSpritesInput = this.$.sourceSpritesInput as HTMLInputElement;

        const openSourceSpritesDialog = async () => {
            try {
                const result = await Editor.Dialog.select({
                    title: 'Выберите исходные спрайты',
                    type: 'file',
                    filters: [
                        { name: 'Images & Meta', extensions: ['png', 'jpg', 'jpeg', 'meta'] }
                    ],
                    multi: true,
                });
                
                if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
                    await self.handleSourceSpritesFilesFromPaths(result.filePaths);
                }
            } catch (error) {
                console.error('Ошибка при выборе исходных спрайтов:', error);
            }
        };

        if (sourceSpritesDropZone) {
            sourceSpritesDropZone.addEventListener('click', async (e) => {
                const target = e.target as HTMLElement;
                if (target.tagName !== 'LABEL' && target.tagName !== 'INPUT' && !target.closest('label')) {
                    e.preventDefault();
                    await openSourceSpritesDialog();
                }
            });
        }

        if (sourceSpritesInput) {
            sourceSpritesInput.addEventListener('click', async (e) => {
                e.preventDefault();
                await openSourceSpritesDialog();
            });
        }

        // Обработчики для исходных атласов
        const sourceAtlasesDropZone = this.$.sourceAtlasesDropZone as HTMLElement;
        const sourceAtlasesInput = this.$.sourceAtlasesInput as HTMLInputElement;

        const openSourceAtlasesDialog = async () => {
            try {
                const result = await Editor.Dialog.select({
                    title: 'Выберите исходные атласы (plist)',
                    type: 'file',
                    filters: [
                        { name: 'Plist', extensions: ['plist'] }
                    ],
                    multi: true,
                });
                
                if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
                    await self.handleSourceAtlasesFilesFromPaths(result.filePaths);
                }
            } catch (error) {
                console.error('Ошибка при выборе исходных атласов:', error);
            }
        };

        if (sourceAtlasesDropZone) {
            sourceAtlasesDropZone.addEventListener('click', async (e) => {
                const target = e.target as HTMLElement;
                if (target.tagName !== 'LABEL' && target.tagName !== 'INPUT' && !target.closest('label')) {
                    e.preventDefault();
                    await openSourceAtlasesDialog();
                }
            });
        }

        if (sourceAtlasesInput) {
            sourceAtlasesInput.addEventListener('click', async (e) => {
                e.preventDefault();
                await openSourceAtlasesDialog();
            });
        }

        // Обработчики для целевых спрайтов
        const targetSpritesDropZone = this.$.targetSpritesDropZone as HTMLElement;
        const targetSpritesInput = this.$.targetSpritesInput as HTMLInputElement;

        const openTargetSpritesDialog = async () => {
            try {
                const result = await Editor.Dialog.select({
                    title: 'Выберите целевые спрайты',
                    type: 'file',
                    filters: [
                        { name: 'Images & Meta', extensions: ['png', 'jpg', 'jpeg', 'meta'] }
                    ],
                    multi: true,
                });
                
                if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
                    await self.handleTargetSpritesFilesFromPaths(result.filePaths);
                }
            } catch (error) {
                console.error('Ошибка при выборе целевых спрайтов:', error);
            }
        };

        if (targetSpritesDropZone) {
            targetSpritesDropZone.addEventListener('click', async (e) => {
                const target = e.target as HTMLElement;
                if (target.tagName !== 'LABEL' && target.tagName !== 'INPUT' && !target.closest('label')) {
                    e.preventDefault();
                    await openTargetSpritesDialog();
                }
            });
        }

        if (targetSpritesInput) {
            targetSpritesInput.addEventListener('click', async (e) => {
                e.preventDefault();
                await openTargetSpritesDialog();
            });
        }

        // Обработчики для целевых атласов
        const targetAtlasesDropZone = this.$.targetAtlasesDropZone as HTMLElement;
        const targetAtlasesInput = this.$.targetAtlasesInput as HTMLInputElement;

        const openTargetAtlasesDialog = async () => {
            try {
                const result = await Editor.Dialog.select({
                    title: 'Выберите целевые атласы (plist)',
                    type: 'file',
                    filters: [
                        { name: 'Plist', extensions: ['plist'] }
                    ],
                    multi: true,
                });
                
                if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
                    await self.handleTargetAtlasesFilesFromPaths(result.filePaths);
                }
            } catch (error) {
                console.error('Ошибка при выборе целевых атласов:', error);
            }
        };

        if (targetAtlasesDropZone) {
            targetAtlasesDropZone.addEventListener('click', async (e) => {
                const target = e.target as HTMLElement;
                if (target.tagName !== 'LABEL' && target.tagName !== 'INPUT' && !target.closest('label')) {
                    e.preventDefault();
                    await openTargetAtlasesDialog();
                }
            });
        }

        if (targetAtlasesInput) {
            targetAtlasesInput.addEventListener('click', async (e) => {
                e.preventDefault();
                await openTargetAtlasesDialog();
            });
        }

        // Обработчик кнопки замены ссылок
        const replaceReferencesBtn = this.$.replaceReferencesBtn as HTMLButtonElement;
        if (replaceReferencesBtn) {
            replaceReferencesBtn.addEventListener('click', () => {
                self.replaceReferencesByNames();
            });
        } else {
            console.warn('Кнопка замены ссылок не найдена при инициализации');
        }

        // Обработчик кнопки сброса заменителя ссылок
        const clearReplacerBtn = this.$.clearReplacerBtn as HTMLButtonElement;
        if (clearReplacerBtn) {
            clearReplacerBtn.addEventListener('click', () => {
                self.clearReplacerAll();
            });
        } else {
            console.warn('Кнопка сброса заменителя ссылок не найдена при инициализации');
        }
        
        // Инициализируем состояние кнопки замены при загрузке
        this.updateReplaceButton();

        // ========== Optimizer Handlers ==========
        
        // Обработчик галочки "Оптимизировать все"
        const optimizeAllPng = this.$.optimizeAllPng as HTMLInputElement;
        const optimizerFileSelector = this.$.optimizerFileSelector as HTMLElement;
        
        if (optimizeAllPng && optimizerFileSelector) {
            optimizeAllPng.addEventListener('change', () => {
                if (optimizeAllPng.checked) {
                    optimizerFileSelector.style.opacity = '0.5';
                    optimizerFileSelector.style.pointerEvents = 'none';
                } else {
                    optimizerFileSelector.style.opacity = '1';
                    optimizerFileSelector.style.pointerEvents = 'auto';
                }
                self.updateOptimizeButton();
            });
        }

        // Обработчики для оптимизатора
        const optimizerDropZone = this.$.optimizerDropZone as HTMLElement;
        const optimizerFileInput = this.$.optimizerFileInput as HTMLInputElement;

        const openOptimizerDialog = async () => {
            if (optimizeAllPng.checked) return;
            
            try {
                const result = await Editor.Dialog.select({
                    title: 'Выберите PNG файлы для оптимизации',
                    type: 'file',
                    filters: [
                        { name: 'PNG Images', extensions: ['png'] }
                    ],
                    multi: true,
                });
                
                if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
                    // Создаем FileList из путей
                    const files: File[] = [];
                    for (const filePath of result.filePaths) {
                        if (existsSync(filePath)) {
                            const fileData = readFileSync(filePath);
                            const fileName = basename(filePath);
                            files.push(new File([fileData], fileName, { type: 'image/png' }));
                        }
                    }
                    if (files.length > 0) {
                        const fileList = {
                            length: files.length,
                            item: (index: number) => files[index] || null,
                            [Symbol.iterator]: function* () { for (let i = 0; i < files.length; i++) yield files[i]; }
                        } as FileList;
                        await self.handleOptimizerFiles(fileList);
                    }
                }
            } catch (error) {
                console.error('Ошибка при выборе файлов для оптимизации:', error);
            }
        };

        if (optimizerDropZone) {
            optimizerDropZone.addEventListener('click', async (e) => {
                const target = e.target as HTMLElement;
                if (target.tagName !== 'LABEL' && target.tagName !== 'INPUT' && !target.closest('label') && !optimizeAllPng.checked) {
                    e.preventDefault();
                    await openOptimizerDialog();
                }
            });
        }

        if (optimizerFileInput) {
            optimizerFileInput.addEventListener('click', async (e) => {
                if (!optimizeAllPng.checked) {
                    e.preventDefault();
                    await openOptimizerDialog();
                }
            });
        }

        // Обработчик слайдера качества оптимизатора
        const optimizerQualitySlider = this.$.optimizerCompressionQuality as HTMLInputElement;
        const optimizerQualityValue = this.$.optimizerQualityValue as HTMLElement;
        
        optimizerQualitySlider.addEventListener('input', () => {
            optimizerQualityValue.textContent = optimizerQualitySlider.value;
        });

        // Обработчики кнопок оптимизатора
        (this.$.optimizeBtn as HTMLButtonElement).addEventListener('click', () => {
            self.optimizeFiles();
        });

        (this.$.optimizerClearBtn as HTMLButtonElement).addEventListener('click', () => {
            self.clearOptimizer();
        });

        // Обработчик переключения спойлера с ошибками
        const errorsToggle = this.$.optimizerErrorsToggle as HTMLElement;
        const errorsList = this.$.optimizerErrorsList as HTMLElement;
        if (errorsToggle && errorsList) {
            errorsToggle.addEventListener('click', () => {
                const isActive = errorsToggle.classList.contains('active');
                if (isActive) {
                    errorsToggle.classList.remove('active');
                    errorsList.style.display = 'none';
                } else {
                    errorsToggle.classList.add('active');
                    errorsList.style.display = 'block';
                }
            });
        }

        // Установка версии из package.json
        if (this.$.versionDisplay && packageJSON && packageJSON.version) {
            (this.$.versionDisplay as HTMLElement).textContent = packageJSON.version;
        }

        // Проверка обновлений атлас крейтора
        this.checkForAtlasCreatorUpdate();

        // Обработчик кнопки обновления
        if (this.$.updateAtlasCreatorButton) {
            (this.$.updateAtlasCreatorButton as HTMLButtonElement).addEventListener('click', () => {
                this.updateAtlasCreator();
            });
        }
        
        console.log('Spritesheet Creator ready!');
        console.log('pngquant path:', pngquantPath || 'не найден');
    },
    
    beforeClose() {},
    close() {},
});
