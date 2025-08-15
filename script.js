// Remove Supabase import from HTML and here
// You should also remove the <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
// line from your index.html file's <head> section.

// Base URL for your backend API - CORRECTED PORT TO 5501
const API_BASE_URL = 'http://localhost:5501/api';

// --- DOM Elements ---
const focusLoginContainer = document.getElementById('focus-login-container');
const loginWindow = document.getElementById('login-window');
const unlockButton = document.getElementById('unlock-button');
const loginFormWrapper = document.getElementById('login-form-wrapper');
const appLayout = document.getElementById('app-layout');

// Views within the Focus Window
const signinView = document.getElementById('signin-view');
const signupView = document.getElementById('signup-view');
const forgotPasswordView = document.getElementById('forgot-password-view'); // NEW

// Messages
const signinMessage = document.getElementById('signin-message');
const signupMessage = document.getElementById('signup-message');
const forgotPasswordMessage = document.getElementById('forgot-password-message'); // NEW

// Forms and Links
const signinForm = document.getElementById('signin-form');
const signupForm = document.getElementById('signup-form');
const forgotPasswordForm = document.getElementById('forgot-password-form'); // NEW

const showSignup = document.getElementById('show-signup');
const showSignin = document.getElementById('show-signin');
const showForgotPasswordLink = document.getElementById('show-forgot-password'); // NEW
const backToSigninLink = document.getElementById('back-to-signin'); // NEW

// Main App Elements
const signoutButton = document.getElementById('signout-button');
const addTaskForm = document.getElementById('add-task-form');
const taskBoard = document.getElementById('task-board');
const logo = document.getElementById('logo');
const vaultModal = document.getElementById('vault-modal');
const closeVaultModal = document.getElementById('close-vault-modal');
const themeToggle = document.getElementById('theme-toggle');
const menuToggle = document.getElementById('menu-toggle');
const sidebar = document.getElementById('sidebar');
const copyrightYear = document.getElementById('copyright-year');
const taskSearchInput = document.getElementById('task-search'); // Added for search

// Pomodoro Timer elements
const timerMinutesDisplay = document.getElementById('timer-minutes');
const timerSecondsDisplay = document.getElementById('timer-seconds');
const timerStartBtn = document.getElementById('timer-start');
const timerPauseBtn = document.getElementById('timer-pause');
const timerResetBtn = document.getElementById('timer-reset');
let pomodoroInterval;
let timerTime = 25 * 60; // 25 minutes default

// Task Details Modal elements
const taskDetailsModal = document.getElementById('task-details-modal');
const modalCloseBtn = taskDetailsModal.querySelector('.close-button');
const modalTaskTitle = document.getElementById('modal-task-title');
const modalTaskStatus = document.getElementById('modal-task-status');
const modalTaskPriority = document.getElementById('modal-task-priority');
const modalTaskDueDate = document.getElementById('modal-task-due-date');
const modalTaskCreatedAt = document.getElementById('modal-task-created-at');
const modalTaskDescription = document.getElementById('modal-task-description');
const saveTaskDetailsBtn = document.getElementById('save-task-details-btn');
let currentTaskToEdit = null;

// --- Helper Functions ---

// Displays a message on the UI (e.g., login errors, success messages)
function displayMessage(element, message, type) {
    element.textContent = message;
    element.className = `message ${type}`; // Applies 'success' or 'error' class for styling
}

// Controls UI visibility based on authentication state
function showLogin() {
    // Hide the main app layout and show the login container
    appLayout.classList.add('hidden');
    focusLoginContainer.classList.remove('hidden');

    // Reset the login/signup form state
    loginWindow.classList.remove('success', 'expanded'); // Ensure expanded class is removed on logout/initial load
    loginFormWrapper.classList.add('collapsed');
    
    // Always show sign-in view first on login page load/reset
    signinView.classList.remove('hidden');
    signupView.classList.add('hidden');
    forgotPasswordView.classList.add('hidden'); // Ensure forgot password is hidden
    
    displayMessage(signinMessage, '', ''); // Clear messages
    displayMessage(signupMessage, '', '');
    displayMessage(forgotPasswordMessage, '', ''); // Clear forgot password messages
}

// Shows the main application dashboard
function showApp() {
    focusLoginContainer.classList.add('hidden');
    appLayout.classList.remove('hidden');
    // Once logged in, remove the `success` class to allow re-expanding for vault (if needed)
    loginWindow.classList.remove('success');
}

// --- 2. AUTHENTICATION LOGIC (MongoDB Backend) ---

// Checks if a user token exists in localStorage to determine login state
function checkAuthStatus() {
    const token = localStorage.getItem('userToken');
    if (token) {
        showApp();
        fetchTasks(); // Load tasks if authenticated
    } else {
        showLogin();
    }
}

