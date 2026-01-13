# Testing Strategy & Implementation

## Testing Pyramid Structure

### Testing Levels
```
    ┌─────────────────┐
    │   E2E Tests     │  ← Few, High-level, Slow
    │   (Playwright)  │
    ├─────────────────┤
    │ Integration     │  ← Some, API + DB, Medium
    │ Tests (Jest)    │
    ├─────────────────┤
    │   Unit Tests    │  ← Many, Fast, Isolated
    │   (Jest/Vitest) │
    └─────────────────┘
```

## Unit Testing

### Backend Unit Tests
```javascript
// tests/unit/models/Card.test.js - Model unit tests
const mongoose = require('mongoose');
const Card = require('../../../server/models/Card');
const { MongoMemoryServer } = require('mongodb-memory-server');

describe('Card Model', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Card.deleteMany({});
  });

  describe('Card Creation', () => {
    it('should create a card with valid data', async () => {
      const cardData = {
        title: 'Test Card',
        description: 'Test Description',
        column: new mongoose.Types.ObjectId(),
        position: 0,
        createdBy: new mongoose.Types.ObjectId()
      };

      const card = new Card(cardData);
      const savedCard = await card.save();

      expect(savedCard._id).toBeDefined();
      expect(savedCard.title).toBe(cardData.title);
      expect(savedCard.description).toBe(cardData.description);
      expect(savedCard.position).toBe(0);
      expect(savedCard.createdAt).toBeDefined();
    });

    it('should fail to create card without required fields', async () => {
      const card = new Card({});
      
      await expect(card.save()).rejects.toThrow();
    });

    it('should validate title length', async () => {
      const cardData = {
        title: 'a'.repeat(201), // Exceeds maxlength
        column: new mongoose.Types.ObjectId(),
        position: 0,
        createdBy: new mongoose.Types.ObjectId()
      };

      const card = new Card(cardData);
      await expect(card.save()).rejects.toThrow();
    });
  });

  describe('Card Methods', () => {
    it('should calculate completion percentage correctly', async () => {
      const card = new Card({
        title: 'Test Card',
        column: new mongoose.Types.ObjectId(),
        position: 0,
        createdBy: new mongoose.Types.ObjectId(),
        checklist: [
          { text: 'Task 1', completed: true },
          { text: 'Task 2', completed: false },
          { text: 'Task 3', completed: true }
        ]
      });

      expect(card.completionPercentage).toBe(67); // 2/3 * 100
    });

    it('should return 0% for empty checklist', async () => {
      const card = new Card({
        title: 'Test Card',
        column: new mongoose.Types.ObjectId(),
        position: 0,
        createdBy: new mongoose.Types.ObjectId(),
        checklist: []
      });

      expect(card.completionPercentage).toBe(0);
    });
  });
});
```

### Service Layer Unit Tests
```javascript
// tests/unit/services/CardService.test.js - Service unit tests
const CardService = require('../../../server/services/CardService');
const Card = require('../../../server/models/Card');
const Column = require('../../../server/models/Column');

// Mock the models
jest.mock('../../../server/models/Card');
jest.mock('../../../server/models/Column');

describe('CardService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('moveCard', () => {
    it('should move card between columns successfully', async () => {
      const mockCard = {
        _id: 'card1',
        column: 'column1',
        position: 0,
        save: jest.fn().mockResolvedValue(true)
      };

      const mockSourceColumn = {
        _id: 'column1',
        cards: ['card1', 'card2'],
        save: jest.fn().mockResolvedValue(true)
      };

      const mockTargetColumn = {
        _id: 'column2',
        cards: ['card3'],
        save: jest.fn().mockResolvedValue(true)
      };

      Card.findById.mockResolvedValue(mockCard);
      Column.findById
        .mockResolvedValueOnce(mockSourceColumn)
        .mockResolvedValueOnce(mockTargetColumn);

      const result = await CardService.moveCard('card1', 'column2', 1, 'user1');

      expect(Card.findById).toHaveBeenCalledWith('card1');
      expect(Column.findById).toHaveBeenCalledWith('column1');
      expect(Column.findById).toHaveBeenCalledWith('column2');
      expect(mockCard.column).toBe('column2');
      expect(mockCard.position).toBe(1);
      expect(mockCard.save).toHaveBeenCalled();
    });

    it('should throw error if card not found', async () => {
      Card.findById.mockResolvedValue(null);

      await expect(
        CardService.moveCard('nonexistent', 'column2', 1, 'user1')
      ).rejects.toThrow('Card not found');
    });

    it('should handle position recalculation', async () => {
      const mockCards = [
        { _id: 'card1', position: 0, save: jest.fn() },
        { _id: 'card2', position: 2, save: jest.fn() },
        { _id: 'card3', position: 3, save: jest.fn() }
      ];

      Card.find.mockResolvedValue(mockCards);

      await CardService.recalculatePositions('column1');

      expect(mockCards[0].position).toBe(0);
      expect(mockCards[1].position).toBe(1);
      expect(mockCards[2].position).toBe(2);
      expect(mockCards[1].save).toHaveBeenCalled();
      expect(mockCards[2].save).toHaveBeenCalled();
    });
  });
});
```

