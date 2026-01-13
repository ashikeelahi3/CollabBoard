# Technical Architecture

## Tech Stack
- **Frontend**: Vanilla JavaScript (ES6 Modules), CSS Grid/Flexbox
- **Backend**: Node.js with ES Modules, Express.js
- **Database**: MongoDB with Mongoose ODM
- **Real-time**: Socket.io for WebSocket communication
- **Authentication**: JWT tokens with role-based access

## System Architecture

### Frontend Architecture
```
src/
├── modules/
│   ├── board.js          # Board management logic
│   ├── card.js           # Card operations and drag-drop
│   ├── socket.js         # WebSocket client management
│   ├── auth.js           # Authentication handling
│   └── utils.js          # Shared utilities
├── styles/
│   ├── main.css          # Core styles with CSS Grid
│   ├── board.css         # Board-specific styling
│   └── components.css    # Reusable component styles
└── index.html            # Single-page application entry
```

### Backend Architecture
```
server/
├── models/
│   ├── User.js           # User schema with roles
│   ├── Board.js          # Board schema with permissions
│   ├── Column.js         # Column schema
│   └── Card.js           # Card schema with history
├── routes/
│   ├── auth.js           # Authentication endpoints
│   ├── boards.js         # Board CRUD operations
│   └── cards.js          # Card management
├── middleware/
│   ├── auth.js           # JWT verification
│   └── permissions.js    # Role-based access control
├── socket/
│   └── handlers.js       # Socket.io event handlers
└── server.js             # Express app with Socket.io
```

## Database Schema Design

### User Model
```javascript
{
  _id: ObjectId,
  username: String,
  email: String,
  password: String (hashed),
  role: String, // 'admin', 'member', 'viewer'
  boards: [ObjectId] // References to Board documents
}
```

### Board Model
```javascript
{
  _id: ObjectId,
  title: String,
  description: String,
  owner: ObjectId, // Reference to User
  members: [{
    user: ObjectId,
    role: String // 'admin', 'member', 'viewer'
  }],
  columns: [ObjectId], // References to Column documents
  createdAt: Date,
  updatedAt: Date
}
```

### Column Model
```javascript
{
  _id: ObjectId,
  title: String,
  board: ObjectId, // Reference to Board
  position: Number, // For ordering
  cards: [ObjectId], // References to Card documents
  createdAt: Date
}
```

### Card Model
```javascript
{
  _id: ObjectId,
  title: String,
  description: String,
  column: ObjectId, // Reference to Column
  position: Number, // For ordering within column
  assignedTo: ObjectId, // Reference to User
  labels: [String],
  dueDate: Date,
  createdBy: ObjectId, // Reference to User
  createdAt: Date,
  updatedAt: Date,
  history: [{
    action: String, // 'created', 'moved', 'updated'
    user: ObjectId,
    timestamp: Date,
    details: Object
  }]
}
```