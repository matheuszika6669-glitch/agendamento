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
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    currentWeekStart = new Date(today);
    currentWeekStart.setDate(today.getDate() + daysToMonday);
    currentWeekStart.setHours(0, 0, 0, 0);

    // Define semana ativa (última semana cadastrada ou semana atual)
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
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('memberLogin').classList.add('hidden');
    document.getElementById('adminLogin').classList.add('hidden');
    document.getElementById('memberDashboard').classList.add('hidden');
    document.getElementById('adminDashboard').classList.add('hidden');
}
function showMemberLogin() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('memberLogin').classList.remove('hidden');
}
function showAdminLogin() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('adminLogin').classList.remove('hidden');
}

// --- Validação CPF ---
function formatCPF(input) {
    let value = input.value.replace(/\D/g, '');
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    input.value = value;
}
function validateCPF(input) {
    const cpf = input.value.replace(/\D/g, '');
    const errorDiv = document.getElementById('cpfError');
    if (cpf.length !== 11 || !isValidCPF(cpf)) {
        input.classList.add('border-red-500');
        errorDiv.classList.remove('hidden');
        return false;
    } else {
        input.classList.remove('border-red-500');
        errorDiv.classList.add('hidden');
        return true;
    }
}
function isValidCPF(cpf) {
    if (/^(\d)\1{10}$/.test(cpf)) return false;
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(cpf.charAt(i)) * (10 - i);
    let remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.charAt(9))) return false;
    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(cpf.charAt(i)) * (11 - i);
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    return remainder === parseInt(cpf.charAt(10));
}

// --- Login Sócio ---
async function memberLogin(event) {
    event.preventDefault();
    const name = document.getElementById('memberName').value.trim();
    const cpfInput = document.getElementById('memberCPF');
    const cpf = cpfInput.value.trim();
    
    if (!validateCPF(cpfInput)) {
        alert('CPF inválido!');
        return;
    }

    let { data: member, error } = await supabase
        .from("members")
        .select("*")
        .eq("cpf", cpf)
        .maybeSingle();

    if (error) {
        console.error("Erro ao buscar membro:", error);
    }

    if (!member) {
        let { data: newMember, error: insertError } = await supabase
            .from("members")
            .insert([{ name, cpf }])
            .select()
            .single();

        if (insertError) {
            console.error("Erro ao inserir novo membro:", insertError);
            return; // Impede continuar com o fluxo em caso de erro
        } else {
            member = newMember;
        }
    }

    if (member && member.name) {
        currentUser = member;
        isAdmin = false;
        currentWeekStart = new Date(activeWeekStart);
        document.getElementById('currentMemberName').textContent = member.name;
        document.getElementById('memberLogin').classList.add('hidden');
        document.getElementById('memberDashboard').classList.remove('hidden');
        updateScheduleDisplay();
    } else {
        console.error("Membro não encontrado ou erro na resposta.");
    }
}

// --- Login Admin ---
async function adminLogin(event) {
    event.preventDefault();
    const user = document.getElementById('adminUser').value;
    const pass = document.getElementById('adminPass').value;
    let { data: admin, error } = await supabase
        .from("admins")
        .select("*")
        .eq("username", user)
        .eq("password", pass)
        .maybeSingle();

    if (error) {
        console.error("Erro ao autenticar administrador:", error);
        alert('Erro ao autenticar administrador.');
        return;
    }

    if (admin) {
        currentUser = { name: 'Administrador' };
        isAdmin = true;
        document.getElementById('adminLogin').classList.add('hidden');
        document.getElementById('adminDashboard').classList.remove('hidden');
        updateAdminScheduleDisplay();
    } else {
        alert('Usuário ou senha incorretos!');
        console.error("Falha no login do administrador: credenciais inválidas.");
    }
}

function logout() {
    currentUser = null;
    isAdmin = false;
    document.getElementById('memberName').value = '';
    document.getElementById('memberCPF').value = '';
    document.getElementById('adminUser').value = '';
    document.getElementById('adminPass').value = '';
    showLoginScreen();
}

// --- Agenda Sócio ---
async function updateScheduleDisplay() {
    const weekDisplay = formatWeekDisplay(currentWeekStart);
    document.getElementById('currentWeekDisplay').textContent = weekDisplay;
    updateDayContent();
}

async function selectDay(dayIndex) {
    selectedDay = dayIndex;
    document.querySelectorAll('.day-tab').forEach((tab, index) => {
        tab.className = index === dayIndex
            ? 'day-tab px-4 py-3 bg-green-600 text-white border-b-2 border-green-600'
            : 'day-tab px-4 py-3 bg-gray-100 text-gray-600 hover:bg-gray-200';
    });
    updateDayContent();
}

