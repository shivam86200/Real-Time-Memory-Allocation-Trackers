class MemorySystem {
    constructor(totalMemorySize = 64, pageSize = 4) {
        this.totalMemorySize = totalMemorySize;
        this.pageSize = pageSize;
        this.mode = 'paging';
        
        this.memory = new Array(totalMemorySize).fill(null);
        
        this.totalPages = Math.floor(totalMemorySize / pageSize);
        this.pageTable = new Array(this.totalPages).fill(null);
        
        this.segments = [];
        
        this.processes = new Map();
        this.nextPID = 1;
        
        this.stats = {
            usedMemory: 0,
            freeMemory: totalMemorySize,
            pageFaults: 0,
            segmentViolations: 0,
            internalFragmentation: 0,
            externalFragmentation: 0
        };
        
        this.onMemoryChanged = null;
        this.onPageFault = null;
        this.onSegmentViolation = null;
        this.onLogEvent = null;
    }
    
    setMode(mode) {
        if (mode !== 'paging' && mode !== 'segmentation') {
            throw new Error("Mode must be either 'paging' or 'segmentation'");
        }
        
        this.memory = new Array(this.totalMemorySize).fill(null);
        this.pageTable = new Array(this.totalPages).fill(null);
        this.segments = [];
        this.processes = new Map();
        this.nextPID = 1;
        
        this.resetStats();
        this.mode = mode;
        
        if (this.onLogEvent) {
            this.onLogEvent('info', `Switched to ${mode} mode`);
        }
        
        if (this.onMemoryChanged) {
            this.onMemoryChanged();
        }
    }
    
    resetStats() {
        this.stats = {
            usedMemory: 0,
            freeMemory: this.totalMemorySize,
            pageFaults: 0,
            segmentViolations: 0,
            internalFragmentation: 0,
            externalFragmentation: 0
        };
    }
    
    allocateMemory(processName, size, segmentType = 'code') {
        if (size <= 0) {
            if (this.onLogEvent) {
                this.onLogEvent('error', `Invalid size: ${size} KB`);
            }
            return false;
        }
        
        if (size > this.stats.freeMemory) {
            if (this.onLogEvent) {
                this.onLogEvent('error', `Not enough memory: requested ${size} KB, available ${this.stats.freeMemory} KB`);
            }
            return false;
        }
        
        const pid = this.nextPID++;
        
        if (this.mode === 'paging') {
            return this.allocateWithPaging(pid, processName, size);
        } else {
            return this.allocateWithSegmentation(pid, processName, size, segmentType);
        }
    }
    
    allocateWithPaging(pid, processName, size) {
        const requiredPages = Math.ceil(size / this.pageSize);
        const allocatedFrames = [];
        let internalFragmentation = 0;
        
        for (let i = 0; i < this.totalPages && allocatedFrames.length < requiredPages; i++) {
            if (this.pageTable[i] === null) {
                allocatedFrames.push(i);
            }
        }
        
        if (allocatedFrames.length < requiredPages) {
            if (this.onLogEvent) {
                this.onLogEvent('error', `Not enough contiguous pages: needed ${requiredPages}, found ${allocatedFrames.length}`);
            }
            return false;
        }
        
        const lastPageSize = size % this.pageSize;
        if (lastPageSize > 0) {
            internalFragmentation = this.pageSize - lastPageSize;
        }
        
        const pages = [];
        for (let i = 0; i < allocatedFrames.length; i++) {
            const frame = allocatedFrames[i];
            const page = {
                frame,
                size: i === allocatedFrames.length - 1 && lastPageSize > 0 ? lastPageSize : this.pageSize
            };
            pages.push(page);
            
            this.pageTable[frame] = pid;
            
            for (let j = 0; j < this.pageSize; j++) {
                const memIndex = frame * this.pageSize + j;
                if (memIndex < this.totalMemorySize) {
                    this.memory[memIndex] = {
                        pid,
                        processName,
                        type: 'allocated',
                        pageNumber: i,
                        frame
                    };
                }
            }
        }
        
        const process = {
            pid,
            name: processName,
            size,
            pages,
            internalFragmentation
        };
        
        this.processes.set(pid, process);
        
        this.stats.usedMemory += size;
        this.stats.freeMemory -= size;
        this.stats.internalFragmentation += internalFragmentation;
        
        if (this.onLogEvent) {
            this.onLogEvent('info', `Allocated ${size} KB (${pages.length} pages) to process ${processName} (PID: ${pid})`);
            if (internalFragmentation > 0) {
                this.onLogEvent('info', `Internal fragmentation: ${internalFragmentation} KB`);
            }
        }
        
        if (this.onMemoryChanged) {
            this.onMemoryChanged();
        }
        
        return true;
    }
    
    allocateWithSegmentation(pid, processName, size, segmentType) {
        const block = this.findBestFit(size);
        
        if (!block) {
            if (this.onLogEvent) {
                this.onLogEvent('error', `Could not find suitable memory block of size ${size} KB`);
            }
            return false;
        }
        
        return this.allocateSegment(pid, processName, size, segmentType, block);
    }
    
    allocateSegment(pid, processName, size, segmentType, block) {
        const segment = {
            pid,
            processName,
            start: block.start,
            size,
            type: segmentType
        };
        
        for (let i = 0; i < size; i++) {
            const memIndex = block.start + i;
            if (memIndex < this.totalMemorySize) {
                this.memory[memIndex] = pid;
            }
        }
        
        this.segments.push(segment);
        
        let process = this.processes.get(pid);
        if (!process) {
            process = {
                pid,
                name: processName,
                size: 0,
                segments: []
            };
            this.processes.set(pid, process);
        }
        
        process.segments.push(segment);
        process.size += size;
        
        this.stats.usedMemory += size;
        this.stats.freeMemory -= size;
        
        this.calculateExternalFragmentation();
        
        if (this.onLogEvent) {
            this.onLogEvent('info', `Allocated ${size} KB ${segmentType} segment to process ${processName} (PID: ${pid})`);
            if (this.stats.externalFragmentation > 0) {
                this.onLogEvent('info', `External fragmentation: ${this.stats.externalFragmentation} KB`);
            }
        }
        
        if (this.onMemoryChanged) {
            this.onMemoryChanged();
        }
        
        return true;
    }
    
    findBestFit(size) {
        const freeBlocks = this.findFreeBlocks();
        let bestFit = null;
        
        for (const block of freeBlocks) {
            if (block.size >= size) {
                if (!bestFit || block.size < bestFit.size) {
                    bestFit = block;
                }
            }
        }
        
        return bestFit;
    }
    
    findFreeBlocks() {
        const blocks = [];
        let currentBlock = null;
        
        for (let i = 0; i < this.totalMemorySize; i++) {
            if (this.memory[i] === null) {
                if (!currentBlock) {
                    currentBlock = {
                        start: i,
                        size: 1
                    };
                } else {
                    currentBlock.size++;
                }
            } else if (currentBlock) {
                blocks.push(currentBlock);
                currentBlock = null;
            }
        }
        
        if (currentBlock) {
            blocks.push(currentBlock);
        }
        
        return blocks;
    }
    
    compactMemory() {
        if (this.mode !== 'segmentation') return;
        
        const sortedSegments = [...this.segments].sort((a, b) => a.start - b.start);
        let currentPosition = 0;
        
        for (const segment of sortedSegments) {
            if (segment.start !== currentPosition) {
                const oldStart = segment.start;
                
                for (let i = 0; i < segment.size; i++) {
                    this.memory[currentPosition + i] = this.memory[oldStart + i];
                    this.memory[oldStart + i] = null;
                }
                
                segment.start = currentPosition;
            }
            
            currentPosition += segment.size;
        }
        
        this.calculateExternalFragmentation();
        
        if (this.onLogEvent) {
            this.onLogEvent('info', 'Memory compacted');
        }
        
        if (this.onMemoryChanged) {
            this.onMemoryChanged();
        }
    }
    
    calculateExternalFragmentation() {
        if (this.mode !== 'segmentation') return;
        
        const freeBlocks = this.findFreeBlocks();
        let totalFreeSpace = 0;
        let largestFreeBlock = 0;
        
        for (const block of freeBlocks) {
            totalFreeSpace += block.size;
            if (block.size > largestFreeBlock) {
                largestFreeBlock = block.size;
            }
        }
        
        this.stats.externalFragmentation = totalFreeSpace - largestFreeBlock;
    }
    
    deallocateMemory(pid) {
        const process = this.processes.get(pid);
        if (!process) return false;
        
        if (this.mode === 'paging') {
            return this.deallocateWithPaging(pid);
        } else {
            return this.deallocateWithSegmentation(process);
        }
    }
    
    deallocateWithPaging(pid) {
        const process = this.processes.get(pid);
        if (!process) {
            if (this.onLogEvent) {
                this.onLogEvent('error', `Process with PID ${pid} not found`);
            }
            return false;
        }
        
        for (const page of process.pages) {
            this.pageTable[page.frame] = null;
            
            for (let j = 0; j < this.pageSize; j++) {
                const memIndex = page.frame * this.pageSize + j;
                if (memIndex < this.totalMemorySize) {
                    this.memory[memIndex] = null;
                }
            }
        }
        
        this.stats.usedMemory -= process.size;
        this.stats.freeMemory += process.size;
        this.stats.internalFragmentation -= process.internalFragmentation;
        
        this.processes.delete(pid);
        
        if (this.onLogEvent) {
            this.onLogEvent('info', `Deallocated process ${process.name} (PID: ${pid})`);
        }
        
        if (this.onMemoryChanged) {
            this.onMemoryChanged();
        }
        
        return true;
    }
    
    deallocateWithSegmentation(process) {
        const { pid, name, size, segments } = process;
        
        for (const segment of segments) {
            for (let i = 0; i < segment.size; i++) {
                const memIndex = segment.start + i;
                if (memIndex < this.totalMemorySize) {
                    this.memory[memIndex] = null;
                }
            }
        }
        
        this.segments = this.segments.filter(segment => segment.pid !== pid);
        
        this.stats.usedMemory -= size;
        this.stats.freeMemory += size;
        
        this.calculateExternalFragmentation();
        
        this.processes.delete(pid);
        
        if (this.onLogEvent) {
            this.onLogEvent('info', `Deallocated ${size} KB (${segments.length} segments) from process ${name} (PID: ${pid})`);
        }
        
        if (this.onMemoryChanged) {
            this.onMemoryChanged();
        }
        
        return true;
    }
    
    simulatePageFault() {
        if (this.mode !== 'paging') return;
        
        this.stats.pageFaults++;
        
        if (this.onPageFault) {
            this.onPageFault();
        }
        
        if (this.onLogEvent) {
            this.onLogEvent('warning', 'Page fault simulated');
        }
    }
    
    simulateSegmentViolation() {
        if (this.mode !== 'segmentation') return;
        
        this.stats.segmentViolations++;
        
        if (this.onSegmentViolation) {
            this.onSegmentViolation();
        }
        
        if (this.onLogEvent) {
            this.onLogEvent('error', 'Segment violation simulated');
        }
    }
    
    getStats() {
        return {
            totalMemory: this.totalMemorySize,
            usedMemory: this.stats.usedMemory,
            freeMemory: this.stats.freeMemory,
            fragmentation: this.mode === 'paging' 
                ? this.stats.internalFragmentation 
                : this.stats.externalFragmentation,
            pageFaults: this.stats.pageFaults,
            segmentViolations: this.stats.segmentViolations
        };
    }
    
    getMemoryState() {
        return this.memory;
    }
    
    getPageTable() {
        return this.pageTable;
    }
    
    getSegments() {
        return this.segments;
    }
    
    getProcesses() {
        return this.processes;
    }
}

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = MemorySystem;
} else {
    window.MemorySystem = MemorySystem;
}