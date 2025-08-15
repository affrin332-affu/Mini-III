require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto'); // For generating password reset tokens

const app = express();
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
    if (!token) throw new Error();
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).send({ error: 'Please authenticate.' });
  }
};

// --- Auth Routes ---

// User Registration (Sign Up) - No automatic login
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ email, password: hashedPassword });
    await user.save();
    // Do NOT generate a token here. User must sign in separately.
    res.status(201).send({ message: 'Account created successfully. Please sign in.' });
  } catch (error) {
    if (error.code === 11000) { // MongoDB duplicate key error
      res.status(400).send({ error: 'Email already registered.' });
    } else {
      res.status(400).send({ error: 'Signup failed. Please try again.' });
    }
  }
});

// User Login (Sign In)
app.post('/api/auth/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) throw new Error('Invalid login credentials.');

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new Error('Invalid login credentials.');

    const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(200).send({ user, token });
  } catch (error) {
    res.status(400).send({ error: error.message || 'Invalid login credentials.' });
  }
});

// NEW: Forgot Password - Request Reset Token
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      // Send a success response even if user not found for security reasons
      return res.status(200).send({ message: 'If an account with that email exists, a password reset link has been sent.' });
    }

    // Generate a random token
    const resetToken = crypto.randomBytes(20).toString('hex');
    const passwordResetExpires = Date.now() + 3600000; // 1 hour from now

    user.passwordResetToken = resetToken;
    user.passwordResetExpires = passwordResetExpires;
    await user.save();

    // In a real application, you would send an email here.
    // For this demonstration, we'll log it to the console.
    console.log(`Password reset token for ${email}: ${resetToken}`);
    console.log(`Token expires at: ${new Date(passwordResetExpires).toLocaleString()}`);
    console.log(`(In a real app, this would be emailed to the user)`);

    res.status(200).send({ message: 'If an account with that email exists, a password reset link has been sent.' });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).send({ error: 'Error processing password reset request.' });
  }
});

// NOTE: A complete "Forgot Password" feature would also need an endpoint
// like POST /api/auth/reset-password/:token to handle password updates
// after the user clicks the link from their email. This is not included
// as the prompt only asked for "forgot password" initiation.

// --- Task Routes (Unchanged) ---
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
    const task = new Task({ ...req.body, user_id: req.user._id });
    await task.save();
    res.status(201).send(task);
  } catch (error) {
    res.status(400).send({ error: 'Error creating task.' });
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
    const task = await Task.findOneAndDelete({ _id: req.params.id, user_id: req.user._id });
    if (!task) return res.status(404).send({ error: 'Task not found.' });
    res.status(200).send({ message: 'Task deleted successfully.' });
  } catch (error) {
    res.status(500).send({ error: 'Error deleting task.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
