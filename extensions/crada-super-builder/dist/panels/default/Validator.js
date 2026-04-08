"use strict";
/**
 * Validator class for finding parameters in TypeScript files
 * Scans the assets folder and looks for playableCore.getParam("param") calls
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Validator = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class Validator {
    constructor(projectRoot) {
        this.projectRoot = projectRoot;
        this.assetsPath = path.join(projectRoot, 'assets');
        this.versionsPath = path.join(projectRoot, 'versions.cjs');
    }
    /**
     * Loads version variables from versions.cjs file
     */
    loadVersionParameters() {
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
            const allParameters = new Set();
            versionsData.forEach((version) => {
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
        }
        catch (error) {
            return [];
        }
    }
    /**
     * Main method for running validation
     */
    async validate() {
        const results = [];
        const uniqueParameters = new Set();
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
                }
                catch (error) {
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
            const parameterStatuses = [];
            const missingParameters = [];
            const validParameters = [];
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
                }
                else {
                    missingParameters.push(param);
                }
            });
            // Analyze audio calls
            const audioValidation = this.analyzeAudioCalls(results);
            // Analyze super_html_playable calls
            const superHtmlValidation = this.analyzeSuperHtmlCalls(results);
            // Check required super_html_playable methods
            const validationErrors = [];
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
            const summary = {
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
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Recursively finds all TypeScript files in the folder
     */
    findTypeScriptFiles(dir) {
        const files = [];
        try {
            const items = fs.readdirSync(dir);
            for (const item of items) {
                const fullPath = path.join(dir, item);
                const stat = fs.statSync(fullPath);
                if (stat.isDirectory()) {
                    // Recursively scan subfolders
                    files.push(...this.findTypeScriptFiles(fullPath));
                }
                else if (item.endsWith('.ts') && !item.endsWith('.d.ts')) {
                    // Add only .ts files, excluding .d.ts
                    files.push(fullPath);
                }
            }
        }
        catch (error) {
            // Could not read folder
        }
        return files;
    }
    /**
     * Validates a single file for getParam calls and audio calls
     */
    async validateFile(filePath) {
        const result = {
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
        }
        catch (error) {
            result.errors.push(`File reading error: ${error}`);
        }
        return result;
    }
    /**
     * Extracts all playableCore.getParam("param") calls from file content
     */
    extractGetParamCalls(content, filePath) {
        const parameterCalls = [];
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
    extractAudioManagerCalls(content, filePath) {
        const audioCalls = [];
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
    extractSuperHtmlCalls(content, filePath) {
        const superHtmlCalls = [];
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
    analyzeAudioCalls(results) {
        const playMusicFiles = [];
        const smoothStopMusicFiles = [];
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
    analyzeSuperHtmlCalls(results) {
        const downloadFiles = [];
        const gameEndFiles = [];
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
    generateHtmlReport(summary) {
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
    generateAudioFilesList(results, audioType) {
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
    generateSuperHtmlFilesList(results, superHtmlType) {
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
    generateParametersFilesList(results, parameters, type) {
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
    findParameterLocations(results, parameter) {
        const locations = [];
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
exports.Validator = Validator;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVmFsaWRhdG9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc291cmNlL3BhbmVscy9kZWZhdWx0L1ZhbGlkYXRvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7OztHQUdHOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCx1Q0FBeUI7QUFDekIsMkNBQTZCO0FBcUU3QixNQUFhLFNBQVM7SUFLbEIsWUFBWSxXQUFtQjtRQUMzQixJQUFJLENBQUMsV0FBVyxHQUFHLFdBQVcsQ0FBQztRQUMvQixJQUFJLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBQ25ELElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsY0FBYyxDQUFDLENBQUM7SUFDL0QsQ0FBQztJQUVEOztPQUVHO0lBQ0sscUJBQXFCO1FBQ3pCLElBQUksQ0FBQztZQUVELElBQUksQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDO2dCQUNwQyxtREFBbUQ7Z0JBQ25ELE1BQU0sZ0JBQWdCLEdBQUc7b0JBQ3JCLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxJQUFJLEVBQUUsY0FBYyxDQUFDO29CQUNqRCxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxjQUFjLENBQUM7b0JBQ3ZELElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxjQUFjLENBQUM7aUJBQ2hFLENBQUM7Z0JBRUYsS0FBSyxNQUFNLE9BQU8sSUFBSSxnQkFBZ0IsRUFBRSxDQUFDO29CQUNyQyxJQUFJLEVBQUUsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLEVB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LENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxFQUFFO2dCQUN0QyxJQUFJLFNBQVMsQ0FBQyxTQUFTLEtBQUssU0FBUyxFQUFFLENBQUM7b0JBQ3BDLFNBQVMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7Z0JBQzlCLENBQUM7WUFDTCxDQUFDLENBQUMsQ0FBQztRQUNQLENBQUMsQ0FBQyxDQUFDO1FBRUgsT0FBTyxTQUFTLENBQUM7SUFDckIsQ0FBQztDQUNKO0FBdHJCRCw4QkFzckJDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXHJcbiAqIFZhbGlkYXRvciBjbGFzcyBmb3IgZmluZGluZyBwYXJhbWV0ZXJzIGluIFR5cGVTY3JpcHQgZmlsZXNcclxuICogU2NhbnMgdGhlIGFzc2V0cyBmb2xkZXIgYW5kIGxvb2tzIGZvciBwbGF5YWJsZUNvcmUuZ2V0UGFyYW0oXCJwYXJhbVwiKSBjYWxsc1xyXG4gKi9cclxuXHJcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcclxuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgUGFyYW1ldGVyQ2FsbCB7XHJcbiAgICBwYXJhbWV0ZXI6IHN0cmluZztcclxuICAgIGxpbmVOdW1iZXI6IG51bWJlcjtcclxuICAgIGNvbnRleHQ6IHN0cmluZztcclxuICAgIGZpbGVQYXRoOiBzdHJpbmc7XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgVmFsaWRhdGlvblJlc3VsdCB7XHJcbiAgICBmaWxlUGF0aDogc3RyaW5nO1xyXG4gICAgcGFyYW1ldGVyczogc3RyaW5nW107XHJcbiAgICBwYXJhbWV0ZXJDYWxsczogUGFyYW1ldGVyQ2FsbFtdO1xyXG4gICAgZXJyb3JzOiBzdHJpbmdbXTtcclxuICAgIGF1ZGlvQ2FsbHM6IEF1ZGlvQ2FsbFtdO1xyXG4gICAgc3VwZXJIdG1sQ2FsbHM6IFN1cGVySHRtbENhbGxbXTtcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBBdWRpb0NhbGwge1xyXG4gICAgdHlwZTogJ3BsYXlNdXNpYycgfCAnc21vb3RoU3RvcE11c2ljJztcclxuICAgIGxpbmVOdW1iZXI6IG51bWJlcjtcclxuICAgIGNvbnRleHQ6IHN0cmluZztcclxuICAgIGZpbGVQYXRoOiBzdHJpbmc7XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgU3VwZXJIdG1sQ2FsbCB7XHJcbiAgICB0eXBlOiAnZG93bmxvYWQnIHwgJ2dhbWVfZW5kJztcclxuICAgIGxpbmVOdW1iZXI6IG51bWJlcjtcclxuICAgIGNvbnRleHQ6IHN0cmluZztcclxuICAgIGZpbGVQYXRoOiBzdHJpbmc7XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgUGFyYW1ldGVyU3RhdHVzIHtcclxuICAgIHBhcmFtZXRlcjogc3RyaW5nO1xyXG4gICAgZm91bmQ6IGJvb2xlYW47XHJcbiAgICB2ZXJzaW9uczogc3RyaW5nW107XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgQXVkaW9WYWxpZGF0aW9uU3VtbWFyeSB7XHJcbiAgICBoYXNQbGF5TXVzaWM6IGJvb2xlYW47XHJcbiAgICBoYXNTbW9vdGhTdG9wTXVzaWM6IGJvb2xlYW47XHJcbiAgICBwbGF5TXVzaWNGaWxlczogc3RyaW5nW107XHJcbiAgICBzbW9vdGhTdG9wTXVzaWNGaWxlczogc3RyaW5nW107XHJcbiAgICB0b3RhbEF1ZGlvQ2FsbHM6IG51bWJlcjtcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBTdXBlckh0bWxWYWxpZGF0aW9uU3VtbWFyeSB7XHJcbiAgICBoYXNEb3dubG9hZDogYm9vbGVhbjtcclxuICAgIGhhc0dhbWVFbmQ6IGJvb2xlYW47XHJcbiAgICBkb3dubG9hZEZpbGVzOiBzdHJpbmdbXTtcclxuICAgIGdhbWVFbmRGaWxlczogc3RyaW5nW107XHJcbiAgICB0b3RhbFN1cGVySHRtbENhbGxzOiBudW1iZXI7XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgVmFsaWRhdGlvblN1bW1hcnkge1xyXG4gICAgdG90YWxGaWxlczogbnVtYmVyO1xyXG4gICAgZmlsZXNXaXRoUGFyYW1zOiBudW1iZXI7XHJcbiAgICB0b3RhbFBhcmFtZXRlcnM6IG51bWJlcjtcclxuICAgIHVuaXF1ZVBhcmFtZXRlcnM6IHN0cmluZ1tdO1xyXG4gICAgcmVzdWx0czogVmFsaWRhdGlvblJlc3VsdFtdO1xyXG4gICAgcGFyYW1ldGVyU3RhdHVzZXM6IFBhcmFtZXRlclN0YXR1c1tdO1xyXG4gICAgbWlzc2luZ1BhcmFtZXRlcnM6IHN0cmluZ1tdO1xyXG4gICAgdmFsaWRQYXJhbWV0ZXJzOiBzdHJpbmdbXTtcclxuICAgIGF1ZGlvVmFsaWRhdGlvbjogQXVkaW9WYWxpZGF0aW9uU3VtbWFyeTtcclxuICAgIHN1cGVySHRtbFZhbGlkYXRpb246IFN1cGVySHRtbFZhbGlkYXRpb25TdW1tYXJ5O1xyXG4gICAgaXNWYWxpZGF0aW9uU3VjY2Vzc2Z1bDogYm9vbGVhbjtcclxuICAgIHZhbGlkYXRpb25FcnJvcnM6IHN0cmluZ1tdO1xyXG59XHJcblxyXG5leHBvcnQgY2xhc3MgVmFsaWRhdG9yIHtcclxuICAgIHByaXZhdGUgcHJvamVjdFJvb3Q6IHN0cmluZztcclxuICAgIHByaXZhdGUgYXNzZXRzUGF0aDogc3RyaW5nO1xyXG4gICAgcHJpdmF0ZSB2ZXJzaW9uc1BhdGg6IHN0cmluZztcclxuXHJcbiAgICBjb25zdHJ1Y3Rvcihwcm9qZWN0Um9vdDogc3RyaW5nKSB7XHJcbiAgICAgICAgdGhpcy5wcm9qZWN0Um9vdCA9IHByb2plY3RSb290O1xyXG4gICAgICAgIHRoaXMuYXNzZXRzUGF0aCA9IHBhdGguam9pbihwcm9qZWN0Um9vdCwgJ2Fzc2V0cycpO1xyXG4gICAgICAgIHRoaXMudmVyc2lvbnNQYXRoID0gcGF0aC5qb2luKHByb2plY3RSb290LCAndmVyc2lvbnMuY2pzJyk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBMb2FkcyB2ZXJzaW9uIHZhcmlhYmxlcyBmcm9tIHZlcnNpb25zLmNqcyBmaWxlXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgbG9hZFZlcnNpb25QYXJhbWV0ZXJzKCk6IHN0cmluZ1tdIHtcclxuICAgICAgICB0cnkge1xyXG5cclxuICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKHRoaXMudmVyc2lvbnNQYXRoKSkge1xyXG4gICAgICAgICAgICAgICAgLy8gVHJ5IHRvIGZpbmQgdGhlIGZpbGUgaW4gb3RoZXIgcG9zc2libGUgbG9jYXRpb25zXHJcbiAgICAgICAgICAgICAgICBjb25zdCBhbHRlcm5hdGl2ZVBhdGhzID0gW1xyXG4gICAgICAgICAgICAgICAgICAgIHBhdGguam9pbih0aGlzLnByb2plY3RSb290LCAnLi4nLCAndmVyc2lvbnMuY2pzJyksXHJcbiAgICAgICAgICAgICAgICAgICAgcGF0aC5qb2luKHRoaXMucHJvamVjdFJvb3QsICcuLicsICcuLicsICd2ZXJzaW9ucy5janMnKSxcclxuICAgICAgICAgICAgICAgICAgICBwYXRoLmpvaW4odGhpcy5wcm9qZWN0Um9vdCwgJy4uJywgJy4uJywgJy4uJywgJ3ZlcnNpb25zLmNqcycpXHJcbiAgICAgICAgICAgICAgICBdO1xyXG5cclxuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgYWx0UGF0aCBvZiBhbHRlcm5hdGl2ZVBhdGhzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMoYWx0UGF0aCkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy52ZXJzaW9uc1BhdGggPSBhbHRQYXRoO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKHRoaXMudmVyc2lvbnNQYXRoKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBbXTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8gQ2xlYXIgcmVxdWlyZSBjYWNoZVxyXG4gICAgICAgICAgICBkZWxldGUgcmVxdWlyZS5jYWNoZVtyZXF1aXJlLnJlc29sdmUodGhpcy52ZXJzaW9uc1BhdGgpXTtcclxuXHJcbiAgICAgICAgICAgIC8vIExvYWQgdmVyc2lvbnMuY2pzIGZpbGVcclxuICAgICAgICAgICAgY29uc3QgdmVyc2lvbnNEYXRhID0gcmVxdWlyZSh0aGlzLnZlcnNpb25zUGF0aCk7XHJcblxyXG4gICAgICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkodmVyc2lvbnNEYXRhKSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIFtdO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvLyBFeHRyYWN0IGFsbCBwYXJhbWV0ZXJzIGZyb20gYWxsIHZlcnNpb25zXHJcbiAgICAgICAgICAgIGNvbnN0IGFsbFBhcmFtZXRlcnMgPSBuZXcgU2V0PHN0cmluZz4oKTtcclxuXHJcbiAgICAgICAgICAgIHZlcnNpb25zRGF0YS5mb3JFYWNoKCh2ZXJzaW9uOiBhbnkpID0+IHtcclxuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgdmVyc2lvbiA9PT0gJ29iamVjdCcgJiYgdmVyc2lvbiAhPT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgICAgIE9iamVjdC5rZXlzKHZlcnNpb24pLmZvckVhY2goa2V5ID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gRXhjbHVkZSBvbmx5IHNlcnZpY2UgZmllbGRzXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChrZXkgIT09ICduYW1lJyAmJiBrZXkgIT09ICdsYW5ndWFnZScpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFsbFBhcmFtZXRlcnMuYWRkKGtleSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICBjb25zdCBwYXJhbWV0ZXJzID0gQXJyYXkuZnJvbShhbGxQYXJhbWV0ZXJzKTtcclxuICAgICAgICAgICAgcmV0dXJuIHBhcmFtZXRlcnM7XHJcblxyXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBbXTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBNYWluIG1ldGhvZCBmb3IgcnVubmluZyB2YWxpZGF0aW9uXHJcbiAgICAgKi9cclxuICAgIGFzeW5jIHZhbGlkYXRlKCk6IFByb21pc2U8VmFsaWRhdGlvblN1bW1hcnk+IHtcclxuICAgICAgICBjb25zdCByZXN1bHRzOiBWYWxpZGF0aW9uUmVzdWx0W10gPSBbXTtcclxuICAgICAgICBjb25zdCB1bmlxdWVQYXJhbWV0ZXJzID0gbmV3IFNldDxzdHJpbmc+KCk7XHJcbiAgICAgICAgbGV0IHRvdGFsRmlsZXMgPSAwO1xyXG4gICAgICAgIGxldCBmaWxlc1dpdGhQYXJhbXMgPSAwO1xyXG5cclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAvLyBMb2FkIHZlcnNpb24gdmFyaWFibGVzXHJcbiAgICAgICAgICAgIGNvbnN0IHZlcnNpb25QYXJhbWV0ZXJzID0gdGhpcy5sb2FkVmVyc2lvblBhcmFtZXRlcnMoKTtcclxuXHJcbiAgICAgICAgICAgIC8vIENoZWNrIGlmIGFzc2V0cyBmb2xkZXIgZXhpc3RzXHJcbiAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyh0aGlzLmFzc2V0c1BhdGgpKSB7XHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2V0cyBmb2xkZXIgbm90IGZvdW5kOiAke3RoaXMuYXNzZXRzUGF0aH1gKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8gU2NhbiBhbGwgVHlwZVNjcmlwdCBmaWxlc1xyXG4gICAgICAgICAgICBjb25zdCB0c0ZpbGVzID0gdGhpcy5maW5kVHlwZVNjcmlwdEZpbGVzKHRoaXMuYXNzZXRzUGF0aCk7XHJcbiAgICAgICAgICAgIHRvdGFsRmlsZXMgPSB0c0ZpbGVzLmxlbmd0aDtcclxuXHJcbiAgICAgICAgICAgIC8vIFByb2Nlc3MgZWFjaCBmaWxlXHJcbiAgICAgICAgICAgIGZvciAoY29uc3QgZmlsZVBhdGggb2YgdHNGaWxlcykge1xyXG4gICAgICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLnZhbGlkYXRlRmlsZShmaWxlUGF0aCk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0cy5wdXNoKHJlc3VsdCk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChyZXN1bHQucGFyYW1ldGVycy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGZpbGVzV2l0aFBhcmFtcysrO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXN1bHQucGFyYW1ldGVycy5mb3JFYWNoKHBhcmFtID0+IHVuaXF1ZVBhcmFtZXRlcnMuYWRkKHBhcmFtKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXN1bHRzLnB1c2goe1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBmaWxlUGF0aCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgcGFyYW1ldGVyczogW10sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhcmFtZXRlckNhbGxzOiBbXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgZXJyb3JzOiBbYEZpbGUgcmVhZGluZyBlcnJvcjogJHtlcnJvcn1gXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgYXVkaW9DYWxsczogW10sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHN1cGVySHRtbENhbGxzOiBbXVxyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvLyBDb21wYXJlIGZvdW5kIHBhcmFtZXRlcnMgd2l0aCB2ZXJzaW9uIHZhcmlhYmxlc1xyXG4gICAgICAgICAgICBjb25zdCBmb3VuZFBhcmFtZXRlcnMgPSBBcnJheS5mcm9tKHVuaXF1ZVBhcmFtZXRlcnMpO1xyXG4gICAgICAgICAgICBjb25zdCBwYXJhbWV0ZXJTdGF0dXNlczogUGFyYW1ldGVyU3RhdHVzW10gPSBbXTtcclxuICAgICAgICAgICAgY29uc3QgbWlzc2luZ1BhcmFtZXRlcnM6IHN0cmluZ1tdID0gW107XHJcbiAgICAgICAgICAgIGNvbnN0IHZhbGlkUGFyYW1ldGVyczogc3RyaW5nW10gPSBbXTtcclxuXHJcbiAgICAgICAgICAgIGZvdW5kUGFyYW1ldGVycy5mb3JFYWNoKHBhcmFtID0+IHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGZvdW5kID0gdmVyc2lvblBhcmFtZXRlcnMuaW5jbHVkZXMocGFyYW0pO1xyXG4gICAgICAgICAgICAgICAgY29uc3QgdmVyc2lvbnMgPSB2ZXJzaW9uUGFyYW1ldGVycy5maWx0ZXIodnAgPT4gdnAgPT09IHBhcmFtKTtcclxuXHJcbiAgICAgICAgICAgICAgICBwYXJhbWV0ZXJTdGF0dXNlcy5wdXNoKHtcclxuICAgICAgICAgICAgICAgICAgICBwYXJhbWV0ZXI6IHBhcmFtLFxyXG4gICAgICAgICAgICAgICAgICAgIGZvdW5kLFxyXG4gICAgICAgICAgICAgICAgICAgIHZlcnNpb25zXHJcbiAgICAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgICAgICBpZiAoZm91bmQpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YWxpZFBhcmFtZXRlcnMucHVzaChwYXJhbSk7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIG1pc3NpbmdQYXJhbWV0ZXJzLnB1c2gocGFyYW0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIC8vIEFuYWx5emUgYXVkaW8gY2FsbHNcclxuICAgICAgICAgICAgY29uc3QgYXVkaW9WYWxpZGF0aW9uID0gdGhpcy5hbmFseXplQXVkaW9DYWxscyhyZXN1bHRzKTtcclxuXHJcbiAgICAgICAgICAgIC8vIEFuYWx5emUgc3VwZXJfaHRtbF9wbGF5YWJsZSBjYWxsc1xyXG4gICAgICAgICAgICBjb25zdCBzdXBlckh0bWxWYWxpZGF0aW9uID0gdGhpcy5hbmFseXplU3VwZXJIdG1sQ2FsbHMocmVzdWx0cyk7XHJcblxyXG4gICAgICAgICAgICAvLyBDaGVjayByZXF1aXJlZCBzdXBlcl9odG1sX3BsYXlhYmxlIG1ldGhvZHNcclxuICAgICAgICAgICAgY29uc3QgdmFsaWRhdGlvbkVycm9yczogc3RyaW5nW10gPSBbXTtcclxuICAgICAgICAgICAgbGV0IGlzVmFsaWRhdGlvblN1Y2Nlc3NmdWwgPSB0cnVlO1xyXG5cclxuICAgICAgICAgICAgaWYgKCFzdXBlckh0bWxWYWxpZGF0aW9uLmhhc0Rvd25sb2FkKSB7XHJcbiAgICAgICAgICAgICAgICB2YWxpZGF0aW9uRXJyb3JzLnB1c2goJ1JlcXVpcmVkIG1ldGhvZCBzdXBlcl9odG1sX3BsYXlhYmxlLmRvd25sb2FkKCkgbm90IGZvdW5kJyk7XHJcbiAgICAgICAgICAgICAgICBpc1ZhbGlkYXRpb25TdWNjZXNzZnVsID0gZmFsc2U7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmICghc3VwZXJIdG1sVmFsaWRhdGlvbi5oYXNHYW1lRW5kKSB7XHJcbiAgICAgICAgICAgICAgICB2YWxpZGF0aW9uRXJyb3JzLnB1c2goJ1JlcXVpcmVkIG1ldGhvZCBzdXBlcl9odG1sX3BsYXlhYmxlLmdhbWVfZW5kKCkgbm90IGZvdW5kJyk7XHJcbiAgICAgICAgICAgICAgICBpc1ZhbGlkYXRpb25TdWNjZXNzZnVsID0gZmFsc2U7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vIENoZWNrIHJlcXVpcmVkIGF1ZGlvIG1ldGhvZHNcclxuICAgICAgICAgICAgaWYgKCFhdWRpb1ZhbGlkYXRpb24uaGFzUGxheU11c2ljKSB7XHJcbiAgICAgICAgICAgICAgICB2YWxpZGF0aW9uRXJyb3JzLnB1c2goJ1JlcXVpcmVkIG1ldGhvZCBBdWRpb01hbmFnZXIuaW5zdGFuY2UucGxheU11c2ljKCkgbm90IGZvdW5kJyk7XHJcbiAgICAgICAgICAgICAgICBpc1ZhbGlkYXRpb25TdWNjZXNzZnVsID0gZmFsc2U7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmICghYXVkaW9WYWxpZGF0aW9uLmhhc1Ntb290aFN0b3BNdXNpYykge1xyXG4gICAgICAgICAgICAgICAgdmFsaWRhdGlvbkVycm9ycy5wdXNoKCdSZXF1aXJlZCBtZXRob2QgQXVkaW9NYW5hZ2VyLmluc3RhbmNlLnNtb290aFN0b3BNdXNpYygpIG5vdCBmb3VuZCcpO1xyXG4gICAgICAgICAgICAgICAgaXNWYWxpZGF0aW9uU3VjY2Vzc2Z1bCA9IGZhbHNlO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvLyBDaGVjayBmb3IgcGFyYW1ldGVycyB3aXRob3V0IHZlcnNpb25zXHJcbiAgICAgICAgICAgIGlmIChtaXNzaW5nUGFyYW1ldGVycy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICAgICAgICB2YWxpZGF0aW9uRXJyb3JzLnB1c2goYEZvdW5kIHBhcmFtZXRlcnMgd2l0aG91dCB2ZXJzaW9uczogJHttaXNzaW5nUGFyYW1ldGVycy5qb2luKCcsICcpfWApO1xyXG4gICAgICAgICAgICAgICAgaXNWYWxpZGF0aW9uU3VjY2Vzc2Z1bCA9IGZhbHNlO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBjb25zdCBzdW1tYXJ5OiBWYWxpZGF0aW9uU3VtbWFyeSA9IHtcclxuICAgICAgICAgICAgICAgIHRvdGFsRmlsZXMsXHJcbiAgICAgICAgICAgICAgICBmaWxlc1dpdGhQYXJhbXMsXHJcbiAgICAgICAgICAgICAgICB0b3RhbFBhcmFtZXRlcnM6IHVuaXF1ZVBhcmFtZXRlcnMuc2l6ZSxcclxuICAgICAgICAgICAgICAgIHVuaXF1ZVBhcmFtZXRlcnM6IGZvdW5kUGFyYW1ldGVycy5zb3J0KCksXHJcbiAgICAgICAgICAgICAgICByZXN1bHRzLFxyXG4gICAgICAgICAgICAgICAgcGFyYW1ldGVyU3RhdHVzZXMsXHJcbiAgICAgICAgICAgICAgICBtaXNzaW5nUGFyYW1ldGVycyxcclxuICAgICAgICAgICAgICAgIHZhbGlkUGFyYW1ldGVycyxcclxuICAgICAgICAgICAgICAgIGF1ZGlvVmFsaWRhdGlvbixcclxuICAgICAgICAgICAgICAgIHN1cGVySHRtbFZhbGlkYXRpb24sXHJcbiAgICAgICAgICAgICAgICBpc1ZhbGlkYXRpb25TdWNjZXNzZnVsLFxyXG4gICAgICAgICAgICAgICAgdmFsaWRhdGlvbkVycm9yc1xyXG4gICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICAgICAgcmV0dXJuIHN1bW1hcnk7XHJcblxyXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICAgIHRocm93IGVycm9yO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFJlY3Vyc2l2ZWx5IGZpbmRzIGFsbCBUeXBlU2NyaXB0IGZpbGVzIGluIHRoZSBmb2xkZXJcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBmaW5kVHlwZVNjcmlwdEZpbGVzKGRpcjogc3RyaW5nKTogc3RyaW5nW10ge1xyXG4gICAgICAgIGNvbnN0IGZpbGVzOiBzdHJpbmdbXSA9IFtdO1xyXG5cclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCBpdGVtcyA9IGZzLnJlYWRkaXJTeW5jKGRpcik7XHJcblxyXG4gICAgICAgICAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgaXRlbXMpIHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGZ1bGxQYXRoID0gcGF0aC5qb2luKGRpciwgaXRlbSk7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBzdGF0ID0gZnMuc3RhdFN5bmMoZnVsbFBhdGgpO1xyXG5cclxuICAgICAgICAgICAgICAgIGlmIChzdGF0LmlzRGlyZWN0b3J5KCkpIHtcclxuICAgICAgICAgICAgICAgICAgICAvLyBSZWN1cnNpdmVseSBzY2FuIHN1YmZvbGRlcnNcclxuICAgICAgICAgICAgICAgICAgICBmaWxlcy5wdXNoKC4uLnRoaXMuZmluZFR5cGVTY3JpcHRGaWxlcyhmdWxsUGF0aCkpO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChpdGVtLmVuZHNXaXRoKCcudHMnKSAmJiAhaXRlbS5lbmRzV2l0aCgnLmQudHMnKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIEFkZCBvbmx5IC50cyBmaWxlcywgZXhjbHVkaW5nIC5kLnRzXHJcbiAgICAgICAgICAgICAgICAgICAgZmlsZXMucHVzaChmdWxsUGF0aCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgICAvLyBDb3VsZCBub3QgcmVhZCBmb2xkZXJcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBmaWxlcztcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFZhbGlkYXRlcyBhIHNpbmdsZSBmaWxlIGZvciBnZXRQYXJhbSBjYWxscyBhbmQgYXVkaW8gY2FsbHNcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBhc3luYyB2YWxpZGF0ZUZpbGUoZmlsZVBhdGg6IHN0cmluZyk6IFByb21pc2U8VmFsaWRhdGlvblJlc3VsdD4ge1xyXG4gICAgICAgIGNvbnN0IHJlc3VsdDogVmFsaWRhdGlvblJlc3VsdCA9IHtcclxuICAgICAgICAgICAgZmlsZVBhdGg6IHBhdGgucmVsYXRpdmUodGhpcy5wcm9qZWN0Um9vdCwgZmlsZVBhdGgpLFxyXG4gICAgICAgICAgICBwYXJhbWV0ZXJzOiBbXSxcclxuICAgICAgICAgICAgcGFyYW1ldGVyQ2FsbHM6IFtdLFxyXG4gICAgICAgICAgICBlcnJvcnM6IFtdLFxyXG4gICAgICAgICAgICBhdWRpb0NhbGxzOiBbXSxcclxuICAgICAgICAgICAgc3VwZXJIdG1sQ2FsbHM6IFtdXHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc3QgY29udGVudCA9IGZzLnJlYWRGaWxlU3luYyhmaWxlUGF0aCwgJ3V0Zi04Jyk7XHJcbiAgICAgICAgICAgIGNvbnN0IHBhcmFtZXRlckNhbGxzID0gdGhpcy5leHRyYWN0R2V0UGFyYW1DYWxscyhjb250ZW50LCBmaWxlUGF0aCk7XHJcbiAgICAgICAgICAgIGNvbnN0IGF1ZGlvQ2FsbHMgPSB0aGlzLmV4dHJhY3RBdWRpb01hbmFnZXJDYWxscyhjb250ZW50LCBmaWxlUGF0aCk7XHJcbiAgICAgICAgICAgIGNvbnN0IHN1cGVySHRtbENhbGxzID0gdGhpcy5leHRyYWN0U3VwZXJIdG1sQ2FsbHMoY29udGVudCwgZmlsZVBhdGgpO1xyXG4gICAgICAgICAgICByZXN1bHQucGFyYW1ldGVyQ2FsbHMgPSBwYXJhbWV0ZXJDYWxscztcclxuICAgICAgICAgICAgcmVzdWx0LnBhcmFtZXRlcnMgPSBwYXJhbWV0ZXJDYWxscy5tYXAoY2FsbCA9PiBjYWxsLnBhcmFtZXRlcik7XHJcbiAgICAgICAgICAgIHJlc3VsdC5hdWRpb0NhbGxzID0gYXVkaW9DYWxscztcclxuICAgICAgICAgICAgcmVzdWx0LnN1cGVySHRtbENhbGxzID0gc3VwZXJIdG1sQ2FsbHM7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICAgICAgcmVzdWx0LmVycm9ycy5wdXNoKGBGaWxlIHJlYWRpbmcgZXJyb3I6ICR7ZXJyb3J9YCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogRXh0cmFjdHMgYWxsIHBsYXlhYmxlQ29yZS5nZXRQYXJhbShcInBhcmFtXCIpIGNhbGxzIGZyb20gZmlsZSBjb250ZW50XHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgZXh0cmFjdEdldFBhcmFtQ2FsbHMoY29udGVudDogc3RyaW5nLCBmaWxlUGF0aDogc3RyaW5nKTogUGFyYW1ldGVyQ2FsbFtdIHtcclxuICAgICAgICBjb25zdCBwYXJhbWV0ZXJDYWxsczogUGFyYW1ldGVyQ2FsbFtdID0gW107XHJcbiAgICAgICAgY29uc3QgbGluZXMgPSBjb250ZW50LnNwbGl0KCdcXG4nKTtcclxuXHJcbiAgICAgICAgLy8gUmVndWxhciBleHByZXNzaW9uIGZvciBmaW5kaW5nIGdldFBhcmFtIGNhbGxzXHJcbiAgICAgICAgLy8gTG9vayBmb3IgdmFyaW91cyB2YXJpYW50czpcclxuICAgICAgICAvLyAtIHBsYXlhYmxlQ29yZS5nZXRQYXJhbShcInBhcmFtXCIpXHJcbiAgICAgICAgLy8gLSBwbGF5YWJsZUNvcmUuZ2V0UGFyYW0oJ3BhcmFtJylcclxuICAgICAgICAvLyAtIHRoaXMucGxheWFibGVDb3JlLmdldFBhcmFtKFwicGFyYW1cIilcclxuICAgICAgICAvLyAtIHBsYXlhYmxlQ29yZT8uZ2V0UGFyYW0oXCJwYXJhbVwiKVxyXG4gICAgICAgIGNvbnN0IGdldFBhcmFtUmVnZXggPSAvKD86cGxheWFibGVDb3JlfHRoaXNcXC5wbGF5YWJsZUNvcmUpKD86XFw/XFwuKT9cXC5nZXRQYXJhbVxccypcXChcXHMqW1wiJ10oW15cIiddKylbXCInXVxccypcXCkvZztcclxuXHJcbiAgICAgICAgbGluZXMuZm9yRWFjaCgobGluZSwgaW5kZXgpID0+IHtcclxuICAgICAgICAgICAgY29uc3QgbGluZU51bWJlciA9IGluZGV4ICsgMTtcclxuICAgICAgICAgICAgY29uc3QgdHJpbW1lZExpbmUgPSBsaW5lLnRyaW0oKTtcclxuXHJcbiAgICAgICAgICAgIC8vIFNraXAgY29tbWVudGVkIGxpbmVzXHJcbiAgICAgICAgICAgIGlmICh0cmltbWVkTGluZS5zdGFydHNXaXRoKCcvLycpIHx8IHRyaW1tZWRMaW5lLnN0YXJ0c1dpdGgoJy8qJykgfHwgdHJpbW1lZExpbmUuc3RhcnRzV2l0aCgnKicpKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGxldCBtYXRjaDtcclxuXHJcbiAgICAgICAgICAgIC8vIFJlc2V0IHJlZ2V4IGluZGV4IGZvciBlYWNoIGxpbmVcclxuICAgICAgICAgICAgZ2V0UGFyYW1SZWdleC5sYXN0SW5kZXggPSAwO1xyXG5cclxuICAgICAgICAgICAgd2hpbGUgKChtYXRjaCA9IGdldFBhcmFtUmVnZXguZXhlYyhsaW5lKSkgIT09IG51bGwpIHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHBhcmFtID0gbWF0Y2hbMV0udHJpbSgpO1xyXG4gICAgICAgICAgICAgICAgaWYgKHBhcmFtKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcGFyYW1ldGVyQ2FsbHMucHVzaCh7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhcmFtZXRlcjogcGFyYW0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGxpbmVOdW1iZXIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRleHQ6IGxpbmUudHJpbSgpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBmaWxlUGF0aDogcGF0aC5yZWxhdGl2ZSh0aGlzLnByb2plY3RSb290LCBmaWxlUGF0aClcclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICByZXR1cm4gcGFyYW1ldGVyQ2FsbHM7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBFeHRyYWN0cyBhbGwgQXVkaW9NYW5hZ2VyIGNhbGxzIGZyb20gZmlsZSBjb250ZW50XHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgZXh0cmFjdEF1ZGlvTWFuYWdlckNhbGxzKGNvbnRlbnQ6IHN0cmluZywgZmlsZVBhdGg6IHN0cmluZyk6IEF1ZGlvQ2FsbFtdIHtcclxuICAgICAgICBjb25zdCBhdWRpb0NhbGxzOiBBdWRpb0NhbGxbXSA9IFtdO1xyXG4gICAgICAgIGNvbnN0IGxpbmVzID0gY29udGVudC5zcGxpdCgnXFxuJyk7XHJcblxyXG4gICAgICAgIC8vIFJlZ3VsYXIgZXhwcmVzc2lvbnMgZm9yIGZpbmRpbmcgYXVkaW8gY2FsbHNcclxuICAgICAgICBjb25zdCBwbGF5TXVzaWNSZWdleCA9IC9BdWRpb01hbmFnZXJcXC5pbnN0YW5jZVxcLnBsYXlNdXNpY1xccypcXCgvZztcclxuICAgICAgICBjb25zdCBzbW9vdGhTdG9wTXVzaWNSZWdleCA9IC9BdWRpb01hbmFnZXJcXC5pbnN0YW5jZVxcLnNtb290aFN0b3BNdXNpY1xccypcXCgvZztcclxuXHJcbiAgICAgICAgbGluZXMuZm9yRWFjaCgobGluZSwgaW5kZXgpID0+IHtcclxuICAgICAgICAgICAgY29uc3QgbGluZU51bWJlciA9IGluZGV4ICsgMTtcclxuICAgICAgICAgICAgY29uc3QgdHJpbW1lZExpbmUgPSBsaW5lLnRyaW0oKTtcclxuXHJcbiAgICAgICAgICAgIC8vIFNraXAgY29tbWVudGVkIGxpbmVzXHJcbiAgICAgICAgICAgIGlmICh0cmltbWVkTGluZS5zdGFydHNXaXRoKCcvLycpIHx8IHRyaW1tZWRMaW5lLnN0YXJ0c1dpdGgoJy8qJykgfHwgdHJpbW1lZExpbmUuc3RhcnRzV2l0aCgnKicpKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vIFNlYXJjaCBmb3IgcGxheU11c2ljXHJcbiAgICAgICAgICAgIGlmIChwbGF5TXVzaWNSZWdleC50ZXN0KGxpbmUpKSB7XHJcbiAgICAgICAgICAgICAgICBhdWRpb0NhbGxzLnB1c2goe1xyXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdwbGF5TXVzaWMnLFxyXG4gICAgICAgICAgICAgICAgICAgIGxpbmVOdW1iZXIsXHJcbiAgICAgICAgICAgICAgICAgICAgY29udGV4dDogbGluZS50cmltKCksXHJcbiAgICAgICAgICAgICAgICAgICAgZmlsZVBhdGg6IHBhdGgucmVsYXRpdmUodGhpcy5wcm9qZWN0Um9vdCwgZmlsZVBhdGgpXHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8gUmVzZXQgcmVnZXggaW5kZXhcclxuICAgICAgICAgICAgcGxheU11c2ljUmVnZXgubGFzdEluZGV4ID0gMDtcclxuXHJcbiAgICAgICAgICAgIC8vIFNlYXJjaCBmb3Igc21vb3RoU3RvcE11c2ljXHJcbiAgICAgICAgICAgIGlmIChzbW9vdGhTdG9wTXVzaWNSZWdleC50ZXN0KGxpbmUpKSB7XHJcbiAgICAgICAgICAgICAgICBhdWRpb0NhbGxzLnB1c2goe1xyXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzbW9vdGhTdG9wTXVzaWMnLFxyXG4gICAgICAgICAgICAgICAgICAgIGxpbmVOdW1iZXIsXHJcbiAgICAgICAgICAgICAgICAgICAgY29udGV4dDogbGluZS50cmltKCksXHJcbiAgICAgICAgICAgICAgICAgICAgZmlsZVBhdGg6IHBhdGgucmVsYXRpdmUodGhpcy5wcm9qZWN0Um9vdCwgZmlsZVBhdGgpXHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8gUmVzZXQgcmVnZXggaW5kZXhcclxuICAgICAgICAgICAgc21vb3RoU3RvcE11c2ljUmVnZXgubGFzdEluZGV4ID0gMDtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgcmV0dXJuIGF1ZGlvQ2FsbHM7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBFeHRyYWN0cyBhbGwgc3VwZXJfaHRtbF9wbGF5YWJsZSBjYWxscyBmcm9tIGZpbGUgY29udGVudFxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIGV4dHJhY3RTdXBlckh0bWxDYWxscyhjb250ZW50OiBzdHJpbmcsIGZpbGVQYXRoOiBzdHJpbmcpOiBTdXBlckh0bWxDYWxsW10ge1xyXG4gICAgICAgIGNvbnN0IHN1cGVySHRtbENhbGxzOiBTdXBlckh0bWxDYWxsW10gPSBbXTtcclxuICAgICAgICBjb25zdCBsaW5lcyA9IGNvbnRlbnQuc3BsaXQoJ1xcbicpO1xyXG5cclxuICAgICAgICAvLyBSZWd1bGFyIGV4cHJlc3Npb25zIGZvciBmaW5kaW5nIHN1cGVyX2h0bWxfcGxheWFibGUgY2FsbHNcclxuICAgICAgICBjb25zdCBkb3dubG9hZFJlZ2V4ID0gL3N1cGVyX2h0bWxfcGxheWFibGVcXC5kb3dubG9hZFxccypcXChcXHMqXFwpL2c7XHJcbiAgICAgICAgY29uc3QgZ2FtZUVuZFJlZ2V4ID0gL3N1cGVyX2h0bWxfcGxheWFibGVcXC5nYW1lX2VuZFxccypcXChcXHMqXFwpL2c7XHJcblxyXG4gICAgICAgIGxpbmVzLmZvckVhY2goKGxpbmUsIGluZGV4KSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IGxpbmVOdW1iZXIgPSBpbmRleCArIDE7XHJcbiAgICAgICAgICAgIGNvbnN0IHRyaW1tZWRMaW5lID0gbGluZS50cmltKCk7XHJcblxyXG4gICAgICAgICAgICAvLyBTa2lwIGNvbW1lbnRlZCBsaW5lc1xyXG4gICAgICAgICAgICBpZiAodHJpbW1lZExpbmUuc3RhcnRzV2l0aCgnLy8nKSB8fCB0cmltbWVkTGluZS5zdGFydHNXaXRoKCcvKicpIHx8IHRyaW1tZWRMaW5lLnN0YXJ0c1dpdGgoJyonKSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvLyBTZWFyY2ggZm9yIGRvd25sb2FkXHJcbiAgICAgICAgICAgIGlmIChkb3dubG9hZFJlZ2V4LnRlc3QobGluZSkpIHtcclxuICAgICAgICAgICAgICAgIHN1cGVySHRtbENhbGxzLnB1c2goe1xyXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdkb3dubG9hZCcsXHJcbiAgICAgICAgICAgICAgICAgICAgbGluZU51bWJlcixcclxuICAgICAgICAgICAgICAgICAgICBjb250ZXh0OiBsaW5lLnRyaW0oKSxcclxuICAgICAgICAgICAgICAgICAgICBmaWxlUGF0aDogcGF0aC5yZWxhdGl2ZSh0aGlzLnByb2plY3RSb290LCBmaWxlUGF0aClcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvLyBSZXNldCByZWdleCBpbmRleFxyXG4gICAgICAgICAgICBkb3dubG9hZFJlZ2V4Lmxhc3RJbmRleCA9IDA7XHJcblxyXG4gICAgICAgICAgICAvLyBTZWFyY2ggZm9yIGdhbWVfZW5kXHJcbiAgICAgICAgICAgIGlmIChnYW1lRW5kUmVnZXgudGVzdChsaW5lKSkge1xyXG4gICAgICAgICAgICAgICAgc3VwZXJIdG1sQ2FsbHMucHVzaCh7XHJcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2dhbWVfZW5kJyxcclxuICAgICAgICAgICAgICAgICAgICBsaW5lTnVtYmVyLFxyXG4gICAgICAgICAgICAgICAgICAgIGNvbnRleHQ6IGxpbmUudHJpbSgpLFxyXG4gICAgICAgICAgICAgICAgICAgIGZpbGVQYXRoOiBwYXRoLnJlbGF0aXZlKHRoaXMucHJvamVjdFJvb3QsIGZpbGVQYXRoKVxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vIFJlc2V0IHJlZ2V4IGluZGV4XHJcbiAgICAgICAgICAgIGdhbWVFbmRSZWdleC5sYXN0SW5kZXggPSAwO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICByZXR1cm4gc3VwZXJIdG1sQ2FsbHM7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBBbmFseXplcyBhdWRpbyBjYWxscyBpbiBhbGwgZmlsZXNcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBhbmFseXplQXVkaW9DYWxscyhyZXN1bHRzOiBWYWxpZGF0aW9uUmVzdWx0W10pOiBBdWRpb1ZhbGlkYXRpb25TdW1tYXJ5IHtcclxuICAgICAgICBjb25zdCBwbGF5TXVzaWNGaWxlczogc3RyaW5nW10gPSBbXTtcclxuICAgICAgICBjb25zdCBzbW9vdGhTdG9wTXVzaWNGaWxlczogc3RyaW5nW10gPSBbXTtcclxuICAgICAgICBsZXQgdG90YWxBdWRpb0NhbGxzID0gMDtcclxuXHJcbiAgICAgICAgcmVzdWx0cy5mb3JFYWNoKHJlc3VsdCA9PiB7XHJcbiAgICAgICAgICAgIHJlc3VsdC5hdWRpb0NhbGxzLmZvckVhY2goYXVkaW9DYWxsID0+IHtcclxuICAgICAgICAgICAgICAgIHRvdGFsQXVkaW9DYWxscysrO1xyXG5cclxuICAgICAgICAgICAgICAgIGlmIChhdWRpb0NhbGwudHlwZSA9PT0gJ3BsYXlNdXNpYycgJiYgIXBsYXlNdXNpY0ZpbGVzLmluY2x1ZGVzKHJlc3VsdC5maWxlUGF0aCkpIHtcclxuICAgICAgICAgICAgICAgICAgICBwbGF5TXVzaWNGaWxlcy5wdXNoKHJlc3VsdC5maWxlUGF0aCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKGF1ZGlvQ2FsbC50eXBlID09PSAnc21vb3RoU3RvcE11c2ljJyAmJiAhc21vb3RoU3RvcE11c2ljRmlsZXMuaW5jbHVkZXMocmVzdWx0LmZpbGVQYXRoKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHNtb290aFN0b3BNdXNpY0ZpbGVzLnB1c2gocmVzdWx0LmZpbGVQYXRoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIGhhc1BsYXlNdXNpYzogcGxheU11c2ljRmlsZXMubGVuZ3RoID4gMCxcclxuICAgICAgICAgICAgaGFzU21vb3RoU3RvcE11c2ljOiBzbW9vdGhTdG9wTXVzaWNGaWxlcy5sZW5ndGggPiAwLFxyXG4gICAgICAgICAgICBwbGF5TXVzaWNGaWxlcyxcclxuICAgICAgICAgICAgc21vb3RoU3RvcE11c2ljRmlsZXMsXHJcbiAgICAgICAgICAgIHRvdGFsQXVkaW9DYWxsc1xyXG4gICAgICAgIH07XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBBbmFseXplcyBzdXBlcl9odG1sX3BsYXlhYmxlIGNhbGxzIGluIGFsbCBmaWxlc1xyXG4gICAgICovXHJcbiAgICBwcml2YXRlIGFuYWx5emVTdXBlckh0bWxDYWxscyhyZXN1bHRzOiBWYWxpZGF0aW9uUmVzdWx0W10pOiBTdXBlckh0bWxWYWxpZGF0aW9uU3VtbWFyeSB7XHJcbiAgICAgICAgY29uc3QgZG93bmxvYWRGaWxlczogc3RyaW5nW10gPSBbXTtcclxuICAgICAgICBjb25zdCBnYW1lRW5kRmlsZXM6IHN0cmluZ1tdID0gW107XHJcbiAgICAgICAgbGV0IHRvdGFsU3VwZXJIdG1sQ2FsbHMgPSAwO1xyXG5cclxuICAgICAgICByZXN1bHRzLmZvckVhY2gocmVzdWx0ID0+IHtcclxuICAgICAgICAgICAgcmVzdWx0LnN1cGVySHRtbENhbGxzLmZvckVhY2goc3VwZXJIdG1sQ2FsbCA9PiB7XHJcbiAgICAgICAgICAgICAgICB0b3RhbFN1cGVySHRtbENhbGxzKys7XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKHN1cGVySHRtbENhbGwudHlwZSA9PT0gJ2Rvd25sb2FkJyAmJiAhZG93bmxvYWRGaWxlcy5pbmNsdWRlcyhyZXN1bHQuZmlsZVBhdGgpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZG93bmxvYWRGaWxlcy5wdXNoKHJlc3VsdC5maWxlUGF0aCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKHN1cGVySHRtbENhbGwudHlwZSA9PT0gJ2dhbWVfZW5kJyAmJiAhZ2FtZUVuZEZpbGVzLmluY2x1ZGVzKHJlc3VsdC5maWxlUGF0aCkpIHtcclxuICAgICAgICAgICAgICAgICAgICBnYW1lRW5kRmlsZXMucHVzaChyZXN1bHQuZmlsZVBhdGgpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgaGFzRG93bmxvYWQ6IGRvd25sb2FkRmlsZXMubGVuZ3RoID4gMCxcclxuICAgICAgICAgICAgaGFzR2FtZUVuZDogZ2FtZUVuZEZpbGVzLmxlbmd0aCA+IDAsXHJcbiAgICAgICAgICAgIGRvd25sb2FkRmlsZXMsXHJcbiAgICAgICAgICAgIGdhbWVFbmRGaWxlcyxcclxuICAgICAgICAgICAgdG90YWxTdXBlckh0bWxDYWxsc1xyXG4gICAgICAgIH07XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBHZW5lcmF0ZXMgSFRNTCB2YWxpZGF0aW9uIHJlcG9ydFxyXG4gICAgICovXHJcbiAgICBnZW5lcmF0ZUh0bWxSZXBvcnQoc3VtbWFyeTogVmFsaWRhdGlvblN1bW1hcnkpOiBzdHJpbmcge1xyXG4gICAgICAgIGNvbnN0IHsgdG90YWxGaWxlcywgZmlsZXNXaXRoUGFyYW1zLCB0b3RhbFBhcmFtZXRlcnMsIHVuaXF1ZVBhcmFtZXRlcnMsIHJlc3VsdHMsIHBhcmFtZXRlclN0YXR1c2VzLCBtaXNzaW5nUGFyYW1ldGVycywgdmFsaWRQYXJhbWV0ZXJzLCBhdWRpb1ZhbGlkYXRpb24sIHN1cGVySHRtbFZhbGlkYXRpb24sIGlzVmFsaWRhdGlvblN1Y2Nlc3NmdWwsIHZhbGlkYXRpb25FcnJvcnMgfSA9IHN1bW1hcnk7XHJcblxyXG4gICAgICAgIGxldCBodG1sID0gYFxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwidmFsaWRhdG9yLXJlcG9ydFwiPlxyXG4gICAgICAgICAgICAgICAgPCEtLSBWYWxpZGF0aW9uIHN0YXR1cyAtLT5cclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ2YWxpZGF0b3Itc3RhdHVzICR7aXNWYWxpZGF0aW9uU3VjY2Vzc2Z1bCA/ICdzdWNjZXNzJyA6ICdmYWlsZWQnfVwiPlxyXG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwic3RhdHVzLWljb25cIj4ke2lzVmFsaWRhdGlvblN1Y2Nlc3NmdWwgPyAn4pyFJyA6ICfinYwnfTwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cInN0YXR1cy10ZXh0XCI+VmFsaWRhdGlvbiAke2lzVmFsaWRhdGlvblN1Y2Nlc3NmdWwgPyAnU1VDQ0VTU0ZVTCcgOiAnRkFJTEVEJ308L3NwYW4+XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgJHt2YWxpZGF0aW9uRXJyb3JzLmxlbmd0aCA+IDAgPyBgXHJcbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInZhbGlkYXRpb24tZXJyb3JzXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxoMz7inYwgVmFsaWRhdGlvbiBlcnJvcnM6PC9oMz5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHVsPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJHt2YWxpZGF0aW9uRXJyb3JzLm1hcChlcnJvciA9PiBgPGxpPiR7ZXJyb3J9PC9saT5gKS5qb2luKCcnKX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgPC91bD5cclxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgIGAgOiAnJ31cclxuXHJcbiAgICAgICAgICAgICAgICA8IS0tIENvbXBhY3Qgc3RhdGlzdGljcyAtLT5cclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ2YWxpZGF0b3Itc3RhdHNcIj5cclxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwic3RhdC1iYWRnZSAke3ZhbGlkUGFyYW1ldGVycy5sZW5ndGggPiAwID8gJ3ZhbGlkJyA6ICcnfVwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cInN0YXQtaWNvblwiPuKchTwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJzdGF0LXRleHRcIj4ke3ZhbGlkUGFyYW1ldGVycy5sZW5ndGh9IHZhbGlkPC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJzdGF0LWJhZGdlICR7bWlzc2luZ1BhcmFtZXRlcnMubGVuZ3RoID4gMCA/ICdtaXNzaW5nJyA6ICcnfVwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cInN0YXQtaWNvblwiPuKdjDwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJzdGF0LXRleHRcIj4ke21pc3NpbmdQYXJhbWV0ZXJzLmxlbmd0aH0gbm90IGZvdW5kPC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJzdGF0LWJhZGdlICR7YXVkaW9WYWxpZGF0aW9uLnRvdGFsQXVkaW9DYWxscyA+IDAgPyAnYXVkaW8nIDogJyd9XCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwic3RhdC1pY29uXCI+8J+OtTwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJzdGF0LXRleHRcIj4ke2F1ZGlvVmFsaWRhdGlvbi50b3RhbEF1ZGlvQ2FsbHN9IGF1ZGlvPC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJzdGF0LWJhZGdlICR7c3VwZXJIdG1sVmFsaWRhdGlvbi50b3RhbFN1cGVySHRtbENhbGxzID4gMCA/ICdzdXBlcmh0bWwnIDogJyd9XCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwic3RhdC1pY29uXCI+8J+TsTwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJzdGF0LXRleHRcIj4ke3N1cGVySHRtbFZhbGlkYXRpb24udG90YWxTdXBlckh0bWxDYWxsc30gc3VwZXJfaHRtbDwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ2YWxpZGF0b3ItYXVkaW9cIj5cclxuICAgICAgICAgICAgICAgICAgICA8aDM+8J+OtSBBdWRpbyB2YWxpZGF0aW9uPC9oMz5cclxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYXVkaW8td2FybmluZ3NcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgJHshYXVkaW9WYWxpZGF0aW9uLmhhc1BsYXlNdXNpYyA/ICc8ZGl2IGNsYXNzPVwiYXVkaW8td2FybmluZyBtaXNzaW5nXCI+4pqg77iPIE5vIEF1ZGlvTWFuYWdlci5pbnN0YW5jZS5wbGF5TXVzaWMoKSBjYWxscyBmb3VuZDwvZGl2PicgOiAnJ31cclxuICAgICAgICAgICAgICAgICAgICAgICAgJHshYXVkaW9WYWxpZGF0aW9uLmhhc1Ntb290aFN0b3BNdXNpYyA/ICc8ZGl2IGNsYXNzPVwiYXVkaW8td2FybmluZyBtaXNzaW5nXCI+4pqg77iPIE5vIEF1ZGlvTWFuYWdlci5pbnN0YW5jZS5zbW9vdGhTdG9wTXVzaWMoKSBjYWxscyBmb3VuZDwvZGl2PicgOiAnJ31cclxuICAgICAgICAgICAgICAgICAgICAgICAgJHthdWRpb1ZhbGlkYXRpb24uaGFzUGxheU11c2ljICYmIGF1ZGlvVmFsaWRhdGlvbi5oYXNTbW9vdGhTdG9wTXVzaWMgPyAnPGRpdiBjbGFzcz1cImF1ZGlvLXdhcm5pbmcgc3VjY2Vzc1wiPuKchSBBbGwgbmVjZXNzYXJ5IGF1ZGlvIGNhbGxzIGZvdW5kPC9kaXY+JyA6ICcnfVxyXG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgICR7YXVkaW9WYWxpZGF0aW9uLnBsYXlNdXNpY0ZpbGVzLmxlbmd0aCA+IDAgPyBgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxkZXRhaWxzIGNsYXNzPVwiYXVkaW8tZGV0YWlsc1wiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHN1bW1hcnk+8J+TgSBGaWxlcyB3aXRoIHBsYXlNdXNpYyAoJHthdWRpb1ZhbGlkYXRpb24ucGxheU11c2ljRmlsZXMubGVuZ3RofSk8L3N1bW1hcnk+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYXVkaW8tZmlsZXMtbGlzdFwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICR7dGhpcy5nZW5lcmF0ZUF1ZGlvRmlsZXNMaXN0KHJlc3VsdHMsICdwbGF5TXVzaWMnKX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8L2RldGFpbHM+XHJcbiAgICAgICAgICAgICAgICAgICAgYCA6ICcnfVxyXG4gICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgICR7YXVkaW9WYWxpZGF0aW9uLnNtb290aFN0b3BNdXNpY0ZpbGVzLmxlbmd0aCA+IDAgPyBgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxkZXRhaWxzIGNsYXNzPVwiYXVkaW8tZGV0YWlsc1wiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHN1bW1hcnk+8J+TgSBGaWxlcyB3aXRoIHNtb290aFN0b3BNdXNpYyAoJHthdWRpb1ZhbGlkYXRpb24uc21vb3RoU3RvcE11c2ljRmlsZXMubGVuZ3RofSk8L3N1bW1hcnk+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYXVkaW8tZmlsZXMtbGlzdFwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICR7dGhpcy5nZW5lcmF0ZUF1ZGlvRmlsZXNMaXN0KHJlc3VsdHMsICdzbW9vdGhTdG9wTXVzaWMnKX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8L2RldGFpbHM+XHJcbiAgICAgICAgICAgICAgICAgICAgYCA6ICcnfVxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInZhbGlkYXRvci1zdXBlcmh0bWxcIj5cclxuICAgICAgICAgICAgICAgICAgICA8aDM+8J+TsSBTdXBlciBIVE1MIFBsYXlhYmxlIHZhbGlkYXRpb248L2gzPlxyXG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJzdXBlcmh0bWwtd2FybmluZ3NcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgJHshc3VwZXJIdG1sVmFsaWRhdGlvbi5oYXNEb3dubG9hZCA/ICc8ZGl2IGNsYXNzPVwic3VwZXJodG1sLXdhcm5pbmcgbWlzc2luZ1wiPuKaoO+4jyBObyBzdXBlcl9odG1sX3BsYXlhYmxlLmRvd25sb2FkKCkgY2FsbHMgZm91bmQ8L2Rpdj4nIDogJyd9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICR7IXN1cGVySHRtbFZhbGlkYXRpb24uaGFzR2FtZUVuZCA/ICc8ZGl2IGNsYXNzPVwic3VwZXJodG1sLXdhcm5pbmcgbWlzc2luZ1wiPuKaoO+4jyBObyBzdXBlcl9odG1sX3BsYXlhYmxlLmdhbWVfZW5kKCkgY2FsbHMgZm91bmQ8L2Rpdj4nIDogJyd9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICR7c3VwZXJIdG1sVmFsaWRhdGlvbi5oYXNEb3dubG9hZCAmJiBzdXBlckh0bWxWYWxpZGF0aW9uLmhhc0dhbWVFbmQgPyAnPGRpdiBjbGFzcz1cInN1cGVyaHRtbC13YXJuaW5nIHN1Y2Nlc3NcIj7inIUgQWxsIG5lY2Vzc2FyeSBzdXBlcl9odG1sX3BsYXlhYmxlIGNhbGxzIGZvdW5kPC9kaXY+JyA6ICcnfVxyXG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgICR7c3VwZXJIdG1sVmFsaWRhdGlvbi5kb3dubG9hZEZpbGVzLmxlbmd0aCA+IDAgPyBgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxkZXRhaWxzIGNsYXNzPVwic3VwZXJodG1sLWRldGFpbHNcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxzdW1tYXJ5PvCfk4EgRmlsZXMgd2l0aCBkb3dubG9hZCgpICgke3N1cGVySHRtbFZhbGlkYXRpb24uZG93bmxvYWRGaWxlcy5sZW5ndGh9KTwvc3VtbWFyeT5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJzdXBlcmh0bWwtZmlsZXMtbGlzdFwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICR7dGhpcy5nZW5lcmF0ZVN1cGVySHRtbEZpbGVzTGlzdChyZXN1bHRzLCAnZG93bmxvYWQnKX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8L2RldGFpbHM+XHJcbiAgICAgICAgICAgICAgICAgICAgYCA6ICcnfVxyXG4gICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgICR7c3VwZXJIdG1sVmFsaWRhdGlvbi5nYW1lRW5kRmlsZXMubGVuZ3RoID4gMCA/IGBcclxuICAgICAgICAgICAgICAgICAgICAgICAgPGRldGFpbHMgY2xhc3M9XCJzdXBlcmh0bWwtZGV0YWlsc1wiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHN1bW1hcnk+8J+TgSBGaWxlcyB3aXRoIGdhbWVfZW5kKCkgKCR7c3VwZXJIdG1sVmFsaWRhdGlvbi5nYW1lRW5kRmlsZXMubGVuZ3RofSk8L3N1bW1hcnk+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwic3VwZXJodG1sLWZpbGVzLWxpc3RcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAke3RoaXMuZ2VuZXJhdGVTdXBlckh0bWxGaWxlc0xpc3QocmVzdWx0cywgJ2dhbWVfZW5kJyl9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kZXRhaWxzPlxyXG4gICAgICAgICAgICAgICAgICAgIGAgOiAnJ31cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ2YWxpZGF0b3ItcGFyYW1ldGVyc1wiPlxyXG4gICAgICAgICAgICAgICAgICAgIDxoMz7wn5SNIFBhcmFtZXRlcnMgdmFsaWRhdGlvbjwvaDM+XHJcbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInBhcmFtZXRlcnMtd2FybmluZ3NcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgJHt2YWxpZFBhcmFtZXRlcnMubGVuZ3RoID4gMCA/ICc8ZGl2IGNsYXNzPVwicGFyYW1ldGVycy13YXJuaW5nIHN1Y2Nlc3NcIj7inIUgVmFsaWQgcGFyYW1ldGVycyBmb3VuZDwvZGl2PicgOiAnJ31cclxuICAgICAgICAgICAgICAgICAgICAgICAgJHttaXNzaW5nUGFyYW1ldGVycy5sZW5ndGggPiAwID8gJzxkaXYgY2xhc3M9XCJwYXJhbWV0ZXJzLXdhcm5pbmcgbWlzc2luZ1wiPuKaoO+4jyBQYXJhbWV0ZXJzIG5vdCBmcm9tIHZlcnNpb25zIGZvdW5kPC9kaXY+JyA6ICcnfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAke3VuaXF1ZVBhcmFtZXRlcnMubGVuZ3RoID09PSAwID8gJzxkaXYgY2xhc3M9XCJwYXJhbWV0ZXJzLXdhcm5pbmcgbWlzc2luZ1wiPuKaoO+4jyBObyBwYXJhbWV0ZXJzIGZvdW5kPC9kaXY+JyA6ICcnfVxyXG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgICR7dmFsaWRQYXJhbWV0ZXJzLmxlbmd0aCA+IDAgPyBgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxkZXRhaWxzIGNsYXNzPVwicGFyYW1ldGVycy1kZXRhaWxzXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c3VtbWFyeT7wn5OBIFZhbGlkIHBhcmFtZXRlcnMgKCR7dmFsaWRQYXJhbWV0ZXJzLmxlbmd0aH0pPC9zdW1tYXJ5PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInBhcmFtZXRlcnMtZmlsZXMtbGlzdFwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICR7dGhpcy5nZW5lcmF0ZVBhcmFtZXRlcnNGaWxlc0xpc3QocmVzdWx0cywgdmFsaWRQYXJhbWV0ZXJzLCAndmFsaWQnKX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8L2RldGFpbHM+XHJcbiAgICAgICAgICAgICAgICAgICAgYCA6ICcnfVxyXG4gICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgICR7bWlzc2luZ1BhcmFtZXRlcnMubGVuZ3RoID4gMCA/IGBcclxuICAgICAgICAgICAgICAgICAgICAgICAgPGRldGFpbHMgY2xhc3M9XCJwYXJhbWV0ZXJzLWRldGFpbHNcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxzdW1tYXJ5PvCfk4EgUGFyYW1ldGVycyBub3QgZnJvbSB2ZXJzaW9ucyAoJHttaXNzaW5nUGFyYW1ldGVycy5sZW5ndGh9KTwvc3VtbWFyeT5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJwYXJhbWV0ZXJzLWZpbGVzLWxpc3RcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAke3RoaXMuZ2VuZXJhdGVQYXJhbWV0ZXJzRmlsZXNMaXN0KHJlc3VsdHMsIG1pc3NpbmdQYXJhbWV0ZXJzLCAnbWlzc2luZycpfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvZGV0YWlscz5cclxuICAgICAgICAgICAgICAgICAgICBgIDogJyd9XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgIGA7XHJcblxyXG4gICAgICAgIC8vIEFkZCBKYXZhU2NyaXB0IGZvciBoYW5kbGluZyBsaW5rIGNsaWNrc1xyXG4gICAgICAgIGh0bWwgKz0gYFxyXG4gICAgICAgICAgICA8c2NyaXB0PlxyXG4gICAgICAgICAgICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignRE9NQ29udGVudExvYWRlZCcsIGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIENsaWNrIGhhbmRsZXIgZm9yIGNsaWNrYWJsZSBsaW5rc1xyXG4gICAgICAgICAgICAgICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZnVuY3Rpb24oZXZlbnQpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGV2ZW50LnRhcmdldC5jbGFzc0xpc3QuY29udGFpbnMoJ2NsaWNrYWJsZS1saW5lJykpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGZpbGVQYXRoID0gZXZlbnQudGFyZ2V0LmdldEF0dHJpYnV0ZSgnZGF0YS1maWxlJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBsaW5lTnVtYmVyID0gcGFyc2VJbnQoZXZlbnQudGFyZ2V0LmdldEF0dHJpYnV0ZSgnZGF0YS1saW5lJykpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZmlsZVBhdGggJiYgbGluZU51bWJlcikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFNlbmQgbWVzc2FnZSB0byBtYWluIHByb2Nlc3MgdG8gb3BlbiBmaWxlXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBFZGl0b3IgIT09ICd1bmRlZmluZWQnICYmIEVkaXRvci5NZXNzYWdlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIEVkaXRvci5NZXNzYWdlLnNlbmQoJ2NyYWRhLXN1cGVyLWJ1aWxkZXInLCAnb3Blbi1maWxlJywge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZmlsZVBhdGg6IGZpbGVQYXRoLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGluZU51bWJlcjogbGluZU51bWJlclxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBGYWxsYmFjayBmb3IgZGVidWdnaW5nXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgPC9zY3JpcHQ+XHJcbiAgICAgICAgYDtcclxuXHJcbiAgICAgICAgcmV0dXJuIGh0bWw7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBHZW5lcmF0ZXMgbGlzdCBvZiBhdWRpbyBmaWxlcyB3aXRoIGh5cGVybGlua3NcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBnZW5lcmF0ZUF1ZGlvRmlsZXNMaXN0KHJlc3VsdHM6IFZhbGlkYXRpb25SZXN1bHRbXSwgYXVkaW9UeXBlOiAncGxheU11c2ljJyB8ICdzbW9vdGhTdG9wTXVzaWMnKTogc3RyaW5nIHtcclxuICAgICAgICBjb25zdCBhdWRpb0NhbGxzID0gcmVzdWx0c1xyXG4gICAgICAgICAgICAuZmxhdE1hcChyZXN1bHQgPT4gcmVzdWx0LmF1ZGlvQ2FsbHMpXHJcbiAgICAgICAgICAgIC5maWx0ZXIoY2FsbCA9PiBjYWxsLnR5cGUgPT09IGF1ZGlvVHlwZSk7XHJcblxyXG4gICAgICAgIHJldHVybiBhdWRpb0NhbGxzLm1hcChhdWRpb0NhbGwgPT4ge1xyXG4gICAgICAgICAgICBjb25zdCBmdWxsUGF0aCA9IHBhdGguam9pbih0aGlzLnByb2plY3RSb290LCBhdWRpb0NhbGwuZmlsZVBhdGgpO1xyXG4gICAgICAgICAgICBjb25zdCBhdWRpb0ljb24gPSBhdWRpb0NhbGwudHlwZSA9PT0gJ3BsYXlNdXNpYycgPyAn8J+OtScgOiAn4o+577iPJztcclxuXHJcbiAgICAgICAgICAgIHJldHVybiBgPGRpdiBjbGFzcz1cImF1ZGlvLWZpbGUtaXRlbVwiPlxyXG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwiYXVkaW8taWNvblwiPiR7YXVkaW9JY29ufTwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cImF1ZGlvLWZpbGUtbmFtZSBjbGlja2FibGUtbGluZVwiIGRhdGEtZmlsZT1cIiR7ZnVsbFBhdGh9XCIgZGF0YS1saW5lPVwiJHthdWRpb0NhbGwubGluZU51bWJlcn1cIj4ke2F1ZGlvQ2FsbC5maWxlUGF0aH06JHthdWRpb0NhbGwubGluZU51bWJlcn08L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJhdWRpby1jb250ZXh0XCI+JHthdWRpb0NhbGwuY29udGV4dH08L3NwYW4+XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5gO1xyXG4gICAgICAgIH0pLmpvaW4oJycpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogR2VuZXJhdGVzIGxpc3Qgb2Ygc3VwZXJfaHRtbF9wbGF5YWJsZSBmaWxlcyB3aXRoIGh5cGVybGlua3NcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBnZW5lcmF0ZVN1cGVySHRtbEZpbGVzTGlzdChyZXN1bHRzOiBWYWxpZGF0aW9uUmVzdWx0W10sIHN1cGVySHRtbFR5cGU6ICdkb3dubG9hZCcgfCAnZ2FtZV9lbmQnKTogc3RyaW5nIHtcclxuICAgICAgICBjb25zdCBzdXBlckh0bWxDYWxscyA9IHJlc3VsdHNcclxuICAgICAgICAgICAgLmZsYXRNYXAocmVzdWx0ID0+IHJlc3VsdC5zdXBlckh0bWxDYWxscylcclxuICAgICAgICAgICAgLmZpbHRlcihjYWxsID0+IGNhbGwudHlwZSA9PT0gc3VwZXJIdG1sVHlwZSk7XHJcblxyXG4gICAgICAgIHJldHVybiBzdXBlckh0bWxDYWxscy5tYXAoc3VwZXJIdG1sQ2FsbCA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IGZ1bGxQYXRoID0gcGF0aC5qb2luKHRoaXMucHJvamVjdFJvb3QsIHN1cGVySHRtbENhbGwuZmlsZVBhdGgpO1xyXG4gICAgICAgICAgICBjb25zdCBzdXBlckh0bWxJY29uID0gc3VwZXJIdG1sQ2FsbC50eXBlID09PSAnZG93bmxvYWQnID8gJ/Cfk6UnIDogJ/Cfj4EnO1xyXG5cclxuICAgICAgICAgICAgcmV0dXJuIGA8ZGl2IGNsYXNzPVwic3VwZXJodG1sLWZpbGUtaXRlbVwiPlxyXG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwic3VwZXJodG1sLWljb25cIj4ke3N1cGVySHRtbEljb259PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwic3VwZXJodG1sLWZpbGUtbmFtZSBjbGlja2FibGUtbGluZVwiIGRhdGEtZmlsZT1cIiR7ZnVsbFBhdGh9XCIgZGF0YS1saW5lPVwiJHtzdXBlckh0bWxDYWxsLmxpbmVOdW1iZXJ9XCI+JHtzdXBlckh0bWxDYWxsLmZpbGVQYXRofToke3N1cGVySHRtbENhbGwubGluZU51bWJlcn08L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJzdXBlcmh0bWwtY29udGV4dFwiPiR7c3VwZXJIdG1sQ2FsbC5jb250ZXh0fTwvc3Bhbj5cclxuICAgICAgICAgICAgICAgIDwvZGl2PmA7XHJcbiAgICAgICAgfSkuam9pbignJyk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBHZW5lcmF0ZXMgbGlzdCBvZiBmaWxlcyB3aXRoIHBhcmFtZXRlcnMgd2l0aCBoeXBlcmxpbmtzXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgZ2VuZXJhdGVQYXJhbWV0ZXJzRmlsZXNMaXN0KHJlc3VsdHM6IFZhbGlkYXRpb25SZXN1bHRbXSwgcGFyYW1ldGVyczogc3RyaW5nW10sIHR5cGU6ICd2YWxpZCcgfCAnbWlzc2luZycpOiBzdHJpbmcge1xyXG4gICAgICAgIGNvbnN0IHBhcmFtZXRlckNhbGxzID0gcmVzdWx0c1xyXG4gICAgICAgICAgICAuZmxhdE1hcChyZXN1bHQgPT4gcmVzdWx0LnBhcmFtZXRlckNhbGxzKVxyXG4gICAgICAgICAgICAuZmlsdGVyKGNhbGwgPT4gcGFyYW1ldGVycy5pbmNsdWRlcyhjYWxsLnBhcmFtZXRlcikpO1xyXG5cclxuICAgICAgICByZXR1cm4gcGFyYW1ldGVyQ2FsbHMubWFwKHBhcmFtQ2FsbCA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IGZ1bGxQYXRoID0gcGF0aC5qb2luKHRoaXMucHJvamVjdFJvb3QsIHBhcmFtQ2FsbC5maWxlUGF0aCk7XHJcbiAgICAgICAgICAgIGNvbnN0IHBhcmFtSWNvbiA9IHR5cGUgPT09ICd2YWxpZCcgPyAn4pyFJyA6ICfinYwnO1xyXG4gICAgICAgICAgICBjb25zdCBzdGF0dXNDbGFzcyA9IHR5cGUgPT09ICd2YWxpZCcgPyAndmFsaWQnIDogJ21pc3NpbmcnO1xyXG5cclxuICAgICAgICAgICAgcmV0dXJuIGA8ZGl2IGNsYXNzPVwicGFyYW1ldGVyLWZpbGUtaXRlbSAke3N0YXR1c0NsYXNzfVwiPlxyXG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwicGFyYW1ldGVyLWljb25cIj4ke3BhcmFtSWNvbn08L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJwYXJhbWV0ZXItbmFtZVwiPlwiJHtwYXJhbUNhbGwucGFyYW1ldGVyfVwiPC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwicGFyYW1ldGVyLWZpbGUtbmFtZSBjbGlja2FibGUtbGluZVwiIGRhdGEtZmlsZT1cIiR7ZnVsbFBhdGh9XCIgZGF0YS1saW5lPVwiJHtwYXJhbUNhbGwubGluZU51bWJlcn1cIj4ke3BhcmFtQ2FsbC5maWxlUGF0aH06JHtwYXJhbUNhbGwubGluZU51bWJlcn08L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJwYXJhbWV0ZXItY29udGV4dFwiPiR7cGFyYW1DYWxsLmNvbnRleHR9PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+YDtcclxuICAgICAgICB9KS5qb2luKCcnKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEZpbmRzIGFsbCBwbGFjZXMgd2hlcmUgYSBwYXJhbWV0ZXIgaXMgdXNlZFxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIGZpbmRQYXJhbWV0ZXJMb2NhdGlvbnMocmVzdWx0czogVmFsaWRhdGlvblJlc3VsdFtdLCBwYXJhbWV0ZXI6IHN0cmluZyk6IFBhcmFtZXRlckNhbGxbXSB7XHJcbiAgICAgICAgY29uc3QgbG9jYXRpb25zOiBQYXJhbWV0ZXJDYWxsW10gPSBbXTtcclxuXHJcbiAgICAgICAgcmVzdWx0cy5mb3JFYWNoKHJlc3VsdCA9PiB7XHJcbiAgICAgICAgICAgIHJlc3VsdC5wYXJhbWV0ZXJDYWxscy5mb3JFYWNoKHBhcmFtQ2FsbCA9PiB7XHJcbiAgICAgICAgICAgICAgICBpZiAocGFyYW1DYWxsLnBhcmFtZXRlciA9PT0gcGFyYW1ldGVyKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgbG9jYXRpb25zLnB1c2gocGFyYW1DYWxsKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHJldHVybiBsb2NhdGlvbnM7XHJcbiAgICB9XHJcbn1cclxuIl19