# Drag and Drop Implementation

## Native HTML5 Drag and Drop API

### Card Component with Drag Support
```javascript
// modules/card.js - Card drag and drop implementation
class Card {
  constructor(cardData, columnElement) {
    this.data = cardData;
    this.columnElement = columnElement;
    this.element = this.createElement();
    this.setupDragHandlers();
  }

  createElement() {
    const cardElement = document.createElement('div');
    cardElement.className = 'card';
    cardElement.draggable = true;
    cardElement.dataset.cardId = this.data._id;
    
    cardElement.innerHTML = `
      <div class="card-header">
        <h3 class="card-title">${this.data.title}</h3>
        <div class="card-actions">
          <button class="edit-btn">✏️</button>
          <button class="delete-btn">🗑️</button>
        </div>
      </div>
      <p class="card-description">${this.data.description || ''}</p>
      <div class="card-footer">
        <span class="card-assignee">${this.data.assignedTo?.username || ''}</span>
        <span class="card-due-date">${this.formatDate(this.data.dueDate)}</span>
      </div>
    `;

    return cardElement;
  }

  setupDragHandlers() {
    this.element.addEventListener('dragstart', this.handleDragStart.bind(this));
    this.element.addEventListener('dragend', this.handleDragEnd.bind(this));
  }

  handleDragStart(e) {
    // Store card data for drop handler
    e.dataTransfer.setData('text/plain', this.data._id);
    e.dataTransfer.setData('application/json', JSON.stringify({
      cardId: this.data._id,
      sourceColumnId: this.data.column,
      sourcePosition: this.data.position
    }));

    // Visual feedback
    this.element.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';

    // Create custom drag image
    const dragImage = this.element.cloneNode(true);
    dragImage.style.transform = 'rotate(5deg)';
    dragImage.style.opacity = '0.8';
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 0, 0);
    
    setTimeout(() => document.body.removeChild(dragImage), 0);
  }

  handleDragEnd(e) {
    this.element.classList.remove('dragging');
  }
}
```

### Column Component with Drop Support
```javascript
// modules/column.js - Column drop zone implementation
class Column {
  constructor(columnData, boardElement) {
    this.data = columnData;
    this.boardElement = boardElement;
    this.element = this.createElement();
    this.cards = new Map();
    this.setupDropHandlers();
  }

  createElement() {
    const columnElement = document.createElement('div');
    columnElement.className = 'column';
    columnElement.dataset.columnId = this.data._id;
    
    columnElement.innerHTML = `
      <div class="column-header">
        <h2 class="column-title">${this.data.title}</h2>
        <span class="card-count">${this.data.cards.length}</span>
      </div>
      <div class="column-body" data-drop-zone="true">
        <!-- Cards will be inserted here -->
      </div>
      <div class="column-footer">
        <button class="add-card-btn">+ Add Card</button>
      </div>
    `;

    return columnElement;
  }

  setupDropHandlers() {
    const dropZone = this.element.querySelector('.column-body');
    
    dropZone.addEventListener('dragover', this.handleDragOver.bind(this));
    dropZone.addEventListener('dragenter', this.handleDragEnter.bind(this));
    dropZone.addEventListener('dragleave', this.handleDragLeave.bind(this));
    dropZone.addEventListener('drop', this.handleDrop.bind(this));
  }

  handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    // Calculate insertion position
    const afterElement = this.getDragAfterElement(e.clientY);
    const draggingCard = document.querySelector('.dragging');
    
    if (afterElement == null) {
      this.element.querySelector('.column-body').appendChild(draggingCard);
    } else {
      this.element.querySelector('.column-body').insertBefore(draggingCard, afterElement);
    }
  }

  handleDragEnter(e) {
    e.preventDefault();
    this.element.classList.add('drag-over');
  }

  handleDragLeave(e) {
    if (!this.element.contains(e.relatedTarget)) {
      this.element.classList.remove('drag-over');
    }
  }

  handleDrop(e) {
    e.preventDefault();
    this.element.classList.remove('drag-over');

    try {
      const dragData = JSON.parse(e.dataTransfer.getData('application/json'));
      const newPosition = this.calculateDropPosition(e.clientY);
      
      // Only process if card moved to different column or position
      if (dragData.sourceColumnId !== this.data._id || 
          dragData.sourcePosition !== newPosition) {
        
        this.handleCardMove(dragData.cardId, dragData.sourceColumnId, newPosition);
      }
    } catch (error) {
      console.error('Drop handling error:', error);
    }
  }

  getDragAfterElement(y) {
    const draggableElements = [...this.element.querySelectorAll('.card:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      
      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }

  calculateDropPosition(y) {
    const cards = this.element.querySelectorAll('.card');
    let position = 0;
    
    for (let card of cards) {
      const rect = card.getBoundingClientRect();
      if (y > rect.top + rect.height / 2) {
        position++;
      } else {
        break;
      }
    }
    
    return position;
  }

  async handleCardMove(cardId, sourceColumnId, newPosition) {
    try {
      // Optimistic update
      this.updateCardPositionLocally(cardId, newPosition);
      
      // Send to server via WebSocket
      window.socketManager.emitCardMove(
        cardId, 
        sourceColumnId, 
        this.data._id, 
        newPosition
      );
      
    } catch (error) {
      // Revert optimistic update on error
      this.revertCardMove(cardId, sourceColumnId);
      console.error('Card move failed:', error);
    }
  }
}
```