// Handles user sign-up - No automatic login
signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    displayMessage(signupMessage, 'Registering...', '');
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;

    try {
        const response = await fetch(`${API_BASE_URL}/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            displayMessage(signupMessage, data.message || 'Account created successfully! Please sign in.', 'success');
            // Redirect to sign-in view after successful registration
            signupView.classList.add('hidden');
            signinView.classList.remove('hidden');
            // Clear signup form
            document.getElementById('signup-email').value = '';
            document.getElementById('signup-password').value = '';
        } else {
            displayMessage(signupMessage, data.error || 'Signup failed.', 'error');
        }
    } catch (error) {
        console.error('Signup fetch error:', error);
        displayMessage(signupMessage, 'An error occurred during signup. Please try again.', 'error');
    }
});

// Handles user sign-in
signinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    displayMessage(signinMessage, 'Verifying...', '');
    const email = document.getElementById('signin-email').value;
    const password = document.getElementById('signin-password').value;

    try {
        const response = await fetch(`${API_BASE_URL}/auth/signin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('userToken', data.token); // Store the JWT token
            loginWindow.classList.add('success'); // Visual feedback for successful login
            setTimeout(() => {
                showApp();
                fetchTasks(); // Load tasks after successful login
            }, 600);
        } else {
            displayMessage(signinMessage, data.error || 'Login failed. Check your credentials.', 'error');
        }
    } catch (error) {
        console.error('Signin fetch error:', error);
        displayMessage(signinMessage, 'An error occurred during login. Please try again.', 'error');
    }
});

// NEW: Handles forgot password request
forgotPasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    displayMessage(forgotPasswordMessage, 'Sending reset link...', '');
    const email = document.getElementById('forgot-password-email').value;

    try {
        const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        const data = await response.json();

        if (response.ok) {
            displayMessage(forgotPasswordMessage, data.message, 'success');
            // Clear email field
            document.getElementById('forgot-password-email').value = '';
            console.warn("NOTE: In a real app, check your email for the reset link (check backend console for token).");
        } else {
            displayMessage(forgotPasswordMessage, data.error || 'Failed to send reset link.', 'error');
        }
    } catch (error) {
        console.error('Forgot password fetch error:', error);
        displayMessage(forgotPasswordMessage, 'An error occurred. Please try again.', 'error');
    }
});

// Handles user sign-out
signoutButton.addEventListener('click', () => {
    localStorage.removeItem('userToken'); // Clear the token
    showLogin(); // Go back to login screen
    // Clear tasks from the board visually
    document.querySelectorAll('.task-column').forEach(col => {
        col.querySelectorAll('.task-card').forEach(card => card.remove());
    });
});

// --- Auth View Toggling (NEW/MODIFIED) ---
showSignup.addEventListener('click', (e) => {
    e.preventDefault();
    displayMessage(signupMessage, '', ''); // Clear messages
    signinView.classList.add('hidden');
    forgotPasswordView.classList.add('hidden'); // Ensure forgot password is hidden
    signupView.classList.remove('hidden');
});

showSignin.addEventListener('click', (e) => {
    e.preventDefault();
    displayMessage(signinMessage, '', ''); // Clear messages
    signupView.classList.add('hidden');
    forgotPasswordView.classList.add('hidden'); // Ensure forgot password is hidden
    signinView.classList.remove('hidden');
});

showForgotPasswordLink.addEventListener('click', (e) => { // NEW
    e.preventDefault();
    displayMessage(forgotPasswordMessage, '', ''); // Clear messages
    signinView.classList.add('hidden');
    signupView.classList.add('hidden');
    forgotPasswordView.classList.remove('hidden');
});

backToSigninLink.addEventListener('click', (e) => { // NEW
    e.preventDefault();
    displayMessage(signinMessage, '', ''); // Clear messages
    forgotPasswordView.classList.add('hidden');
    signupView.classList.add('hidden'); // Ensure signup is hidden
    signinView.classList.remove('hidden');
});


// --- 3. TASK MANAGEMENT (MongoDB Backend) ---

// Fetches tasks from the backend for the current user
const fetchTasks = async () => {
    const token = localStorage.getItem('userToken');
    if (!token) {
        console.warn('No token found, cannot fetch tasks.');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/tasks`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` } // Send JWT token for authentication
        });

        if (!response.ok) {
            // If token is invalid or expired, force sign out
            if (response.status === 401) {
                localStorage.removeItem('userToken');
                showLogin();
                displayMessage(signinMessage, 'Session expired. Please sign in again.', 'error');
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const tasks = await response.json();
        renderTasks(tasks);
    } catch (error) {
        console.error('Error fetching tasks:', error);
    }
};

