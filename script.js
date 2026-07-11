// ==========================================
// INFRAESTRUTURA CORE & CONFIGURAÇÃO
// ==========================================
const TMDB_KEY = '17c56e3825d7fbae6581866083d0d778'; 
let itemSelecionado = null;
let estrelasAtivas = 0;
let debounceTimer; 
let currentUserUID = null;
let modoPlayerAtual = 'geral';
let isLoginMode = true; // Controla o estado de Login / Registo
let corDestaque = "e50914"; // Vermelho padrão

let perfilUsuario = {
    username: "Operador",
    avatar: "https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png"
};

const firebaseConfig = {
    apiKey: "AIzaSyAfPWvnGdvPKZ_lrVwOuag14WHLY9AgML8",
    authDomain: "cinenet-ifpb.firebaseapp.com",
    projectId: "cinenet-ifpb",
    storageBucket: "cinenet-ifpb.firebasestorage.app",
    messagingSenderId: "1098247355110",
    appId: "1:1098247355110:web:c9f867826f26b0ef171927"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Oculta/Exibe scroll do body
function alternarScrollBody(bloquear) {
    if (bloquear) {
        document.body.classList.add('modal-open');
    } else {
        document.body.classList.remove('modal-open');
    }
}

// ==========================================
// SISTEMA DE AUTENTICAÇÃO & FLUXO
// ==========================================

function handleAuth(event) {
    event.preventDefault();
    const email = document.getElementById('auth-user').value.trim();
    const pass = document.getElementById('auth-pass').value.trim();
    const errorBox = document.getElementById('auth-error');
    const btn = document.getElementById('auth-btn');

    btn.innerText = "SINCRO_PROCESSANDO..."; 
    btn.disabled = true;
    errorBox.style.display = 'none';

    if (isLoginMode) {
        auth.signInWithEmailAndPassword(email, pass).then(() => {
            document.getElementById('auth-screen').style.display = 'none';
        }).catch((error) => {
            if (error.code === 'auth/user-not-found') {
                errorBox.innerText = "Utilizador não encontrado. Registe-se abaixo.";
            } else if (error.code === 'auth/wrong-password') {
                errorBox.innerText = "Palavra-passe incorreta para este operador.";
            } else if (error.code === 'auth/invalid-email') {
                errorBox.innerText = "Formato de e-mail inválido.";
            } else {
                errorBox.innerText = "Erro: " + error.message;
            }
            errorBox.style.display = 'block'; 
            btn.disabled = false; 
            btn.innerText = "AUTENTICAR SISTEMA";
        });
    } else {
        auth.createUserWithEmailAndPassword(email, pass).then((userCredential) => {
            db.collection("usuarios").doc(userCredential.user.uid).set({
                email: email, 
                perfil: { username: email.split('@')[0], avatar: "https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png" },
                biblioteca: { watchlist: {}, reviews: {} }
            }).then(() => {
                document.getElementById('auth-screen').style.display = 'none';
            });
        }).catch((error) => {
            errorBox.innerText = "Erro no registo: " + error.message;
            errorBox.style.display = 'block'; 
            btn.disabled = false; 
            btn.innerText = "REGISTRAR CREDENCIAIS";
        });
    }
}

function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    document.getElementById('auth-title').innerText = isLoginMode ? 'NÚCLEO DE TRANSMISSÃO' : 'REQUISITAR NOVO ACESSO';
    document.getElementById('auth-btn').innerText = isLoginMode ? 'AUTENTICAR SISTEMA' : 'REGISTRAR CREDENCIAIS';
    document.getElementById('auth-switch-text').innerText = isLoginMode ? 'Novo por aqui?' : 'Já possui registo?';
    document.getElementById('auth-link').innerText = isLoginMode ? 'Criar conta de acesso' : 'Fazer Login';
    document.getElementById('auth-error').style.display = 'none';
}

function entrarComoConvidado() {
    console.log("Aceder como convidado.");
    document.getElementById('auth-screen').style.display = 'none';
    currentUserUID = "guest";
    // Carregar interface inicial em modo leitura aqui se necessário
}

// Monitorização do Estado de Autenticação
auth.onAuthStateChanged((user) => {
    if (user) {
        currentUserUID = user.uid;
        document.getElementById('auth-screen').style.display = 'none';
        // Executar funções para carregar dados do utilizador autenticado
    } else if (currentUserUID !== "guest") {
        document.getElementById('auth-screen').style.display = 'flex';
    }
});

// ==========================================
// REPRODUTOR DE VÍDEO
// ==========================================
function fecharPlayer() {
    document.getElementById('playerModal').style.display = 'none';
    document.getElementById('videoPlayer').src = "";
    alternarScrollBody(false);
}

function atualizarIframePlayer(id) {
    const player = document.getElementById('videoPlayer');
    if (!id) return;

    if (modoPlayerAtual === 'geral') {
        player.src = `https://mgeb.top/embed/${id}?player=vidstack#color:${corDestaque}`;
    } else {
        const season = document.getElementById('player-season-input').value || 1;
        const episode = document.getElementById('player-episode-input').value || 1;
        player.src = `https://mgeb.top/embed/${id}/${season}/${episode}?player=vidstack#color:${corDestaque}`; 
    }
}