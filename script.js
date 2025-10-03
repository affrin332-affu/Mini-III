// Base URL for your backend API
const API_BASE_URL="https://mini-iii-one.onrender.com";

// --- DOM Elements ---
const focusLoginContainer = document.getElementById('focus-login-container');
const loginWindow = document.getElementById('login-window');
const unlockButton = document.getElementById('unlock-button');
const loginFormWrapper = document.getElementById('login-form-wrapper');
const appLayout = document.getElementById('app-layout');

// Views within the Focus Window
const signinView = document.getElementById('signin-view');
const signupView = document.getElementById('signup-view');
const forgotPasswordView = document.getElementById('forgot-password-view');

// Messages
const signinMessage = document.getElementById('signin-message');
const signupMessage = document.getElementById('signup-message');
const forgotPasswordMessage = document.getElementById('forgot-password-message');

// Forms and Links
const signinForm = document.getElementById('signin-form');
const signupForm = document.getElementById('signup-form');
const forgotPasswordForm = document.getElementById('forgot-password-form');

const showSignup = document.getElementById('show-signup');
const showSignin = document.getElementById('show-signin');
const showForgotPasswordLink = document.getElementById('show-forgot-password');
const backToSigninLink = document.getElementById('back-to-signin');

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
const taskSearchInput = document.getElementById('task-search');

// Sidebar navigation links
const dashboardLink = document.getElementById('dashboard-link');
const adminPanelLink = document.getElementById('admin-panel-link');
const showAdminPanelBtn = document.getElementById('show-admin-panel');

// Main content sections
const dashboardSection = document.getElementById('dashboard');
const adminDashboardSection = document.getElementById('admin-dashboard-section');

// Admin Dashboard elements
const adminUsersList = document.getElementById('admin-users-list');
const adminAllTasksList = document.getElementById('admin-all-tasks-list');


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

// Generic Modal elements (for alerts and confirmations)
const genericModal = document.getElementById('generic-modal');
const genericModalTitle = document.getElementById('generic-modal-title');
const genericModalMessage = document.getElementById('generic-modal-message');
const genericModalActions = document.getElementById('generic-modal-actions');
const genericModalCloseBtn = document.getElementById('generic-modal-close-btn');

// Global variable to store user role
let currentUserRole = 'user'; // Default to user

// --- Helper Functions ---

// Function to decode JWT token
function decodeJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (error) {
        console.error('Error decoding JWT:', error);
        return null;
    }
}

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

    // Hide admin link on logout
    adminPanelLink.classList.add('hidden');
    currentUserRole = 'user'; // Reset role
}

// Shows the main application dashboard
function showApp() {
    focusLoginContainer.classList.add('hidden');
    appLayout.classList.remove('hidden');
    // Once logged in, remove the `success` class to allow re-expanding for vault (if needed)
    loginWindow.classList.remove('success');
}

/**
 * Shows a generic modal for alerts or confirmations.
 * @param {string} title - The title for the modal.
 * @param {string} message - The message content for the modal.
 * @param {Array<Object>} buttonsConfig - An array of button configurations.
 * Each object: { text: string, className: string, onClick: Function }
 * @param {Function} onCloseCallback - Optional callback when the modal is closed without button interaction.
 */
function showGenericModal(title, message, buttonsConfig = [], onCloseCallback = () => {}) {
    genericModalTitle.textContent = title;
    genericModalMessage.textContent = message;
    genericModalActions.innerHTML = ''; // Clear existing buttons

    buttonsConfig.forEach(btn => {
        const button = document.createElement('button');
        button.textContent = btn.text;
        button.className = btn.className; // e.g., 'vault-btn primary', 'vault-btn secondary'
        button.onclick = () => {
            hideGenericModal();
            if (btn.onClick) {
                btn.onClick();
            }
        };
        genericModalActions.appendChild(button);
    });

    genericModal.classList.remove('hidden');
    document.body.classList.add('modal-open');

    // Store the callback for closing via 'x' button or backdrop click
    genericModal.onCloseCallback = onCloseCallback;
}

function hideGenericModal() {
    genericModal.classList.add('hidden');
    document.body.classList.remove('modal-open');
    if (genericModal.onCloseCallback) {
        genericModal.onCloseCallback();
        genericModal.onCloseCallback = null; // Clear callback
    }
}

// Event listeners for generic modal close button and backdrop
genericModalCloseBtn.addEventListener('click', hideGenericModal);
genericModal.addEventListener('click', (e) => {
    if (e.target === genericModal) {
        hideGenericModal();
    }
});


// --- 2. AUTHENTICATION LOGIC (MongoDB Backend) ---