### Frontend Unit Tests
```javascript
// tests/unit/components/Card.test.js - Frontend component tests
import { Card } from '../../../src/modules/components/Card.js';
import { stateManager } from '../../../src/modules/core/StateManager.js';

// Mock dependencies
jest.mock('../../../src/modules/core/StateManager.js');
jest.mock('../../../src/modules/services/SocketService.js');

describe('Card Component', () => {
  let container;
  let mockCardData;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);

    mockCardData = {
      _id: 'card1',
      title: 'Test Card',
      description: 'Test Description',
      column: 'column1',
      position: 0,
      assignedTo: [{ username: 'testuser' }],
      dueDate: new Date('2024-12-31')
    };

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('should render card with correct data', () => {
    const card = new Card(container, { cardData: mockCardData });

    expect(container.querySelector('.card-title').textContent).toBe('Test Card');
    expect(container.querySelector('.card-description').textContent).toBe('Test Description');
    expect(container.querySelector('.card-assignee').textContent).toBe('testuser');
  });

  it('should make card draggable', () => {
    const card = new Card(container, { cardData: mockCardData });
    const cardElement = container.querySelector('.card');

    expect(cardElement.draggable).toBe(true);
    expect(cardElement.dataset.cardId).toBe('card1');
  });

  it('should handle drag start event', () => {
    const card = new Card(container, { cardData: mockCardData });
    const cardElement = container.querySelector('.card');

    const mockDataTransfer = {
      setData: jest.fn(),
      setDragImage: jest.fn(),
      effectAllowed: ''
    };

    const dragEvent = new Event('dragstart');
    dragEvent.dataTransfer = mockDataTransfer;

    cardElement.dispatchEvent(dragEvent);

    expect(mockDataTransfer.setData).toHaveBeenCalledWith('text/plain', 'card1');
    expect(mockDataTransfer.setData).toHaveBeenCalledWith(
      'application/json',
      expect.stringContaining('card1')
    );
    expect(cardElement.classList.contains('dragging')).toBe(true);
  });

  it('should handle card edit', () => {
    const card = new Card(container, { cardData: mockCardData });
    const editBtn = container.querySelector('.edit-btn');

    const clickEvent = new Event('click');
    editBtn.dispatchEvent(clickEvent);

    // Should emit modal open event
    expect(stateManager.set).toHaveBeenCalledWith(
      'ui.selectedCard',
      mockCardData
    );
  });

  it('should update when card data changes', () => {
    const card = new Card(container, { cardData: mockCardData });
    
    // Simulate state change
    const updatedCardData = { ...mockCardData, title: 'Updated Title' };
    card.updateCardData(updatedCardData);

    expect(container.querySelector('.card-title').textContent).toBe('Updated Title');
  });
});
```

## Integration Testing

### API Integration Tests
```javascript
// tests/integration/api/boards.test.js - API integration tests
const request = require('supertest');
const app = require('../../../server/app');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../../../server/models/User');
const Board = require('../../../server/models/Board');
const { generateToken } = require('../../../server/middleware/auth');

describe('Boards API', () => {
  let mongoServer;
  let testUser;
  let authToken;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear database
    await User.deleteMany({});
    await Board.deleteMany({});

    // Create test user
    testUser = new User({
      username: 'testuser',
      email: 'test@example.com',
      password: 'hashedpassword',
      role: 'member'
    });
    await testUser.save();

    authToken = generateToken(testUser);
  });

  describe('POST /api/boards', () => {
    it('should create a new board', async () => {
      const boardData = {
        title: 'Test Board',
        description: 'Test Description'
      };

      const response = await request(app)
        .post('/api/boards')
        .set('Authorization', `Bearer ${authToken}`)
        .send(boardData)
        .expect(201);

      expect(response.body.board.title).toBe(boardData.title);
      expect(response.body.board.description).toBe(boardData.description);
      expect(response.body.board.owner).toBe(testUser._id.toString());
    });

    it('should reject board creation without auth', async () => {
      const boardData = {
        title: 'Test Board',
        description: 'Test Description'
      };

      await request(app)
        .post('/api/boards')
        .send(boardData)
        .expect(401);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/boards')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body.error).toContain('title');
    });
  });

  describe('GET /api/boards/:id', () => {
    let testBoard;

    beforeEach(async () => {
      testBoard = new Board({
        title: 'Test Board',
        description: 'Test Description',
        owner: testUser._id
      });
      await testBoard.save();
    });

    it('should get board by id', async () => {
      const response = await request(app)
        .get(`/api/boards/${testBoard._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.board.title).toBe(testBoard.title);
      expect(response.body.board._id).toBe(testBoard._id.toString());
    });

    it('should return 404 for non-existent board', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      
      await request(app)
        .get(`/api/boards/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should deny access to unauthorized board', async () => {
      const otherUser = new User({
        username: 'otheruser',
        email: 'other@example.com',
        password: 'hashedpassword'
      });
      await otherUser.save();

      const otherToken = generateToken(otherUser);

      await request(app)
        .get(`/api/boards/${testBoard._id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);
    });
  });
});
```

### WebSocket Integration Tests
```javascript
// tests/integration/socket/board.test.js - Socket.io integration tests
const Client = require('socket.io-client');
const server = require('../../../server/server');
const { generateToken } = require('../../../server/middleware/auth');
const User = require('../../../server/models/User');
const Board = require('../../../server/models/Board');

