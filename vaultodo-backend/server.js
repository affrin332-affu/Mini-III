require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto'); // For generating password reset tokens

const app = express();
app.get('/', (req, res) => {
  res.send('Hello! Server is running.');
});

const PORT = process.env.PORT || 5501; // Ensure this matches your frontend

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB.'))
  .catch(err => console.error('Could not connect to MongoDB:', err));

// MongoDB Schemas
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' }, // NEW: Role field with default
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

// JWT Middleware for route protection
const auth = (req, res, next) => {
  try {
    const token = req.header('Authorization').replace('Bearer ', '');
    // Log token (first 20 chars for brevity, or 'No token')
    console.log('Auth Middleware: Received token (partial):', token ? token.substring(0, 20) + '...' : 'No token');
    if (!token) throw new Error('No token provided.');
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // This now contains _id, email, and role
    console.log('Auth Middleware: Decoded user:', req.user); // <-- CRITICAL: Log decoded user object
    next();
  } catch (error) {
    console.error('Auth Middleware Error:', error.message); // <-- CRITICAL: Log specific auth error message
    if (error.name === 'TokenExpiredError') {
      return res.status(401).send({ error: 'Session expired. Please authenticate again.' });
    }
    res.status(401).send({ error: 'Please authenticate.' });
  }
};

// NEW: Admin Middleware
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next(); // User is an admin, proceed
  } else {
    res.status(403).send({ error: 'Access denied: Admin privileges required.' });
  }
};

// --- Auth Routes ---

// User Registration (Sign Up) - Now includes default role
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    // User is created with default 'user' role
    const user = new User({ email, password: hashedPassword, role: 'user' }); 
    await user.save();
    res.status(201).send({ message: 'Account created successfully. Please sign in.' });
  } catch (error) {
    if (error.code === 11000) { // MongoDB duplicate key error
      res.status(400).send({ error: 'Email already registered.' });
    } else {
      console.error('Signup error:', error);
      res.status(400).send({ error: 'Signup failed. Please try again.' });
    }
  }
});

// User Login (Sign In) - Now includes role in JWT payload
app.post('/api/auth/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) throw new Error('Invalid login credentials.');

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new Error('Invalid login credentials.');

    // NEW: Include user.email and user.role in the JWT payload
    const token = jwt.sign(
      { _id: user._id, email: user.email, role: user.role }, 
      process.env.JWT_SECRET, 
      { expiresIn: '7d' }
    );
    console.log('Signin Success: Generated token for user:', user.email, 'Role:', user.role); // Log success
    res.status(200).send({ user: { id: user._id, email: user.email, role: user.role }, token });
  } catch (error) {
    console.error('Signin Error:', error.message); // Log signin specific errors
    res.status(400).send({ error: error.message || 'Invalid login credentials.' });
  }
});

// NEW: Forgot Password - Request Reset Token
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(200).send({ message: 'If an account with that email exists, a password reset link has been sent.' });
    }

    const resetToken = crypto.randomBytes(20).toString('hex');
    const passwordResetExpires = Date.now() + 3600000; // 1 hour from now

    user.passwordResetToken = resetToken;
    user.passwordResetExpires = passwordResetExpires;
    await user.save();

    console.log(`Password reset token for ${email}: ${resetToken}`);
    console.log(`Token expires at: ${new Date(passwordResetExpires).toLocaleString()}`);
    console.log(`(In a real app, this would be emailed to the user)`);

    res.status(200).send({ message: 'If an account with that email exists, a password reset link has been sent.' });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).send({ error: 'Error processing password reset request.' });
  }
});

// --- Task Routes ---

app.get('/api/tasks', auth, async (req, res) => {
  console.log('Fetch Tasks Route: Authenticated User ID:', req.user._id); // Log user ID
  try {
    const tasks = await Task.find({ user_id: req.user._id }).sort({ created_at: -1 });
    console.log('Tasks Fetched Successfully:', tasks.length, 'tasks'); // Log success
    res.status(200).send(tasks);
  } catch (error) {
    console.error('Error in Fetch Tasks Route:', error); // <-- CRITICAL: Log the full error object
    res.status(500).send({ error: 'Error fetching tasks.' });
  }
});

app.post('/api/tasks', auth, async (req, res) => {
  console.log('Add Task Route: Request Body:', req.body); // <-- CRITICAL: Log request body
  console.log('Add Task Route: Authenticated User ID:', req.user._id); // <-- CRITICAL: Log user ID
  try {
    // Ensure user_id is a valid ObjectId before creating the task
    if (!mongoose.Types.ObjectId.isValid(req.user._id)) {
        throw new Error('Invalid user ID format.');
    }
    const task = new Task({ ...req.body, user_id: req.user._id });
    await task.save();
    console.log('Task Added Successfully:', task); // Log success
    res.status(201).send(task);
  } catch (error) {
    console.error('Error in Add Task Route:', error); // <-- CRITICAL: Log the full error object
    if (error.name === 'ValidationError') {
        return res.status(400).send({ error: error.message }); // Send validation errors as 400
    }
    res.status(500).send({ error: 'Error creating task.' }); // Generic 500 for other issues
  }
});

