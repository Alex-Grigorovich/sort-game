/**
 * ProgressManager - управление прогрессом сборки
 * Отвечает за отслеживание и отображение прогресса всех этапов сборки
 */

export interface ProgressData {
    percentage: number;
    currentTask: string;
    eta: number;
}

export interface SftpProgressData {
    current: number;
    total: number;
    percentage: number;
    eta: number;
    currentTask: string;
}

export interface SftpCleanInfo {
    path: string;
    totalItems: number;
    items: Array<{
        type: string;
        name: string;
        path: string;
        size?: string;
        permissions?: string;
        modifyTime?: string;
    }>;
}

export interface StageTiming {
    start: Date;
    end?: Date;
    duration?: number;
}

export interface StageTimings {
    mainBuild?: StageTiming;
    superHtmlBuild?: StageTiming;
    sftpLoad?: StageTiming;
}

export interface BuiltFileInfo {
    versionName: string;
    langCode: string;
    buildTime: number;
    sizeKB: number;
    fileName?: string;
}

export class ProgressManager {
    private mainBuildProgress: ProgressData = { percentage: 0, currentTask: '', eta: 0 };
    private superHtmlProgress: ProgressData = { percentage: 0, currentTask: '', eta: 0 };
    private sftpProgress: SftpProgressData = { current: 0, total: 0, percentage: 0, eta: 0, currentTask: '' };
    private builtFiles: BuiltFileInfo[] = [];
    private sftpCleanInfo: SftpCleanInfo = { path: '', totalItems: 0, items: [] };

    // Время этапов
    private stageTimings: StageTimings = {};

    // Текущее время для отображения
    private mainBuildCurrentTime: string = '0с';
    private superHtmlCurrentTime: string = '0с';
    private sftpCurrentTime: string = '0с';

    // Анимация прогресса SuperHTML
    private superHtmlTargetPercentage: number = 0;
    private superHtmlAnimationInterval: NodeJS.Timeout | null = null;

    // Анимация прогресса SFTP
    private sftpTargetPercentage: number = 0;
    private sftpAnimationInterval: NodeJS.Timeout | null = null;

    // Максимальный размер файла Super HTML
    private superHtmlMaxFileSize: number = 0;
    private superHtmlMaxFileName: string = '';

    // Интервалы для обновления времени в реальном времени
    private progressTimeIntervals: {
        mainBuild?: NodeJS.Timeout;
        superHtmlBuild?: NodeJS.Timeout;
        sftpLoad?: NodeJS.Timeout;
    } = {};

    // Мониторинг застрявшего прогресса
    private stuckProgressTimeout: NodeJS.Timeout | null = null;
    private lastProgressUpdate: number = 0;

    // UI элементы
    private uiElements: {
        progressMain?: HTMLElement;
        progressSuperhtml?: HTMLElement;
        progressSftp?: HTMLElement;
        progressMainTime?: HTMLElement;
        progressSuperhtmlTime?: HTMLElement;
        progressSftpTime?: HTMLElement;
        sftpCleanInfo?: HTMLElement;
    } = {};

    constructor(uiElements: typeof this.uiElements) {
        this.uiElements = uiElements;
    }

    /**
     * Парсинг прогресса основного билда из логов
     */
    parseMainBuildProgress(msg: string): boolean {
        // Парсим прогресс из строк вида "09.09.2025 21:20:42 - debug: Generate systemJs..., progress: 17%"
        const progressMatch = msg.match(/progress:\s*(\d+)%/);
        if (progressMatch) {
            const newPercentage = parseInt(progressMatch[1]);

            // Обновляем прогресс только если он увеличился (избегаем отката прогресса)
            if (newPercentage >= this.mainBuildProgress.percentage) {
                this.mainBuildProgress.percentage = newPercentage;

                // Извлекаем название текущей задачи из разных форматов
                let taskMatch = msg.match(/debug:\s*(.+?),\s*progress:/);
                if (!taskMatch) {
                    // Пробуем другой формат: "log: run build task ... success in X ms√, progress: Y%"
                    taskMatch = msg.match(/log:\s*run build task\s+(.+?)\s+success/);
                }
                if (!taskMatch) {
                    // Пробуем формат: "debug: TaskName start..., progress: Y%"
                    taskMatch = msg.match(/debug:\s*([^:]+?)\s+start[^,]*,\s*progress:/);
                }

                if (taskMatch) {
                    this.mainBuildProgress.currentTask = taskMatch[1].trim();
                }

                this.updateMainBuildProgress();
                this.updateLastProgressTime();
                return true;
            }
        }

        // Расширенные паттерны для определения завершения билда
        const completionPatterns = [
            'build success',
            'build Task.*Finished',
            'Build completed successfully',
            'Build finished',
            'Compilation completed',
            'Build process completed',
            'web-mobile.*build.*success',
            'build.*success.*in.*ms',
            'Build.*finished.*successfully'
        ];

        for (const pattern of completionPatterns) {
            const regex = new RegExp(pattern, 'i');
            if (regex.test(msg)) {
                if (this.mainBuildProgress.percentage < 100) {
                    this.mainBuildProgress.percentage = 100;
                    this.mainBuildProgress.currentTask = 'Завершено';
                    this.updateMainBuildProgress();
                    this.updateLastProgressTime();
                    return true;
                }
            }
        }

        // Обрабатываем случай ошибки билда
        const errorPatterns = [
            'build error',
            'build failed',
            'error:.*build',
            'Build failed',
            'Compilation failed',
            'Build process failed'
        ];

        for (const pattern of errorPatterns) {
            const regex = new RegExp(pattern, 'i');
            if (regex.test(msg)) {
                this.mainBuildProgress.currentTask = 'Ошибка';
                this.updateMainBuildProgress();
                return true;
            }
        }

        // Дополнительная проверка: если прогресс достиг 99% и прошло время, принудительно завершаем
        if (this.mainBuildProgress.percentage >= 99) {
            // Если прогресс застрял на 99%, ждем немного и принудительно завершаем
            setTimeout(() => {
                if (this.mainBuildProgress.percentage >= 99 && this.mainBuildProgress.percentage < 100) {
                    this.mainBuildProgress.percentage = 100;
                    this.mainBuildProgress.currentTask = 'Завершено';
                    this.updateMainBuildProgress();
                }
            }, 2000); // Ждем 2 секунды
        }

        return false;
    }

