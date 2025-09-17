// 🔗 Configuração do Supabase
const SUPABASE_URL = "https://tgilgszurykbamlrtfda.supabase.co"; // Troque
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnaWxnc3p1cnlrYmFtbHJ0ZmRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwNjkyMDYsImV4cCI6MjA3MzY0NTIwNn0.Y9a2i9KOao_pCQYui67iZWWNGz12jtMevmqaP2Md-Yw"; // Troque
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Variáveis globais
let currentUser = null;
let isAdmin = false;
let currentWeekStart = null;
let activeWeekStart = null;
let isBlockMode = false;
let selectedSlot = null;
let selectedDay = 0;
let selectedAdminDay = 0;

// --- Inicialização ---
async function initSystem() {
    console.log("Iniciando o sistema...");
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    currentWeekStart = new Date(today);
    currentWeekStart.setDate(today.getDate() + daysToMonday);
    currentWeekStart.setHours(0, 0, 0, 0);

    let { data, error } = await supabase
        .from("bookings")
        .select("week_start")
        .order("week_start", { ascending: false })
        .limit(1);

    if (!error && data.length > 0) {
        activeWeekStart = new Date(data[0].week_start);
    } else {
        activeWeekStart = new Date(currentWeekStart);
    }
}

// --- Navegação de telas ---
function showLoginScreen() {
    console.log("Mostrando tela de login...");
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('memberLogin').classList.add('hidden');
    document.getElementById('adminLogin').classList.add('hidden');
    document.getElementById('memberDashboard').classList.add('hidden');
    document.getElementById('adminDashboard').classList.add('hidden');
}

function showMemberLogin() {
    console.log("Mostrando tela de login do sócio...");
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('memberLogin').classList.remove('hidden');
}

function showAdminLogin() {
    console.log("Mostrando tela de login do administrador...");
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('adminLogin').classList.remove('hidden');
}

// --- Login Sócio ---
async function memberLogin(event) {
    event.preventDefault();
    console.log("Iniciando login do sócio...");
    
    const name = document.getElementById('memberName').value.trim();
    const cpf = document.getElementById('memberCPF').value.trim();

    if (!validateCPF(cpf)) {
        alert('CPF inválido!');
        return;
    }

    let { data: member, error } = await supabase
        .from("members")
        .select("*")
        .eq("cpf", cpf)
        .maybeSingle();

    if (error || !member) {
        console.error("Erro ao buscar membro:", error);
        alert('Membro não encontrado!');
        return;
    }

    currentUser = member;
    console.log("Membro encontrado:", currentUser);

    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('memberLogin').classList.add('hidden');
    document.getElementById('memberDashboard').classList.remove('hidden');
    updateScheduleDisplay();
}

// --- Login Admin ---
async function adminLogin(event) {
    event.preventDefault();
    console.log("Iniciando login do administrador...");
    const username = document.getElementById('adminUser').value;
    const password = document.getElementById('adminPass').value;

    let { data: admin, error } = await supabase
        .from("admins")
        .select("*")
        .eq("username", username)
        .eq("password", password)
        .maybeSingle();

    if (error || !admin) {
        alert('Usuário ou senha incorretos!');
        console.error("Falha no login do administrador:", error);
        return;
    }

    currentUser = admin;
    console.log("Administrador autenticado:", currentUser);

    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('adminLogin').classList.add('hidden');
    document.getElementById('adminDashboard').classList.remove('hidden');
    updateAdminScheduleDisplay();
}

// --- Logout ---
function logout() {
    console.log("Logout realizado...");
    currentUser = null;
    document.getElementById('memberName').value = '';
    document.getElementById('memberCPF').value = '';
    document.getElementById('adminUser').value = '';
    document.getElementById('adminPass').value = '';
    showLoginScreen();
}

// --- Agenda Sócio ---
async function updateScheduleDisplay() {
    console.log("Atualizando exibição da agenda...");
    const weekDisplay = formatWeekDisplay(currentWeekStart);
    document.getElementById('currentWeekDisplay').textContent = weekDisplay;
    updateDayContent();
}

// --- Utilitários ---
function getWeekKey() {
    return currentWeekStart.toISOString().split('T')[0];
}

function formatWeekDisplay(weekStart) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const options = { day: '2-digit', month: '2-digit', year: 'numeric' };
    return `${weekStart.toLocaleDateString('pt-BR', options)} a ${weekEnd.toLocaleDateString('pt-BR', options)}`;
}

// --- Start ---
initSystem();
