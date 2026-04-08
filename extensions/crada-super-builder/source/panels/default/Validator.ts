/**
 * Validator class for finding parameters in TypeScript files
 * Scans the assets folder and looks for playableCore.getParam("param") calls
 */

import * as fs from 'fs';
import * as path from 'path';

export interface ParameterCall {
    parameter: string;
    lineNumber: number;
    context: string;
    filePath: string;
}

export interface ValidationResult {
    filePath: string;
    parameters: string[];
    parameterCalls: ParameterCall[];
    errors: string[];
    audioCalls: AudioCall[];
    superHtmlCalls: SuperHtmlCall[];
}

export interface AudioCall {
    type: 'playMusic' | 'smoothStopMusic';
    lineNumber: number;
    context: string;
    filePath: string;
}

export interface SuperHtmlCall {
    type: 'download' | 'game_end';
    lineNumber: number;
    context: string;
    filePath: string;
}

export interface ParameterStatus {
    parameter: string;
    found: boolean;
    versions: string[];
}

export interface AudioValidationSummary {
    hasPlayMusic: boolean;
    hasSmoothStopMusic: boolean;
    playMusicFiles: string[];
    smoothStopMusicFiles: string[];
    totalAudioCalls: number;
}

export interface SuperHtmlValidationSummary {
    hasDownload: boolean;
    hasGameEnd: boolean;
    downloadFiles: string[];
    gameEndFiles: string[];
    totalSuperHtmlCalls: number;
}

export interface ValidationSummary {
    totalFiles: number;
    filesWithParams: number;
    totalParameters: number;
    uniqueParameters: string[];
    results: ValidationResult[];
    parameterStatuses: ParameterStatus[];
    missingParameters: string[];
    validParameters: string[];
    audioValidation: AudioValidationSummary;
    superHtmlValidation: SuperHtmlValidationSummary;
    isValidationSuccessful: boolean;
    validationErrors: string[];
}

export class Validator {
    private projectRoot: string;
    private assetsPath: string;
    private versionsPath: string;

    constructor(projectRoot: string) {
        this.projectRoot = projectRoot;
        this.assetsPath = path.join(projectRoot, 'assets');
        this.versionsPath = path.join(projectRoot, 'versions.cjs');
    }

    /**
     * Loads version variables from versions.cjs file
     */
    private loadVersionParameters(): string[] {
        try {

            if (!fs.existsSync(this.versionsPath)) {
                // Try to find the file in other possible locations
                const alternativePaths = [
                    path.join(this.projectRoot, '..', 'versions.cjs'),
                    path.join(this.projectRoot, '..', '..', 'versions.cjs'),
                    path.join(this.projectRoot, '..', '..', '..', 'versions.cjs')
                ];

                for (const altPath of alternativePaths) {
                    if (fs.existsSync(altPath)) {
                        this.versionsPath = altPath;
                        break;
                    }
                }

                if (!fs.existsSync(this.versionsPath)) {
                    return [];
                }
            }

            // Clear require cache
            delete require.cache[require.resolve(this.versionsPath)];

            // Load versions.cjs file
            const versionsData = require(this.versionsPath);

            if (!Array.isArray(versionsData)) {
                return [];
            }

            // Extract all parameters from all versions
            const allParameters = new Set<string>();

            versionsData.forEach((version: any) => {
                if (typeof version === 'object' && version !== null) {
                    Object.keys(version).forEach(key => {
                        // Exclude only service fields
                        if (key !== 'name' && key !== 'language') {
                            allParameters.add(key);
                        }
                    });
                }
            });

            const parameters = Array.from(allParameters);
            return parameters;

        } catch (error) {
            return [];
        }
    }