## Drag and Drop Visual Feedback

### CSS for Drag States
```css
/* Card drag states */
.card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  cursor: grab;
}

.card:active {
  cursor: grabbing;
}

.card.dragging {
  opacity: 0.5;
  transform: rotate(5deg);
  z-index: 1000;
}

/* Column drop states */
.column.drag-over {
  background-color: #f0f8ff;
  border: 2px dashed #4a90e2;
}

.column.drag-over .column-body {
  background-color: rgba(74, 144, 226, 0.1);
}

/* Drop insertion indicator */
.drop-indicator {
  height: 2px;
  background-color: #4a90e2;
  margin: 4px 0;
  border-radius: 1px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.drop-indicator.active {
  opacity: 1;
}
```

## Touch Device Support

### Touch Event Handlers
```javascript
// Touch support for mobile devices
class TouchDragHandler {
  constructor(cardElement) {
    this.cardElement = cardElement;
    this.isDragging = false;
    this.startPosition = { x: 0, y: 0 };
    this.setupTouchHandlers();
  }

  setupTouchHandlers() {
    this.cardElement.addEventListener('touchstart', this.handleTouchStart.bind(this));
    this.cardElement.addEventListener('touchmove', this.handleTouchMove.bind(this));
    this.cardElement.addEventListener('touchend', this.handleTouchEnd.bind(this));
  }

  handleTouchStart(e) {
    const touch = e.touches[0];
    this.startPosition = { x: touch.clientX, y: touch.clientY };
    this.isDragging = true;
    this.cardElement.classList.add('touch-dragging');
  }

  handleTouchMove(e) {
    if (!this.isDragging) return;
    
    e.preventDefault();
    const touch = e.touches[0];
    
    // Move card with finger
    this.cardElement.style.transform = `translate(${
      touch.clientX - this.startPosition.x
    }px, ${
      touch.clientY - this.startPosition.y
    }px)`;
    
    // Find drop target
    const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
    const dropZone = elementBelow?.closest('[data-drop-zone]');
    
    if (dropZone) {
      dropZone.classList.add('touch-drag-over');
    }
  }

  handleTouchEnd(e) {
    if (!this.isDragging) return;
    
    this.isDragging = false;
    this.cardElement.classList.remove('touch-dragging');
    this.cardElement.style.transform = '';
    
    // Process drop
    const touch = e.changedTouches[0];
    const dropTarget = document.elementFromPoint(touch.clientX, touch.clientY);
    const dropZone = dropTarget?.closest('[data-drop-zone]');
    
    if (dropZone) {
      this.processTouchDrop(dropZone);
    }
    
    // Clean up visual feedback
    document.querySelectorAll('.touch-drag-over').forEach(el => {
      el.classList.remove('touch-drag-over');
    });
  }
}
```