"use strict";
/**
 * Модуль управления модальными окнами
 * Отвечает за показ/скрытие модальных окон, обработку событий и анимации
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModalManager = void 0;
class ModalManager {
    constructor(elements, callbacks) {
        this.elements = elements;
        this.callbacks = callbacks;
        this.setupEventListeners();
    }
    /**
     * Настройка всех обработчиков событий для модальных окон
     */
    setupEventListeners() {
        this.setupWarningModal();
        this.setupSftpWarningModal();
        this.setupUnsavedChangesModal();
        this.setupUnsavedSceneChangesModal();
        this.setupUpdateCompletedModal();
        this.setupInfoSection();
        this.setupPathsSection();
        this.setupValidatorSection();
        this.setupKeyboardHandlers();
    }
    /**
     * Настройка модального окна предупреждения
     */
    setupWarningModal() {
        const { warningModal, warningCancel, warningContinue } = this.elements;
        if (warningCancel) {
            warningCancel.addEventListener('click', () => this.hideWarningModal());
        }
        if (warningContinue) {
            warningContinue.addEventListener('click', () => this.callbacks.onWarningContinue());
        }
        // Закрытие по клику на фон
        if (warningModal) {
            warningModal.addEventListener('click', (e) => {
                if (e.target === warningModal) {
                    this.hideWarningModal();
                }
            });
        }
    }
    /**
     * Настройка модального окна предупреждения SFTP
     */
    setupSftpWarningModal() {
        const { sftpWarningModal, sftpWarningCancel, sftpWarningContinue } = this.elements;
        if (sftpWarningCancel) {
            sftpWarningCancel.addEventListener('click', () => this.hideSftpWarningModal());
        }
        if (sftpWarningContinue) {
            sftpWarningContinue.addEventListener('click', () => this.callbacks.onSftpWarningContinue());
        }
        // Закрытие по клику на фон
        if (sftpWarningModal) {
            sftpWarningModal.addEventListener('click', (e) => {
                if (e.target === sftpWarningModal) {
                    this.hideSftpWarningModal();
                }
            });
        }
    }
    /**
     * Настройка модального окна предупреждения о несохраненных изменениях
     */
    setupUnsavedChangesModal() {
        const { unsavedChangesModal, unsavedChangesCancel, unsavedChangesDiscard } = this.elements;
        if (unsavedChangesCancel) {
            unsavedChangesCancel.addEventListener('click', () => this.hideUnsavedChangesModal());
        }
        if (unsavedChangesDiscard) {
            unsavedChangesDiscard.addEventListener('click', () => {
                if (this.callbacks.onUnsavedChangesDiscard) {
                    this.callbacks.onUnsavedChangesDiscard();
                }
                this.hideUnsavedChangesModal();
                // Если есть отложенное закрытие info-section, выполняем его
                if (this.pendingCloseInfoSection) {
                    this.pendingCloseInfoSection();
                    this.pendingCloseInfoSection = null;
                }
            });
        }
        // Закрытие по клику на фон
        if (unsavedChangesModal) {
            unsavedChangesModal.addEventListener('click', (e) => {
                if (e.target === unsavedChangesModal) {
                    this.hideUnsavedChangesModal();
                }
            });
        }
    }
    /**
     * Настройка информационной секции
     */
    setupInfoSection() {
        const { infoSection, toggleInfoButton, closeInfoButton } = this.elements;
        if (toggleInfoButton) {
            toggleInfoButton.addEventListener('click', () => this.toggleInfoSection());
        }
        if (closeInfoButton) {
            closeInfoButton.addEventListener('click', () => this.closeInfoSection());
        }
        // Закрытие по клику на фон
        if (infoSection) {
            infoSection.addEventListener('click', (e) => {
                if (e.target === infoSection) {
                    this.closeInfoSection();
                }
            });
        }
    }
    /**
     * Настройка модального окна предупреждения о несохраненных изменениях в сцене
     */
    setupUnsavedSceneChangesModal() {
        const { unsavedSceneChangesModal, unsavedSceneCancel, unsavedSceneSave, unsavedSceneContinue } = this.elements;
        if (unsavedSceneCancel) {
            unsavedSceneCancel.addEventListener('click', () => this.hideUnsavedSceneChangesModal());
        }
        if (unsavedSceneSave) {
            unsavedSceneSave.addEventListener('click', async () => {
                if (this.callbacks.onUnsavedSceneSave) {
                    await this.callbacks.onUnsavedSceneSave();
                }
                this.hideUnsavedSceneChangesModal();
            });
        }
        if (unsavedSceneContinue) {
            unsavedSceneContinue.addEventListener('click', () => {
                if (this.callbacks.onUnsavedSceneContinue) {
                    this.callbacks.onUnsavedSceneContinue();
                }
                this.hideUnsavedSceneChangesModal();
            });
        }
        // Закрытие по клику на фон
        if (unsavedSceneChangesModal) {
            unsavedSceneChangesModal.addEventListener('click', (e) => {
                if (e.target === unsavedSceneChangesModal) {
                    this.hideUnsavedSceneChangesModal();
                }
            });
        }
    }
    /**
     * Настройка модального окна об обновлении
     */
    setupUpdateCompletedModal() {
        const { updateCompletedModal, updateCompletedOk } = this.elements;
        if (updateCompletedOk) {
            updateCompletedOk.addEventListener('click', () => this.hideUpdateCompletedModal());
        }
        // Закрытие по клику на фон
        if (updateCompletedModal) {
            updateCompletedModal.addEventListener('click', (e) => {
                if (e.target === updateCompletedModal) {
                    this.hideUpdateCompletedModal();
                }
            });
        }
    }
    /**
     * Настройка секции путей
     */
    setupPathsSection() {
        const { pathsSection, togglePathsButton, closePathsButton } = this.elements;
        if (togglePathsButton) {
            togglePathsButton.addEventListener('click', () => this.togglePathsSection());
        }
        if (closePathsButton) {
            closePathsButton.addEventListener('click', () => this.closePathsSection());
        }
        // Закрытие по клику на фон
        if (pathsSection) {
            pathsSection.addEventListener('click', (e) => {
                if (e.target === pathsSection) {
                    this.closePathsSection();
                }
            });
        }
    }
    /**
     * Настройка секции валидатора
     */
    setupValidatorSection() {
        const { validatorSection, toggleValidatorButton, closeValidatorButton } = this.elements;
        if (toggleValidatorButton) {
            toggleValidatorButton.addEventListener('click', () => this.toggleValidatorSection());
        }
        if (closeValidatorButton) {
            closeValidatorButton.addEventListener('click', () => this.closeValidatorSection());
        }
        // Закрытие по клику на фон
        if (validatorSection) {
            validatorSection.addEventListener('click', (e) => {
                if (e.target === validatorSection) {
                    this.closeValidatorSection();
                }
            });
        }
    }
    /**
     * Настройка обработчиков клавиатуры
     */
    setupKeyboardHandlers() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.handleEscapeKey();
            }
        });
    }
    /**
     * Обработка нажатия клавиши Escape
     */
    handleEscapeKey() {
        const { warningModal, sftpWarningModal, unsavedChangesModal, unsavedSceneChangesModal, updateCompletedModal, infoSection, pathsSection, validatorSection } = this.elements;
        // Приоритет: warning modal > sftp warning modal > unsaved changes modal > unsaved scene changes modal > update completed modal > info section > paths section > validator section
        if (warningModal && !warningModal.classList.contains('hidden')) {
            this.hideWarningModal();
        }
        else if (sftpWarningModal && !sftpWarningModal.classList.contains('hidden')) {
            this.hideSftpWarningModal();
        }
        else if (unsavedChangesModal && !unsavedChangesModal.classList.contains('hidden')) {
            this.hideUnsavedChangesModal();
        }
        else if (unsavedSceneChangesModal && !unsavedSceneChangesModal.classList.contains('hidden')) {
            this.hideUnsavedSceneChangesModal();
        }
        else if (updateCompletedModal && !updateCompletedModal.classList.contains('hidden')) {
            this.hideUpdateCompletedModal();
        }
        else if (infoSection && infoSection.classList.contains('show')) {
            this.closeInfoSection();
        }
        else if (pathsSection && pathsSection.classList.contains('show')) {
            this.closePathsSection();
        }
        else if (validatorSection && validatorSection.classList.contains('show')) {
            this.closeValidatorSection();
        }
    }
    /**
     * Показать модальное окно предупреждения
     */
    showWarningModal() {
        const { warningModal } = this.elements;
        if (!warningModal)
            return;
        warningModal.style.display = 'flex';
        // Небольшая задержка для плавной анимации
        setTimeout(() => {
            warningModal.classList.remove('hidden');
        }, 10);
        // Блокируем скролл body
        document.body.classList.add('modal-open');
    }
    /**
     * Скрыть модальное окно предупреждения
     */
    hideWarningModal() {
        const { warningModal } = this.elements;
        if (!warningModal)
            return;
        warningModal.classList.add('hidden');
        // Ждем завершения анимации перед скрытием
        setTimeout(() => {
            warningModal.style.display = 'none';
            // Разблокируем скролл body
            document.body.classList.remove('modal-open');
        }, 300);
    }
    /**
     * Показать модальное окно предупреждения SFTP
     */
    showSftpWarningModal() {
        const { sftpWarningModal } = this.elements;
        if (!sftpWarningModal)
            return;
        sftpWarningModal.style.display = 'flex';
        // Небольшая задержка для плавной анимации
        setTimeout(() => {
            sftpWarningModal.classList.remove('hidden');
        }, 10);
        // Блокируем скролл body
        document.body.classList.add('modal-open');
    }
    /**
     * Скрыть модальное окно предупреждения SFTP
     */
    hideSftpWarningModal() {
        const { sftpWarningModal } = this.elements;
        if (!sftpWarningModal)
            return;
        sftpWarningModal.classList.add('hidden');
        // Ждем завершения анимации перед скрытием
        setTimeout(() => {
            sftpWarningModal.style.display = 'none';
            // Разблокируем скролл body
            document.body.classList.remove('modal-open');
        }, 300);
    }
    /**
     * Переключить информационную секцию
     */
    toggleInfoSection() {
        const { infoSection } = this.elements;
        if (!infoSection)
            return;
        const isOpen = infoSection.classList.contains('show');
        if (isOpen) {
            this.closeInfoSection();
        }
        else {
            this.openInfoSection();
        }
    }
    /**
     * Открыть информационную секцию
     */
    openInfoSection() {
        const { infoSection } = this.elements;
        if (!infoSection)
            return;
        // Блокируем скролл body
        document.body.classList.add('modal-open');
        infoSection.style.display = 'flex';
        // Небольшая задержка для плавной анимации
        setTimeout(() => {
            infoSection.classList.add('show');
            // Вызываем callback для загрузки свежих данных
            if (this.callbacks.onInfoOpen) {
                this.callbacks.onInfoOpen();
            }
        }, 10);
    }
    /**
     * Закрыть информационную секцию
     */
    closeInfoSection() {
        const { infoSection } = this.elements;
        if (!infoSection)
            return;
        // Проверяем наличие несохраненных изменений перед закрытием
        if (this.callbacks.onCheckUnsavedChanges && this.callbacks.onCheckUnsavedChanges()) {
            // Есть несохраненные изменения - показываем модальное окно
            this.showUnsavedChangesModal();
            // Сохраняем callback для закрытия секции после подтверждения
            this.pendingCloseInfoSection = () => {
                this.doCloseInfoSection();
            };
            return;
        }
        // Нет несохраненных изменений - закрываем сразу
        this.doCloseInfoSection();
    }
    /**
     * Выполнить закрытие информационной секции
     */
    doCloseInfoSection() {
        const { infoSection } = this.elements;
        if (!infoSection)
            return;
        infoSection.classList.remove('show');
        // Ждем завершения анимации перед скрытием
        setTimeout(() => {
            infoSection.style.display = 'none';
            // Разблокируем скролл body
            document.body.classList.remove('modal-open');
        }, 300);
    }
    /**
     * Переключить секцию путей
     */
    togglePathsSection() {
        const { pathsSection, infoSection, validatorSection } = this.elements;
        if (!pathsSection)
            return;
        // Закрываем другие секции при открытии этой
        if (infoSection && infoSection.classList.contains('show')) {
            this.closeInfoSection();
        }
        if (validatorSection && validatorSection.classList.contains('show')) {
            this.closeValidatorSection();
        }
        if (pathsSection.classList.contains('show')) {
            this.closePathsSection();
        }
        else {
            pathsSection.classList.add('show');
            // Блокируем скролл body
            document.body.classList.add('modal-open');
            // Вызываем callback для обновления данных
            if (this.callbacks.onPathsOpen) {
                this.callbacks.onPathsOpen();
            }
        }
    }
    /**
     * Закрыть секцию путей
     */
    closePathsSection() {
        const { pathsSection } = this.elements;
        if (!pathsSection)
            return;
        pathsSection.classList.remove('show');
        // Разблокируем скролл body
        document.body.classList.remove('modal-open');
    }
    /**
     * Переключить секцию валидатора
     */
    toggleValidatorSection() {
        const { validatorSection } = this.elements;
        if (!validatorSection)
            return;
        const isOpen = validatorSection.classList.contains('show');
        if (isOpen) {
            this.closeValidatorSection();
        }
        else {
            this.openValidatorSection();
        }
    }
    /**
     * Открыть секцию валидатора
     */
    openValidatorSection() {
        const { validatorSection } = this.elements;
        if (!validatorSection)
            return;
        // Блокируем скролл body
        document.body.classList.add('modal-open');
        validatorSection.style.display = 'flex';
        // Небольшая задержка для плавной анимации
        setTimeout(() => {
            validatorSection.classList.add('show');
            // Вызываем callback для запуска валидации
            if (this.callbacks.onValidatorOpen) {
                this.callbacks.onValidatorOpen();
            }
        }, 10);
    }
    /**
     * Закрыть секцию валидатора
     */
    closeValidatorSection() {
        const { validatorSection } = this.elements;
        if (!validatorSection)
            return;
        validatorSection.classList.remove('show');
        // Ждем завершения анимации перед скрытием
        setTimeout(() => {
            validatorSection.style.display = 'none';
            // Разблокируем скролл body
            document.body.classList.remove('modal-open');
        }, 300);
    }
    /**
     * Показать предупреждение SFTP с информацией о clean-info
     */
    showSftpWarningWithInfo() {
        const { sftpCleanInfo } = this.elements;
        if (!sftpCleanInfo)
            return;
        sftpCleanInfo.innerHTML = '<p>Collecting folder information...</p>';
        this.showSftpWarningModal();
    }
    /**
     * Обновить информацию в модальном окне SFTP
     */
    updateSftpCleanInfo(htmlContent) {
        const { sftpCleanInfo } = this.elements;
        if (sftpCleanInfo) {
            sftpCleanInfo.innerHTML = htmlContent;
        }
    }
    /**
     * Показать модальное окно предупреждения о несохраненных изменениях
     */
    showUnsavedChangesModal() {
        const { unsavedChangesModal } = this.elements;
        if (!unsavedChangesModal)
            return;
        unsavedChangesModal.style.display = 'flex';
        // Небольшая задержка для плавной анимации
        setTimeout(() => {
            unsavedChangesModal.classList.remove('hidden');
        }, 10);
        // Блокируем скролл body
        document.body.classList.add('modal-open');
    }
    /**
     * Скрыть модальное окно предупреждения о несохраненных изменениях
     */
    hideUnsavedChangesModal() {
        const { unsavedChangesModal } = this.elements;
        if (!unsavedChangesModal)
            return;
        unsavedChangesModal.classList.add('hidden');
        // Ждем завершения анимации перед скрытием
        setTimeout(() => {
            unsavedChangesModal.style.display = 'none';
            // Разблокируем скролл body
            document.body.classList.remove('modal-open');
        }, 300);
    }
    /**
     * Показать модальное окно об обновлении
     */
    showUpdateCompletedModal() {
        const { updateCompletedModal } = this.elements;
        if (!updateCompletedModal)
            return;
        updateCompletedModal.style.display = 'flex';
        // Небольшая задержка для плавной анимации
        setTimeout(() => {
            updateCompletedModal.classList.remove('hidden');
        }, 10);
        // Блокируем скролл body
        document.body.classList.add('modal-open');
    }
    /**
     * Показать модальное окно предупреждения о несохраненных изменениях в сцене
     */
    showUnsavedSceneChangesModal() {
        const { unsavedSceneChangesModal } = this.elements;
        if (!unsavedSceneChangesModal)
            return;
        unsavedSceneChangesModal.style.display = 'flex';
        // Небольшая задержка для плавной анимации
        setTimeout(() => {
            unsavedSceneChangesModal.classList.remove('hidden');
        }, 10);
        // Блокируем скролл body
        document.body.classList.add('modal-open');
    }
    /**
     * Скрыть модальное окно предупреждения о несохраненных изменениях в сцене
     */
    hideUnsavedSceneChangesModal() {
        const { unsavedSceneChangesModal } = this.elements;
        if (!unsavedSceneChangesModal)
            return;
        if (this.callbacks.onUnsavedSceneCancel) {
            this.callbacks.onUnsavedSceneCancel();
        }
        unsavedSceneChangesModal.classList.add('hidden');
        // Ждем завершения анимации перед скрытием
        setTimeout(() => {
            unsavedSceneChangesModal.style.display = 'none';
            // Разблокируем скролл body
            document.body.classList.remove('modal-open');
        }, 300);
    }
    /**
     * Скрыть модальное окно об обновлении
     */
    hideUpdateCompletedModal() {
        const { updateCompletedModal } = this.elements;
        if (!updateCompletedModal)
            return;
        updateCompletedModal.classList.add('hidden');
        // Ждем завершения анимации перед скрытием
        setTimeout(() => {
            updateCompletedModal.style.display = 'none';
            // Разблокируем скролл body
            document.body.classList.remove('modal-open');
        }, 300);
    }
}
exports.ModalManager = ModalManager;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTW9kYWxNYW5hZ2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc291cmNlL3BhbmVscy9kZWZhdWx0L21vZHVsZXMvTW9kYWxNYW5hZ2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7O0dBR0c7OztBQTJDSCxNQUFhLFlBQVk7SUFJckIsWUFBWSxRQUF1QixFQUFFLFNBQXlCO1FBQzFELElBQUksQ0FBQyxRQUFRLEdBQUcsUUFBUSxDQUFDO1FBQ3pCLElBQUksQ0FBQyxTQUFTLEdBQUcsU0FBUyxDQUFDO1FBQzNCLElBQUksQ0FBQyxtQkFBbUIsRUFBRSxDQUFDO0lBQy9CLENBQUM7SUFFRDs7T0FFRztJQUNLLG1CQUFtQjtRQUN2QixJQUFJLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztRQUN6QixJQUFJLENBQUMscUJBQXFCLEVBQUUsQ0FBQztRQUM3QixJQUFJLENBQUMsd0JBQXdCLEVBQUUsQ0FBQztRQUNoQyxJQUFJLENBQUMsNkJBQTZCLEVBQUUsQ0FBQztRQUNyQyxJQUFJLENBQUMseUJBQXlCLEVBQUUsQ0FBQztRQUNqQyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztRQUN4QixJQUFJLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztRQUN6QixJQUFJLENBQUMscUJBQXFCLEVBQUUsQ0FBQztRQUM3QixJQUFJLENBQUMscUJBQXFCLEVBQUUsQ0FBQztJQUNqQyxDQUFDO0lBRUQ7O09BRUc7SUFDSyxpQkFBaUI7UUFDckIsTUFBTSxFQUFFLFlBQVksRUFBRSxhQUFhLEVBQUUsZUFBZSxFQUFFLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQztRQUV2RSxJQUFJLGFBQWEsRUFBRSxDQUFDO1lBQ2hCLGFBQWEsQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLEVBQUUsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUMsQ0FBQztRQUMzRSxDQUFDO1FBRUQsSUFBSSxlQUFlLEVBQUUsQ0FBQztZQUNs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QyxPQUFPLEdBQUcsTUFBTSxDQUFDO1lBQ2hELDJCQUEyQjtZQUMzQixRQUFRLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDakQsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0lBQ1osQ0FBQztJQUVEOztPQUVHO0lBQ0gsd0JBQXdCO1FBQ3BCLE1BQU0sRUFBRSxvQkFBb0IsRUFBRSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUM7UUFDL0MsSUFBSSxDQUFDLG9CQUFvQjtZQUFFLE9BQU87UUFFbEMsb0JBQW9CLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUM3QywwQ0FBMEM7UUFDMUMsVUFBVSxDQUFDLEdBQUcsRUFBRTtZQUNaLG9CQUFvQixDQUFDLEtBQUssQ0FBQyxPQUFPLEdBQUcsTUFBTSxDQUFDO1lBQzVDLDJCQUEyQjtZQUMzQixRQUFRLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDakQsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0lBQ1osQ0FBQztDQUNKO0FBbG5CRCxvQ0FrbkJDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXHJcbiAqINCc0L7QtNGD0LvRjCDRg9C/0YDQsNCy0LvQtdC90LjRjyDQvNC+0LTQsNC70YzQvdGL0LzQuCDQvtC60L3QsNC80LhcclxuICog0J7RgtCy0LXRh9Cw0LXRgiDQt9CwINC/0L7QutCw0Lcv0YHQutGA0YvRgtC40LUg0LzQvtC00LDQu9GM0L3Ri9GFINC+0LrQvtC9LCDQvtCx0YDQsNCx0L7RgtC60YMg0YHQvtCx0YvRgtC40Lkg0Lgg0LDQvdC40LzQsNGG0LjQuFxyXG4gKi9cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgTW9kYWxFbGVtZW50cyB7XHJcbiAgICB3YXJuaW5nTW9kYWw6IEhUTUxFbGVtZW50O1xyXG4gICAgd2FybmluZ0NhbmNlbDogSFRNTEJ1dHRvbkVsZW1lbnQ7XHJcbiAgICB3YXJuaW5nQ29udGludWU6IEhUTUxCdXR0b25FbGVtZW50O1xyXG4gICAgc2Z0cFdhcm5pbmdNb2RhbDogSFRNTEVsZW1lbnQ7XHJcbiAgICBzZnRwV2FybmluZ0NhbmNlbDogSFRNTEJ1dHRvbkVsZW1lbnQ7XHJcbiAgICBzZnRwV2FybmluZ0NvbnRpbnVlOiBIVE1MQnV0dG9uRWxlbWVudDtcclxuICAgIHNmdHBDbGVhbkluZm86IEhUTUxFbGVtZW50O1xyXG4gICAgdW5zYXZlZENoYW5nZXNNb2RhbDogSFRNTEVsZW1lbnQ7XHJcbiAgICB1bnNhdmVkQ2hhbmdlc0NhbmNlbDogSFRNTEJ1dHRvbkVsZW1lbnQ7XHJcbiAgICB1bnNhdmVkQ2hhbmdlc0Rpc2NhcmQ6IEhUTUxCdXR0b25FbGVtZW50O1xyXG4gICAgdW5zYXZlZFNjZW5lQ2hhbmdlc01vZGFsOiBIVE1MRWxlbWVudDtcclxuICAgIHVuc2F2ZWRTY2VuZUNhbmNlbDogSFRNTEJ1dHRvbkVsZW1lbnQ7XHJcbiAgICB1bnNhdmVkU2NlbmVTYXZlOiBIVE1MQnV0dG9uRWxlbWVudDtcclxuICAgIHVuc2F2ZWRTY2VuZUNvbnRpbnVlOiBIVE1MQnV0dG9uRWxlbWVudDtcclxuICAgIHVwZGF0ZUNvbXBsZXRlZE1vZGFsOiBIVE1MRWxlbWVudDtcclxuICAgIHVwZGF0ZUNvbXBsZXRlZE9rOiBIVE1MQnV0dG9uRWxlbWVudDtcclxuICAgIGluZm9TZWN0aW9uOiBIVE1MRWxlbWVudDtcclxuICAgIHRvZ2dsZUluZm9CdXR0b246IEhUTUxCdXR0b25FbGVtZW50O1xyXG4gICAgY2xvc2VJbmZvQnV0dG9uOiBIVE1MQnV0dG9uRWxlbWVudDtcclxuICAgIHBhdGhzU2VjdGlvbjogSFRNTEVsZW1lbnQ7XHJcbiAgICB0b2dnbGVQYXRoc0J1dHRvbjogSFRNTEJ1dHRvbkVsZW1lbnQ7XHJcbiAgICBjbG9zZVBhdGhzQnV0dG9uOiBIVE1MQnV0dG9uRWxlbWVudDtcclxuICAgIHZhbGlkYXRvclNlY3Rpb246IEhUTUxFbGVtZW50O1xyXG4gICAgdG9nZ2xlVmFsaWRhdG9yQnV0dG9uOiBIVE1MQnV0dG9uRWxlbWVudDtcclxuICAgIGNsb3NlVmFsaWRhdG9yQnV0dG9uOiBIVE1MQnV0dG9uRWxlbWVudDtcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBNb2RhbENhbGxiYWNrcyB7XHJcbiAgICBvbldhcm5pbmdDb250aW51ZTogKCkgPT4gdm9pZDtcclxuICAgIG9uU2Z0cFdhcm5pbmdDb250aW51ZTogKCkgPT4gdm9pZDtcclxuICAgIG9uVW5zYXZlZENoYW5nZXNEaXNjYXJkPzogKCkgPT4gUHJvbWlzZTx2b2lkPiB8IHZvaWQ7XHJcbiAgICBvblVuc2F2ZWRTY2VuZUNhbmNlbD86ICgpID0+IHZvaWQ7XHJcbiAgICBvblVuc2F2ZWRTY2VuZVNhdmU/OiAoKSA9PiBQcm9taXNlPHZvaWQ+IHwgdm9pZDtcclxuICAgIG9uVW5zYXZlZFNjZW5lQ29udGludWU/OiAoKSA9PiB2b2lkO1xyXG4gICAgb25WYWxpZGF0b3JPcGVuPzogKCkgPT4gdm9pZDtcclxuICAgIG9uUGF0aHNPcGVuPzogKCkgPT4gdm9pZDsgLy8g0JLRi9C30YvQstCw0LXRgtGB0Y8g0L/RgNC4INC+0YLQutGA0YvRgtC40Lgg0YHQtdC60YbQuNC4IHBhdGhzXHJcbiAgICBvbkluZm9PcGVuPzogKCkgPT4gdm9pZDsgLy8g0JLRi9C30YvQstCw0LXRgtGB0Y8g0L/RgNC4INC+0YLQutGA0YvRgtC40Lgg0YHQtdC60YbQuNC4IGluZm8gKNGA0LXQtNCw0LrRgtC+0YDQsCDQstC10YDRgdC40LkpXHJcbiAgICBvbkNoZWNrVW5zYXZlZENoYW5nZXM/OiAoKSA9PiBib29sZWFuOyAvLyDQn9GA0L7QstC10YDQutCwINC90LDQu9C40YfQuNGPINC90LXRgdC+0YXRgNCw0L3QtdC90L3Ri9GFINC40LfQvNC10L3QtdC90LjQuVxyXG59XHJcblxyXG5leHBvcnQgY2xhc3MgTW9kYWxNYW5hZ2VyIHtcclxuICAgIHByaXZhdGUgZWxlbWVudHM6IE1vZGFsRWxlbWVudHM7XHJcbiAgICBwcml2YXRlIGNhbGxiYWNrczogTW9kYWxDYWxsYmFja3M7XHJcblxyXG4gICAgY29uc3RydWN0b3IoZWxlbWVudHM6IE1vZGFsRWxlbWVudHMsIGNhbGxiYWNrczogTW9kYWxDYWxsYmFja3MpIHtcclxuICAgICAgICB0aGlzLmVsZW1lbnRzID0gZWxlbWVudHM7XHJcbiAgICAgICAgdGhpcy5jYWxsYmFja3MgPSBjYWxsYmFja3M7XHJcbiAgICAgICAgdGhpcy5zZXR1cEV2ZW50TGlzdGVuZXJzKCk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDQndCw0YHRgtGA0L7QudC60LAg0LLRgdC10YUg0L7QsdGA0LDQsdC+0YLRh9C40LrQvtCyINGB0L7QsdGL0YLQuNC5INC00LvRjyDQvNC+0LTQsNC70YzQvdGL0YUg0L7QutC+0L1cclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBzZXR1cEV2ZW50TGlzdGVuZXJzKCk6IHZvaWQge1xyXG4gICAgICAgIHRoaXMuc2V0dXBXYXJuaW5nTW9kYWwoKTtcclxuICAgICAgICB0aGlzLnNldHVwU2Z0cFdhcm5pbmdNb2RhbCgpO1xyXG4gICAgICAgIHRoaXMuc2V0dXBVbnNhdmVkQ2hhbmdlc01vZGFsKCk7XHJcbiAgICAgICAgdGhpcy5zZXR1cFVuc2F2ZWRTY2VuZUNoYW5nZXNNb2RhbCgpO1xyXG4gICAgICAgIHRoaXMuc2V0dXBVcGRhdGVDb21wbGV0ZWRNb2RhbCgpO1xyXG4gICAgICAgIHRoaXMuc2V0dXBJbmZvU2VjdGlvbigpO1xyXG4gICAgICAgIHRoaXMuc2V0dXBQYXRoc1NlY3Rpb24oKTtcclxuICAgICAgICB0aGlzLnNldHVwVmFsaWRhdG9yU2VjdGlvbigpO1xyXG4gICAgICAgIHRoaXMuc2V0dXBLZXlib2FyZEhhbmRsZXJzKCk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDQndCw0YHRgtGA0L7QudC60LAg0LzQvtC00LDQu9GM0L3QvtCz0L4g0L7QutC90LAg0L/RgNC10LTRg9C/0YDQtdC20LTQtdC90LjRj1xyXG4gICAgICovXHJcbiAgICBwcml2YXRlIHNldHVwV2FybmluZ01vZGFsKCk6IHZvaWQge1xyXG4gICAgICAgIGNvbnN0IHsgd2FybmluZ01vZGFsLCB3YXJuaW5nQ2FuY2VsLCB3YXJuaW5nQ29udGludWUgfSA9IHRoaXMuZWxlbWVudHM7XHJcblxyXG4gICAgICAgIGlmICh3YXJuaW5nQ2FuY2VsKSB7XHJcbiAgICAgICAgICAgIHdhcm5pbmdDYW5jZWwuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB0aGlzLmhpZGVXYXJuaW5nTW9kYWwoKSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAod2FybmluZ0NvbnRpbnVlKSB7XHJcbiAgICAgICAgICAgIHdhcm5pbmdDb250aW51ZS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHRoaXMuY2FsbGJhY2tzLm9uV2FybmluZ0NvbnRpbnVlKCkpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8g0JfQsNC60YDRi9GC0LjQtSDQv9C+INC60LvQuNC60YMg0L3QsCDRhNC+0L1cclxuICAgICAgICBpZiAod2FybmluZ01vZGFsKSB7XHJcbiAgICAgICAgICAgIHdhcm5pbmdNb2RhbC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBpZiAoZS50YXJnZXQgPT09IHdhcm5pbmdNb2RhbCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuaGlkZVdhcm5pbmdNb2RhbCgpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDQndCw0YHRgtGA0L7QudC60LAg0LzQvtC00LDQu9GM0L3QvtCz0L4g0L7QutC90LAg0L/RgNC10LTRg9C/0YDQtdC20LTQtdC90LjRjyBTRlRQXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgc2V0dXBTZnRwV2FybmluZ01vZGFsKCk6IHZvaWQge1xyXG4gICAgICAgIGNvbnN0IHsgc2Z0cFdhcm5pbmdNb2RhbCwgc2Z0cFdhcm5pbmdDYW5jZWwsIHNmdHBXYXJuaW5nQ29udGludWUgfSA9IHRoaXMuZWxlbWVudHM7XHJcblxyXG4gICAgICAgIGlmIChzZnRwV2FybmluZ0NhbmNlbCkge1xyXG4gICAgICAgICAgICBzZnRwV2FybmluZ0NhbmNlbC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHRoaXMuaGlkZVNmdHBXYXJuaW5nTW9kYWwoKSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoc2Z0cFdhcm5pbmdDb250aW51ZSkge1xyXG4gICAgICAgICAgICBzZnRwV2FybmluZ0NvbnRpbnVlLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gdGhpcy5jYWxsYmFja3Mub25TZnRwV2FybmluZ0NvbnRpbnVlKCkpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8g0JfQsNC60YDRi9GC0LjQtSDQv9C+INC60LvQuNC60YMg0L3QsCDRhNC+0L1cclxuICAgICAgICBpZiAoc2Z0cFdhcm5pbmdNb2RhbCkge1xyXG4gICAgICAgICAgICBzZnRwV2FybmluZ01vZGFsLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGUpID0+IHtcclxuICAgICAgICAgICAgICAgIGlmIChlLnRhcmdldCA9PT0gc2Z0cFdhcm5pbmdNb2RhbCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuaGlkZVNmdHBXYXJuaW5nTW9kYWwoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog0J3QsNGB0YLRgNC+0LnQutCwINC80L7QtNCw0LvRjNC90L7Qs9C+INC+0LrQvdCwINC/0YDQtdC00YPQv9GA0LXQttC00LXQvdC40Y8g0L4g0L3QtdGB0L7RhdGA0LDQvdC10L3QvdGL0YUg0LjQt9C80LXQvdC10L3QuNGP0YVcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBzZXR1cFVuc2F2ZWRDaGFuZ2VzTW9kYWwoKTogdm9pZCB7XHJcbiAgICAgICAgY29uc3QgeyB1bnNhdmVkQ2hhbmdlc01vZGFsLCB1bnNhdmVkQ2hhbmdlc0NhbmNlbCwgdW5zYXZlZENoYW5nZXNEaXNjYXJkIH0gPSB0aGlzLmVsZW1lbnRzO1xyXG5cclxuICAgICAgICBpZiAodW5zYXZlZENoYW5nZXNDYW5jZWwpIHtcclxuICAgICAgICAgICAgdW5zYXZlZENoYW5nZXNDYW5jZWwuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB0aGlzLmhpZGVVbnNhdmVkQ2hhbmdlc01vZGFsKCkpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHVuc2F2ZWRDaGFuZ2VzRGlzY2FyZCkge1xyXG4gICAgICAgICAgICB1bnNhdmVkQ2hhbmdlc0Rpc2NhcmQuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5jYWxsYmFja3Mub25VbnNhdmVkQ2hhbmdlc0Rpc2NhcmQpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmNhbGxiYWNrcy5vblVuc2F2ZWRDaGFuZ2VzRGlzY2FyZCgpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgdGhpcy5oaWRlVW5zYXZlZENoYW5nZXNNb2RhbCgpO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAvLyDQldGB0LvQuCDQtdGB0YLRjCDQvtGC0LvQvtC20LXQvdC90L7QtSDQt9Cw0LrRgNGL0YLQuNC1IGluZm8tc2VjdGlvbiwg0LLRi9C/0L7Qu9C90Y/QtdC8INC10LPQvlxyXG4gICAgICAgICAgICAgICAgaWYgKCh0aGlzIGFzIGFueSkucGVuZGluZ0Nsb3NlSW5mb1NlY3Rpb24pIHtcclxuICAgICAgICAgICAgICAgICAgICAodGhpcyBhcyBhbnkpLnBlbmRpbmdDbG9zZUluZm9TZWN0aW9uKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgKHRoaXMgYXMgYW55KS5wZW5kaW5nQ2xvc2VJbmZvU2VjdGlvbiA9IG51bGw7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8g0JfQsNC60YDRi9GC0LjQtSDQv9C+INC60LvQuNC60YMg0L3QsCDRhNC+0L1cclxuICAgICAgICBpZiAodW5zYXZlZENoYW5nZXNNb2RhbCkge1xyXG4gICAgICAgICAgICB1bnNhdmVkQ2hhbmdlc01vZGFsLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGUpID0+IHtcclxuICAgICAgICAgICAgICAgIGlmIChlLnRhcmdldCA9PT0gdW5zYXZlZENoYW5nZXNNb2RhbCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuaGlkZVVuc2F2ZWRDaGFuZ2VzTW9kYWwoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog0J3QsNGB0YLRgNC+0LnQutCwINC40L3RhNC+0YDQvNCw0YbQuNC+0L3QvdC+0Lkg0YHQtdC60YbQuNC4XHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgc2V0dXBJbmZvU2VjdGlvbigpOiB2b2lkIHtcclxuICAgICAgICBjb25zdCB7IGluZm9TZWN0aW9uLCB0b2dnbGVJbmZvQnV0dG9uLCBjbG9zZUluZm9CdXR0b24gfSA9IHRoaXMuZWxlbWVudHM7XHJcblxyXG4gICAgICAgIGlmICh0b2dnbGVJbmZvQnV0dG9uKSB7XHJcbiAgICAgICAgICAgIHRvZ2dsZUluZm9CdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB0aGlzLnRvZ2dsZUluZm9TZWN0aW9uKCkpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKGNsb3NlSW5mb0J1dHRvbikge1xyXG4gICAgICAgICAgICBjbG9zZUluZm9CdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB0aGlzLmNsb3NlSW5mb1NlY3Rpb24oKSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDQl9Cw0LrRgNGL0YLQuNC1INC/0L4g0LrQu9C40LrRgyDQvdCwINGE0L7QvVxyXG4gICAgICAgIGlmIChpbmZvU2VjdGlvbikge1xyXG4gICAgICAgICAgICBpbmZvU2VjdGlvbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBpZiAoZS50YXJnZXQgPT09IGluZm9TZWN0aW9uKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jbG9zZUluZm9TZWN0aW9uKCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqINCd0LDRgdGC0YDQvtC50LrQsCDQvNC+0LTQsNC70YzQvdC+0LPQviDQvtC60L3QsCDQv9GA0LXQtNGD0L/RgNC10LbQtNC10L3QuNGPINC+INC90LXRgdC+0YXRgNCw0L3QtdC90L3Ri9GFINC40LfQvNC10L3QtdC90LjRj9GFINCyINGB0YbQtdC90LVcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBzZXR1cFVuc2F2ZWRTY2VuZUNoYW5nZXNNb2RhbCgpOiB2b2lkIHtcclxuICAgICAgICBjb25zdCB7IHVuc2F2ZWRTY2VuZUNoYW5nZXNNb2RhbCwgdW5zYXZlZFNjZW5lQ2FuY2VsLCB1bnNhdmVkU2NlbmVTYXZlLCB1bnNhdmVkU2NlbmVDb250aW51ZSB9ID0gdGhpcy5lbGVtZW50cztcclxuXHJcbiAgICAgICAgaWYgKHVuc2F2ZWRTY2VuZUNhbmNlbCkge1xyXG4gICAgICAgICAgICB1bnNhdmVkU2NlbmVDYW5jZWwuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB0aGlzLmhpZGVVbnNhdmVkU2NlbmVDaGFuZ2VzTW9kYWwoKSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAodW5zYXZlZFNjZW5lU2F2ZSkge1xyXG4gICAgICAgICAgICB1bnNhdmVkU2NlbmVTYXZlLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgYXN5bmMgKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuY2FsbGJhY2tzLm9uVW5zYXZlZFNjZW5lU2F2ZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuY2FsbGJhY2tzLm9uVW5zYXZlZFNjZW5lU2F2ZSgpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgdGhpcy5oaWRlVW5zYXZlZFNjZW5lQ2hhbmdlc01vZGFsKCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHVuc2F2ZWRTY2VuZUNvbnRpbnVlKSB7XHJcbiAgICAgICAgICAgIHVuc2F2ZWRTY2VuZUNvbnRpbnVlLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuY2FsbGJhY2tzLm9uVW5zYXZlZFNjZW5lQ29udGludWUpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmNhbGxiYWNrcy5vblVuc2F2ZWRTY2VuZUNvbnRpbnVlKCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB0aGlzLmhpZGVVbnNhdmVkU2NlbmVDaGFuZ2VzTW9kYWwoKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDQl9Cw0LrRgNGL0YLQuNC1INC/0L4g0LrQu9C40LrRgyDQvdCwINGE0L7QvVxyXG4gICAgICAgIGlmICh1bnNhdmVkU2NlbmVDaGFuZ2VzTW9kYWwpIHtcclxuICAgICAgICAgICAgdW5zYXZlZFNjZW5lQ2hhbmdlc01vZGFsLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGUpID0+IHtcclxuICAgICAgICAgICAgICAgIGlmIChlLnRhcmdldCA9PT0gdW5zYXZlZFNjZW5lQ2hhbmdlc01vZGFsKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5oaWRlVW5zYXZlZFNjZW5lQ2hhbmdlc01vZGFsKCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqINCd0LDRgdGC0YDQvtC50LrQsCDQvNC+0LTQsNC70YzQvdC+0LPQviDQvtC60L3QsCDQvtCxINC+0LHQvdC+0LLQu9C10L3QuNC4XHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgc2V0dXBVcGRhdGVDb21wbGV0ZWRNb2RhbCgpOiB2b2lkIHtcclxuICAgICAgICBjb25zdCB7IHVwZGF0ZUNvbXBsZXRlZE1vZGFsLCB1cGRhdGVDb21wbGV0ZWRPayB9ID0gdGhpcy5lbGVtZW50cztcclxuXHJcbiAgICAgICAgaWYgKHVwZGF0ZUNvbXBsZXRlZE9rKSB7XHJcbiAgICAgICAgICAgIHVwZGF0ZUNvbXBsZXRlZE9rLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gdGhpcy5oaWRlVXBkYXRlQ29tcGxldGVkTW9kYWwoKSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDQl9Cw0LrRgNGL0YLQuNC1INC/0L4g0LrQu9C40LrRgyDQvdCwINGE0L7QvVxyXG4gICAgICAgIGlmICh1cGRhdGVDb21wbGV0ZWRNb2RhbCkge1xyXG4gICAgICAgICAgICB1cGRhdGVDb21wbGV0ZWRNb2RhbC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBpZiAoZS50YXJnZXQgPT09IHVwZGF0ZUNvbXBsZXRlZE1vZGFsKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5oaWRlVXBkYXRlQ29tcGxldGVkTW9kYWwoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog0J3QsNGB0YLRgNC+0LnQutCwINGB0LXQutGG0LjQuCDQv9GD0YLQtdC5XHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgc2V0dXBQYXRoc1NlY3Rpb24oKTogdm9pZCB7XHJcbiAgICAgICAgY29uc3QgeyBwYXRoc1NlY3Rpb24sIHRvZ2dsZVBhdGhzQnV0dG9uLCBjbG9zZVBhdGhzQnV0dG9uIH0gPSB0aGlzLmVsZW1lbnRzO1xyXG5cclxuICAgICAgICBpZiAodG9nZ2xlUGF0aHNCdXR0b24pIHtcclxuICAgICAgICAgICAgdG9nZ2xlUGF0aHNCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB0aGlzLnRvZ2dsZVBhdGhzU2VjdGlvbigpKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmIChjbG9zZVBhdGhzQnV0dG9uKSB7XHJcbiAgICAgICAgICAgIGNsb3NlUGF0aHNCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB0aGlzLmNsb3NlUGF0aHNTZWN0aW9uKCkpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8g0JfQsNC60YDRi9GC0LjQtSDQv9C+INC60LvQuNC60YMg0L3QsCDRhNC+0L1cclxuICAgICAgICBpZiAocGF0aHNTZWN0aW9uKSB7XHJcbiAgICAgICAgICAgIHBhdGhzU2VjdGlvbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBpZiAoZS50YXJnZXQgPT09IHBhdGhzU2VjdGlvbikge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY2xvc2VQYXRoc1NlY3Rpb24oKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog0J3QsNGB0YLRgNC+0LnQutCwINGB0LXQutGG0LjQuCDQstCw0LvQuNC00LDRgtC+0YDQsFxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIHNldHVwVmFsaWRhdG9yU2VjdGlvbigpOiB2b2lkIHtcclxuICAgICAgICBjb25zdCB7IHZhbGlkYXRvclNlY3Rpb24sIHRvZ2dsZVZhbGlkYXRvckJ1dHRvbiwgY2xvc2VWYWxpZGF0b3JCdXR0b24gfSA9IHRoaXMuZWxlbWVudHM7XHJcblxyXG4gICAgICAgIGlmICh0b2dnbGVWYWxpZGF0b3JCdXR0b24pIHtcclxuICAgICAgICAgICAgdG9nZ2xlVmFsaWRhdG9yQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gdGhpcy50b2dnbGVWYWxpZGF0b3JTZWN0aW9uKCkpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKGNsb3NlVmFsaWRhdG9yQnV0dG9uKSB7XHJcbiAgICAgICAgICAgIGNsb3NlVmFsaWRhdG9yQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gdGhpcy5jbG9zZVZhbGlkYXRvclNlY3Rpb24oKSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDQl9Cw0LrRgNGL0YLQuNC1INC/0L4g0LrQu9C40LrRgyDQvdCwINGE0L7QvVxyXG4gICAgICAgIGlmICh2YWxpZGF0b3JTZWN0aW9uKSB7XHJcbiAgICAgICAgICAgIHZhbGlkYXRvclNlY3Rpb24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgaWYgKGUudGFyZ2V0ID09PSB2YWxpZGF0b3JTZWN0aW9uKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jbG9zZVZhbGlkYXRvclNlY3Rpb24oKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog0J3QsNGB0YLRgNC+0LnQutCwINC+0LHRgNCw0LHQvtGC0YfQuNC60L7QsiDQutC70LDQstC40LDRgtGD0YDRi1xyXG4gICAgICovXHJcbiAgICBwcml2YXRlIHNldHVwS2V5Ym9hcmRIYW5kbGVycygpOiB2b2lkIHtcclxuICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgKGUpID0+IHtcclxuICAgICAgICAgICAgaWYgKGUua2V5ID09PSAnRXNjYXBlJykge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5oYW5kbGVFc2NhcGVLZXkoKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog0J7QsdGA0LDQsdC+0YLQutCwINC90LDQttCw0YLQuNGPINC60LvQsNCy0LjRiNC4IEVzY2FwZVxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIGhhbmRsZUVzY2FwZUtleSgpOiB2b2lkIHtcclxuICAgICAgICBjb25zdCB7IHdhcm5pbmdNb2RhbCwgc2Z0cFdhcm5pbmdNb2RhbCwgdW5zYXZlZENoYW5nZXNNb2RhbCwgdW5zYXZlZFNjZW5lQ2hhbmdlc01vZGFsLCB1cGRhdGVDb21wbGV0ZWRNb2RhbCwgaW5mb1NlY3Rpb24sIHBhdGhzU2VjdGlvbiwgdmFsaWRhdG9yU2VjdGlvbiB9ID0gdGhpcy5lbGVtZW50cztcclxuXHJcbiAgICAgICAgLy8g0J/RgNC40L7RgNC40YLQtdGCOiB3YXJuaW5nIG1vZGFsID4gc2Z0cCB3YXJuaW5nIG1vZGFsID4gdW5zYXZlZCBjaGFuZ2VzIG1vZGFsID4gdW5zYXZlZCBzY2VuZSBjaGFuZ2VzIG1vZGFsID4gdXBkYXRlIGNvbXBsZXRlZCBtb2RhbCA+IGluZm8gc2VjdGlvbiA+IHBhdGhzIHNlY3Rpb24gPiB2YWxpZGF0b3Igc2VjdGlvblxyXG4gICAgICAgIGlmICh3YXJuaW5nTW9kYWwgJiYgIXdhcm5pbmdNb2RhbC5jbGFzc0xpc3QuY29udGFpbnMoJ2hpZGRlbicpKSB7XHJcbiAgICAgICAgICAgIHRoaXMuaGlkZVdhcm5pbmdNb2RhbCgpO1xyXG4gICAgICAgIH0gZWxzZSBpZiAoc2Z0cFdhcm5pbmdNb2RhbCAmJiAhc2Z0cFdhcm5pbmdNb2RhbC5jbGFzc0xpc3QuY29udGFpbnMoJ2hpZGRlbicpKSB7XHJcbiAgICAgICAgICAgIHRoaXMuaGlkZVNmdHBXYXJuaW5nTW9kYWwoKTtcclxuICAgICAgICB9IGVsc2UgaWYgKHVuc2F2ZWRDaGFuZ2VzTW9kYWwgJiYgIXVuc2F2ZWRDaGFuZ2VzTW9kYWwuY2xhc3NMaXN0LmNvbnRhaW5zKCdoaWRkZW4nKSkge1xyXG4gICAgICAgICAgICB0aGlzLmhpZGVVbnNhdmVkQ2hhbmdlc01vZGFsKCk7XHJcbiAgICAgICAgfSBlbHNlIGlmICh1bnNhdmVkU2NlbmVDaGFuZ2VzTW9kYWwgJiYgIXVuc2F2ZWRTY2VuZUNoYW5nZXNNb2RhbC5jbGFzc0xpc3QuY29udGFpbnMoJ2hpZGRlbicpKSB7XHJcbiAgICAgICAgICAgIHRoaXMuaGlkZVVuc2F2ZWRTY2VuZUNoYW5nZXNNb2RhbCgpO1xyXG4gICAgICAgIH0gZWxzZSBpZiAodXBkYXRlQ29tcGxldGVkTW9kYWwgJiYgIXVwZGF0ZUNvbXBsZXRlZE1vZGFsLmNsYXNzTGlzdC5jb250YWlucygnaGlkZGVuJykpIHtcclxuICAgICAgICAgICAgdGhpcy5oaWRlVXBkYXRlQ29tcGxldGVkTW9kYWwoKTtcclxuICAgICAgICB9IGVsc2UgaWYgKGluZm9TZWN0aW9uICYmIGluZm9TZWN0aW9uLmNsYXNzTGlzdC5jb250YWlucygnc2hvdycpKSB7XHJcbiAgICAgICAgICAgIHRoaXMuY2xvc2VJbmZvU2VjdGlvbigpO1xyXG4gICAgICAgIH0gZWxzZSBpZiAocGF0aHNTZWN0aW9uICYmIHBhdGhzU2VjdGlvbi5jbGFzc0xpc3QuY29udGFpbnMoJ3Nob3cnKSkge1xyXG4gICAgICAgICAgICB0aGlzLmNsb3NlUGF0aHNTZWN0aW9uKCk7XHJcbiAgICAgICAgfSBlbHNlIGlmICh2YWxpZGF0b3JTZWN0aW9uICYmIHZhbGlkYXRvclNlY3Rpb24uY2xhc3NMaXN0LmNvbnRhaW5zKCdzaG93JykpIHtcclxuICAgICAgICAgICAgdGhpcy5jbG9zZVZhbGlkYXRvclNlY3Rpb24oKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDQn9C+0LrQsNC30LDRgtGMINC80L7QtNCw0LvRjNC90L7QtSDQvtC60L3QviDQv9GA0LXQtNGD0L/RgNC10LbQtNC10L3QuNGPXHJcbiAgICAgKi9cclxuICAgIHNob3dXYXJuaW5nTW9kYWwoKTogdm9pZCB7XHJcbiAgICAgICAgY29uc3QgeyB3YXJuaW5nTW9kYWwgfSA9IHRoaXMuZWxlbWVudHM7XHJcbiAgICAgICAgaWYgKCF3YXJuaW5nTW9kYWwpIHJldHVybjtcclxuXHJcbiAgICAgICAgd2FybmluZ01vZGFsLnN0eWxlLmRpc3BsYXkgPSAnZmxleCc7XHJcbiAgICAgICAgLy8g0J3QtdCx0L7Qu9GM0YjQsNGPINC30LDQtNC10YDQttC60LAg0LTQu9GPINC/0LvQsNCy0L3QvtC5INCw0L3QuNC80LDRhtC40LhcclxuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcclxuICAgICAgICAgICAgd2FybmluZ01vZGFsLmNsYXNzTGlzdC5yZW1vdmUoJ2hpZGRlbicpO1xyXG4gICAgICAgIH0sIDEwKTtcclxuICAgICAgICAvLyDQkdC70L7QutC40YDRg9C10Lwg0YHQutGA0L7Qu9C7IGJvZHlcclxuICAgICAgICBkb2N1bWVudC5ib2R5LmNsYXNzTGlzdC5hZGQoJ21vZGFsLW9wZW4nKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqINCh0LrRgNGL0YLRjCDQvNC+0LTQsNC70YzQvdC+0LUg0L7QutC90L4g0L/RgNC10LTRg9C/0YDQtdC20LTQtdC90LjRj1xyXG4gICAgICovXHJcbiAgICBoaWRlV2FybmluZ01vZGFsKCk6IHZvaWQge1xyXG4gICAgICAgIGNvbnN0IHsgd2FybmluZ01vZGFsIH0gPSB0aGlzLmVsZW1lbnRzO1xyXG4gICAgICAgIGlmICghd2FybmluZ01vZGFsKSByZXR1cm47XHJcblxyXG4gICAgICAgIHdhcm5pbmdNb2RhbC5jbGFzc0xpc3QuYWRkKCdoaWRkZW4nKTtcclxuICAgICAgICAvLyDQltC00LXQvCDQt9Cw0LLQtdGA0YjQtdC90LjRjyDQsNC90LjQvNCw0YbQuNC4INC/0LXRgNC10LQg0YHQutGA0YvRgtC40LXQvFxyXG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgICAgICAgICB3YXJuaW5nTW9kYWwuc3R5bGUuZGlzcGxheSA9ICdub25lJztcclxuICAgICAgICAgICAgLy8g0KDQsNC30LHQu9C+0LrQuNGA0YPQtdC8INGB0LrRgNC+0LvQuyBib2R5XHJcbiAgICAgICAgICAgIGRvY3VtZW50LmJvZHkuY2xhc3NMaXN0LnJlbW92ZSgnbW9kYWwtb3BlbicpO1xyXG4gICAgICAgIH0sIDMwMCk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDQn9C+0LrQsNC30LDRgtGMINC80L7QtNCw0LvRjNC90L7QtSDQvtC60L3QviDQv9GA0LXQtNGD0L/RgNC10LbQtNC10L3QuNGPIFNGVFBcclxuICAgICAqL1xyXG4gICAgc2hvd1NmdHBXYXJuaW5nTW9kYWwoKTogdm9pZCB7XHJcbiAgICAgICAgY29uc3QgeyBzZnRwV2FybmluZ01vZGFsIH0gPSB0aGlzLmVsZW1lbnRzO1xyXG4gICAgICAgIGlmICghc2Z0cFdhcm5pbmdNb2RhbCkgcmV0dXJuO1xyXG5cclxuICAgICAgICBzZnRwV2FybmluZ01vZGFsLnN0eWxlLmRpc3BsYXkgPSAnZmxleCc7XHJcbiAgICAgICAgLy8g0J3QtdCx0L7Qu9GM0YjQsNGPINC30LDQtNC10YDQttC60LAg0LTQu9GPINC/0LvQsNCy0L3QvtC5INCw0L3QuNC80LDRhtC40LhcclxuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcclxuICAgICAgICAgICAgc2Z0cFdhcm5pbmdNb2RhbC5jbGFzc0xpc3QucmVtb3ZlKCdoaWRkZW4nKTtcclxuICAgICAgICB9LCAxMCk7XHJcbiAgICAgICAgLy8g0JHQu9C+0LrQuNGA0YPQtdC8INGB0LrRgNC+0LvQuyBib2R5XHJcbiAgICAgICAgZG9jdW1lbnQuYm9keS5jbGFzc0xpc3QuYWRkKCdtb2RhbC1vcGVuJyk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDQodC60YDRi9GC0Ywg0LzQvtC00LDQu9GM0L3QvtC1INC+0LrQvdC+INC/0YDQtdC00YPQv9GA0LXQttC00LXQvdC40Y8gU0ZUUFxyXG4gICAgICovXHJcbiAgICBoaWRlU2Z0cFdhcm5pbmdNb2RhbCgpOiB2b2lkIHtcclxuICAgICAgICBjb25zdCB7IHNmdHBXYXJuaW5nTW9kYWwgfSA9IHRoaXMuZWxlbWVudHM7XHJcbiAgICAgICAgaWYgKCFzZnRwV2FybmluZ01vZGFsKSByZXR1cm47XHJcblxyXG4gICAgICAgIHNmdHBXYXJuaW5nTW9kYWwuY2xhc3NMaXN0LmFkZCgnaGlkZGVuJyk7XHJcbiAgICAgICAgLy8g0JbQtNC10Lwg0LfQsNCy0LXRgNGI0LXQvdC40Y8g0LDQvdC40LzQsNGG0LjQuCDQv9C10YDQtdC0INGB0LrRgNGL0YLQuNC10LxcclxuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcclxuICAgICAgICAgICAgc2Z0cFdhcm5pbmdNb2RhbC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xyXG4gICAgICAgICAgICAvLyDQoNCw0LfQsdC70L7QutC40YDRg9C10Lwg0YHQutGA0L7Qu9C7IGJvZHlcclxuICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5jbGFzc0xpc3QucmVtb3ZlKCdtb2RhbC1vcGVuJyk7XHJcbiAgICAgICAgfSwgMzAwKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqINCf0LXRgNC10LrQu9GO0YfQuNGC0Ywg0LjQvdGE0L7RgNC80LDRhtC40L7QvdC90YPRjiDRgdC10LrRhtC40Y5cclxuICAgICAqL1xyXG4gICAgdG9nZ2xlSW5mb1NlY3Rpb24oKTogdm9pZCB7XHJcbiAgICAgICAgY29uc3QgeyBpbmZvU2VjdGlvbiB9ID0gdGhpcy5lbGVtZW50cztcclxuICAgICAgICBpZiAoIWluZm9TZWN0aW9uKSByZXR1cm47XHJcblxyXG4gICAgICAgIGNvbnN0IGlzT3BlbiA9IGluZm9TZWN0aW9uLmNsYXNzTGlzdC5jb250YWlucygnc2hvdycpO1xyXG4gICAgICAgIGlmIChpc09wZW4pIHtcclxuICAgICAgICAgICAgdGhpcy5jbG9zZUluZm9TZWN0aW9uKCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgdGhpcy5vcGVuSW5mb1NlY3Rpb24oKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDQntGC0LrRgNGL0YLRjCDQuNC90YTQvtGA0LzQsNGG0LjQvtC90L3Rg9GOINGB0LXQutGG0LjRjlxyXG4gICAgICovXHJcbiAgICBvcGVuSW5mb1NlY3Rpb24oKTogdm9pZCB7XHJcbiAgICAgICAgY29uc3QgeyBpbmZvU2VjdGlvbiB9ID0gdGhpcy5lbGVtZW50cztcclxuICAgICAgICBpZiAoIWluZm9TZWN0aW9uKSByZXR1cm47XHJcblxyXG4gICAgICAgIC8vINCR0LvQvtC60LjRgNGD0LXQvCDRgdC60YDQvtC70LsgYm9keVxyXG4gICAgICAgIGRvY3VtZW50LmJvZHkuY2xhc3NMaXN0LmFkZCgnbW9kYWwtb3BlbicpO1xyXG5cclxuICAgICAgICBpbmZvU2VjdGlvbi5zdHlsZS5kaXNwbGF5ID0gJ2ZsZXgnO1xyXG4gICAgICAgIC8vINCd0LXQsdC+0LvRjNGI0LDRjyDQt9Cw0LTQtdGA0LbQutCwINC00LvRjyDQv9C70LDQstC90L7QuSDQsNC90LjQvNCw0YbQuNC4XHJcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgICAgICAgIGluZm9TZWN0aW9uLmNsYXNzTGlzdC5hZGQoJ3Nob3cnKTtcclxuICAgICAgICAgICAgLy8g0JLRi9C30YvQstCw0LXQvCBjYWxsYmFjayDQtNC70Y8g0LfQsNCz0YDRg9C30LrQuCDRgdCy0LXQttC40YUg0LTQsNC90L3Ri9GFXHJcbiAgICAgICAgICAgIGlmICh0aGlzLmNhbGxiYWNrcy5vbkluZm9PcGVuKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmNhbGxiYWNrcy5vbkluZm9PcGVuKCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LCAxMCk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDQl9Cw0LrRgNGL0YLRjCDQuNC90YTQvtGA0LzQsNGG0LjQvtC90L3Rg9GOINGB0LXQutGG0LjRjlxyXG4gICAgICovXHJcbiAgICBjbG9zZUluZm9TZWN0aW9uKCk6IHZvaWQge1xyXG4gICAgICAgIGNvbnN0IHsgaW5mb1NlY3Rpb24gfSA9IHRoaXMuZWxlbWVudHM7XHJcbiAgICAgICAgaWYgKCFpbmZvU2VjdGlvbikgcmV0dXJuO1xyXG5cclxuICAgICAgICAvLyDQn9GA0L7QstC10YDRj9C10Lwg0L3QsNC70LjRh9C40LUg0L3QtdGB0L7RhdGA0LDQvdC10L3QvdGL0YUg0LjQt9C80LXQvdC10L3QuNC5INC/0LXRgNC10LQg0LfQsNC60YDRi9GC0LjQtdC8XHJcbiAgICAgICAgaWYgKHRoaXMuY2FsbGJhY2tzLm9uQ2hlY2tVbnNhdmVkQ2hhbmdlcyAmJiB0aGlzLmNhbGxiYWNrcy5vbkNoZWNrVW5zYXZlZENoYW5nZXMoKSkge1xyXG4gICAgICAgICAgICAvLyDQldGB0YLRjCDQvdC10YHQvtGF0YDQsNC90LXQvdC90YvQtSDQuNC30LzQtdC90LXQvdC40Y8gLSDQv9C+0LrQsNC30YvQstCw0LXQvCDQvNC+0LTQsNC70YzQvdC+0LUg0L7QutC90L5cclxuICAgICAgICAgICAgdGhpcy5zaG93VW5zYXZlZENoYW5nZXNNb2RhbCgpO1xyXG4gICAgICAgICAgICAvLyDQodC+0YXRgNCw0L3Rj9C10LwgY2FsbGJhY2sg0LTQu9GPINC30LDQutGA0YvRgtC40Y8g0YHQtdC60YbQuNC4INC/0L7RgdC70LUg0L/QvtC00YLQstC10YDQttC00LXQvdC40Y9cclxuICAgICAgICAgICAgKHRoaXMgYXMgYW55KS5wZW5kaW5nQ2xvc2VJbmZvU2VjdGlvbiA9ICgpID0+IHtcclxuICAgICAgICAgICAgICAgIHRoaXMuZG9DbG9zZUluZm9TZWN0aW9uKCk7XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vINCd0LXRgiDQvdC10YHQvtGF0YDQsNC90LXQvdC90YvRhSDQuNC30LzQtdC90LXQvdC40LkgLSDQt9Cw0LrRgNGL0LLQsNC10Lwg0YHRgNCw0LfRg1xyXG4gICAgICAgIHRoaXMuZG9DbG9zZUluZm9TZWN0aW9uKCk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDQktGL0L/QvtC70L3QuNGC0Ywg0LfQsNC60YDRi9GC0LjQtSDQuNC90YTQvtGA0LzQsNGG0LjQvtC90L3QvtC5INGB0LXQutGG0LjQuFxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIGRvQ2xvc2VJbmZvU2VjdGlvbigpOiB2b2lkIHtcclxuICAgICAgICBjb25zdCB7IGluZm9TZWN0aW9uIH0gPSB0aGlzLmVsZW1lbnRzO1xyXG4gICAgICAgIGlmICghaW5mb1NlY3Rpb24pIHJldHVybjtcclxuXHJcbiAgICAgICAgaW5mb1NlY3Rpb24uY2xhc3NMaXN0LnJlbW92ZSgnc2hvdycpO1xyXG4gICAgICAgIC8vINCW0LTQtdC8INC30LDQstC10YDRiNC10L3QuNGPINCw0L3QuNC80LDRhtC40Lgg0L/QtdGA0LXQtCDRgdC60YDRi9GC0LjQtdC8XHJcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgICAgICAgIGluZm9TZWN0aW9uLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XHJcbiAgICAgICAgICAgIC8vINCg0LDQt9Cx0LvQvtC60LjRgNGD0LXQvCDRgdC60YDQvtC70LsgYm9keVxyXG4gICAgICAgICAgICBkb2N1bWVudC5ib2R5LmNsYXNzTGlzdC5yZW1vdmUoJ21vZGFsLW9wZW4nKTtcclxuICAgICAgICB9LCAzMDApO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog0J/QtdGA0LXQutC70Y7Rh9C40YLRjCDRgdC10LrRhtC40Y4g0L/Rg9GC0LXQuVxyXG4gICAgICovXHJcbiAgICB0b2dnbGVQYXRoc1NlY3Rpb24oKTogdm9pZCB7XHJcbiAgICAgICAgY29uc3QgeyBwYXRoc1NlY3Rpb24sIGluZm9TZWN0aW9uLCB2YWxpZGF0b3JTZWN0aW9uIH0gPSB0aGlzLmVsZW1lbnRzO1xyXG5cclxuICAgICAgICBpZiAoIXBhdGhzU2VjdGlvbikgcmV0dXJuO1xyXG5cclxuICAgICAgICAvLyDQl9Cw0LrRgNGL0LLQsNC10Lwg0LTRgNGD0LPQuNC1INGB0LXQutGG0LjQuCDQv9GA0Lgg0L7RgtC60YDRi9GC0LjQuCDRjdGC0L7QuVxyXG4gICAgICAgIGlmIChpbmZvU2VjdGlvbiAmJiBpbmZvU2VjdGlvbi5jbGFzc0xpc3QuY29udGFpbnMoJ3Nob3cnKSkge1xyXG4gICAgICAgICAgICB0aGlzLmNsb3NlSW5mb1NlY3Rpb24oKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHZhbGlkYXRvclNlY3Rpb24gJiYgdmFsaWRhdG9yU2VjdGlvbi5jbGFzc0xpc3QuY29udGFpbnMoJ3Nob3cnKSkge1xyXG4gICAgICAgICAgICB0aGlzLmNsb3NlVmFsaWRhdG9yU2VjdGlvbigpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHBhdGhzU2VjdGlvbi5jbGFzc0xpc3QuY29udGFpbnMoJ3Nob3cnKSkge1xyXG4gICAgICAgICAgICB0aGlzLmNsb3NlUGF0aHNTZWN0aW9uKCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgcGF0aHNTZWN0aW9uLmNsYXNzTGlzdC5hZGQoJ3Nob3cnKTtcclxuICAgICAgICAgICAgLy8g0JHQu9C+0LrQuNGA0YPQtdC8INGB0LrRgNC+0LvQuyBib2R5XHJcbiAgICAgICAgICAgIGRvY3VtZW50LmJvZHkuY2xhc3NMaXN0LmFkZCgnbW9kYWwtb3BlbicpO1xyXG4gICAgICAgICAgICAvLyDQktGL0LfRi9Cy0LDQtdC8IGNhbGxiYWNrINC00LvRjyDQvtCx0L3QvtCy0LvQtdC90LjRjyDQtNCw0L3QvdGL0YVcclxuICAgICAgICAgICAgaWYgKHRoaXMuY2FsbGJhY2tzLm9uUGF0aHNPcGVuKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmNhbGxiYWNrcy5vblBhdGhzT3BlbigpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog0JfQsNC60YDRi9GC0Ywg0YHQtdC60YbQuNGOINC/0YPRgtC10LlcclxuICAgICAqL1xyXG4gICAgY2xvc2VQYXRoc1NlY3Rpb24oKTogdm9pZCB7XHJcbiAgICAgICAgY29uc3QgeyBwYXRoc1NlY3Rpb24gfSA9IHRoaXMuZWxlbWVudHM7XHJcbiAgICAgICAgaWYgKCFwYXRoc1NlY3Rpb24pIHJldHVybjtcclxuXHJcbiAgICAgICAgcGF0aHNTZWN0aW9uLmNsYXNzTGlzdC5yZW1vdmUoJ3Nob3cnKTtcclxuICAgICAgICAvLyDQoNCw0LfQsdC70L7QutC40YDRg9C10Lwg0YHQutGA0L7Qu9C7IGJvZHlcclxuICAgICAgICBkb2N1bWVudC5ib2R5LmNsYXNzTGlzdC5yZW1vdmUoJ21vZGFsLW9wZW4nKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqINCf0LXRgNC10LrQu9GO0YfQuNGC0Ywg0YHQtdC60YbQuNGOINCy0LDQu9C40LTQsNGC0L7RgNCwXHJcbiAgICAgKi9cclxuICAgIHRvZ2dsZVZhbGlkYXRvclNlY3Rpb24oKTogdm9pZCB7XHJcbiAgICAgICAgY29uc3QgeyB2YWxpZGF0b3JTZWN0aW9uIH0gPSB0aGlzLmVsZW1lbnRzO1xyXG4gICAgICAgIGlmICghdmFsaWRhdG9yU2VjdGlvbikgcmV0dXJuO1xyXG5cclxuICAgICAgICBjb25zdCBpc09wZW4gPSB2YWxpZGF0b3JTZWN0aW9uLmNsYXNzTGlzdC5jb250YWlucygnc2hvdycpO1xyXG4gICAgICAgIGlmIChpc09wZW4pIHtcclxuICAgICAgICAgICAgdGhpcy5jbG9zZVZhbGlkYXRvclNlY3Rpb24oKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICB0aGlzLm9wZW5WYWxpZGF0b3JTZWN0aW9uKCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog0J7RgtC60YDRi9GC0Ywg0YHQtdC60YbQuNGOINCy0LDQu9C40LTQsNGC0L7RgNCwXHJcbiAgICAgKi9cclxuICAgIG9wZW5WYWxpZGF0b3JTZWN0aW9uKCk6IHZvaWQge1xyXG4gICAgICAgIGNvbnN0IHsgdmFsaWRhdG9yU2VjdGlvbiB9ID0gdGhpcy5lbGVtZW50cztcclxuICAgICAgICBpZiAoIXZhbGlkYXRvclNlY3Rpb24pIHJldHVybjtcclxuXHJcbiAgICAgICAgLy8g0JHQu9C+0LrQuNGA0YPQtdC8INGB0LrRgNC+0LvQuyBib2R5XHJcbiAgICAgICAgZG9jdW1lbnQuYm9keS5jbGFzc0xpc3QuYWRkKCdtb2RhbC1vcGVuJyk7XHJcblxyXG4gICAgICAgIHZhbGlkYXRvclNlY3Rpb24uc3R5bGUuZGlzcGxheSA9ICdmbGV4JztcclxuICAgICAgICAvLyDQndC10LHQvtC70YzRiNCw0Y8g0LfQsNC00LXRgNC20LrQsCDQtNC70Y8g0L/Qu9Cw0LLQvdC+0Lkg0LDQvdC40LzQsNGG0LjQuFxyXG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgICAgICAgICB2YWxpZGF0b3JTZWN0aW9uLmNsYXNzTGlzdC5hZGQoJ3Nob3cnKTtcclxuICAgICAgICAgICAgLy8g0JLRi9C30YvQstCw0LXQvCBjYWxsYmFjayDQtNC70Y8g0LfQsNC/0YPRgdC60LAg0LLQsNC70LjQtNCw0YbQuNC4XHJcbiAgICAgICAgICAgIGlmICh0aGlzLmNhbGxiYWNrcy5vblZhbGlkYXRvck9wZW4pIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuY2FsbGJhY2tzLm9uVmFsaWRhdG9yT3BlbigpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSwgMTApO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog0JfQsNC60YDRi9GC0Ywg0YHQtdC60YbQuNGOINCy0LDQu9C40LTQsNGC0L7RgNCwXHJcbiAgICAgKi9cclxuICAgIGNsb3NlVmFsaWRhdG9yU2VjdGlvbigpOiB2b2lkIHtcclxuICAgICAgICBjb25zdCB7IHZhbGlkYXRvclNlY3Rpb24gfSA9IHRoaXMuZWxlbWVudHM7XHJcbiAgICAgICAgaWYgKCF2YWxpZGF0b3JTZWN0aW9uKSByZXR1cm47XHJcblxyXG4gICAgICAgIHZhbGlkYXRvclNlY3Rpb24uY2xhc3NMaXN0LnJlbW92ZSgnc2hvdycpO1xyXG4gICAgICAgIC8vINCW0LTQtdC8INC30LDQstC10YDRiNC10L3QuNGPINCw0L3QuNC80LDRhtC40Lgg0L/QtdGA0LXQtCDRgdC60YDRi9GC0LjQtdC8XHJcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgICAgICAgIHZhbGlkYXRvclNlY3Rpb24uc3R5bGUuZGlzcGxheSA9ICdub25lJztcclxuICAgICAgICAgICAgLy8g0KDQsNC30LHQu9C+0LrQuNGA0YPQtdC8INGB0LrRgNC+0LvQuyBib2R5XHJcbiAgICAgICAgICAgIGRvY3VtZW50LmJvZHkuY2xhc3NMaXN0LnJlbW92ZSgnbW9kYWwtb3BlbicpO1xyXG4gICAgICAgIH0sIDMwMCk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDQn9C+0LrQsNC30LDRgtGMINC/0YDQtdC00YPQv9GA0LXQttC00LXQvdC40LUgU0ZUUCDRgSDQuNC90YTQvtGA0LzQsNGG0LjQtdC5INC+IGNsZWFuLWluZm9cclxuICAgICAqL1xyXG4gICAgc2hvd1NmdHBXYXJuaW5nV2l0aEluZm8oKTogdm9pZCB7XHJcbiAgICAgICAgY29uc3QgeyBzZnRwQ2xlYW5JbmZvIH0gPSB0aGlzLmVsZW1lbnRzO1xyXG4gICAgICAgIGlmICghc2Z0cENsZWFuSW5mbykgcmV0dXJuO1xyXG5cclxuICAgICAgICBzZnRwQ2xlYW5JbmZvLmlubmVySFRNTCA9ICc8cD5Db2xsZWN0aW5nIGZvbGRlciBpbmZvcm1hdGlvbi4uLjwvcD4nO1xyXG4gICAgICAgIHRoaXMuc2hvd1NmdHBXYXJuaW5nTW9kYWwoKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqINCe0LHQvdC+0LLQuNGC0Ywg0LjQvdGE0L7RgNC80LDRhtC40Y4g0LIg0LzQvtC00LDQu9GM0L3QvtC8INC+0LrQvdC1IFNGVFBcclxuICAgICAqL1xyXG4gICAgdXBkYXRlU2Z0cENsZWFuSW5mbyhodG1sQ29udGVudDogc3RyaW5nKTogdm9pZCB7XHJcbiAgICAgICAgY29uc3QgeyBzZnRwQ2xlYW5JbmZvIH0gPSB0aGlzLmVsZW1lbnRzO1xyXG4gICAgICAgIGlmIChzZnRwQ2xlYW5JbmZvKSB7XHJcbiAgICAgICAgICAgIHNmdHBDbGVhbkluZm8uaW5uZXJIVE1MID0gaHRtbENvbnRlbnQ7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog0J/QvtC60LDQt9Cw0YLRjCDQvNC+0LTQsNC70YzQvdC+0LUg0L7QutC90L4g0L/RgNC10LTRg9C/0YDQtdC20LTQtdC90LjRjyDQviDQvdC10YHQvtGF0YDQsNC90LXQvdC90YvRhSDQuNC30LzQtdC90LXQvdC40Y/RhVxyXG4gICAgICovXHJcbiAgICBzaG93VW5zYXZlZENoYW5nZXNNb2RhbCgpOiB2b2lkIHtcclxuICAgICAgICBjb25zdCB7IHVuc2F2ZWRDaGFuZ2VzTW9kYWwgfSA9IHRoaXMuZWxlbWVudHM7XHJcbiAgICAgICAgaWYgKCF1bnNhdmVkQ2hhbmdlc01vZGFsKSByZXR1cm47XHJcblxyXG4gICAgICAgIHVuc2F2ZWRDaGFuZ2VzTW9kYWwuc3R5bGUuZGlzcGxheSA9ICdmbGV4JztcclxuICAgICAgICAvLyDQndC10LHQvtC70YzRiNCw0Y8g0LfQsNC00LXRgNC20LrQsCDQtNC70Y8g0L/Qu9Cw0LLQvdC+0Lkg0LDQvdC40LzQsNGG0LjQuFxyXG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgICAgICAgICB1bnNhdmVkQ2hhbmdlc01vZGFsLmNsYXNzTGlzdC5yZW1vdmUoJ2hpZGRlbicpO1xyXG4gICAgICAgIH0sIDEwKTtcclxuICAgICAgICAvLyDQkdC70L7QutC40YDRg9C10Lwg0YHQutGA0L7Qu9C7IGJvZHlcclxuICAgICAgICBkb2N1bWVudC5ib2R5LmNsYXNzTGlzdC5hZGQoJ21vZGFsLW9wZW4nKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqINCh0LrRgNGL0YLRjCDQvNC+0LTQsNC70YzQvdC+0LUg0L7QutC90L4g0L/RgNC10LTRg9C/0YDQtdC20LTQtdC90LjRjyDQviDQvdC10YHQvtGF0YDQsNC90LXQvdC90YvRhSDQuNC30LzQtdC90LXQvdC40Y/RhVxyXG4gICAgICovXHJcbiAgICBoaWRlVW5zYXZlZENoYW5nZXNNb2RhbCgpOiB2b2lkIHtcclxuICAgICAgICBjb25zdCB7IHVuc2F2ZWRDaGFuZ2VzTW9kYWwgfSA9IHRoaXMuZWxlbWVudHM7XHJcbiAgICAgICAgaWYgKCF1bnNhdmVkQ2hhbmdlc01vZGFsKSByZXR1cm47XHJcblxyXG4gICAgICAgIHVuc2F2ZWRDaGFuZ2VzTW9kYWwuY2xhc3NMaXN0LmFkZCgnaGlkZGVuJyk7XHJcbiAgICAgICAgLy8g0JbQtNC10Lwg0LfQsNCy0LXRgNGI0LXQvdC40Y8g0LDQvdC40LzQsNGG0LjQuCDQv9C10YDQtdC0INGB0LrRgNGL0YLQuNC10LxcclxuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcclxuICAgICAgICAgICAgdW5zYXZlZENoYW5nZXNNb2RhbC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xyXG4gICAgICAgICAgICAvLyDQoNCw0LfQsdC70L7QutC40YDRg9C10Lwg0YHQutGA0L7Qu9C7IGJvZHlcclxuICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5jbGFzc0xpc3QucmVtb3ZlKCdtb2RhbC1vcGVuJyk7XHJcbiAgICAgICAgfSwgMzAwKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqINCf0L7QutCw0LfQsNGC0Ywg0LzQvtC00LDQu9GM0L3QvtC1INC+0LrQvdC+INC+0LEg0L7QsdC90L7QstC70LXQvdC40LhcclxuICAgICAqL1xyXG4gICAgc2hvd1VwZGF0ZUNvbXBsZXRlZE1vZGFsKCk6IHZvaWQge1xyXG4gICAgICAgIGNvbnN0IHsgdXBkYXRlQ29tcGxldGVkTW9kYWwgfSA9IHRoaXMuZWxlbWVudHM7XHJcbiAgICAgICAgaWYgKCF1cGRhdGVDb21wbGV0ZWRNb2RhbCkgcmV0dXJuO1xyXG5cclxuICAgICAgICB1cGRhdGVDb21wbGV0ZWRNb2RhbC5zdHlsZS5kaXNwbGF5ID0gJ2ZsZXgnO1xyXG4gICAgICAgIC8vINCd0LXQsdC+0LvRjNGI0LDRjyDQt9Cw0LTQtdGA0LbQutCwINC00LvRjyDQv9C70LDQstC90L7QuSDQsNC90LjQvNCw0YbQuNC4XHJcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgICAgICAgIHVwZGF0ZUNvbXBsZXRlZE1vZGFsLmNsYXNzTGlzdC5yZW1vdmUoJ2hpZGRlbicpO1xyXG4gICAgICAgIH0sIDEwKTtcclxuICAgICAgICAvLyDQkdC70L7QutC40YDRg9C10Lwg0YHQutGA0L7Qu9C7IGJvZHlcclxuICAgICAgICBkb2N1bWVudC5ib2R5LmNsYXNzTGlzdC5hZGQoJ21vZGFsLW9wZW4nKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqINCf0L7QutCw0LfQsNGC0Ywg0LzQvtC00LDQu9GM0L3QvtC1INC+0LrQvdC+INC/0YDQtdC00YPQv9GA0LXQttC00LXQvdC40Y8g0L4g0L3QtdGB0L7RhdGA0LDQvdC10L3QvdGL0YUg0LjQt9C80LXQvdC10L3QuNGP0YUg0LIg0YHRhtC10L3QtVxyXG4gICAgICovXHJcbiAgICBzaG93VW5zYXZlZFNjZW5lQ2hhbmdlc01vZGFsKCk6IHZvaWQge1xyXG4gICAgICAgIGNvbnN0IHsgdW5zYXZlZFNjZW5lQ2hhbmdlc01vZGFsIH0gPSB0aGlzLmVsZW1lbnRzO1xyXG4gICAgICAgIGlmICghdW5zYXZlZFNjZW5lQ2hhbmdlc01vZGFsKSByZXR1cm47XHJcblxyXG4gICAgICAgIHVuc2F2ZWRTY2VuZUNoYW5nZXNNb2RhbC5zdHlsZS5kaXNwbGF5ID0gJ2ZsZXgnO1xyXG4gICAgICAgIC8vINCd0LXQsdC+0LvRjNGI0LDRjyDQt9Cw0LTQtdGA0LbQutCwINC00LvRjyDQv9C70LDQstC90L7QuSDQsNC90LjQvNCw0YbQuNC4XHJcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgICAgICAgIHVuc2F2ZWRTY2VuZUNoYW5nZXNNb2RhbC5jbGFzc0xpc3QucmVtb3ZlKCdoaWRkZW4nKTtcclxuICAgICAgICB9LCAxMCk7XHJcbiAgICAgICAgLy8g0JHQu9C+0LrQuNGA0YPQtdC8INGB0LrRgNC+0LvQuyBib2R5XHJcbiAgICAgICAgZG9jdW1lbnQuYm9keS5jbGFzc0xpc3QuYWRkKCdtb2RhbC1vcGVuJyk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDQodC60YDRi9GC0Ywg0LzQvtC00LDQu9GM0L3QvtC1INC+0LrQvdC+INC/0YDQtdC00YPQv9GA0LXQttC00LXQvdC40Y8g0L4g0L3QtdGB0L7RhdGA0LDQvdC10L3QvdGL0YUg0LjQt9C80LXQvdC10L3QuNGP0YUg0LIg0YHRhtC10L3QtVxyXG4gICAgICovXHJcbiAgICBoaWRlVW5zYXZlZFNjZW5lQ2hhbmdlc01vZGFsKCk6IHZvaWQge1xyXG4gICAgICAgIGNvbnN0IHsgdW5zYXZlZFNjZW5lQ2hhbmdlc01vZGFsIH0gPSB0aGlzLmVsZW1lbnRzO1xyXG4gICAgICAgIGlmICghdW5zYXZlZFNjZW5lQ2hhbmdlc01vZGFsKSByZXR1cm47XHJcblxyXG4gICAgICAgIGlmICh0aGlzLmNhbGxiYWNrcy5vblVuc2F2ZWRTY2VuZUNhbmNlbCkge1xyXG4gICAgICAgICAgICB0aGlzLmNhbGxiYWNrcy5vblVuc2F2ZWRTY2VuZUNhbmNlbCgpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdW5zYXZlZFNjZW5lQ2hhbmdlc01vZGFsLmNsYXNzTGlzdC5hZGQoJ2hpZGRlbicpO1xyXG4gICAgICAgIC8vINCW0LTQtdC8INC30LDQstC10YDRiNC10L3QuNGPINCw0L3QuNC80LDRhtC40Lgg0L/QtdGA0LXQtCDRgdC60YDRi9GC0LjQtdC8XHJcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgICAgICAgIHVuc2F2ZWRTY2VuZUNoYW5nZXNNb2RhbC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xyXG4gICAgICAgICAgICAvLyDQoNCw0LfQsdC70L7QutC40YDRg9C10Lwg0YHQutGA0L7Qu9C7IGJvZHlcclxuICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5jbGFzc0xpc3QucmVtb3ZlKCdtb2RhbC1vcGVuJyk7XHJcbiAgICAgICAgfSwgMzAwKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqINCh0LrRgNGL0YLRjCDQvNC+0LTQsNC70YzQvdC+0LUg0L7QutC90L4g0L7QsSDQvtCx0L3QvtCy0LvQtdC90LjQuFxyXG4gICAgICovXHJcbiAgICBoaWRlVXBkYXRlQ29tcGxldGVkTW9kYWwoKTogdm9pZCB7XHJcbiAgICAgICAgY29uc3QgeyB1cGRhdGVDb21wbGV0ZWRNb2RhbCB9ID0gdGhpcy5lbGVtZW50cztcclxuICAgICAgICBpZiAoIXVwZGF0ZUNvbXBsZXRlZE1vZGFsKSByZXR1cm47XHJcblxyXG4gICAgICAgIHVwZGF0ZUNvbXBsZXRlZE1vZGFsLmNsYXNzTGlzdC5hZGQoJ2hpZGRlbicpO1xyXG4gICAgICAgIC8vINCW0LTQtdC8INC30LDQstC10YDRiNC10L3QuNGPINCw0L3QuNC80LDRhtC40Lgg0L/QtdGA0LXQtCDRgdC60YDRi9GC0LjQtdC8XHJcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgICAgICAgIHVwZGF0ZUNvbXBsZXRlZE1vZGFsLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XHJcbiAgICAgICAgICAgIC8vINCg0LDQt9Cx0LvQvtC60LjRgNGD0LXQvCDRgdC60YDQvtC70LsgYm9keVxyXG4gICAgICAgICAgICBkb2N1bWVudC5ib2R5LmNsYXNzTGlzdC5yZW1vdmUoJ21vZGFsLW9wZW4nKTtcclxuICAgICAgICB9LCAzMDApO1xyXG4gICAgfVxyXG59Il19