// Renders tasks onto the Kanban board columns
const renderTasks = (tasks) => {
    // Clear existing tasks from all columns
    document.getElementById('To Do').innerHTML = '<h2>To Do</h2>';
    document.getElementById('In Progress').innerHTML = '<h2>In Progress</h2>';
    document.getElementById('Done').innerHTML = '<h2>Done</h2>';

    tasks.forEach(task => {
        const column = document.getElementById(task.status);
        if (column) {
            const card = document.createElement('div');
            card.className = `task-card priority-${task.priority.toLowerCase()}`;
            card.id = `task-${task._id}`; // Use MongoDB's _id
            card.draggable = true;
            card.dataset.id = task._id; // Store _id for drag/drop and details

            const dueDate = task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No Due Date';

            card.innerHTML = `
                <h3>${task.title}</h3>
                <p class="task-priority">${task.priority} Priority</p>
                <p class="task-due-date">Due: ${dueDate}</p>
                <div class="task-actions">
                    <button class="delete-task-btn" data-task-id="${task._id}" title="Delete Task">×</button>
                </div>
            `;
            card.addEventListener('dragstart', dragStart);
            // Event listener for task details modal
            card.addEventListener('click', (e) => {
                // Only show modal if delete button wasn't clicked
                if (!e.target.closest('.delete-task-btn')) {
                    showTaskDetailsModal(task);
                }
            });
            column.appendChild(card);
        }
    });
};

// Adds a new task
addTaskForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const titleInput = document.getElementById('task-title');
    const priorityInput = document.getElementById('task-priority');
    const dueDateInput = document.getElementById('task-due-date'); // New due date input

    const title = titleInput.value.trim();
    const priority = priorityInput.value;
    const due_date = dueDateInput.value || null; // Capture due date, or null if empty
    const token = localStorage.getItem('userToken');

    if (title && token) {
        try {
            const response = await fetch(`${API_BASE_URL}/tasks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ title, priority, due_date, status: 'To Do' })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Task added successfully, refresh the task list
            titleInput.value = '';
            priorityInput.value = 'Medium'; // Reset to default
            dueDateInput.value = ''; // Clear date input
            fetchTasks();
        } catch (error) {
            console.error('Error adding task:', error);
        }
    }
});

// Handles task deletion via event delegation
taskBoard.addEventListener('click', async (e) => {
    if (e.target.classList.contains('delete-task-btn')) {
        const taskId = e.target.getAttribute('data-task-id');
        // Replaced browser alert with a custom modal if needed, but keeping for now for simplicity.
        if (confirm('Are you sure you want to delete this task?')) {
            const token = localStorage.getItem('userToken');
            if (!token) return;

            try {
                const response = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                fetchTasks(); // Refresh tasks after deletion
            } catch (error) {
                console.error('Error deleting task:', error);
            }
        }
    }
});

// --- Search and Filter Logic ---
taskSearchInput.addEventListener('input', filterTasks);

function filterTasks() {
    const searchTerm = taskSearchInput.value.toLowerCase();
    const tasks = document.querySelectorAll('.task-card');

    tasks.forEach(task => {
        const title = task.querySelector('h3').textContent.toLowerCase();
        if (title.includes(searchTerm)) {
            task.style.display = 'block';
        } else {
            task.style.display = 'none';
        }
    });
}

// --- 4. DRAG-AND-DROP LOGIC ---
function dragStart(e) {
    e.dataTransfer.setData('text/plain', e.target.id);
    e.target.classList.add('dragging');
}

// Global drop function for drag-and-drop
window.drop = async (e) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    const draggedElement = document.getElementById(taskId);
    const targetColumn = e.target.closest('.task-column'); // Find the closest task column
    document.querySelectorAll('.task-card').forEach(card => card.classList.remove('dragging')); // Remove dragging class

    if (draggedElement && targetColumn) {
        const newStatus = targetColumn.id; // Get the ID of the column (e.g., "To Do", "In Progress")

        // Append the dragged card to the new column
        targetColumn.appendChild(draggedElement);

        // Update task status in the backend
        const token = localStorage.getItem('userToken');
        if (!token) return;

        try {
            const response = await fetch(`${API_BASE_URL}/tasks/${draggedElement.dataset.id}`, { // Use dataset.id for MongoDB _id
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            // Optionally, re-fetch tasks if complex re-ordering or state management is needed
            // fetchTasks();
        } catch (error) {
            console.error('Error updating task status:', error);
        }
    }
};

// --- 5. UI & SECRET VAULT LOGIC ---
themeToggle.addEventListener('click', () => document.body.classList.toggle('dark-mode'));

let clickCount = 0;
logo.addEventListener('click', () => {
    clickCount++;
    setTimeout(() => { clickCount = 0; }, 600); // Reset count if not clicked rapidly
    if (clickCount === 3) {
        clickCount = 0;
        vaultModal.classList.remove('hidden'); // Show the vault modal
    }
});
closeVaultModal.addEventListener('click', () => vaultModal.classList.add('hidden')); // Hide vault modal

// --- 6. Menu Toggle Logic ---
menuToggle.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
});

// --- NEW: Task Details Modal Logic ---
function showTaskDetailsModal(task) {
    currentTaskToEdit = task; // Store the task object being viewed/edited
    modalTaskTitle.textContent = task.title;
    modalTaskStatus.textContent = task.status;
    modalTaskPriority.textContent = task.priority;
    modalTaskDueDate.textContent = task.due_date ? new Date(task.due_date).toLocaleDateString() : 'N/A';
    modalTaskCreatedAt.textContent = new Date(task.created_at).toLocaleString();
    modalTaskDescription.value = task.description || ''; // Display existing description or empty string

    taskDetailsModal.classList.remove('hidden');
    document.body.classList.add('modal-open'); // Add a class to body to prevent scrolling
}

function hideTaskDetailsModal() {
    taskDetailsModal.classList.add('hidden');
    document.body.classList.remove('modal-open');
    currentTaskToEdit = null; // Clear the task being edited
}

// Event listeners for task details modal
modalCloseBtn.addEventListener('click', hideTaskDetailsModal);
// Close modal if backdrop is clicked
taskDetailsModal.addEventListener('click', (e) => {
    if (e.target === taskDetailsModal) {
        hideTaskDetailsModal();
    }
});

// Save updated task details (e.g., description)
saveTaskDetailsBtn.addEventListener('click', async () => {
    if (!currentTaskToEdit) return;

    const newDescription = modalTaskDescription.value;
    const token = localStorage.getItem('userToken');

    try {
        const response = await fetch(`${API_BASE_URL}/tasks/${currentTaskToEdit._id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ description: newDescription })
        });

        if (response.ok) {
            currentTaskToEdit.description = newDescription; // Update local object
            hideTaskDetailsModal();
            fetchTasks(); // Re-fetch tasks to ensure UI consistency if needed (though not strictly for description)
        } else {
            const errorData = await response.json();
            console.error('Error saving task details:', errorData.error);
            alert('Failed to save task details: ' + (errorData.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error in saveTaskDetails fetch:', error);
        alert('An error occurred while saving task details.');
    }
});