    /**
     * Main method for running validation
     */
    async validate(): Promise<ValidationSummary> {
        const results: ValidationResult[] = [];
        const uniqueParameters = new Set<string>();
        let totalFiles = 0;
        let filesWithParams = 0;

        try {
            // Load version variables
            const versionParameters = this.loadVersionParameters();

            // Check if assets folder exists
            if (!fs.existsSync(this.assetsPath)) {
                throw new Error(`Assets folder not found: ${this.assetsPath}`);
            }

            // Scan all TypeScript files
            const tsFiles = this.findTypeScriptFiles(this.assetsPath);
            totalFiles = tsFiles.length;

            // Process each file
            for (const filePath of tsFiles) {
                try {
                    const result = await this.validateFile(filePath);
                    results.push(result);

                    if (result.parameters.length > 0) {
                        filesWithParams++;
                        result.parameters.forEach(param => uniqueParameters.add(param));
                    }
                } catch (error) {
                    results.push({
                        filePath,
                        parameters: [],
                        parameterCalls: [],
                        errors: [`File reading error: ${error}`],
                        audioCalls: [],
                        superHtmlCalls: []
                    });
                }
            }

            // Compare found parameters with version variables
            const foundParameters = Array.from(uniqueParameters);
            const parameterStatuses: ParameterStatus[] = [];
            const missingParameters: string[] = [];
            const validParameters: string[] = [];

            foundParameters.forEach(param => {
                const found = versionParameters.includes(param);
                const versions = versionParameters.filter(vp => vp === param);

                parameterStatuses.push({
                    parameter: param,
                    found,
                    versions
                });

                if (found) {
                    validParameters.push(param);
                } else {
                    missingParameters.push(param);
                }
            });

            // Analyze audio calls
            const audioValidation = this.analyzeAudioCalls(results);

            // Analyze super_html_playable calls
            const superHtmlValidation = this.analyzeSuperHtmlCalls(results);

            // Check required super_html_playable methods
            const validationErrors: string[] = [];
            let isValidationSuccessful = true;

            if (!superHtmlValidation.hasDownload) {
                validationErrors.push('Required method super_html_playable.download() not found');
                isValidationSuccessful = false;
            }

            if (!superHtmlValidation.hasGameEnd) {
                validationErrors.push('Required method super_html_playable.game_end() not found');
                isValidationSuccessful = false;
            }

            // Check required audio methods
            if (!audioValidation.hasPlayMusic) {
                validationErrors.push('Required method AudioManager.instance.playMusic() not found');
                isValidationSuccessful = false;
            }

            if (!audioValidation.hasSmoothStopMusic) {
                validationErrors.push('Required method AudioManager.instance.smoothStopMusic() not found');
                isValidationSuccessful = false;
            }

            // Check for parameters without versions
            if (missingParameters.length > 0) {
                validationErrors.push(`Found parameters without versions: ${missingParameters.join(', ')}`);
                isValidationSuccessful = false;
            }

            const summary: ValidationSummary = {
                totalFiles,
                filesWithParams,
                totalParameters: uniqueParameters.size,
                uniqueParameters: foundParameters.sort(),
                results,
                parameterStatuses,
                missingParameters,
                validParameters,
                audioValidation,
                superHtmlValidation,
                isValidationSuccessful,
                validationErrors
            };

            return summary;

        } catch (error) {
            throw error;
        }
    }

    /**
     * Recursively finds all TypeScript files in the folder
     */
    private findTypeScriptFiles(dir: string): string[] {
        const files: string[] = [];

        try {
            const items = fs.readdirSync(dir);

            for (const item of items) {
                const fullPath = path.join(dir, item);
                const stat = fs.statSync(fullPath);

                if (stat.isDirectory()) {
                    // Recursively scan subfolders
                    files.push(...this.findTypeScriptFiles(fullPath));
                } else if (item.endsWith('.ts') && !item.endsWith('.d.ts')) {
                    // Add only .ts files, excluding .d.ts
                    files.push(fullPath);
                }
            }
        } catch (error) {
            // Could not read folder
        }

        return files;
    }

    /**
     * Validates a single file for getParam calls and audio calls
     */
    private async validateFile(filePath: string): Promise<ValidationResult> {
        const result: ValidationResult = {
            filePath: path.relative(this.projectRoot, filePath),
            parameters: [],
            parameterCalls: [],
            errors: [],
            audioCalls: [],
            superHtmlCalls: []
        };

        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const parameterCalls = this.extractGetParamCalls(content, filePath);
            const audioCalls = this.extractAudioManagerCalls(content, filePath);
            const superHtmlCalls = this.extractSuperHtmlCalls(content, filePath);
            result.parameterCalls = parameterCalls;
            result.parameters = parameterCalls.map(call => call.parameter);
            result.audioCalls = audioCalls;
            result.superHtmlCalls = superHtmlCalls;
        } catch (error) {
            result.errors.push(`File reading error: ${error}`);
        }