app.patch('/api/tasks/:id', auth, async (req, res) => {
  console.log('Update Task Route: Task ID:', req.params.id, 'Request Body:', req.body);
  console.log('Update Task Route: Authenticated User ID:', req.user._id);
  try {
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, user_id: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!task) return res.status(404).send({ error: 'Task not found.' });
    console.log('Task Updated Successfully:', task);
    res.status(200).send(task);
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(400).send({ error: 'Error updating task.' });
  }
});

app.delete('/api/tasks/:id', auth, async (req, res) => {
  console.log('Delete Task Route: Task ID:', req.params.id);
  console.log('Delete Task Route: Authenticated User ID:', req.user._id);
  try {
    const task = await Task.findOneAndDelete({ _id: req.params.id, user_id: req.user._id });
    if (!task) return res.status(404).send({ error: 'Task not found.' });
    console.log('Task Deleted Successfully:', task);
    res.status(200).send({ message: 'Task deleted successfully.' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).send({ error: 'Error deleting task.' });
  }
});

// --- NEW: Admin Routes (Protected by auth and isAdmin middleware) ---

// Get all users (Admin only)
app.get('/api/admin/users', auth, isAdmin, async (req, res) => {
  console.log('Admin Users Route: Authenticated User:', req.user.email, 'Role:', req.user.role);
  try {
    const users = await User.find({}).select('-password -passwordResetToken -passwordResetExpires'); // Exclude sensitive fields
    console.log('Admin Users Fetched Successfully:', users.length, 'users');
    res.status(200).send(users);
  } catch (error) {
    console.error('Error fetching all users (admin):', error);
    res.status(500).send({ error: 'Error fetching users.' });
  }
});

// Update user role (Admin only)
app.patch('/api/admin/users/:userId/role', auth, isAdmin, async (req, res) => {
  console.log('Admin Update User Role Route: User ID:', req.params.userId, 'New Role:', req.body.newRole);
  console.log('Admin Update User Role Route: Admin User:', req.user.email);
  try {
    const { userId } = req.params;
    const { newRole } = req.body;

    if (!['user', 'admin'].includes(newRole)) {
      return res.status(400).send({ error: 'Invalid role specified.' });
    }

    // Optional: Prevent admin from demoting themselves
    if (req.user._id.toString() === userId && newRole === 'user') {
      return res.status(403).send({ error: 'Admins cannot demote themselves via this interface.' });
    }

    const user = await User.findByIdAndUpdate(userId, { role: newRole }, { new: true, runValidators: true });

    if (!user) {
      return res.status(404).send({ error: 'User not found.' });
    }
    console.log('User Role Updated Successfully:', user.email, 'to', user.role);
    res.status(200).send({ message: `User role updated to ${newRole}`, user: { id: user._id, email: user.email, role: user.role } });
  } catch (error) {
    console.error('Error updating user role (admin):', error);
    res.status(500).send({ error: 'Error updating user role.' });
  }
});

// Delete a user (Admin only)
app.delete('/api/admin/users/:userId', auth, isAdmin, async (req, res) => {
  console.log('Admin Delete User Route: User ID:', req.params.userId);
  console.log('Admin Delete User Route: Admin User:', req.user.email);
  try {
    const { userId } = req.params;

    // Optional: Prevent admin from deleting themselves
    if (req.user._id.toString() === userId) {
      return res.status(403).send({ error: 'Admins cannot delete their own account via this interface.' });
    }

    const user = await User.findByIdAndDelete(userId);

    if (!user) {
      return res.status(404).send({ error: 'User not found.' });
    }

    // Also delete all tasks associated with this user
    await Task.deleteMany({ user_id: userId });
    console.log('User and associated tasks deleted successfully for user ID:', userId);
    res.status(200).send({ message: 'User and associated tasks deleted successfully.' });
  } catch (error) {
    console.error('Error deleting user (admin):', error);
    res.status(500).send({ error: 'Error deleting user.' });
  }
});

// Get all tasks (Admin only) - This is a global view of all tasks
app.get('/api/admin/tasks', auth, isAdmin, async (req, res) => {
  console.log('Admin All Tasks Route: Authenticated User:', req.user.email, 'Role:', req.user.role);
  try {
    // Populate user details to show who created the task
    const tasks = await Task.find({}).populate('user_id', 'email'); 
    // Map to include user email directly in the task object
    const tasksWithUserEmail = tasks.map(task => ({
        ...task.toObject(),
        userEmail: task.user_id ? task.user_id.email : 'Unknown User'
    }));
    console.log('Admin All Tasks Fetched Successfully:', tasksWithUserEmail.length, 'tasks');
    res.status(200).send(tasksWithUserEmail);
  } catch (error) {
    console.error('Error fetching all tasks (admin):', error);
    res.status(500).send({ error: 'Error fetching all tasks.' });
  }
});

// Delete any task (Admin only)
app.delete('/api/admin/tasks/:taskId', auth, isAdmin, async (req, res) => {
  console.log('Admin Delete Task Route: Task ID:', req.params.taskId);
  console.log('Admin Delete Task Route: Admin User:', req.user.email);
  try {
    const { taskId } = req.params;
    const task = await Task.findByIdAndDelete(taskId);

    if (!task) {
      return res.status(404).send({ error: 'Task not found.' });
    }
    console.log('Task deleted successfully (admin) for Task ID:', taskId);
    res.status(200).send({ message: 'Task deleted successfully.' });
  } catch (error) {
    console.error('Error deleting task (admin):', error);
    res.status(500).send({ error: 'Error deleting task.' });
  }
});


app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
