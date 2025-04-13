document.addEventListener('DOMContentLoaded', () => {
    const memorySystem = new MemorySystem(64, 4);
    const ui = new UIHandler(memorySystem);
    
    const pagingBtn = document.getElementById('pagingBtn');
    const segmentationBtn = document.getElementById('segmentationBtn');
    const allocateBtn = document.getElementById('allocateBtn');
    const deallocateBtn = document.getElementById('deallocateBtn');
    const processSize = document.getElementById('processSize');
    const processName = document.getElementById('processName');
    const segmentType = document.getElementById('segmentType');
    const segmentationOnly = document.querySelectorAll('.segmentation-only');
    
    pagingBtn.addEventListener('click', () => {
        pagingBtn.classList.add('active');
        segmentationBtn.classList.remove('active');
        memorySystem.setMode('paging');
        
        segmentationOnly.forEach(el => el.classList.add('d-none'));
    });
    
    segmentationBtn.addEventListener('click', () => {
        segmentationBtn.classList.add('active');
        pagingBtn.classList.remove('active');
        memorySystem.setMode('segmentation');
        
        segmentationOnly.forEach(el => el.classList.remove('d-none'));
    });
    
    allocateBtn.addEventListener('click', () => {
        const size = parseInt(processSize.value, 10);
        const name = processName.value.trim() || `Process ${Math.floor(Math.random() * 1000)}`;
        const segment = segmentType.value;
        
        if (isNaN(size) || size <= 0) {
            alert('Please enter a valid size');
            return;
        }
        
        const success = memorySystem.allocateMemory(name, size, segment);
        
        if (success) {
            const match = name.match(/Process (\d+)/);
            if (match) {
                const num = parseInt(match[1], 10);
                processName.value = `Process ${num + 1}`;
            } else {
                processName.value = `Process ${Math.floor(Math.random() * 1000)}`;
            }
        }
    });
    
    deallocateBtn.addEventListener('click', () => {
        if (!ui.selectedBlock || !ui.selectedBlock.pid) {
            alert('Please select an allocated memory block first');
            return;
        }
        
        memorySystem.deallocateMemory(ui.selectedBlock.pid);
        ui.selectedBlock = null;
        deallocateBtn.disabled = true;
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'f' && memorySystem.mode === 'paging') {
            memorySystem.simulatePageFault();
        }
        
        if (e.key === 'v' && memorySystem.mode === 'segmentation') {
            memorySystem.simulateSegmentViolation();
        }
        
        if (e.key === 'c' && memorySystem.mode === 'segmentation') {
            memorySystem.compactMemory();
            ui.addLogEntry('info', 'Memory compaction triggered manually');
        }
    });
    
    function resizeCanvas() {
        const canvas = document.getElementById('memoryCanvas');
        const container = canvas.parentElement;
        
        canvas.width = container.clientWidth;
        canvas.height = 400;
        
        ui.renderMemory();
    }
    
    window.addEventListener('resize', resizeCanvas);
    
    resizeCanvas();
    
    setTimeout(() => {
        memorySystem.allocateMemory('OS Kernel', 8);
        memorySystem.allocateMemory('Browser', 12);
        memorySystem.allocateMemory('Editor', 6);
        
        ui.addLogEntry('info', 'Memory Allocation Tracker initialized with sample processes');
        ui.addLogEntry('info', 'Keyboard shortcuts: F = Page fault, V = Segment violation, C = Compact memory');
    }, 500);
});