# CollabBoard - Complete Memory Bank

## Project Overview
CollabBoard is a real-time Kanban board application built with vanilla JavaScript, Node.js, MongoDB, and Socket.io. It demonstrates advanced full-stack development skills including real-time collaboration, drag-and-drop functionality, and role-based access control.

### Core Features
- **Real-time collaboration** with Socket.io WebSockets
- **Native drag-and-drop** using HTML5 API (no external libraries)
- **Role-based permissions** (Admin, Member, Viewer)
- **Modular ES6 architecture** with state management
- **JWT authentication** with secure token handling
- **MongoDB integration** with Mongoose ODM

## Tech Stack
- **Frontend**: Vanilla JavaScript (ES6 Modules), CSS Grid/Flexbox
- **Backend**: Node.js with Express.js
- **Database**: MongoDB with Mongoose ODM
- **Real-time**: Socket.io for WebSocket communication
- **Authentication**: JWT tokens with bcrypt password hashing

## Architecture Overview

### Frontend Structure
```
src/
├── modules/
│   ├── core/
│   │   ├── StateManager.js    # Centralized state management
│   │   ├── EventBus.js        # Component communication
│   │   ├── ApiClient.js       # HTTP client with auth
│   │   └── Router.js          # Client-side routing
│   ├── components/
│   │   ├── Board.js           # Main board component
│   │   ├── Column.js          # Column with drop zones
│   │   ├── Card.js            # Draggable card component
│   │   └── Modal.js           # Modal dialogs
│   └── services/
│       ├── SocketService.js   # WebSocket management
│       ├── AuthService.js     # Authentication handling
│       └── CacheService.js    # Client-side caching
```

### Backend Structure
```
server/
├── models/
│   ├── User.js               # User schema with roles
│   ├── Board.js              # Board with member permissions
│   ├── Column.js             # Column with card references
│   └── Card.js               # Card with history tracking
├── routes/
│   ├── auth.js               # Authentication endpoints
│   ├── boards.js             # Board CRUD operations
│   └── cards.js              # Card management
├── middleware/
│   ├── auth.js               # JWT verification
│   └── permissions.js        # Role-based access control
└── socket/
    └── handlers.js           # Real-time event handlers
```

## Database Schema

### User Model
```javascript
{
  _id: ObjectId,
  username: String (required, unique),
  email: String (required, unique),
  password: String (hashed with bcrypt),
  role: String (admin/member/viewer),
  boards: [ObjectId] // Board references
}
```

### Board Model
```javascript
{
  _id: ObjectId,
  title: String (required),
  description: String,
  owner: ObjectId (User reference),
  members: [{
    user: ObjectId,
    role: String (admin/member/viewer)
  }],
  columns: [ObjectId], // Column references
  createdAt: Date,
  updatedAt: Date
}
```

### Column Model
```javascript
{
  _id: ObjectId,
  title: String (required),
  board: ObjectId (Board reference),
  position: Number (for ordering),
  cards: [ObjectId] // Card references
}
```

### Card Model
```javascript
{
  _id: ObjectId,
  title: String (required, maxlength: 200),
  description: String,
  column: ObjectId (Column reference),
  position: Number (for ordering),
  assignedTo: ObjectId (User reference),
  labels: [String],
  dueDate: Date,
  checklist: [{
    text: String,
    completed: Boolean
  }],
  createdBy: ObjectId (User reference),
  history: [{
    action: String,
    user: ObjectId,
    timestamp: Date,
    details: Object
  }]
}
```

## Key Implementation Details

### State Management
- **Centralized StateManager** with subscription-based updates
- **Path-based state access** (e.g., `stateManager.get('ui.selectedCard')`)
- **Batch updates** for performance optimization
- **History tracking** for undo functionality
- **Optimistic updates** for better UX

### Real-Time Features
- **Socket.io rooms** for board-specific updates
- **JWT authentication** for socket connections
- **Event types**: card:moved, card:created, user:joined, user:left
- **Conflict resolution** with last-write-wins strategy
- **Position recalculation** to maintain consistency