describe('Board Socket Events', () => {
  let serverSocket;
  let clientSocket1;
  let clientSocket2;
  let testUser1;
  let testUser2;
  let testBoard;

  beforeAll(async () => {
    // Create test users
    testUser1 = new User({
      username: 'user1',
      email: 'user1@example.com',
      password: 'password'
    });
    await testUser1.save();

    testUser2 = new User({
      username: 'user2',
      email: 'user2@example.com',
      password: 'password'
    });
    await testUser2.save();

    // Create test board
    testBoard = new Board({
      title: 'Test Board',
      owner: testUser1._id,
      members: [{ user: testUser2._id, role: 'member' }]
    });
    await testBoard.save();
  });

  beforeEach((done) => {
    server.listen(() => {
      const port = server.address().port;
      
      // Connect first client
      clientSocket1 = new Client(`http://localhost:${port}`, {
        auth: { token: generateToken(testUser1) }
      });

      // Connect second client
      clientSocket2 = new Client(`http://localhost:${port}`, {
        auth: { token: generateToken(testUser2) }
      });

      let connectedClients = 0;
      const checkConnections = () => {
        connectedClients++;
        if (connectedClients === 2) {
          done();
        }
      };

      clientSocket1.on('connect', checkConnections);
      clientSocket2.on('connect', checkConnections);
    });
  });

  afterEach(() => {
    server.close();
    clientSocket1.close();
    clientSocket2.close();
  });

  it('should allow users to join board room', (done) => {
    clientSocket1.emit('board:join', testBoard._id.toString());
    
    clientSocket2.on('user:joined', (data) => {
      expect(data.userId).toBe(testUser1._id.toString());
      expect(data.username).toBe('user1');
      done();
    });

    clientSocket2.emit('board:join', testBoard._id.toString());
  });

  it('should broadcast card moves to all board members', (done) => {
    const cardMoveData = {
      cardId: 'card123',
      sourceColumnId: 'column1',
      targetColumnId: 'column2',
      position: 1,
      boardId: testBoard._id.toString()
    };

    // Both clients join the board
    clientSocket1.emit('board:join', testBoard._id.toString());
    clientSocket2.emit('board:join', testBoard._id.toString());

    // Client 2 listens for card move
    clientSocket2.on('card:moved', (data) => {
      expect(data.cardId).toBe(cardMoveData.cardId);
      expect(data.targetColumnId).toBe(cardMoveData.targetColumnId);
      expect(data.movedBy).toBe(testUser1._id.toString());
      done();
    });

    // Client 1 moves a card
    setTimeout(() => {
      clientSocket1.emit('card:move', cardMoveData);
    }, 100);
  });

  it('should reject unauthorized board access', (done) => {
    const unauthorizedUser = new User({
      username: 'unauthorized',
      email: 'unauth@example.com',
      password: 'password'
    });

    const unauthorizedClient = new Client(`http://localhost:${server.address().port}`, {
      auth: { token: generateToken(unauthorizedUser) }
    });

    unauthorizedClient.on('error', (error) => {
      expect(error.message).toContain('Access denied');
      unauthorizedClient.close();
      done();
    });

    unauthorizedClient.emit('board:join', testBoard._id.toString());
  });
});
```

## End-to-End Testing

### Playwright E2E Tests
```javascript
// tests/e2e/board-collaboration.spec.js - E2E tests with Playwright
const { test, expect } = require('@playwright/test');

