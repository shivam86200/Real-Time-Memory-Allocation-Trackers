class UIHandler {
    constructor(memorySystem) {
        this.memorySystem = memorySystem;
        this.canvas = document.getElementById('memoryCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.memoryBlocks = [];
        this.selectedBlock = null;
        this.colorMap = new Map();
        
        this.setupEventListeners();
        this.renderMemory();
    }
    
    setupEventListeners() {
        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            for (const block of this.memoryBlocks) {
                if (x >= block.x && x <= block.x + block.width &&
                    y >= block.y && y <= block.y + block.height) {
                    this.selectBlock(block);
                    break;
                }
            }
        });
        
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            let tooltipShown = false;
            
            for (const block of this.memoryBlocks) {
                if (x >= block.x && x <= block.x + block.width &&
                    y >= block.y && y <= block.y + block.height) {
                    this.showTooltip(block, e.clientX, e.clientY);
                    tooltipShown = true;
                    break;
                }
            }
            
            if (!tooltipShown) {
                this.hideTooltip();
            }
        });
        
        this.canvas.addEventListener('mouseout', () => {
            this.hideTooltip();
        });
        
        this.memorySystem.onMemoryChanged = () => this.renderMemory();
        this.memorySystem.onPageFault = () => this.showPageFault();
        this.memorySystem.onSegmentViolation = () => this.showSegmentViolation();
        this.memorySystem.onLogEvent = (type, message) => this.addLogEntry(type, message);
    }
    
    renderMemory() {
        const mode = this.memorySystem.mode;
        this.clearCanvas();
        
        if (mode === 'paging') {
            this.renderPagingView();
        } else {
            this.renderSegmentationView();
        }
        
        this.updateStats();
    }
    
    renderPagingView() {
        const memory = this.memorySystem.getMemoryState();
        const pageSize = this.memorySystem.pageSize;
        const totalPages = this.memorySystem.totalPages;
        
        const padding = 10;
        const blockSize = Math.min(
            (this.canvas.width - padding * 2) / totalPages,
            (this.canvas.height - padding * 2) / pageSize
        );
        
        const startX = (this.canvas.width - blockSize * totalPages) / 2;
        const startY = (this.canvas.height - blockSize * pageSize) / 2;
        
        this.memoryBlocks = [];
        
        for (let frame = 0; frame < totalPages; frame++) {
            for (let offset = 0; offset < pageSize; offset++) {
                const index = frame * pageSize + offset;
                const x = startX + frame * blockSize;
                const y = startY + offset * blockSize;
                
                const block = memory[index];
                const blockInfo = {
                    x, y,
                    width: blockSize,
                    height: blockSize,
                    memoryIndex: index,
                    frame,
                    offset,
                    pid: block ? block.pid : null,
                    processName: block ? block.processName : null,
                    type: block ? block.type : 'free',
                    pageNumber: block ? block.pageNumber : null
                };
                
                this.drawMemoryBlock(blockInfo, block ? this.getProcessColor(block.pid) : '#e9ecef');
                this.memoryBlocks.push(blockInfo);
            }
        }
        
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 2;
        
        for (let frame = 0; frame <= totalPages; frame++) {
            const x = startX + frame * blockSize;
            this.ctx.beginPath();
            this.ctx.moveTo(x, startY);
            this.ctx.lineTo(x, startY + pageSize * blockSize);
            this.ctx.stroke();
        }
        
        this.ctx.fillStyle = '#000';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        
        for (let frame = 0; frame < totalPages; frame++) {
            const x = startX + frame * blockSize + blockSize / 2;
            const y = startY - 5;
            this.ctx.fillText(`Frame ${frame}`, x, y);
        }
    }
    
    renderSegmentationView() {
        const memory = this.memorySystem.getMemoryState();
        const totalSize = this.memorySystem.totalMemorySize;
        const segments = this.memorySystem.getSegments();
        
        const blockWidth = this.canvas.width - 20;
        const blockHeight = 30;
        const startX = 10;
        const startY = 50;
        
        this.memoryBlocks = [];
        
        this.ctx.fillStyle = '#000';
        this.ctx.font = '14px Arial';
        this.ctx.fillText('Memory Map (0 to ' + totalSize + ' KB)', startX, 30);
        
        const blocks = [];
        
        for (const segment of segments) {
            blocks.push({
                start: segment.start,
                size: segment.size,
                pid: segment.pid,
                processName: segment.processName,
                type: 'segment',
                segmentType: segment.type
            });
        }
        
        const freeBlocks = this.memorySystem.findFreeBlocks();
        for (const block of freeBlocks) {
            blocks.push({
                start: block.start,
                size: block.size,
                type: 'free'
            });
        }
        
        blocks.sort((a, b) => a.start - b.start);
        
        for (const block of blocks) {
            const width = (block.size / totalSize) * blockWidth;
            const x = startX + (block.start / totalSize) * blockWidth;
            const y = startY;
            
            const blockInfo = {
                x, y,
                width,
                height: blockHeight,
                memoryIndex: block.start,
                start: block.start,
                size: block.size,
                pid: block.pid || null,
                processName: block.processName || null,
                type: block.type,
                segmentType: block.segmentType || null
            };
            
            const color = block.type === 'free' ? '#e9ecef' : this.getProcessColor(block.pid);
            this.drawMemoryBlock(blockInfo, color);
            this.memoryBlocks.push(blockInfo);
            
            if (width > 40 && block.type !== 'free') {
                this.ctx.fillStyle = '#fff';
                this.ctx.font = '12px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(
                    block.processName + (block.segmentType ? ` (${block.segmentType})` : ''),
                    x + width / 2,
                    y + blockHeight / 2 + 4
                );
            }
        }
        
        this.drawMemoryRuler(startX, startY + blockHeight + 10, blockWidth, totalSize);
    }
    
    drawMemoryRuler(x, y, width, totalSize) {
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        this.ctx.lineTo(x + width, y);
        this.ctx.stroke();
        
        const numTicks = 10;
        const tickSpacing = width / numTicks;
        
        this.ctx.font = '10px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillStyle = '#000';
        
        for (let i = 0; i <= numTicks; i++) {
            const tickX = x + i * tickSpacing;
            const value = Math.round((i / numTicks) * totalSize);
            
            this.ctx.beginPath();
            this.ctx.moveTo(tickX, y);
            this.ctx.lineTo(tickX, y + 5);
            this.ctx.stroke();
            
            this.ctx.fillText(value.toString(), tickX, y + 15);
        }
    }
    
    drawMemoryBlock(block, color) {
        this.ctx.fillStyle = color;
        this.ctx.strokeStyle = '#555';
        this.ctx.lineWidth = 1;
        
        this.ctx.beginPath();
        this.ctx.rect(block.x, block.y, block.width, block.height);
        this.ctx.fill();
        this.ctx.stroke();
        
        if (block.pid) {
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '10px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            const text = `${block.processName}`;
            if (block.width > 30) {
                this.ctx.fillText(text, block.x + block.width/2, block.y + block.height/2);
            }
        }
        
        if (this.selectedBlock && this.selectedBlock.memoryIndex === block.memoryIndex) {
            this.ctx.strokeStyle = '#2196F3';
            this.ctx.lineWidth = 3;
            this.ctx.strokeRect(block.x, block.y, block.width, block.height);
        }
    }
    
    getProcessColor(pid) {
        if (!pid) return '#e9ecef';
        
        if (!this.colorMap.has(pid)) {
            const hue = (pid * 137.5) % 360;
            const saturation = 70 + (pid * 5) % 20;
            const lightness = 55 + (pid * 7) % 15;
            const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
            this.colorMap.set(pid, color);
        }
        
        return this.colorMap.get(pid);
    }
    
    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    selectBlock(block) {
        this.selectedBlock = block;
        this.renderMemory();
        
        document.getElementById('deallocateBtn').disabled = !block.pid;
    }
    
    showTooltip(block, x, y) {
        let tooltip = document.getElementById('memoryTooltip');
        
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'memoryTooltip';
            tooltip.className = 'tooltip';
            document.body.appendChild(tooltip);
        }
        
        let content = '';
        
        if (block.type === 'free') {
            content = `Free block<br>Start: ${block.start || block.memoryIndex}KB<br>Size: ${block.size || 1}KB`;
        } else if (this.memorySystem.mode === 'paging') {
            content = `Process: ${block.processName}<br>PID: ${block.pid}<br>` +
                      `Frame: ${block.frame}<br>Offset: ${block.offset}<br>` +
                      `Page: ${block.pageNumber}`;
        } else {
            content = `Process: ${block.processName}<br>PID: ${block.pid}<br>` +
                      `Segment: ${block.segmentType}<br>Start: ${block.start}KB<br>` +
                      `Size: ${block.size}KB`;
        }
        
        tooltip.innerHTML = content;
        
        tooltip.style.left = `${x + 10}px`;
        tooltip.style.top = `${y + 10}px`;
        tooltip.style.display = 'block';
    }
    
    hideTooltip() {
        const tooltip = document.getElementById('memoryTooltip');
        if (tooltip) {
            tooltip.style.display = 'none';
        }
    }
    
    updateStats() {
        const stats = this.memorySystem.getStats();
        
        document.getElementById('totalMemory').textContent = `${stats.totalMemory} KB`;
        document.getElementById('usedMemory').textContent = `${stats.usedMemory} KB`;
        document.getElementById('freeMemory').textContent = `${stats.freeMemory} KB`;
        document.getElementById('fragmentation').textContent = 
            `${stats.fragmentation} KB ${this.memorySystem.mode === 'paging' ? '(internal)' : '(external)'}`;
    }
    
    showPageFault() {
        const alert = document.getElementById('pageFaults');
        alert.classList.remove('d-none');
        
        setTimeout(() => {
            alert.classList.add('d-none');
        }, 3000);
    }
    
    showSegmentViolation() {
        const alert = document.getElementById('segmentViolation');
        alert.classList.remove('d-none');
        
        setTimeout(() => {
            alert.classList.add('d-none');
        }, 3000);
    }
    
    addLogEntry(type, message) {
        const logContainer = document.getElementById('memoryLog');
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        
        const timestamp = new Date().toLocaleTimeString();
        entry.innerHTML = `<strong>[${timestamp}]</strong> ${message}`;
        
        logContainer.appendChild(entry);
        logContainer.scrollTop = logContainer.scrollHeight;
    }
}

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = UIHandler;
} else {
    window.UIHandler = UIHandler;
}