// Checks if a user token exists in localStorage to determine login state
async function checkAuthStatus() {
    const token = localStorage.getItem('userToken');
    if (token) {
        const decodedToken = decodeJwt(token);
        if (decodedToken && decodedToken.role) {
            currentUserRole = decodedToken.role;
            if (currentUserRole === 'admin') {
                adminPanelLink.classList.remove('hidden');
            } else {
                adminPanelLink.classList.add('hidden');
            }
        }
        showApp();
        fetchTasks(); // Load tasks for regular users
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
        const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
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
        const response = await fetch(`${API_BASE_URL}/api/auth/signin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('userToken', data.token); // Store the JWT token
            const decodedToken = decodeJwt(data.token);
            if (decodedToken && decodedToken.role) {
                currentUserRole = decodedToken.role;
                if (currentUserRole === 'admin') {
                    adminPanelLink.classList.remove('hidden');
                } else {
                    adminPanelLink.classList.add('hidden');
                }
            }

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

// Handles forgot password request
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
    // Hide admin section if it was visible
    dashboardSection.classList.remove('hidden');
    adminDashboardSection.classList.add('hidden');
    adminPanelLink.classList.add('hidden'); // Ensure admin link is hidden
    currentUserRole = 'user'; // Reset role on signout
});

// --- Auth View Toggling ---
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

showForgotPasswordLink.addEventListener('click', (e) => {
    e.preventDefault();
    displayMessage(forgotPasswordMessage, '', ''); // Clear messages
    signinView.classList.add('hidden');
    signupView.classList.add('hidden');
    forgotPasswordView.classList.remove('hidden');
});

backToSigninLink.addEventListener('click', (e) => {
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
            showGenericModal(
                "Error",
                "Failed to add task. Please try again.",
                [{ text: "OK", className: "vault-btn primary" }]
            );
        }
    }
});

// Handles task deletion via event delegation
taskBoard.addEventListener('click', async (e) => {
    if (e.target.classList.contains('delete-task-btn')) {
        const taskId = e.target.getAttribute('data-task-id');
        
        showGenericModal(
            "Confirm Deletion",
            "Are you sure you want to delete this task?",
            [
                { text: "Delete", className: "vault-btn primary", onClick: async () => {
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
                        showGenericModal(
                            "Error",
                            "Failed to delete task. Please try again.",
                            [{ text: "OK", className: "vault-btn primary" }]
                        );
                    }
                }},
                { text: "Cancel", className: "vault-btn secondary" }
            ]
        );
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
            showGenericModal(
                "Error",
                "Failed to update task status. Please try again.",
                [{ text: "OK", className: "vault-btn primary" }]
            );
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

// --- Task Details Modal Logic ---
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
            showGenericModal(
                "Error",
                "Failed to save task details: " + (errorData.error || 'Unknown error'),
                [{ text: "OK", className: "vault-btn primary" }]
            );
        }
    } catch (error) {
        console.error('Error in saveTaskDetails fetch:', error);
        showGenericModal(
            "Error",
            "An error occurred while saving task details.",
            [{ text: "OK", className: "vault-btn primary" }]
        );
    }
});

// --- ADMIN PANEL LOGIC ---

// Function to show the admin dashboard and hide the regular dashboard
function showAdminDashboard() {
    dashboardSection.classList.add('hidden');
    adminDashboardSection.classList.remove('hidden');
    // Update active state in sidebar
    dashboardLink.parentElement.classList.remove('active');
    adminPanelLink.classList.add('active');
    fetchAllUsers();
    fetchAllTasksForAdmin(); // Fetch all tasks for admin view
}

// Function to show the regular dashboard and hide the admin dashboard
function showRegularDashboard() {
    adminDashboardSection.classList.add('hidden');
    dashboardSection.classList.remove('hidden');
    // Update active state in sidebar
    adminPanelLink.classList.remove('active');
    dashboardLink.parentElement.classList.add('active');
    fetchTasks(); // Re-fetch tasks for regular user view
}

// Event listener for Admin Panel link
showAdminPanelBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (currentUserRole === 'admin') {
        showAdminDashboard();
    } else {
        showGenericModal("Access Denied", "You do not have administrative privileges.", [{ text: "OK", className: "vault-btn primary" }]);
    }
});

// Event listener for Dashboard link
dashboardLink.addEventListener('click', (e) => {
    e.preventDefault();
    showRegularDashboard();
});


// Fetches all users for admin view
const fetchAllUsers = async () => {
    const token = localStorage.getItem('userToken');
    if (!token || currentUserRole !== 'admin') {
        console.warn('Not authorized to fetch all users.');
        adminUsersList.innerHTML = '<p class="placeholder-text">Access Denied: Admin privileges required.</p>';
        return;
    }

    adminUsersList.innerHTML = '<p class="placeholder-text">Loading users...</p>'; // Show loading indicator

    try {
        const response = await fetch(`${API_BASE_URL}/admin/users`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                showGenericModal("Access Denied", "You do not have permission to view users.", [{ text: "OK", className: "vault-btn primary" }]);
                adminUsersList.innerHTML = '<p class="placeholder-text">Access Denied: Admin privileges required.</p>';
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const users = await response.json();
        renderUsersForAdmin(users);
    } catch (error) {
        console.error('Error fetching all users:', error);
        adminUsersList.innerHTML = '<p class="placeholder-text">Failed to load users.</p>';
    }
};

// Renders users in the admin user list with role dropdown and save button
const renderUsersForAdmin = (users) => {
    adminUsersList.innerHTML = ''; // Clear existing list
    if (users.length === 0) {
        adminUsersList.innerHTML = '<p class="placeholder-text">No users found.</p>';
        return;
    }

    users.forEach(user => {
        const userCard = document.createElement('div');
        userCard.className = 'user-card task-card'; // Reusing task-card styling for consistency
        userCard.innerHTML = `
            <h3>${user.email}</h3>
            <p>ID: ${user._id}</p>
            <div class="user-role-control">
                <label for="role-select-${user._id}">Role:</label>
                <select id="role-select-${user._id}" class="role-select ${user.role === 'admin' ? 'role-admin' : 'role-user'}">
                    <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
                    <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                </select>
                <button class="save-role-btn vault-btn primary" data-user-id="${user._id}" data-original-role="${user.role}">Save Role</button>
            </div>
            <div class="user-actions">
                <button class="delete-user-btn" data-user-id="${user._id}" title="Delete User">Delete User</button>
            </div>
        `;
        adminUsersList.appendChild(userCard);

        // Add event listener for role select change to enable/disable save button
        const roleSelect = userCard.querySelector(`#role-select-${user._id}`);
        const saveRoleBtn = userCard.querySelector(`.save-role-btn`);

        // Disable save button initially if no change
        saveRoleBtn.disabled = true;

        roleSelect.addEventListener('change', () => {
            if (roleSelect.value !== saveRoleBtn.dataset.originalRole) {
                saveRoleBtn.disabled = false; // Enable if role changed
                roleSelect.classList.remove('role-user', 'role-admin');
                roleSelect.classList.add(`role-${roleSelect.value}`);
            } else {
                saveRoleBtn.disabled = true; // Disable if reverted to original
                roleSelect.classList.remove('role-user', 'role-admin');
                roleSelect.classList.add(`role-${roleSelect.value}`);
            }
        });
    });

    // Add event listeners for delete user buttons
    adminUsersList.querySelectorAll('.delete-user-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const userIdToDelete = e.target.dataset.userId;
            showGenericModal(
                "Confirm User Deletion",
                `Are you sure you want to delete user: ${userIdToDelete}? This action cannot be undone.`,
                [
                    { text: "Delete User", className: "vault-btn primary", onClick: () => deleteUser(userIdToDelete) },
                    { text: "Cancel", className: "vault-btn secondary" }
                ]
            );
        });
    });

    // Add event listeners for save role buttons
    adminUsersList.querySelectorAll('.save-role-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const userIdToUpdate = e.target.dataset.userId;
            const newRole = userCard.querySelector(`#role-select-${userIdToUpdate}`).value; // Get selected value
            showGenericModal(
                "Confirm Role Change",
                `Are you sure you want to change the role of ${userCard.querySelector('h3').textContent} to "${newRole}"?`,
                [
                    { text: "Change Role", className: "vault-btn primary", onClick: () => updateUserRole(userIdToUpdate, newRole) },
                    { text: "Cancel", className: "vault-btn secondary" }
                ]
            );
        });
    });
};

