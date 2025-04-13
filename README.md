# Real-Time Memory Allocation Tracker

A web-based visualization tool for OS memory management techniques, demonstrating paging and segmentation in real-time.

## Overview

This interactive application simulates how operating systems manage memory through two fundamental techniques:

- **Paging**: Divides logical memory into fixed-size pages and physical memory into frames
- **Segmentation**: Organizes memory into variable-sized segments (code, data, stack, etc.)

The tool provides a visual representation of memory allocation and deallocation, helping students and developers understand these core OS concepts.

## Features

- Real-time visualization of memory allocation and deallocation
- Support for both paging and segmentation memory management techniques
- Interactive UI to view memory contents, page/frame mappings, and segment information
- Simulation of page faults and segment violations
- Memory compaction for segmentation mode
- Detailed memory event logging
- Statistics on memory usage and fragmentation
- Color-coded processes for easy identification

## How to Use

1. **Open the application**: Simply open `index.html` in a web browser.

2. **Switch Memory Models**:
   - Click "Paging" or "Segmentation" in the upper controls to switch between memory management models.

3. **Allocate Memory**:
   - Enter a process size (in KB)
   - Provide a process name
   - In segmentation mode, select a segment type (code, data, stack, heap)
   - Click "Allocate Memory"

4. **Deallocate Memory**:
   - Click on any allocated memory block to select it
   - Click "Deallocate Selected" to free the memory

5. **Simulation Features**:
   - Press `F` key to simulate a page fault (paging mode only)
   - Press `V` key to simulate a segment violation (segmentation mode only)
   - Press `C` key to compact memory (segmentation mode only)

6. **Explore Memory**:
   - Hover over memory blocks to see detailed information
   - Click on blocks to select them
   - View the memory events log at the bottom of the screen

## Technical Details

The application is built with standard web technologies:

- HTML5 for structure
- CSS3 for styling
- JavaScript for functionality
- Canvas API for memory visualization

The codebase is organized into three main modules:

1. **Memory System** (`memory.js`): Core logic for memory management algorithms
2. **UI Handler** (`ui.js`): Visualization and user interaction management
3. **Application** (`app.js`): Initialization and event handling

## Learning Value

This tool helps illustrate important OS memory management concepts:

- How pages are mapped to frames in paging
- Base and limit registers in segmentation
- Internal fragmentation in paging
- External fragmentation in segmentation
- Memory compaction techniques
- Page faults and segment violations

## Future Enhancements

- Additional memory allocation algorithms (best-fit, worst-fit, first-fit)
- Virtual memory and page replacement algorithms
- Multi-level page tables
- Dynamic page/frame size adjustment
- Memory protection simulation
- Performance metrics and comparisons between techniques 