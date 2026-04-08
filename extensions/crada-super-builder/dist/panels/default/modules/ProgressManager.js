"use strict";
/**
 * ProgressManager - управление прогрессом сборки
 * Отвечает за отслеживание и отображение прогресса всех этапов сборки
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProgressManager = void 0;
class ProgressManager {
    constructor(uiElements) {
        this.mainBuildProgress = { percentage: 0, currentTask: '', eta: 0 };
        this.superHtmlProgress = { percentage: 0, currentTask: '', eta: 0 };
        this.sftpProgress = { current: 0, total: 0, percentage: 0, eta: 0, currentTask: '' };
        this.builtFiles = [];
        this.sftpCleanInfo = { path: '', totalItems: 0, items: [] };
        // Время этапов
        this.stageTimings = {};
        // Текущее время для отображения
        this.mainBuildCurrentTime = '0с';
        this.superHtmlCurrentTime = '0с';
        this.sftpCurrentTime = '0с';
        // Анимация прогресса SuperHTML
        this.superHtmlTargetPercentage = 0;
        this.superHtmlAnimationInterval = null;
        // Анимация прогресса SFTP
        this.sftpTargetPercentage = 0;
        this.sftpAnimationInterval = null;
        // Максимальный размер файла Super HTML
        this.superHtmlMaxFileSize = 0;
        this.superHtmlMaxFileName = '';
        // Интервалы для обновления времени в реальном времени
        this.progressTimeIntervals = {};
        // Мониторинг застрявшего прогресса
        this.stuckProgressTimeout = null;
        this.lastProgressUpdate = 0;
        // UI элементы
        this.uiElements = {};
        this.uiElements = uiElements;
    }
    /**
     * Парсинг прогресса основного билда из логов
     */
    parseMainBuildProgress(msg) {
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
    parseSuperHtmlProgress(msg) {
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
        }
        else if (msg.includes('⏳ Ждем паковки...')) {
            this.superHtmlProgress.currentTask = 'Ожидание паковки';
            this.animateSuperHtmlProgress(20, 500);
            return true;
        }
        else if (msg.includes('✅') && msg.includes('| 🕓') && msg.includes('| 📦')) {
            this.superHtmlProgress.currentTask = 'Завершено';
            this.animateSuperHtmlProgress(100, 1000);
            return true;
        }
        return false;
    }
    /**
     * Парсинг структурированных SFTP логов
     */
    parseSftpLogs(msg) {
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
        }
        else if (msg.includes('Подключение к серверу')) {
            this.sftpProgress.currentTask = 'Подключение';
            this.animateSftpProgress(20, 500);
            hasUpdates = true;
        }
        else if (msg.includes('Загрузка файлов')) {
            this.sftpProgress.currentTask = 'Загрузка файлов';
            this.animateSftpProgress(50, 500);
            hasUpdates = true;
        }
        else if (msg.includes('SFTP заливка завершена успешно')) {
            this.sftpProgress.currentTask = 'Завершено';
            this.animateSftpProgress(100, 1000);
            hasUpdates = true;
        }
        return hasUpdates;
    }
    /**
     * Обновление прогресса основного билда в интерфейсе
     */
    updateMainBuildProgress() {
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
            }
            else {
                progressMain.style.setProperty('--progress-width', '0%');
            }
        }
    }
    /**
     * Обновление прогресса SuperHTML в интерфейсе
     */
    updateSuperHtmlProgress() {
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
            }
            else {
                progressSuperHtml.style.setProperty('--progress-width', '0%');
            }
        }
    }
    /**
     * Обновление прогресса SFTP в интерфейсе
     */
    updateSftpProgress() {
        const progressSftpTime = this.uiElements.progressSftpTime;
        const progressSftp = this.uiElements.progressSftp;
        if (progressSftpTime) {
            // Обновляем время только если у нас есть данные о прогрессе
            if (this.sftpProgress.total > 0) {
                progressSftpTime.textContent = `[${this.sftpCurrentTime}] [${this.sftpProgress.current}/${this.sftpProgress.total}] ${this.sftpProgress.percentage}%`;
            }
            else {
                progressSftpTime.textContent = `[${this.sftpCurrentTime}]`;
            }
        }
        // Обновляем прогресс-бар (вся панелька)
        if (progressSftp) {
            if (this.sftpProgress.total > 0) {
                // Устанавливаем ширину прогресс-бара через CSS-переменную
                progressSftp.style.setProperty('--progress-width', `${this.sftpProgress.percentage}%`);
            }
            else {
                progressSftp.style.setProperty('--progress-width', '0%');
            }
        }
    }
    /**
     * Обновление информации о папках для удаления
     */
    updateSftpCleanInfo() {
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
    animateSuperHtmlProgress(targetPercentage, duration = 1000) {
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
    animateSftpProgress(targetPercentage, duration = 1000) {
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
    startStageTiming(stage) {
        this.stageTimings[stage] = { start: new Date() };
        // Запускаем обновление времени в реальном времени
        this.startProgressTimeUpdate(stage);
    }
    /**
     * Завершение отслеживания времени этапа
     */
    endStageTiming(stage) {
        if (this.stageTimings[stage]) {
            this.stageTimings[stage].end = new Date();
            this.stageTimings[stage].duration = Math.round((this.stageTimings[stage].end.getTime() - this.stageTimings[stage].start.getTime()) / 1000);
        }
        // Останавливаем обновление времени в реальном времени
        this.stopProgressTimeUpdate(stage);
    }
    /**
     * Форматирование времени этапа
     */
    formatStageTime(duration) {
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        return `${minutes}м ${seconds}с`;
    }
    /**
     * Запуск обновления времени в реальном времени
     */
    startProgressTimeUpdate(stage) {
        let timeElement = null;
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
        if (!timeElement)
            return;
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
                    }
                    else {
                        timeElement.textContent = `[${timeString}]`;
                    }
                }
                else if (stage === 'mainBuild') {
                    // Сохраняем время для основного билда
                    this.mainBuildCurrentTime = timeString;
                    // Обновляем прогресс если есть данные
                    if (this.mainBuildProgress.percentage > 0) {
                        this.updateMainBuildProgress();
                    }
                    else {
                        timeElement.textContent = `[${timeString}]`;
                    }
                }
                else if (stage === 'superHtmlBuild') {
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
    stopProgressTimeUpdate(stage) {
        if (this.progressTimeIntervals[stage]) {
            clearInterval(this.progressTimeIntervals[stage]);
            this.progressTimeIntervals[stage] = undefined;
        }
    }
    /**
     * Очистка всех интервалов времени
     */
    clearAllProgressTimeIntervals() {
        Object.keys(this.progressTimeIntervals).forEach(stage => {
            if (this.progressTimeIntervals[stage]) {
                clearInterval(this.progressTimeIntervals[stage]);
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
    resetAllProgress() {
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
    resetProgressOnly() {
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
    getStageTimings() {
        return this.stageTimings;
    }
    /**
     * Получение данных о прогрессе основного билда
     */
    getMainBuildProgress() {
        return this.mainBuildProgress;
    }
    /**
     * Получение данных о прогрессе SuperHTML билда
     */
    getSuperHtmlProgress() {
        return this.superHtmlProgress;
    }
    /**
     * Получение данных о прогрессе SFTP
     */
    getSftpProgress() {
        return this.sftpProgress;
    }
    /**
     * Получение данных о clean-info SFTP
     */
    getSftpCleanInfo() {
        return this.sftpCleanInfo;
    }
    /**
     * Очистка данных о clean-info SFTP
     */
    clearSftpCleanInfo() {
        this.sftpCleanInfo = { path: '', totalItems: 0, items: [] };
    }
    /**
     * Принудительное завершение прогресса основного билда
     */
    forceCompleteMainBuild() {
        if (this.mainBuildProgress.percentage < 100) {
            this.mainBuildProgress.percentage = 100;
            this.mainBuildProgress.currentTask = 'Завершено';
            this.updateMainBuildProgress();
        }
    }
    /**
     * Принудительное завершение прогресса SuperHTML билда
     */
    forceCompleteSuperHtmlBuild() {
        if (this.superHtmlProgress.percentage < 100) {
            this.superHtmlProgress.percentage = 100;
            this.superHtmlProgress.currentTask = 'Завершено';
            this.updateSuperHtmlProgress();
        }
    }
    /**
     * Принудительное завершение прогресса SFTP
     */
    forceCompleteSftpProgress() {
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
    startStuckProgressMonitoring() {
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
    stopStuckProgressMonitoring() {
        if (this.stuckProgressTimeout) {
            clearTimeout(this.stuckProgressTimeout);
            this.stuckProgressTimeout = null;
        }
    }
    /**
     * Обновление времени последнего обновления прогресса
     */
    updateLastProgressTime() {
        this.lastProgressUpdate = Date.now();
    }
    /**
     * Показ прогресс-бара для конкретной секции
     */
    showSectionProgress(section) {
        let progressElement;
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
    resetSectionState(section) {
        let progressElement;
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
    getBuiltFiles() {
        return [...this.builtFiles];
    }
    /**
     * Очистка списка собранных файлов
     */
    clearBuiltFiles() {
        this.builtFiles = [];
    }
    /**
     * Получение максимального размера файла
     */
    getMaxFileSize() {
        if (this.builtFiles.length === 0) {
            return null;
        }
        const maxFile = this.builtFiles.reduce((max, file) => file.sizeKB > max.sizeKB ? file : max);
        return {
            sizeKB: maxFile.sizeKB,
            fileName: maxFile.fileName || `${maxFile.versionName}_${maxFile.langCode}.html`
        };
    }
}
exports.ProgressManager = ProgressManager;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUHJvZ3Jlc3NNYW5hZ2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc291cmNlL3BhbmVscy9kZWZhdWx0L21vZHVsZXMvUHJvZ3Jlc3NNYW5hZ2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7O0dBR0c7OztBQWlESCxNQUFhLGVBQWU7SUFpRHhCLFlBQVksVUFBa0M7UUFoRHRDLHNCQUFpQixHQUFpQixFQUFFLFVBQVUsRUFBRSxDQUFDLEVBQUUsV0FBVyxFQUFFLEVBQUUsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFLENBQUM7UUFDN0Usc0JBQWlCLEdBQWlCLEVBQUUsVUFBVSxFQUFFLENBQUMsRUFBRSxXQUFXLEVBQUUsRUFBRSxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUUsQ0FBQztRQUM3RSxpQkFBWSxHQUFxQixFQUFFLE9BQU8sRUFBRSxDQUFDLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxVQUFVLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUUsV0FBVyxFQUFFLEVBQUUsRUFBRSxDQUFDO1FBQ2xHLGVBQVUsR0FBb0IsRUFBRSxDQUFDO1FBQ2pDLGtCQUFhLEdBQWtCLEVBQUUsSUFBSSxFQUFFLEVBQUUsRUFBRSxVQUFVLEVBQUUsQ0FBQyxFQUFFLEtBQUssRUFBRSxFQUFFLEVBQUUsQ0FBQztRQUU5RSxlQUFlO1FBQ1AsaUJBQVksR0FBaUIsRUFBRSxDQUFDO1FBRXhDLGdDQUFnQztRQUN4Qix5QkFBb0IsR0FBVyxJQUFJLENBQUM7UUFDcEMseUJBQW9CLEdBQVcsSUFBSSxDQUFDO1FBQ3BDLG9CQUFlLEdBQVcsSUFBSSxDQUFDO1FBRXZDLCtCQUErQjtRQUN2Qiw4QkFBeUIsR0FBVyxDQUFDLENBQUM7UUFDdEMsK0JBQTBCLEdBQTBCLElBQUksQ0FBQztRQUVqRSwwQkFBMEI7UUFDbEIseUJBQW9CLEdBQVcsQ0FBQyxDQUFDO1FBQ2pDLDBCQUFxQixHQUEwQixJQUFJLENBQUM7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KiBQcm9ncmVzc01hbmFnZXIgLSDRg9C/0YDQsNCy0LvQtdC90LjQtSDQv9GA0L7Qs9GA0LXRgdGB0L7QvCDRgdCx0L7RgNC60LhcclxuICog0J7RgtCy0LXRh9Cw0LXRgiDQt9CwINC+0YLRgdC70LXQttC40LLQsNC90LjQtSDQuCDQvtGC0L7QsdGA0LDQttC10L3QuNC1INC/0YDQvtCz0YDQtdGB0YHQsCDQstGB0LXRhSDRjdGC0LDQv9C+0LIg0YHQsdC+0YDQutC4XHJcbiAqL1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBQcm9ncmVzc0RhdGEge1xyXG4gICAgcGVyY2VudGFnZTogbnVtYmVyO1xyXG4gICAgY3VycmVudFRhc2s6IHN0cmluZztcclxuICAgIGV0YTogbnVtYmVyO1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIFNmdHBQcm9ncmVzc0RhdGEge1xyXG4gICAgY3VycmVudDogbnVtYmVyO1xyXG4gICAgdG90YWw6IG51bWJlcjtcclxuICAgIHBlcmNlbnRhZ2U6IG51bWJlcjtcclxuICAgIGV0YTogbnVtYmVyO1xyXG4gICAgY3VycmVudFRhc2s6IHN0cmluZztcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBTZnRwQ2xlYW5JbmZvIHtcclxuICAgIHBhdGg6IHN0cmluZztcclxuICAgIHRvdGFsSXRlbXM6IG51bWJlcjtcclxuICAgIGl0ZW1zOiBBcnJheTx7XHJcbiAgICAgICAgdHlwZTogc3RyaW5nO1xyXG4gICAgICAgIG5hbWU6IHN0cmluZztcclxuICAgICAgICBwYXRoOiBzdHJpbmc7XHJcbiAgICAgICAgc2l6ZT86IHN0cmluZztcclxuICAgICAgICBwZXJtaXNzaW9ucz86IHN0cmluZztcclxuICAgICAgICBtb2RpZnlUaW1lPzogc3RyaW5nO1xyXG4gICAgfT47XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgU3RhZ2VUaW1pbmcge1xyXG4gICAgc3RhcnQ6IERhdGU7XHJcbiAgICBlbmQ/OiBEYXRlO1xyXG4gICAgZHVyYXRpb24/OiBudW1iZXI7XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgU3RhZ2VUaW1pbmdzIHtcclxuICAgIG1haW5CdWlsZD86IFN0YWdlVGltaW5nO1xyXG4gICAgc3VwZXJIdG1sQnVpbGQ/OiBTdGFnZVRpbWluZztcclxuICAgIHNmdHBMb2FkPzogU3RhZ2VUaW1pbmc7XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgQnVpbHRGaWxlSW5mbyB7XHJcbiAgICB2ZXJzaW9uTmFtZTogc3RyaW5nO1xyXG4gICAgbGFuZ0NvZGU6IHN0cmluZztcclxuICAgIGJ1aWxkVGltZTogbnVtYmVyO1xyXG4gICAgc2l6ZUtCOiBudW1iZXI7XHJcbiAgICBmaWxlTmFtZT86IHN0cmluZztcclxufVxyXG5cclxuZXhwb3J0IGNsYXNzIFByb2dyZXNzTWFuYWdlciB7XHJcbiAgICBwcml2YXRlIG1haW5CdWlsZFByb2dyZXNzOiBQcm9ncmVzc0RhdGEgPSB7IHBlcmNlbnRhZ2U6IDAsIGN1cnJlbnRUYXNrOiAnJywgZXRhOiAwIH07XHJcbiAgICBwcml2YXRlIHN1cGVySHRtbFByb2dyZXNzOiBQcm9ncmVzc0RhdGEgPSB7IHBlcmNlbnRhZ2U6IDAsIGN1cnJlbnRUYXNrOiAnJywgZXRhOiAwIH07XHJcbiAgICBwcml2YXRlIHNmdHBQcm9ncmVzczogU2Z0cFByb2dyZXNzRGF0YSA9IHsgY3VycmVudDogMCwgdG90YWw6IDAsIHBlcmNlbnRhZ2U6IDAsIGV0YTogMCwgY3VycmVudFRhc2s6ICcnIH07XHJcbiAgICBwcml2YXRlIGJ1aWx0RmlsZXM6IEJ1aWx0RmlsZUluZm9bXSA9IFtdO1xyXG4gICAgcHJpdmF0ZSBzZnRwQ2xlYW5JbmZvOiBTZnRwQ2xlYW5JbmZvID0geyBwYXRoOiAnJywgdG90YWxJdGVtczogMCwgaXRlbXM6IFtdIH07XHJcblxyXG4gICAgLy8g0JLRgNC10LzRjyDRjdGC0LDQv9C+0LJcclxuICAgIHByaXZhdGUgc3RhZ2VUaW1pbmdzOiBTdGFnZVRpbWluZ3MgPSB7fTtcclxuXHJcbiAgICAvLyDQotC10LrRg9GJ0LXQtSDQstGA0LXQvNGPINC00LvRjyDQvtGC0L7QsdGA0LDQttC10L3QuNGPXHJcbiAgICBwcml2YXRlIG1haW5CdWlsZEN1cnJlbnRUaW1lOiBzdHJpbmcgPSAnMNGBJztcclxuICAgIHByaXZhdGUgc3VwZXJIdG1sQ3VycmVudFRpbWU6IHN0cmluZyA9ICcw0YEnO1xyXG4gICAgcHJpdmF0ZSBzZnRwQ3VycmVudFRpbWU6IHN0cmluZyA9ICcw0YEnO1xyXG5cclxuICAgIC8vINCQ0L3QuNC80LDRhtC40Y8g0L/RgNC+0LPRgNC10YHRgdCwIFN1cGVySFRNTFxyXG4gICAgcHJpdmF0ZSBzdXBlckh0bWxUYXJnZXRQZXJjZW50YWdlOiBudW1iZXIgPSAwO1xyXG4gICAgcHJpdmF0ZSBzdXBlckh0bWxBbmltYXRpb25JbnRlcnZhbDogTm9kZUpTLlRpbWVvdXQgfCBudWxsID0gbnVsbDtcclxuXHJcbiAgICAvLyDQkNC90LjQvNCw0YbQuNGPINC/0YDQvtCz0YDQtdGB0YHQsCBTRlRQXHJcbiAgICBwcml2YXRlIHNmdHBUYXJnZXRQZXJjZW50YWdlOiBudW1iZXIgPSAwO1xyXG4gICAgcHJpdmF0ZSBzZnRwQW5pbWF0aW9uSW50ZXJ2YWw6IE5vZGVKUy5UaW1lb3V0IHwgbnVsbCA9IG51bGw7XHJcblxyXG4gICAgLy8g0JzQsNC60YHQuNC80LDQu9GM0L3Ri9C5INGA0LDQt9C80LXRgCDRhNCw0LnQu9CwIFN1cGVyIEhUTUxcclxuICAgIHByaXZhdGUgc3VwZXJIdG1sTWF4RmlsZVNpemU6IG51bWJlciA9IDA7XHJcbiAgICBwcml2YXRlIHN1cGVySHRtbE1heEZpbGVOYW1lOiBzdHJpbmcgPSAnJztcclxuXHJcbiAgICAvLyDQmNC90YLQtdGA0LLQsNC70Ysg0LTQu9GPINC+0LHQvdC+0LLQu9C10L3QuNGPINCy0YDQtdC80LXQvdC4INCyINGA0LXQsNC70YzQvdC+0Lwg0LLRgNC10LzQtdC90LhcclxuICAgIHByaXZhdGUgcHJvZ3Jlc3NUaW1lSW50ZXJ2YWxzOiB7XHJcbiAgICAgICAgbWFpbkJ1aWxkPzogTm9kZUpTLlRpbWVvdXQ7XHJcbiAgICAgICAgc3VwZXJIdG1sQnVpbGQ/OiBOb2RlSlMuVGltZW91dDtcclxuICAgICAgICBzZnRwTG9hZD86IE5vZGVKUy5UaW1lb3V0O1xyXG4gICAgfSA9IHt9O1xyXG5cclxuICAgIC8vINCc0L7QvdC40YLQvtGA0LjQvdCzINC30LDRgdGC0YDRj9Cy0YjQtdCz0L4g0L/RgNC+0LPRgNC10YHRgdCwXHJcbiAgICBwcml2YXRlIHN0dWNrUHJvZ3Jlc3NUaW1lb3V0OiBOb2RlSlMuVGltZW91dCB8IG51bGwgPSBudWxsO1xyXG4gICAgcHJpdmF0ZSBsYXN0UHJvZ3Jlc3NVcGRhdGU6IG51bWJlciA9IDA7XHJcblxyXG4gICAgLy8gVUkg0Y3Qu9C10LzQtdC90YLRi1xyXG4gICAgcHJpdmF0ZSB1aUVsZW1lbnRzOiB7XHJcbiAgICAgICAgcHJvZ3Jlc3NNYWluPzogSFRNTEVsZW1lbnQ7XHJcbiAgICAgICAgcHJvZ3Jlc3NTdXBlcmh0bWw/OiBIVE1MRWxlbWVudDtcclxuICAgICAgICBwcm9ncmVzc1NmdHA/OiBIVE1MRWxlbWVudDtcclxuICAgICAgICBwcm9ncmVzc01haW5UaW1lPzogSFRNTEVsZW1lbnQ7XHJcbiAgICAgICAgcHJvZ3Jlc3NTdXBlcmh0bWxUaW1lPzogSFRNTEVsZW1lbnQ7XHJcbiAgICAgICAgcHJvZ3Jlc3NTZnRwVGltZT86IEhUTUxFbGVtZW50O1xyXG4gICAgICAgIHNmdHBDbGVhbkluZm8/OiBIVE1MRWxlbWVudDtcclxuICAgIH0gPSB7fTtcclxuXHJcbiAgICBjb25zdHJ1Y3Rvcih1aUVsZW1lbnRzOiB0eXBlb2YgdGhpcy51aUVsZW1lbnRzKSB7XHJcbiAgICAgICAgdGhpcy51aUVsZW1lbnRzID0gdWlFbGVtZW50cztcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqINCf0LDRgNGB0LjQvdCzINC/0YDQvtCz0YDQtdGB0YHQsCDQvtGB0L3QvtCy0L3QvtCz0L4g0LHQuNC70LTQsCDQuNC3INC70L7Qs9C+0LJcclxuICAgICAqL1xyXG4gICAgcGFyc2VNYWluQnVpbGRQcm9ncmVzcyhtc2c6IHN0cmluZyk6IGJvb2xlYW4ge1xyXG4gICAgICAgIC8vINCf0LDRgNGB0LjQvCDQv9GA0L7Qs9GA0LXRgdGBINC40Lcg0YHRgtGA0L7QuiDQstC40LTQsCBcIjA5LjA5LjIwMjUgMjE6MjA6NDIgLSBkZWJ1ZzogR2VuZXJhdGUgc3lzdGVtSnMuLi4sIHByb2dyZXNzOiAxNyVcIlxyXG4gICAgICAgIGNvbnN0IHByb2dyZXNzTWF0Y2ggPSBtc2cubWF0Y2goL3Byb2dyZXNzOlxccyooXFxkKyklLyk7XHJcbiAgICAgICAgaWYgKHByb2dyZXNzTWF0Y2gpIHtcclxuICAgICAgICAgICAgY29uc3QgbmV3UGVyY2VudGFnZSA9IHBhcnNlSW50KHByb2dyZXNzTWF0Y2hbMV0pO1xyXG5cclxuICAgICAgICAgICAgLy8g0J7QsdC90L7QstC70Y/QtdC8INC/0YDQvtCz0YDQtdGB0YEg0YLQvtC70YzQutC+INC10YHQu9C4INC+0L0g0YPQstC10LvQuNGH0LjQu9GB0Y8gKNC40LfQsdC10LPQsNC10Lwg0L7RgtC60LDRgtCwINC/0YDQvtCz0YDQtdGB0YHQsClcclxuICAgICAgICAgICAgaWYgKG5ld1BlcmNlbnRhZ2UgPj0gdGhpcy5tYWluQnVpbGRQcm9ncmVzcy5wZXJjZW50YWdlKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLm1haW5CdWlsZFByb2dyZXNzLnBlcmNlbnRhZ2UgPSBuZXdQZXJjZW50YWdlO1xyXG5cclxuICAgICAgICAgICAgICAgIC8vINCY0LfQstC70LXQutCw0LXQvCDQvdCw0LfQstCw0L3QuNC1INGC0LXQutGD0YnQtdC5INC30LDQtNCw0YfQuCDQuNC3INGA0LDQt9C90YvRhSDRhNC+0YDQvNCw0YLQvtCyXHJcbiAgICAgICAgICAgICAgICBsZXQgdGFza01hdGNoID0gbXNnLm1hdGNoKC9kZWJ1ZzpcXHMqKC4rPyksXFxzKnByb2dyZXNzOi8pO1xyXG4gICAgICAgICAgICAgICAgaWYgKCF0YXNrTWF0Y2gpIHtcclxuICAgICAgICAgICAgICAgICAgICAvLyDQn9GA0L7QsdGD0LXQvCDQtNGA0YPQs9C+0Lkg0YTQvtGA0LzQsNGCOiBcImxvZzogcnVuIGJ1aWxkIHRhc2sgLi4uIHN1Y2Nlc3MgaW4gWCBtc+KImiwgcHJvZ3Jlc3M6IFklXCJcclxuICAgICAgICAgICAgICAgICAgICB0YXNrTWF0Y2ggPSBtc2cubWF0Y2goL2xvZzpcXHMqcnVuIGJ1aWxkIHRhc2tcXHMrKC4rPylcXHMrc3VjY2Vzcy8pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgaWYgKCF0YXNrTWF0Y2gpIHtcclxuICAgICAgICAgICAgICAgICAgICAvLyDQn9GA0L7QsdGD0LXQvCDRhNC+0YDQvNCw0YI6IFwiZGVidWc6IFRhc2tOYW1lIHN0YXJ0Li4uLCBwcm9ncmVzczogWSVcIlxyXG4gICAgICAgICAgICAgICAgICAgIHRhc2tNYXRjaCA9IG1zZy5tYXRjaCgvZGVidWc6XFxzKihbXjpdKz8pXFxzK3N0YXJ0W14sXSosXFxzKnByb2dyZXNzOi8pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIGlmICh0YXNrTWF0Y2gpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLm1haW5CdWlsZFByb2dyZXNzLmN1cnJlbnRUYXNrID0gdGFza01hdGNoWzFdLnRyaW0oKTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZU1haW5CdWlsZFByb2dyZXNzKCk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZUxhc3RQcm9ncmVzc1RpbWUoKTtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDQoNCw0YHRiNC40YDQtdC90L3Ri9C1INC/0LDRgtGC0LXRgNC90Ysg0LTQu9GPINC+0L/RgNC10LTQtdC70LXQvdC40Y8g0LfQsNCy0LXRgNGI0LXQvdC40Y8g0LHQuNC70LTQsFxyXG4gICAgICAgIGNvbnN0IGNvbXBsZXRpb25QYXR0ZXJucyA9IFtcclxuICAgICAgICAgICAgJ2J1aWxkIHN1Y2Nlc3MnLFxyXG4gICAgICAgICAgICAnYnVpbGQgVGFzay4qRmluaXNoZWQnLFxyXG4gICAgICAgICAgICAnQnVpbGQgY29tcGxldGVkIHN1Y2Nlc3NmdWxseScsXHJcbiAgICAgICAgICAgICdCdWlsZCBmaW5pc2hlZCcsXHJcbiAgICAgICAgICAgICdDb21waWxhdGlvbiBjb21wbGV0ZWQnLFxyXG4gICAgICAgICAgICAnQnVpbGQgcHJvY2VzcyBjb21wbGV0ZWQnLFxyXG4gICAgICAgICAgICAnd2ViLW1vYmlsZS4qYnVpbGQuKnN1Y2Nlc3MnLFxyXG4gICAgICAgICAgICAnYnVpbGQuKnN1Y2Nlc3MuKmluLiptcycsXHJcbiAgICAgICAgICAgICdCdWlsZC4qZmluaXNoZWQuKnN1Y2Nlc3NmdWxseSdcclxuICAgICAgICBdO1xyXG5cclxuICAgICAgICBmb3IgKGNvbnN0IHBhdHRlcm4gb2YgY29tcGxldGlvblBhdHRlcm5zKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHJlZ2V4ID0gbmV3IFJlZ0V4cChwYXR0ZXJuLCAnaScpO1xyXG4gICAgICAgICAgICBpZiAocmVnZXgudGVzdChtc2cpKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5tYWluQnVpbGRQcm9ncmVzcy5wZXJjZW50YWdlIDwgMTAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tYWluQnVpbGRQcm9ncmVzcy5wZXJjZW50YWdlID0gMTAwO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubWFpbkJ1aWxkUHJvZ3Jlc3MuY3VycmVudFRhc2sgPSAn0JfQsNCy0LXRgNGI0LXQvdC+JztcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZU1haW5CdWlsZFByb2dyZXNzKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy51cGRhdGVMYXN0UHJvZ3Jlc3NUaW1lKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vINCe0LHRgNCw0LHQsNGC0YvQstCw0LXQvCDRgdC70YPRh9Cw0Lkg0L7RiNC40LHQutC4INCx0LjQu9C00LBcclxuICAgICAgICBjb25zdCBlcnJvclBhdHRlcm5zID0gW1xyXG4gICAgICAgICAgICAnYnVpbGQgZXJyb3InLFxyXG4gICAgICAgICAgICAnYnVpbGQgZmFpbGVkJyxcclxuICAgICAgICAgICAgJ2Vycm9yOi4qYnVpbGQnLFxyXG4gICAgICAgICAgICAnQnVpbGQgZmFpbGVkJyxcclxuICAgICAgICAgICAgJ0NvbXBpbGF0aW9uIGZhaWxlZCcsXHJcbiAgICAgICAgICAgICdCdWlsZCBwcm9jZXNzIGZhaWxlZCdcclxuICAgICAgICBdO1xyXG5cclxuICAgICAgICBmb3IgKGNvbnN0IHBhdHRlcm4gb2YgZXJyb3JQYXR0ZXJucykge1xyXG4gICAgICAgICAgICBjb25zdCByZWdleCA9IG5ldyBSZWdFeHAocGF0dGVybiwgJ2knKTtcclxuICAgICAgICAgICAgaWYgKHJlZ2V4LnRlc3QobXNnKSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5tYWluQnVpbGRQcm9ncmVzcy5jdXJyZW50VGFzayA9ICfQntGI0LjQsdC60LAnO1xyXG4gICAgICAgICAgICAgICAgdGhpcy51cGRhdGVNYWluQnVpbGRQcm9ncmVzcygpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vINCU0L7Qv9C+0LvQvdC40YLQtdC70YzQvdCw0Y8g0L/RgNC+0LLQtdGA0LrQsDog0LXRgdC70Lgg0L/RgNC+0LPRgNC10YHRgSDQtNC+0YHRgtC40LMgOTklINC4INC/0YDQvtGI0LvQviDQstGA0LXQvNGPLCDQv9GA0LjQvdGD0LTQuNGC0LXQu9GM0L3QviDQt9Cw0LLQtdGA0YjQsNC10LxcclxuICAgICAgICBpZiAodGhpcy5tYWluQnVpbGRQcm9ncmVzcy5wZXJjZW50YWdlID49IDk5KSB7XHJcbiAgICAgICAgICAgIC8vINCV0YHQu9C4INC/0YDQvtCz0YDQtdGB0YEg0LfQsNGB0YLRgNGP0Lsg0L3QsCA5OSUsINC20LTQtdC8INC90LXQvNC90L7Qs9C+INC4INC/0YDQuNC90YPQtNC40YLQtdC70YzQvdC+INC30LDQstC10YDRiNCw0LXQvFxyXG4gICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLm1haW5CdWlsZFByb2dyZXNzLnBlcmNlbnRhZ2UgPj0gOTkgJiYgdGhpcy5tYWluQnVpbGRQcm9ncmVzcy5wZXJjZW50YWdlIDwgMTAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tYWluQnVpbGRQcm9ncmVzcy5wZXJjZW50YWdlID0gMTAwO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubWFpbkJ1aWxkUHJvZ3Jlc3MuY3VycmVudFRhc2sgPSAn0JfQsNCy0LXRgNGI0LXQvdC+JztcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZU1haW5CdWlsZFByb2dyZXNzKCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0sIDIwMDApOyAvLyDQltC00LXQvCAyINGB0LXQutGD0L3QtNGLXHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDQn9Cw0YDRgdC40L3QsyDQv9GA0L7Qs9GA0LXRgdGB0LAgU3VwZXJIVE1MINCx0LjQu9C00LAg0LjQtyDQu9C+0LPQvtCyXHJcbiAgICAgKi9cclxuICAgIHBhcnNlU3VwZXJIdG1sUHJvZ3Jlc3MobXNnOiBzdHJpbmcpOiBib29sZWFuIHtcclxuICAgICAgICAvLyDQn9Cw0YDRgdC40Lwg0YHRgtGA0YPQutGC0YPRgNC40YDQvtCy0LDQvdC90YvQtSDQu9C+0LPQuCDRgSDQutC70Y7Rh9Cw0LzQuFxyXG4gICAgICAgIGNvbnN0IHByb2dyZXNzTWF0Y2ggPSBtc2cubWF0Y2goL1xcW1NVUEVSSFRNTF9QUk9HUkVTU1xcXSAoXFxkKyklICguKykvKTtcclxuICAgICAgICBpZiAocHJvZ3Jlc3NNYXRjaCkge1xyXG4gICAgICAgICAgICBjb25zdCB0YXJnZXRQZXJjZW50YWdlID0gcGFyc2VJbnQocHJvZ3Jlc3NNYXRjaFsxXSk7XHJcbiAgICAgICAgICAgIHRoaXMuc3VwZXJIdG1sUHJvZ3Jlc3MuY3VycmVudFRhc2sgPSBwcm9ncmVzc01hdGNoWzJdO1xyXG4gICAgICAgICAgICAvLyDQmNGB0L/QvtC70YzQt9GD0LXQvCDQv9C70LDQstC90YPRjiDQsNC90LjQvNCw0YbQuNGOINC00LvRjyDQv9C10YDQtdGF0L7QtNCwINC6INC90L7QstC+0LzRgyDQv9GA0L7RhtC10L3RgtGDXHJcbiAgICAgICAgICAgIHRoaXMuYW5pbWF0ZVN1cGVySHRtbFByb2dyZXNzKHRhcmdldFBlcmNlbnRhZ2UsIDgwMCk7XHJcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8g0J/QsNGA0YHQuNC8INC30LDQstC10YDRiNC10L3QuNC1INGN0YLQsNC/0LBcclxuICAgICAgICBjb25zdCBzdGFnZUNvbXBsZXRlTWF0Y2ggPSBtc2cubWF0Y2goL1xcW1NVUEVSSFRNTF9TVEFHRVxcXSAoLispIGNvbXBsZXRlZC8pO1xyXG4gICAgICAgIGlmIChzdGFnZUNvbXBsZXRlTWF0Y2gpIHtcclxuICAgICAgICAgICAgdGhpcy5zdXBlckh0bWxQcm9ncmVzcy5jdXJyZW50VGFzayA9IHN0YWdlQ29tcGxldGVNYXRjaFsxXSArICcgLSDQt9Cw0LLQtdGA0YjQtdC90L4nO1xyXG4gICAgICAgICAgICB0aGlzLnVwZGF0ZVN1cGVySHRtbFByb2dyZXNzKCk7XHJcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8g0J/QsNGA0YHQuNC8INC+0YjQuNCx0LrQuFxyXG4gICAgICAgIGNvbnN0IGVycm9yTWF0Y2ggPSBtc2cubWF0Y2goL1xcW1NVUEVSSFRNTF9FUlJPUlxcXSAoLispLyk7XHJcbiAgICAgICAgaWYgKGVycm9yTWF0Y2gpIHtcclxuICAgICAgICAgICAgdGhpcy5zdXBlckh0bWxQcm9ncmVzcy5jdXJyZW50VGFzayA9ICfQntGI0LjQsdC60LA6ICcgKyBlcnJvck1hdGNoWzFdO1xyXG4gICAgICAgICAgICB0aGlzLnVwZGF0ZVN1cGVySHRtbFByb2dyZXNzKCk7XHJcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8g0J/RgNC+0YHRgtC+0Lkg0L/QvtC40YHQuiDQv9C+INC90LDQu9C40YfQuNGOIFtTVVBFUkhUTUxfU1VDQ0VTU10g0Lgg0YDQsNC30LzQtdGAOlxyXG4gICAgICAgIGlmIChtc2cuaW5jbHVkZXMoJ1tTVVBFUkhUTUxfU1VDQ0VTU10nKSAmJiBtc2cuaW5jbHVkZXMoJ9GA0LDQt9C80LXRgDonKSkge1xyXG4gICAgICAgICAgICAvLyDQmNGJ0LXQvCDRgNCw0LfQvNC10YAg0YTQsNC50LvQsFxyXG4gICAgICAgICAgICBjb25zdCBzaXplTWF0Y2ggPSBtc2cubWF0Y2goL9GA0LDQt9C80LXRgDpcXHMqKFtcXGQuXSspXFxzKig/OktCfGtiS0IpL2kpO1xyXG4gICAgICAgICAgICBpZiAoc2l6ZU1hdGNoKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBzaXplS0IgPSBwYXJzZUZsb2F0KHNpemVNYXRjaFsxXSk7XHJcblxyXG4gICAgICAgICAgICAgICAgLy8g0JjRidC10Lwg0LLQtdGA0YHQuNGOINC4INGP0LfRi9C6XHJcbiAgICAgICAgICAgICAgICBjb25zdCB2ZXJzaW9uTWF0Y2ggPSBtc2cubWF0Y2goLyhcXHcrKVxccypcXCgoXFx3KylcXCkvKTtcclxuICAgICAgICAgICAgICAgIGlmICh2ZXJzaW9uTWF0Y2gpIHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCB2ZXJzaW9uTmFtZSA9IHZlcnNpb25NYXRjaFsxXS50cmltKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGFuZ0NvZGUgPSB2ZXJzaW9uTWF0Y2hbMl07XHJcblxyXG5cclxuICAgICAgICAgICAgICAgICAgICAvLyDQodC+0YXRgNCw0L3Rj9C10Lwg0LjQvdGE0L7RgNC80LDRhtC40Y4g0L4g0YHQvtCx0YDQsNC90L3QvtC8INGE0LDQudC70LVcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmJ1aWx0RmlsZXMucHVzaCh7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZlcnNpb25OYW1lLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBsYW5nQ29kZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgYnVpbGRUaW1lOiAwLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBzaXplS0IsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGZpbGVOYW1lOiBgJHt2ZXJzaW9uTmFtZX1fJHtsYW5nQ29kZX0uaHRtbGBcclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zdXBlckh0bWxQcm9ncmVzcy5jdXJyZW50VGFzayA9IGAke3ZlcnNpb25OYW1lfSAoJHtsYW5nQ29kZX0pINC30LDQstC10YDRiNC10L0sINGA0LDQt9C80LXRgDogJHtzaXplS0J9S0JgO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYW5pbWF0ZVN1cGVySHRtbFByb2dyZXNzKDEwMCwgMTAwMCk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vINCf0LDRgNGB0LjQvCDRgdC+0L7QsdGJ0LXQvdC40Y8g0L4g0LfQsNCy0LXRgNGI0LXQvdC40Lgg0YTQsNC50LvQvtCyINC40Lcg0LvQvtCz0L7QslxyXG4gICAgICAgIC8vINCY0YnQtdC8INC/0LDRgtGC0LXRgNC9IFwi4pyTIHZlcnNpb25OYW1lIChsYW5nKSDQt9Cw0LLQtdGA0YjQtdC9INC30LAgWHMsINGA0LDQt9C80LXRgDogWWtiS0JcIlxyXG4gICAgICAgIGNvbnN0IGxvZ0NvbXBsZXRlTWF0Y2ggPSBtc2cubWF0Y2goL+Kck1xccyooW14oXSs/KVxccypcXCgoXFx3KylcXClcXHMq0LfQsNCy0LXRgNGI0LXQvVxccyrQt9CwXFxzKihbXFxkLl0rKXNbLFxcc10q0YDQsNC30LzQtdGAOlxccyooW1xcZC5dKylcXHMqKD86S0J8a2JLQikvaSk7XHJcbiAgICAgICAgaWYgKGxvZ0NvbXBsZXRlTWF0Y2gpIHtcclxuICAgICAgICAgICAgY29uc3QgdmVyc2lvbk5hbWUgPSBsb2dDb21wbGV0ZU1hdGNoWzFdLnRyaW0oKTtcclxuICAgICAgICAgICAgY29uc3QgbGFuZ0NvZGUgPSBsb2dDb21wbGV0ZU1hdGNoWzJdO1xyXG4gICAgICAgICAgICBjb25zdCBidWlsZFRpbWUgPSBwYXJzZUZsb2F0KGxvZ0NvbXBsZXRlTWF0Y2hbM10pO1xyXG4gICAgICAgICAgICBjb25zdCBzaXplS0IgPSBwYXJzZUZsb2F0KGxvZ0NvbXBsZXRlTWF0Y2hbNF0pO1xyXG5cclxuXHJcbiAgICAgICAgICAgIC8vINCh0L7RhdGA0LDQvdGP0LXQvCDQuNC90YTQvtGA0LzQsNGG0LjRjiDQviDRgdC+0LHRgNCw0L3QvdC+0Lwg0YTQsNC50LvQtVxyXG4gICAgICAgICAgICB0aGlzLmJ1aWx0RmlsZXMucHVzaCh7XHJcbiAgICAgICAgICAgICAgICB2ZXJzaW9uTmFtZSxcclxuICAgICAgICAgICAgICAgIGxhbmdDb2RlLFxyXG4gICAgICAgICAgICAgICAgYnVpbGRUaW1lLFxyXG4gICAgICAgICAgICAgICAgc2l6ZUtCLFxyXG4gICAgICAgICAgICAgICAgZmlsZU5hbWU6IGAke3ZlcnNpb25OYW1lfV8ke2xhbmdDb2RlfS5odG1sYFxyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIHRoaXMuc3VwZXJIdG1sUHJvZ3Jlc3MuY3VycmVudFRhc2sgPSBgJHt2ZXJzaW9uTmFtZX0gKCR7bGFuZ0NvZGV9KSDQt9Cw0LLQtdGA0YjQtdC9INC30LAgJHtidWlsZFRpbWV9cywg0YDQsNC30LzQtdGAOiAke3NpemVLQn1LQmA7XHJcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8g0J/QsNGA0YHQuNC8INGB0L7QvtCx0YnQtdC90LjRjyDQviDQt9Cw0LLQtdGA0YjQtdC90LjQuCDRhNCw0LnQu9C+0LIg0LjQtyDQtNGA0YPQs9C40YUg0YTQvtGA0LzQsNGC0L7QsiAoZmFsbGJhY2spXHJcbiAgICAgICAgLy8g0JjRidC10Lwg0L/QsNGC0YLQtdGA0L0gXCJ2ZXJzaW9uTmFtZSAobGFuZykg0LfQsNCy0LXRgNGI0LXQvSDQt9CwIFhzLCDRgNCw0LfQvNC10YA6IFlLQlwiINCx0LXQtyDQv9GA0LXRhNC40LrRgdC+0LJcclxuICAgICAgICBjb25zdCBmaWxlQ29tcGxldGVNYXRjaCA9IG1zZy5tYXRjaCgvKFteKF0rPylcXHMqXFwoKFxcdyspXFwpXFxzKtC30LDQstC10YDRiNC10L1cXHMq0LfQsFxccyooW1xcZC5dKylzWyxcXHNdKtGA0LDQt9C80LXRgDpcXHMqKFtcXGQuXSspXFxzKig/OktCfGtiS0IpL2kpO1xyXG4gICAgICAgIGlmIChmaWxlQ29tcGxldGVNYXRjaCkge1xyXG4gICAgICAgICAgICBjb25zdCB2ZXJzaW9uTmFtZSA9IGZpbGVDb21wbGV0ZU1hdGNoWzFdLnRyaW0oKTtcclxuICAgICAgICAgICAgY29uc3QgbGFuZ0NvZGUgPSBmaWxlQ29tcGxldGVNYXRjaFsyXTtcclxuICAgICAgICAgICAgY29uc3QgYnVpbGRUaW1lID0gcGFyc2VGbG9hdChmaWxlQ29tcGxldGVNYXRjaFszXSk7XHJcbiAgICAgICAgICAgIGNvbnN0IHNpemVLQiA9IHBhcnNlRmxvYXQoZmlsZUNvbXBsZXRlTWF0Y2hbNF0pO1xyXG5cclxuXHJcbiAgICAgICAgICAgIC8vINCh0L7RhdGA0LDQvdGP0LXQvCDQuNC90YTQvtGA0LzQsNGG0LjRjiDQviDRgdC+0LHRgNCw0L3QvdC+0Lwg0YTQsNC50LvQtVxyXG4gICAgICAgICAgICB0aGlzLmJ1aWx0RmlsZXMucHVzaCh7XHJcbiAgICAgICAgICAgICAgICB2ZXJzaW9uTmFtZSxcclxuICAgICAgICAgICAgICAgIGxhbmdDb2RlLFxyXG4gICAgICAgICAgICAgICAgYnVpbGRUaW1lLFxyXG4gICAgICAgICAgICAgICAgc2l6ZUtCLFxyXG4gICAgICAgICAgICAgICAgZmlsZU5hbWU6IGAke3ZlcnNpb25OYW1lfV8ke2xhbmdDb2RlfS5odG1sYFxyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIHRoaXMuc3VwZXJIdG1sUHJvZ3Jlc3MuY3VycmVudFRhc2sgPSBgJHt2ZXJzaW9uTmFtZX0gKCR7bGFuZ0NvZGV9KSDQt9Cw0LLQtdGA0YjQtdC9INC30LAgJHtidWlsZFRpbWV9cywg0YDQsNC30LzQtdGAOiAke3NpemVLQn1LQmA7XHJcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8g0JTQvtC/0L7Qu9C90LjRgtC10LvRjNC90YvQtSDQv9Cw0YLRgtC10YDQvdGLINC00LvRjyDQvtC/0YDQtdC00LXQu9C10L3QuNGPINGA0LDQt9C80LXRgNCwINGE0LDQudC70LBcclxuICAgICAgICAvLyDQmNGJ0LXQvCDQu9GO0LHRi9C1INGB0L7QvtCx0YnQtdC90LjRjyDRgSDRgNCw0LfQvNC10YDQvtC8INCyIEtCICjQsdC+0LvQtdC1INCz0LjQsdC60LjQuSDQv9C+0LjRgdC6KVxyXG4gICAgICAgIGNvbnN0IHNpemVNYXRjaCA9IG1zZy5tYXRjaCgv0YDQsNC30LzQtdGAOlxccyooW1xcZC5dKylcXHMqKD86S0J8a2JLQikvaSk7XHJcbiAgICAgICAgaWYgKHNpemVNYXRjaCkge1xyXG4gICAgICAgICAgICBjb25zdCBzaXplS0IgPSBwYXJzZUZsb2F0KHNpemVNYXRjaFsxXSk7XHJcblxyXG4gICAgICAgICAgICAvLyDQn9GL0YLQsNC10LzRgdGPINC40LfQstC70LXRh9GMINC40L3RhNC+0YDQvNCw0YbQuNGOINC+INCy0LXRgNGB0LjQuCDQuCDRj9C30YvQutC1INC40Lcg0LrQvtC90YLQtdC60YHRgtCwXHJcbiAgICAgICAgICAgIC8vINCY0YnQtdC8INC/0LDRgtGC0LXRgNC9IFwidmVyc2lvbk5hbWUgKGxhbmcpXCIg0LIg0LvRjtCx0L7QvCDQvNC10YHRgtC1INGB0L7QvtCx0YnQtdC90LjRj1xyXG4gICAgICAgICAgICBjb25zdCB2ZXJzaW9uTWF0Y2ggPSBtc2cubWF0Y2goLyhbXihdKz8pXFxzKlxcKChcXHcrKVxcKS8pO1xyXG4gICAgICAgICAgICBpZiAodmVyc2lvbk1hdGNoKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCB2ZXJzaW9uTmFtZSA9IHZlcnNpb25NYXRjaFsxXS50cmltKCk7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBsYW5nQ29kZSA9IHZlcnNpb25NYXRjaFsyXTtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyDQn9GA0L7QstC10YDRj9C10LwsINC90LUg0LTQvtCx0LDQstC70LXQvSDQu9C4INGD0LbQtSDRjdGC0L7RgiDRhNCw0LnQu1xyXG4gICAgICAgICAgICAgICAgY29uc3QgZXhpc3RpbmdGaWxlID0gdGhpcy5idWlsdEZpbGVzLmZpbmQoZiA9PiBmLnZlcnNpb25OYW1lID09PSB2ZXJzaW9uTmFtZSAmJiBmLmxhbmdDb2RlID09PSBsYW5nQ29kZSk7XHJcbiAgICAgICAgICAgICAgICBpZiAoIWV4aXN0aW5nRmlsZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYnVpbHRGaWxlcy5wdXNoKHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmVyc2lvbk5hbWUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGxhbmdDb2RlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBidWlsZFRpbWU6IDAsIC8vINCS0YDQtdC80Y8g0L3QtdC40LfQstC10YHRgtC90L5cclxuICAgICAgICAgICAgICAgICAgICAgICAgc2l6ZUtCLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBmaWxlTmFtZTogYCR7dmVyc2lvbk5hbWV9XyR7bGFuZ0NvZGV9Lmh0bWxgXHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIC8vINCe0LHQvdC+0LLQu9GP0LXQvCDQv9GA0L7Qs9GA0LXRgdGBXHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zdXBlckh0bWxQcm9ncmVzcy5jdXJyZW50VGFzayA9IGAke3ZlcnNpb25OYW1lfSAoJHtsYW5nQ29kZX0pINC30LDQstC10YDRiNC10L0sINGA0LDQt9C80LXRgDogJHtzaXplS0J9S0JgO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYW5pbWF0ZVN1cGVySHRtbFByb2dyZXNzKDEwMCwgMTAwMCk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vINCV0YnQtSDQsdC+0LvQtdC1INCw0LPRgNC10YHRgdC40LLQvdGL0Lkg0L/QvtC40YHQuiDRgNCw0LfQvNC10YDQvtCyINGE0LDQudC70L7QsiDQsiDQu9GO0LHQvtC8INC80LXRgdGC0LUg0YHQvtC+0LHRidC10L3QuNGPXHJcbiAgICAgICAgLy8g0JjRidC10Lwg0L/QsNGC0YLQtdGA0L0gXCLRgNCw0LfQvNC10YA6IFhLQlwiINC40LvQuCBcItGA0LDQt9C80LXRgDogWGtiS0JcIiDQsiDQu9GO0LHQvtC8INC60L7QvdGC0LXQutGB0YLQtVxyXG4gICAgICAgIGNvbnN0IGFnZ3Jlc3NpdmVTaXplTWF0Y2ggPSBtc2cubWF0Y2goLyhcXHcrKVxccypcXCgoXFx3KylcXCkuKj/RgNCw0LfQvNC10YA6XFxzKihbXFxkLl0rKVxccyooPzpLQnxrYktCKS9pKTtcclxuICAgICAgICBpZiAoYWdncmVzc2l2ZVNpemVNYXRjaCkge1xyXG4gICAgICAgICAgICBjb25zdCB2ZXJzaW9uTmFtZSA9IGFnZ3Jlc3NpdmVTaXplTWF0Y2hbMV0udHJpbSgpO1xyXG4gICAgICAgICAgICBjb25zdCBsYW5nQ29kZSA9IGFnZ3Jlc3NpdmVTaXplTWF0Y2hbMl07XHJcbiAgICAgICAgICAgIGNvbnN0IHNpemVLQiA9IHBhcnNlRmxvYXQoYWdncmVzc2l2ZVNpemVNYXRjaFszXSk7XHJcblxyXG5cclxuICAgICAgICAgICAgLy8g0J/RgNC+0LLQtdGA0Y/QtdC8LCDQvdC1INC00L7QsdCw0LLQu9C10L0g0LvQuCDRg9C20LUg0Y3RgtC+0YIg0YTQsNC50LtcclxuICAgICAgICAgICAgY29uc3QgZXhpc3RpbmdGaWxlID0gdGhpcy5idWlsdEZpbGVzLmZpbmQoZiA9PiBmLnZlcnNpb25OYW1lID09PSB2ZXJzaW9uTmFtZSAmJiBmLmxhbmdDb2RlID09PSBsYW5nQ29kZSk7XHJcbiAgICAgICAgICAgIGlmICghZXhpc3RpbmdGaWxlKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmJ1aWx0RmlsZXMucHVzaCh7XHJcbiAgICAgICAgICAgICAgICAgICAgdmVyc2lvbk5hbWUsXHJcbiAgICAgICAgICAgICAgICAgICAgbGFuZ0NvZGUsXHJcbiAgICAgICAgICAgICAgICAgICAgYnVpbGRUaW1lOiAwLCAvLyDQktGA0LXQvNGPINC90LXQuNC30LLQtdGB0YLQvdC+XHJcbiAgICAgICAgICAgICAgICAgICAgc2l6ZUtCLFxyXG4gICAgICAgICAgICAgICAgICAgIGZpbGVOYW1lOiBgJHt2ZXJzaW9uTmFtZX1fJHtsYW5nQ29kZX0uaHRtbGBcclxuICAgICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgICAgIC8vINCe0LHQvdC+0LLQu9GP0LXQvCDQv9GA0L7Qs9GA0LXRgdGBXHJcbiAgICAgICAgICAgICAgICB0aGlzLnN1cGVySHRtbFByb2dyZXNzLmN1cnJlbnRUYXNrID0gYCR7dmVyc2lvbk5hbWV9ICgke2xhbmdDb2RlfSkg0LfQsNCy0LXRgNGI0LXQvSwg0YDQsNC30LzQtdGAOiAke3NpemVLQn1LQmA7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmFuaW1hdGVTdXBlckh0bWxQcm9ncmVzcygxMDAsIDEwMDApO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vINCf0L7RgdC70LXQtNC90LjQuSDRiNCw0L3RgSAtINC40YnQtdC8INGA0LDQt9C80LXRgNGLINGE0LDQudC70L7QsiDQsiDQutC+0L3RhtC1INGB0L7QvtCx0YnQtdC90LjRj1xyXG4gICAgICAgIC8vINCf0LDRgtGC0LXRgNC9INC00LvRjyDRgdC70YPRh9Cw0LXQsiDRgtC40L/QsCBcIjV3b3JkcyAoZW4pINC30LDQstC10YDRiNC10L0g0LfQsCAzLjA4NHMsINGA0LDQt9C80LXRgDogMzIxNCBrYktCXCJcclxuICAgICAgICBjb25zdCBmaW5hbFNpemVNYXRjaCA9IG1zZy5tYXRjaCgvKFxcdyspXFxzKlxcKChcXHcrKVxcKVxccyrQt9Cw0LLQtdGA0YjQtdC9XFxzKtC30LBcXHMqW1xcZC5dK3NbLFxcc10q0YDQsNC30LzQtdGAOlxccyooW1xcZC5dKylcXHMqKD86S0J8a2JLQikvaSk7XHJcbiAgICAgICAgaWYgKGZpbmFsU2l6ZU1hdGNoKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHZlcnNpb25OYW1lID0gZmluYWxTaXplTWF0Y2hbMV0udHJpbSgpO1xyXG4gICAgICAgICAgICBjb25zdCBsYW5nQ29kZSA9IGZpbmFsU2l6ZU1hdGNoWzJdO1xyXG4gICAgICAgICAgICBjb25zdCBzaXplS0IgPSBwYXJzZUZsb2F0KGZpbmFsU2l6ZU1hdGNoWzNdKTtcclxuXHJcblxyXG4gICAgICAgICAgICAvLyDQn9GA0L7QstC10YDRj9C10LwsINC90LUg0LTQvtCx0LDQstC70LXQvSDQu9C4INGD0LbQtSDRjdGC0L7RgiDRhNCw0LnQu1xyXG4gICAgICAgICAgICBjb25zdCBleGlzdGluZ0ZpbGUgPSB0aGlzLmJ1aWx0RmlsZXMuZmluZChmID0+IGYudmVyc2lvbk5hbWUgPT09IHZlcnNpb25OYW1lICYmIGYubGFuZ0NvZGUgPT09IGxhbmdDb2RlKTtcclxuICAgICAgICAgICAgaWYgKCFleGlzdGluZ0ZpbGUpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuYnVpbHRGaWxlcy5wdXNoKHtcclxuICAgICAgICAgICAgICAgICAgICB2ZXJzaW9uTmFtZSxcclxuICAgICAgICAgICAgICAgICAgICBsYW5nQ29kZSxcclxuICAgICAgICAgICAgICAgICAgICBidWlsZFRpbWU6IDAsIC8vINCS0YDQtdC80Y8g0L3QtdC40LfQstC10YHRgtC90L5cclxuICAgICAgICAgICAgICAgICAgICBzaXplS0IsXHJcbiAgICAgICAgICAgICAgICAgICAgZmlsZU5hbWU6IGAke3ZlcnNpb25OYW1lfV8ke2xhbmdDb2RlfS5odG1sYFxyXG4gICAgICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICAgICAgLy8g0J7QsdC90L7QstC70Y/QtdC8INC/0YDQvtCz0YDQtdGB0YFcclxuICAgICAgICAgICAgICAgIHRoaXMuc3VwZXJIdG1sUHJvZ3Jlc3MuY3VycmVudFRhc2sgPSBgJHt2ZXJzaW9uTmFtZX0gKCR7bGFuZ0NvZGV9KSDQt9Cw0LLQtdGA0YjQtdC9LCDRgNCw0LfQvNC10YA6ICR7c2l6ZUtCfUtCYDtcclxuICAgICAgICAgICAgICAgIHRoaXMuYW5pbWF0ZVN1cGVySHRtbFByb2dyZXNzKDEwMCwgMTAwMCk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gRmFsbGJhY2sg0LTQu9GPINGB0YLQsNGA0L7Qs9C+INGE0L7RgNC80LDRgtCwIFNVQ0NFU1MgKNCx0LXQtyDQtNC10YLQsNC70YzQvdC+0Lkg0LjQvdGE0L7RgNC80LDRhtC40LgpXHJcbiAgICAgICAgY29uc3Qgc2ltcGxlU3VjY2Vzc01hdGNoID0gbXNnLm1hdGNoKC9cXFtTVVBFUkhUTUxfU1VDQ0VTU1xcXSAoLispLyk7XHJcbiAgICAgICAgaWYgKHNpbXBsZVN1Y2Nlc3NNYXRjaCkge1xyXG4gICAgICAgICAgICB0aGlzLnN1cGVySHRtbFByb2dyZXNzLmN1cnJlbnRUYXNrID0gc2ltcGxlU3VjY2Vzc01hdGNoWzFdO1xyXG4gICAgICAgICAgICAvLyDQn9C70LDQstC90L4g0LTQvtCy0L7QtNC40Lwg0LTQviAxMDAlXHJcbiAgICAgICAgICAgIHRoaXMuYW5pbWF0ZVN1cGVySHRtbFByb2dyZXNzKDEwMCwgMTAwMCk7XHJcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8g0J/QsNGA0YHQuNC8INGB0L7QvtCx0YnQtdC90LjRjyBTRlRQINGBINC30LDQstC10YDRiNC10L3QuNC10Lwg0YTQsNC50LvQvtCyXHJcbiAgICAgICAgLy8g0KTQvtGA0LzQsNGCOiDinIUgJ3ZlcnNpb25OYW1lJyAoU0ZUUCkgfCDwn5WTIHRpbWVcclxuICAgICAgICBjb25zdCBzZnRwQ29tcGxldGVNYXRjaCA9IG1zZy5tYXRjaCgv4pyFXFxzKicoW14nXSspJ1xccypcXChTRlRQXFwpXFxzKlxcfFxccyrwn5WTXFxzKihbXFxkLl0rKXMvKTtcclxuICAgICAgICBpZiAoc2Z0cENvbXBsZXRlTWF0Y2gpIHtcclxuICAgICAgICAgICAgY29uc3QgdmVyc2lvbk5hbWUgPSBzZnRwQ29tcGxldGVNYXRjaFsxXTtcclxuICAgICAgICAgICAgY29uc3QgYnVpbGRUaW1lID0gcGFyc2VGbG9hdChzZnRwQ29tcGxldGVNYXRjaFsyXSk7XHJcblxyXG5cclxuICAgICAgICAgICAgLy8g0JTQu9GPIFNGVFAg0YTQsNC50LvQvtCyINC80Ysg0L3QtSDQt9C90LDQtdC8INGA0LDQt9C80LXRgCwg0L3QviDQvNC+0LbQtdC8INC00L7QsdCw0LLQuNGC0Ywg0YTQsNC50Lsg0YEg0L/RgNC40LzQtdGA0L3Ri9C8INGA0LDQt9C80LXRgNC+0LxcclxuICAgICAgICAgICAgLy8g0LjQu9C4INC/0L7Qv9GA0L7QsdC+0LLQsNGC0Ywg0L/QvtC70YPRh9C40YLRjCDRgNCw0LfQvNC10YAg0LjQtyDRhNCw0LnQu9C+0LLQvtC5INGB0LjRgdGC0LXQvNGLXHJcbiAgICAgICAgICAgIHRoaXMuYnVpbHRGaWxlcy5wdXNoKHtcclxuICAgICAgICAgICAgICAgIHZlcnNpb25OYW1lLFxyXG4gICAgICAgICAgICAgICAgbGFuZ0NvZGU6ICdTRlRQJywgLy8g0KPQutCw0LfRi9Cy0LDQtdC8INGH0YLQviDRjdGC0L4gU0ZUUCDRhNCw0LnQu1xyXG4gICAgICAgICAgICAgICAgYnVpbGRUaW1lLFxyXG4gICAgICAgICAgICAgICAgc2l6ZUtCOiAwLCAvLyDQoNCw0LfQvNC10YAg0L3QtdC40LfQstC10YHRgtC10L0g0LTQu9GPIFNGVFAg0YTQsNC50LvQvtCyXHJcbiAgICAgICAgICAgICAgICBmaWxlTmFtZTogYCR7dmVyc2lvbk5hbWV9X3NmdHAuaHRtbGBcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICB0aGlzLnN1cGVySHRtbFByb2dyZXNzLmN1cnJlbnRUYXNrID0gYCR7dmVyc2lvbk5hbWV9IChTRlRQKSDQt9Cw0LLQtdGA0YjQtdC9INC30LAgJHtidWlsZFRpbWV9c2A7XHJcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gRmFsbGJhY2sg0LTQu9GPINGB0YLQsNGA0YvRhSDQu9C+0LPQvtCyICjQstGA0LXQvNC10L3QvdC+KVxyXG4gICAgICAgIGlmIChtc2cuaW5jbHVkZXMoJ+KPsyDQmNC90LjRhtC40LDQu9C40LfQsNGG0LjRjyDRgdCx0L7RgNC60LguLi4nKSkge1xyXG4gICAgICAgICAgICB0aGlzLnN1cGVySHRtbFByb2dyZXNzLmN1cnJlbnRUYXNrID0gJ9CY0L3QuNGG0LjQsNC70LjQt9Cw0YbQuNGPJztcclxuICAgICAgICAgICAgdGhpcy5hbmltYXRlU3VwZXJIdG1sUHJvZ3Jlc3MoMTAsIDUwMCk7XHJcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH0gZWxzZSBpZiAobXNnLmluY2x1ZGVzKCfij7Mg0JbQtNC10Lwg0L/QsNC60L7QstC60LguLi4nKSkge1xyXG4gICAgICAgICAgICB0aGlzLnN1cGVySHRtbFByb2dyZXNzLmN1cnJlbnRUYXNrID0gJ9Ce0LbQuNC00LDQvdC40LUg0L/QsNC60L7QstC60LgnO1xyXG4gICAgICAgICAgICB0aGlzLmFuaW1hdGVTdXBlckh0bWxQcm9ncmVzcygyMCwgNTAwKTtcclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfSBlbHNlIGlmIChtc2cuaW5jbHVkZXMoJ+KchScpICYmIG1zZy5pbmNsdWRlcygnfCDwn5WTJykgJiYgbXNnLmluY2x1ZGVzKCd8IPCfk6YnKSkge1xyXG4gICAgICAgICAgICB0aGlzLnN1cGVySHRtbFByb2dyZXNzLmN1cnJlbnRUYXNrID0gJ9CX0LDQstC10YDRiNC10L3Qvic7XHJcbiAgICAgICAgICAgIHRoaXMuYW5pbWF0ZVN1cGVySHRtbFByb2dyZXNzKDEwMCwgMTAwMCk7XHJcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog0J/QsNGA0YHQuNC90LMg0YHRgtGA0YPQutGC0YPRgNC40YDQvtCy0LDQvdC90YvRhSBTRlRQINC70L7Qs9C+0LJcclxuICAgICAqL1xyXG4gICAgcGFyc2VTZnRwTG9ncyhtc2c6IHN0cmluZyk6IGJvb2xlYW4ge1xyXG4gICAgICAgIGxldCBoYXNVcGRhdGVzID0gZmFsc2U7XHJcblxyXG5cclxuICAgICAgICAvLyDQn9Cw0YDRgdC40Lwg0L/RgNC+0LPRgNC10YHRgSDQt9Cw0LPRgNGD0LfQutC4XHJcbiAgICAgICAgY29uc3QgcHJvZ3Jlc3NNYXRjaCA9IG1zZy5tYXRjaCgvXFxbU0ZUUF9QUk9HUkVTU1xcXSAoXFxkKylcXC8oXFxkKykgKFtcXGQuXSspJSAoXFxkKylzLyk7XHJcbiAgICAgICAgaWYgKHByb2dyZXNzTWF0Y2gpIHtcclxuICAgICAgICAgICAgY29uc3QgdGFyZ2V0UGVyY2VudGFnZSA9IHBhcnNlRmxvYXQocHJvZ3Jlc3NNYXRjaFszXSk7XHJcbiAgICAgICAgICAgIHRoaXMuc2Z0cFByb2dyZXNzLmN1cnJlbnQgPSBwYXJzZUludChwcm9ncmVzc01hdGNoWzFdKTtcclxuICAgICAgICAgICAgdGhpcy5zZnRwUHJvZ3Jlc3MudG90YWwgPSBwYXJzZUludChwcm9ncmVzc01hdGNoWzJdKTtcclxuICAgICAgICAgICAgdGhpcy5zZnRwUHJvZ3Jlc3MuZXRhID0gcGFyc2VJbnQocHJvZ3Jlc3NNYXRjaFs0XSk7XHJcblxyXG4gICAgICAgICAgICAvLyDQmNGB0L/QvtC70YzQt9GD0LXQvCDQv9C70LDQstC90YPRjiDQsNC90LjQvNCw0YbQuNGOINC00LvRjyDQv9C10YDQtdGF0L7QtNCwINC6INC90L7QstC+0LzRgyDQv9GA0L7RhtC10L3RgtGDXHJcbiAgICAgICAgICAgIHRoaXMuYW5pbWF0ZVNmdHBQcm9ncmVzcyh0YXJnZXRQZXJjZW50YWdlLCA4MDApO1xyXG4gICAgICAgICAgICBoYXNVcGRhdGVzID0gdHJ1ZTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vINCf0LDRgNGB0LjQvCDQvdCw0YfQsNC70L4g0LjQvdGE0L7RgNC80LDRhtC40Lgg0L4g0L/QsNC/0LrQtVxyXG4gICAgICAgIGNvbnN0IGNsZWFuSW5mb1N0YXJ0TWF0Y2ggPSBtc2cubWF0Y2goL1xcW1NGVFBfQ0xFQU5fSU5GT19TVEFSVFxcXSAoLispIChcXGQrKS8pO1xyXG4gICAgICAgIGlmIChjbGVhbkluZm9TdGFydE1hdGNoKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc2Z0cENsZWFuSW5mbyA9IHtcclxuICAgICAgICAgICAgICAgIHBhdGg6IGNsZWFuSW5mb1N0YXJ0TWF0Y2hbMV0sXHJcbiAgICAgICAgICAgICAgICB0b3RhbEl0ZW1zOiBwYXJzZUludChjbGVhbkluZm9TdGFydE1hdGNoWzJdKSxcclxuICAgICAgICAgICAgICAgIGl0ZW1zOiBbXVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICBoYXNVcGRhdGVzID0gdHJ1ZTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vINCf0LDRgNGB0LjQvCDRjdC70LXQvNC10L3RgtGLINC00LvRjyDRg9C00LDQu9C10L3QuNGPXHJcbiAgICAgICAgLy8g0JTQu9GPINC/0LDQv9C+0Lo6IFtTRlRQX0NMRUFOX0lURU1dIEZPTERFUiBuYW1lIHBhdGggLSBwZXJtaXNzaW9ucyBtb2RpZnlUaW1lXHJcbiAgICAgICAgLy8g0JTQu9GPINGE0LDQudC70L7QsjogW1NGVFBfQ0xFQU5fSVRFTV0gRklMRSBuYW1lIHBhdGggc2l6ZSBmb3JtYXR0ZWRTaXplIHBlcm1pc3Npb25zIG1vZGlmeVRpbWVcclxuXHJcbiAgICAgICAgLy8g0J7QsdGA0LDQsdCw0YLRi9Cy0LDQtdC8INCy0YHQtSDRjdC70LXQvNC10L3RgtGLINCyINGB0L7QvtCx0YnQtdC90LjQuCAo0LzQvtC20LXRgiDQsdGL0YLRjCDQvdC10YHQutC+0LvRjNC60L4pXHJcbiAgICAgICAgY29uc3QgZm9sZGVyTWF0Y2hlcyA9IG1zZy5tYXRjaEFsbCgvXFxbU0ZUUF9DTEVBTl9JVEVNXFxdIEZPTERFUiAoLispICguKykgLSAoLispICguKykvZyk7XHJcbiAgICAgICAgZm9yIChjb25zdCBtYXRjaCBvZiBmb2xkZXJNYXRjaGVzKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGl0ZW0gPSB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnRk9MREVSJyxcclxuICAgICAgICAgICAgICAgIG5hbWU6IG1hdGNoWzFdLFxyXG4gICAgICAgICAgICAgICAgcGF0aDogbWF0Y2hbMl0sXHJcbiAgICAgICAgICAgICAgICBzaXplOiB1bmRlZmluZWQsXHJcbiAgICAgICAgICAgICAgICBwZXJtaXNzaW9uczogbWF0Y2hbM10sXHJcbiAgICAgICAgICAgICAgICBtb2RpZnlUaW1lOiBtYXRjaFs0XVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICB0aGlzLnNmdHBDbGVhbkluZm8uaXRlbXMucHVzaChpdGVtKTtcclxuICAgICAgICAgICAgaGFzVXBkYXRlcyA9IHRydWU7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCBmaWxlTWF0Y2hlcyA9IG1zZy5tYXRjaEFsbCgvXFxbU0ZUUF9DTEVBTl9JVEVNXFxdIEZJTEUgKC4rKSAoLispICguKykgKC4rKSAoLispICguKykvZyk7XHJcbiAgICAgICAgZm9yIChjb25zdCBtYXRjaCBvZiBmaWxlTWF0Y2hlcykge1xyXG4gICAgICAgICAgICBjb25zdCBpdGVtID0ge1xyXG4gICAgICAgICAgICAgICAgdHlwZTogJ0ZJTEUnLFxyXG4gICAgICAgICAgICAgICAgbmFtZTogbWF0Y2hbMV0sXHJcbiAgICAgICAgICAgICAgICBwYXRoOiBtYXRjaFsyXSxcclxuICAgICAgICAgICAgICAgIHNpemU6IG1hdGNoWzRdLCAvLyBmb3JtYXR0ZWRTaXplXHJcbiAgICAgICAgICAgICAgICBwZXJtaXNzaW9uczogbWF0Y2hbNV0sXHJcbiAgICAgICAgICAgICAgICBtb2RpZnlUaW1lOiBtYXRjaFs2XVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICB0aGlzLnNmdHBDbGVhbkluZm8uaXRlbXMucHVzaChpdGVtKTtcclxuICAgICAgICAgICAgaGFzVXBkYXRlcyA9IHRydWU7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDQn9Cw0YDRgdC40Lwg0YHRgtCw0YLQuNGB0YLQuNC60YNcclxuICAgICAgICBjb25zdCBjbGVhblN0YXRzTWF0Y2ggPSBtc2cubWF0Y2goL1xcW1NGVFBfQ0xFQU5fU1RBVFNcXF0gKFxcZCspIChcXGQrKSAoXFxkKykgKFxcZCspICguKykvKTtcclxuICAgICAgICBpZiAoY2xlYW5TdGF0c01hdGNoKSB7XHJcbiAgICAgICAgICAgIC8vINCe0LHQvdC+0LLQu9GP0LXQvCDRgdGC0LDRgtC40YHRgtC40LrRgyDQsiDQuNC90YLQtdGA0YTQtdC50YHQtVxyXG4gICAgICAgICAgICB0aGlzLnVwZGF0ZVNmdHBDbGVhbkluZm8oKTtcclxuICAgICAgICAgICAgaGFzVXBkYXRlcyA9IHRydWU7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDQntCx0L3QvtCy0LvRj9C10Lwg0LjQvdGC0LXRgNGE0LXQudGBINC/0L7RgdC70LUg0LrQsNC20LTQvtCz0L4g0LTQvtCx0LDQstC70LXQvdC40Y8g0Y3Qu9C10LzQtdC90YLQsFxyXG4gICAgICAgIGlmIChoYXNVcGRhdGVzKSB7XHJcbiAgICAgICAgICAgIHRoaXMudXBkYXRlU2Z0cENsZWFuSW5mbygpO1xyXG4gICAgICAgIH1cclxuXHJcblxyXG4gICAgICAgIC8vIEZhbGxiYWNrINC00LvRjyDRgdGC0LDRgNGL0YUg0LvQvtCz0L7QsiBTRlRQICjQstGA0LXQvNC10L3QvdC+KVxyXG4gICAgICAgIGlmIChtc2cuaW5jbHVkZXMoJ1NGVFAg0LfQsNC70LjQstC60LAg0L3QsNGH0LDQu9Cw0YHRjCcpKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc2Z0cFByb2dyZXNzLmN1cnJlbnRUYXNrID0gJ9CY0L3QuNGG0LjQsNC70LjQt9Cw0YbQuNGPJztcclxuICAgICAgICAgICAgdGhpcy5hbmltYXRlU2Z0cFByb2dyZXNzKDEwLCA1MDApO1xyXG4gICAgICAgICAgICBoYXNVcGRhdGVzID0gdHJ1ZTtcclxuICAgICAgICB9IGVsc2UgaWYgKG1zZy5pbmNsdWRlcygn0J/QvtC00LrQu9GO0YfQtdC90LjQtSDQuiDRgdC10YDQstC10YDRgycpKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc2Z0cFByb2dyZXNzLmN1cnJlbnRUYXNrID0gJ9Cf0L7QtNC60LvRjtGH0LXQvdC40LUnO1xyXG4gICAgICAgICAgICB0aGlzLmFuaW1hdGVTZnRwUHJvZ3Jlc3MoMjAsIDUwMCk7XHJcbiAgICAgICAgICAgIGhhc1VwZGF0ZXMgPSB0cnVlO1xyXG4gICAgICAgIH0gZWxzZSBpZiAobXNnLmluY2x1ZGVzKCfQl9Cw0LPRgNGD0LfQutCwINGE0LDQudC70L7QsicpKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc2Z0cFByb2dyZXNzLmN1cnJlbnRUYXNrID0gJ9CX0LDQs9GA0YPQt9C60LAg0YTQsNC50LvQvtCyJztcclxuICAgICAgICAgICAgdGhpcy5hbmltYXRlU2Z0cFByb2dyZXNzKDUwLCA1MDApO1xyXG4gICAgICAgICAgICBoYXNVcGRhdGVzID0gdHJ1ZTtcclxuICAgICAgICB9IGVsc2UgaWYgKG1zZy5pbmNsdWRlcygnU0ZUUCDQt9Cw0LvQuNCy0LrQsCDQt9Cw0LLQtdGA0YjQtdC90LAg0YPRgdC/0LXRiNC90L4nKSkge1xyXG4gICAgICAgICAgICB0aGlzLnNmdHBQcm9ncmVzcy5jdXJyZW50VGFzayA9ICfQl9Cw0LLQtdGA0YjQtdC90L4nO1xyXG4gICAgICAgICAgICB0aGlzLmFuaW1hdGVTZnRwUHJvZ3Jlc3MoMTAwLCAxMDAwKTtcclxuICAgICAgICAgICAgaGFzVXBkYXRlcyA9IHRydWU7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gaGFzVXBkYXRlcztcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqINCe0LHQvdC+0LLQu9C10L3QuNC1INC/0YDQvtCz0YDQtdGB0YHQsCDQvtGB0L3QvtCy0L3QvtCz0L4g0LHQuNC70LTQsCDQsiDQuNC90YLQtdGA0YTQtdC50YHQtVxyXG4gICAgICovXHJcbiAgICB1cGRhdGVNYWluQnVpbGRQcm9ncmVzcygpOiB2b2lkIHtcclxuICAgICAgICBjb25zdCBwcm9ncmVzc01haW5UaW1lID0gdGhpcy51aUVsZW1lbnRzLnByb2dyZXNzTWFpblRpbWU7XHJcbiAgICAgICAgY29uc3QgcHJvZ3Jlc3NNYWluID0gdGhpcy51aUVsZW1lbnRzLnByb2dyZXNzTWFpbjtcclxuXHJcbiAgICAgICAgaWYgKHByb2dyZXNzTWFpblRpbWUpIHtcclxuICAgICAgICAgICAgcHJvZ3Jlc3NNYWluVGltZS50ZXh0Q29udGVudCA9IGBbJHt0aGlzLm1haW5CdWlsZEN1cnJlbnRUaW1lfV1gO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8g0J7QsdC90L7QstC70Y/QtdC8INC/0YDQvtCz0YDQtdGB0YEt0LHQsNGAICjQstGB0Y8g0L/QsNC90LXQu9GM0LrQsClcclxuICAgICAgICBpZiAocHJvZ3Jlc3NNYWluKSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLm1haW5CdWlsZFByb2dyZXNzLnBlcmNlbnRhZ2UgPiAwKSB7XHJcbiAgICAgICAgICAgICAgICAvLyDQo9GB0YLQsNC90LDQstC70LjQstCw0LXQvCDRiNC40YDQuNC90YMg0L/RgNC+0LPRgNC10YHRgS3QsdCw0YDQsCDRh9C10YDQtdC3IENTUy3Qv9C10YDQtdC80LXQvdC90YPRjlxyXG4gICAgICAgICAgICAgICAgcHJvZ3Jlc3NNYWluLnN0eWxlLnNldFByb3BlcnR5KCctLXByb2dyZXNzLXdpZHRoJywgYCR7dGhpcy5tYWluQnVpbGRQcm9ncmVzcy5wZXJjZW50YWdlfSVgKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHByb2dyZXNzTWFpbi5zdHlsZS5zZXRQcm9wZXJ0eSgnLS1wcm9ncmVzcy13aWR0aCcsICcwJScpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog0J7QsdC90L7QstC70LXQvdC40LUg0L/RgNC+0LPRgNC10YHRgdCwIFN1cGVySFRNTCDQsiDQuNC90YLQtdGA0YTQtdC50YHQtVxyXG4gICAgICovXHJcbiAgICB1cGRhdGVTdXBlckh0bWxQcm9ncmVzcygpOiB2b2lkIHtcclxuICAgICAgICBjb25zdCBwcm9ncmVzc1N1cGVySHRtbFRpbWUgPSB0aGlzLnVpRWxlbWVudHMucHJvZ3Jlc3NTdXBlcmh0bWxUaW1lO1xyXG4gICAgICAgIGNvbnN0IHByb2dyZXNzU3VwZXJIdG1sID0gdGhpcy51aUVsZW1lbnRzLnByb2dyZXNzU3VwZXJodG1sO1xyXG5cclxuICAgICAgICBpZiAocHJvZ3Jlc3NTdXBlckh0bWxUaW1lKSB7XHJcbiAgICAgICAgICAgIHByb2dyZXNzU3VwZXJIdG1sVGltZS50ZXh0Q29udGVudCA9IGBbJHt0aGlzLnN1cGVySHRtbEN1cnJlbnRUaW1lfV1gO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8g0J7QsdC90L7QstC70Y/QtdC8INC/0YDQvtCz0YDQtdGB0YEt0LHQsNGAICjQstGB0Y8g0L/QsNC90LXQu9GM0LrQsClcclxuICAgICAgICBpZiAocHJvZ3Jlc3NTdXBlckh0bWwpIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMuc3VwZXJIdG1sUHJvZ3Jlc3MucGVyY2VudGFnZSA+IDApIHtcclxuICAgICAgICAgICAgICAgIC8vINCj0YHRgtCw0L3QsNCy0LvQuNCy0LDQtdC8INGI0LjRgNC40L3RgyDQv9GA0L7Qs9GA0LXRgdGBLdCx0LDRgNCwINGH0LXRgNC10LcgQ1NTLdC/0LXRgNC10LzQtdC90L3Rg9GOXHJcbiAgICAgICAgICAgICAgICBwcm9ncmVzc1N1cGVySHRtbC5zdHlsZS5zZXRQcm9wZXJ0eSgnLS1wcm9ncmVzcy13aWR0aCcsIGAke3RoaXMuc3VwZXJIdG1sUHJvZ3Jlc3MucGVyY2VudGFnZX0lYCk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBwcm9ncmVzc1N1cGVySHRtbC5zdHlsZS5zZXRQcm9wZXJ0eSgnLS1wcm9ncmVzcy13aWR0aCcsICcwJScpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog0J7QsdC90L7QstC70LXQvdC40LUg0L/RgNC+0LPRgNC10YHRgdCwIFNGVFAg0LIg0LjQvdGC0LXRgNGE0LXQudGB0LVcclxuICAgICAqL1xyXG4gICAgdXBkYXRlU2Z0cFByb2dyZXNzKCk6IHZvaWQge1xyXG4gICAgICAgIGNvbnN0IHByb2dyZXNzU2Z0cFRpbWUgPSB0aGlzLnVpRWxlbWVudHMucHJvZ3Jlc3NTZnRwVGltZTtcclxuICAgICAgICBjb25zdCBwcm9ncmVzc1NmdHAgPSB0aGlzLnVpRWxlbWVudHMucHJvZ3Jlc3NTZnRwO1xyXG5cclxuICAgICAgICBpZiAocHJvZ3Jlc3NTZnRwVGltZSkge1xyXG4gICAgICAgICAgICAvLyDQntCx0L3QvtCy0LvRj9C10Lwg0LLRgNC10LzRjyDRgtC+0LvRjNC60L4g0LXRgdC70Lgg0YMg0L3QsNGBINC10YHRgtGMINC00LDQvdC90YvQtSDQviDQv9GA0L7Qs9GA0LXRgdGB0LVcclxuICAgICAgICAgICAgaWYgKHRoaXMuc2Z0cFByb2dyZXNzLnRvdGFsID4gMCkge1xyXG4gICAgICAgICAgICAgICAgcHJvZ3Jlc3NTZnRwVGltZS50ZXh0Q29udGVudCA9IGBbJHt0aGlzLnNmdHBDdXJyZW50VGltZX1dIFske3RoaXMuc2Z0cFByb2dyZXNzLmN1cnJlbnR9LyR7dGhpcy5zZnRwUHJvZ3Jlc3MudG90YWx9XSAke3RoaXMuc2Z0cFByb2dyZXNzLnBlcmNlbnRhZ2V9JWA7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBwcm9ncmVzc1NmdHBUaW1lLnRleHRDb250ZW50ID0gYFske3RoaXMuc2Z0cEN1cnJlbnRUaW1lfV1gO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDQntCx0L3QvtCy0LvRj9C10Lwg0L/RgNC+0LPRgNC10YHRgS3QsdCw0YAgKNCy0YHRjyDQv9Cw0L3QtdC70YzQutCwKVxyXG4gICAgICAgIGlmIChwcm9ncmVzc1NmdHApIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMuc2Z0cFByb2dyZXNzLnRvdGFsID4gMCkge1xyXG4gICAgICAgICAgICAgICAgLy8g0KPRgdGC0LDQvdCw0LLQu9C40LLQsNC10Lwg0YjQuNGA0LjQvdGDINC/0YDQvtCz0YDQtdGB0YEt0LHQsNGA0LAg0YfQtdGA0LXQtyBDU1Mt0L/QtdGA0LXQvNC10L3QvdGD0Y5cclxuICAgICAgICAgICAgICAgIHByb2dyZXNzU2Z0cC5zdHlsZS5zZXRQcm9wZXJ0eSgnLS1wcm9ncmVzcy13aWR0aCcsIGAke3RoaXMuc2Z0cFByb2dyZXNzLnBlcmNlbnRhZ2V9JWApO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgcHJvZ3Jlc3NTZnRwLnN0eWxlLnNldFByb3BlcnR5KCctLXByb2dyZXNzLXdpZHRoJywgJzAlJyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDQntCx0L3QvtCy0LvQtdC90LjQtSDQuNC90YTQvtGA0LzQsNGG0LjQuCDQviDQv9Cw0L/QutCw0YUg0LTQu9GPINGD0LTQsNC70LXQvdC40Y9cclxuICAgICAqL1xyXG4gICAgdXBkYXRlU2Z0cENsZWFuSW5mbygpOiB2b2lkIHtcclxuICAgICAgICBjb25zdCBzZnRwQ2xlYW5JbmZvRWxlbWVudCA9IHRoaXMudWlFbGVtZW50cy5zZnRwQ2xlYW5JbmZvO1xyXG4gICAgICAgIGlmIChzZnRwQ2xlYW5JbmZvRWxlbWVudCAmJiB0aGlzLnNmdHBDbGVhbkluZm8uaXRlbXMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgICBsZXQgaHRtbCA9IGA8ZGl2IGNsYXNzPVwic2Z0cC1jbGVhbi1oZWFkZXJcIj5cclxuICAgICAgICAgICAgICAgIDxoND5Gb2xkZXI6ICR7dGhpcy5zZnRwQ2xlYW5JbmZvLnBhdGh9PC9oND5cclxuICAgICAgICAgICAgICAgIDxwPlRvdGFsIGl0ZW1zOiAke3RoaXMuc2Z0cENsZWFuSW5mby50b3RhbEl0ZW1zfTwvcD5cclxuICAgICAgICAgICAgPC9kaXY+YDtcclxuXHJcbiAgICAgICAgICAgIC8vINCT0YDRg9C/0L/QuNGA0YPQtdC8INC/0L4g0YLQuNC/0LDQvFxyXG4gICAgICAgICAgICBjb25zdCBmb2xkZXJzID0gdGhpcy5zZnRwQ2xlYW5JbmZvLml0ZW1zLmZpbHRlcihpdGVtID0+IGl0ZW0udHlwZSA9PT0gJ0ZPTERFUicpO1xyXG4gICAgICAgICAgICBjb25zdCBmaWxlcyA9IHRoaXMuc2Z0cENsZWFuSW5mby5pdGVtcy5maWx0ZXIoaXRlbSA9PiBpdGVtLnR5cGUgPT09ICdGSUxFJyk7XHJcblxyXG5cclxuICAgICAgICAgICAgaWYgKGZvbGRlcnMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgICAgICAgaHRtbCArPSAnPGRpdiBjbGFzcz1cInNmdHAtY2xlYW4tZ3JvdXBcIj4nO1xyXG4gICAgICAgICAgICAgICAgaHRtbCArPSBgPGg1PkZvbGRlcnMgKCR7Zm9sZGVycy5sZW5ndGh9KTo8L2g1PmA7XHJcbiAgICAgICAgICAgICAgICBmb2xkZXJzLmZvckVhY2goZm9sZGVyID0+IHtcclxuICAgICAgICAgICAgICAgICAgICBodG1sICs9IGA8ZGl2IGNsYXNzPVwic2Z0cC1jbGVhbi1pdGVtIGZvbGRlclwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiaXRlbS1uYW1lXCI+JHtmb2xkZXIubmFtZX08L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5gO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICBodG1sICs9ICc8L2Rpdj4nO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBpZiAoZmlsZXMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgICAgICAgaHRtbCArPSAnPGRpdiBjbGFzcz1cInNmdHAtY2xlYW4tZ3JvdXBcIj4nO1xyXG4gICAgICAgICAgICAgICAgaHRtbCArPSBgPGg1PkZpbGVzICgke2ZpbGVzLmxlbmd0aH0pOjwvaDU+YDtcclxuICAgICAgICAgICAgICAgIGZpbGVzLmZvckVhY2goZmlsZSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgaHRtbCArPSBgPGRpdiBjbGFzcz1cInNmdHAtY2xlYW4taXRlbSBmaWxlXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJpdGVtLW5hbWVcIj4ke2ZpbGUubmFtZX08L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5gO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICBodG1sICs9ICc8L2Rpdj4nO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvLyDQlNC+0LHQsNCy0LvRj9C10Lwg0L/RgNC10LTRg9C/0YDQtdC20LTQtdC90LjQtVxyXG4gICAgICAgICAgICBodG1sICs9ICc8ZGl2IGNsYXNzPVwic2Z0cC1jbGVhbi13YXJuaW5nXCI+JztcclxuICAgICAgICAgICAgaHRtbCArPSAnPGRpdiBjbGFzcz1cIndhcm5pbmctdGV4dFwiPkFsbCB0aGVzZSBpdGVtcyB3aWxsIGJlIGRlbGV0ZWQhPC9kaXY+JztcclxuICAgICAgICAgICAgaHRtbCArPSAnPC9kaXY+JztcclxuXHJcblxyXG4gICAgICAgICAgICBzZnRwQ2xlYW5JbmZvRWxlbWVudC5pbm5lckhUTUwgPSBodG1sO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqINCf0LvQsNCy0L3QsNGPINCw0L3QuNC80LDRhtC40Y8g0L/RgNC+0LPRgNC10YHRgdCwIFN1cGVySFRNTFxyXG4gICAgICovXHJcbiAgICBhbmltYXRlU3VwZXJIdG1sUHJvZ3Jlc3ModGFyZ2V0UGVyY2VudGFnZTogbnVtYmVyLCBkdXJhdGlvbjogbnVtYmVyID0gMTAwMCk6IHZvaWQge1xyXG4gICAgICAgIC8vINCe0YHRgtCw0L3QsNCy0LvQuNCy0LDQtdC8INC/0YDQtdC00YvQtNGD0YnRg9GOINCw0L3QuNC80LDRhtC40Y5cclxuICAgICAgICBpZiAodGhpcy5zdXBlckh0bWxBbmltYXRpb25JbnRlcnZhbCkge1xyXG4gICAgICAgICAgICBjbGVhckludGVydmFsKHRoaXMuc3VwZXJIdG1sQW5pbWF0aW9uSW50ZXJ2YWwpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3Qgc3RhcnRQZXJjZW50YWdlID0gdGhpcy5zdXBlckh0bWxQcm9ncmVzcy5wZXJjZW50YWdlO1xyXG4gICAgICAgIGNvbnN0IGRpZmZlcmVuY2UgPSB0YXJnZXRQZXJjZW50YWdlIC0gc3RhcnRQZXJjZW50YWdlO1xyXG4gICAgICAgIGNvbnN0IHN0YXJ0VGltZSA9IERhdGUubm93KCk7XHJcblxyXG4gICAgICAgIHRoaXMuc3VwZXJIdG1sQW5pbWF0aW9uSW50ZXJ2YWwgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IGVsYXBzZWQgPSBEYXRlLm5vdygpIC0gc3RhcnRUaW1lO1xyXG4gICAgICAgICAgICBjb25zdCBwcm9ncmVzcyA9IE1hdGgubWluKGVsYXBzZWQgLyBkdXJhdGlvbiwgMSk7XHJcblxyXG4gICAgICAgICAgICAvLyDQmNGB0L/QvtC70YzQt9GD0LXQvCBlYXNpbmcg0YTRg9C90LrRhtC40Y4g0LTQu9GPINC/0LvQsNCy0L3QvtGB0YLQuFxyXG4gICAgICAgICAgICBjb25zdCBlYXNlUHJvZ3Jlc3MgPSAxIC0gTWF0aC5wb3coMSAtIHByb2dyZXNzLCAzKTtcclxuICAgICAgICAgICAgY29uc3QgY3VycmVudFBlcmNlbnRhZ2UgPSBzdGFydFBlcmNlbnRhZ2UgKyAoZGlmZmVyZW5jZSAqIGVhc2VQcm9ncmVzcyk7XHJcblxyXG4gICAgICAgICAgICB0aGlzLnN1cGVySHRtbFByb2dyZXNzLnBlcmNlbnRhZ2UgPSBjdXJyZW50UGVyY2VudGFnZTtcclxuICAgICAgICAgICAgdGhpcy51cGRhdGVTdXBlckh0bWxQcm9ncmVzcygpO1xyXG5cclxuICAgICAgICAgICAgaWYgKHByb2dyZXNzID49IDEpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuc3VwZXJIdG1sUHJvZ3Jlc3MucGVyY2VudGFnZSA9IHRhcmdldFBlcmNlbnRhZ2U7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZVN1cGVySHRtbFByb2dyZXNzKCk7XHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5zdXBlckh0bWxBbmltYXRpb25JbnRlcnZhbCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5zdXBlckh0bWxBbmltYXRpb25JbnRlcnZhbCk7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zdXBlckh0bWxBbmltYXRpb25JbnRlcnZhbCA9IG51bGw7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LCAxNik7IC8vIH42MCBGUFNcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqINCf0LvQsNCy0L3QsNGPINCw0L3QuNC80LDRhtC40Y8g0L/RgNC+0LPRgNC10YHRgdCwIFNGVFBcclxuICAgICAqL1xyXG4gICAgYW5pbWF0ZVNmdHBQcm9ncmVzcyh0YXJnZXRQZXJjZW50YWdlOiBudW1iZXIsIGR1cmF0aW9uOiBudW1iZXIgPSAxMDAwKTogdm9pZCB7XHJcbiAgICAgICAgLy8g0J7RgdGC0LDQvdCw0LLQu9C40LLQsNC10Lwg0L/RgNC10LTRi9C00YPRidGD0Y4g0LDQvdC40LzQsNGG0LjRjlxyXG4gICAgICAgIGlmICh0aGlzLnNmdHBBbmltYXRpb25JbnRlcnZhbCkge1xyXG4gICAgICAgICAgICBjbGVhckludGVydmFsKHRoaXMuc2Z0cEFuaW1hdGlvbkludGVydmFsKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNvbnN0IHN0YXJ0UGVyY2VudGFnZSA9IHRoaXMuc2Z0cFByb2dyZXNzLnBlcmNlbnRhZ2U7XHJcbiAgICAgICAgY29uc3QgZGlmZmVyZW5jZSA9IHRhcmdldFBlcmNlbnRhZ2UgLSBzdGFydFBlcmNlbnRhZ2U7XHJcbiAgICAgICAgY29uc3Qgc3RhcnRUaW1lID0gRGF0ZS5ub3coKTtcclxuXHJcbiAgICAgICAgdGhpcy5zZnRwQW5pbWF0aW9uSW50ZXJ2YWwgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IGVsYXBzZWQgPSBEYXRlLm5vdygpIC0gc3RhcnRUaW1lO1xyXG4gICAgICAgICAgICBjb25zdCBwcm9ncmVzcyA9IE1hdGgubWluKGVsYXBzZWQgLyBkdXJhdGlvbiwgMSk7XHJcblxyXG4gICAgICAgICAgICAvLyDQmNGB0L/QvtC70YzQt9GD0LXQvCBlYXNpbmcg0YTRg9C90LrRhtC40Y4g0LTQu9GPINC/0LvQsNCy0L3QvtGB0YLQuFxyXG4gICAgICAgICAgICBjb25zdCBlYXNlUHJvZ3Jlc3MgPSAxIC0gTWF0aC5wb3coMSAtIHByb2dyZXNzLCAzKTtcclxuICAgICAgICAgICAgY29uc3QgY3VycmVudFBlcmNlbnRhZ2UgPSBzdGFydFBlcmNlbnRhZ2UgKyAoZGlmZmVyZW5jZSAqIGVhc2VQcm9ncmVzcyk7XHJcblxyXG4gICAgICAgICAgICB0aGlzLnNmdHBQcm9ncmVzcy5wZXJjZW50YWdlID0gY3VycmVudFBlcmNlbnRhZ2U7XHJcbiAgICAgICAgICAgIHRoaXMudXBkYXRlU2Z0cFByb2dyZXNzKCk7XHJcblxyXG4gICAgICAgICAgICBpZiAocHJvZ3Jlc3MgPj0gMSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5zZnRwUHJvZ3Jlc3MucGVyY2VudGFnZSA9IHRhcmdldFBlcmNlbnRhZ2U7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZVNmdHBQcm9ncmVzcygpO1xyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuc2Z0cEFuaW1hdGlvbkludGVydmFsKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLnNmdHBBbmltYXRpb25JbnRlcnZhbCk7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zZnRwQW5pbWF0aW9uSW50ZXJ2YWwgPSBudWxsO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSwgMTYpOyAvLyB+NjAgRlBTXHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDQl9Cw0L/Rg9GB0Log0L7RgtGB0LvQtdC20LjQstCw0L3QuNGPINCy0YDQtdC80LXQvdC4INGN0YLQsNC/0LBcclxuICAgICAqL1xyXG4gICAgc3RhcnRTdGFnZVRpbWluZyhzdGFnZTogJ21haW5CdWlsZCcgfCAnc3VwZXJIdG1sQnVpbGQnIHwgJ3NmdHBMb2FkJyk6IHZvaWQge1xyXG4gICAgICAgIHRoaXMuc3RhZ2VUaW1pbmdzW3N0YWdlXSA9IHsgc3RhcnQ6IG5ldyBEYXRlKCkgfTtcclxuXHJcbiAgICAgICAgLy8g0JfQsNC/0YPRgdC60LDQtdC8INC+0LHQvdC+0LLQu9C10L3QuNC1INCy0YDQtdC80LXQvdC4INCyINGA0LXQsNC70YzQvdC+0Lwg0LLRgNC10LzQtdC90LhcclxuICAgICAgICB0aGlzLnN0YXJ0UHJvZ3Jlc3NUaW1lVXBkYXRlKHN0YWdlKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqINCX0LDQstC10YDRiNC10L3QuNC1INC+0YLRgdC70LXQttC40LLQsNC90LjRjyDQstGA0LXQvNC10L3QuCDRjdGC0LDQv9CwXHJcbiAgICAgKi9cclxuICAgIGVuZFN0YWdlVGltaW5nKHN0YWdlOiAnbWFpbkJ1aWxkJyB8ICdzdXBlckh0bWxCdWlsZCcgfCAnc2Z0cExvYWQnKTogdm9pZCB7XHJcbiAgICAgICAgaWYgKHRoaXMuc3RhZ2VUaW1pbmdzW3N0YWdlXSkge1xyXG4gICAgICAgICAgICB0aGlzLnN0YWdlVGltaW5nc1tzdGFnZV0uZW5kID0gbmV3IERhdGUoKTtcclxuICAgICAgICAgICAgdGhpcy5zdGFnZVRpbWluZ3Nbc3RhZ2VdLmR1cmF0aW9uID0gTWF0aC5yb3VuZChcclxuICAgICAgICAgICAgICAgICh0aGlzLnN0YWdlVGltaW5nc1tzdGFnZV0uZW5kIS5nZXRUaW1lKCkgLSB0aGlzLnN0YWdlVGltaW5nc1tzdGFnZV0uc3RhcnQuZ2V0VGltZSgpKSAvIDEwMDBcclxuICAgICAgICAgICAgKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vINCe0YHRgtCw0L3QsNCy0LvQuNCy0LDQtdC8INC+0LHQvdC+0LLQu9C10L3QuNC1INCy0YDQtdC80LXQvdC4INCyINGA0LXQsNC70YzQvdC+0Lwg0LLRgNC10LzQtdC90LhcclxuICAgICAgICB0aGlzLnN0b3BQcm9ncmVzc1RpbWVVcGRhdGUoc3RhZ2UpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog0KTQvtGA0LzQsNGC0LjRgNC+0LLQsNC90LjQtSDQstGA0LXQvNC10L3QuCDRjdGC0LDQv9CwXHJcbiAgICAgKi9cclxuICAgIGZvcm1hdFN0YWdlVGltZShkdXJhdGlvbjogbnVtYmVyKTogc3RyaW5nIHtcclxuICAgICAgICBjb25zdCBtaW51dGVzID0gTWF0aC5mbG9vcihkdXJhdGlvbiAvIDYwKTtcclxuICAgICAgICBjb25zdCBzZWNvbmRzID0gZHVyYXRpb24gJSA2MDtcclxuICAgICAgICByZXR1cm4gYCR7bWludXRlc33QvCAke3NlY29uZHN90YFgO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog0JfQsNC/0YPRgdC6INC+0LHQvdC+0LLQu9C10L3QuNGPINCy0YDQtdC80LXQvdC4INCyINGA0LXQsNC70YzQvdC+0Lwg0LLRgNC10LzQtdC90LhcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBzdGFydFByb2dyZXNzVGltZVVwZGF0ZShzdGFnZTogJ21haW5CdWlsZCcgfCAnc3VwZXJIdG1sQnVpbGQnIHwgJ3NmdHBMb2FkJyk6IHZvaWQge1xyXG4gICAgICAgIGxldCB0aW1lRWxlbWVudDogSFRNTEVsZW1lbnQgfCBudWxsID0gbnVsbDtcclxuXHJcbiAgICAgICAgc3dpdGNoIChzdGFnZSkge1xyXG4gICAgICAgICAgICBjYXNlICdtYWluQnVpbGQnOlxyXG4gICAgICAgICAgICAgICAgdGltZUVsZW1lbnQgPSB0aGlzLnVpRWxlbWVudHMucHJvZ3Jlc3NNYWluVGltZSB8fCBudWxsO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgJ3N1cGVySHRtbEJ1aWxkJzpcclxuICAgICAgICAgICAgICAgIHRpbWVFbGVtZW50ID0gdGhpcy51aUVsZW1lbnRzLnByb2dyZXNzU3VwZXJodG1sVGltZSB8fCBudWxsO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgJ3NmdHBMb2FkJzpcclxuICAgICAgICAgICAgICAgIHRpbWVFbGVtZW50ID0gdGhpcy51aUVsZW1lbnRzLnByb2dyZXNzU2Z0cFRpbWUgfHwgbnVsbDtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKCF0aW1lRWxlbWVudCkgcmV0dXJuO1xyXG5cclxuICAgICAgICAvLyDQntGH0LjRidCw0LXQvCDQv9GA0LXQtNGL0LTRg9GJ0LjQuSDQuNC90YLQtdGA0LLQsNC7INC10YHQu9C4INC10YHRgtGMXHJcbiAgICAgICAgaWYgKHRoaXMucHJvZ3Jlc3NUaW1lSW50ZXJ2YWxzW3N0YWdlXSkge1xyXG4gICAgICAgICAgICBjbGVhckludGVydmFsKHRoaXMucHJvZ3Jlc3NUaW1lSW50ZXJ2YWxzW3N0YWdlXSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDQl9Cw0L/Rg9GB0LrQsNC10Lwg0L3QvtCy0YvQuSDQuNC90YLQtdGA0LLQsNC7XHJcbiAgICAgICAgdGhpcy5wcm9ncmVzc1RpbWVJbnRlcnZhbHNbc3RhZ2VdID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5zdGFnZVRpbWluZ3Nbc3RhZ2VdICYmIHRoaXMuc3RhZ2VUaW1pbmdzW3N0YWdlXS5zdGFydCkge1xyXG4gICAgICAgICAgICAgICAgY29uc3Qgbm93ID0gbmV3IERhdGUoKTtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGVsYXBzZWQgPSBNYXRoLnJvdW5kKChub3cuZ2V0VGltZSgpIC0gdGhpcy5zdGFnZVRpbWluZ3Nbc3RhZ2VdLnN0YXJ0LmdldFRpbWUoKSkgLyAxMDAwKTtcclxuICAgICAgICAgICAgICAgIGNvbnN0IG1pbnV0ZXMgPSBNYXRoLmZsb29yKGVsYXBzZWQgLyA2MCk7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBzZWNvbmRzID0gZWxhcHNlZCAlIDYwO1xyXG4gICAgICAgICAgICAgICAgY29uc3QgdGltZVN0cmluZyA9IGAke21pbnV0ZXN90LwgJHtzZWNvbmRzfdGBYDtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyDQodC+0YXRgNCw0L3Rj9C10Lwg0LLRgNC10LzRjyDQtNC70Y8g0YHQvtC+0YLQstC10YLRgdGC0LLRg9GO0YnQtdCz0L4g0Y3RgtCw0L/QsFxyXG4gICAgICAgICAgICAgICAgaWYgKHN0YWdlID09PSAnc2Z0cExvYWQnKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zZnRwQ3VycmVudFRpbWUgPSB0aW1lU3RyaW5nO1xyXG4gICAgICAgICAgICAgICAgICAgIC8vINCe0LHQvdC+0LLQu9GP0LXQvCDQv9GA0L7Qs9GA0LXRgdGBINC10YHQu9C4INC10YHRgtGMINC00LDQvdC90YvQtVxyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLnNmdHBQcm9ncmVzcy50b3RhbCA+IDApIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy51cGRhdGVTZnRwUHJvZ3Jlc3MoKTtcclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aW1lRWxlbWVudC50ZXh0Q29udGVudCA9IGBbJHt0aW1lU3RyaW5nfV1gO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoc3RhZ2UgPT09ICdtYWluQnVpbGQnKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8g0KHQvtGF0YDQsNC90Y/QtdC8INCy0YDQtdC80Y8g0LTQu9GPINC+0YHQvdC+0LLQvdC+0LPQviDQsdC40LvQtNCwXHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tYWluQnVpbGRDdXJyZW50VGltZSA9IHRpbWVTdHJpbmc7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8g0J7QsdC90L7QstC70Y/QtdC8INC/0YDQvtCz0YDQtdGB0YEg0LXRgdC70Lgg0LXRgdGC0Ywg0LTQsNC90L3Ri9C1XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMubWFpbkJ1aWxkUHJvZ3Jlc3MucGVyY2VudGFnZSA+IDApIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy51cGRhdGVNYWluQnVpbGRQcm9ncmVzcygpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRpbWVFbGVtZW50LnRleHRDb250ZW50ID0gYFske3RpbWVTdHJpbmd9XWA7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChzdGFnZSA9PT0gJ3N1cGVySHRtbEJ1aWxkJykge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vINCh0L7RhdGA0LDQvdGP0LXQvCDQstGA0LXQvNGPINC00LvRjyBTdXBlckhUTUwg0LHQuNC70LTQsFxyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc3VwZXJIdG1sQ3VycmVudFRpbWUgPSB0aW1lU3RyaW5nO1xyXG4gICAgICAgICAgICAgICAgICAgIHRpbWVFbGVtZW50LnRleHRDb250ZW50ID0gYFske3RpbWVTdHJpbmd9XWA7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LCAxMDAwKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqINCe0YHRgtCw0L3QvtCy0LrQsCDQvtCx0L3QvtCy0LvQtdC90LjRjyDQstGA0LXQvNC10L3QuCDQsiDRgNC10LDQu9GM0L3QvtC8INCy0YDQtdC80LXQvdC4XHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgc3RvcFByb2dyZXNzVGltZVVwZGF0ZShzdGFnZTogJ21haW5CdWlsZCcgfCAnc3VwZXJIdG1sQnVpbGQnIHwgJ3NmdHBMb2FkJyk6IHZvaWQge1xyXG4gICAgICAgIGlmICh0aGlzLnByb2dyZXNzVGltZUludGVydmFsc1tzdGFnZV0pIHtcclxuICAgICAgICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLnByb2dyZXNzVGltZUludGVydmFsc1tzdGFnZV0pO1xyXG4gICAgICAgICAgICB0aGlzLnByb2dyZXNzVGltZUludGVydmFsc1tzdGFnZV0gPSB1bmRlZmluZWQ7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog0J7Rh9C40YHRgtC60LAg0LLRgdC10YUg0LjQvdGC0LXRgNCy0LDQu9C+0LIg0LLRgNC10LzQtdC90LhcclxuICAgICAqL1xyXG4gICAgY2xlYXJBbGxQcm9ncmVzc1RpbWVJbnRlcnZhbHMoKTogdm9pZCB7XHJcbiAgICAgICAgT2JqZWN0LmtleXModGhpcy5wcm9ncmVzc1RpbWVJbnRlcnZhbHMpLmZvckVhY2goc3RhZ2UgPT4ge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5wcm9ncmVzc1RpbWVJbnRlcnZhbHNbc3RhZ2UgYXMga2V5b2YgdHlwZW9mIHRoaXMucHJvZ3Jlc3NUaW1lSW50ZXJ2YWxzXSkge1xyXG4gICAgICAgICAgICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLnByb2dyZXNzVGltZUludGVydmFsc1tzdGFnZSBhcyBrZXlvZiB0eXBlb2YgdGhpcy5wcm9ncmVzc1RpbWVJbnRlcnZhbHNdKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHRoaXMucHJvZ3Jlc3NUaW1lSW50ZXJ2YWxzID0ge307XHJcblxyXG4gICAgICAgIC8vINCe0YfQuNGJ0LDQtdC8INCw0L3QuNC80LDRhtC40Y4g0L/RgNC+0LPRgNC10YHRgdCwIFN1cGVySFRNTFxyXG4gICAgICAgIGlmICh0aGlzLnN1cGVySHRtbEFuaW1hdGlvbkludGVydmFsKSB7XHJcbiAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5zdXBlckh0bWxBbmltYXRpb25JbnRlcnZhbCk7XHJcbiAgICAgICAgICAgIHRoaXMuc3VwZXJIdG1sQW5pbWF0aW9uSW50ZXJ2YWwgPSBudWxsO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8g0J7Rh9C40YnQsNC10Lwg0LDQvdC40LzQsNGG0LjRjiDQv9GA0L7Qs9GA0LXRgdGB0LAgU0ZUUFxyXG4gICAgICAgIGlmICh0aGlzLnNmdHBBbmltYXRpb25JbnRlcnZhbCkge1xyXG4gICAgICAgICAgICBjbGVhckludGVydmFsKHRoaXMuc2Z0cEFuaW1hdGlvbkludGVydmFsKTtcclxuICAgICAgICAgICAgdGhpcy5zZnRwQW5pbWF0aW9uSW50ZXJ2YWwgPSBudWxsO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8g0J7RgdGC0LDQvdCw0LLQu9C40LLQsNC10Lwg0LzQvtC90LjRgtC+0YDQuNC90LMg0LfQsNGB0YLRgNGP0LLRiNC10LPQviDQv9GA0L7Qs9GA0LXRgdGB0LBcclxuICAgICAgICB0aGlzLnN0b3BTdHVja1Byb2dyZXNzTW9uaXRvcmluZygpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog0KHQsdGA0L7RgSDQstGB0LXRhSDQv9GA0L7Qs9GA0LXRgdGB0L7QslxyXG4gICAgICovXHJcbiAgICByZXNldEFsbFByb2dyZXNzKCk6IHZvaWQge1xyXG4gICAgICAgIC8vINCh0LHRgNCw0YHRi9Cy0LDQtdC8IFNGVFAg0L/RgNC+0LPRgNC10YHRgVxyXG4gICAgICAgIHRoaXMuc2Z0cFByb2dyZXNzID0geyBjdXJyZW50OiAwLCB0b3RhbDogMCwgcGVyY2VudGFnZTogMCwgZXRhOiAwLCBjdXJyZW50VGFzazogJycgfTtcclxuICAgICAgICB0aGlzLnNmdHBDdXJyZW50VGltZSA9ICcw0YEnO1xyXG5cclxuICAgICAgICAvLyDQodCx0YDQsNGB0YvQstCw0LXQvCDQv9GA0L7Qs9GA0LXRgdGBLdCx0LDRgCBTRlRQXHJcbiAgICAgICAgY29uc3QgcHJvZ3Jlc3NTZnRwID0gdGhpcy51aUVsZW1lbnRzLnByb2dyZXNzU2Z0cDtcclxuICAgICAgICBpZiAocHJvZ3Jlc3NTZnRwKSB7XHJcbiAgICAgICAgICAgIHByb2dyZXNzU2Z0cC5zdHlsZS5zZXRQcm9wZXJ0eSgnLS1wcm9ncmVzcy13aWR0aCcsICcwJScpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8g0KHQsdGA0LDRgdGL0LLQsNC10Lwg0L/RgNC+0LPRgNC10YHRgSDQvtGB0L3QvtCy0L3QvtCz0L4g0LHQuNC70LTQsFxyXG4gICAgICAgIHRoaXMubWFpbkJ1aWxkUHJvZ3Jlc3MgPSB7IHBlcmNlbnRhZ2U6IDAsIGN1cnJlbnRUYXNrOiAnJywgZXRhOiAwIH07XHJcbiAgICAgICAgdGhpcy5tYWluQnVpbGRDdXJyZW50VGltZSA9ICcw0YEnO1xyXG5cclxuICAgICAgICAvLyDQodCx0YDQsNGB0YvQstCw0LXQvCDQv9GA0L7Qs9GA0LXRgdGBLdCx0LDRgCDQvtGB0L3QvtCy0L3QvtCz0L4g0LHQuNC70LTQsFxyXG4gICAgICAgIGNvbnN0IHByb2dyZXNzTWFpbiA9IHRoaXMudWlFbGVtZW50cy5wcm9ncmVzc01haW47XHJcbiAgICAgICAgaWYgKHByb2dyZXNzTWFpbikge1xyXG4gICAgICAgICAgICBwcm9ncmVzc01haW4uc3R5bGUuc2V0UHJvcGVydHkoJy0tcHJvZ3Jlc3Mtd2lkdGgnLCAnMCUnKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vINCe0YHRgtCw0L3QsNCy0LvQuNCy0LDQtdC8INCw0L3QuNC80LDRhtC40Y4g0L/RgNC+0LPRgNC10YHRgdCwIFN1cGVySFRNTFxyXG4gICAgICAgIGlmICh0aGlzLnN1cGVySHRtbEFuaW1hdGlvbkludGVydmFsKSB7XHJcbiAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5zdXBlckh0bWxBbmltYXRpb25JbnRlcnZhbCk7XHJcbiAgICAgICAgICAgIHRoaXMuc3VwZXJIdG1sQW5pbWF0aW9uSW50ZXJ2YWwgPSBudWxsO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8g0J7RgdGC0LDQvdCw0LLQu9C40LLQsNC10Lwg0LDQvdC40LzQsNGG0LjRjiDQv9GA0L7Qs9GA0LXRgdGB0LAgU0ZUUFxyXG4gICAgICAgIGlmICh0aGlzLnNmdHBBbmltYXRpb25JbnRlcnZhbCkge1xyXG4gICAgICAgICAgICBjbGVhckludGVydmFsKHRoaXMuc2Z0cEFuaW1hdGlvbkludGVydmFsKTtcclxuICAgICAgICAgICAgdGhpcy5zZnRwQW5pbWF0aW9uSW50ZXJ2YWwgPSBudWxsO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8g0KHQsdGA0LDRgdGL0LLQsNC10Lwg0L/RgNC+0LPRgNC10YHRgSBTdXBlckhUTUwg0LHQuNC70LTQsFxyXG4gICAgICAgIHRoaXMuc3VwZXJIdG1sUHJvZ3Jlc3MgPSB7IHBlcmNlbnRhZ2U6IDAsIGN1cnJlbnRUYXNrOiAnJywgZXRhOiAwIH07XHJcbiAgICAgICAgdGhpcy5zdXBlckh0bWxDdXJyZW50VGltZSA9ICcw0YEnO1xyXG5cclxuICAgICAgICAvLyDQodCx0YDQsNGB0YvQstCw0LXQvCDQvNCw0LrRgdC40LzQsNC70YzQvdGL0Lkg0YDQsNC30LzQtdGAINGE0LDQudC70LAgU3VwZXIgSFRNTFxyXG4gICAgICAgIHRoaXMuc3VwZXJIdG1sTWF4RmlsZVNpemUgPSAwO1xyXG4gICAgICAgIHRoaXMuc3VwZXJIdG1sTWF4RmlsZU5hbWUgPSAnJztcclxuXHJcbiAgICAgICAgLy8g0KHQsdGA0LDRgdGL0LLQsNC10Lwg0L/RgNC+0LPRgNC10YHRgS3QsdCw0YAgU3VwZXJIVE1MINCx0LjQu9C00LBcclxuICAgICAgICBjb25zdCBwcm9ncmVzc1N1cGVySHRtbCA9IHRoaXMudWlFbGVtZW50cy5wcm9ncmVzc1N1cGVyaHRtbDtcclxuICAgICAgICBpZiAocHJvZ3Jlc3NTdXBlckh0bWwpIHtcclxuICAgICAgICAgICAgcHJvZ3Jlc3NTdXBlckh0bWwuc3R5bGUuc2V0UHJvcGVydHkoJy0tcHJvZ3Jlc3Mtd2lkdGgnLCAnMCUnKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vINCh0LHRgNCw0YHRi9Cy0LDQtdC8INCy0YDQtdC80Y8g0LIg0L/RgNC+0LPRgNC10YHRgS3QsdCw0YDQsNGFXHJcbiAgICAgICAgY29uc3QgdGltZUVsZW1lbnRzID0gW1xyXG4gICAgICAgICAgICB0aGlzLnVpRWxlbWVudHMucHJvZ3Jlc3NNYWluVGltZSxcclxuICAgICAgICAgICAgdGhpcy51aUVsZW1lbnRzLnByb2dyZXNzU3VwZXJodG1sVGltZSxcclxuICAgICAgICAgICAgdGhpcy51aUVsZW1lbnRzLnByb2dyZXNzU2Z0cFRpbWVcclxuICAgICAgICBdO1xyXG5cclxuICAgICAgICB0aW1lRWxlbWVudHMuZm9yRWFjaCh0aW1lRWxlbWVudCA9PiB7XHJcbiAgICAgICAgICAgIGlmICh0aW1lRWxlbWVudCkge1xyXG4gICAgICAgICAgICAgICAgdGltZUVsZW1lbnQudGV4dENvbnRlbnQgPSAnWzBzXSc7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgLy8g0J7Rh9C40YnQsNC10Lwg0YHQv9C40YHQvtC6INGB0L7QsdGA0LDQvdC90YvRhSDRhNCw0LnQu9C+0LJcclxuICAgICAgICB0aGlzLmNsZWFyQnVpbHRGaWxlcygpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog0KHQsdGA0L7RgSDRgtC+0LvRjNC60L4g0L/RgNC+0LPRgNC10YHRgdCwICjQsdC10Lcg0L7Rh9C40YHRgtC60Lgg0LTQsNC90L3Ri9GFINC+INGE0LDQudC70LDRhSlcclxuICAgICAqL1xyXG4gICAgcmVzZXRQcm9ncmVzc09ubHkoKTogdm9pZCB7XHJcbiAgICAgICAgLy8g0KHQsdGA0LDRgdGL0LLQsNC10LwgU0ZUUCDQv9GA0L7Qs9GA0LXRgdGBXHJcbiAgICAgICAgdGhpcy5zZnRwUHJvZ3Jlc3MgPSB7IGN1cnJlbnQ6IDAsIHRvdGFsOiAwLCBwZXJjZW50YWdlOiAwLCBldGE6IDAsIGN1cnJlbnRUYXNrOiAnJyB9O1xyXG4gICAgICAgIHRoaXMuc2Z0cEN1cnJlbnRUaW1lID0gJzDRgSc7XHJcblxyXG4gICAgICAgIC8vINCh0LHRgNCw0YHRi9Cy0LDQtdC8INC/0YDQvtCz0YDQtdGB0YEt0LHQsNGAIFNGVFBcclxuICAgICAgICBjb25zdCBwcm9ncmVzc1NmdHAgPSB0aGlzLnVpRWxlbWVudHMucHJvZ3Jlc3NTZnRwO1xyXG4gICAgICAgIGlmIChwcm9ncmVzc1NmdHApIHtcclxuICAgICAgICAgICAgcHJvZ3Jlc3NTZnRwLnN0eWxlLnNldFByb3BlcnR5KCctLXByb2dyZXNzLXdpZHRoJywgJzAlJyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDQodCx0YDQsNGB0YvQstCw0LXQvCDQv9GA0L7Qs9GA0LXRgdGBINC+0YHQvdC+0LLQvdC+0LPQviDQsdC40LvQtNCwXHJcbiAgICAgICAgdGhpcy5tYWluQnVpbGRQcm9ncmVzcyA9IHsgcGVyY2VudGFnZTogMCwgY3VycmVudFRhc2s6ICcnLCBldGE6IDAgfTtcclxuICAgICAgICB0aGlzLm1haW5CdWlsZEN1cnJlbnRUaW1lID0gJzDRgSc7XHJcblxyXG4gICAgICAgIC8vINCh0LHRgNCw0YHRi9Cy0LDQtdC8INC/0YDQvtCz0YDQtdGB0YEt0LHQsNGAINC+0YHQvdC+0LLQvdC+0LPQviDQsdC40LvQtNCwXHJcbiAgICAgICAgY29uc3QgcHJvZ3Jlc3NNYWluID0gdGhpcy51aUVsZW1lbnRzLnByb2dyZXNzTWFpbjtcclxuICAgICAgICBpZiAocHJvZ3Jlc3NNYWluKSB7XHJcbiAgICAgICAgICAgIHByb2dyZXNzTWFpbi5zdHlsZS5zZXRQcm9wZXJ0eSgnLS1wcm9ncmVzcy13aWR0aCcsICcwJScpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8g0J7RgdGC0LDQvdCw0LLQu9C40LLQsNC10Lwg0LDQvdC40LzQsNGG0LjRjiDQv9GA0L7Qs9GA0LXRgdGB0LAgU3VwZXJIVE1MXHJcbiAgICAgICAgaWYgKHRoaXMuc3VwZXJIdG1sQW5pbWF0aW9uSW50ZXJ2YWwpIHtcclxuICAgICAgICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLnN1cGVySHRtbEFuaW1hdGlvbkludGVydmFsKTtcclxuICAgICAgICAgICAgdGhpcy5zdXBlckh0bWxBbmltYXRpb25JbnRlcnZhbCA9IG51bGw7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDQntGB0YLQsNC90LDQstC70LjQstCw0LXQvCDQsNC90LjQvNCw0YbQuNGOINC/0YDQvtCz0YDQtdGB0YHQsCBTRlRQXHJcbiAgICAgICAgaWYgKHRoaXMuc2Z0cEFuaW1hdGlvbkludGVydmFsKSB7XHJcbiAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5zZnRwQW5pbWF0aW9uSW50ZXJ2YWwpO1xyXG4gICAgICAgICAgICB0aGlzLnNmdHBBbmltYXRpb25JbnRlcnZhbCA9IG51bGw7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDQodCx0YDQsNGB0YvQstCw0LXQvCDQv9GA0L7Qs9GA0LXRgdGBIFN1cGVySFRNTCDQsdC40LvQtNCwXHJcbiAgICAgICAgdGhpcy5zdXBlckh0bWxQcm9ncmVzcyA9IHsgcGVyY2VudGFnZTogMCwgY3VycmVudFRhc2s6ICcnLCBldGE6IDAgfTtcclxuICAgICAgICB0aGlzLnN1cGVySHRtbEN1cnJlbnRUaW1lID0gJzDRgSc7XHJcblxyXG4gICAgICAgIC8vINCh0LHRgNCw0YHRi9Cy0LDQtdC8INC/0YDQvtCz0YDQtdGB0YEt0LHQsNGAIFN1cGVySFRNTCDQsdC40LvQtNCwXHJcbiAgICAgICAgY29uc3QgcHJvZ3Jlc3NTdXBlckh0bWwgPSB0aGlzLnVpRWxlbWVudHMucHJvZ3Jlc3NTdXBlcmh0bWw7XHJcbiAgICAgICAgaWYgKHByb2dyZXNzU3VwZXJIdG1sKSB7XHJcbiAgICAgICAgICAgIHByb2dyZXNzU3VwZXJIdG1sLnN0eWxlLnNldFByb3BlcnR5KCctLXByb2dyZXNzLXdpZHRoJywgJzAlJyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDQodCx0YDQsNGB0YvQstCw0LXQvCDQstGA0LXQvNGPINCyINC/0YDQvtCz0YDQtdGB0YEt0LHQsNGA0LDRhVxyXG4gICAgICAgIGNvbnN0IHRpbWVFbGVtZW50cyA9IFtcclxuICAgICAgICAgICAgdGhpcy51aUVsZW1lbnRzLnByb2dyZXNzTWFpblRpbWUsXHJcbiAgICAgICAgICAgIHRoaXMudWlFbGVtZW50cy5wcm9ncmVzc1N1cGVyaHRtbFRpbWUsXHJcbiAgICAgICAgICAgIHRoaXMudWlFbGVtZW50cy5wcm9ncmVzc1NmdHBUaW1lXHJcbiAgICAgICAgXTtcclxuXHJcbiAgICAgICAgdGltZUVsZW1lbnRzLmZvckVhY2godGltZUVsZW1lbnQgPT4ge1xyXG4gICAgICAgICAgICBpZiAodGltZUVsZW1lbnQpIHtcclxuICAgICAgICAgICAgICAgIHRpbWVFbGVtZW50LnRleHRDb250ZW50ID0gJ1swc10nO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIC8vINCd0JUg0L7Rh9C40YnQsNC10Lwg0YHQv9C40YHQvtC6INGB0L7QsdGA0LDQvdC90YvRhSDRhNCw0LnQu9C+0LIgLSDQvtC90Lgg0LTQvtC70LbQvdGLINGB0L7RhdGA0LDQvdGP0YLRjNGB0Y8g0LzQtdC20LTRgyDRgdCx0L7RgNC60LDQvNC4XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDQn9C+0LvRg9GH0LXQvdC40LUg0LTQsNC90L3Ri9GFINC+INCy0YDQtdC80LXQvdC4INGN0YLQsNC/0L7QslxyXG4gICAgICovXHJcbiAgICBnZXRTdGFnZVRpbWluZ3MoKTogU3RhZ2VUaW1pbmdzIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5zdGFnZVRpbWluZ3M7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDQn9C+0LvRg9GH0LXQvdC40LUg0LTQsNC90L3Ri9GFINC+INC/0YDQvtCz0YDQtdGB0YHQtSDQvtGB0L3QvtCy0L3QvtCz0L4g0LHQuNC70LTQsFxyXG4gICAgICovXHJcbiAgICBnZXRNYWluQnVpbGRQcm9ncmVzcygpOiBQcm9ncmVzc0RhdGEge1xyXG4gICAgICAgIHJldHVybiB0aGlzLm1haW5CdWlsZFByb2dyZXNzO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog0J/QvtC70YPRh9C10L3QuNC1INC00LDQvdC90YvRhSDQviDQv9GA0L7Qs9GA0LXRgdGB0LUgU3VwZXJIVE1MINCx0LjQu9C00LBcclxuICAgICAqL1xyXG4gICAgZ2V0U3VwZXJIdG1sUHJvZ3Jlc3MoKTogUHJvZ3Jlc3NEYXRhIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5zdXBlckh0bWxQcm9ncmVzcztcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqINCf0L7Qu9GD0YfQtdC90LjQtSDQtNCw0L3QvdGL0YUg0L4g0L/RgNC+0LPRgNC10YHRgdC1IFNGVFBcclxuICAgICAqL1xyXG4gICAgZ2V0U2Z0cFByb2dyZXNzKCk6IFNmdHBQcm9ncmVzc0RhdGEge1xyXG4gICAgICAgIHJldHVybiB0aGlzLnNmdHBQcm9ncmVzcztcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqINCf0L7Qu9GD0YfQtdC90LjQtSDQtNCw0L3QvdGL0YUg0L4gY2xlYW4taW5mbyBTRlRQXHJcbiAgICAgKi9cclxuICAgIGdldFNmdHBDbGVhbkluZm8oKTogU2Z0cENsZWFuSW5mbyB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuc2Z0cENsZWFuSW5mbztcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqINCe0YfQuNGB0YLQutCwINC00LDQvdC90YvRhSDQviBjbGVhbi1pbmZvIFNGVFBcclxuICAgICAqL1xyXG4gICAgY2xlYXJTZnRwQ2xlYW5JbmZvKCk6IHZvaWQge1xyXG4gICAgICAgIHRoaXMuc2Z0cENsZWFuSW5mbyA9IHsgcGF0aDogJycsIHRvdGFsSXRlbXM6IDAsIGl0ZW1zOiBbXSB9O1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog0J/RgNC40L3Rg9C00LjRgtC10LvRjNC90L7QtSDQt9Cw0LLQtdGA0YjQtdC90LjQtSDQv9GA0L7Qs9GA0LXRgdGB0LAg0L7RgdC90L7QstC90L7Qs9C+INCx0LjQu9C00LBcclxuICAgICAqL1xyXG4gICAgZm9yY2VDb21wbGV0ZU1haW5CdWlsZCgpOiB2b2lkIHtcclxuICAgICAgICBpZiAodGhpcy5tYWluQnVpbGRQcm9ncmVzcy5wZXJjZW50YWdlIDwgMTAwKSB7XHJcbiAgICAgICAgICAgIHRoaXMubWFpbkJ1aWxkUHJvZ3Jlc3MucGVyY2VudGFnZSA9IDEwMDtcclxuICAgICAgICAgICAgdGhpcy5tYWluQnVpbGRQcm9ncmVzcy5jdXJyZW50VGFzayA9ICfQl9Cw0LLQtdGA0YjQtdC90L4nO1xyXG4gICAgICAgICAgICB0aGlzLnVwZGF0ZU1haW5CdWlsZFByb2dyZXNzKCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog0J/RgNC40L3Rg9C00LjRgtC10LvRjNC90L7QtSDQt9Cw0LLQtdGA0YjQtdC90LjQtSDQv9GA0L7Qs9GA0LXRgdGB0LAgU3VwZXJIVE1MINCx0LjQu9C00LBcclxuICAgICAqL1xyXG4gICAgZm9yY2VDb21wbGV0ZVN1cGVySHRtbEJ1aWxkKCk6IHZvaWQge1xyXG4gICAgICAgIGlmICh0aGlzLnN1cGVySHRtbFByb2dyZXNzLnBlcmNlbnRhZ2UgPCAxMDApIHtcclxuICAgICAgICAgICAgdGhpcy5zdXBlckh0bWxQcm9ncmVzcy5wZXJjZW50YWdlID0gMTAwO1xyXG4gICAgICAgICAgICB0aGlzLnN1cGVySHRtbFByb2dyZXNzLmN1cnJlbnRUYXNrID0gJ9CX0LDQstC10YDRiNC10L3Qvic7XHJcbiAgICAgICAgICAgIHRoaXMudXBkYXRlU3VwZXJIdG1sUHJvZ3Jlc3MoKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDQn9GA0LjQvdGD0LTQuNGC0LXQu9GM0L3QvtC1INC30LDQstC10YDRiNC10L3QuNC1INC/0YDQvtCz0YDQtdGB0YHQsCBTRlRQXHJcbiAgICAgKi9cclxuICAgIGZvcmNlQ29tcGxldGVTZnRwUHJvZ3Jlc3MoKTogdm9pZCB7XHJcbiAgICAgICAgaWYgKHRoaXMuc2Z0cFByb2dyZXNzLnBlcmNlbnRhZ2UgPCAxMDApIHtcclxuICAgICAgICAgICAgdGhpcy5zZnRwUHJvZ3Jlc3MucGVyY2VudGFnZSA9IDEwMDtcclxuICAgICAgICAgICAgdGhpcy5zZnRwUHJvZ3Jlc3MuY3VycmVudFRhc2sgPSAn0JfQsNCy0LXRgNGI0LXQvdC+JztcclxuICAgICAgICAgICAgdGhpcy51cGRhdGVTZnRwUHJvZ3Jlc3MoKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vINCh0LrRgNGL0LLQsNC10Lwg0L/RgNC+0LPRgNC10YHRgS3QsdCw0YAg0L/QvtGB0LvQtSDQt9Cw0LLQtdGA0YjQtdC90LjRj1xyXG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLnJlc2V0U2VjdGlvblN0YXRlKCdzZnRwJyk7XHJcbiAgICAgICAgfSwgMjAwMCk7IC8vINCU0LDQtdC8INCy0YDQtdC80Y8g0L/QvtC60LDQt9Cw0YLRjCDQt9Cw0LLQtdGA0YjQtdC90L3QvtC1INGB0L7RgdGC0L7Rj9C90LjQtVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog0JfQsNC/0YPRgdC6INC80L7QvdC40YLQvtGA0LjQvdCz0LAg0LfQsNGB0YLRgNGP0LLRiNC10LPQviDQv9GA0L7Qs9GA0LXRgdGB0LBcclxuICAgICAqL1xyXG4gICAgc3RhcnRTdHVja1Byb2dyZXNzTW9uaXRvcmluZygpOiB2b2lkIHtcclxuICAgICAgICB0aGlzLmxhc3RQcm9ncmVzc1VwZGF0ZSA9IERhdGUubm93KCk7XHJcblxyXG4gICAgICAgIGlmICh0aGlzLnN0dWNrUHJvZ3Jlc3NUaW1lb3V0KSB7XHJcbiAgICAgICAgICAgIGNsZWFyVGltZW91dCh0aGlzLnN0dWNrUHJvZ3Jlc3NUaW1lb3V0KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMuc3R1Y2tQcm9ncmVzc1RpbWVvdXQgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XHJcbiAgICAgICAgICAgIGNvbnN0IHRpbWVTaW5jZUxhc3RVcGRhdGUgPSBub3cgLSB0aGlzLmxhc3RQcm9ncmVzc1VwZGF0ZTtcclxuXHJcbiAgICAgICAgICAgIC8vINCV0YHQu9C4INC/0YDQvtCz0YDQtdGB0YEg0L3QtSDQvtCx0L3QvtCy0LvRj9C70YHRjyDQsdC+0LvQtdC1IDMwINGB0LXQutGD0L3QtCDQuCDQvtC9INCx0L7Qu9GM0YjQtSAwLCDQv9GA0LjQvdGD0LTQuNGC0LXQu9GM0L3QviDQt9Cw0LLQtdGA0YjQsNC10LxcclxuICAgICAgICAgICAgaWYgKHRpbWVTaW5jZUxhc3RVcGRhdGUgPiAzMDAwMCAmJiB0aGlzLm1haW5CdWlsZFByb2dyZXNzLnBlcmNlbnRhZ2UgPiAwKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmZvcmNlQ29tcGxldGVNYWluQnVpbGQoKTtcclxuICAgICAgICAgICAgICAgIHRoaXMuc3RvcFN0dWNrUHJvZ3Jlc3NNb25pdG9yaW5nKCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LCA1MDAwKTsgLy8g0J/RgNC+0LLQtdGA0Y/QtdC8INC60LDQttC00YvQtSA1INGB0LXQutGD0L3QtFxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog0J7RgdGC0LDQvdC+0LLQutCwINC80L7QvdC40YLQvtGA0LjQvdCz0LAg0LfQsNGB0YLRgNGP0LLRiNC10LPQviDQv9GA0L7Qs9GA0LXRgdGB0LBcclxuICAgICAqL1xyXG4gICAgc3RvcFN0dWNrUHJvZ3Jlc3NNb25pdG9yaW5nKCk6IHZvaWQge1xyXG4gICAgICAgIGlmICh0aGlzLnN0dWNrUHJvZ3Jlc3NUaW1lb3V0KSB7XHJcbiAgICAgICAgICAgIGNsZWFyVGltZW91dCh0aGlzLnN0dWNrUHJvZ3Jlc3NUaW1lb3V0KTtcclxuICAgICAgICAgICAgdGhpcy5zdHVja1Byb2dyZXNzVGltZW91dCA9IG51bGw7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog0J7QsdC90L7QstC70LXQvdC40LUg0LLRgNC10LzQtdC90Lgg0L/QvtGB0LvQtdC00L3QtdCz0L4g0L7QsdC90L7QstC70LXQvdC40Y8g0L/RgNC+0LPRgNC10YHRgdCwXHJcbiAgICAgKi9cclxuICAgIHVwZGF0ZUxhc3RQcm9ncmVzc1RpbWUoKTogdm9pZCB7XHJcbiAgICAgICAgdGhpcy5sYXN0UHJvZ3Jlc3NVcGRhdGUgPSBEYXRlLm5vdygpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog0J/QvtC60LDQtyDQv9GA0L7Qs9GA0LXRgdGBLdCx0LDRgNCwINC00LvRjyDQutC+0L3QutGA0LXRgtC90L7QuSDRgdC10LrRhtC40LhcclxuICAgICAqL1xyXG4gICAgc2hvd1NlY3Rpb25Qcm9ncmVzcyhzZWN0aW9uOiAnbWFpbkJ1aWxkJyB8ICdzdXBlckh0bWwnIHwgJ3NmdHAnKTogdm9pZCB7XHJcbiAgICAgICAgbGV0IHByb2dyZXNzRWxlbWVudDogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7XHJcblxyXG4gICAgICAgIHN3aXRjaCAoc2VjdGlvbikge1xyXG4gICAgICAgICAgICBjYXNlICdtYWluQnVpbGQnOlxyXG4gICAgICAgICAgICAgICAgcHJvZ3Jlc3NFbGVtZW50ID0gdGhpcy51aUVsZW1lbnRzLnByb2dyZXNzTWFpbjtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlICdzdXBlckh0bWwnOlxyXG4gICAgICAgICAgICAgICAgcHJvZ3Jlc3NFbGVtZW50ID0gdGhpcy51aUVsZW1lbnRzLnByb2dyZXNzU3VwZXJodG1sO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgJ3NmdHAnOlxyXG4gICAgICAgICAgICAgICAgcHJvZ3Jlc3NFbGVtZW50ID0gdGhpcy51aUVsZW1lbnRzLnByb2dyZXNzU2Z0cDtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8g0J/QvtC60LDQt9GL0LLQsNC10Lwg0LjQvdC00LjQutCw0YLQvtGAINC/0YDQvtCz0YDQtdGB0YHQsFxyXG4gICAgICAgIGlmIChwcm9ncmVzc0VsZW1lbnQpIHtcclxuICAgICAgICAgICAgcHJvZ3Jlc3NFbGVtZW50LmNsYXNzTGlzdC5yZW1vdmUoJ2hpZGRlbicpO1xyXG4gICAgICAgICAgICBwcm9ncmVzc0VsZW1lbnQuY2xhc3NMaXN0LnJlbW92ZSgncGVuZGluZycsICdhY3RpdmUnLCAnY29tcGxldGVkJywgJ3NraXBwZWQnKTtcclxuICAgICAgICAgICAgcHJvZ3Jlc3NFbGVtZW50LmNsYXNzTGlzdC5hZGQoJ3BlbmRpbmcnKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDQodCx0YDQvtGBINGB0L7RgdGC0L7Rj9C90LjRjyDQutC+0L3QutGA0LXRgtC90L7QuSDRgdC10LrRhtC40LhcclxuICAgICAqL1xyXG4gICAgcmVzZXRTZWN0aW9uU3RhdGUoc2VjdGlvbjogJ21haW5CdWlsZCcgfCAnc3VwZXJIdG1sJyB8ICdzZnRwJyk6IHZvaWQge1xyXG4gICAgICAgIGxldCBwcm9ncmVzc0VsZW1lbnQ6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkO1xyXG5cclxuICAgICAgICBzd2l0Y2ggKHNlY3Rpb24pIHtcclxuICAgICAgICAgICAgY2FzZSAnbWFpbkJ1aWxkJzpcclxuICAgICAgICAgICAgICAgIHByb2dyZXNzRWxlbWVudCA9IHRoaXMudWlFbGVtZW50cy5wcm9ncmVzc01haW47XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSAnc3VwZXJIdG1sJzpcclxuICAgICAgICAgICAgICAgIHByb2dyZXNzRWxlbWVudCA9IHRoaXMudWlFbGVtZW50cy5wcm9ncmVzc1N1cGVyaHRtbDtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlICdzZnRwJzpcclxuICAgICAgICAgICAgICAgIHByb2dyZXNzRWxlbWVudCA9IHRoaXMudWlFbGVtZW50cy5wcm9ncmVzc1NmdHA7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vINCh0LrRgNGL0LLQsNC10Lwg0LjQvdC00LjQutCw0YLQvtGAINC/0YDQvtCz0YDQtdGB0YHQsFxyXG4gICAgICAgIGlmIChwcm9ncmVzc0VsZW1lbnQpIHtcclxuICAgICAgICAgICAgcHJvZ3Jlc3NFbGVtZW50LmNsYXNzTGlzdC5hZGQoJ2hpZGRlbicpO1xyXG4gICAgICAgICAgICBwcm9ncmVzc0VsZW1lbnQuY2xhc3NMaXN0LnJlbW92ZSgncGVuZGluZycsICdhY3RpdmUnLCAnY29tcGxldGVkJywgJ3NraXBwZWQnKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDQn9C+0LvRg9GH0LXQvdC40LUg0YHQv9C40YHQutCwINGB0L7QsdGA0LDQvdC90YvRhSDRhNCw0LnQu9C+0LJcclxuICAgICAqL1xyXG4gICAgZ2V0QnVpbHRGaWxlcygpOiBCdWlsdEZpbGVJbmZvW10ge1xyXG4gICAgICAgIHJldHVybiBbLi4udGhpcy5idWlsdEZpbGVzXTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqINCe0YfQuNGB0YLQutCwINGB0L/QuNGB0LrQsCDRgdC+0LHRgNCw0L3QvdGL0YUg0YTQsNC50LvQvtCyXHJcbiAgICAgKi9cclxuICAgIGNsZWFyQnVpbHRGaWxlcygpOiB2b2lkIHtcclxuICAgICAgICB0aGlzLmJ1aWx0RmlsZXMgPSBbXTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqINCf0L7Qu9GD0YfQtdC90LjQtSDQvNCw0LrRgdC40LzQsNC70YzQvdC+0LPQviDRgNCw0LfQvNC10YDQsCDRhNCw0LnQu9CwXHJcbiAgICAgKi9cclxuICAgIGdldE1heEZpbGVTaXplKCk6IHsgc2l6ZUtCOiBudW1iZXI7IGZpbGVOYW1lOiBzdHJpbmcgfSB8IG51bGwge1xyXG4gICAgICAgIGlmICh0aGlzLmJ1aWx0RmlsZXMubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3QgbWF4RmlsZSA9IHRoaXMuYnVpbHRGaWxlcy5yZWR1Y2UoKG1heCwgZmlsZSkgPT5cclxuICAgICAgICAgICAgZmlsZS5zaXplS0IgPiBtYXguc2l6ZUtCID8gZmlsZSA6IG1heFxyXG4gICAgICAgICk7XHJcblxyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIHNpemVLQjogbWF4RmlsZS5zaXplS0IsXHJcbiAgICAgICAgICAgIGZpbGVOYW1lOiBtYXhGaWxlLmZpbGVOYW1lIHx8IGAke21heEZpbGUudmVyc2lvbk5hbWV9XyR7bWF4RmlsZS5sYW5nQ29kZX0uaHRtbGBcclxuICAgICAgICB9O1xyXG4gICAgfVxyXG59XHJcbiJdfQ==