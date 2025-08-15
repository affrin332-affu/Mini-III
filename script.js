document.addEventListener('DOMContentLoaded', () => {
    // --- 1. INITIALIZATION ---

    const SUPABASE_URL = 'https://rzwprwpgsnqfoypachnt.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6d3Byd3Bnc25xZm95cGFjaG50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM2ODg1ODcsImV4cCI6MjA2OTI2NDU4N30.xqNyjecUSTNdwvvepsnsgy6JXbvb5t4tAsR7O0B6m6Q';
    const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // --- DOM Elements ---
    const focusLoginContainer = document.getElementById('focus-login-container');
    const loginWindow = document.getElementById('login-window');
    const unlockButton = document.getElementById('unlock-button');
    const loginFormWrapper = document.getElementById('login-form-wrapper');
    const appLayout = document.getElementById('app-layout');
    
    // Views within the Focus Window
    const signinView = document.getElementById('signin-view');
    const signupView = document.getElementById('signup-view');

    // Messages
    const signinMessage = document.getElementById('signin-message');
    const signupMessage = document.getElementById('signup-message');
    
    // Forms and Links
    const signinForm = document.getElementById('signin-form');
    const signupForm = document.getElementById('signup-form');
    const showSignup = document.getElementById('show-signup');
    const showSignin = document.getElementById('show-signin');
    
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
    
    document.getElementById('copyright-year').textContent = new Date().getFullYear();
    let currentUser = null;

    // --- 2. AUTHENTICATION & ANIMATION LOGIC ---

    // Toggle between Sign In and Sign Up views within the Focus Window
    showSignup.addEventListener('click', (e) => {
        e.preventDefault();
        signinView.classList.add('hidden');
        signupView.classList.remove('hidden');
    });

    showSignin.addEventListener('click', (e) => {
        e.preventDefault();
        signupView.classList.add('hidden');
        signinView.classList.remove('hidden');
    });

    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        signupMessage.textContent = 'Registering...';
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const { error } = await supabaseClient.auth.signUp({ email, password });
        if (error) {
            signupMessage.textContent = error.message;
        } else {
            signupMessage.textContent = 'Success! Please check your email to confirm.';
        }
    });

    signinForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        signinMessage.textContent = 'Verifying...';
        const email = document.getElementById('signin-email').value;
        const password = document.getElementById('signin-password').value;
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) {
            signinMessage.textContent = error.message;
        }
    });

    signoutButton.addEventListener('click', () => supabaseClient.auth.signOut());

    supabaseClient.auth.onAuthStateChange((event, session) => {
        if (session && session.user) {
            currentUser = session.user;
            loginWindow.classList.add('success');
            setTimeout(() => {
                focusLoginContainer.classList.add('hidden');
                appLayout.classList.remove('hidden');
            }, 600);
            fetchTasks();
        } else {
            currentUser = null;
            appLayout.classList.add('hidden');
            focusLoginContainer.classList.remove('hidden');
            // Reset the window to its initial state
            loginWindow.classList.remove('success', 'expanded');
            loginFormWrapper.classList.add('collapsed');
            // Ensure sign-in is the default view
            signupView.classList.add('hidden');
            signinView.classList.remove('hidden');
            signinMessage.textContent = '';
            signupMessage.textContent = '';
        }
    });

    unlockButton.addEventListener('click', () => {
        loginWindow.classList.add('expanded');
        loginFormWrapper.classList.remove('collapsed');
    });


    // --- 3. TASK MANAGEMENT ---
    const fetchTasks = async () => {
        if (!currentUser) return;
        const { data: tasks, error } = await supabaseClient
            .from('tasks')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });

        if (error) console.error('Error fetching tasks:', error);
        else renderTasks(tasks);
    };

    const renderTasks = (tasks) => {
        document.querySelectorAll('.task-column').forEach(col => {
            col.querySelectorAll('.task-card').forEach(card => card.remove());
        });
        tasks.forEach(task => {
            const column = document.getElementById(task.status);
            if (column) {
                const card = document.createElement('div');
                card.className = `task-card priority-${task.priority.toLowerCase()}`;
                card.id = task.id;
                card.draggable = true;
                card.innerHTML = `<p>${task.title}</p><button class="delete-task-btn" data-task-id="${task.id}" title="Delete Task">×</button>`;
                card.addEventListener('dragstart', dragStart);
                column.appendChild(card);
            }
        });
    };

    addTaskForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const titleInput = document.getElementById('task-title');
        const priorityInput = document.getElementById('task-priority');
        const title = titleInput.value.trim();
        const priority = priorityInput.value;

        if (title && currentUser) {
            const { error } = await supabaseClient
                .from('tasks')
                .insert({ title, priority, user_id: currentUser.id, status: 'To Do' });
            
            if (error) {
                console.error('Error adding task:', error);
            } else {
                titleInput.value = '';
                fetchTasks();
            }
        }
    });

    taskBoard.addEventListener('click', async (e) => {
        if (e.target.classList.contains('delete-task-btn')) {
            const taskId = e.target.getAttribute('data-task-id');
            if (confirm('Are you sure you want to delete this task?')) {
                const { error } = await supabaseClient.from('tasks').delete().eq('id', taskId);
                if (error) console.error('Error deleting task:', error);
                else fetchTasks();
            }
        }
    });


    // --- 4. DRAG-AND-DROP LOGIC ---
    function dragStart(e) {
        e.dataTransfer.setData('text/plain', e.target.id);
        e.target.classList.add('dragging');
    }

    window.drop = async (e) => {
        e.preventDefault();
        const taskId = e.dataTransfer.getData('text');
        const draggedElement = document.getElementById(taskId);
        const targetColumn = e.target.closest('.task-column');
        document.querySelectorAll('.task-card').forEach(card => card.classList.remove('dragging'));
        if (draggedElement && targetColumn) {
            targetColumn.appendChild(draggedElement);
            const newStatus = targetColumn.id;
            if (!taskId.startsWith('temp-')) {
                await supabaseClient.from('tasks').update({ status: newStatus }).eq('id', taskId);
            }
        }
    };

    // --- 5. UI & SECRET VAULT LOGIC ---
    themeToggle.addEventListener('click', () => document.body.classList.toggle('dark-mode'));

    let clickCount = 0;
    logo.addEventListener('click', () => {
        clickCount++;
        setTimeout(() => { clickCount = 0; }, 600);
        if (clickCount === 3) {
            clickCount = 0;
            vaultModal.classList.remove('hidden');
        }
    });
    closeVaultModal.addEventListener('click', () => vaultModal.classList.add('hidden'));

    // --- 6. Menu Toggle Logic ---
    menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
    });
});