    /**
     * Парсинг прогресса SuperHTML билда из логов
     */
    parseSuperHtmlProgress(msg: string): boolean {
        // Парсим структурированные логи с ключами
        const progressMatch = msg.match(/\[SUPERHTML_PROGRESS\] (\d+)% (.+)/);
        if (progressMatch) {
            const targetPercentage = parseInt(progressMatch[1]);
            this.superHtmlProgress.currentTask = progressMatch[2];
            // Используем плавную анимацию для перехода к новому проценту
            this.animateSuperHtmlProgress(targetPercentage, 800);
            return true;
        }

        // Парсим завершение этапа
        const stageCompleteMatch = msg.match(/\[SUPERHTML_STAGE\] (.+) completed/);
        if (stageCompleteMatch) {
            this.superHtmlProgress.currentTask = stageCompleteMatch[1] + ' - завершено';
            this.updateSuperHtmlProgress();
            return true;
        }

        // Парсим ошибки
        const errorMatch = msg.match(/\[SUPERHTML_ERROR\] (.+)/);
        if (errorMatch) {
            this.superHtmlProgress.currentTask = 'Ошибка: ' + errorMatch[1];
            this.updateSuperHtmlProgress();
            return true;
        }

        // Простой поиск по наличию [SUPERHTML_SUCCESS] и размер:
        if (msg.includes('[SUPERHTML_SUCCESS]') && msg.includes('размер:')) {
            // Ищем размер файла
            const sizeMatch = msg.match(/размер:\s*([\d.]+)\s*(?:KB|kbKB)/i);
            if (sizeMatch) {
                const sizeKB = parseFloat(sizeMatch[1]);

                // Ищем версию и язык
                const versionMatch = msg.match(/(\w+)\s*\((\w+)\)/);
                if (versionMatch) {
                    const versionName = versionMatch[1].trim();
                    const langCode = versionMatch[2];


                    // Сохраняем информацию о собранном файле
                    this.builtFiles.push({
                        versionName,
                        langCode,
                        buildTime: 0,
                        sizeKB,
                        fileName: `${versionName}_${langCode}.html`
                    });

                    this.superHtmlProgress.currentTask = `${versionName} (${langCode}) завершен, размер: ${sizeKB}KB`;
                    this.animateSuperHtmlProgress(100, 1000);
                    return true;
                }
            }
        }

        // Парсим сообщения о завершении файлов из логов
        // Ищем паттерн "✓ versionName (lang) завершен за Xs, размер: YkbKB"
        const logCompleteMatch = msg.match(/✓\s*([^(]+?)\s*\((\w+)\)\s*завершен\s*за\s*([\d.]+)s[,\s]*размер:\s*([\d.]+)\s*(?:KB|kbKB)/i);
        if (logCompleteMatch) {
            const versionName = logCompleteMatch[1].trim();
            const langCode = logCompleteMatch[2];
            const buildTime = parseFloat(logCompleteMatch[3]);
            const sizeKB = parseFloat(logCompleteMatch[4]);


            // Сохраняем информацию о собранном файле
            this.builtFiles.push({
                versionName,
                langCode,
                buildTime,
                sizeKB,
                fileName: `${versionName}_${langCode}.html`
            });

            this.superHtmlProgress.currentTask = `${versionName} (${langCode}) завершен за ${buildTime}s, размер: ${sizeKB}KB`;
            return true;
        }

        // Парсим сообщения о завершении файлов из других форматов (fallback)
        // Ищем паттерн "versionName (lang) завершен за Xs, размер: YKB" без префиксов
        const fileCompleteMatch = msg.match(/([^(]+?)\s*\((\w+)\)\s*завершен\s*за\s*([\d.]+)s[,\s]*размер:\s*([\d.]+)\s*(?:KB|kbKB)/i);
        if (fileCompleteMatch) {
            const versionName = fileCompleteMatch[1].trim();
            const langCode = fileCompleteMatch[2];
            const buildTime = parseFloat(fileCompleteMatch[3]);
            const sizeKB = parseFloat(fileCompleteMatch[4]);


            // Сохраняем информацию о собранном файле
            this.builtFiles.push({
                versionName,
                langCode,
                buildTime,
                sizeKB,
                fileName: `${versionName}_${langCode}.html`
            });

            this.superHtmlProgress.currentTask = `${versionName} (${langCode}) завершен за ${buildTime}s, размер: ${sizeKB}KB`;
            return true;
        }

        // Дополнительные паттерны для определения размера файла
        // Ищем любые сообщения с размером в KB (более гибкий поиск)
        const sizeMatch = msg.match(/размер:\s*([\d.]+)\s*(?:KB|kbKB)/i);
        if (sizeMatch) {
            const sizeKB = parseFloat(sizeMatch[1]);

            // Пытаемся извлечь информацию о версии и языке из контекста
            // Ищем паттерн "versionName (lang)" в любом месте сообщения
            const versionMatch = msg.match(/([^(]+?)\s*\((\w+)\)/);
            if (versionMatch) {
                const versionName = versionMatch[1].trim();
                const langCode = versionMatch[2];

                // Проверяем, не добавлен ли уже этот файл
                const existingFile = this.builtFiles.find(f => f.versionName === versionName && f.langCode === langCode);
                if (!existingFile) {
                    this.builtFiles.push({
                        versionName,
                        langCode,
                        buildTime: 0, // Время неизвестно
                        sizeKB,
                        fileName: `${versionName}_${langCode}.html`
                    });

                    // Обновляем прогресс
                    this.superHtmlProgress.currentTask = `${versionName} (${langCode}) завершен, размер: ${sizeKB}KB`;
                    this.animateSuperHtmlProgress(100, 1000);
                    return true;
                }
            }
        }

        // Еще более агрессивный поиск размеров файлов в любом месте сообщения
        // Ищем паттерн "размер: XKB" или "размер: XkbKB" в любом контексте
        const aggressiveSizeMatch = msg.match(/(\w+)\s*\((\w+)\).*?размер:\s*([\d.]+)\s*(?:KB|kbKB)/i);
        if (aggressiveSizeMatch) {
            const versionName = aggressiveSizeMatch[1].trim();
            const langCode = aggressiveSizeMatch[2];
            const sizeKB = parseFloat(aggressiveSizeMatch[3]);


            // Проверяем, не добавлен ли уже этот файл
            const existingFile = this.builtFiles.find(f => f.versionName === versionName && f.langCode === langCode);
            if (!existingFile) {
                this.builtFiles.push({
                    versionName,
                    langCode,
                    buildTime: 0, // Время неизвестно
                    sizeKB,
                    fileName: `${versionName}_${langCode}.html`
                });

                // Обновляем прогресс
                this.superHtmlProgress.currentTask = `${versionName} (${langCode}) завершен, размер: ${sizeKB}KB`;
                this.animateSuperHtmlProgress(100, 1000);
                return true;
            }
        }

        // Последний шанс - ищем размеры файлов в конце сообщения
        // Паттерн для случаев типа "5words (en) завершен за 3.084s, размер: 3214 kbKB"
        const finalSizeMatch = msg.match(/(\w+)\s*\((\w+)\)\s*завершен\s*за\s*[\d.]+s[,\s]*размер:\s*([\d.]+)\s*(?:KB|kbKB)/i);
        if (finalSizeMatch) {
            const versionName = finalSizeMatch[1].trim();
            const langCode = finalSizeMatch[2];
            const sizeKB = parseFloat(finalSizeMatch[3]);


            // Проверяем, не добавлен ли уже этот файл
            const existingFile = this.builtFiles.find(f => f.versionName === versionName && f.langCode === langCode);
            if (!existingFile) {
                this.builtFiles.push({
                    versionName,
                    langCode,
                    buildTime: 0, // Время неизвестно
                    sizeKB,
                    fileName: `${versionName}_${langCode}.html`
                });

                // Обновляем прогресс
                this.superHtmlProgress.currentTask = `${versionName} (${langCode}) завершен, размер: ${sizeKB}KB`;
                this.animateSuperHtmlProgress(100, 1000);
                return true;
            }
        }

        // Fallback для старого формата SUCCESS (без детальной информации)
        const simpleSuccessMatch = msg.match(/\[SUPERHTML_SUCCESS\] (.+)/);
        if (simpleSuccessMatch) {
            this.superHtmlProgress.currentTask = simpleSuccessMatch[1];
            // Плавно доводим до 100%
            this.animateSuperHtmlProgress(100, 1000);
            return true;
        }

        // Парсим сообщения SFTP с завершением файлов
        // Формат: ✅ 'versionName' (SFTP) | 🕓 time
        const sftpCompleteMatch = msg.match(/✅\s*'([^']+)'\s*\(SFTP\)\s*\|\s*🕓\s*([\d.]+)s/);
        if (sftpCompleteMatch) {
            const versionName = sftpCompleteMatch[1];
            const buildTime = parseFloat(sftpCompleteMatch[2]);


            // Для SFTP файлов мы не знаем размер, но можем добавить файл с примерным размером
            // или попробовать получить размер из файловой системы
            this.builtFiles.push({
                versionName,
                langCode: 'SFTP', // Указываем что это SFTP файл
                buildTime,
                sizeKB: 0, // Размер неизвестен для SFTP файлов
                fileName: `${versionName}_sftp.html`
            });

            this.superHtmlProgress.currentTask = `${versionName} (SFTP) завершен за ${buildTime}s`;
            return true;
        }

        // Fallback для старых логов (временно)
        if (msg.includes('⏳ Инициализация сборки...')) {
            this.superHtmlProgress.currentTask = 'Инициализация';
            this.animateSuperHtmlProgress(10, 500);
            return true;
        } else if (msg.includes('⏳ Ждем паковки...')) {
            this.superHtmlProgress.currentTask = 'Ожидание паковки';
            this.animateSuperHtmlProgress(20, 500);
            return true;
        } else if (msg.includes('✅') && msg.includes('| 🕓') && msg.includes('| 📦')) {
            this.superHtmlProgress.currentTask = 'Завершено';
            this.animateSuperHtmlProgress(100, 1000);
            return true;
        }

        return false;
    }

    /**
     * Парсинг структурированных SFTP логов
     */
    parseSftpLogs(msg: string): boolean {
        let hasUpdates = false;


        // Парсим прогресс загрузки
        const progressMatch = msg.match(/\[SFTP_PROGRESS\] (\d+)\/(\d+) ([\d.]+)% (\d+)s/);
        if (progressMatch) {
            const targetPercentage = parseFloat(progressMatch[3]);
            this.sftpProgress.current = parseInt(progressMatch[1]);
            this.sftpProgress.total = parseInt(progressMatch[2]);
            this.sftpProgress.eta = parseInt(progressMatch[4]);

            // Используем плавную анимацию для перехода к новому проценту
            this.animateSftpProgress(targetPercentage, 800);
            hasUpdates = true;
        }

        // Парсим начало информации о папке
        const cleanInfoStartMatch = msg.match(/\[SFTP_CLEAN_INFO_START\] (.+) (\d+)/);
        if (cleanInfoStartMatch) {
            this.sftpCleanInfo = {
                path: cleanInfoStartMatch[1],
                totalItems: parseInt(cleanInfoStartMatch[2]),
                items: []
            };
            hasUpdates = true;
        }

        // Парсим элементы для удаления
        // Для папок: [SFTP_CLEAN_ITEM] FOLDER name path - permissions modifyTime
        // Для файлов: [SFTP_CLEAN_ITEM] FILE name path size formattedSize permissions modifyTime

        // Обрабатываем все элементы в сообщении (может быть несколько)
        const folderMatches = msg.matchAll(/\[SFTP_CLEAN_ITEM\] FOLDER (.+) (.+) - (.+) (.+)/g);
        for (const match of folderMatches) {
            const item = {
                type: 'FOLDER',
                name: match[1],
                path: match[2],
                size: undefined,
                permissions: match[3],
                modifyTime: match[4]
            };
            this.sftpCleanInfo.items.push(item);
            hasUpdates = true;
        }

        const fileMatches = msg.matchAll(/\[SFTP_CLEAN_ITEM\] FILE (.+) (.+) (.+) (.+) (.+) (.+)/g);
        for (const match of fileMatches) {
            const item = {
                type: 'FILE',
                name: match[1],
                path: match[2],
                size: match[4], // formattedSize
                permissions: match[5],
                modifyTime: match[6]
            };
            this.sftpCleanInfo.items.push(item);
            hasUpdates = true;
        }

        // Парсим статистику
        const cleanStatsMatch = msg.match(/\[SFTP_CLEAN_STATS\] (\d+) (\d+) (\d+) (\d+) (.+)/);
        if (cleanStatsMatch) {
            // Обновляем статистику в интерфейсе
            this.updateSftpCleanInfo();
            hasUpdates = true;
        }

        // Обновляем интерфейс после каждого добавления элемента
        if (hasUpdates) {
            this.updateSftpCleanInfo();
        }


        // Fallback для старых логов SFTP (временно)
        if (msg.includes('SFTP заливка началась')) {
            this.sftpProgress.currentTask = 'Инициализация';
            this.animateSftpProgress(10, 500);
            hasUpdates = true;
        } else if (msg.includes('Подключение к серверу')) {
            this.sftpProgress.currentTask = 'Подключение';
            this.animateSftpProgress(20, 500);
            hasUpdates = true;
        } else if (msg.includes('Загрузка файлов')) {
            this.sftpProgress.currentTask = 'Загрузка файлов';
            this.animateSftpProgress(50, 500);
            hasUpdates = true;
        } else if (msg.includes('SFTP заливка завершена успешно')) {
            this.sftpProgress.currentTask = 'Завершено';
            this.animateSftpProgress(100, 1000);
            hasUpdates = true;
        }

        return hasUpdates;
    }

    /**
     * Обновление прогресса основного билда в интерфейсе
     */
    updateMainBuildProgress(): void {
        const progressMainTime = this.uiElements.progressMainTime;
        const progressMain = this.uiElements.progressMain;

        if (progressMainTime) {
            progressMainTime.textContent = `[${this.mainBuildCurrentTime}]`;
        }

        // Обновляем прогресс-бар (вся панелька)
        if (progressMain) {
            if (this.mainBuildProgress.percentage > 0) {
                // Устанавливаем ширину прогресс-бара через CSS-переменную
                progressMain.style.setProperty('--progress-width', `${this.mainBuildProgress.percentage}%`);
            } else {
                progressMain.style.setProperty('--progress-width', '0%');
            }
        }
    }

    /**
     * Обновление прогресса SuperHTML в интерфейсе
     */
    updateSuperHtmlProgress(): void {
        const progressSuperHtmlTime = this.uiElements.progressSuperhtmlTime;
        const progressSuperHtml = this.uiElements.progressSuperhtml;

        if (progressSuperHtmlTime) {
            progressSuperHtmlTime.textContent = `[${this.superHtmlCurrentTime}]`;
        }

        // Обновляем прогресс-бар (вся панелька)
        if (progressSuperHtml) {
            if (this.superHtmlProgress.percentage > 0) {
                // Устанавливаем ширину прогресс-бара через CSS-переменную
                progressSuperHtml.style.setProperty('--progress-width', `${this.superHtmlProgress.percentage}%`);
            } else {
                progressSuperHtml.style.setProperty('--progress-width', '0%');
            }
        }
    }

    /**
     * Обновление прогресса SFTP в интерфейсе
     */
    updateSftpProgress(): void {
        const progressSftpTime = this.uiElements.progressSftpTime;
        const progressSftp = this.uiElements.progressSftp;

        if (progressSftpTime) {
            // Обновляем время только если у нас есть данные о прогрессе
            if (this.sftpProgress.total > 0) {
                progressSftpTime.textContent = `[${this.sftpCurrentTime}] [${this.sftpProgress.current}/${this.sftpProgress.total}] ${this.sftpProgress.percentage}%`;
            } else {
                progressSftpTime.textContent = `[${this.sftpCurrentTime}]`;
            }
        }

        // Обновляем прогресс-бар (вся панелька)
        if (progressSftp) {
            if (this.sftpProgress.total > 0) {
                // Устанавливаем ширину прогресс-бара через CSS-переменную
                progressSftp.style.setProperty('--progress-width', `${this.sftpProgress.percentage}%`);
            } else {
                progressSftp.style.setProperty('--progress-width', '0%');
            }
        }
    }

    /**
     * Обновление информации о папках для удаления
     */
    updateSftpCleanInfo(): void {
        const sftpCleanInfoElement = this.uiElements.sftpCleanInfo;
        if (sftpCleanInfoElement && this.sftpCleanInfo.items.length > 0) {
            let html = `<div class="sftp-clean-header">
                <h4>Folder: ${this.sftpCleanInfo.path}</h4>
                <p>Total items: ${this.sftpCleanInfo.totalItems}</p>
            </div>`;

            // Группируем по типам
            const folders = this.sftpCleanInfo.items.filter(item => item.type === 'FOLDER');
            const files = this.sftpCleanInfo.items.filter(item => item.type === 'FILE');


            if (folders.length > 0) {
                html += '<div class="sftp-clean-group">';
                html += `<h5>Folders (${folders.length}):</h5>`;
                folders.forEach(folder => {
                    html += `<div class="sftp-clean-item folder">
                        <div class="item-name">${folder.name}</div>
                    </div>`;
                });
                html += '</div>';
            }

            if (files.length > 0) {
                html += '<div class="sftp-clean-group">';
                html += `<h5>Files (${files.length}):</h5>`;
                files.forEach(file => {
                    html += `<div class="sftp-clean-item file">
                        <div class="item-name">${file.name}</div>
                    </div>`;
                });
                html += '</div>';
            }

            // Добавляем предупреждение
            html += '<div class="sftp-clean-warning">';
            html += '<div class="warning-text">All these items will be deleted!</div>';
            html += '</div>';


            sftpCleanInfoElement.innerHTML = html;
        }
    }

    /**
     * Плавная анимация прогресса SuperHTML
     */
    animateSuperHtmlProgress(targetPercentage: number, duration: number = 1000): void {
        // Останавливаем предыдущую анимацию
        if (this.superHtmlAnimationInterval) {
            clearInterval(this.superHtmlAnimationInterval);
        }

        const startPercentage = this.superHtmlProgress.percentage;
        const difference = targetPercentage - startPercentage;
        const startTime = Date.now();

        this.superHtmlAnimationInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Используем easing функцию для плавности
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            const currentPercentage = startPercentage + (difference * easeProgress);

            this.superHtmlProgress.percentage = currentPercentage;
            this.updateSuperHtmlProgress();

            if (progress >= 1) {
                this.superHtmlProgress.percentage = targetPercentage;
                this.updateSuperHtmlProgress();
                if (this.superHtmlAnimationInterval) {
                    clearInterval(this.superHtmlAnimationInterval);
                    this.superHtmlAnimationInterval = null;
                }
            }
        }, 16); // ~60 FPS
    }

