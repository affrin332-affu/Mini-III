require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const cors = require('cors');

const app = express();

// --- CORS: support multiple frontends ---
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://mini-iii-kk.vercel.app'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  credentials: true
}));

app.use(express.json());

app.get('/', (req, res) => res.send('Hello! VaulToDo Server is running.'));

const PORT = process.env.PORT || 5501;

// --- Mongoose Connection ---
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB.'))
  .catch(err => {
    console.error('❌ Could not connect to MongoDB:', err);
    process.exit(1); // Exit if database connection fails
  });

// --- Schemas ---
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  passwordResetToken: String,
  passwordResetExpires: Date
});
const User = mongoose.model('User', userSchema);

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
  status: { type: String, enum: ['To Do', 'In Progress', 'Done'], default: 'To Do' },
  due_date: { type: Date, default: null },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  created_at: { type: Date, default: Date.now }
});
const Task = mongoose.model('Task', taskSchema);

// --- Auth Middleware ---
const auth = (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) throw new Error('No token provided.');
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).send({ error: 'Session expired. Please authenticate again.' });
    }
    res.status(401).send({ error: error.message || 'Please authenticate.' });
  }
};

const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).send({ error: 'Access denied: Admin privileges required.' });
  }
};

// --- Auth Routes ---
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).send({ error: 'Email and password required.' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ email, password: hashedPassword, role: 'user' });
    await user.save();
    res.status(201).send({ message: 'Account created successfully. Please sign in.' });
  } catch (error) {
    if (error.code === 11000) {
      res.status(400).send({ error: 'Email already registered.' });
    } else {
      res.status(400).send({ error: `Signup failed: ${error.message}` });
    }
  }
});

app.post('/api/auth/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).send({ error: 'Email and password required.' });
    }
    const user = await User.findOne({ email });
    if (!user) throw new Error('Invalid login credentials.');
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new Error('Invalid login credentials.');
    
    const token = jwt.sign(
      { _id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.status(200).send({
      user: { id: user._id, email: user.email, role: user.role },
      token
    });
  } catch (error) {
    res.status(400).send({ error: error.message || 'Invalid login credentials.' });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).send({ error: 'Email is required.' });
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(200).send({
        message: 'If an account with that email exists, a password reset link has been sent.'
      });
    }
    
    const resetToken = crypto.randomBytes(20).toString('hex');
    user.passwordResetToken = resetToken;
    user.passwordResetExpires = Date.now() + 3600000; // 1 hour
    await user.save();
    
    // NOTE: In production, send email here with resetToken
    console.log(`Password reset token for ${email}: ${resetToken}`);
    
    res.status(200).send({ message: 'Password reset requested.' });
  } catch (error) {
    res.status(500).send({ error: 'Error processing password reset request.' });
  }
});

// --- Task Routes ---
app.get('/api/tasks', auth, async (req, res) => {
  try {
    const tasks = await Task.find({ user_id: req.user._id }).sort({ created_at: -1 });
    res.status(200).send(tasks);
  } catch (error) {
    res.status(500).send({ error: 'Error fetching tasks.' });
  }
});

app.post('/api/tasks', auth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.user._id)) {
      throw new Error('Invalid user ID format.');
    }
    const task = new Task({ ...req.body, user_id: req.user._id });
    await task.save();
    res.status(201).send(task);
  } catch (error) {
    res.status(400).send({ error: error.message || 'Error creating task.' });
  }
});

app.patch('/api/tasks/:id', auth, async (req, res) => {
  try {
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, user_id: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!task) return res.status(404).send({ error: 'Task not found.' });
    res.status(200).send(task);
  } catch (error) {
    res.status(400).send({ error: 'Error updating task.' });
  }
});

app.delete('/api/tasks/:id', auth, async (req, res) => {
  try {
    const task = await Task.findOneAndDelete({
      _id: req.params.id,
      user_id: req.user._id
    });
    if (!task) return res.status(404).send({ error: 'Task not found.' });
    res.status(200).send({ message: 'Task deleted successfully.' });
  } catch (error) {
    res.status(500).send({ error: 'Error deleting task.' });
  }
});

// --- Admin Routes ---
app.get('/api/admin/users', auth, isAdmin, async (req, res) => {
  try {
    const users = await User.find({}).select('-password -passwordResetToken -passwordResetExpires');
    res.status(200).send(users);
  } catch (error) {
    res.status(500).send({ error: 'Error fetching users.' });
  }
});

app.patch('/api/admin/users/:userId/role', auth, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { newRole } = req.body;
    
    if (!['user', 'admin'].includes(newRole)) {
      return res.status(400).send({ error: 'Invalid role specified.' });
    }
    
    if (req.user._id.toString() === userId && newRole === 'user') {
      return res.status(403).send({
        error: 'Admins cannot demote themselves via this interface.'
      });
    }
    
    const user = await User.findByIdAndUpdate(
      userId,
      { role: newRole },
      { new: true, runValidators: true }
    );
    
    if (!user) return res.status(404).send({ error: 'User not found.' });
    
    res.status(200).send({
      message: `User role updated to ${newRole}`,
      user: { id: user._id, email: user.email, role: user.role }
    });
  } catch (error) {
    res.status(500).send({ error: 'Error updating user role.' });
  }
});

app.delete('/api/admin/users/:userId', auth, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (req.user._id.toString() === userId) {
      return res.status(403).send({
        error: 'Admins cannot delete their own account via this interface.'
      });
    }
    
    const user = await User.findByIdAndDelete(userId);
    if (!user) return res.status(404).send({ error: 'User not found.' });
    
    await Task.deleteMany({ user_id: userId });
    
    res.status(200).send({ message: 'User and associated tasks deleted successfully.' });
  } catch (error) {
    res.status(500).send({ error: 'Error deleting user.' });
  }
});

app.get('/api/admin/tasks', auth, isAdmin, async (req, res) => {
  try {
    const tasks = await Task.find({}).populate('user_id', 'email');
    const tasksWithUserEmail = tasks.map(task => ({
      ...task.toObject(),
      userEmail: task.user_id ? task.user_id.email : 'Unknown User'
    }));
    res.status(200).send(tasksWithUserEmail);
  } catch (error) {
    res.status(500).send({ error: 'Error fetching all tasks.' });
  }
});

app.delete('/api/admin/tasks/:taskId', auth, isAdmin, async (req, res) => {
  try {
    const { taskId } = req.params;
    const task = await Task.findByIdAndDelete(taskId);
    if (!task) return res.status(404).send({ error: 'Task not found.' });
    res.status(200).send({ message: 'Task deleted successfully.' });
  } catch (error) {
    res.status(500).send({ error: 'Error deleting task.' });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 VaulToDo Server is running on port ${PORT}`);
});