// --- NEW: Pomodoro Timer Logic ---
function updateTimerDisplay() {
    const minutes = Math.floor(timerTime / 60);
    const seconds = timerTime % 60;
    timerMinutesDisplay.textContent = String(minutes).padStart(2, '0');
    timerSecondsDisplay.textContent = String(seconds).padStart(2, '0');
}

function startTimer() {
    if (pomodoroInterval) return; // Prevent multiple intervals
    timerStartBtn.textContent = 'Continue';
    pomodoroInterval = setInterval(() => {
        if (timerTime > 0) {
            timerTime--;
            updateTimerDisplay();
        } else {
            clearInterval(pomodoroInterval);
            pomodoroInterval = null;
            // Using alert for simplicity, consider a custom modal for better UX
            alert('Pomodoro session finished! Time for a break.');
            resetTimer(); // Reset for next session
        }
    }, 1000);
}

function pauseTimer() {
    clearInterval(pomodoroInterval);
    pomodoroInterval = null;
    timerStartBtn.textContent = 'Start';
}

function resetTimer() {
    clearInterval(pomodoroInterval);
    pomodoroInterval = null;
    timerTime = 25 * 60; // Reset to 25 minutes
    updateTimerDisplay();
    timerStartBtn.textContent = 'Start';
}

// Event listeners for Pomodoro Timer
timerStartBtn.addEventListener('click', startTimer);
timerPauseBtn.addEventListener('click', pauseTimer);
timerResetBtn.addEventListener('click', resetTimer);

// --- 1. INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    copyrightYear.textContent = new Date().getFullYear();
    updateTimerDisplay(); // Initialize timer display
    checkAuthStatus(); // Check authentication state on page load

    // THIS IS THE EVENT LISTENER FOR UNLOCK BUTTON!
    // It should be here within DOMContentLoaded to ensure the button element exists
    // before attempting to attach the listener.
    unlockButton.addEventListener('click', () => {
        console.log('Unlock button clicked! Attempting to expand form.'); 
        loginWindow.classList.add('expanded');
        loginFormWrapper.classList.remove('collapsed');
    });
});