    /**
     * Плавная анимация прогресса SFTP
     */
    animateSftpProgress(targetPercentage: number, duration: number = 1000): void {
        // Останавливаем предыдущую анимацию
        if (this.sftpAnimationInterval) {
            clearInterval(this.sftpAnimationInterval);
        }

        const startPercentage = this.sftpProgress.percentage;
        const difference = targetPercentage - startPercentage;
        const startTime = Date.now();

        this.sftpAnimationInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Используем easing функцию для плавности
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            const currentPercentage = startPercentage + (difference * easeProgress);

            this.sftpProgress.percentage = currentPercentage;
            this.updateSftpProgress();

            if (progress >= 1) {
                this.sftpProgress.percentage = targetPercentage;
                this.updateSftpProgress();
                if (this.sftpAnimationInterval) {
                    clearInterval(this.sftpAnimationInterval);
                    this.sftpAnimationInterval = null;
                }
            }
        }, 16); // ~60 FPS
    }

    /**
     * Запуск отслеживания времени этапа
     */
    startStageTiming(stage: 'mainBuild' | 'superHtmlBuild' | 'sftpLoad'): void {
        this.stageTimings[stage] = { start: new Date() };

        // Запускаем обновление времени в реальном времени
        this.startProgressTimeUpdate(stage);
    }

    /**
     * Завершение отслеживания времени этапа
     */
    endStageTiming(stage: 'mainBuild' | 'superHtmlBuild' | 'sftpLoad'): void {
        if (this.stageTimings[stage]) {
            this.stageTimings[stage].end = new Date();
            this.stageTimings[stage].duration = Math.round(
                (this.stageTimings[stage].end!.getTime() - this.stageTimings[stage].start.getTime()) / 1000
            );
        }

        // Останавливаем обновление времени в реальном времени
        this.stopProgressTimeUpdate(stage);
    }

    /**
     * Форматирование времени этапа
     */
    formatStageTime(duration: number): string {
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        return `${minutes}м ${seconds}с`;
    }

    /**
     * Запуск обновления времени в реальном времени
     */
    private startProgressTimeUpdate(stage: 'mainBuild' | 'superHtmlBuild' | 'sftpLoad'): void {
        let timeElement: HTMLElement | null = null;

        switch (stage) {
            case 'mainBuild':
                timeElement = this.uiElements.progressMainTime || null;
                break;
            case 'superHtmlBuild':
                timeElement = this.uiElements.progressSuperhtmlTime || null;
                break;
            case 'sftpLoad':
                timeElement = this.uiElements.progressSftpTime || null;
                break;
        }

        if (!timeElement) return;

        // Очищаем предыдущий интервал если есть
        if (this.progressTimeIntervals[stage]) {
            clearInterval(this.progressTimeIntervals[stage]);
        }

        // Запускаем новый интервал
        this.progressTimeIntervals[stage] = setInterval(() => {
            if (this.stageTimings[stage] && this.stageTimings[stage].start) {
                const now = new Date();
                const elapsed = Math.round((now.getTime() - this.stageTimings[stage].start.getTime()) / 1000);
                const minutes = Math.floor(elapsed / 60);
                const seconds = elapsed % 60;
                const timeString = `${minutes}м ${seconds}с`;

                // Сохраняем время для соответствующего этапа
                if (stage === 'sftpLoad') {
                    this.sftpCurrentTime = timeString;
                    // Обновляем прогресс если есть данные
                    if (this.sftpProgress.total > 0) {
                        this.updateSftpProgress();
                    } else {
                        timeElement.textContent = `[${timeString}]`;
                    }
                } else if (stage === 'mainBuild') {
                    // Сохраняем время для основного билда
                    this.mainBuildCurrentTime = timeString;
                    // Обновляем прогресс если есть данные
                    if (this.mainBuildProgress.percentage > 0) {
                        this.updateMainBuildProgress();
                    } else {
                        timeElement.textContent = `[${timeString}]`;
                    }
                } else if (stage === 'superHtmlBuild') {
                    // Сохраняем время для SuperHTML билда
                    this.superHtmlCurrentTime = timeString;
                    timeElement.textContent = `[${timeString}]`;
                }
            }
        }, 1000);
    }

    /**
     * Остановка обновления времени в реальном времени
     */
    private stopProgressTimeUpdate(stage: 'mainBuild' | 'superHtmlBuild' | 'sftpLoad'): void {
        if (this.progressTimeIntervals[stage]) {
            clearInterval(this.progressTimeIntervals[stage]);
            this.progressTimeIntervals[stage] = undefined;
        }
    }

    /**
     * Очистка всех интервалов времени
     */
    clearAllProgressTimeIntervals(): void {
        Object.keys(this.progressTimeIntervals).forEach(stage => {
            if (this.progressTimeIntervals[stage as keyof typeof this.progressTimeIntervals]) {
                clearInterval(this.progressTimeIntervals[stage as keyof typeof this.progressTimeIntervals]);
            }
        });
        this.progressTimeIntervals = {};

        // Очищаем анимацию прогресса SuperHTML
        if (this.superHtmlAnimationInterval) {
            clearInterval(this.superHtmlAnimationInterval);
            this.superHtmlAnimationInterval = null;
        }

        // Очищаем анимацию прогресса SFTP
        if (this.sftpAnimationInterval) {
            clearInterval(this.sftpAnimationInterval);
            this.sftpAnimationInterval = null;
        }

        // Останавливаем мониторинг застрявшего прогресса
        this.stopStuckProgressMonitoring();
    }

    /**
     * Сброс всех прогрессов
     */
    resetAllProgress(): void {
        // Сбрасываем SFTP прогресс
        this.sftpProgress = { current: 0, total: 0, percentage: 0, eta: 0, currentTask: '' };
        this.sftpCurrentTime = '0с';

        // Сбрасываем прогресс-бар SFTP
        const progressSftp = this.uiElements.progressSftp;
        if (progressSftp) {
            progressSftp.style.setProperty('--progress-width', '0%');
        }

        // Сбрасываем прогресс основного билда
        this.mainBuildProgress = { percentage: 0, currentTask: '', eta: 0 };
        this.mainBuildCurrentTime = '0с';

        // Сбрасываем прогресс-бар основного билда
        const progressMain = this.uiElements.progressMain;
        if (progressMain) {
            progressMain.style.setProperty('--progress-width', '0%');
        }

        // Останавливаем анимацию прогресса SuperHTML
        if (this.superHtmlAnimationInterval) {
            clearInterval(this.superHtmlAnimationInterval);
            this.superHtmlAnimationInterval = null;
        }

        // Останавливаем анимацию прогресса SFTP
        if (this.sftpAnimationInterval) {
            clearInterval(this.sftpAnimationInterval);
            this.sftpAnimationInterval = null;
        }

        // Сбрасываем прогресс SuperHTML билда
        this.superHtmlProgress = { percentage: 0, currentTask: '', eta: 0 };
        this.superHtmlCurrentTime = '0с';

        // Сбрасываем максимальный размер файла Super HTML
        this.superHtmlMaxFileSize = 0;
        this.superHtmlMaxFileName = '';

        // Сбрасываем прогресс-бар SuperHTML билда
        const progressSuperHtml = this.uiElements.progressSuperhtml;
        if (progressSuperHtml) {
            progressSuperHtml.style.setProperty('--progress-width', '0%');
        }

        // Сбрасываем время в прогресс-барах
        const timeElements = [
            this.uiElements.progressMainTime,
            this.uiElements.progressSuperhtmlTime,
            this.uiElements.progressSftpTime
        ];

        timeElements.forEach(timeElement => {
            if (timeElement) {
                timeElement.textContent = '[0s]';
            }
        });

        // Очищаем список собранных файлов
        this.clearBuiltFiles();
    }

    /**
     * Сброс только прогресса (без очистки данных о файлах)
     */
    resetProgressOnly(): void {
        // Сбрасываем SFTP прогресс
        this.sftpProgress = { current: 0, total: 0, percentage: 0, eta: 0, currentTask: '' };
        this.sftpCurrentTime = '0с';

        // Сбрасываем прогресс-бар SFTP
        const progressSftp = this.uiElements.progressSftp;
        if (progressSftp) {
            progressSftp.style.setProperty('--progress-width', '0%');
        }

        // Сбрасываем прогресс основного билда
        this.mainBuildProgress = { percentage: 0, currentTask: '', eta: 0 };
        this.mainBuildCurrentTime = '0с';

        // Сбрасываем прогресс-бар основного билда
        const progressMain = this.uiElements.progressMain;
        if (progressMain) {
            progressMain.style.setProperty('--progress-width', '0%');
        }

        // Останавливаем анимацию прогресса SuperHTML
        if (this.superHtmlAnimationInterval) {
            clearInterval(this.superHtmlAnimationInterval);
            this.superHtmlAnimationInterval = null;
        }

        // Останавливаем анимацию прогресса SFTP
        if (this.sftpAnimationInterval) {
            clearInterval(this.sftpAnimationInterval);
            this.sftpAnimationInterval = null;
        }

        // Сбрасываем прогресс SuperHTML билда
        this.superHtmlProgress = { percentage: 0, currentTask: '', eta: 0 };
        this.superHtmlCurrentTime = '0с';

        // Сбрасываем прогресс-бар SuperHTML билда
        const progressSuperHtml = this.uiElements.progressSuperhtml;
        if (progressSuperHtml) {
            progressSuperHtml.style.setProperty('--progress-width', '0%');
        }

        // Сбрасываем время в прогресс-барах
        const timeElements = [
            this.uiElements.progressMainTime,
            this.uiElements.progressSuperhtmlTime,
            this.uiElements.progressSftpTime
        ];

        timeElements.forEach(timeElement => {
            if (timeElement) {
                timeElement.textContent = '[0s]';
            }
        });

        // НЕ очищаем список собранных файлов - они должны сохраняться между сборками
    }

    /**
     * Получение данных о времени этапов
     */
    getStageTimings(): StageTimings {
        return this.stageTimings;
    }

    /**
     * Получение данных о прогрессе основного билда
     */
    getMainBuildProgress(): ProgressData {
        return this.mainBuildProgress;
    }

    /**
     * Получение данных о прогрессе SuperHTML билда
     */
    getSuperHtmlProgress(): ProgressData {
        return this.superHtmlProgress;
    }

    /**
     * Получение данных о прогрессе SFTP
     */
    getSftpProgress(): SftpProgressData {
        return this.sftpProgress;
    }

    /**
     * Получение данных о clean-info SFTP
     */
    getSftpCleanInfo(): SftpCleanInfo {
        return this.sftpCleanInfo;
    }

    /**
     * Очистка данных о clean-info SFTP
     */
    clearSftpCleanInfo(): void {
        this.sftpCleanInfo = { path: '', totalItems: 0, items: [] };
    }

    /**
     * Принудительное завершение прогресса основного билда
     */
    forceCompleteMainBuild(): void {
        if (this.mainBuildProgress.percentage < 100) {
            this.mainBuildProgress.percentage = 100;
            this.mainBuildProgress.currentTask = 'Завершено';
            this.updateMainBuildProgress();
        }
    }

    /**
     * Принудительное завершение прогресса SuperHTML билда
     */
    forceCompleteSuperHtmlBuild(): void {
        if (this.superHtmlProgress.percentage < 100) {
            this.superHtmlProgress.percentage = 100;
            this.superHtmlProgress.currentTask = 'Завершено';
            this.updateSuperHtmlProgress();
        }
    }

    /**
     * Принудительное завершение прогресса SFTP
     */
    forceCompleteSftpProgress(): void {
        if (this.sftpProgress.percentage < 100) {
            this.sftpProgress.percentage = 100;
            this.sftpProgress.currentTask = 'Завершено';
            this.updateSftpProgress();
        }

        // Скрываем прогресс-бар после завершения
        setTimeout(() => {
            this.resetSectionState('sftp');
        }, 2000); // Даем время показать завершенное состояние
    }

    /**
     * Запуск мониторинга застрявшего прогресса
     */
    startStuckProgressMonitoring(): void {
        this.lastProgressUpdate = Date.now();

        if (this.stuckProgressTimeout) {
            clearTimeout(this.stuckProgressTimeout);
        }

        this.stuckProgressTimeout = setInterval(() => {
            const now = Date.now();
            const timeSinceLastUpdate = now - this.lastProgressUpdate;

            // Если прогресс не обновлялся более 30 секунд и он больше 0, принудительно завершаем
            if (timeSinceLastUpdate > 30000 && this.mainBuildProgress.percentage > 0) {
                this.forceCompleteMainBuild();
                this.stopStuckProgressMonitoring();
            }
        }, 5000); // Проверяем каждые 5 секунд
    }

    /**
     * Остановка мониторинга застрявшего прогресса
     */
    stopStuckProgressMonitoring(): void {
        if (this.stuckProgressTimeout) {
            clearTimeout(this.stuckProgressTimeout);
            this.stuckProgressTimeout = null;
        }
    }

    /**
     * Обновление времени последнего обновления прогресса
     */
    updateLastProgressTime(): void {
        this.lastProgressUpdate = Date.now();
    }

    /**
     * Показ прогресс-бара для конкретной секции
     */
    showSectionProgress(section: 'mainBuild' | 'superHtml' | 'sftp'): void {
        let progressElement: HTMLElement | undefined;

        switch (section) {
            case 'mainBuild':
                progressElement = this.uiElements.progressMain;
                break;
            case 'superHtml':
                progressElement = this.uiElements.progressSuperhtml;
                break;
            case 'sftp':
                progressElement = this.uiElements.progressSftp;
                break;
        }

        // Показываем индикатор прогресса
        if (progressElement) {
            progressElement.classList.remove('hidden');
            progressElement.classList.remove('pending', 'active', 'completed', 'skipped');
            progressElement.classList.add('pending');
        }
    }

    /**
     * Сброс состояния конкретной секции
     */
    resetSectionState(section: 'mainBuild' | 'superHtml' | 'sftp'): void {
        let progressElement: HTMLElement | undefined;

        switch (section) {
            case 'mainBuild':
                progressElement = this.uiElements.progressMain;
                break;
            case 'superHtml':
                progressElement = this.uiElements.progressSuperhtml;
                break;
            case 'sftp':
                progressElement = this.uiElements.progressSftp;
                break;
        }

        // Скрываем индикатор прогресса
        if (progressElement) {
            progressElement.classList.add('hidden');
            progressElement.classList.remove('pending', 'active', 'completed', 'skipped');
        }
    }

    /**
     * Получение списка собранных файлов
     */
    getBuiltFiles(): BuiltFileInfo[] {
        return [...this.builtFiles];
    }

    /**
     * Очистка списка собранных файлов
     */
    clearBuiltFiles(): void {
        this.builtFiles = [];
    }

    /**
     * Получение максимального размера файла
     */
    getMaxFileSize(): { sizeKB: number; fileName: string } | null {
        if (this.builtFiles.length === 0) {
            return null;
        }

        const maxFile = this.builtFiles.reduce((max, file) =>
            file.sizeKB > max.sizeKB ? file : max
        );

        return {
            sizeKB: maxFile.sizeKB,
            fileName: maxFile.fileName || `${maxFile.versionName}_${maxFile.langCode}.html`
        };
    }
}