// Updates a user's role (admin action)
const updateUserRole = async (userId, newRole) => {
    const token = localStorage.getItem('userToken');
    if (!token || currentUserRole !== 'admin') {
        showGenericModal("Access Denied", "You do not have permission to change user roles.", [{ text: "OK", className: "vault-btn primary" }]);
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/role`, { // New endpoint for role update
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ newRole })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        showGenericModal("Success", `User role updated to ${newRole}.`, [{ text: "OK", className: "vault-btn primary" }]);
        fetchAllUsers(); // Refresh user list to reflect changes
    } catch (error) {
        console.error('Error updating user role:', error);
        showGenericModal("Error", `Failed to update user role: ${error.message}`, [{ text: "OK", className: "vault-btn primary" }]);
    }
};


// Deletes a user (admin action)
const deleteUser = async (userId) => {
    const token = localStorage.getItem('userToken');
    if (!token || currentUserRole !== 'admin') {
        showGenericModal("Access Denied", "You do not have permission to delete users.", [{ text: "OK", className: "vault-btn primary" }]);
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        showGenericModal("Success", "User deleted successfully.", [{ text: "OK", className: "vault-btn primary" }]);
        fetchAllUsers(); // Refresh user list
    } catch (error) {
        console.error('Error deleting user:', error);
        showGenericModal("Error", `Failed to delete user: ${error.message}`, [{ text: "OK", className: "vault-btn primary" }]);
    }
};

// Fetches all tasks for admin view (global tasks)
const fetchAllTasksForAdmin = async () => {
    const token = localStorage.getItem('userToken');
    if (!token || currentUserRole !== 'admin') {
        console.warn('Not authorized to fetch all tasks for admin.');
        adminAllTasksList.innerHTML = '<p class="placeholder-text">Access Denied: Admin privileges required.</p>';
        return;
    }

    adminAllTasksList.innerHTML = '<p class="placeholder-text">Loading all tasks...</p>'; // Show loading indicator

    try {
        const response = await fetch(`${API_BASE_URL}/admin/tasks`, { // Assuming a new admin endpoint for all tasks
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                showGenericModal("Access Denied", "You do not have permission to view all tasks.", [{ text: "OK", className: "vault-btn primary" }]);
                adminAllTasksList.innerHTML = '<p class="placeholder-text">Access Denied: Admin privileges required.</p>';
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const tasks = await response.json();
        renderAllTasksForAdmin(tasks);
    } catch (error) {
        console.error('Error fetching all tasks for admin:', error);
        adminAllTasksList.innerHTML = '<p class="placeholder-text">Failed to load all tasks.</p>';
    }
};

// Renders all tasks in the admin all tasks list
const renderAllTasksForAdmin = (tasks) => {
    adminAllTasksList.innerHTML = ''; // Clear existing list
    if (tasks.length === 0) {
        adminAllTasksList.innerHTML = '<p class="placeholder-text">No tasks found in the system.</p>';
        return;
    }

    tasks.forEach(task => {
        const taskCard = document.createElement('div');
        taskCard.className = `task-card priority-${task.priority.toLowerCase()}`;
        taskCard.id = `admin-task-${task._id}`; 
        
        const dueDate = task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No Due Date';

        taskCard.innerHTML = `
            <h3>${task.title}</h3>
            <p>Status: ${task.status}</p>
            <p>Priority: ${task.priority}</p>
            <p>Due: ${dueDate}</p>
            <p>Created by: ${task.userEmail || 'N/A'}</p> <!-- Assuming user email is returned by backend -->
            <div class="task-actions">
                <button class="delete-admin-task-btn" data-task-id="${task._id}" title="Delete Task">×</button>
                <!-- Add edit functionality for admin to edit any task -->
            </div>
        `;
        adminAllTasksList.appendChild(taskCard);
    });

    // Add event listeners for delete admin task buttons
    adminAllTasksList.querySelectorAll('.delete-admin-task-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const taskIdToDelete = e.target.dataset.taskId;
            showGenericModal(
                "Confirm Task Deletion (Admin)",
                `Are you sure you want to delete this task (ID: ${taskIdToDelete})? This will delete it for all users.`,
                [
                    { text: "Delete Task", className: "vault-btn primary", onClick: () => deleteAdminTask(taskIdToDelete) },
                    { text: "Cancel", className: "vault-btn secondary" }
                ]
            );
        });
    });
};

// Deletes any task (admin action)
const deleteAdminTask = async (taskId) => {
    const token = localStorage.getItem('userToken');
    if (!token || currentUserRole !== 'admin') {
        showGenericModal("Access Denied", "You do not have permission to delete tasks globally.", [{ text: "OK", className: "vault-btn primary" }]);
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/admin/tasks/${taskId}`, { // Assuming a new admin endpoint for global task deletion
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        showGenericModal("Success", "Task deleted successfully from all users.", [{ text: "OK", className: "vault-btn primary" }]);
        fetchAllTasksForAdmin(); // Refresh all tasks list
    } catch (error) {
        console.error('Error deleting admin task:', error);
        showGenericModal("Error", `Failed to delete task: ${error.message}`, [{ text: "OK", className: "vault-btn primary" }]);
    }
};


// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    copyrightYear.textContent = new Date().getFullYear();
    checkAuthStatus(); // Check authentication state on page load

    // Log to check if unlockButton is found
    if (unlockButton) {
        console.log('Unlock button element found:', unlockButton);
        unlockButton.addEventListener('click', () => {
            console.log('Unlock button clicked! Attempting to expand form.'); 
            loginWindow.classList.add('expanded');
            loginFormWrapper.classList.remove('collapsed');
            console.log('loginWindow classes after click:', loginWindow.classList.value);
            console.log('loginFormWrapper classes after click:', loginFormWrapper.classList.value);
        });
    } else {
        console.error('Unlock button element not found!');
    }
});