### Drag and Drop
- **Native HTML5 API** implementation
- **Visual feedback** with CSS transitions
- **Touch device support** for mobile compatibility
- **Drop zone highlighting** and insertion indicators
- **Position calculation** based on mouse/touch coordinates

### Authentication & Authorization
- **Role hierarchy**: Admin > Member > Viewer
- **Permission matrix** for different operations
- **JWT tokens** with 24-hour expiration
- **Board-level permissions** with member roles
- **Secure password hashing** with bcrypt (12 salt rounds)

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout

### Boards
- `GET /api/boards` - Get user's boards
- `POST /api/boards` - Create new board
- `GET /api/boards/:id` - Get board details
- `PUT /api/boards/:id` - Update board
- `DELETE /api/boards/:id` - Delete board

### Cards
- `POST /api/boards/:boardId/cards` - Create card
- `PUT /api/cards/:id` - Update card
- `PUT /api/cards/:id/move` - Move card between columns
- `DELETE /api/cards/:id` - Delete card

## Socket Events

### Client to Server
- `board:join` - Join board room
- `card:move` - Move card between columns
- `card:create` - Create new card
- `card:update` - Update card details

### Server to Client
- `card:moved` - Card position changed
- `card:created` - New card added
- `card:updated` - Card details modified
- `user:joined` - User joined board
- `user:left` - User left board

## Testing Strategy

### Unit Tests (Jest/Vitest)
- **Model validation** and methods
- **Service layer** business logic
- **Component rendering** and interactions
- **Utility functions** and helpers

### Integration Tests
- **API endpoints** with test database
- **Socket event handling** and real-time updates
- **Authentication flow** and permissions
- **Database operations** and relationships

### E2E Tests (Playwright)
- **User workflows** (login, create board, move cards)
- **Real-time collaboration** between multiple users
- **Drag and drop** functionality across browsers
- **Responsive design** on different devices

## Performance Optimizations

### Frontend
- **Component lifecycle** management with cleanup
- **Event delegation** for dynamic elements
- **Debounced API calls** for search and filters
- **Virtual scrolling** for large card lists
- **CSS animations** with GPU acceleration

### Backend
- **Database indexing** on frequently queried fields
- **Connection pooling** for MongoDB
- **Rate limiting** on API endpoints
- **Caching strategies** for board data
- **Optimized queries** with population limits

### Real-Time
- **Room-based broadcasting** to reduce network traffic
- **Event batching** for multiple rapid changes
- **Connection management** with reconnection logic
- **Memory cleanup** for disconnected users

## Security Measures

### Authentication
- **Password complexity** requirements
- **Rate limiting** on login attempts
- **Token expiration** and rotation
- **Secure cookie** configuration

### Authorization
- **Role-based permissions** at API level
- **Board access control** verification
- **Input validation** and sanitization
- **SQL injection** prevention with Mongoose

### Data Protection
- **HTTPS enforcement** in production
- **CORS configuration** for allowed origins
- **Content Security Policy** headers
- **Environment variable** protection

## Deployment Considerations

### Environment Setup
- **Node.js version** compatibility (16+)
- **MongoDB connection** string configuration
- **JWT secret** generation and storage
- **Socket.io CORS** settings for production

### Production Optimizations
- **Process management** with PM2
- **Load balancing** for multiple instances
- **Database replica sets** for high availability
- **CDN integration** for static assets
- **Monitoring and logging** setup

## Common Patterns and Best Practices

### Code Organization
- **ES6 modules** with clear dependencies
- **Single responsibility** principle for components
- **Consistent naming** conventions
- **Error handling** with try-catch blocks

### State Management
- **Immutable updates** to prevent side effects
- **Subscription cleanup** to prevent memory leaks
- **Batch operations** for performance
- **State normalization** for complex data

### Real-Time Updates
- **Optimistic UI updates** for responsiveness
- **Conflict resolution** strategies
- **Connection state** management
- **Graceful degradation** when offline

This Memory Bank serves as a comprehensive reference for understanding and working with the CollabBoard project. It covers all major aspects from architecture to implementation details, providing the context needed for effective development and maintenance.