async function updateDayContent() {
    const timeSlotsContainer = document.getElementById('timeSlots');
    timeSlotsContainer.innerHTML = '';
    const hours = [];
    for (let h = 8; h <= 21; h++) hours.push(`${h.toString().padStart(2, '0')}:00`);
    const { data: bookings } = await supabase
        .from("bookings")
        .select("*, members(name, cpf)")
        .eq("week_start", getWeekKey());
    const { data: blocks } = await supabase
        .from("blocked_slots")
        .select("*");
    const blocksMap = {};
    blocks?.forEach(b => blocksMap[`${b.day_of_week}-${b.hour}`] = true);
    hours.forEach(hour => {
        const booking = bookings?.find(b => b.day_of_week === selectedDay && b.hour === hour);
        const isBlocked = blocksMap[`${selectedDay}-${hour}`];
        const slotDiv = document.createElement('div');
        slotDiv.className = 'p-3 rounded-lg border-2 text-center min-h-[80px] flex flex-col justify-center';
        if (isBlocked) {
            slotDiv.className += ' bg-gray-800 text-white';
            slotDiv.innerHTML = `<div>${hour}</div><div>🚫 Bloqueado</div>`;
        } else if (booking) {
            if (booking.members?.cpf === currentUser.cpf) {
                slotDiv.className += ' bg-blue-500 text-white';
                slotDiv.innerHTML = `<div>${hour}</div><div>Meu agendamento</div>`;
                slotDiv.onclick = () => openCancelModal(selectedDay, hour, booking.id);
            } else {
                slotDiv.className += ' bg-red-500 text-white';
                slotDiv.innerHTML = `<div>${hour}</div><div>Ocupado</div>`;
            }
        } else {
            slotDiv.className += ' bg-green-500 text-white hover:bg-green-600';
            slotDiv.innerHTML = `<div>${hour}</div><div>Disponível</div>`;
            slotDiv.onclick = () => openBookingModal(selectedDay, hour);
        }
        timeSlotsContainer.appendChild(slotDiv);
    });
}

function openBookingModal(dayIndex, hour) {
    selectedSlot = { dayIndex, hour };
    document.getElementById('bookingTime').textContent = hour;
    document.getElementById('bookingModal').classList.remove('hidden');
}
function closeBookingModal() {
    document.getElementById('bookingModal').classList.add('hidden');
    selectedSlot = null;
}
async function confirmBooking() {
    if (selectedSlot) {
        await supabase.from("bookings").insert([{
            member_id: currentUser.id,
            week_start: getWeekKey(),
            day_of_week: selectedSlot.dayIndex,
            hour: selectedSlot.hour
        }]);
        updateScheduleDisplay();
        closeBookingModal();
        alert('Agendamento realizado!');
    }
}

function openCancelModal(dayIndex, hour, bookingId) {
    selectedSlot = { dayIndex, hour, bookingId };
    document.getElementById('cancelTime').textContent = hour;
    document.getElementById('cancelModal').classList.remove('hidden');
}
function closeCancelModal() {
    document.getElementById('cancelModal').classList.add('hidden');
    selectedSlot = null;
}
async function confirmCancel() {
    if (selectedSlot) {
        await supabase.from("bookings").delete().eq("id", selectedSlot.bookingId);
        updateScheduleDisplay();
        closeCancelModal();
        alert('Agendamento cancelado!');
    }
}

// --- Agenda Admin ---
async function updateAdminScheduleDisplay() {
    const weekDisplay = formatWeekDisplay(currentWeekStart);
    document.getElementById('adminCurrentWeekDisplay').textContent = weekDisplay;
    updateAdminDayContent();
}
async function selectAdminDay(dayIndex) {
    selectedAdminDay = dayIndex;
    document.querySelectorAll('.admin-day-tab').forEach((tab, index) => {
        tab.className = index === dayIndex
            ? 'admin-day-tab px-4 py-3 bg-blue-600 text-white border-b-2 border-blue-600'
            : 'admin-day-tab px-4 py-3 bg-gray-100 text-gray-600 hover:bg-gray-200';
    });
    updateAdminDayContent();
}
async function updateAdminDayContent() {
    const container = document.getElementById('adminTimeSlots');
    container.innerHTML = '';
    const hours = [];
    for (let h = 8; h <= 21; h++) hours.push(`${h.toString().padStart(2, '0')}:00`);
    const { data: bookings } = await supabase
        .from("bookings")
        .select("*, members(name, cpf)")
        .eq("week_start", getWeekKey());
    const { data: blocks } = await supabase.from("blocked_slots").select("*");
    const blocksMap = {};
    blocks?.forEach(b => blocksMap[`${b.day_of_week}-${b.hour}`] = b);
    hours.forEach(hour => {
        const booking = bookings?.find(b => b.day_of_week === selectedAdminDay && b.hour === hour);
        const isBlocked = blocksMap[`${selectedAdminDay}-${hour}`];
        const div = document.createElement('div');
        div.className = 'p-3 rounded-lg border-2 text-center min-h-[80px] flex flex-col justify-center';
        if (isBlocked) {
            div.className += ' bg-gray-800 text-white';
            div.innerHTML = `<div>${hour}</div><div>🚫 Bloqueado</div>`;
            div.onclick = () => toggleBlockSlot(selectedAdminDay, hour, isBlocked.id);
        } else if (booking) {
            div.className += ' bg-red-500 text-white';
            div.innerHTML = `<div>${hour}</div><div>${booking.members?.name}</div>`;
        } else {
            if (isBlockMode) {
                div.className += ' bg-orange-500 text-white';
                div.innerHTML = `<div>${hour}</div><div>Bloquear</div>`;
                div.onclick = () => toggleBlockSlot(selectedAdminDay, hour);
            } else {
                div.className += ' bg-green-500 text-white';
                div.innerHTML = `<div>${hour}</div><div>Disponível</div>`;
            }
        }
        container.appendChild(div);
    });
}

async function toggleBlockSlot(dayIndex, hour, blockId = null) {
    if (blockId) {
        await supabase.from("blocked_slots").delete().eq("id", blockId);
    } else {
        await supabase.from("blocked_slots").insert([{ day_of_week: dayIndex, hour }]);
    }
    updateAdminScheduleDisplay();
}

function toggleBlockMode() {
    isBlockMode = !isBlockMode;
    const btn = document.getElementById('blockModeBtn');
    btn.textContent = isBlockMode ? 'Modo Bloqueio: ON' : 'Modo Bloqueio: OFF';
    updateAdminScheduleDisplay();
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