test.describe('Board Collaboration', () => {
  let page1, page2;
  let context1, context2;

  test.beforeAll(async ({ browser }) => {
    // Create two browser contexts for different users
    context1 = await browser.newContext();
    context2 = await browser.newContext();
    
    page1 = await context1.newPage();
    page2 = await context2.newPage();
  });

  test.afterAll(async () => {
    await context1.close();
    await context2.close();
  });

  test('should allow real-time card movement between users', async () => {
    // User 1 logs in and creates a board
    await page1.goto('/login');
    await page1.fill('[data-testid="email"]', 'user1@example.com');
    await page1.fill('[data-testid="password"]', 'password123');
    await page1.click('[data-testid="login-btn"]');
    
    await page1.waitForURL('/dashboard');
    await page1.click('[data-testid="create-board-btn"]');
    await page1.fill('[data-testid="board-title"]', 'Collaboration Test Board');
    await page1.click('[data-testid="create-btn"]');
    
    // Get board URL
    await page1.waitForURL(/\/board\/.+/);
    const boardUrl = page1.url();

    // User 2 logs in and joins the same board
    await page2.goto('/login');
    await page2.fill('[data-testid="email"]', 'user2@example.com');
    await page2.fill('[data-testid="password"]', 'password123');
    await page2.click('[data-testid="login-btn"]');
    
    await page2.goto(boardUrl);

    // User 1 creates a card
    await page1.click('[data-testid="add-card-btn"]');
    await page1.fill('[data-testid="card-title"]', 'Test Card');
    await page1.click('[data-testid="save-card-btn"]');

    // Verify card appears for both users
    await expect(page1.locator('[data-testid="card"]').first()).toContainText('Test Card');
    await expect(page2.locator('[data-testid="card"]').first()).toContainText('Test Card');

    // User 1 drags card to different column
    const card = page1.locator('[data-testid="card"]').first();
    const targetColumn = page1.locator('[data-testid="column"]').nth(1);
    
    await card.dragTo(targetColumn);

    // Verify card moved for both users
    const targetColumnCards1 = page1.locator('[data-testid="column"]').nth(1).locator('[data-testid="card"]');
    const targetColumnCards2 = page2.locator('[data-testid="column"]').nth(1).locator('[data-testid="card"]');
    
    await expect(targetColumnCards1).toHaveCount(1);
    await expect(targetColumnCards2).toHaveCount(1);
    await expect(targetColumnCards2.first()).toContainText('Test Card');
  });

  test('should show user presence indicators', async () => {
    // Both users on the same board
    await page1.goto('/board/test-board-id');
    await page2.goto('/board/test-board-id');

    // Verify presence indicators
    await expect(page1.locator('[data-testid="user-avatar"]')).toHaveCount(2);
    await expect(page2.locator('[data-testid="user-avatar"]')).toHaveCount(2);

    // User 2 leaves
    await page2.close();

    // Verify presence updated for user 1
    await expect(page1.locator('[data-testid="user-avatar"]')).toHaveCount(1);
  });

  test('should handle concurrent card editing', async () => {
    await page1.goto('/board/test-board-id');
    await page2.goto('/board/test-board-id');

    // Both users try to edit the same card
    const card1 = page1.locator('[data-testid="card"]').first();
    const card2 = page2.locator('[data-testid="card"]').first();

    await card1.click();
    await card2.click();

    // First user should get edit access
    await expect(page1.locator('[data-testid="card-editor"]')).toBeVisible();
    
    // Second user should see "being edited" indicator
    await expect(page2.locator('[data-testid="card-locked"]')).toBeVisible();
  });
});
```

## Test Configuration

### Jest Configuration
```javascript
// jest.config.js - Jest test configuration
module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: [
    '<rootDir>/tests/**/*.test.js',
    '<rootDir>/tests/**/*.spec.js'
  ],
  collectCoverageFrom: [
    'server/**/*.js',
    'src/**/*.js',
    '!server/server.js',
    '!**/node_modules/**',
    '!**/tests/**'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  testTimeout: 10000,
  verbose: true
};
```

### Test Setup
```javascript
// tests/setup.js - Global test setup
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Global test database setup
let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

// Mock console methods in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Mock WebSocket for frontend tests
global.WebSocket = jest.fn(() => ({
  send: jest.fn(),
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn()
}));

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};
global.localStorage = localStorageMock;
```

### Playwright Configuration
```javascript
// playwright.config.js - Playwright E2E configuration
module.exports = {
  testDir: './tests/e2e',
  timeout: 30000,
  expect: {
    timeout: 5000
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] }
    }
  ],
  webServer: {
    command: 'npm run start:test',
    port: 3000,
    reuseExistingServer: !process.env.CI
  }
};
```