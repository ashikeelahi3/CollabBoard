# Authentication & Authorization

## Role-Based Access Control (RBAC)

### User Roles Hierarchy
```javascript
const ROLES = {
  ADMIN: 'admin',     // Full access: create/delete boards, manage users
  MEMBER: 'member',   // Board access: create/move/edit cards
  VIEWER: 'viewer'    // Read-only: view boards and cards
};

const PERMISSIONS = {
  // Board permissions
  CREATE_BOARD: ['admin'],
  DELETE_BOARD: ['admin'],
  UPDATE_BOARD: ['admin', 'member'],
  VIEW_BOARD: ['admin', 'member', 'viewer'],
  
  // Card permissions
  CREATE_CARD: ['admin', 'member'],
  MOVE_CARD: ['admin', 'member'],
  UPDATE_CARD: ['admin', 'member'],
  DELETE_CARD: ['admin', 'member'],
  VIEW_CARD: ['admin', 'member', 'viewer'],
  
  // Column permissions
  CREATE_COLUMN: ['admin'],
  DELETE_COLUMN: ['admin'],
  UPDATE_COLUMN: ['admin', 'member']
};
```

### JWT Authentication Implementation
```javascript
// middleware/auth.js - JWT verification middleware
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    { 
      userId: user._id, 
      username: user.username,
      role: user.role 
    },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
};

module.exports = { authenticateToken, generateToken };
```

### Permission Checking Middleware
```javascript
// middleware/permissions.js - Role-based permission checking
const Board = require('../models/Board');

const checkPermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      const userRole = req.user.role;
      const allowedRoles = PERMISSIONS[requiredPermission];

      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          required: requiredPermission,
          userRole: userRole
        });
      }

      next();
    } catch (error) {
      res.status(500).json({ error: 'Permission check failed' });
    }
  };
};

const checkBoardAccess = async (req, res, next) => {
  try {
    const boardId = req.params.boardId;
    const userId = req.user._id;

    const board = await Board.findById(boardId);
    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }

    // Check if user is owner
    if (board.owner.toString() === userId.toString()) {
      req.userBoardRole = 'admin';
      return next();
    }

    // Check if user is a member
    const membership = board.members.find(
      member => member.user.toString() === userId.toString()
    );

    if (!membership) {
      return res.status(403).json({ error: 'Access denied to this board' });
    }

    req.userBoardRole = membership.role;
    next();
  } catch (error) {
    res.status(500).json({ error: 'Board access check failed' });
  }
};

module.exports = { checkPermission, checkBoardAccess };
```

## Authentication Routes

### User Registration & Login
```javascript
// routes/auth.js - Authentication endpoints
const express = require('express');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }] 
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = new User({
      username,
      email,
      password: hashedPassword,
      role: 'member' // Default role
    });

    await user.save();

    // Generate token
    const token = generateToken(user);

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

// User login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken(user);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

module.exports = router;
```

## Frontend Authentication Management

### Auth Service
```javascript
// modules/auth.js - Client-side authentication
class AuthService {
  constructor() {
    this.token = localStorage.getItem('authToken');
    this.user = JSON.parse(localStorage.getItem('user') || 'null');
  }

  async login(email, password) {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      this.token = data.token;
      this.user = data.user;

      localStorage.setItem('authToken', this.token);
      localStorage.setItem('user', JSON.stringify(this.user));

      return data;
    } catch (error) {
      throw error;
    }
  }

  logout() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    window.location.href = '/login.html';
  }

  isAuthenticated() {
    return !!this.token && !!this.user;
  }

  hasPermission(permission) {
    if (!this.user) return false;
    
    const allowedRoles = PERMISSIONS[permission];
    return allowedRoles.includes(this.user.role);
  }

  getAuthHeaders() {
    return {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    };
  }

  async makeAuthenticatedRequest(url, options = {}) {
    const headers = {
      ...this.getAuthHeaders(),
      ...options.headers
    };

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (response.status === 401) {
      this.logout();
      throw new Error('Authentication required');
    }

    return response;
  }
}

// Global auth service instance
window.authService = new AuthService();
```

### Socket Authentication
```javascript
// middleware/socketAuth.js - Socket.io JWT verification
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const socketAuth = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication token required'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return next(new Error('Invalid token'));
    }

    socket.userId = user._id;
    socket.username = user.username;
    socket.userRole = user.role;
    
    next();
  } catch (error) {
    next(new Error('Authentication failed'));
  }
};

module.exports = socketAuth;
```

## Security Best Practices

### Password Security
- Minimum 6 characters (recommend 8+)
- bcrypt with salt rounds 12
- Rate limiting on login attempts
- Account lockout after failed attempts

### Token Security
- JWT with 24-hour expiration
- Secure HTTP-only cookies for refresh tokens
- Token rotation on sensitive operations
- Blacklist tokens on logout

### API Security
- Input validation and sanitization
- SQL injection prevention with Mongoose
- XSS protection with Content Security Policy
- CORS configuration for allowed origins

### WebSocket Security
- JWT verification for socket connections
- Rate limiting on socket events
- Input validation on all socket data
- Room-based access control