        return result;
    }

    /**
     * Extracts all playableCore.getParam("param") calls from file content
     */
    private extractGetParamCalls(content: string, filePath: string): ParameterCall[] {
        const parameterCalls: ParameterCall[] = [];
        const lines = content.split('\n');

        // Regular expression for finding getParam calls
        // Look for various variants:
        // - playableCore.getParam("param")
        // - playableCore.getParam('param')
        // - this.playableCore.getParam("param")
        // - playableCore?.getParam("param")
        const getParamRegex = /(?:playableCore|this\.playableCore)(?:\?\.)?\.getParam\s*\(\s*["']([^"']+)["']\s*\)/g;

        lines.forEach((line, index) => {
            const lineNumber = index + 1;
            const trimmedLine = line.trim();

            // Skip commented lines
            if (trimmedLine.startsWith('//') || trimmedLine.startsWith('/*') || trimmedLine.startsWith('*')) {
                return;
            }

            let match;

            // Reset regex index for each line
            getParamRegex.lastIndex = 0;

            while ((match = getParamRegex.exec(line)) !== null) {
                const param = match[1].trim();
                if (param) {
                    parameterCalls.push({
                        parameter: param,
                        lineNumber,
                        context: line.trim(),
                        filePath: path.relative(this.projectRoot, filePath)
                    });
                }
            }
        });

        return parameterCalls;
    }

    /**
     * Extracts all AudioManager calls from file content
     */
    private extractAudioManagerCalls(content: string, filePath: string): AudioCall[] {
        const audioCalls: AudioCall[] = [];
        const lines = content.split('\n');

        // Regular expressions for finding audio calls
        const playMusicRegex = /AudioManager\.instance\.playMusic\s*\(/g;
        const smoothStopMusicRegex = /AudioManager\.instance\.smoothStopMusic\s*\(/g;

        lines.forEach((line, index) => {
            const lineNumber = index + 1;
            const trimmedLine = line.trim();

            // Skip commented lines
            if (trimmedLine.startsWith('//') || trimmedLine.startsWith('/*') || trimmedLine.startsWith('*')) {
                return;
            }

            // Search for playMusic
            if (playMusicRegex.test(line)) {
                audioCalls.push({
                    type: 'playMusic',
                    lineNumber,
                    context: line.trim(),
                    filePath: path.relative(this.projectRoot, filePath)
                });
            }

            // Reset regex index
            playMusicRegex.lastIndex = 0;

            // Search for smoothStopMusic
            if (smoothStopMusicRegex.test(line)) {
                audioCalls.push({
                    type: 'smoothStopMusic',
                    lineNumber,
                    context: line.trim(),
                    filePath: path.relative(this.projectRoot, filePath)
                });
            }

            // Reset regex index
            smoothStopMusicRegex.lastIndex = 0;
        });

        return audioCalls;
    }

    /**
     * Extracts all super_html_playable calls from file content
     */
    private extractSuperHtmlCalls(content: string, filePath: string): SuperHtmlCall[] {
        const superHtmlCalls: SuperHtmlCall[] = [];
        const lines = content.split('\n');

        // Regular expressions for finding super_html_playable calls
        const downloadRegex = /super_html_playable\.download\s*\(\s*\)/g;
        const gameEndRegex = /super_html_playable\.game_end\s*\(\s*\)/g;

        lines.forEach((line, index) => {
            const lineNumber = index + 1;
            const trimmedLine = line.trim();

            // Skip commented lines
            if (trimmedLine.startsWith('//') || trimmedLine.startsWith('/*') || trimmedLine.startsWith('*')) {
                return;
            }

            // Search for download
            if (downloadRegex.test(line)) {
                superHtmlCalls.push({
                    type: 'download',
                    lineNumber,
                    context: line.trim(),
                    filePath: path.relative(this.projectRoot, filePath)
                });
            }

            // Reset regex index
            downloadRegex.lastIndex = 0;

            // Search for game_end
            if (gameEndRegex.test(line)) {
                superHtmlCalls.push({
                    type: 'game_end',
                    lineNumber,
                    context: line.trim(),
                    filePath: path.relative(this.projectRoot, filePath)
                });
            }

            // Reset regex index
            gameEndRegex.lastIndex = 0;
        });

        return superHtmlCalls;
    }

    /**
     * Analyzes audio calls in all files
     */
    private analyzeAudioCalls(results: ValidationResult[]): AudioValidationSummary {
        const playMusicFiles: string[] = [];
        const smoothStopMusicFiles: string[] = [];
        let totalAudioCalls = 0;

        results.forEach(result => {
            result.audioCalls.forEach(audioCall => {
                totalAudioCalls++;

                if (audioCall.type === 'playMusic' && !playMusicFiles.includes(result.filePath)) {
                    playMusicFiles.push(result.filePath);
                }

                if (audioCall.type === 'smoothStopMusic' && !smoothStopMusicFiles.includes(result.filePath)) {
                    smoothStopMusicFiles.push(result.filePath);
                }
            });
        });

        return {
            hasPlayMusic: playMusicFiles.length > 0,
            hasSmoothStopMusic: smoothStopMusicFiles.length > 0,
            playMusicFiles,
            smoothStopMusicFiles,
            totalAudioCalls
        };
    }

    /**
     * Analyzes super_html_playable calls in all files
     */
    private analyzeSuperHtmlCalls(results: ValidationResult[]): SuperHtmlValidationSummary {
        const downloadFiles: string[] = [];
        const gameEndFiles: string[] = [];
        let totalSuperHtmlCalls = 0;

        results.forEach(result => {
            result.superHtmlCalls.forEach(superHtmlCall => {
                totalSuperHtmlCalls++;

                if (superHtmlCall.type === 'download' && !downloadFiles.includes(result.filePath)) {
                    downloadFiles.push(result.filePath);
                }

                if (superHtmlCall.type === 'game_end' && !gameEndFiles.includes(result.filePath)) {
                    gameEndFiles.push(result.filePath);
                }
            });
        });

        return {
            hasDownload: downloadFiles.length > 0,
            hasGameEnd: gameEndFiles.length > 0,
            downloadFiles,
            gameEndFiles,
            totalSuperHtmlCalls
        };
    }

    /**
     * Generates HTML validation report
     */
    generateHtmlReport(summary: ValidationSummary): string {
        const { totalFiles, filesWithParams, totalParameters, uniqueParameters, results, parameterStatuses, missingParameters, validParameters, audioValidation, superHtmlValidation, isValidationSuccessful, validationErrors } = summary;

        let html = `
            <div class="validator-report">
                <!-- Validation status -->
                <div class="validator-status ${isValidationSuccessful ? 'success' : 'failed'}">
                    <span class="status-icon">${isValidationSuccessful ? '✅' : '❌'}</span>
                    <span class="status-text">Validation ${isValidationSuccessful ? 'SUCCESSFUL' : 'FAILED'}</span>
                </div>
                
                ${validationErrors.length > 0 ? `
                    <div class="validation-errors">
                        <h3>❌ Validation errors:</h3>
                        <ul>
                            ${validationErrors.map(error => `<li>${error}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}

                <!-- Compact statistics -->
                <div class="validator-stats">
                    <div class="stat-badge ${validParameters.length > 0 ? 'valid' : ''}">
                        <span class="stat-icon">✅</span>
                        <span class="stat-text">${validParameters.length} valid</span>
                    </div>
                    <div class="stat-badge ${missingParameters.length > 0 ? 'missing' : ''}">
                        <span class="stat-icon">❌</span>
                        <span class="stat-text">${missingParameters.length} not found</span>
                    </div>
                    <div class="stat-badge ${audioValidation.totalAudioCalls > 0 ? 'audio' : ''}">
                        <span class="stat-icon">🎵</span>
                        <span class="stat-text">${audioValidation.totalAudioCalls} audio</span>
                    </div>
                    <div class="stat-badge ${superHtmlValidation.totalSuperHtmlCalls > 0 ? 'superhtml' : ''}">
                        <span class="stat-icon">📱</span>
                        <span class="stat-text">${superHtmlValidation.totalSuperHtmlCalls} super_html</span>
                    </div>
                </div>

                <div class="validator-audio">
                    <h3>🎵 Audio validation</h3>
                    <div class="audio-warnings">
                        ${!audioValidation.hasPlayMusic ? '<div class="audio-warning missing">⚠️ No AudioManager.instance.playMusic() calls found</div>' : ''}
                        ${!audioValidation.hasSmoothStopMusic ? '<div class="audio-warning missing">⚠️ No AudioManager.instance.smoothStopMusic() calls found</div>' : ''}
                        ${audioValidation.hasPlayMusic && audioValidation.hasSmoothStopMusic ? '<div class="audio-warning success">✅ All necessary audio calls found</div>' : ''}
                    </div>
                    
                    ${audioValidation.playMusicFiles.length > 0 ? `
                        <details class="audio-details">
                            <summary>📁 Files with playMusic (${audioValidation.playMusicFiles.length})</summary>
                            <div class="audio-files-list">
                                ${this.generateAudioFilesList(results, 'playMusic')}
                            </div>
                        </details>
                    ` : ''}
                    
                    ${audioValidation.smoothStopMusicFiles.length > 0 ? `
                        <details class="audio-details">
                            <summary>📁 Files with smoothStopMusic (${audioValidation.smoothStopMusicFiles.length})</summary>
                            <div class="audio-files-list">
                                ${this.generateAudioFilesList(results, 'smoothStopMusic')}
                            </div>
                        </details>
                    ` : ''}
                </div>

                <div class="validator-superhtml">
                    <h3>📱 Super HTML Playable validation</h3>
                    <div class="superhtml-warnings">
                        ${!superHtmlValidation.hasDownload ? '<div class="superhtml-warning missing">⚠️ No super_html_playable.download() calls found</div>' : ''}
                        ${!superHtmlValidation.hasGameEnd ? '<div class="superhtml-warning missing">⚠️ No super_html_playable.game_end() calls found</div>' : ''}
                        ${superHtmlValidation.hasDownload && superHtmlValidation.hasGameEnd ? '<div class="superhtml-warning success">✅ All necessary super_html_playable calls found</div>' : ''}
                    </div>
                    
                    ${superHtmlValidation.downloadFiles.length > 0 ? `
                        <details class="superhtml-details">
                            <summary>📁 Files with download() (${superHtmlValidation.downloadFiles.length})</summary>
                            <div class="superhtml-files-list">
                                ${this.generateSuperHtmlFilesList(results, 'download')}
                            </div>
                        </details>
                    ` : ''}
                    
                    ${superHtmlValidation.gameEndFiles.length > 0 ? `
                        <details class="superhtml-details">
                            <summary>📁 Files with game_end() (${superHtmlValidation.gameEndFiles.length})</summary>
                            <div class="superhtml-files-list">
                                ${this.generateSuperHtmlFilesList(results, 'game_end')}
                            </div>
                        </details>
                    ` : ''}
                </div>

                <div class="validator-parameters">
                    <h3>🔍 Parameters validation</h3>
                    <div class="parameters-warnings">
                        ${validParameters.length > 0 ? '<div class="parameters-warning success">✅ Valid parameters found</div>' : ''}
                        ${missingParameters.length > 0 ? '<div class="parameters-warning missing">⚠️ Parameters not from versions found</div>' : ''}
                        ${uniqueParameters.length === 0 ? '<div class="parameters-warning missing">⚠️ No parameters found</div>' : ''}
                    </div>
                    
                    ${validParameters.length > 0 ? `
                        <details class="parameters-details">
                            <summary>📁 Valid parameters (${validParameters.length})</summary>
                            <div class="parameters-files-list">
                                ${this.generateParametersFilesList(results, validParameters, 'valid')}
                            </div>
                        </details>
                    ` : ''}
                    
                    ${missingParameters.length > 0 ? `
                        <details class="parameters-details">
                            <summary>📁 Parameters not from versions (${missingParameters.length})</summary>
                            <div class="parameters-files-list">
                                ${this.generateParametersFilesList(results, missingParameters, 'missing')}
                            </div>
                        </details>
                    ` : ''}
                </div>

            </div>
        `;

        // Add JavaScript for handling link clicks
        html += `
            <script>
                document.addEventListener('DOMContentLoaded', function() {
                    // Click handler for clickable links
                    document.addEventListener('click', function(event) {
                        if (event.target.classList.contains('clickable-line')) {
                            const filePath = event.target.getAttribute('data-file');
                            const lineNumber = parseInt(event.target.getAttribute('data-line'));
                            
                            if (filePath && lineNumber) {
                                // Send message to main process to open file
                                if (typeof Editor !== 'undefined' && Editor.Message) {
                                    Editor.Message.send('crada-super-builder', 'open-file', {
                                        filePath: filePath,
                                        lineNumber: lineNumber
                                    });
                                } else {
                                    // Fallback for debugging
                                }
                            }
                        }
                    });
                });
            </script>
        `;

        return html;
    }

    /**
     * Generates list of audio files with hyperlinks
     */
    private generateAudioFilesList(results: ValidationResult[], audioType: 'playMusic' | 'smoothStopMusic'): string {
        const audioCalls = results
            .flatMap(result => result.audioCalls)
            .filter(call => call.type === audioType);

        return audioCalls.map(audioCall => {
            const fullPath = path.join(this.projectRoot, audioCall.filePath);
            const audioIcon = audioCall.type === 'playMusic' ? '🎵' : '⏹️';

            return `<div class="audio-file-item">
                    <span class="audio-icon">${audioIcon}</span>
                    <span class="audio-file-name clickable-line" data-file="${fullPath}" data-line="${audioCall.lineNumber}">${audioCall.filePath}:${audioCall.lineNumber}</span>
                    <span class="audio-context">${audioCall.context}</span>
                </div>`;
        }).join('');
    }

    /**
     * Generates list of super_html_playable files with hyperlinks
     */
    private generateSuperHtmlFilesList(results: ValidationResult[], superHtmlType: 'download' | 'game_end'): string {
        const superHtmlCalls = results
            .flatMap(result => result.superHtmlCalls)
            .filter(call => call.type === superHtmlType);

        return superHtmlCalls.map(superHtmlCall => {
            const fullPath = path.join(this.projectRoot, superHtmlCall.filePath);
            const superHtmlIcon = superHtmlCall.type === 'download' ? '📥' : '🏁';

            return `<div class="superhtml-file-item">
                    <span class="superhtml-icon">${superHtmlIcon}</span>
                    <span class="superhtml-file-name clickable-line" data-file="${fullPath}" data-line="${superHtmlCall.lineNumber}">${superHtmlCall.filePath}:${superHtmlCall.lineNumber}</span>
                    <span class="superhtml-context">${superHtmlCall.context}</span>
                </div>`;
        }).join('');
    }

    /**
     * Generates list of files with parameters with hyperlinks
     */
    private generateParametersFilesList(results: ValidationResult[], parameters: string[], type: 'valid' | 'missing'): string {
        const parameterCalls = results
            .flatMap(result => result.parameterCalls)
            .filter(call => parameters.includes(call.parameter));

        return parameterCalls.map(paramCall => {
            const fullPath = path.join(this.projectRoot, paramCall.filePath);
            const paramIcon = type === 'valid' ? '✅' : '❌';
            const statusClass = type === 'valid' ? 'valid' : 'missing';

            return `<div class="parameter-file-item ${statusClass}">
                    <span class="parameter-icon">${paramIcon}</span>
                    <span class="parameter-name">"${paramCall.parameter}"</span>
                    <span class="parameter-file-name clickable-line" data-file="${fullPath}" data-line="${paramCall.lineNumber}">${paramCall.filePath}:${paramCall.lineNumber}</span>
                    <span class="parameter-context">${paramCall.context}</span>
                </div>`;
        }).join('');
    }

    /**
     * Finds all places where a parameter is used
     */
    private findParameterLocations(results: ValidationResult[], parameter: string): ParameterCall[] {
        const locations: ParameterCall[] = [];

        results.forEach(result => {
            result.parameterCalls.forEach(paramCall => {
                if (paramCall.parameter === parameter) {
                    locations.push(paramCall);
                }
            });
        });

        return locations;
    }
}
